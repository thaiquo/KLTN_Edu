package iuh.fit.learning_service.service;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.ClassRoomDtos;
import iuh.fit.learning_service.dto.CommunityPostDtos.*;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.*;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.realtime.RealtimeEventHub;
import iuh.fit.learning_service.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class CommunityPostService {

    private final CommunityPostRepository postRepository;
    private final PostPollRepository pollRepository;
    private final PostPollOptionRepository pollOptionRepository;
    private final PostPollVoteRepository pollVoteRepository;
    private final PostInteractionRepository interactionRepository;
    private final SubjectRepository subjectRepository;
    private final ClassRoomRepository classRoomRepository;
    private final TutorAvailabilityRepository availabilityRepository;
    private final TutorSubjectRegistrationRepository registrationRepository;
    private final CatalogLevelRepository levelRepository;
    private final ClassRoomService classRoomService;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final LearningEventPublisher eventPublisher;
    private final RealtimeEventHub realtimeEventHub;

    public CommunityPostService(
            CommunityPostRepository postRepository,
            PostPollRepository pollRepository,
            PostPollOptionRepository pollOptionRepository,
            PostPollVoteRepository pollVoteRepository,
            PostInteractionRepository interactionRepository,
            SubjectRepository subjectRepository,
            ClassRoomRepository classRoomRepository,
            TutorAvailabilityRepository availabilityRepository,
            TutorSubjectRegistrationRepository registrationRepository,
            CatalogLevelRepository levelRepository,
            ClassRoomService classRoomService,
            EnrollmentRequestRepository enrollmentRequestRepository,
            LearningEventPublisher eventPublisher,
            RealtimeEventHub realtimeEventHub
    ) {
        this.postRepository = postRepository;
        this.pollRepository = pollRepository;
        this.pollOptionRepository = pollOptionRepository;
        this.pollVoteRepository = pollVoteRepository;
        this.interactionRepository = interactionRepository;
        this.subjectRepository = subjectRepository;
        this.classRoomRepository = classRoomRepository;
        this.availabilityRepository = availabilityRepository;
        this.registrationRepository = registrationRepository;
        this.levelRepository = levelRepository;
        this.classRoomService = classRoomService;
        this.enrollmentRequestRepository = enrollmentRequestRepository;
        this.eventPublisher = eventPublisher;
        this.realtimeEventHub = realtimeEventHub;
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryDto> searchPosts(
            PostType postType,
            PostStatus status,
            Long subjectId,
            LearningMode learningMode,
            String keyword,
            Pageable pageable,
            Long currentUserId
    ) {
        if (status == PostStatus.HIDDEN) {
            return Page.empty(pageable);
        }
        Specification<CommunityPost> spec = (root, query, builder) -> status == null
                ? builder.notEqual(root.get("status"), PostStatus.HIDDEN)
                : builder.equal(root.get("status"), status);
        if (postType != null) {
            spec = spec.and((root, query, builder) -> builder.equal(root.get("postType"), postType));
        }
        if (subjectId != null) {
            spec = spec.and((root, query, builder) -> builder.equal(root.get("subject").get("id"), subjectId));
        }
        if (learningMode != null) {
            spec = spec.and((root, query, builder) -> builder.equal(root.get("learningMode"), learningMode));
        }
        if (keyword != null && !keyword.isBlank()) {
            String pattern = "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, builder) -> {
                var titlePred = builder.like(builder.lower(root.get("title")), pattern);
                var contentPred = builder.like(builder.lower(root.get("content")), pattern);
                var authorPred = builder.like(builder.lower(root.get("authorName")), pattern);
                var eduPred = builder.like(builder.lower(root.get("educationLevel")), pattern);
                var subjectJoin = root.join("subject", jakarta.persistence.criteria.JoinType.LEFT);
                var subjectPred = builder.like(builder.lower(subjectJoin.get("name")), pattern);
                var classJoin = root.join("linkedClass", jakarta.persistence.criteria.JoinType.LEFT);
                var classPred = builder.like(builder.lower(classJoin.get("name")), pattern);
                return builder.or(titlePred, contentPred, authorPred, eduPred, subjectPred, classPred);
            });
        }
        Page<CommunityPost> posts = postRepository.findAll(spec, pageable);
        return posts.map(post -> mapToSummaryDto(post, currentUserId));
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryDto> getMyPosts(
            PostStatus status,
            Pageable pageable,
            LearningUserPrincipal principal
    ) {
        if (principal == null || principal.userId() == null) {
            throw new ForbiddenException("Vui lòng đăng nhập để xem bài đăng của bạn");
        }
        if (status == PostStatus.HIDDEN) {
            return Page.empty(pageable);
        }

        String role = principal.activeRole() == null ? "" : principal.activeRole().trim().toUpperCase(Locale.ROOT);
        Specification<CommunityPost> spec = (root, query, builder) -> builder.and(
                builder.equal(root.get("authorId"), principal.userId()),
                builder.equal(root.get("authorRole"), role),
                status == null
                        ? builder.notEqual(root.get("status"), PostStatus.HIDDEN)
                        : builder.equal(root.get("status"), status)
        );
        return postRepository.findAll(spec, pageable)
                .map(post -> mapToSummaryDto(post, principal.userId()));
    }

    public PostSummaryDto getPostDetail(Long postId, Long currentUserId) {
        if (postRepository.incrementViewCount(postId) == 0) {
            throw new ResourceNotFoundException("Community post not found: " + postId);
        }
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết ID: " + postId));
        if (post.getStatus() == PostStatus.HIDDEN) {
            throw new ResourceNotFoundException("Không tìm thấy bài viết ID: " + postId);
        }
        return mapToSummaryDto(post, currentUserId);
    }

    public PostSummaryDto createPost(CreatePostRequest request, LearningUserPrincipal principal, String fullName, String avatar) {
        if (principal == null || principal.userId() == null) {
            throw new BadRequestException("Vui lòng đăng nhập để tạo bài viết");
        }

        String role = principal.activeRole() == null ? "" : principal.activeRole().trim().toUpperCase(Locale.ROOT);

        Subject validatedSubject = null;
        ClassRoom linkedClass = null;

        // Siết phân quyền loại bài đăng
        if (isTutorPost(request.getPostType())) {
            if (!"TUTOR".equals(role)) {
                throw new ForbiddenException("Chỉ gia sư mới được phép đăng bài phía gia sư");
            }
            if (request.getPostType() == PostType.TUTOR_CLASS_SHARE) {
                linkedClass = resolveShareableClass(request.getLinkedClassId(), principal.email());
                validatedSubject = resolveSubjectForClass(linkedClass, request.getSubjectId());
            } else if (request.getPostType() == PostType.TUTOR_POLL) {
                validatedSubject = resolveApprovedTutorSubject(request, principal.email());
                if (request.getPoll() == null) {
                    throw new BadRequestException("Bài khảo sát cần thông tin số buổi học mỗi tuần");
                }
                applyStandardPollOptions(request.getPoll());
                validatePoll(request.getPoll());
            } else if (request.getPostType() == PostType.TUTOR_ANNOUNCEMENT) {
                if (request.getPoll() != null) {
                    throw new BadRequestException("Bài thông báo chia sẻ không được đính kèm poll khảo sát");
                }
                if (request.getSubjectId() != null) {
                    validatedSubject = subjectRepository.findById(request.getSubjectId())
                            .filter(Subject::isActive)
                            .orElseThrow(() -> new BadRequestException("Môn học không tồn tại hoặc đã ngừng hoạt động"));
                }
            }
        } else if (request.getPostType() == PostType.STUDENT_FIND_TUTOR || request.getPostType() == PostType.STUDENT_GROUP_STUDY) {
            if (!"STUDENT".equals(role)) {
                throw new ForbiddenException("Chỉ học viên mới được đăng bài tìm gia sư hoặc tìm nhóm học");
            }
        } else {
            throw new BadRequestException("Loại bài đăng không được hỗ trợ");
        }

        if ("STUDENT".equals(role) && request.getLinkedClassId() != null) {
            throw new BadRequestException("Bài đăng học viên không được gắn lớp học");
        }

        if (!isTutorPost(request.getPostType()) && request.getPoll() != null) {
            throw new BadRequestException("Bài đăng này không hỗ trợ poll khảo sát");
        }

        if (validatedSubject == null && request.getSubjectId() != null) {
            validatedSubject = subjectRepository.findById(request.getSubjectId())
                    .filter(Subject::isActive)
                    .orElseThrow(() -> new BadRequestException("Môn học không tồn tại hoặc đã ngừng hoạt động"));
        }

        if (request.getPostType() != PostType.TUTOR_CLASS_SHARE && request.getLinkedClassId() != null) {
            throw new BadRequestException("Chỉ bài giới thiệu lớp học mới được gắn lớp có sẵn");
        }

        if (request.getPostType() == PostType.TUTOR_CLASS_SHARE) {
            request.setLearningMode(linkedClass.getLearningMode());
            request.setTargetPricePerSession(linkedClass.getPricePerSession());
            request.setEducationLevel(linkedClass.getLevel() != null ? linkedClass.getLevel().getName() : request.getEducationLevel());
            request.setAddress(linkedClass.getAddress());
        }

        CommunityPost post = new CommunityPost();
        post.setAuthorId(principal.userId());
        post.setAuthorRole(role);
        post.setAuthorName(fullName != null && !fullName.isBlank() ? fullName : principal.email());
        post.setAuthorAvatar(avatar);
        post.setPostType(request.getPostType());

        post.setTitle(request.getTitle().trim());
        post.setContent(request.getContent().trim());
        post.setEducationLevel(request.getEducationLevel());
        post.setLearningMode(request.getLearningMode() != null ? request.getLearningMode() : LearningMode.ONLINE);
        post.setTargetPricePerSession(request.getTargetPricePerSession());
        post.setAddress(request.getAddress());
        post.setStatus(PostStatus.OPEN);
        post.setLikeCount(0);
        post.setCommentCount(0);
        post.setViewCount(0);

        if (validatedSubject != null) {
            post.setSubject(validatedSubject);
        }
        if (linkedClass != null) {
            post.setLinkedClass(linkedClass);
        }

        CommunityPost savedPost = postRepository.save(post);

        // Khởi tạo Poll nếu có
        if (request.getPostType() == PostType.TUTOR_POLL && request.getPoll() != null) {
            CreatePollRequest pollReq = request.getPoll();
            PostPoll poll = new PostPoll();
            poll.setPost(savedPost);
            poll.setQuestion(pollReq.getQuestion().trim());
            poll.setMinVotesTarget(pollReq.getMinVotesTarget() != null && pollReq.getMinVotesTarget() > 0 ? pollReq.getMinVotesTarget() : 10);
            int sessionsPerWeek = pollReq.getSessionsPerWeek() != null && pollReq.getSessionsPerWeek() > 0 ? pollReq.getSessionsPerWeek() : 2;
            poll.setSessionsPerWeek(sessionsPerWeek);
            poll.setDurationMinutes(pollReq.getDurationMinutes() != null && pollReq.getDurationMinutes() > 0 ? pollReq.getDurationMinutes() : 90);
            poll.setMaxVotesPerUser(pollReq.getMaxVotesPerUser() != null && pollReq.getMaxVotesPerUser() > 0 ? pollReq.getMaxVotesPerUser() : sessionsPerWeek);
            poll.setExpiresAt(pollReq.getExpiresAt());
            poll.setIsClosed(false);
            poll.setTotalVotes(0);

            PostPoll savedPoll = pollRepository.save(poll);

            if (pollReq.getOptions() != null && !pollReq.getOptions().isEmpty()) {
                List<PostPollOption> options = new ArrayList<>();
                for (CreatePollOptionRequest optReq : pollReq.getOptions()) {
                    PostPollOption opt = new PostPollOption();
                    opt.setPoll(savedPoll);
                    opt.setDayOfWeek(optReq.getDayOfWeek());
                    opt.setStartTime(optReq.getStartTime());
                    opt.setEndTime(optReq.getEndTime());
                    opt.setTimePeriod(PollTimePeriod.fromStartTime(optReq.getStartTime()));
                    String label = optReq.getOptionLabel();
                    if (label == null || label.isBlank()) {
                        String dayLabel = optReq.getDayOfWeek() == 7 ? "CN" : "Thứ " + (optReq.getDayOfWeek() + 1);
                        label = String.format("%s (%s - %s)", dayLabel, optReq.getStartTime(), optReq.getEndTime());
                    }
                    opt.setOptionLabel(label.trim());
                    opt.setVoteCount(0);
                    options.add(opt);
                }
                pollOptionRepository.saveAll(options);
                savedPoll.setOptions(options);
            }
            savedPost.setPoll(savedPoll);
        }

        return mapToSummaryDto(savedPost, principal.userId());
    }

    public PostSummaryDto updatePost(Long postId, CreatePostRequest request, LearningUserPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new ForbiddenException("Vui lòng đăng nhập để chỉnh sửa bài viết");
        }
        CommunityPost post = postRepository.findByIdForUpdate(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        ensurePostVisible(post);

        if (!post.getAuthorId().equals(principal.userId())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa bài viết này");
        }
        if (request.getPostType() != null && request.getPostType() != post.getPostType()) {
            throw new BadRequestException("Không thể thay đổi loại bài đăng");
        }
        if (post.getStatus() != PostStatus.OPEN) {
            throw new ConflictException("Chỉ bài viết đang mở mới có thể chỉnh sửa");
        }

        Subject validatedSubject = null;
        ClassRoom linkedClass = null;
        if (isTutorPost(post.getPostType())) {
            if (post.getPostType() == PostType.TUTOR_CLASS_SHARE) {
                linkedClass = resolveShareableClass(request.getLinkedClassId(), principal.email());
                validatedSubject = resolveSubjectForClass(linkedClass, request.getSubjectId());
            } else if (post.getPostType() == PostType.TUTOR_POLL) {
                validatedSubject = resolveApprovedTutorSubject(request, principal.email());
            } else if (post.getPostType() == PostType.TUTOR_ANNOUNCEMENT) {
                if (request.getSubjectId() != null) {
                    validatedSubject = subjectRepository.findById(request.getSubjectId())
                            .filter(Subject::isActive)
                            .orElseThrow(() -> new BadRequestException("Môn học không tồn tại hoặc đã ngừng hoạt động"));
                }
            }
            if (post.getPostType() != PostType.TUTOR_POLL && request.getPoll() != null) {
                throw new BadRequestException("Chỉ bài khảo sát mở lớp mới được đính kèm poll");
            }
        }

        post.setTitle(request.getTitle().trim());
        post.setContent(request.getContent().trim());
        post.setEducationLevel(request.getEducationLevel());
        if (request.getLearningMode() != null) {
            post.setLearningMode(request.getLearningMode());
        }
        post.setTargetPricePerSession(request.getTargetPricePerSession());
        post.setAddress(request.getAddress());

        if (validatedSubject != null) {
            post.setSubject(validatedSubject);
        } else if (request.getSubjectId() != null) {
            Subject subject = subjectRepository.findById(request.getSubjectId())
                    .filter(Subject::isActive)
                    .orElseThrow(() -> new BadRequestException("Môn học không tồn tại hoặc đã ngừng hoạt động"));
            post.setSubject(subject);
        }
        if (linkedClass != null) {
            post.setLinkedClass(linkedClass);
            if (validatedSubject != null) {
                post.setSubject(validatedSubject);
            }
            post.setLearningMode(linkedClass.getLearningMode());
            post.setTargetPricePerSession(linkedClass.getPricePerSession());
            post.setEducationLevel(linkedClass.getLevel() != null ? linkedClass.getLevel().getName() : request.getEducationLevel());
            post.setAddress(linkedClass.getAddress());
        }

        if (post.getPostType() == PostType.TUTOR_POLL && post.getPoll() != null && request.getPoll() != null) {
            updatePoll(post.getPoll(), request.getPoll());
        }

        CommunityPost updated = postRepository.save(post);
        PostSummaryDto result = mapToSummaryDto(updated, principal.userId());
        publishPostUpdated(updated);
        return result;
    }

    public PostSummaryDto closePost(Long postId, LearningUserPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new ForbiddenException("Vui lòng đăng nhập để đóng bài đăng");
        }
        CommunityPost post = postRepository.findByIdForUpdate(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        ensurePostVisible(post);
        if (!Objects.equals(post.getAuthorId(), principal.userId())) {
            throw new ForbiddenException("Bạn không có quyền đóng bài đăng này");
        }
        if (post.getStatus() != PostStatus.OPEN) {
            throw new ConflictException("Chỉ bài đăng đang mở mới có thể đóng");
        }

        post.setStatus(PostStatus.CLOSED);
        if (post.getPoll() != null) {
            post.getPoll().setIsClosed(true);
            pollRepository.save(post.getPoll());
        }
        CommunityPost saved = postRepository.save(post);
        PostSummaryDto result = mapToSummaryDto(saved, principal.userId());
        publishPostUpdated(saved);
        return result;
    }

    public void deletePost(Long postId, LearningUserPrincipal principal, boolean isAdmin) {
        CommunityPost post = postRepository.findByIdForUpdate(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));

        if (!isAdmin && (principal == null || !post.getAuthorId().equals(principal.userId()))) {
            throw new ForbiddenException("Bạn không có quyền xóa bài viết này");
        }

        // Soft-delete an toàn: chuyển status thành HIDDEN để không mất dữ liệu liên kết
        // Keep related history, but make an attached poll immutable as soon as the post is hidden.
        if (post.getPoll() != null && !Boolean.TRUE.equals(post.getPoll().getIsClosed())) {
            post.getPoll().setIsClosed(true);
            pollRepository.save(post.getPoll());
        }

        post.setStatus(PostStatus.HIDDEN);
        postRepository.save(post);
        realtimeEventHub.publishToAll("COMMUNITY_POST_DELETED", post.getId(), Map.of(
                "postId", post.getId(),
                "authorId", post.getAuthorId()
        ));
    }

    public PollSummaryDto updatePollVotes(
            Long pollId,
            List<Long> requestedOptionIds,
            LearningUserPrincipal principal,
            String fullName
    ) {
        requireStudentPollParticipant(principal);

        PostPoll poll = pollRepository.findByIdForUpdate(pollId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy cuộc khảo sát"));
        ensurePollAcceptsVotes(poll);

        List<Long> requestedIds = requestedOptionIds == null ? List.of() : requestedOptionIds;
        LinkedHashSet<Long> selectedIds = new LinkedHashSet<>(requestedIds);
        if (selectedIds.size() != requestedIds.size()) {
            throw new BadRequestException("Danh sách khung giờ không được trùng lặp");
        }

        int maxAllowed = poll.getMaxVotesPerUser() != null
                ? poll.getMaxVotesPerUser()
                : (poll.getSessionsPerWeek() != null ? poll.getSessionsPerWeek() : 2);
        if (selectedIds.size() > maxAllowed) {
            throw new BadRequestException("Bạn chỉ có thể chọn tối đa " + maxAllowed + " khung giờ cho khảo sát này");
        }

        Map<Long, PostPollOption> selectedOptions = pollOptionRepository.findAllById(new ArrayList<>(selectedIds)).stream()
                .collect(Collectors.toMap(PostPollOption::getId, option -> option));
        if (selectedOptions.size() != selectedIds.size()
                || selectedOptions.values().stream().anyMatch(option -> !Objects.equals(option.getPoll().getId(), pollId))) {
            throw new BadRequestException("Có khung giờ không thuộc khảo sát này");
        }

        List<PostPollVote> currentVotes = pollVoteRepository.findByPollIdAndUserId(pollId, principal.userId());
        Map<Long, PostPollVote> currentByOptionId = currentVotes.stream()
                .collect(Collectors.toMap(vote -> vote.getOption().getId(), vote -> vote));
        if (currentByOptionId.keySet().equals(selectedIds)) {
            return mapToPollSummaryDto(poll, principal.userId());
        }
        List<PostPollVote> removedVotes = currentVotes.stream()
                .filter(vote -> !selectedIds.contains(vote.getOption().getId()))
                .toList();
        List<PostPollOption> changedOptions = new ArrayList<>();

        for (PostPollVote vote : removedVotes) {
            PostPollOption option = vote.getOption();
            option.setVoteCount(Math.max(0, option.getVoteCount() - 1));
            changedOptions.add(option);
        }

        List<PostPollVote> addedVotes = new ArrayList<>();
        for (Long optionId : selectedIds) {
            if (currentByOptionId.containsKey(optionId)) continue;
            PostPollOption option = selectedOptions.get(optionId);
            option.setVoteCount(option.getVoteCount() + 1);
            changedOptions.add(option);

            PostPollVote vote = new PostPollVote();
            vote.setPoll(poll);
            vote.setOption(option);
            vote.setUserId(principal.userId());
            vote.setUserName(fullName != null && !fullName.isBlank() ? fullName : principal.email());
            addedVotes.add(vote);
        }

        if (!removedVotes.isEmpty()) pollVoteRepository.deleteAll(removedVotes);
        if (!addedVotes.isEmpty()) pollVoteRepository.saveAll(addedVotes);
        if (!changedOptions.isEmpty()) pollOptionRepository.saveAll(changedOptions);

        int totalVotes = poll.getTotalVotes() != null ? poll.getTotalVotes() : 0;
        poll.setTotalVotes(Math.max(0, totalVotes - removedVotes.size() + addedVotes.size()));
        pollRepository.save(poll);

        PollSummaryDto result = mapToPollSummaryDto(poll, principal.userId());
        publishPollUpdated(poll);
        return result;
    }

    public PollSummaryDto votePoll(Long pollId, Long optionId, LearningUserPrincipal principal, String fullName) {
        if (principal == null || principal.userId() == null) {
            throw new BadRequestException("Vui lòng đăng nhập để bình chọn");
        }

        String role = principal.activeRole() == null ? "" : principal.activeRole().trim().toUpperCase(Locale.ROOT);
        if (!"STUDENT".equals(role)) {
            throw new ForbiddenException("Chỉ học viên mới được tham gia bình chọn ca học");
        }

        PostPoll poll = pollRepository.findByIdForUpdate(pollId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy cuộc khảo sát"));

        if (Boolean.TRUE.equals(poll.getIsClosed()) || (poll.getExpiresAt() != null && poll.getExpiresAt().isBefore(LocalDateTime.now()))) {
            throw new BadRequestException("Cuộc khảo sát này đã kết thúc");
        }
        if (poll.getPost() == null || poll.getPost().getStatus() != PostStatus.OPEN) {
            throw new BadRequestException("Bài khảo sát không còn mở để bình chọn");
        }

        PostPollOption selectedOption = pollOptionRepository.findById(optionId)
                .orElseThrow(() -> new ResourceNotFoundException("Khung giờ bình chọn không hợp lệ"));

        if (!selectedOption.getPoll().getId().equals(pollId)) {
            throw new BadRequestException("Khung giờ không thuộc khảo sát này");
        }

        Optional<PostPollVote> existingVoteOpt = pollVoteRepository.findByPollIdAndOptionIdAndUserId(pollId, optionId, principal.userId());

        if (existingVoteOpt.isPresent()) {
            // UNVOTE: Đã vote option này -> Click lại để bỏ chọn
            PostPollVote existingVote = existingVoteOpt.get();
            pollVoteRepository.delete(existingVote);

            selectedOption.setVoteCount(Math.max(0, selectedOption.getVoteCount() - 1));
            pollOptionRepository.save(selectedOption);

            poll.setTotalVotes(Math.max(0, poll.getTotalVotes() - 1));
            pollRepository.save(poll);
        } else {
            // VOTE MỚI CHO OPTION NÀY: Kiểm tra giới hạn số lựa chọn tối đa
            List<PostPollVote> currentVotes = pollVoteRepository.findByPollIdAndUserId(pollId, principal.userId());
            int maxAllowed = poll.getMaxVotesPerUser() != null ? poll.getMaxVotesPerUser()
                    : (poll.getSessionsPerWeek() != null ? poll.getSessionsPerWeek() : 2);

            if (currentVotes.size() >= maxAllowed) {
                throw new BadRequestException("Bạn chỉ có thể chọn tối đa " + maxAllowed + " khung giờ cho khảo sát này");
            }

            selectedOption.setVoteCount(selectedOption.getVoteCount() + 1);
            pollOptionRepository.save(selectedOption);

            poll.setTotalVotes(poll.getTotalVotes() + 1);
            pollRepository.save(poll);

            PostPollVote newVote = new PostPollVote();
            newVote.setPoll(poll);
            newVote.setOption(selectedOption);
            newVote.setUserId(principal.userId());
            newVote.setUserName(fullName != null && !fullName.isBlank() ? fullName : principal.email());
            pollVoteRepository.save(newVote);
        }

        PollSummaryDto result = mapToPollSummaryDto(poll, principal.userId());
        publishPollUpdated(poll);
        return result;
    }

    public PollSummaryDto unvotePoll(Long pollId, LearningUserPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new BadRequestException("Vui lòng đăng nhập");
        }
        if (!"STUDENT".equalsIgnoreCase(principal.activeRole())) {
            throw new ForbiddenException("Chỉ học viên mới được thay đổi bình chọn ca học");
        }

        PostPoll poll = pollRepository.findByIdForUpdate(pollId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy cuộc khảo sát"));
        if (Boolean.TRUE.equals(poll.getIsClosed())
                || (poll.getExpiresAt() != null && !poll.getExpiresAt().isAfter(LocalDateTime.now()))
                || poll.getPost() == null
                || poll.getPost().getStatus() != PostStatus.OPEN) {
            throw new BadRequestException("Cuộc khảo sát này đã kết thúc");
        }

        List<PostPollVote> userVotes = pollVoteRepository.findByPollIdAndUserId(pollId, principal.userId());
        if (!userVotes.isEmpty()) {
            for (PostPollVote vote : userVotes) {
                PostPollOption option = vote.getOption();
                if (option != null) {
                    option.setVoteCount(Math.max(0, option.getVoteCount() - 1));
                    pollOptionRepository.save(option);
                }
            }
            poll.setTotalVotes(Math.max(0, poll.getTotalVotes() - userVotes.size()));
            pollRepository.save(poll);
            pollVoteRepository.deleteAll(userVotes);
        }

        PollSummaryDto result = mapToPollSummaryDto(poll, principal.userId());
        publishPollUpdated(poll);
        return result;
    }

    public boolean toggleLike(Long postId, LearningUserPrincipal principal, String fullName, String avatar) {
        if (principal == null || principal.userId() == null) {
            throw new BadRequestException("Vui lòng đăng nhập để thả tim");
        }
        String role = requireCommunityParticipant(principal, "thả tim bài viết");

        CommunityPost post = postRepository.findByIdForUpdate(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        ensurePostVisible(post);

        Optional<PostInteraction> likeOpt = interactionRepository.findByPostIdAndUserIdAndInteractionType(
                postId, principal.userId(), InteractionType.LIKE);

        if (likeOpt.isPresent()) {
            interactionRepository.delete(likeOpt.get());
            post.setLikeCount(Math.max(0, safeCount(post.getLikeCount()) - 1));
            postRepository.save(post);
            publishPostUpdated(post);
            return false;
        } else {
            PostInteraction like = new PostInteraction();
            like.setPost(post);
            like.setUserId(principal.userId());
            like.setUserRole(role);
            like.setUserName(resolveInteractionUserName(fullName, principal.email()));
            like.setUserAvatar(resolveInteractionAvatar(avatar));
            like.setInteractionType(InteractionType.LIKE);
            interactionRepository.save(like);

            post.setLikeCount(safeCount(post.getLikeCount()) + 1);
            postRepository.save(post);
            publishPostUpdated(post);
            return true;
        }
    }

    @Transactional(readOnly = true)
    public List<LikeUserDto> getPostLikes(Long postId) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        ensurePostVisible(post);
        return interactionRepository.findByPostIdAndInteractionTypeOrderByCreatedAtDesc(postId, InteractionType.LIKE)
                .stream()
                .map(i -> LikeUserDto.builder()
                        .id(i.getId())
                        .userId(i.getUserId())
                        .userRole(i.getUserRole())
                        .userName(i.getUserName())
                        .userAvatar(i.getUserAvatar())
                        .createdAt(i.getCreatedAt())
                        .build())
                .toList();
    }

    public boolean toggleBookmark(Long postId, LearningUserPrincipal principal) {
        String role = requireCommunityParticipant(principal, "lưu bài viết");
        if (principal == null || principal.userId() == null) {
            throw new BadRequestException("Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ lÆ°u bÃ i viáº¿t");
        }

        CommunityPost post = postRepository.findByIdForUpdate(postId)
                .orElseThrow(() -> new ResourceNotFoundException("KhÃ´ng tÃ¬m tháº¥y bÃ i viáº¿t"));
        ensurePostVisible(post);

        Optional<PostInteraction> bookmark = interactionRepository.findByPostIdAndUserIdAndInteractionType(
                postId, principal.userId(), InteractionType.BOOKMARK);
        if (bookmark.isPresent()) {
            interactionRepository.delete(bookmark.get());
            return false;
        }

        PostInteraction interaction = new PostInteraction();
        interaction.setPost(post);
        interaction.setUserId(principal.userId());
        interaction.setUserRole(role);
        interaction.setUserName(resolveInteractionUserName(null, principal.email()));
        interaction.setInteractionType(InteractionType.BOOKMARK);
        interactionRepository.save(interaction);
        return true;
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryDto> getBookmarkedPosts(Pageable pageable, LearningUserPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new ForbiddenException("Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ xem bÃ i viáº¿t Ä‘Ã£ lÆ°u");
        }
        return interactionRepository.findBookmarkedPosts(principal.userId(), pageable)
                .map(post -> mapToSummaryDto(post, principal.userId()));
    }

    @Transactional(readOnly = true)
    public Page<CommentDto> getComments(Long postId, Pageable pageable) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        ensurePostVisible(post);
        Page<PostInteraction> comments = interactionRepository.findByPostIdAndInteractionTypeOrderByCreatedAtAsc(
                postId, InteractionType.COMMENT, pageable);
        return comments.map(c -> CommentDto.builder()
                .id(c.getId())
                .userId(c.getUserId())
                .userRole(c.getUserRole())
                .userName(c.getUserName())
                .userAvatar(c.getUserAvatar())
                .commentText(c.getCommentText())
                .createdAt(c.getCreatedAt())
                .build());
    }

    public CommentDto addComment(
            Long postId,
            String commentText,
            LearningUserPrincipal principal,
            String fullName,
            String avatar,
            Long replyToUserId,
            String replyToUserRole,
            String replyToUserName
    ) {
        if (principal == null || principal.userId() == null) {
            throw new BadRequestException("Vui lòng đăng nhập để bình luận");
        }
        String role = requireCommunityParticipant(principal, "bình luận");
        if (commentText == null || commentText.trim().isEmpty()) {
            throw new BadRequestException("Nội dung bình luận không được để trống");
        }

        CommunityPost post = postRepository.findByIdForUpdate(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        ensurePostVisible(post);

        PostInteraction comment = new PostInteraction();
        comment.setPost(post);
        comment.setUserId(principal.userId());
        comment.setUserRole(role);
        comment.setUserName(resolveInteractionUserName(fullName, principal.email()));
        comment.setUserAvatar(resolveInteractionAvatar(avatar));
        comment.setInteractionType(InteractionType.COMMENT);
        comment.setCommentText(commentText.trim());
        PostInteraction saved = interactionRepository.save(comment);

        post.setCommentCount(safeCount(post.getCommentCount()) + 1);
        postRepository.save(post);
        publishPostUpdated(post);
        publishCommentNotifications(post, saved, principal.userId(), replyToUserId, replyToUserRole);

        return CommentDto.builder()
                .id(saved.getId())
                .userId(saved.getUserId())
                .userRole(saved.getUserRole())
                .userName(saved.getUserName())
                .userAvatar(saved.getUserAvatar())
                .commentText(saved.getCommentText())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    private void publishCommentNotifications(
            CommunityPost post,
            PostInteraction comment,
            Long actorUserId,
            Long replyToUserId,
            String replyToUserRole
    ) {
        if (post == null || comment == null || actorUserId == null) {
            return;
        }
        if (replyToUserId != null && !Objects.equals(replyToUserId, actorUserId)) {
            publishCommunityInteractionNotification(
                    "COMMUNITY_POST_REPLIED",
                    post,
                    comment,
                    actorUserId,
                    replyToUserId,
                    resolveTargetRole(replyToUserRole, post.getAuthorRole()));
        }
        if (post.getAuthorId() != null
                && !Objects.equals(post.getAuthorId(), actorUserId)
                && !Objects.equals(post.getAuthorId(), replyToUserId)) {
            publishCommunityInteractionNotification(
                    "COMMUNITY_POST_COMMENTED",
                    post,
                    comment,
                    actorUserId,
                    post.getAuthorId(),
                    resolveTargetRole(post.getAuthorRole(), null));
        }
    }

    private void publishCommunityInteractionNotification(
            String eventType,
            CommunityPost post,
            PostInteraction comment,
            Long actorUserId,
            Long recipientUserId,
            String targetRole
    ) {
        eventPublisher.publishCommunityPostInteraction(
                eventType,
                post.getId(),
                comment.getId(),
                recipientUserId,
                actorUserId,
                comment.getUserName(),
                post.getTitle(),
                comment.getCommentText(),
                targetRole);
    }

    private String resolveTargetRole(String role, String fallbackRole) {
        String normalized = role == null ? "" : role.trim().toUpperCase(Locale.ROOT);
        if (!"STUDENT".equals(normalized) && !"TUTOR".equals(normalized)) {
            normalized = fallbackRole == null ? "" : fallbackRole.trim().toUpperCase(Locale.ROOT);
        }
        return "TUTOR".equals(normalized) ? "TUTOR" : "STUDENT";
    }

    private int safeCount(Integer count) {
        return count != null && count > 0 ? count : 0;
    }

    private String resolveInteractionUserName(String displayName, String fallbackEmail) {
        String value = normalizeOptional(displayName);
        if (value == null) {
            value = normalizeOptional(fallbackEmail);
        }
        if (value == null) {
            value = "Người dùng";
        }
        return truncate(value, 100);
    }

    private String resolveInteractionAvatar(String avatar) {
        String value = normalizeOptional(avatar);
        return value != null && value.length() <= 255 ? value : null;
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    /**
     * Chuyển đổi bài viết khảo sát (TUTOR_POLL) thành lớp học thực tế (ClassRoom)
     * và thông báo cho toàn bộ học viên đã vote.
     */
    @Transactional(readOnly = true)
    public ClassSuggestionResponse getClassSuggestion(Long postId, LearningUserPrincipal principal) {
        if (principal == null || !"TUTOR".equalsIgnoreCase(principal.activeRole())) {
            throw new ForbiddenException("Chỉ gia sư mới có quyền xem lịch lớp được đề xuất");
        }
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết: " + postId));
        if (!Objects.equals(post.getAuthorId(), principal.userId())) {
            throw new ForbiddenException("Bạn không phải là tác giả của bài khảo sát này");
        }
        if (post.getPostType() != PostType.TUTOR_POLL || post.getPoll() == null) {
            throw new BadRequestException("Bài viết không phải khảo sát mở lớp");
        }
        if (post.getLinkedClass() != null || post.getStatus() == PostStatus.CONVERTED) {
            throw new ConflictException("Bài khảo sát đã được chuyển thành lớp học");
        }

        PostPoll poll = post.getPoll();
        int sessionsPerWeek = poll.getSessionsPerWeek() != null ? poll.getSessionsPerWeek() : 2;
        int durationMinutes = poll.getDurationMinutes() != null ? poll.getDurationMinutes() : 90;
        List<TutorAvailability> availability = availabilityRepository
                .findByTutorEmailIgnoreCaseOrderByDayOfWeekAscStartTimeAsc(principal.email());
        List<ClassRoom> occupiedClasses = classRoomRepository.findByTutorEmailWithDetails(principal.email()).stream()
                .filter(item -> item.getTerminationCutoffSession() == null)
                .filter(item -> blocksTutorSchedule(item.getStatus()))
                .toList();

        List<PostPollOption> rankedOptions = pollOptionRepository
                .findByPollIdOrderByDayOfWeekAscStartTimeAsc(poll.getId()).stream()
                .sorted(Comparator
                        .comparing((PostPollOption option) -> option.getVoteCount() == null ? 0 : option.getVoteCount())
                        .reversed()
                        .thenComparing(PostPollOption::getDayOfWeek)
                        .thenComparing(option -> resolvePeriod(option).ordinal()))
                .toList();

        Map<Long, Set<Long>> selectionsByStudent = pollVoteRepository.findByPollId(poll.getId()).stream()
                .filter(vote -> vote.getUserId() != null && vote.getOption() != null)
                .collect(Collectors.groupingBy(
                        PostPollVote::getUserId,
                        Collectors.mapping(vote -> vote.getOption().getId(), Collectors.toSet())
                ));
        SuggestionPlan suggestionPlan = findBestSuggestionPlan(
                rankedOptions, availability, occupiedClasses, durationMinutes,
                sessionsPerWeek, selectionsByStudent.values());
        List<ClassRoomDtos.ScheduleRequest> recommendations = suggestionPlan.schedules();

        int totalVotes = poll.getTotalVotes() != null ? poll.getTotalVotes() : 0;
        List<PollDemandDto> rankedDemand = rankedOptions.stream().map(option -> {
            int voteCount = option.getVoteCount() != null ? option.getVoteCount() : 0;
            double percentage = totalVotes == 0 ? 0.0
                    : Math.round((double) voteCount * 1000.0 / totalVotes) / 10.0;
            boolean feasible = findSuggestedSlot(option, availability, occupiedClasses,
                    durationMinutes, List.of()).isPresent();
            return PollDemandDto.builder()
                    .optionId(option.getId())
                    .dayOfWeek(option.getDayOfWeek())
                    .timePeriod(resolvePeriod(option))
                    .optionLabel(option.getOptionLabel())
                    .voteCount(voteCount)
                    .votePercentage(percentage)
                    .feasible(feasible)
                    .build();
        }).toList();

        List<String> warnings = new ArrayList<>();
        if (availability.isEmpty()) {
            warnings.add("Gia sư chưa thiết lập lịch rảnh nên hệ thống chưa thể tạo lịch đề xuất.");
        } else if (recommendations.size() < sessionsPerWeek) {
            warnings.add("Không tìm đủ " + sessionsPerWeek
                    + " buổi phù hợp giữa kết quả bình chọn và lịch rảnh hiện tại. Gia sư cần tự điều chỉnh trước khi tạo lớp.");
        } else if (!selectionsByStudent.isEmpty() && suggestionPlan.matchingStudentCount() == 0) {
            warnings.add("Các ca đề xuất có nhu cầu riêng lẻ nhưng chưa có học viên nào chọn đủ toàn bộ lịch. Gia sư nên xem lại trước khi tạo lớp.");
        }

        int participantCount = selectionsByStudent.size();
        int minimumCapacity = poll.getMinVotesTarget() != null ? poll.getMinVotesTarget() : 10;
        int suggestedMaxStudents = Math.min(100, Math.max(1,
                Math.max(minimumCapacity, suggestionPlan.matchingStudentCount())));

        return ClassSuggestionResponse.builder()
                .postId(postId)
                .sessionsPerWeek(sessionsPerWeek)
                .durationMinutes(durationMinutes)
                .recommendedSchedules(recommendations)
                .rankedDemand(rankedDemand)
                .participantCount(participantCount)
                .matchingStudentCount(suggestionPlan.matchingStudentCount())
                .suggestedMaxStudents(suggestedMaxStudents)
                .warnings(warnings)
                .build();
    }

    public ClassCreatedFromPostResponse convertPostToClass(Long postId, ConvertPostToClassRequest request, LearningUserPrincipal principal, String fullName) {
        if (principal == null || !"TUTOR".equalsIgnoreCase(principal.activeRole())) {
            throw new ForbiddenException("Chỉ gia sư mới có quyền chuyển đổi bài khảo sát thành lớp học");
        }

        CommunityPost post = postRepository.findByIdForUpdate(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết: " + postId));

        if (!post.getAuthorId().equals(principal.userId())) {
            throw new ForbiddenException("Bạn không phải là tác giả của bài viết này");
        }

        if (post.getPostType() != PostType.TUTOR_POLL) {
            throw new BadRequestException("Chỉ bài đăng khảo sát của gia sư mới có thể chuyển đổi thành lớp học");
        }

        if (post.getLinkedClass() != null || post.getStatus() == PostStatus.CONVERTED) {
            throw new ConflictException("Bài viết này đã được chuyển đổi thành lớp học rồi");
        }
        if (post.getStatus() != PostStatus.OPEN && post.getStatus() != PostStatus.CLOSED) {
            throw new ConflictException("Bài khảo sát này không thể chuyển thành lớp học");
        }

        PostPoll poll = post.getPoll();
        if (poll == null) {
            throw new BadRequestException("Bài viết này không có biểu mẫu khảo sát");
        }
        if (request.getClassRequest() != null) {
            return convertUsingFullClassRequest(post, poll, request.getClassRequest(), principal);
        }
        int sessionsPerWeek = request.getSessionsPerWeek() != null && request.getSessionsPerWeek() > 0
                ? request.getSessionsPerWeek()
                : (poll.getSessionsPerWeek() != null ? poll.getSessionsPerWeek() : 1);
        if (sessionsPerWeek < 1 || sessionsPerWeek > 7) {
            throw new BadRequestException("Lớp học cần từ 1 đến 7 buổi mỗi tuần");
        }

        List<ClassRoomDtos.ScheduleRequest> schedulesToCreate = new ArrayList<>();
        int durationMinutes = poll.getDurationMinutes() != null ? poll.getDurationMinutes() : 90;

        if (request.getCustomSchedules() != null && !request.getCustomSchedules().isEmpty()) {
            if (request.getCustomSchedules().size() != sessionsPerWeek) {
                throw new BadRequestException("Vui lòng thiết lập đúng " + sessionsPerWeek + " buổi học mỗi tuần");
            }
            durationMinutes = -1;
            for (ClassRoomDtos.ScheduleRequest sch : request.getCustomSchedules()) {
                if (sch == null || sch.dayOfWeek() == null || sch.dayOfWeek() < 2 || sch.dayOfWeek() > 8) {
                    throw new BadRequestException("Thứ trong tuần của ca học không hợp lệ");
                }
                LocalTime st;
                LocalTime et;
                try {
                    st = LocalTime.parse(sch.startTime());
                    et = LocalTime.parse(sch.endTime());
                } catch (RuntimeException ex) {
                    throw new BadRequestException("Giờ học phải có định dạng HH:mm");
                }
                if (st.getSecond() != 0 || et.getSecond() != 0) {
                    throw new BadRequestException("Giờ học phải có định dạng HH:mm");
                }
                int slotMinutes = (int) java.time.Duration.between(st, et).toMinutes();
                if (slotMinutes < 30 || slotMinutes > 300) {
                    throw new BadRequestException("Khung giờ lớp học phải kéo dài từ 30 đến 300 phút");
                }
                if (durationMinutes != -1 && slotMinutes != durationMinutes) {
                    throw new BadRequestException("Các ca học được chọn phải có cùng thời lượng");
                }
                durationMinutes = slotMinutes;
                schedulesToCreate.add(new ClassRoomDtos.ScheduleRequest(
                        sch.dayOfWeek(), st.toString(), et.toString()));
            }
        } else {
            List<Long> selectedIds = request.getSelectedOptionIds() != null && !request.getSelectedOptionIds().isEmpty()
                    ? request.getSelectedOptionIds()
                    : request.getSelectedOptionId() != null ? List.of(request.getSelectedOptionId()) : List.of();
            if (selectedIds.size() != sessionsPerWeek || new HashSet<>(selectedIds).size() != selectedIds.size()) {
                throw new BadRequestException("Vui lòng chọn đúng " + sessionsPerWeek + " ca học khác nhau mỗi tuần");
            }
            List<PostPollOption> selectedOptions = new ArrayList<>();
            for (Long optionId : selectedIds) {
                PostPollOption option = pollOptionRepository.findById(optionId)
                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khung giờ khảo sát đã chọn"));
                if (!option.getPoll().getId().equals(poll.getId())) {
                    throw new BadRequestException("Khung giờ được chọn không thuộc khảo sát của bài viết này");
                }
                selectedOptions.add(option);
            }
            durationMinutes = (int) java.time.Duration.between(
                    selectedOptions.getFirst().getStartTime(), selectedOptions.getFirst().getEndTime()).toMinutes();
            if (durationMinutes < 30 || durationMinutes > 300) {
                throw new BadRequestException("Khung giờ lớp học phải kéo dài từ 30 đến 300 phút");
            }
            for (PostPollOption option : selectedOptions) {
                if (java.time.Duration.between(option.getStartTime(), option.getEndTime()).toMinutes() != durationMinutes) {
                    throw new BadRequestException("Các ca học được chọn phải có cùng thời lượng");
                }
                schedulesToCreate.add(new ClassRoomDtos.ScheduleRequest(
                        option.getDayOfWeek() + 1,
                        option.getStartTime().toString().substring(0, 5),
                        option.getEndTime().toString().substring(0, 5)
                ));
            }
        }

        List<TutorSubjectRegistration> registrations = registrationRepository.findByTutorEmailIgnoreCaseOrderByCreatedAtDesc(principal.email());
        TutorSubjectRegistration registration = resolveApprovedRegistration(post, request, registrations);
        CatalogLevel level = resolveApprovedLevel(request, registration);

        int maxStudents = request.getMaxStudents() != null && request.getMaxStudents() > 0 
                ? request.getMaxStudents() 
                : (request.getMaxCapacity() != null && request.getMaxCapacity() > 0 ? request.getMaxCapacity() : 20);

        int durationValue = request.getDurationValue() != null && request.getDurationValue() > 0 ? request.getDurationValue() : 4;
        DurationUnit durationUnit = request.getDurationUnit() != null ? request.getDurationUnit() : DurationUnit.MONTH;
        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now().plusWeeks(1);
        if (startDate.isBefore(LocalDate.now())) {
            throw new BadRequestException("Ngày khai giảng không được ở trong quá khứ");
        }
        int totalSessions = durationUnit == DurationUnit.WEEK
                ? durationValue * sessionsPerWeek
                : durationValue * sessionsPerWeek * 4;

        BigDecimal pricePerSession = request.getPricePerSession() != null 
                ? request.getPricePerSession() 
                : (post.getTargetPricePerSession() != null ? post.getTargetPricePerSession() : registration.getTuitionMin());

        String className = request.getName() != null && !request.getName().isBlank()
                ? request.getName().trim()
                : post.getTitle();
        String classDescription = request.getDescription() != null && !request.getDescription().isBlank()
                ? request.getDescription().trim()
                : post.getContent();

        ClassRoomDtos.CreateClassRoomRequest classRequest = new ClassRoomDtos.CreateClassRoomRequest(
                registration.getId(),
                level.getId(),
                registration.getTutorProfileId(),
                fullName != null && !fullName.isBlank() ? fullName.trim() : post.getAuthorName(),
                className,
                classDescription,
                post.getLearningMode() != null ? post.getLearningMode() : LearningMode.ONLINE,
                normalizeOptional(request.getMeetingLink()),
                normalizeOptional(request.getAddress() != null ? request.getAddress() : post.getAddress()),
                maxStudents,
                null,
                150,
                pricePerSession,
                sessionsPerWeek,
                durationMinutes,
                durationValue,
                durationUnit,
                startDate,
                schedulesToCreate,
                SyllabusMode.FORM,
                null,
                List.of(new ClassRoomDtos.ChapterRequest(
                        "Lộ trình " + className,
                        "Lộ trình khởi tạo từ khảo sát cộng đồng; gia sư có thể cập nhật trước khi lớp được duyệt.",
                        totalSessions,
                        1))
        );

        ClassRoomDtos.ClassRoomResponse createdClass = classRoomService.createClass(principal.email(), classRequest);
        ClassRoom savedClass = classRoomRepository.findById(createdClass.id())
                .orElseThrow(() -> new IllegalStateException("Lớp vừa tạo không thể được tải lại"));

        // Cập nhật Post
        post.setLinkedClass(savedClass);
        post.setStatus(PostStatus.CONVERTED);
        poll.setIsClosed(true);
        pollRepository.save(poll);
        postRepository.save(post);
        publishPostUpdated(post);

        List<Long> recipientIds = pollVoteRepository.findByPollId(poll.getId()).stream()
                .map(PostPollVote::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        recipientIds.forEach(recipientId -> eventPublisher.publishCommunityPostConverted(
                post.getId(),
                savedClass.getId(),
                recipientId,
                principal.userId(),
                post.getTitle(),
                savedClass.getName(),
                post.getAuthorName()));

        return ClassCreatedFromPostResponse.builder()
                .postId(post.getId())
                .classId(savedClass.getId())
                .className(savedClass.getName())
                .status(savedClass.getStatus().name())
                .notifiedStudentsCount(recipientIds.size())
                .build();
    }

    private ClassCreatedFromPostResponse convertUsingFullClassRequest(
            CommunityPost post,
            PostPoll poll,
            ClassRoomDtos.CreateClassRoomRequest classRequest,
            LearningUserPrincipal principal
    ) {
        ConvertPostToClassRequest validationRequest = new ConvertPostToClassRequest();
        validationRequest.setTutorSubjectRegistrationId(classRequest.tutorSubjectRegistrationId());
        validationRequest.setLevelId(classRequest.levelId());
        List<TutorSubjectRegistration> registrations = registrationRepository
                .findByTutorEmailIgnoreCaseOrderByCreatedAtDesc(principal.email());
        TutorSubjectRegistration registration = resolveApprovedRegistration(post, validationRequest, registrations);
        CatalogLevel level = resolveApprovedLevel(validationRequest, registration);
        if (!Objects.equals(registration.getId(), classRequest.tutorSubjectRegistrationId())
                || !Objects.equals(level.getId(), classRequest.levelId())) {
            throw new BadRequestException("Môn học hoặc cấp độ của lớp không phù hợp với bài khảo sát");
        }

        ClassRoomDtos.ClassRoomResponse createdClass = classRoomService.createClass(principal.email(), classRequest);
        ClassRoom savedClass = classRoomRepository.findById(createdClass.id())
                .orElseThrow(() -> new IllegalStateException("Lớp vừa tạo không thể được tải lại"));

        post.setLinkedClass(savedClass);
        post.setStatus(PostStatus.CONVERTED);
        poll.setIsClosed(true);
        pollRepository.save(poll);
        postRepository.save(post);
        publishPostUpdated(post);

        List<Long> recipientIds = pollVoteRepository.findByPollId(poll.getId()).stream()
                .map(PostPollVote::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        recipientIds.forEach(recipientId -> eventPublisher.publishCommunityPostConverted(
                post.getId(), savedClass.getId(), recipientId, principal.userId(),
                post.getTitle(), savedClass.getName(), post.getAuthorName()));

        return ClassCreatedFromPostResponse.builder()
                .postId(post.getId())
                .classId(savedClass.getId())
                .className(savedClass.getName())
                .status(savedClass.getStatus().name())
                .notifiedStudentsCount(recipientIds.size())
                .build();
    }

    private SuggestionPlan findBestSuggestionPlan(
            List<PostPollOption> rankedOptions,
            List<TutorAvailability> availability,
            List<ClassRoom> occupiedClasses,
            int durationMinutes,
            int targetCount,
            Collection<Set<Long>> selectionsByStudent
    ) {
        if (targetCount <= 0) return SuggestionPlan.empty();

        SuggestionPlan best = searchSuggestionPlans(
                rankedOptions, availability, occupiedClasses, durationMinutes,
                targetCount, true, selectionsByStudent);
        if (best == null) {
            best = searchSuggestionPlans(
                    rankedOptions, availability, occupiedClasses, durationMinutes,
                    targetCount, false, selectionsByStudent);
        }
        if (best != null) return best;

        List<ClassRoomDtos.ScheduleRequest> partialSchedules = new ArrayList<>();
        List<PostPollOption> partialOptions = new ArrayList<>();
        for (PostPollOption option : rankedOptions) {
            if (partialSchedules.size() >= targetCount) break;
            if (option.getVoteCount() == null || option.getVoteCount() <= 0) continue;
            Optional<ClassRoomDtos.ScheduleRequest> slot = findSuggestedSlot(
                    option, availability, occupiedClasses, durationMinutes, partialSchedules);
            if (slot.isEmpty()) continue;
            partialSchedules.add(slot.get());
            partialOptions.add(option);
        }
        return scoreSuggestionPlan(partialOptions, partialSchedules, selectionsByStudent);
    }

    private SuggestionPlan searchSuggestionPlans(
            List<PostPollOption> rankedOptions,
            List<TutorAvailability> availability,
            List<ClassRoom> occupiedClasses,
            int durationMinutes,
            int targetCount,
            boolean requireDistinctDay,
            Collection<Set<Long>> selectionsByStudent
    ) {
        SuggestionPlan[] best = new SuggestionPlan[1];
        searchSuggestionPlans(
                rankedOptions, availability, occupiedClasses, durationMinutes,
                targetCount, requireDistinctDay, selectionsByStudent, 0,
                new ArrayList<>(), new ArrayList<>(), new HashSet<>(), best);
        return best[0];
    }

    private void searchSuggestionPlans(
            List<PostPollOption> rankedOptions,
            List<TutorAvailability> availability,
            List<ClassRoom> occupiedClasses,
            int durationMinutes,
            int targetCount,
            boolean requireDistinctDay,
            Collection<Set<Long>> selectionsByStudent,
            int startIndex,
            List<PostPollOption> selectedOptions,
            List<ClassRoomDtos.ScheduleRequest> selectedSchedules,
            Set<Integer> selectedDays,
            SuggestionPlan[] best
    ) {
        if (selectedOptions.size() == targetCount) {
            SuggestionPlan candidate = scoreSuggestionPlan(selectedOptions, selectedSchedules, selectionsByStudent);
            if (best[0] == null || candidate.isBetterThan(best[0])) best[0] = candidate;
            return;
        }
        int remainingNeeded = targetCount - selectedOptions.size();
        if (rankedOptions.size() - startIndex < remainingNeeded) return;

        for (int i = startIndex; i < rankedOptions.size(); i++) {
            PostPollOption option = rankedOptions.get(i);
            if (option.getVoteCount() == null || option.getVoteCount() <= 0) continue;
            int classDay = option.getDayOfWeek() + 1;
            if (requireDistinctDay && selectedDays.contains(classDay)) continue;

            Optional<ClassRoomDtos.ScheduleRequest> slot = findSuggestedSlot(
                    option, availability, occupiedClasses, durationMinutes, selectedSchedules);
            if (slot.isEmpty()) continue;

            selectedOptions.add(option);
            selectedSchedules.add(slot.get());
            boolean dayAdded = selectedDays.add(classDay);
            searchSuggestionPlans(
                    rankedOptions, availability, occupiedClasses, durationMinutes,
                    targetCount, requireDistinctDay, selectionsByStudent, i + 1,
                    selectedOptions, selectedSchedules, selectedDays, best);
            selectedOptions.removeLast();
            selectedSchedules.removeLast();
            if (dayAdded) selectedDays.remove(classDay);
        }
    }

    private SuggestionPlan scoreSuggestionPlan(
            List<PostPollOption> options,
            List<ClassRoomDtos.ScheduleRequest> schedules,
            Collection<Set<Long>> selectionsByStudent
    ) {
        Set<Long> optionIds = options.stream().map(PostPollOption::getId).collect(Collectors.toSet());
        int matchingStudents = (int) selectionsByStudent.stream()
                .filter(selection -> selection.containsAll(optionIds))
                .count();
        int coveredStudents = (int) selectionsByStudent.stream()
                .filter(selection -> selection.stream().anyMatch(optionIds::contains))
                .count();
        int totalDemand = options.stream()
                .map(PostPollOption::getVoteCount)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
        return new SuggestionPlan(
                List.copyOf(schedules), matchingStudents, coveredStudents, totalDemand);
    }

    private record SuggestionPlan(
            List<ClassRoomDtos.ScheduleRequest> schedules,
            int matchingStudentCount,
            int coveredStudentCount,
            int totalDemand
    ) {
        private static SuggestionPlan empty() {
            return new SuggestionPlan(List.of(), 0, 0, 0);
        }

        private boolean isBetterThan(SuggestionPlan other) {
            if (matchingStudentCount != other.matchingStudentCount) {
                return matchingStudentCount > other.matchingStudentCount;
            }
            if (totalDemand != other.totalDemand) return totalDemand > other.totalDemand;
            return coveredStudentCount > other.coveredStudentCount;
        }
    }

    private Optional<ClassRoomDtos.ScheduleRequest> findSuggestedSlot(
            PostPollOption option,
            List<TutorAvailability> availability,
            List<ClassRoom> occupiedClasses,
            int durationMinutes,
            List<ClassRoomDtos.ScheduleRequest> alreadySuggested
    ) {
        int classDay = option.getDayOfWeek() + 1;
        PollTimePeriod period = resolvePeriod(option);
        for (TutorAvailability freeSlot : availability) {
            if (!Objects.equals(freeSlot.getDayOfWeek(), classDay)) continue;
            LocalTime freeStart = LocalTime.parse(freeSlot.getStartTime());
            LocalTime freeEnd = LocalTime.parse(freeSlot.getEndTime());
            LocalTime candidateStart = freeStart.isAfter(period.getStart()) ? freeStart : period.getStart();
            int remainder = candidateStart.getMinute() % 15;
            if (remainder != 0) candidateStart = candidateStart.plusMinutes(15 - remainder).withSecond(0).withNano(0);
            LocalTime periodEnd = period.getEndExclusive();
            LocalTime candidateLimit = freeEnd.isBefore(periodEnd) ? freeEnd : periodEnd;

            while (!candidateStart.plusMinutes(durationMinutes).isAfter(candidateLimit)) {
                LocalTime candidateEnd = candidateStart.plusMinutes(durationMinutes);
                if (!overlapsOccupied(classDay, candidateStart, candidateEnd, occupiedClasses)
                        && !overlapsSuggested(classDay, candidateStart, candidateEnd, alreadySuggested)) {
                    return Optional.of(new ClassRoomDtos.ScheduleRequest(
                            classDay,
                            candidateStart.toString(),
                            candidateEnd.toString()
                    ));
                }
                candidateStart = candidateStart.plusMinutes(15);
            }
        }
        return Optional.empty();
    }

    private boolean overlapsOccupied(
            int dayOfWeek,
            LocalTime start,
            LocalTime end,
            List<ClassRoom> occupiedClasses
    ) {
        return occupiedClasses.stream()
                .flatMap(item -> item.getSchedules().stream())
                .filter(schedule -> Objects.equals(schedule.getDayOfWeek(), dayOfWeek))
                .anyMatch(schedule -> overlaps(
                        start, end,
                        LocalTime.parse(schedule.getStartTime()),
                        LocalTime.parse(schedule.getEndTime())));
    }

    private boolean overlapsSuggested(
            int dayOfWeek,
            LocalTime start,
            LocalTime end,
            List<ClassRoomDtos.ScheduleRequest> schedules
    ) {
        return schedules.stream()
                .filter(schedule -> Objects.equals(schedule.dayOfWeek(), dayOfWeek))
                .anyMatch(schedule -> overlaps(
                        start, end,
                        LocalTime.parse(schedule.startTime()),
                        LocalTime.parse(schedule.endTime())));
    }

    private boolean overlaps(LocalTime startA, LocalTime endA, LocalTime startB, LocalTime endB) {
        return startA.isBefore(endB) && endA.isAfter(startB);
    }

    private boolean blocksTutorSchedule(ClassRoomStatus status) {
        return status == ClassRoomStatus.ACTIVE
                || status == ClassRoomStatus.PENDING_APPROVAL
                || status == ClassRoomStatus.PRIVATE
                || status == ClassRoomStatus.PUBLISHED
                || status == ClassRoomStatus.LOCKED;
    }

    private PollTimePeriod resolvePeriod(PostPollOption option) {
        return option.getTimePeriod() != null
                ? option.getTimePeriod()
                : PollTimePeriod.fromStartTime(option.getStartTime());
    }

    private TutorSubjectRegistration resolveApprovedRegistration(
            CommunityPost post,
            ConvertPostToClassRequest request,
            List<TutorSubjectRegistration> registrations
    ) {
        String postSubjectName = post.getSubject() != null ? post.getSubject().getName().trim() : null;
        return registrations.stream()
                .filter(r -> request.getTutorSubjectRegistrationId() == null
                        || Objects.equals(r.getId(), request.getTutorSubjectRegistrationId()))
                .filter(r -> r.getStatus() == TutorSubjectRegistrationStatus.APPROVED)
                .filter(r -> {
                    if (postSubjectName == null) return true;
                    String regSubName = r.getSubject() != null ? r.getSubject().getName() : r.getProposedSubjectName();
                    return regSubName != null && (
                            regSubName.trim().equalsIgnoreCase(postSubjectName)
                            || normalizeText(regSubName).equals(normalizeText(postSubjectName))
                            || normalizeText(regSubName).contains(normalizeText(postSubjectName))
                            || normalizeText(postSubjectName).contains(normalizeText(regSubName))
                    );
                })
                .findFirst()
                .orElseThrow(() -> new BadRequestException(
                        "Không có hồ sơ giảng dạy đã duyệt phù hợp với môn " + (postSubjectName != null ? postSubjectName : "")));
    }

    private CatalogLevel resolveApprovedLevel(
            ConvertPostToClassRequest request,
            TutorSubjectRegistration registration
    ) {
        if (registration.getLevels() == null || registration.getLevels().isEmpty()) {
            throw new BadRequestException("Hồ sơ giảng dạy chưa có cấp độ được duyệt");
        }
        CatalogLevel level = request.getLevelId() == null
                ? registration.getLevels().stream().filter(CatalogLevel::isActive).findFirst().orElse(null)
                : levelRepository.findById(request.getLevelId()).orElse(null);
        boolean belongsToRegistration = level != null
                && level.isActive()
                && registration.getLevels().stream().anyMatch(item -> Objects.equals(item.getId(), level.getId()));
        if (!belongsToRegistration) {
            throw new BadRequestException("Cấp độ không thuộc hồ sơ giảng dạy đã duyệt");
        }
        return level;
    }

    private void updatePoll(PostPoll poll, CreatePollRequest request) {
        applyStandardPollOptions(request);
        validatePoll(request);
        List<PostPollOption> existingOptions = pollOptionRepository
                .findByPollIdOrderByDayOfWeekAscStartTimeAsc(poll.getId());
        boolean optionsChanged = pollOptionsChanged(existingOptions, request.getOptions());
        int totalVotes = poll.getTotalVotes() == null ? 0 : poll.getTotalVotes();
        if (totalVotes > 0 && optionsChanged) {
            throw new ConflictException("Không thể thay đổi ca học khi khảo sát đã có bình chọn");
        }
        int sessionsPerWeek = request.getSessionsPerWeek() != null ? request.getSessionsPerWeek() : 2;
        int durationMinutes = request.getDurationMinutes() != null ? request.getDurationMinutes() : 90;
        int maxVotesPerUser = request.getMaxVotesPerUser() != null ? request.getMaxVotesPerUser() : sessionsPerWeek;
        if (totalVotes > 0 && (!Objects.equals(poll.getSessionsPerWeek(), sessionsPerWeek)
                || !Objects.equals(poll.getDurationMinutes(), durationMinutes)
                || !Objects.equals(poll.getMaxVotesPerUser(), maxVotesPerUser))) {
            throw new ConflictException("Không thể đổi số buổi, thời lượng hoặc giới hạn chọn khi khảo sát đã có bình chọn");
        }

        poll.setQuestion(request.getQuestion().trim());
        poll.setMinVotesTarget(request.getMinVotesTarget() != null && request.getMinVotesTarget() > 0
                ? request.getMinVotesTarget()
                : 10);
        poll.setExpiresAt(request.getExpiresAt());
        poll.setSessionsPerWeek(sessionsPerWeek);
        poll.setDurationMinutes(durationMinutes);
        poll.setMaxVotesPerUser(maxVotesPerUser);

        if (totalVotes == 0 && optionsChanged) {
            poll.getOptions().clear();
            for (CreatePollOptionRequest optionRequest : request.getOptions()) {
                PostPollOption option = new PostPollOption();
                option.setPoll(poll);
                option.setDayOfWeek(optionRequest.getDayOfWeek());
                option.setStartTime(optionRequest.getStartTime());
                option.setEndTime(optionRequest.getEndTime());
                option.setTimePeriod(PollTimePeriod.fromStartTime(optionRequest.getStartTime()));
                String label = normalizeOptional(optionRequest.getOptionLabel());
                if (label == null) {
                    String dayLabel = optionRequest.getDayOfWeek() == 7
                            ? "Chủ nhật"
                            : "Thứ " + (optionRequest.getDayOfWeek() + 1);
                    label = String.format("%s (%s - %s)", dayLabel,
                            optionRequest.getStartTime(), optionRequest.getEndTime());
                }
                option.setOptionLabel(label);
                option.setVoteCount(0);
                poll.getOptions().add(option);
            }
        }
        pollRepository.save(poll);
    }

    private boolean pollOptionsChanged(
            List<PostPollOption> existingOptions,
            List<CreatePollOptionRequest> requestedOptions
    ) {
        if (requestedOptions == null || existingOptions.size() != requestedOptions.size()) {
            return true;
        }
        Comparator<String> comparator = Comparator.naturalOrder();
        List<String> existing = existingOptions.stream()
                .map(option -> pollOptionKey(option.getDayOfWeek(), option.getStartTime(), option.getEndTime(), option.getOptionLabel()))
                .sorted(comparator)
                .toList();
        List<String> requested = requestedOptions.stream()
                .map(option -> pollOptionKey(option.getDayOfWeek(), option.getStartTime(), option.getEndTime(), option.getOptionLabel()))
                .sorted(comparator)
                .toList();
        return !existing.equals(requested);
    }

    private String pollOptionKey(Integer day, java.time.LocalTime start, java.time.LocalTime end, String label) {
        return day + "|" + start + "|" + end + "|" + Objects.toString(normalizeOptional(label), "");
    }

    private boolean isTutorPost(PostType postType) {
        return postType == PostType.TUTOR_ANNOUNCEMENT
                || postType == PostType.TUTOR_POLL
                || postType == PostType.TUTOR_CLASS_SHARE;
    }

    private String requireCommunityParticipant(LearningUserPrincipal principal, String action) {
        if (principal == null || principal.userId() == null) {
            throw new BadRequestException("Vui lòng đăng nhập để " + action);
        }
        String role = principal.activeRole() == null ? "" : principal.activeRole().trim().toUpperCase(Locale.ROOT);
        if (!"STUDENT".equals(role) && !"TUTOR".equals(role)) {
            throw new ForbiddenException("Chỉ học viên hoặc gia sư mới được phép " + action);
        }
        return role;
    }

    private Subject resolveApprovedTutorSubject(CreatePostRequest request, String tutorEmail) {
        if (request.getSubjectId() == null) {
            throw new BadRequestException("Bài đăng gia sư phải chọn môn học đã được duyệt");
        }

        List<TutorSubjectRegistration> approvedRegistrations = registrationRepository
                .findByTutorEmailIgnoreCaseOrderByCreatedAtDesc(tutorEmail).stream()
                .filter(r -> r.getStatus() == TutorSubjectRegistrationStatus.APPROVED)
                .toList();

        if (approvedRegistrations.isEmpty()) {
            throw new BadRequestException("Gia sư chưa có hồ sơ giảng dạy nào được phê duyệt");
        }

        String requestedLevel = normalizeOptional(request.getEducationLevel());

        // Find the approved registration that matches either by direct ID (registration ID or CatalogSubject ID) or via Subject entity name
        TutorSubjectRegistration matchedRegistration = approvedRegistrations.stream()
                .filter(reg -> {
                    String regSubName = reg.getSubject() != null ? reg.getSubject().getName() : reg.getProposedSubjectName();
                    Long catSubId = reg.getSubject() != null ? reg.getSubject().getId() : null;

                    boolean idMatches = Objects.equals(request.getSubjectId(), reg.getId())
                            || (catSubId != null && Objects.equals(request.getSubjectId(), catSubId));

                    boolean nameMatches = false;
                    Optional<Subject> subjectOpt = subjectRepository.findById(request.getSubjectId());
                    if (subjectOpt.isPresent()) {
                        String subName = subjectOpt.get().getName();
                        if (regSubName != null && (
                                subName.equalsIgnoreCase(regSubName)
                                || normalizeText(subName).equals(normalizeText(regSubName))
                                || normalizeText(subName).contains(normalizeText(regSubName))
                                || normalizeText(regSubName).contains(normalizeText(subName))
                        )) {
                            nameMatches = true;
                        }
                    }

                    if (!idMatches && !nameMatches) {
                        return false;
                    }

                    // Level check
                    if (requestedLevel == null || reg.getLevels() == null || reg.getLevels().isEmpty()) {
                        return true;
                    }
                    String normReqLevel = normalizeText(requestedLevel);
                    return reg.getLevels().stream().anyMatch(lvl -> {
                        if (lvl == null) return false;
                        String lvlName = lvl.getName();
                        String lvlCode = lvl.getCode();
                        return (lvlName != null && lvlName.equalsIgnoreCase(requestedLevel))
                                || (lvlCode != null && lvlCode.equalsIgnoreCase(requestedLevel))
                                || (lvlName != null && normalizeText(lvlName).equals(normReqLevel))
                                || (lvlCode != null && normalizeText(lvlCode).equals(normReqLevel));
                    });
                })
                .findFirst()
                .orElse(null);

        if (matchedRegistration == null) {
            throw new BadRequestException("Môn học/cấp độ chưa thuộc hồ sơ giảng dạy đã được duyệt của gia sư");
        }

        // Now resolve a Subject entity from subjects table for CommunityPost.subject
        String targetSubName = matchedRegistration.getSubject() != null
                ? matchedRegistration.getSubject().getName()
                : matchedRegistration.getProposedSubjectName();

        if (request.getSubjectId() != null) {
            Optional<Subject> direct = subjectRepository.findById(request.getSubjectId())
                    .filter(Subject::isActive);
            if (direct.isPresent() && targetSubName != null && (
                    direct.get().getName().equalsIgnoreCase(targetSubName)
                    || normalizeText(direct.get().getName()).equals(normalizeText(targetSubName))
            )) {
                return direct.get();
            }
        }

        if (targetSubName != null) {
            String normTarget = normalizeText(targetSubName);
            List<Subject> allActive = subjectRepository.findAll();
            for (Subject s : allActive) {
                if (s.isActive() && normalizeText(s.getName()).equals(normTarget)) {
                    return s;
                }
            }
            for (Subject s : allActive) {
                if (s.isActive() && (normalizeText(s.getName()).contains(normTarget) || normTarget.contains(normalizeText(s.getName())))) {
                    return s;
                }
            }
        }

        return null;
    }

    private String normalizeText(String text) {
        if (text == null) return "";
        return java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .trim();
    }

    private ClassRoom resolveShareableClass(Long classId, String tutorEmail) {
        if (classId == null) {
            throw new BadRequestException("Vui lòng chọn lớp học có sẵn để giới thiệu");
        }
        ClassRoom classRoom = classRoomRepository.findByIdWithDetails(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học"));
        if (classRoom.getTutorEmail() == null || !classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("Bạn chỉ được giới thiệu lớp học của chính mình");
        }
        if (classRoom.getStatus() == ClassRoomStatus.LOCKED) {
            throw new BadRequestException("Lớp học đã bị khóa tuyển sinh, không thể đăng bài giới thiệu");
        }
        if (classRoom.getStatus() != ClassRoomStatus.PUBLISHED) {
            throw new BadRequestException("Chỉ lớp đang mở tuyển sinh công khai (PUBLISHED) mới được giới thiệu trên bảng tin");
        }
        if (classRoom.getTerminationCutoffSession() != null) {
            throw new BadRequestException("Lớp học đang trong quy trình thanh lý / chấm dứt, không thể đăng bài giới thiệu");
        }
        if (!isClassAcceptingEnrollment(classRoom)) {
            throw new BadRequestException("Lớp học đã đến hoặc qua ngày khai giảng, thời gian tuyển sinh đã kết thúc");
        }
        return classRoom;
    }

    private boolean isClassAcceptingEnrollment(ClassRoom classRoom) {
        return classRoom != null
                && classRoom.getStatus() == ClassRoomStatus.PUBLISHED
                && classRoom.getTerminationCutoffSession() == null
                && classRoom.getStartDate() != null
                && !classRoom.getStartDate().isBefore(LocalDate.now());
    }

    private Subject resolveSubjectForClass(ClassRoom classRoom, Long requestedSubjectId) {
        Subject requestedSubject = null;
        if (requestedSubjectId != null) {
            requestedSubject = subjectRepository.findById(requestedSubjectId)
                    .filter(Subject::isActive)
                    .orElseThrow(() -> new BadRequestException("Môn học không tồn tại hoặc đã ngừng hoạt động"));
        }

        Subject classSubject = null;
        String classSubjectName = null;
        if (classRoom != null && classRoom.getTutorSubjectRegistration() != null) {
            CatalogSubject catSub = classRoom.getTutorSubjectRegistration().getSubject();
            if (catSub != null && catSub.getName() != null) {
                classSubjectName = catSub.getName().trim();
                classSubject = subjectRepository.findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                        catSub.getName().trim(), PageRequest.of(0, 1)
                ).stream().findFirst().orElse(null);
            }
        }

        if (requestedSubject != null && classSubjectName != null
                && !subjectNamesCompatible(requestedSubject.getName(), classSubjectName)) {
            throw new BadRequestException("Môn học gắn bài giới thiệu phải khớp với môn của lớp học");
        }
        return classSubject != null ? classSubject : requestedSubject;
    }

    private boolean subjectNamesCompatible(String requestedName, String classSubjectName) {
        String requested = normalizeText(requestedName);
        String classSubject = normalizeText(classSubjectName);
        return !requested.isBlank()
                && !classSubject.isBlank()
                && (requested.equals(classSubject)
                || requested.contains(classSubject)
                || classSubject.contains(requested));
    }

    private void applyStandardPollOptions(CreatePollRequest poll) {
        if (poll == null) return;
        int sessionsPerWeek = poll.getSessionsPerWeek() != null ? poll.getSessionsPerWeek() : 2;
        poll.setMaxVotesPerUser(sessionsPerWeek);
        List<CreatePollOptionRequest> options = new ArrayList<>(21);
        for (int day = 1; day <= 7; day++) {
            for (PollTimePeriod period : PollTimePeriod.values()) {
                String dayLabel = day == 7 ? "Chủ nhật" : "Thứ " + (day + 1);
                options.add(new CreatePollOptionRequest(
                        day,
                        period.getStart(),
                        period.getEndExclusive(),
                        dayLabel + " - " + period.getLabel()
                ));
            }
        }
        poll.setOptions(options);
    }

    private void validatePoll(CreatePollRequest poll) {
        if (poll == null || poll.getOptions() == null || poll.getOptions().size() != 21) {
            throw new BadRequestException("Khảo sát phải có đủ 21 lựa chọn gồm 7 ngày và 3 buổi");
        }
        int sessionsPerWeek = poll.getSessionsPerWeek() != null ? poll.getSessionsPerWeek() : 2;
        int maxVotesPerUser = poll.getMaxVotesPerUser() != null ? poll.getMaxVotesPerUser() : sessionsPerWeek;
        if (sessionsPerWeek < 1 || sessionsPerWeek > 7 || maxVotesPerUser != sessionsPerWeek) {
            throw new BadRequestException("Giới hạn bình chọn phải bằng số buổi học dự kiến mỗi tuần");
        }
        Set<String> slots = new HashSet<>();
        for (CreatePollOptionRequest option : poll.getOptions()) {
            if (option.getDayOfWeek() == null || option.getDayOfWeek() < 1 || option.getDayOfWeek() > 7
                    || option.getStartTime() == null || option.getEndTime() == null) {
                throw new BadRequestException("Khung giờ khảo sát không hợp lệ");
            }
            if (!option.getStartTime().isBefore(option.getEndTime())) {
                throw new BadRequestException("Giờ bắt đầu phải trước giờ kết thúc");
            }
            PollTimePeriod period = PollTimePeriod.fromStartTime(option.getStartTime());
            if (!option.getStartTime().equals(period.getStart())
                    || !option.getEndTime().equals(period.getEndExclusive())) {
                throw new BadRequestException("Lựa chọn khảo sát phải dùng đúng ba buổi Sáng, Chiều hoặc Tối");
            }
            String slotKey = option.getDayOfWeek() + "|" + period.name();
            if (!slots.add(slotKey)) {
                throw new BadRequestException("Khảo sát không được chứa lựa chọn ngày và buổi trùng nhau");
            }
        }
    }

    private void requireStudentPollParticipant(LearningUserPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new BadRequestException("Vui lòng đăng nhập để bình chọn");
        }
        if (!"STUDENT".equalsIgnoreCase(principal.activeRole())) {
            throw new ForbiddenException("Chỉ học viên mới được tham gia bình chọn ca học");
        }
    }

    private void ensurePollAcceptsVotes(PostPoll poll) {
        boolean expired = poll.getExpiresAt() != null && !poll.getExpiresAt().isAfter(LocalDateTime.now());
        if (Boolean.TRUE.equals(poll.getIsClosed())
                || expired
                || poll.getPost() == null
                || poll.getPost().getStatus() != PostStatus.OPEN) {
            throw new BadRequestException("Cuộc khảo sát này đã kết thúc");
        }
    }

    private void publishPollUpdated(PostPoll poll) {
        PollSummaryDto publicSummary = mapToPollSummaryDto(poll, null);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("postId", poll.getPost() != null ? poll.getPost().getId() : null);
        payload.put("poll", publicSummary);
        realtimeEventHub.publishToAll("COMMUNITY_POLL_UPDATED", poll.getId(), payload);
    }

    private void publishPostUpdated(CommunityPost post) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("postId", post.getId());
        payload.put("status", post.getStatus().name());
        payload.put("likeCount", safeCount(post.getLikeCount()));
        payload.put("commentCount", safeCount(post.getCommentCount()));
        payload.put("viewCount", safeCount(post.getViewCount()));
        if (post.getPoll() != null) {
            payload.put("poll", mapToPollSummaryDto(post.getPoll(), null));
        }
        realtimeEventHub.publishToAll("COMMUNITY_POST_UPDATED", post.getId(), payload);
    }

    private String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void ensurePostVisible(CommunityPost post) {
        if (post.getStatus() == PostStatus.HIDDEN) {
            throw new ResourceNotFoundException("Không tìm thấy bài viết");
        }
    }

    private PostSummaryDto mapToSummaryDto(CommunityPost post, Long currentUserId) {
        Boolean isLiked = false;
        Boolean isBookmarked = false;
        if (currentUserId != null) {
            isLiked = interactionRepository.existsByPostIdAndUserIdAndInteractionType(
                    post.getId(), currentUserId, InteractionType.LIKE);
            isBookmarked = interactionRepository.existsByPostIdAndUserIdAndInteractionType(
                    post.getId(), currentUserId, InteractionType.BOOKMARK);
        }

        PollSummaryDto pollDto = null;
        if (post.getPoll() != null) {
            pollDto = mapToPollSummaryDto(post.getPoll(), currentUserId);
        }
        ClassRoom linkedClass = post.getLinkedClass();

        Long acceptedCount = null;
        Long availableSlots = null;
        if (linkedClass != null) {
            long accepted = enrollmentRequestRepository.countByClassRoomIdAndStatus(
                    linkedClass.getId(), EnrollmentRequestStatus.ACCEPTED);
            acceptedCount = accepted;
            int max = linkedClass.getMaxStudents() != null ? linkedClass.getMaxStudents() : 20;
            availableSlots = Math.max(0L, (long) max - accepted);
        }

        return PostSummaryDto.builder()
                .id(post.getId())
                .authorId(post.getAuthorId())
                .authorRole(post.getAuthorRole())
                .authorName(post.getAuthorName())
                .authorAvatar(post.getAuthorAvatar())
                .postType(post.getPostType())
                .title(post.getTitle())
                .content(post.getContent())
                .subjectId(post.getSubject() != null ? post.getSubject().getId() : null)
                .subjectName(post.getSubject() != null ? post.getSubject().getName() : null)
                .educationLevel(post.getEducationLevel())
                .learningMode(post.getLearningMode())
                .targetPricePerSession(post.getTargetPricePerSession())
                .address(post.getAddress())
                .status(post.getStatus())
                .linkedClassId(linkedClass != null ? linkedClass.getId() : null)
                .linkedClassName(linkedClass != null ? linkedClass.getName() : null)
                .linkedClassStatus(linkedClass != null ? linkedClass.getStatus().name() : null)
                .linkedClassJoinMode(linkedClass != null && linkedClass.getJoinMode() != null ? linkedClass.getJoinMode().name() : null)
                .linkedClassPricePerSession(linkedClass != null ? linkedClass.getPricePerSession() : null)
                .linkedClassTotalSessions(linkedClass != null ? linkedClass.getTotalSessions() : null)
                .linkedClassMaxStudents(linkedClass != null ? linkedClass.getMaxStudents() : null)
                .linkedClassAcceptedCount(acceptedCount)
                .linkedClassAvailableSlots(availableSlots)
                .linkedClassAcceptingEnrollment(isClassAcceptingEnrollment(linkedClass))
                .linkedClassStartDate(linkedClass != null ? linkedClass.getStartDate() : null)
                .likeCount(post.getLikeCount() != null ? post.getLikeCount() : 0)
                .commentCount(post.getCommentCount() != null ? post.getCommentCount() : 0)
                .viewCount(post.getViewCount() != null ? post.getViewCount() : 0)
                .isLiked(isLiked)
                .isBookmarked(isBookmarked)
                .poll(pollDto)
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .build();
    }

    private PollSummaryDto mapToPollSummaryDto(PostPoll poll, Long currentUserId) {
        List<Long> userVotedOptionIds = new ArrayList<>();
        Long userVotedOptionId = null;
        if (currentUserId != null) {
            List<PostPollVote> userVotes = pollVoteRepository.findByPollIdAndUserId(poll.getId(), currentUserId);
            userVotedOptionIds = userVotes.stream().map(v -> v.getOption().getId()).collect(Collectors.toList());
            if (!userVotedOptionIds.isEmpty()) {
                userVotedOptionId = userVotedOptionIds.get(0);
            }
        }

        int totalVotes = poll.getTotalVotes() != null ? poll.getTotalVotes() : 0;
        List<PostPollOption> options = pollOptionRepository.findByPollIdOrderByDayOfWeekAscStartTimeAsc(poll.getId());

        List<PollOptionDto> optionDtos = options.stream().map(opt -> {
            int count = opt.getVoteCount() != null ? opt.getVoteCount() : 0;
            double pct = totalVotes > 0 ? Math.round(((double) count / totalVotes * 1000.0)) / 10.0 : 0.0;
            return PollOptionDto.builder()
                    .id(opt.getId())
                    .dayOfWeek(opt.getDayOfWeek())
                    .timePeriod(opt.getTimePeriod() != null
                            ? opt.getTimePeriod()
                            : PollTimePeriod.fromStartTime(opt.getStartTime()))
                    .startTime(opt.getStartTime())
                    .endTime(opt.getEndTime())
                    .optionLabel(opt.getOptionLabel())
                    .voteCount(count)
                    .votePercentage(pct)
                    .build();
        }).collect(Collectors.toList());

        return PollSummaryDto.builder()
                .id(poll.getId())
                .question(poll.getQuestion())
                .minVotesTarget(poll.getMinVotesTarget())
                .totalVotes(totalVotes)
                .participantCount(pollVoteRepository.countDistinctUsersByPollId(poll.getId()))
                .sessionsPerWeek(poll.getSessionsPerWeek() != null ? poll.getSessionsPerWeek() : 2)
                .durationMinutes(poll.getDurationMinutes() != null ? poll.getDurationMinutes() : 90)
                .maxVotesPerUser(poll.getMaxVotesPerUser() != null ? poll.getMaxVotesPerUser() : 2)
                .isClosed(poll.getIsClosed())
                .expiresAt(poll.getExpiresAt())
                .userVotedOptionId(userVotedOptionId)
                .userVotedOptionIds(userVotedOptionIds)
                .options(optionDtos)
                .build();
    }
}
