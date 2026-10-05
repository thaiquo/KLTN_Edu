package iuh.fit.learning_service.service;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.CommunityPostDtos.*;
import iuh.fit.learning_service.dto.ClassRoomDtos;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.LearningMode;
import iuh.fit.learning_service.enums.InteractionType;
import iuh.fit.learning_service.enums.PostStatus;
import iuh.fit.learning_service.enums.PostType;
import iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.realtime.RealtimeEventHub;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import org.mockito.ArgumentCaptor;

@ExtendWith(MockitoExtension.class)
class CommunityPostServiceTest {

    @Mock
    private CommunityPostRepository postRepository;

    @Mock
    private PostPollRepository pollRepository;

    @Mock
    private PostPollOptionRepository pollOptionRepository;

    @Mock
    private PostPollVoteRepository pollVoteRepository;

    @Mock
    private PostInteractionRepository interactionRepository;

    @Mock
    private SubjectRepository subjectRepository;

    @Mock
    private ClassRoomRepository classRoomRepository;

    @Mock
    private ClassScheduleRepository classScheduleRepository;

    @Mock
    private TutorSubjectRegistrationRepository registrationRepository;

    @Mock
    private CatalogLevelRepository levelRepository;

    @Mock
    private RealtimeEventHub realtimeEventHub;

    @Mock
    private ClassRoomService classRoomService;

    @Mock
    private LearningEventPublisher eventPublisher;

    @InjectMocks
    private CommunityPostService postService;

    private LearningUserPrincipal tutorPrincipal;
    private LearningUserPrincipal studentPrincipal;

    @BeforeEach
    void setUp() {
        tutorPrincipal = new LearningUserPrincipal("tutor@edu.vn", 101L, "TUTOR");
        studentPrincipal = new LearningUserPrincipal("student@edu.vn", 202L, "STUDENT");
    }

    @Test
    void createPost_TutorPoll_Success() {
        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.TUTOR_POLL);
        request.setTitle("Lớp ôn thi THPTQG Toán 12");
        request.setContent("Khảo sát lịch học cho các bạn 2k7");
        request.setSubjectId(5L);

        CreatePollRequest pollReq = new CreatePollRequest();
        pollReq.setQuestion("Bạn học được tối nào?");
        pollReq.setMinVotesTarget(5);
        pollReq.setOptions(List.of(
                new CreatePollOptionRequest(1, LocalTime.of(19, 30), LocalTime.of(21, 0), "T2-T4-T6"),
                new CreatePollOptionRequest(2, LocalTime.of(19, 30), LocalTime.of(21, 0), "T3-T5-T7")
        ));
        request.setPoll(pollReq);

        CommunityPost savedPost = new CommunityPost();
        savedPost.setId(1L);
        savedPost.setAuthorId(101L);
        savedPost.setAuthorRole("TUTOR");
        savedPost.setTitle(request.getTitle());
        savedPost.setContent(request.getContent());
        savedPost.setPostType(PostType.TUTOR_POLL);
        savedPost.setStatus(PostStatus.OPEN);

        PostPoll savedPoll = new PostPoll();
        savedPoll.setId(10L);
        savedPoll.setQuestion(pollReq.getQuestion());
        savedPoll.setTotalVotes(0);
        savedPoll.setMinVotesTarget(5);
        savedPoll.setIsClosed(false);

        when(postRepository.save(any(CommunityPost.class))).thenReturn(savedPost);
        when(pollRepository.save(any(PostPoll.class))).thenReturn(savedPoll);
        Subject subject = new Subject();
        subject.setId(5L);
        subject.setName("Toán");
        subject.setActive(true);
        when(subjectRepository.findById(5L)).thenReturn(Optional.of(subject));

        PostSummaryDto result = postService.createPost(request, tutorPrincipal, "Thầy Hưng", null);

        assertThat(result).isNotNull();
        assertThat(result.getTitle()).isEqualTo("Lớp ôn thi THPTQG Toán 12");
        assertThat(result.getAuthorRole()).isEqualTo("TUTOR");
        verify(postRepository).save(any(CommunityPost.class));
        verify(pollRepository).save(any(PostPoll.class));
    }

    @Test
    void createPost_TutorPoll_ForbiddenForStudent() {
        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.TUTOR_POLL);
        request.setTitle("Khảo sát trái phép");
        request.setContent("Nội dung");

        assertThrows(ForbiddenException.class, () ->
                postService.createPost(request, studentPrincipal, "Học sinh A", null));

        verify(postRepository, never()).save(any());
    }

    @Test
    void createPost_TutorPoll_MissingOptions_ThrowsBadRequest() {
        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.TUTOR_POLL);
        request.setTitle("Khảo sát thiếu ca học");
        request.setContent("Nội dung");
        CreatePollRequest pollReq = new CreatePollRequest();
        pollReq.setQuestion("Câu hỏi");
        pollReq.setOptions(List.of(
                new CreatePollOptionRequest(1, LocalTime.of(19, 0), LocalTime.of(20, 30), "Chỉ 1 ca")
        ));
        request.setPoll(pollReq);

        assertThrows(BadRequestException.class, () ->
                postService.createPost(request, tutorPrincipal, "Gia sư", null));
    }

    @Test
    void createPost_TutorPoll_InvalidTime_ThrowsBadRequest() {
        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.TUTOR_POLL);
        request.setTitle("Khảo sát sai giờ");
        request.setContent("Nội dung");
        request.setSubjectId(5L);
        CreatePollRequest pollReq = new CreatePollRequest();
        pollReq.setQuestion("Câu hỏi");
        pollReq.setOptions(List.of(
                new CreatePollOptionRequest(1, LocalTime.of(21, 0), LocalTime.of(19, 0), "Sai giờ"),
                new CreatePollOptionRequest(2, LocalTime.of(19, 0), LocalTime.of(20, 30), "Hợp lệ")
        ));
        request.setPoll(pollReq);

        assertThrows(BadRequestException.class, () ->
                postService.createPost(request, tutorPrincipal, "Gia sư", null));
        verify(postRepository, never()).save(any());
    }

    @Test
    void votePoll_Student_Success() {
        Long pollId = 10L;
        Long optionId = 55L;

        PostPoll poll = new PostPoll();
        poll.setId(pollId);
        poll.setTotalVotes(2);
        poll.setIsClosed(false);
        CommunityPost pollPost = new CommunityPost();
        pollPost.setStatus(PostStatus.OPEN);
        poll.setPost(pollPost);

        PostPollOption option = new PostPollOption();
        option.setId(optionId);
        option.setPoll(poll);
        option.setVoteCount(1);
        option.setOptionLabel("T2 (19:30 - 21:00)");

        when(pollRepository.findByIdForUpdate(pollId)).thenReturn(Optional.of(poll));
        when(pollOptionRepository.findById(optionId)).thenReturn(Optional.of(option));
        when(pollVoteRepository.findByPollIdAndUserId(pollId, studentPrincipal.userId())).thenReturn(Optional.empty());

        PollSummaryDto result = postService.votePoll(pollId, optionId, studentPrincipal, "Học viên B");

        assertThat(result).isNotNull();
        assertThat(option.getVoteCount()).isEqualTo(2);
        assertThat(poll.getTotalVotes()).isEqualTo(3);
        verify(pollVoteRepository).save(any(PostPollVote.class));
    }

    @Test
    void votePoll_Tutor_Forbidden() {
        Long pollId = 10L;
        Long optionId = 55L;

        assertThrows(ForbiddenException.class, () ->
                postService.votePoll(pollId, optionId, tutorPrincipal, "Thầy Hưng"));

        verify(pollVoteRepository, never()).save(any());
    }

    @Test
    void votePoll_Staff_Forbidden() {
        LearningUserPrincipal staff = new LearningUserPrincipal("staff@edu.vn", 303L, "STAFF");

        assertThrows(ForbiddenException.class, () ->
                postService.votePoll(10L, 55L, staff, "Nhân viên"));
        verifyNoInteractions(pollRepository, pollVoteRepository);
    }

    @Test
    void deletePost_SoftDelete() {
        Long postId = 1L;
        CommunityPost post = new CommunityPost();
        post.setId(postId);
        post.setAuthorId(tutorPrincipal.userId());
        post.setStatus(PostStatus.OPEN);

        when(postRepository.findByIdForUpdate(postId)).thenReturn(Optional.of(post));

        postService.deletePost(postId, tutorPrincipal, false);

        assertThat(post.getStatus()).isEqualTo(PostStatus.HIDDEN);
        verify(postRepository).save(post);
        verify(postRepository, never()).delete(any(CommunityPost.class));
    }

    @Test
    void getMyPosts_UsesAuthenticatedOwnerScope() {
        CommunityPost post = new CommunityPost();
        post.setId(1L);
        post.setAuthorId(tutorPrincipal.userId());
        post.setAuthorRole("TUTOR");
        post.setPostType(PostType.TUTOR_POLL);
        post.setStatus(PostStatus.OPEN);
        post.setTitle("Khảo sát lớp Toán");
        post.setContent("Nội dung");
        when(postRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(post)));

        var result = postService.getMyPosts(null, PageRequest.of(0, 10), tutorPrincipal);

        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent().getFirst().getAuthorId()).isEqualTo(tutorPrincipal.userId());
    }

    @Test
    void closePost_OwnerClosesPostAndPoll() {
        CommunityPost post = conversionPost(PostStatus.OPEN, false);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));
        when(postRepository.save(post)).thenReturn(post);

        PostSummaryDto result = postService.closePost(1L, tutorPrincipal);

        assertThat(result.getStatus()).isEqualTo(PostStatus.CLOSED);
        assertThat(post.getPoll().getIsClosed()).isTrue();
        verify(pollRepository).save(post.getPoll());
        verify(postRepository).save(post);
    }

    @Test
    void updatePost_RejectsChangingPollOptionsAfterVotes() {
        CommunityPost post = conversionPost(PostStatus.OPEN, false);
        post.setTitle("Bài cũ");
        post.setContent("Nội dung cũ");
        post.getPoll().setTotalVotes(1);
        PostPollOption existing = new PostPollOption();
        existing.setPoll(post.getPoll());
        existing.setDayOfWeek(1);
        existing.setStartTime(LocalTime.of(19, 0));
        existing.setEndTime(LocalTime.of(20, 0));
        existing.setOptionLabel("Ca cũ");

        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.TUTOR_POLL);
        request.setTitle("Bài mới");
        request.setContent("Nội dung mới");
        CreatePollRequest pollRequest = new CreatePollRequest();
        pollRequest.setQuestion("Chọn ca học");
        pollRequest.setMinVotesTarget(3);
        pollRequest.setOptions(List.of(
                new CreatePollOptionRequest(2, LocalTime.of(19, 0), LocalTime.of(20, 0), "Ca mới"),
                new CreatePollOptionRequest(3, LocalTime.of(19, 0), LocalTime.of(20, 0), "Ca khác")
        ));
        request.setPoll(pollRequest);

        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));
        when(pollOptionRepository.findByPollIdOrderByDayOfWeekAscStartTimeAsc(post.getPoll().getId()))
                .thenReturn(List.of(existing));

        assertThrows(ConflictException.class, () -> postService.updatePost(1L, request, tutorPrincipal));
        verify(postRepository, never()).save(any());
    }

    @Test
    void toggleBookmark_NewBookmark_SavesInteraction() {
        CommunityPost post = new CommunityPost();
        post.setId(1L);
        post.setStatus(PostStatus.OPEN);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));
        when(interactionRepository.findByPostIdAndUserIdAndInteractionType(
                1L, tutorPrincipal.userId(), InteractionType.BOOKMARK)).thenReturn(Optional.empty());

        boolean bookmarked = postService.toggleBookmark(1L, tutorPrincipal);

        assertThat(bookmarked).isTrue();
        ArgumentCaptor<PostInteraction> interactionCaptor = ArgumentCaptor.forClass(PostInteraction.class);
        verify(interactionRepository).save(interactionCaptor.capture());
        assertThat(interactionCaptor.getValue().getInteractionType()).isEqualTo(InteractionType.BOOKMARK);
        assertThat(interactionCaptor.getValue().getUserId()).isEqualTo(tutorPrincipal.userId());
        verify(postRepository, never()).save(any());
    }

    @Test
    void toggleBookmark_ExistingBookmark_RemovesInteraction() {
        CommunityPost post = new CommunityPost();
        post.setId(1L);
        post.setStatus(PostStatus.OPEN);
        PostInteraction bookmark = new PostInteraction();
        bookmark.setPost(post);
        bookmark.setUserId(tutorPrincipal.userId());
        bookmark.setInteractionType(InteractionType.BOOKMARK);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));
        when(interactionRepository.findByPostIdAndUserIdAndInteractionType(
                1L, tutorPrincipal.userId(), InteractionType.BOOKMARK)).thenReturn(Optional.of(bookmark));

        boolean bookmarked = postService.toggleBookmark(1L, tutorPrincipal);

        assertThat(bookmarked).isFalse();
        verify(interactionRepository).delete(bookmark);
        verify(interactionRepository, never()).save(any());
    }

    @Test
    void toggleBookmark_Unauthenticated_IsRejected() {
        assertThrows(BadRequestException.class, () -> postService.toggleBookmark(1L, null));
        verifyNoInteractions(postRepository, interactionRepository);
    }

    @Test
    void getPostDetail_HiddenPostIsNotPublic() {
        assertThrows(ResourceNotFoundException.class, () -> postService.getPostDetail(1L, null));
        verify(postRepository).incrementViewCount(1L);
        verify(postRepository, never()).findById(1L);
        verify(postRepository, never()).save(any());
    }

    @Test
    void convertPostToClass_Success() {
        Long postId = 1L;
        CommunityPost post = new CommunityPost();
        post.setId(postId);
        post.setAuthorId(tutorPrincipal.userId());
        post.setPostType(PostType.TUTOR_POLL);
        post.setTitle("Lớp Luyện Thi");
        post.setContent("Mô tả chi tiết");
        post.setAuthorName("Thầy Hưng");
        post.setStatus(PostStatus.OPEN);
        Subject legacySubject = new Subject();
        legacySubject.setId(5L);
        legacySubject.setName("Toán");
        post.setSubject(legacySubject);

        PostPoll poll = new PostPoll();
        poll.setId(10L);
        poll.setPost(post);
        poll.setIsClosed(false);
        poll.setTotalVotes(2);
        poll.setMinVotesTarget(2);
        post.setPoll(poll);

        PostPollOption option = new PostPollOption();
        option.setId(20L);
        option.setPoll(poll);
        option.setDayOfWeek(1);
        option.setStartTime(LocalTime.of(19, 30));
        option.setEndTime(LocalTime.of(21, 0));

        TutorSubjectRegistration reg = new TutorSubjectRegistration();
        reg.setId(50L);
        reg.setStatus(TutorSubjectRegistrationStatus.APPROVED);
        reg.setTutorEmail("tutor@edu.vn");
        CatalogSubject catalogSubject = new CatalogSubject();
        catalogSubject.setId(15L);
        catalogSubject.setName("Toán");
        catalogSubject.setActive(true);
        reg.setSubject(catalogSubject);
        CatalogLevel level = new CatalogLevel();
        level.setId(77L);
        level.setActive(true);
        reg.setLevels(List.of(level));

        ConvertPostToClassRequest request = ConvertPostToClassRequest.builder()
                .selectedOptionId(20L)
                .maxStudents(15)
                .pricePerSession(BigDecimal.valueOf(200000))
                .startDate(LocalDate.now().plusWeeks(1))
                .build();

        when(postRepository.findByIdForUpdate(postId)).thenReturn(Optional.of(post));
        when(pollOptionRepository.findById(20L)).thenReturn(Optional.of(option));
        when(registrationRepository.findByTutorEmailIgnoreCaseOrderByCreatedAtDesc("tutor@edu.vn"))
                .thenReturn(List.of(reg));
        ClassRoomDtos.ClassRoomResponse createdResponse = mock(ClassRoomDtos.ClassRoomResponse.class);
        when(createdResponse.id()).thenReturn(999L);
        when(classRoomService.createClass(eq("tutor@edu.vn"), any(ClassRoomDtos.CreateClassRoomRequest.class)))
                .thenReturn(createdResponse);
        ClassRoom savedClass = new ClassRoom();
        savedClass.setId(999L);
        savedClass.setName("Lớp Luyện Thi");
        savedClass.setStatus(iuh.fit.learning_service.enums.ClassRoomStatus.PENDING_APPROVAL);
        when(classRoomRepository.findById(999L)).thenReturn(Optional.of(savedClass));
        PostPollVote voteOne = new PostPollVote();
        voteOne.setUserId(201L);
        PostPollVote voteTwo = new PostPollVote();
        voteTwo.setUserId(202L);
        when(pollVoteRepository.findByPollId(10L)).thenReturn(List.of(voteOne, voteTwo));

        ClassCreatedFromPostResponse resp = postService.convertPostToClass(postId, request, tutorPrincipal, "Thầy Hưng");

        assertThat(resp).isNotNull();
        assertThat(resp.getClassId()).isEqualTo(999L);
        assertThat(resp.getNotifiedStudentsCount()).isEqualTo(2);
        assertThat(post.getStatus()).isEqualTo(PostStatus.CONVERTED);
        assertThat(poll.getIsClosed()).isTrue();
        verify(postRepository).save(post);
        ArgumentCaptor<ClassRoomDtos.CreateClassRoomRequest> classRequestCaptor =
                ArgumentCaptor.forClass(ClassRoomDtos.CreateClassRoomRequest.class);
        verify(classRoomService).createClass(eq("tutor@edu.vn"), classRequestCaptor.capture());
        assertThat(classRequestCaptor.getValue().schedules().getFirst().dayOfWeek()).isEqualTo(2);
        verify(eventPublisher, times(2)).publishCommunityPostConverted(
                eq(postId), eq(999L), anyLong(), eq(101L), eq(post.getTitle()), eq(savedClass.getName()), eq("Thầy Hưng"));
    }

    @Test
    void createPost_StudentPost_ForbiddenForStaff() {
        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.STUDENT_FIND_TUTOR);
        request.setTitle("Tìm gia sư");
        request.setContent("Cần tìm gia sư Toán");
        LearningUserPrincipal staff = new LearningUserPrincipal("staff@edu.vn", 303L, "STAFF");

        assertThrows(ForbiddenException.class, () ->
                postService.createPost(request, staff, "Nhân viên", null));
        verify(postRepository, never()).save(any());
    }

    @Test
    void convertPostToClass_RejectsPollBelowTarget() {
        CommunityPost post = new CommunityPost();
        post.setId(1L);
        post.setAuthorId(tutorPrincipal.userId());
        post.setPostType(PostType.TUTOR_POLL);
        post.setStatus(PostStatus.OPEN);
        PostPoll poll = new PostPoll();
        poll.setId(10L);
        poll.setPost(post);
        poll.setIsClosed(false);
        poll.setTotalVotes(1);
        poll.setMinVotesTarget(2);
        post.setPoll(poll);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));

        ConvertPostToClassRequest request = ConvertPostToClassRequest.builder()
                .selectedOptionId(20L)
                .build();

        assertThrows(BadRequestException.class, () ->
                postService.convertPostToClass(1L, request, tutorPrincipal, "Thầy Hưng"));
        verifyNoInteractions(classRoomService, eventPublisher);
    }

    @Test
    void convertPostToClass_RejectsDuplicateConversion() {
        CommunityPost post = conversionPost(PostStatus.CONVERTED, false);
        ClassRoom linkedClass = new ClassRoom();
        linkedClass.setId(99L);
        post.setLinkedClass(linkedClass);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));

        assertThrows(ConflictException.class, () -> postService.convertPostToClass(
                1L, ConvertPostToClassRequest.builder().selectedOptionId(20L).build(), tutorPrincipal, "Gia sư"));
        verifyNoInteractions(classRoomService);
    }

    @Test
    void convertPostToClass_RejectsNonAuthor() {
        CommunityPost post = conversionPost(PostStatus.OPEN, false);
        post.setAuthorId(999L);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));

        assertThrows(ForbiddenException.class, () -> postService.convertPostToClass(
                1L, ConvertPostToClassRequest.builder().selectedOptionId(20L).build(), tutorPrincipal, "Gia sư"));
        verifyNoInteractions(classRoomService);
    }

    @Test
    void convertPostToClass_RejectsClosedPoll() {
        CommunityPost post = conversionPost(PostStatus.OPEN, true);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));

        assertThrows(ConflictException.class, () -> postService.convertPostToClass(
                1L, ConvertPostToClassRequest.builder().selectedOptionId(20L).build(), tutorPrincipal, "Gia sư"));
        verifyNoInteractions(classRoomService);
    }

    private CommunityPost conversionPost(PostStatus status, boolean pollClosed) {
        CommunityPost post = new CommunityPost();
        post.setId(1L);
        post.setAuthorId(tutorPrincipal.userId());
        post.setPostType(PostType.TUTOR_POLL);
        post.setStatus(status);
        PostPoll poll = new PostPoll();
        poll.setId(10L);
        poll.setPost(post);
        poll.setIsClosed(pollClosed);
        poll.setTotalVotes(2);
        poll.setMinVotesTarget(2);
        post.setPoll(poll);
        return post;
    }
}
