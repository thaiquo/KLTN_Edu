package iuh.fit.learning_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.CommunityModerationDtos.*;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.*;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.*;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CommunityManualModerationService {
    private final CommunityPostRepository posts;
    private final CommunityPostReportRepository reports;
    private final CommunityModerationHistoryRepository history;
    private final CommunityPostPendingRevisionRepository pending;
    private final LearningEventPublisher eventPublisher;
    private final CommunityPostService communityPostService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CommunityManualModerationService(CommunityPostRepository posts, CommunityPostReportRepository reports,
            CommunityModerationHistoryRepository history, CommunityPostPendingRevisionRepository pending,
            LearningEventPublisher eventPublisher, CommunityPostService communityPostService) {
        this.posts = posts; this.reports = reports; this.history = history; this.pending = pending;
        this.eventPublisher = eventPublisher;
        this.communityPostService = communityPostService;
    }

    @Transactional
    public Report report(Long postId, ReportRequest request, LearningUserPrincipal principal) {
        requireStudentOrTutor(principal);
        CommunityPost post = posts.findByIdForUpdate(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        if (post.getAuthorId().equals(principal.userId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Không thể báo cáo bài viết của chính mình");
        }
        if (reports.existsByPostIdAndReporterUserIdAndStatus(postId, principal.userId(), CommunityReportStatus.OPEN)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đã báo cáo bài viết này");
        }
        CommunityPostReport row = new CommunityPostReport();
        row.setPost(post); row.setReporterUserId(principal.userId()); row.setReporterRole(principal.activeRole());
        row.setReason(request.reason().trim()); row.setDetails(normalize(request.details())); row.setStatus(CommunityReportStatus.OPEN);
        return reportDto(reports.save(row));
    }

    @Transactional(readOnly = true)
    public Page<QueueItem> queue(CommunityModerationStatus moderationStatus, boolean reportedOnly,
                                 String keyword, Pageable pageable) {
        Specification<CommunityPost> spec = (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            Predicate moderationFlag = moderationStatus != null
                    ? cb.equal(root.get("moderationStatus"), moderationStatus)
                    : root.get("moderationStatus").in(CommunityModerationStatus.NEEDS_EDIT,
                            CommunityModerationStatus.NEEDS_REVIEW,
                            CommunityModerationStatus.REJECTED, CommunityModerationStatus.FAILED);
            var pendingSubquery = query.subquery(Long.class);
            var pendingRow = pendingSubquery.from(CommunityPostPendingRevision.class);
            pendingSubquery.select(cb.literal(1L)).where(
                    cb.equal(pendingRow.get("postId"), root.get("id")),
                    cb.equal(pendingRow.get("moderationStatus"), CommunityModerationStatus.NEEDS_REVIEW));
            Predicate pendingReview = cb.exists(pendingSubquery);
            var reportSubquery = query.subquery(Long.class);
            var report = reportSubquery.from(CommunityPostReport.class);
            reportSubquery.select(cb.literal(1L)).where(cb.equal(report.get("post"), root),
                    cb.equal(report.get("status"), CommunityReportStatus.OPEN));
            if (reportedOnly) {
                predicates.add(cb.exists(reportSubquery));
            } else if (moderationStatus != null) {
                predicates.add(moderationStatus == CommunityModerationStatus.NEEDS_REVIEW
                        ? cb.or(moderationFlag, pendingReview)
                        : moderationFlag);
            } else {
                predicates.add(cb.or(cb.exists(reportSubquery), moderationFlag, pendingReview));
            }
            if (keyword != null && !keyword.isBlank()) {
                String like = "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
                var pendingKeywordSubquery = query.subquery(Long.class);
                var pendingKeywordRow = pendingKeywordSubquery.from(CommunityPostPendingRevision.class);
                pendingKeywordSubquery.select(cb.literal(1L)).where(
                        cb.equal(pendingKeywordRow.get("postId"), root.get("id")),
                        cb.like(cb.lower(pendingKeywordRow.get("requestJson")), like));
                predicates.add(cb.or(cb.like(cb.lower(root.get("title")), like),
                        cb.like(cb.lower(root.get("content")), like),
                        cb.exists(pendingKeywordSubquery)));
            }
            if (query.getResultType() != Long.class && query.getResultType() != long.class) {
                Expression<LocalDateTime> activityAt = root.get("updatedAt");
                if (!reportedOnly && (moderationStatus == null
                        || moderationStatus == CommunityModerationStatus.NEEDS_REVIEW)) {
                    var pendingCreatedAtSubquery = query.subquery(LocalDateTime.class);
                    var pendingCreatedAtRow = pendingCreatedAtSubquery.from(CommunityPostPendingRevision.class);
                    pendingCreatedAtSubquery.select(pendingCreatedAtRow.get("createdAt")).where(
                            cb.equal(pendingCreatedAtRow.get("postId"), root.get("id")),
                            cb.equal(pendingCreatedAtRow.get("moderationStatus"),
                                    CommunityModerationStatus.NEEDS_REVIEW));
                    activityAt = cb.coalesce(pendingCreatedAtSubquery, root.<LocalDateTime>get("updatedAt"));
                }
                query.orderBy(cb.desc(activityAt), cb.desc(root.get("id")));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        Pageable databasePageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        Page<CommunityPost> page = posts.findAll(spec, databasePageable);
        Map<Long, Long> counts = openReportCounts(page.getContent());
        Map<Long, CommunityPostPendingRevision> revisions = pendingRevisions(page.getContent());
        List<QueueItem> content = page.getContent().stream()
                .map(p -> queueDto(p, counts.getOrDefault(p.getId(), 0L), revisions.get(p.getId()),
                        moderationStatus, reportedOnly))
                .toList();
        return new PageImpl<>(content, pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public Detail detail(Long postId) {
        return detail(postId, null);
    }

    @Transactional(readOnly = true)
    public Detail detail(Long postId, ModerationSource source) {
        CommunityPost post = posts.findById(postId).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        List<Report> reportRows = reports.findByPostIdOrderByCreatedAtAscIdAsc(postId).stream().map(this::reportDto).toList();
        List<History> historyRows = history.findByPostIdOrderByCreatedAtAscIdAsc(postId).stream().map(this::historyDto).toList();
        long openCount = reportRows.stream().filter(r -> CommunityReportStatus.OPEN.name().equals(r.status())).count();
        CommunityPostPendingRevision revision = pending.findById(postId).orElse(null);
        if (source == ModerationSource.AI_REVISION_REVIEW
                && (revision == null || revision.getModerationStatus() != CommunityModerationStatus.NEEDS_REVIEW)) {
            throw new ResourceNotFoundException("Không tìm thấy bản chỉnh sửa đang chờ kiểm duyệt");
        }
        CommunityPostPendingRevision selectedRevision = source == ModerationSource.AI_POST_REVIEW
                || source == ModerationSource.USER_REPORT ? null : revision;
        return new Detail(queueDto(post, openCount, selectedRevision, null,
                source == ModerationSource.USER_REPORT), reportRows, historyRows);
    }

    @Transactional
    public Detail decide(Long postId, ActionRequest request, LearningUserPrincipal actor) {
        requireOperator(actor);
        CommunityPost post = posts.findByIdForUpdate(postId).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        CommunityPostPendingRevision pendingRevision = pending.findByPostIdForUpdate(postId).orElse(null);
        boolean revisionDecision = request.source() == ModerationSource.AI_REVISION_REVIEW
                || (request.source() == null && pendingRevision != null
                    && pendingRevision.getModerationStatus() == CommunityModerationStatus.NEEDS_REVIEW
                    && Objects.equals(pendingRevision.getContentRevision(), request.expectedContentRevision()));
        if (revisionDecision) {
            return decideRevision(post, pendingRevision, request, actor);
        }
        if (!Objects.equals(post.getContentRevision(), request.expectedContentRevision())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bài viết đã thay đổi; vui lòng tải lại trước khi xử lý");
        }
        PostStatus previousPostStatus = post.getStatus();
        CommunityModerationStatus previousModerationStatus = post.getModerationStatus();
        switch (request.action()) {
            case APPROVE -> post.setModerationStatus(CommunityModerationStatus.ALLOWED);
            case REJECT -> { post.setModerationStatus(CommunityModerationStatus.REJECTED); post.setStatus(PostStatus.HIDDEN); }
            case HIDE -> post.setStatus(PostStatus.HIDDEN);
            case RESTORE -> {
                PostStatus restored = history.findTopByPostIdAndActionOrderByCreatedAtDescIdDesc(postId, "HIDE")
                        .map(CommunityModerationHistory::getPreviousPostStatus)
                        .map(value -> { try { return PostStatus.valueOf(value); } catch (Exception ignored) { return PostStatus.OPEN; } })
                        .orElse(PostStatus.OPEN);
                post.setStatus(restored == PostStatus.HIDDEN ? PostStatus.OPEN : restored);
                post.setModerationStatus(CommunityModerationStatus.ALLOWED);
            }
        }
        post.setContentRevision(post.getContentRevision() + 1);
        post.setModerationReason(request.reason().trim());
        post.setModerationPromptVersion("MANUAL_M2");
        post.setModeratedAt(LocalDateTime.now());
        if (pendingRevision != null) pending.delete(pendingRevision);
        posts.save(post);
        reports.resolveOpen(postId,
                request.action() == Action.APPROVE || request.action() == Action.RESTORE
                        ? CommunityReportStatus.DISMISSED : CommunityReportStatus.RESOLVED,
                actor.userId(), actor.activeRole(), LocalDateTime.now());
        CommunityModerationHistory row = new CommunityModerationHistory();
        row.setPost(post); row.setActorUserId(actor.userId()); row.setActorEmail(actor.email()); row.setActorRole(actor.activeRole());
        row.setAction(request.action().name()); row.setPreviousPostStatus(previousPostStatus.name()); row.setNewPostStatus(post.getStatus().name());
        row.setPreviousModerationStatus(previousModerationStatus.name()); row.setNewModerationStatus(post.getModerationStatus().name());
        row.setReason(request.reason().trim()); history.save(row);
        if (previousModerationStatus == CommunityModerationStatus.NEEDS_REVIEW
                && (request.action() == Action.APPROVE || request.action() == Action.REJECT)) {
            eventPublisher.publishCommunityPostModerated(
                    post.getId(), post.getContentRevision(), post.getAuthorId(), post.getAuthorRole(), post.getTitle(),
                    request.action() == Action.APPROVE ? "APPROVED" : "REJECTED",
                    request.reason().trim(), actor.userId());
        }
        return detail(postId);
    }

    private Detail decideRevision(CommunityPost post, CommunityPostPendingRevision revision,
                                  ActionRequest request, LearningUserPrincipal actor) {
        if (revision == null || revision.getModerationStatus() != CommunityModerationStatus.NEEDS_REVIEW) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Bản chỉnh sửa không còn ở trạng thái chờ kiểm duyệt");
        }
        if (!Objects.equals(revision.getContentRevision(), request.expectedContentRevision())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Bản chỉnh sửa đã thay đổi; vui lòng tải lại trước khi xử lý");
        }
        if (request.action() != Action.APPROVE && request.action() != Action.REJECT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Bản chỉnh sửa chỉ hỗ trợ quyết định duyệt hoặc từ chối");
        }

        PostStatus originalPostStatus = post.getStatus();
        CommunityModerationStatus resolvedStatus;
        String historyAction;
        if (request.action() == Action.APPROVE) {
            communityPostService.approvePendingRevisionManually(post, revision, request.reason().trim());
            resolvedStatus = CommunityModerationStatus.ALLOWED;
            historyAction = "APPROVE_REVISION";
        } else {
            resolvedStatus = CommunityModerationStatus.REJECTED;
            historyAction = "REJECT_REVISION";
        }
        long revisionId = revision.getContentRevision();
        pending.delete(revision);

        CommunityModerationHistory row = new CommunityModerationHistory();
        row.setPost(post); row.setActorUserId(actor.userId()); row.setActorEmail(actor.email());
        row.setActorRole(actor.activeRole()); row.setAction(historyAction);
        row.setPreviousPostStatus(originalPostStatus.name()); row.setNewPostStatus(post.getStatus().name());
        row.setPreviousModerationStatus(CommunityModerationStatus.NEEDS_REVIEW.name());
        row.setNewModerationStatus(resolvedStatus.name()); row.setReason(request.reason().trim());
        history.save(row);

        eventPublisher.publishCommunityPostRevisionModerated(
                post.getId(), revisionId, post.getAuthorId(), post.getAuthorRole(), post.getTitle(),
                request.action() == Action.APPROVE ? "APPROVED" : "REJECTED",
                request.reason().trim(), actor.userId());
        return detail(post.getId());
    }

    private Map<Long, Long> openReportCounts(List<CommunityPost> rows) {
        if (rows.isEmpty()) return Map.of();
        return reports.countOpenByPostIds(rows.stream().map(CommunityPost::getId).toList()).stream()
                .collect(Collectors.toMap(row -> ((Number) row[0]).longValue(), row -> ((Number) row[1]).longValue()));
    }
    private Map<Long, CommunityPostPendingRevision> pendingRevisions(List<CommunityPost> rows) {
        if (rows.isEmpty()) return Map.of();
        return pending.findAllByPostIdIn(rows.stream().map(CommunityPost::getId).toList()).stream()
                .collect(Collectors.toMap(CommunityPostPendingRevision::getPostId, revision -> revision));
    }
    private QueueItem queueDto(CommunityPost p, long openReports, CommunityPostPendingRevision revision,
                               CommunityModerationStatus requestedStatus, boolean reportedOnly) {
        boolean revisionReview = !reportedOnly && revision != null
                && revision.getModerationStatus() == CommunityModerationStatus.NEEDS_REVIEW
                && (requestedStatus == null || requestedStatus == CommunityModerationStatus.NEEDS_REVIEW);
        PendingPreview preview = revisionReview ? pendingPreview(revision) : null;
        ModerationSource source = revisionReview ? ModerationSource.AI_REVISION_REVIEW
                : isAiPostReview(p) && !reportedOnly ? ModerationSource.AI_POST_REVIEW : ModerationSource.USER_REPORT;
        return new QueueItem(p.getId(), revisionReview ? preview.title() : p.getTitle(),
                revisionReview ? preview.content() : p.getContent(), p.getAuthorId(), p.getAuthorName(), p.getAuthorRole(),
                p.getStatus(), revisionReview ? revision.getModerationStatus() : p.getModerationStatus(),
                revisionReview ? revision.getModerationReason() : p.getModerationReason(),
                split(revisionReview ? revision.getModerationCategories() : p.getModerationCategories()),
                revisionReview ? revision.getContentRevision() : p.getContentRevision(), openReports,
                revisionReview ? revision.getCreatedAt() : p.getCreatedAt(),
                revisionReview && revision.getModeratedAt() != null ? revision.getModeratedAt() : p.getUpdatedAt(),
                source, revisionReview ? revision.getContentRevision() : null,
                p.getTitle(), p.getContent(), revisionReview ? preview.title() : null,
                revisionReview ? preview.content() : null);
    }
    private boolean isAiPostReview(CommunityPost post) {
        return post.getModerationStatus() == CommunityModerationStatus.NEEDS_EDIT
                || post.getModerationStatus() == CommunityModerationStatus.NEEDS_REVIEW
                || post.getModerationStatus() == CommunityModerationStatus.REJECTED
                || post.getModerationStatus() == CommunityModerationStatus.FAILED;
    }
    private PendingPreview pendingPreview(CommunityPostPendingRevision revision) {
        try {
            JsonNode root = objectMapper.readTree(revision.getRequestJson());
            return new PendingPreview(root.path("title").asText(""), root.path("content").asText(""));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể đọc bản chỉnh sửa bài viết đang chờ kiểm duyệt", exception);
        }
    }
    private record PendingPreview(String title, String content) {}
    private Report reportDto(CommunityPostReport r) { return new Report(r.getId(), r.getReporterUserId(), r.getReporterRole(), r.getReason(), r.getDetails(), r.getStatus().name(), r.getCreatedAt()); }
    private History historyDto(CommunityModerationHistory h) { return new History(h.getId(), h.getActorUserId(), h.getActorEmail(), h.getActorRole(), h.getAction(), h.getPreviousPostStatus(), h.getNewPostStatus(), h.getPreviousModerationStatus(), h.getNewModerationStatus(), h.getReason(), h.getCreatedAt()); }
    private List<String> split(String value) { return value == null || value.isBlank() ? List.of() : Arrays.stream(value.split(",")).map(String::trim).filter(v -> !v.isBlank()).toList(); }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private void requireStudentOrTutor(LearningUserPrincipal p) { if (p == null || p.userId() == null || (!"STUDENT".equalsIgnoreCase(p.activeRole()) && !"TUTOR".equalsIgnoreCase(p.activeRole()))) throw new ForbiddenException("Chỉ Học viên hoặc Gia sư được báo cáo bài viết"); }
    private void requireOperator(LearningUserPrincipal p) { if (p == null || p.userId() == null || (!"STAFF".equalsIgnoreCase(p.activeRole()) && !"ADMIN".equalsIgnoreCase(p.activeRole()))) throw new ForbiddenException("Chỉ Staff hoặc Admin được kiểm duyệt thủ công"); }
}
