package iuh.fit.learning_service.service;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.CommunityModerationDtos.*;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.*;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.*;
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

    public CommunityManualModerationService(CommunityPostRepository posts, CommunityPostReportRepository reports,
            CommunityModerationHistoryRepository history, CommunityPostPendingRevisionRepository pending) {
        this.posts = posts; this.reports = reports; this.history = history; this.pending = pending;
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
                            CommunityModerationStatus.REJECTED, CommunityModerationStatus.FAILED);
            var reportSubquery = query.subquery(Long.class);
            var report = reportSubquery.from(CommunityPostReport.class);
            reportSubquery.select(cb.literal(1L)).where(cb.equal(report.get("post"), root),
                    cb.equal(report.get("status"), CommunityReportStatus.OPEN));
            if (reportedOnly) predicates.add(cb.exists(reportSubquery));
            else predicates.add(cb.or(cb.exists(reportSubquery), moderationFlag));
            if (keyword != null && !keyword.isBlank()) {
                String like = "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("title")), like), cb.like(cb.lower(root.get("content")), like)));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        Page<CommunityPost> page = posts.findAll(spec, pageable);
        Map<Long, Long> counts = openReportCounts(page.getContent());
        List<QueueItem> content = page.getContent().stream().map(p -> queueDto(p, counts.getOrDefault(p.getId(), 0L))).toList();
        return new PageImpl<>(content, pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public Detail detail(Long postId) {
        CommunityPost post = posts.findById(postId).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        List<Report> reportRows = reports.findByPostIdOrderByCreatedAtAscIdAsc(postId).stream().map(this::reportDto).toList();
        List<History> historyRows = history.findByPostIdOrderByCreatedAtAscIdAsc(postId).stream().map(this::historyDto).toList();
        long openCount = reportRows.stream().filter(r -> CommunityReportStatus.OPEN.name().equals(r.status())).count();
        return new Detail(queueDto(post, openCount), reportRows, historyRows);
    }

    @Transactional
    public Detail decide(Long postId, ActionRequest request, LearningUserPrincipal actor) {
        requireOperator(actor);
        CommunityPost post = posts.findByIdForUpdate(postId).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
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
        pending.findByPostIdForUpdate(postId).ifPresent(pending::delete);
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
        return detail(postId);
    }

    private Map<Long, Long> openReportCounts(List<CommunityPost> rows) {
        if (rows.isEmpty()) return Map.of();
        return reports.countOpenByPostIds(rows.stream().map(CommunityPost::getId).toList()).stream()
                .collect(Collectors.toMap(row -> ((Number) row[0]).longValue(), row -> ((Number) row[1]).longValue()));
    }
    private QueueItem queueDto(CommunityPost p, long openReports) {
        return new QueueItem(p.getId(), p.getTitle(), p.getContent(), p.getAuthorId(), p.getAuthorName(), p.getAuthorRole(),
                p.getStatus(), p.getModerationStatus(), p.getModerationReason(), split(p.getModerationCategories()),
                p.getContentRevision(), openReports, p.getCreatedAt(), p.getUpdatedAt());
    }
    private Report reportDto(CommunityPostReport r) { return new Report(r.getId(), r.getReporterUserId(), r.getReporterRole(), r.getReason(), r.getDetails(), r.getStatus().name(), r.getCreatedAt()); }
    private History historyDto(CommunityModerationHistory h) { return new History(h.getId(), h.getActorUserId(), h.getActorEmail(), h.getActorRole(), h.getAction(), h.getPreviousPostStatus(), h.getNewPostStatus(), h.getPreviousModerationStatus(), h.getNewModerationStatus(), h.getReason(), h.getCreatedAt()); }
    private List<String> split(String value) { return value == null || value.isBlank() ? List.of() : Arrays.stream(value.split(",")).map(String::trim).filter(v -> !v.isBlank()).toList(); }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private void requireStudentOrTutor(LearningUserPrincipal p) { if (p == null || p.userId() == null || (!"STUDENT".equalsIgnoreCase(p.activeRole()) && !"TUTOR".equalsIgnoreCase(p.activeRole()))) throw new ForbiddenException("Chỉ Học viên hoặc Gia sư được báo cáo bài viết"); }
    private void requireOperator(LearningUserPrincipal p) { if (p == null || p.userId() == null || (!"STAFF".equalsIgnoreCase(p.activeRole()) && !"ADMIN".equalsIgnoreCase(p.activeRole()))) throw new ForbiddenException("Chỉ Staff hoặc Admin được kiểm duyệt thủ công"); }
}
