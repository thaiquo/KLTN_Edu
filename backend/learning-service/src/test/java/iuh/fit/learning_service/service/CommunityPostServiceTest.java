package iuh.fit.learning_service.service;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.CommunityPostDtos.*;
import iuh.fit.learning_service.dto.ClassRoomDtos;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.LearningMode;
import iuh.fit.learning_service.enums.InteractionType;
import iuh.fit.learning_service.enums.PostStatus;
import iuh.fit.learning_service.enums.PostType;
import iuh.fit.learning_service.enums.PollTimePeriod;
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
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private TutorAvailabilityRepository availabilityRepository;

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
    private EnrollmentRequestRepository enrollmentRequestRepository;

    @Mock
    private LearningEventPublisher eventPublisher;

    @Mock
    private TutorFollowRepository tutorFollowRepository;

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
        TutorSubjectRegistration approvedRegistration = approvedRegistration("Toán");
        when(registrationRepository.findByTutorEmailIgnoreCaseOrderByCreatedAtDesc("tutor@edu.vn"))
                .thenReturn(List.of(approvedRegistration));

        PostSummaryDto result = postService.createPost(request, tutorPrincipal, "Thầy Hưng", null);

        assertThat(result).isNotNull();
        assertThat(result.getTitle()).isEqualTo("Lớp ôn thi THPTQG Toán 12");
        assertThat(result.getAuthorRole()).isEqualTo("TUTOR");
        verify(postRepository).save(any(CommunityPost.class));
        verify(pollRepository).save(any(PostPoll.class));
        ArgumentCaptor<List<PostPollOption>> optionsCaptor = ArgumentCaptor.forClass(List.class);
        verify(pollOptionRepository).saveAll(optionsCaptor.capture());
        assertThat(optionsCaptor.getValue()).hasSize(21);
        assertThat(optionsCaptor.getValue())
                .extracting(PostPollOption::getTimePeriod)
                .contains(PollTimePeriod.MORNING, PollTimePeriod.AFTERNOON, PollTimePeriod.EVENING);
    }

    @Test
    void getClassSuggestion_CombinesVotesWithTutorNetAvailability() {
        CommunityPost post = new CommunityPost();
        post.setId(77L);
        post.setAuthorId(101L);
        post.setAuthorRole("TUTOR");
        post.setPostType(PostType.TUTOR_POLL);
        post.setStatus(PostStatus.OPEN);

        PostPoll poll = new PostPoll();
        poll.setId(88L);
        poll.setPost(post);
        poll.setSessionsPerWeek(2);
        poll.setDurationMinutes(90);
        poll.setTotalVotes(18);
        post.setPoll(poll);

        PostPollOption mondayMorning = pollOption(1L, poll, 1, PollTimePeriod.MORNING, 10);
        PostPollOption wednesdayAfternoon = pollOption(2L, poll, 3, PollTimePeriod.AFTERNOON, 8);

        when(postRepository.findById(77L)).thenReturn(Optional.of(post));
        when(pollOptionRepository.findByPollIdOrderByDayOfWeekAscStartTimeAsc(88L))
                .thenReturn(List.of(mondayMorning, wednesdayAfternoon));
        when(availabilityRepository.findByTutorEmailIgnoreCaseOrderByDayOfWeekAscStartTimeAsc("tutor@edu.vn"))
                .thenReturn(List.of(
                        new TutorAvailability("tutor@edu.vn", 2, "08:30", "11:30"),
                        new TutorAvailability("tutor@edu.vn", 4, "14:00", "17:00")
                ));
        when(classRoomRepository.findByTutorEmailWithDetails("tutor@edu.vn")).thenReturn(List.of());

        ClassSuggestionResponse result = postService.getClassSuggestion(77L, tutorPrincipal);

        assertThat(result.getRecommendedSchedules()).containsExactly(
                new ClassRoomDtos.ScheduleRequest(2, "08:30", "10:00"),
                new ClassRoomDtos.ScheduleRequest(4, "14:00", "15:30")
        );
        assertThat(result.getWarnings()).isEmpty();
        assertThat(result.getRankedDemand()).extracting(PollDemandDto::getVoteCount)
                .containsExactly(10, 8);
    }

    @Test
    void getClassSuggestion_PrefersScheduleASharedCohortCanAttend() {
        CommunityPost post = new CommunityPost();
        post.setId(77L);
        post.setAuthorId(101L);
        post.setPostType(PostType.TUTOR_POLL);
        post.setStatus(PostStatus.OPEN);

        PostPoll poll = new PostPoll();
        poll.setId(88L);
        poll.setPost(post);
        poll.setSessionsPerWeek(2);
        poll.setDurationMinutes(90);
        poll.setMinVotesTarget(5);
        poll.setTotalVotes(31);
        post.setPoll(poll);

        PostPollOption disjointTopOne = pollOption(1L, poll, 1, PollTimePeriod.MORNING, 10);
        PostPollOption disjointTopTwo = pollOption(2L, poll, 2, PollTimePeriod.MORNING, 9);
        PostPollOption sharedOne = pollOption(3L, poll, 3, PollTimePeriod.AFTERNOON, 6);
        PostPollOption sharedTwo = pollOption(4L, poll, 4, PollTimePeriod.AFTERNOON, 6);

        List<PostPollVote> votes = new ArrayList<>();
        for (long userId = 1; userId <= 10; userId++) votes.add(pollVote(poll, disjointTopOne, userId));
        for (long userId = 11; userId <= 19; userId++) votes.add(pollVote(poll, disjointTopTwo, userId));
        for (long userId = 20; userId <= 25; userId++) {
            votes.add(pollVote(poll, sharedOne, userId));
            votes.add(pollVote(poll, sharedTwo, userId));
        }

        when(postRepository.findById(77L)).thenReturn(Optional.of(post));
        when(pollOptionRepository.findByPollIdOrderByDayOfWeekAscStartTimeAsc(88L))
                .thenReturn(List.of(disjointTopOne, disjointTopTwo, sharedOne, sharedTwo));
        when(pollVoteRepository.findByPollId(88L)).thenReturn(votes);
        when(availabilityRepository.findByTutorEmailIgnoreCaseOrderByDayOfWeekAscStartTimeAsc("tutor@edu.vn"))
                .thenReturn(List.of(
                        new TutorAvailability("tutor@edu.vn", 2, "07:00", "12:00"),
                        new TutorAvailability("tutor@edu.vn", 3, "07:00", "12:00"),
                        new TutorAvailability("tutor@edu.vn", 4, "13:00", "17:00"),
                        new TutorAvailability("tutor@edu.vn", 5, "13:00", "17:00")
                ));
        when(classRoomRepository.findByTutorEmailWithDetails("tutor@edu.vn")).thenReturn(List.of());

        ClassSuggestionResponse result = postService.getClassSuggestion(77L, tutorPrincipal);

        assertThat(result.getRecommendedSchedules()).containsExactly(
                new ClassRoomDtos.ScheduleRequest(4, "13:00", "14:30"),
                new ClassRoomDtos.ScheduleRequest(5, "13:00", "14:30")
        );
        assertThat(result.getParticipantCount()).isEqualTo(25);
        assertThat(result.getMatchingStudentCount()).isEqualTo(6);
        assertThat(result.getSuggestedMaxStudents()).isEqualTo(6);
        assertThat(result.getWarnings()).isEmpty();
    }

    @Test
    void getClassSuggestion_RejectsTutorWhoDoesNotOwnPoll() {
        CommunityPost post = new CommunityPost();
        post.setId(77L);
        post.setAuthorId(999L);
        post.setPostType(PostType.TUTOR_POLL);
        post.setPoll(new PostPoll());
        when(postRepository.findById(77L)).thenReturn(Optional.of(post));

        assertThrows(ForbiddenException.class, () -> postService.getClassSuggestion(77L, tutorPrincipal));
        verifyNoInteractions(availabilityRepository);
    }

    @Test
    void createPost_TutorAnnouncement_UsesApprovedTeachingSubjectWithoutPoll() {
        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.TUTOR_ANNOUNCEMENT);
        request.setTitle("Thông báo ôn tập Hóa 10");
        request.setContent("Tuần này thầy sẽ mở buổi trao đổi lộ trình.");
        request.setSubjectId(5L);
        request.setEducationLevel("Lớp 10");

        Subject subject = new Subject();
        subject.setId(5L);
        subject.setName("Hóa học");
        subject.setActive(true);
        when(subjectRepository.findById(5L)).thenReturn(Optional.of(subject));

        CommunityPost savedPost = new CommunityPost();
        savedPost.setId(2L);
        savedPost.setAuthorId(101L);
        savedPost.setAuthorRole("TUTOR");
        savedPost.setTitle(request.getTitle());
        savedPost.setContent(request.getContent());
        savedPost.setPostType(PostType.TUTOR_ANNOUNCEMENT);
        savedPost.setStatus(PostStatus.OPEN);
        savedPost.setSubject(subject);
        savedPost.setEducationLevel("Lớp 10");
        when(postRepository.save(any(CommunityPost.class))).thenReturn(savedPost);

        PostSummaryDto result = postService.createPost(request, tutorPrincipal, "Thầy Hưng", null);

        assertThat(result.getPostType()).isEqualTo(PostType.TUTOR_ANNOUNCEMENT);
        assertThat(result.getSubjectName()).isEqualTo("Hóa học");
        verifyNoInteractions(pollRepository);
        verifyNoInteractions(registrationRepository);
    }

    @Test
    void createPost_TutorClassShare_LinksOwnedPublishedClass() {
        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.TUTOR_CLASS_SHARE);
        request.setTitle("Lớp Hóa 10 còn 3 chỗ");
        request.setContent("Các em có thể gửi yêu cầu tham gia trực tiếp.");
        request.setLinkedClassId(9L);

        ClassRoom classRoom = new ClassRoom();
        classRoom.setId(9L);
        classRoom.setName("Hóa 10 nền tảng");
        classRoom.setTutorEmail("tutor@edu.vn");
        classRoom.setStatus(iuh.fit.learning_service.enums.ClassRoomStatus.PUBLISHED);
        classRoom.setLearningMode(LearningMode.ONLINE);
        classRoom.setPricePerSession(BigDecimal.valueOf(180000));
        classRoom.setMaxStudents(20);
        classRoom.setTotalSessions(24);
        classRoom.setStartDate(LocalDate.now().plusDays(7));
        when(classRoomRepository.findByIdWithDetails(9L)).thenReturn(Optional.of(classRoom));

        CommunityPost savedPost = new CommunityPost();
        savedPost.setId(3L);
        savedPost.setAuthorId(101L);
        savedPost.setAuthorRole("TUTOR");
        savedPost.setTitle(request.getTitle());
        savedPost.setContent(request.getContent());
        savedPost.setPostType(PostType.TUTOR_CLASS_SHARE);
        savedPost.setStatus(PostStatus.OPEN);
        savedPost.setLinkedClass(classRoom);
        savedPost.setLearningMode(LearningMode.ONLINE);
        savedPost.setTargetPricePerSession(BigDecimal.valueOf(180000));
        when(postRepository.save(any(CommunityPost.class))).thenReturn(savedPost);

        PostSummaryDto result = postService.createPost(request, tutorPrincipal, "Thầy Hưng", null);

        assertThat(result.getPostType()).isEqualTo(PostType.TUTOR_CLASS_SHARE);
        assertThat(result.getLinkedClassId()).isEqualTo(9L);
        assertThat(result.getLinkedClassName()).isEqualTo("Hóa 10 nền tảng");
        assertThat(result.getLinkedClassAcceptingEnrollment()).isTrue();
        verifyNoInteractions(pollRepository);
    }

    @Test
    void createPost_TutorClassShare_RejectsLockedClass() {
        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.TUTOR_CLASS_SHARE);
        request.setTitle("Lớp đã khóa");
        request.setContent("Nội dung giới thiệu");
        request.setLinkedClassId(11L);

        ClassRoom lockedClass = new ClassRoom();
        lockedClass.setId(11L);
        lockedClass.setTutorEmail("tutor@edu.vn");
        lockedClass.setStatus(iuh.fit.learning_service.enums.ClassRoomStatus.LOCKED);
        lockedClass.setStartDate(LocalDate.now().plusDays(5));
        when(classRoomRepository.findByIdWithDetails(11L)).thenReturn(Optional.of(lockedClass));

        assertThrows(BadRequestException.class, () ->
                postService.createPost(request, tutorPrincipal, "Thầy Hưng", null));
        verify(postRepository, never()).save(any());
    }

    @Test
    void createPost_TutorClassShare_RejectsClassPastStartDate() {
        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.TUTOR_CLASS_SHARE);
        request.setTitle("Lớp đã qua ngày khai giảng");
        request.setContent("Nội dung giới thiệu");
        request.setLinkedClassId(12L);

        ClassRoom pastClass = new ClassRoom();
        pastClass.setId(12L);
        pastClass.setTutorEmail("tutor@edu.vn");
        pastClass.setStatus(iuh.fit.learning_service.enums.ClassRoomStatus.PUBLISHED);
        pastClass.setStartDate(LocalDate.now().minusDays(1)); // past start date
        when(classRoomRepository.findByIdWithDetails(12L)).thenReturn(Optional.of(pastClass));

        assertThrows(BadRequestException.class, () ->
                postService.createPost(request, tutorPrincipal, "Thầy Hưng", null));
        verify(postRepository, never()).save(any());
    }

    @Test
    void createPost_TutorClassShare_RejectsClassWithoutFutureStartDate() {
        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.TUTOR_CLASS_SHARE);
        request.setTitle("Lớp chưa có ngày khai giảng");
        request.setContent("Nội dung giới thiệu");
        request.setLinkedClassId(13L);

        ClassRoom classRoom = new ClassRoom();
        classRoom.setId(13L);
        classRoom.setTutorEmail("tutor@edu.vn");
        classRoom.setStatus(iuh.fit.learning_service.enums.ClassRoomStatus.PUBLISHED);
        when(classRoomRepository.findByIdWithDetails(13L)).thenReturn(Optional.of(classRoom));

        assertThrows(BadRequestException.class, () ->
                postService.createPost(request, tutorPrincipal, "Thầy Hưng", null));
        verify(postRepository, never()).save(any());
    }

    @Test
    void createPost_TutorClassShare_RejectsSubjectThatDoesNotMatchLinkedClass() {
        CreatePostRequest request = new CreatePostRequest();
        request.setPostType(PostType.TUTOR_CLASS_SHARE);
        request.setTitle("Lớp Hóa 10 còn chỗ");
        request.setContent("Các em có thể gửi yêu cầu tham gia trực tiếp.");
        request.setLinkedClassId(14L);
        request.setSubjectId(99L);

        Subject math = new Subject();
        math.setId(99L);
        math.setName("Toán");
        math.setActive(true);

        ClassRoom classRoom = new ClassRoom();
        classRoom.setId(14L);
        classRoom.setTutorEmail("tutor@edu.vn");
        classRoom.setStatus(iuh.fit.learning_service.enums.ClassRoomStatus.PUBLISHED);
        classRoom.setStartDate(LocalDate.now().plusDays(3));
        classRoom.setTutorSubjectRegistration(approvedRegistration("Hóa học"));

        when(classRoomRepository.findByIdWithDetails(14L)).thenReturn(Optional.of(classRoom));
        when(subjectRepository.findById(99L)).thenReturn(Optional.of(math));
        when(subjectRepository.findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(eq("Hóa học"), any(PageRequest.class)))
                .thenReturn(List.of());

        assertThrows(BadRequestException.class, () ->
                postService.createPost(request, tutorPrincipal, "Thầy Hưng", null));
        verify(postRepository, never()).save(any());
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
        when(pollVoteRepository.findByPollIdAndOptionIdAndUserId(pollId, optionId, studentPrincipal.userId())).thenReturn(Optional.empty());
        when(pollVoteRepository.findByPollIdAndUserId(pollId, studentPrincipal.userId())).thenReturn(List.of());

        PollSummaryDto result = postService.votePoll(pollId, optionId, studentPrincipal, "Học viên B");

        assertThat(result).isNotNull();
        assertThat(option.getVoteCount()).isEqualTo(2);
        assertThat(poll.getTotalVotes()).isEqualTo(3);
        verify(pollVoteRepository).save(any(PostPollVote.class));
    }

    @Test
    void votePoll_ToggleUnvote_Success() {
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
        option.setVoteCount(2);

        PostPollVote existingVote = new PostPollVote();
        existingVote.setId(101L);
        existingVote.setPoll(poll);
        existingVote.setOption(option);
        existingVote.setUserId(studentPrincipal.userId());

        when(pollRepository.findByIdForUpdate(pollId)).thenReturn(Optional.of(poll));
        when(pollOptionRepository.findById(optionId)).thenReturn(Optional.of(option));
        when(pollVoteRepository.findByPollIdAndOptionIdAndUserId(pollId, optionId, studentPrincipal.userId()))
                .thenReturn(Optional.of(existingVote));

        PollSummaryDto result = postService.votePoll(pollId, optionId, studentPrincipal, "Học viên B");

        assertThat(result).isNotNull();
        assertThat(option.getVoteCount()).isEqualTo(1);
        assertThat(poll.getTotalVotes()).isEqualTo(1);
        verify(pollVoteRepository).delete(existingVote);
    }

    @Test
    void votePoll_ExceedsMaxVotes_ThrowsBadRequest() {
        Long pollId = 10L;
        Long optionId = 55L;

        PostPoll poll = new PostPoll();
        poll.setId(pollId);
        poll.setMaxVotesPerUser(2);
        poll.setIsClosed(false);
        CommunityPost pollPost = new CommunityPost();
        pollPost.setStatus(PostStatus.OPEN);
        poll.setPost(pollPost);

        PostPollOption option = new PostPollOption();
        option.setId(optionId);
        option.setPoll(poll);

        when(pollRepository.findByIdForUpdate(pollId)).thenReturn(Optional.of(poll));
        when(pollOptionRepository.findById(optionId)).thenReturn(Optional.of(option));
        when(pollVoteRepository.findByPollIdAndOptionIdAndUserId(pollId, optionId, studentPrincipal.userId()))
                .thenReturn(Optional.empty());
        // Giả lập user đã vote 2 ca khác rồi
        when(pollVoteRepository.findByPollIdAndUserId(pollId, studentPrincipal.userId()))
                .thenReturn(List.of(new PostPollVote(), new PostPollVote()));

        assertThrows(BadRequestException.class, () ->
                postService.votePoll(pollId, optionId, studentPrincipal, "Học viên B"));
        verify(pollVoteRepository, never()).save(any());
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
        PostPoll poll = new PostPoll();
        poll.setPost(post);
        poll.setIsClosed(false);
        post.setPoll(poll);

        when(postRepository.findByIdForUpdate(postId)).thenReturn(Optional.of(post));

        postService.deletePost(postId, tutorPrincipal, false);

        assertThat(post.getStatus()).isEqualTo(PostStatus.HIDDEN);
        assertThat(poll.getIsClosed()).isTrue();
        verify(pollRepository).save(poll);
        verify(postRepository).save(post);
        verify(postRepository, never()).delete(any(CommunityPost.class));
        verify(realtimeEventHub).publishToAll(eq("COMMUNITY_POST_DELETED"), eq(postId), anyMap());
    }

    @Test
    void updatePollVotes_ReplacesSelectionsInOneTransaction() {
        Long pollId = 10L;
        CommunityPost post = new CommunityPost();
        post.setId(1L);
        post.setStatus(PostStatus.OPEN);

        PostPoll poll = new PostPoll();
        poll.setId(pollId);
        poll.setPost(post);
        poll.setIsClosed(false);
        poll.setMaxVotesPerUser(2);
        poll.setTotalVotes(4);

        PostPollOption oldOption = pollOption(1L, poll, 1, PollTimePeriod.MORNING, 3);
        PostPollOption newOptionOne = pollOption(2L, poll, 2, PollTimePeriod.AFTERNOON, 1);
        PostPollOption newOptionTwo = pollOption(3L, poll, 4, PollTimePeriod.EVENING, 0);
        PostPollVote oldVote = new PostPollVote();
        oldVote.setPoll(poll);
        oldVote.setOption(oldOption);
        oldVote.setUserId(studentPrincipal.userId());

        when(pollRepository.findByIdForUpdate(pollId)).thenReturn(Optional.of(poll));
        when(pollOptionRepository.findAllById(List.of(2L, 3L)))
                .thenReturn(List.of(newOptionOne, newOptionTwo));
        when(pollVoteRepository.findByPollIdAndUserId(pollId, studentPrincipal.userId()))
                .thenReturn(List.of(oldVote), List.of());
        when(pollOptionRepository.findByPollIdOrderByDayOfWeekAscStartTimeAsc(pollId))
                .thenReturn(List.of(oldOption, newOptionOne, newOptionTwo));

        PollSummaryDto result = postService.updatePollVotes(
                pollId,
                List.of(2L, 3L),
                studentPrincipal,
                "Học viên"
        );

        assertThat(result.getTotalVotes()).isEqualTo(5);
        assertThat(oldOption.getVoteCount()).isEqualTo(2);
        assertThat(newOptionOne.getVoteCount()).isEqualTo(2);
        assertThat(newOptionTwo.getVoteCount()).isEqualTo(1);
        verify(pollVoteRepository).deleteAll(List.of(oldVote));
        verify(pollVoteRepository).saveAll(argThat(votes -> {
            List<PostPollVote> saved = new ArrayList<>();
            votes.forEach(saved::add);
            return saved.size() == 2;
        }));
        verify(realtimeEventHub).publishToAll(eq("COMMUNITY_POLL_UPDATED"), eq(pollId), anyMap());
    }

    @Test
    void updatePollVotes_RejectsMoreThanConfiguredLimit() {
        PostPoll poll = new PostPoll();
        poll.setId(10L);
        poll.setPost(new CommunityPost());
        poll.getPost().setStatus(PostStatus.OPEN);
        poll.setIsClosed(false);
        poll.setMaxVotesPerUser(2);
        when(pollRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(poll));

        assertThrows(BadRequestException.class, () -> postService.updatePollVotes(
                10L,
                List.of(1L, 2L, 3L),
                studentPrincipal,
                "Học viên"
        ));

        verifyNoInteractions(pollOptionRepository);
        verifyNoInteractions(realtimeEventHub);
    }

    @Test
    void updatePollVotes_DoesNotWriteOrBroadcastWhenSelectionIsUnchanged() {
        PostPoll poll = new PostPoll();
        poll.setId(10L);
        poll.setPost(new CommunityPost());
        poll.getPost().setId(1L);
        poll.getPost().setStatus(PostStatus.OPEN);
        poll.setIsClosed(false);
        poll.setMaxVotesPerUser(2);
        poll.setTotalVotes(1);
        PostPollOption option = pollOption(2L, poll, 2, PollTimePeriod.AFTERNOON, 1);
        PostPollVote vote = new PostPollVote();
        vote.setPoll(poll);
        vote.setOption(option);
        vote.setUserId(studentPrincipal.userId());

        when(pollRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(poll));
        when(pollOptionRepository.findAllById(List.of(2L))).thenReturn(List.of(option));
        when(pollVoteRepository.findByPollIdAndUserId(10L, studentPrincipal.userId()))
                .thenReturn(List.of(vote));
        when(pollOptionRepository.findByPollIdOrderByDayOfWeekAscStartTimeAsc(10L))
                .thenReturn(List.of(option));

        PollSummaryDto result = postService.updatePollVotes(
                10L,
                List.of(2L),
                studentPrincipal,
                "Học viên"
        );

        assertThat(result.getUserVotedOptionIds()).containsExactly(2L);
        verify(pollRepository, never()).save(any());
        verify(pollVoteRepository, never()).saveAll(any());
        verify(pollVoteRepository, never()).deleteAll(any());
        verifyNoInteractions(realtimeEventHub);
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
        request.setSubjectId(5L);
        CreatePollRequest pollRequest = new CreatePollRequest();
        pollRequest.setQuestion("Chọn ca học");
        pollRequest.setMinVotesTarget(3);
        pollRequest.setOptions(List.of(
                new CreatePollOptionRequest(2, LocalTime.of(19, 0), LocalTime.of(20, 0), "Ca mới"),
                new CreatePollOptionRequest(3, LocalTime.of(19, 0), LocalTime.of(20, 0), "Ca khác")
        ));
        request.setPoll(pollRequest);

        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));
        Subject subject = new Subject();
        subject.setId(5L);
        subject.setName("Toán");
        subject.setActive(true);
        when(subjectRepository.findById(5L)).thenReturn(Optional.of(subject));
        when(registrationRepository.findByTutorEmailIgnoreCaseOrderByCreatedAtDesc("tutor@edu.vn"))
                .thenReturn(List.of(approvedRegistration("Toán")));
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
    void communityInteractions_RejectStaffRole() {
        LearningUserPrincipal staffPrincipal = new LearningUserPrincipal("staff@edu.vn", 303L, "STAFF");

        assertThrows(ForbiddenException.class, () ->
                postService.toggleLike(1L, staffPrincipal, "Staff Member", null));
        assertThrows(ForbiddenException.class, () ->
                postService.addComment(1L, "Nội dung phản hồi", staffPrincipal, "Staff Member", null, null, null, null));
        assertThrows(ForbiddenException.class, () ->
                postService.toggleBookmark(1L, staffPrincipal));

        verifyNoInteractions(postRepository, interactionRepository);
    }

    @Test
    void addComment_TutorCanReplyOnStudentPostWithNullLegacyCounter() {
        CommunityPost post = new CommunityPost();
        post.setId(1L);
        post.setAuthorId(studentPrincipal.userId());
        post.setAuthorRole("STUDENT");
        post.setStatus(PostStatus.OPEN);
        post.setCommentCount(null);
        String longAvatar = "https://cdn.example.com/avatar/" + "x".repeat(260);
        String longDisplayName = "Gia sư ".repeat(30);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));
        when(interactionRepository.save(any(PostInteraction.class))).thenAnswer(invocation -> {
            PostInteraction saved = invocation.getArgument(0);
            saved.setId(88L);
            return saved;
        });

        CommentDto result = postService.addComment(1L, "Gia sư có thể hỗ trợ lộ trình này.", tutorPrincipal, longDisplayName, longAvatar, 1L, "STUDENT", "Học viên A");

        assertThat(result.getUserRole()).isEqualTo("TUTOR");
        assertThat(result.getCommentText()).isEqualTo("Gia sư có thể hỗ trợ lộ trình này.");
        assertThat(result.getUserName()).hasSize(100);
        assertThat(result.getUserAvatar()).isNull();
        assertThat(post.getCommentCount()).isEqualTo(1);
        verify(postRepository).save(post);
    }

    @Test
    void toggleLike_StudentCanLikeTutorPostWithNullLegacyCounter() {
        CommunityPost post = new CommunityPost();
        post.setId(1L);
        post.setAuthorId(tutorPrincipal.userId());
        post.setAuthorRole("TUTOR");
        post.setStatus(PostStatus.OPEN);
        post.setLikeCount(null);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));
        when(interactionRepository.findByPostIdAndUserIdAndInteractionType(1L, studentPrincipal.userId(), InteractionType.LIKE))
                .thenReturn(Optional.empty());
        when(interactionRepository.save(any(PostInteraction.class))).thenAnswer(invocation -> invocation.getArgument(0));

        boolean liked = postService.toggleLike(1L, studentPrincipal, "Học viên A", null);

        assertThat(liked).isTrue();
        assertThat(post.getLikeCount()).isEqualTo(1);
        verify(postRepository).save(post);
    }

    @Test
    void getPostLikes_ReturnsLikeList() {
        CommunityPost post = new CommunityPost();
        post.setId(1L);
        post.setStatus(PostStatus.OPEN);
        when(postRepository.findById(1L)).thenReturn(Optional.of(post));

        PostInteraction like = new PostInteraction();
        like.setId(10L);
        like.setUserId(202L);
        like.setUserRole("STUDENT");
        like.setUserName("Nguyễn Văn A");
        like.setCreatedAt(java.time.LocalDateTime.now());
        when(interactionRepository.findByPostIdAndInteractionTypeOrderByCreatedAtDesc(1L, InteractionType.LIKE))
                .thenReturn(List.of(like));

        List<LikeUserDto> likes = postService.getPostLikes(1L);
        org.assertj.core.api.Assertions.assertThat(likes).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(likes.get(0).getUserName()).isEqualTo("Nguyễn Văn A");
        org.assertj.core.api.Assertions.assertThat(likes.get(0).getUserRole()).isEqualTo("STUDENT");
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
        poll.setSessionsPerWeek(2);
        post.setPoll(poll);

        PostPollOption option = new PostPollOption();
        option.setId(20L);
        option.setPoll(poll);
        option.setDayOfWeek(1);
        option.setStartTime(LocalTime.of(19, 30));
        option.setEndTime(LocalTime.of(21, 0));
        PostPollOption secondOption = new PostPollOption();
        secondOption.setId(21L);
        secondOption.setPoll(poll);
        secondOption.setDayOfWeek(3);
        secondOption.setStartTime(LocalTime.of(19, 30));
        secondOption.setEndTime(LocalTime.of(21, 0));

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
                .selectedOptionIds(List.of(20L, 21L))
                .maxStudents(15)
                .pricePerSession(BigDecimal.valueOf(200000))
                .startDate(LocalDate.now().plusWeeks(1))
                .build();

        when(postRepository.findByIdForUpdate(postId)).thenReturn(Optional.of(post));
        when(pollOptionRepository.findById(20L)).thenReturn(Optional.of(option));
        when(pollOptionRepository.findById(21L)).thenReturn(Optional.of(secondOption));
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
        assertThat(classRequestCaptor.getValue().sessionsPerWeek()).isEqualTo(2);
        assertThat(classRequestCaptor.getValue().schedules()).hasSize(2);
        assertThat(classRequestCaptor.getValue().schedules().get(1).dayOfWeek()).isEqualTo(4);
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
    void convertPostToClass_CustomSchedules_AfterSurveyClosedAndWithNewFrequency() {
        Long postId = 1L;
        CommunityPost post = new CommunityPost();
        post.setId(postId);
        post.setAuthorId(tutorPrincipal.userId());
        post.setPostType(PostType.TUTOR_POLL);
        post.setTitle("Lớp Luyện Thi");
        post.setContent("Mô tả chi tiết");
        post.setAuthorName("Thầy Hưng");
        post.setStatus(PostStatus.CLOSED);

        Subject subject = new Subject();
        subject.setId(10L);
        subject.setName("Hóa học");
        subject.setActive(true);
        post.setSubject(subject);
        post.setEducationLevel("Lớp 10");

        PostPoll poll = new PostPoll();
        poll.setId(10L);
        poll.setPost(post);
        poll.setIsClosed(true);
        poll.setExpiresAt(LocalDateTime.now().minusDays(1));
        poll.setSessionsPerWeek(2);
        post.setPoll(poll);

        when(postRepository.findByIdForUpdate(postId)).thenReturn(Optional.of(post));
        TutorSubjectRegistration reg = approvedRegistration("Hóa học", "Lớp 10");
        when(registrationRepository.findByTutorEmailIgnoreCaseOrderByCreatedAtDesc("tutor@edu.vn"))
                .thenReturn(List.of(reg));

        ClassRoom savedClass = new ClassRoom();
        savedClass.setId(99L);
        savedClass.setName("Lớp Luyện Thi");
        when(classRoomRepository.findById(99L)).thenReturn(Optional.of(savedClass));

        ClassRoomDtos.ClassRoomResponse mockClassResp = mock(ClassRoomDtos.ClassRoomResponse.class);
        when(mockClassResp.id()).thenReturn(99L);
        when(classRoomService.createClass(eq(tutorPrincipal.email()), any(ClassRoomDtos.CreateClassRoomRequest.class)))
                .thenReturn(mockClassResp);

        ConvertPostToClassRequest request = ConvertPostToClassRequest.builder()
                .sessionsPerWeek(1)
                .customSchedules(List.of(new ClassRoomDtos.ScheduleRequest(2, "19:00", "20:30")))
                .build();

        ClassCreatedFromPostResponse resp = postService.convertPostToClass(postId, request, tutorPrincipal, "Thầy Hưng");

        assertThat(resp).isNotNull();
        assertThat(resp.getClassId()).isEqualTo(99L);
        ArgumentCaptor<ClassRoomDtos.CreateClassRoomRequest> classRequestCaptor =
                ArgumentCaptor.forClass(ClassRoomDtos.CreateClassRoomRequest.class);
        verify(classRoomService).createClass(eq(tutorPrincipal.email()), classRequestCaptor.capture());
        assertThat(classRequestCaptor.getValue().sessionsPerWeek()).isEqualTo(1);
        assertThat(classRequestCaptor.getValue().schedules()).hasSize(1);
    }

    @Test
    void convertPostToClass_FullWizardRequest_ReusesClassRoomServiceAndLinksPost() {
        CommunityPost post = conversionPost(PostStatus.OPEN, false);
        post.setTitle("Khảo sát Hóa học");
        post.setAuthorName("Thầy Hưng");
        Subject subject = new Subject();
        subject.setName("Hóa học");
        post.setSubject(subject);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));

        TutorSubjectRegistration registration = approvedRegistration("Hóa học", "Lớp 10");
        when(registrationRepository.findByTutorEmailIgnoreCaseOrderByCreatedAtDesc("tutor@edu.vn"))
                .thenReturn(List.of(registration));
        when(levelRepository.findById(77L)).thenReturn(Optional.of(registration.getLevels().getFirst()));

        ClassRoomDtos.CreateClassRoomRequest classRequest = mock(ClassRoomDtos.CreateClassRoomRequest.class);
        when(classRequest.tutorSubjectRegistrationId()).thenReturn(50L);
        when(classRequest.levelId()).thenReturn(77L);
        ClassRoomDtos.ClassRoomResponse createdResponse = mock(ClassRoomDtos.ClassRoomResponse.class);
        when(createdResponse.id()).thenReturn(99L);
        when(classRoomService.createClass("tutor@edu.vn", classRequest)).thenReturn(createdResponse);
        ClassRoom savedClass = new ClassRoom();
        savedClass.setId(99L);
        savedClass.setName("Lớp Hóa 10");
        savedClass.setStatus(iuh.fit.learning_service.enums.ClassRoomStatus.PENDING_APPROVAL);
        when(classRoomRepository.findById(99L)).thenReturn(Optional.of(savedClass));
        when(pollVoteRepository.findByPollId(10L)).thenReturn(List.of());

        ClassCreatedFromPostResponse result = postService.convertPostToClass(
                1L,
                ConvertPostToClassRequest.builder().classRequest(classRequest).build(),
                tutorPrincipal,
                "Thầy Hưng"
        );

        assertThat(result.getClassId()).isEqualTo(99L);
        assertThat(post.getStatus()).isEqualTo(PostStatus.CONVERTED);
        assertThat(post.getLinkedClass()).isSameAs(savedClass);
        verify(classRoomService).createClass("tutor@edu.vn", classRequest);
    }

    @Test
    void convertPostToClass_RejectsFewerSlotsThanSessionsPerWeek() {
        CommunityPost post = conversionPost(PostStatus.OPEN, false);
        post.getPoll().setSessionsPerWeek(2);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));

        ConvertPostToClassRequest request = ConvertPostToClassRequest.builder()
                .selectedOptionIds(List.of(20L))
                .build();

        assertThrows(BadRequestException.class, () ->
                postService.convertPostToClass(1L, request, tutorPrincipal, "Gia sư"));
        verifyNoInteractions(classRoomService);
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
    void convertPostToClass_RejectsHiddenPost() {
        CommunityPost post = conversionPost(PostStatus.HIDDEN, true);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));

        assertThrows(ConflictException.class, () -> postService.convertPostToClass(
                1L, ConvertPostToClassRequest.builder().selectedOptionId(20L).build(), tutorPrincipal, "Gia sư"));
        verifyNoInteractions(classRoomService);
    }

    @Test
    void convertPostToClass_RejectsMalformedCustomTime() {
        CommunityPost post = conversionPost(PostStatus.OPEN, false);
        when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));

        ConvertPostToClassRequest request = ConvertPostToClassRequest.builder()
                .sessionsPerWeek(1)
                .customSchedules(List.of(new ClassRoomDtos.ScheduleRequest(2, "not-a-time", "20:30")))
                .build();

        assertThrows(BadRequestException.class, () ->
                postService.convertPostToClass(1L, request, tutorPrincipal, "Gia sư"));
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

    private PostPollOption pollOption(
            Long id,
            PostPoll poll,
            int dayOfWeek,
            PollTimePeriod period,
            int voteCount
    ) {
        PostPollOption option = new PostPollOption();
        option.setId(id);
        option.setPoll(poll);
        option.setDayOfWeek(dayOfWeek);
        option.setTimePeriod(period);
        option.setStartTime(period.getStart());
        option.setEndTime(period.getEndExclusive());
        option.setOptionLabel((dayOfWeek == 7 ? "Chủ nhật" : "Thứ " + (dayOfWeek + 1))
                + " - " + period.getLabel());
        option.setVoteCount(voteCount);
        return option;
    }

    private PostPollVote pollVote(PostPoll poll, PostPollOption option, Long userId) {
        PostPollVote vote = new PostPollVote();
        vote.setPoll(poll);
        vote.setOption(option);
        vote.setUserId(userId);
        vote.setUserName("Student " + userId);
        return vote;
    }

    private TutorSubjectRegistration approvedRegistration(String subjectName) {
        return approvedRegistration(subjectName, null);
    }

    private TutorSubjectRegistration approvedRegistration(String subjectName, String levelName) {
        TutorSubjectRegistration registration = new TutorSubjectRegistration();
        registration.setId(50L);
        registration.setStatus(TutorSubjectRegistrationStatus.APPROVED);
        registration.setTutorEmail("tutor@edu.vn");
        CatalogSubject catalogSubject = new CatalogSubject();
        catalogSubject.setId(15L);
        catalogSubject.setName(subjectName);
        catalogSubject.setActive(true);
        registration.setSubject(catalogSubject);
        if (levelName != null) {
            CatalogLevel level = new CatalogLevel();
            level.setId(77L);
            level.setName(levelName);
            level.setCode(levelName);
            level.setActive(true);
            registration.setLevels(List.of(level));
        }
        return registration;
    }

    @Test
    void searchPosts_WithFollowingOnly_EmptyWhenNoFollowedTutors() {
        when(tutorFollowRepository.findFollowedTutorUserIdsByStudentUserId(202L)).thenReturn(List.of());
        var result = postService.searchPosts(null, null, null, null, null, true, PageRequest.of(0, 10), 202L);
        assertThat(result.getContent()).isEmpty();
        verify(postRepository, never()).findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class));
    }

    @Test
    void searchPosts_MarksIsAuthorFollowed_WhenPostAuthorIsInFollowedList() {
        CommunityPost post = new CommunityPost();
        post.setId(10L);
        post.setTitle("Test bài viết gia sư");
        post.setContent("Nội dung bài viết");
        post.setAuthorId(101L);
        post.setAuthorRole("TUTOR");
        post.setAuthorName("Thầy Nguyễn Văn A");
        post.setPostType(PostType.TUTOR_ANNOUNCEMENT);
        post.setStatus(PostStatus.OPEN);

        when(tutorFollowRepository.findFollowedTutorUserIdsByStudentUserId(202L)).thenReturn(List.of(101L));
        when(postRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(post), PageRequest.of(0, 10), 1));

        var result = postService.searchPosts(null, null, null, null, null, false, PageRequest.of(0, 10), 202L);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getIsAuthorFollowed()).isTrue();
    }

    @Test
    void searchPosts_PrioritizesFollowedTutorPosts_InAllFeed() {
        CommunityPost post = new CommunityPost();
        post.setId(10L);
        post.setTitle("Tutor update");
        post.setContent("Content");
        post.setAuthorId(101L);
        post.setAuthorRole("TUTOR");
        post.setAuthorName("Tutor A");
        post.setPostType(PostType.TUTOR_ANNOUNCEMENT);
        post.setStatus(PostStatus.OPEN);

        when(tutorFollowRepository.findFollowedTutorUserIdsByStudentUserId(202L)).thenReturn(List.of(101L));
        when(postRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(post), PageRequest.of(0, 10), 1));

        postService.searchPosts(null, null, null, null, null, false,
                PageRequest.of(0, 10, org.springframework.data.domain.Sort.by("createdAt").descending()), 202L);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(postRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getSort().isUnsorted()).isTrue();
    }
}
