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
import iuh.fit.learning_service.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private final TutorSubjectRegistrationRepository registrationRepository;
    private final CatalogLevelRepository levelRepository;
    private final ClassRoomService classRoomService;
    private final LearningEventPublisher eventPublisher;

    public CommunityPostService(
            CommunityPostRepository postRepository,
            PostPollRepository pollRepository,
            PostPollOptionRepository pollOptionRepository,
            PostPollVoteRepository pollVoteRepository,
            PostInteractionRepository interactionRepository,
            SubjectRepository subjectRepository,
            ClassRoomRepository classRoomRepository,
            TutorSubjectRegistrationRepository registrationRepository,
            CatalogLevelRepository levelRepository,
            ClassRoomService classRoomService,
            LearningEventPublisher eventPublisher
    ) {
        this.postRepository = postRepository;
        this.pollRepository = pollRepository;
        this.pollOptionRepository = pollOptionRepository;
        this.pollVoteRepository = pollVoteRepository;
        this.interactionRepository = interactionRepository;
        this.subjectRepository = subjectRepository;
        this.classRoomRepository = classRoomRepository;
        this.registrationRepository = registrationRepository;
        this.levelRepository = levelRepository;
        this.classRoomService = classRoomService;
        this.eventPublisher = eventPublisher;
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
            spec = spec.and((root, query, builder) -> builder.or(
                    builder.like(builder.lower(root.get("title")), pattern),
                    builder.like(builder.lower(root.get("content")), pattern)));
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

        // Siết phân quyền loại bài đăng
        if (request.getPostType() == PostType.TUTOR_POLL) {
            if (!"TUTOR".equals(role)) {
                throw new ForbiddenException("Chỉ gia sư mới được phép đăng bài khảo sát mở lớp");
            }
            if (request.getPoll() == null || request.getPoll().getOptions() == null || request.getPoll().getOptions().size() < 2) {
                throw new BadRequestException("Bài khảo sát cần tối thiểu 2 khung giờ để học viên bình chọn");
            }
            if (request.getSubjectId() == null) {
                throw new BadRequestException("Bài khảo sát mở lớp phải chọn môn học");
            }
            validatePoll(request.getPoll());
        } else if (request.getPostType() == PostType.STUDENT_FIND_TUTOR || request.getPostType() == PostType.STUDENT_GROUP_STUDY) {
            if (!"STUDENT".equals(role)) {
                throw new ForbiddenException("Chỉ học viên mới được đăng bài tìm gia sư hoặc tìm nhóm học");
            }
        }

        CommunityPost post = new CommunityPost();
        post.setAuthorId(principal.userId());
        post.setAuthorRole(role);
        post.setAuthorName(fullName != null && !fullName.isBlank() ? fullName : principal.email());
        post.setAuthorAvatar(avatar);
        post.setPostType(request.getPostType());
        if (request.getPostType() != post.getPostType()) {
            throw new BadRequestException("Không thể thay đổi loại bài đăng");
        }

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

        if (request.getSubjectId() != null) {
            Subject subject = subjectRepository.findById(request.getSubjectId())
                    .filter(Subject::isActive)
                    .orElseThrow(() -> new BadRequestException("Môn học không tồn tại hoặc đã ngừng hoạt động"));
            post.setSubject(subject);
        }

        CommunityPost savedPost = postRepository.save(post);

        // Khởi tạo Poll nếu có
        if (request.getPostType() == PostType.TUTOR_POLL && request.getPoll() != null) {
            CreatePollRequest pollReq = request.getPoll();
            PostPoll poll = new PostPoll();
            poll.setPost(savedPost);
            poll.setQuestion(pollReq.getQuestion().trim());
            poll.setMinVotesTarget(pollReq.getMinVotesTarget() != null && pollReq.getMinVotesTarget() > 0 ? pollReq.getMinVotesTarget() : 5);
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
        if (post.getStatus() != PostStatus.OPEN) {
            throw new ConflictException("Chỉ bài viết đang mở mới có thể chỉnh sửa");
        }

        post.setTitle(request.getTitle().trim());
        post.setContent(request.getContent().trim());
        post.setEducationLevel(request.getEducationLevel());
        if (request.getLearningMode() != null) {
            post.setLearningMode(request.getLearningMode());
        }
        post.setTargetPricePerSession(request.getTargetPricePerSession());
        post.setAddress(request.getAddress());

        if (request.getSubjectId() != null) {
            Subject subject = subjectRepository.findById(request.getSubjectId())
                    .filter(Subject::isActive)
                    .orElseThrow(() -> new BadRequestException("Môn học không tồn tại hoặc đã ngừng hoạt động"));
            post.setSubject(subject);
        }

        if (post.getPostType() == PostType.TUTOR_POLL && post.getPoll() != null && request.getPoll() != null) {
            updatePoll(post.getPoll(), request.getPoll());
        }

        CommunityPost updated = postRepository.save(post);
        return mapToSummaryDto(updated, principal.userId());
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
        return mapToSummaryDto(postRepository.save(post), principal.userId());
    }

    public void deletePost(Long postId, LearningUserPrincipal principal, boolean isAdmin) {
        CommunityPost post = postRepository.findByIdForUpdate(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));

        if (!isAdmin && (principal == null || !post.getAuthorId().equals(principal.userId()))) {
            throw new ForbiddenException("Bạn không có quyền xóa bài viết này");
        }

        // Soft-delete an toàn: chuyển status thành HIDDEN để không mất dữ liệu liên kết
        post.setStatus(PostStatus.HIDDEN);
        postRepository.save(post);
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

        Optional<PostPollVote> existingVoteOpt = pollVoteRepository.findByPollIdAndUserId(pollId, principal.userId());

        if (existingVoteOpt.isPresent()) {
            PostPollVote existingVote = existingVoteOpt.get();
            if (existingVote.getOption().getId().equals(optionId)) {
                // Đã vote option này rồi -> giữ nguyên
                return mapToPollSummaryDto(poll, principal.userId());
            }

            // Đổi vote từ option cũ sang option mới
            PostPollOption oldOption = existingVote.getOption();
            oldOption.setVoteCount(Math.max(0, oldOption.getVoteCount() - 1));
            pollOptionRepository.save(oldOption);

            selectedOption.setVoteCount(selectedOption.getVoteCount() + 1);
            pollOptionRepository.save(selectedOption);

            existingVote.setOption(selectedOption);
            existingVote.setUserName(fullName != null ? fullName : principal.email());
            pollVoteRepository.save(existingVote);
        } else {
            // Vote mới
            selectedOption.setVoteCount(selectedOption.getVoteCount() + 1);
            pollOptionRepository.save(selectedOption);

            poll.setTotalVotes(poll.getTotalVotes() + 1);
            pollRepository.save(poll);

            PostPollVote newVote = new PostPollVote();
            newVote.setPoll(poll);
            newVote.setOption(selectedOption);
            newVote.setUserId(principal.userId());
            newVote.setUserName(fullName != null ? fullName : principal.email());
            pollVoteRepository.save(newVote);
        }

        return mapToPollSummaryDto(poll, principal.userId());
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

        Optional<PostPollVote> existingVoteOpt = pollVoteRepository.findByPollIdAndUserId(pollId, principal.userId());
        if (existingVoteOpt.isPresent()) {
            PostPollVote vote = existingVoteOpt.get();
            PostPollOption option = vote.getOption();
            option.setVoteCount(Math.max(0, option.getVoteCount() - 1));
            pollOptionRepository.save(option);

            poll.setTotalVotes(Math.max(0, poll.getTotalVotes() - 1));
            pollRepository.save(poll);

            pollVoteRepository.delete(vote);
        }

        return mapToPollSummaryDto(poll, principal.userId());
    }

    public boolean toggleLike(Long postId, LearningUserPrincipal principal, String fullName, String avatar) {
        if (principal == null || principal.userId() == null) {
            throw new BadRequestException("Vui lòng đăng nhập để thả tim");
        }

        CommunityPost post = postRepository.findByIdForUpdate(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        ensurePostVisible(post);

        Optional<PostInteraction> likeOpt = interactionRepository.findByPostIdAndUserIdAndInteractionType(
                postId, principal.userId(), InteractionType.LIKE);

        if (likeOpt.isPresent()) {
            interactionRepository.delete(likeOpt.get());
            post.setLikeCount(Math.max(0, post.getLikeCount() - 1));
            postRepository.save(post);
            return false;
        } else {
            PostInteraction like = new PostInteraction();
            like.setPost(post);
            like.setUserId(principal.userId());
            like.setUserRole(principal.activeRole() != null ? principal.activeRole().toUpperCase() : "STUDENT");
            like.setUserName(fullName != null ? fullName : principal.email());
            like.setUserAvatar(avatar);
            like.setInteractionType(InteractionType.LIKE);
            interactionRepository.save(like);

            post.setLikeCount(post.getLikeCount() + 1);
            postRepository.save(post);
            return true;
        }
    }

    public boolean toggleBookmark(Long postId, LearningUserPrincipal principal) {
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
        String role = principal.activeRole() == null ? "" : principal.activeRole().trim().toUpperCase(Locale.ROOT);
        if (role.isBlank()) {
            throw new ForbiddenException("Không xác định được vai trò đang hoạt động");
        }
        interaction.setUserRole(role);
        interaction.setUserName(principal.email());
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

    public CommentDto addComment(Long postId, String commentText, LearningUserPrincipal principal, String fullName, String avatar) {
        if (principal == null || principal.userId() == null) {
            throw new BadRequestException("Vui lòng đăng nhập để bình luận");
        }
        if (commentText == null || commentText.trim().isEmpty()) {
            throw new BadRequestException("Nội dung bình luận không được để trống");
        }

        CommunityPost post = postRepository.findByIdForUpdate(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        ensurePostVisible(post);

        PostInteraction comment = new PostInteraction();
        comment.setPost(post);
        comment.setUserId(principal.userId());
        comment.setUserRole(principal.activeRole() != null ? principal.activeRole().toUpperCase() : "STUDENT");
        comment.setUserName(fullName != null ? fullName : principal.email());
        comment.setUserAvatar(avatar);
        comment.setInteractionType(InteractionType.COMMENT);
        comment.setCommentText(commentText.trim());
        PostInteraction saved = interactionRepository.save(comment);

        post.setCommentCount(post.getCommentCount() + 1);
        postRepository.save(post);

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

    /**
     * Chuyển đổi bài viết khảo sát (TUTOR_POLL) thành lớp học thực tế (ClassRoom)
     * và thông báo cho toàn bộ học viên đã vote.
     */
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
        if (post.getStatus() != PostStatus.OPEN) {
            throw new ConflictException("Chỉ bài khảo sát đang mở mới có thể chuyển thành lớp học");
        }

        PostPoll poll = post.getPoll();
        if (poll == null) {
            throw new BadRequestException("Bài viết này không có biểu mẫu khảo sát");
        }
        if (Boolean.TRUE.equals(poll.getIsClosed())
                || (poll.getExpiresAt() != null && !poll.getExpiresAt().isAfter(LocalDateTime.now()))) {
            throw new ConflictException("Cuộc khảo sát đã đóng hoặc hết hạn");
        }
        int totalVotes = poll.getTotalVotes() == null ? 0 : poll.getTotalVotes();
        int minVotesTarget = poll.getMinVotesTarget() == null ? 1 : poll.getMinVotesTarget();
        if (totalVotes < minVotesTarget) {
            throw new BadRequestException("Khảo sát chưa đạt số lượt bình chọn tối thiểu để mở lớp");
        }

        PostPollOption selectedOption = pollOptionRepository.findById(request.getSelectedOptionId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khung giờ khảo sát đã chọn"));

        if (!selectedOption.getPoll().getId().equals(poll.getId())) {
            throw new BadRequestException("Khung giờ được chọn không thuộc khảo sát của bài viết này");
        }

        List<TutorSubjectRegistration> registrations = registrationRepository.findByTutorEmailIgnoreCaseOrderByCreatedAtDesc(principal.email());
        TutorSubjectRegistration registration = resolveApprovedRegistration(post, request, registrations);
        CatalogLevel level = resolveApprovedLevel(request, registration);

        int maxStudents = request.getMaxStudents() != null && request.getMaxStudents() > 0 
                ? request.getMaxStudents() 
                : (request.getMaxCapacity() != null && request.getMaxCapacity() > 0 ? request.getMaxCapacity() : 20);

        if (request.getSessionsPerWeek() != null && request.getSessionsPerWeek() != 1) {
            throw new BadRequestException("Chuyển đổi từ một lựa chọn khảo sát chỉ hỗ trợ 1 buổi mỗi tuần");
        }
        int sessionsPerWeek = 1;
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
        int scheduleDayOfWeek = selectedOption.getDayOfWeek() + 1;
        int durationMinutes = (int) java.time.Duration.between(
                selectedOption.getStartTime(), selectedOption.getEndTime()).toMinutes();
        if (durationMinutes < 30 || durationMinutes > 300) {
            throw new BadRequestException("Khung giờ lớp học phải kéo dài từ 30 đến 300 phút");
        }

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
                List.of(new ClassRoomDtos.ScheduleRequest(
                        scheduleDayOfWeek,
                        selectedOption.getStartTime().toString(),
                        selectedOption.getEndTime().toString())),
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

    private TutorSubjectRegistration resolveApprovedRegistration(
            CommunityPost post,
            ConvertPostToClassRequest request,
            List<TutorSubjectRegistration> registrations
    ) {
        if (post.getSubject() == null) {
            throw new BadRequestException("Bài khảo sát chưa có môn học để đối chiếu hồ sơ giảng dạy");
        }
        String postSubjectName = post.getSubject().getName().trim();
        return registrations.stream()
                .filter(r -> request.getTutorSubjectRegistrationId() == null
                        || Objects.equals(r.getId(), request.getTutorSubjectRegistrationId()))
                .filter(r -> r.getStatus() == TutorSubjectRegistrationStatus.APPROVED)
                .filter(r -> r.getSubject() != null && r.getSubject().isActive())
                .filter(r -> r.getSubject().getName().trim().equalsIgnoreCase(postSubjectName))
                .findFirst()
                .orElseThrow(() -> new BadRequestException(
                        "Không có hồ sơ giảng dạy đã duyệt phù hợp với môn " + postSubjectName));
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
        validatePoll(request);
        List<PostPollOption> existingOptions = pollOptionRepository
                .findByPollIdOrderByDayOfWeekAscStartTimeAsc(poll.getId());
        boolean optionsChanged = pollOptionsChanged(existingOptions, request.getOptions());
        int totalVotes = poll.getTotalVotes() == null ? 0 : poll.getTotalVotes();
        if (totalVotes > 0 && optionsChanged) {
            throw new ConflictException("Không thể thay đổi ca học khi khảo sát đã có bình chọn");
        }

        poll.setQuestion(request.getQuestion().trim());
        poll.setMinVotesTarget(request.getMinVotesTarget() != null && request.getMinVotesTarget() > 0
                ? request.getMinVotesTarget()
                : 5);
        poll.setExpiresAt(request.getExpiresAt());

        if (totalVotes == 0 && optionsChanged) {
            poll.getOptions().clear();
            for (CreatePollOptionRequest optionRequest : request.getOptions()) {
                PostPollOption option = new PostPollOption();
                option.setPoll(poll);
                option.setDayOfWeek(optionRequest.getDayOfWeek());
                option.setStartTime(optionRequest.getStartTime());
                option.setEndTime(optionRequest.getEndTime());
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

    private void validatePoll(CreatePollRequest poll) {
        if (poll == null || poll.getOptions() == null || poll.getOptions().size() < 2) {
            throw new BadRequestException("Bài khảo sát cần tối thiểu 2 khung giờ");
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
            String slotKey = option.getDayOfWeek() + "|" + option.getStartTime() + "|" + option.getEndTime();
            if (!slots.add(slotKey)) {
                throw new BadRequestException("Khảo sát không được chứa khung giờ trùng nhau");
            }
        }
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
                .linkedClassId(post.getLinkedClass() != null ? post.getLinkedClass().getId() : null)
                .linkedClassName(post.getLinkedClass() != null ? post.getLinkedClass().getName() : null)
                .linkedClassStatus(post.getLinkedClass() != null ? post.getLinkedClass().getStatus().name() : null)
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
        Long userVotedOptionId = null;
        if (currentUserId != null) {
            Optional<PostPollVote> voteOpt = pollVoteRepository.findByPollIdAndUserId(poll.getId(), currentUserId);
            if (voteOpt.isPresent()) {
                userVotedOptionId = voteOpt.get().getOption().getId();
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
                .isClosed(poll.getIsClosed())
                .expiresAt(poll.getExpiresAt())
                .userVotedOptionId(userVotedOptionId)
                .options(optionDtos)
                .build();
    }
}
