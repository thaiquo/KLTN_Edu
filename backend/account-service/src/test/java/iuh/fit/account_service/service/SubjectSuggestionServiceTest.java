package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.subjectsuggestion.MapSubjectSuggestionRequest;
import iuh.fit.account_service.dto.subjectsuggestion.RejectSubjectSuggestionRequest;
import iuh.fit.account_service.dto.subjectsuggestion.SubjectSuggestionRequest;
import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.SubjectCategory;
import iuh.fit.account_service.entity.SubjectGroup;
import iuh.fit.account_service.entity.SubjectSuggestion;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.SubjectSuggestionStatus;
import iuh.fit.account_service.enums.TeachingLevel;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.repository.SubjectCategoryRepository;
import iuh.fit.account_service.repository.SubjectGroupRepository;
import iuh.fit.account_service.repository.SubjectRepository;
import iuh.fit.account_service.repository.SubjectSuggestionRepository;
import iuh.fit.account_service.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SubjectSuggestionServiceTest {

    private final SubjectSuggestionRepository suggestionRepository = mock(SubjectSuggestionRepository.class);
    private final SubjectRepository subjectRepository = mock(SubjectRepository.class);
    private final SubjectCategoryRepository categoryRepository = mock(SubjectCategoryRepository.class);
    private final SubjectGroupRepository groupRepository = mock(SubjectGroupRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private SubjectSuggestionService service;
    private User user;
    private SubjectCategory category;
    private SubjectGroup group;

    @BeforeEach
    void setUp() {
        service = new SubjectSuggestionService(
                suggestionRepository,
                subjectRepository,
                categoryRepository,
                groupRepository,
                userRepository
        );
        user = user(7L, "student@example.com");
        category = category(1L, "Cong nghe");
        group = group(2L, "Ngon ngu lap trinh", category);

        when(userRepository.findByEmailIgnoreCase("student@example.com")).thenReturn(Optional.of(user));
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(category));
        when(groupRepository.findByIdAndActiveTrue(2L)).thenReturn(Optional.of(group));
    }

    @Test
    void createSuggestionStoresPendingWithLevels() {
        when(suggestionRepository.save(org.mockito.ArgumentMatchers.any(SubjectSuggestion.class)))
                .thenAnswer(invocation -> {
                    SubjectSuggestion suggestion = invocation.getArgument(0);
                    ReflectionTestUtils.setField(suggestion, "id", 20L);
                    return suggestion;
                });

        var response = service.createMySuggestion(" student@example.com ", request());

        assertThat(response.getId()).isEqualTo(20L);
        assertThat(response.getStatus()).isEqualTo(SubjectSuggestionStatus.PENDING);
        assertThat(response.getLevels()).containsExactly(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT);
        verify(suggestionRepository).save(org.mockito.ArgumentMatchers.any(SubjectSuggestion.class));
    }

    @Test
    void approveAsNewCreatesOfficialSubjectAndMarksSuggestionApproved() {
        SubjectSuggestion suggestion = suggestion(11L, SubjectSuggestionStatus.PENDING);
        when(suggestionRepository.findById(11L)).thenReturn(Optional.of(suggestion));
        when(subjectRepository.existsByNameIgnoreCaseAndCategoryId("Kotlin", 1L)).thenReturn(false);
        when(subjectRepository.save(org.mockito.ArgumentMatchers.any(Subject.class)))
                .thenAnswer(invocation -> {
                    Subject subject = invocation.getArgument(0);
                    subject.setId(99L);
                    return subject;
                });
        when(suggestionRepository.save(suggestion)).thenReturn(suggestion);

        var response = service.approveAsNew(11L, "student@example.com");

        assertThat(response.getStatus()).isEqualTo(SubjectSuggestionStatus.APPROVED);
        assertThat(response.getApprovedSubject().getName()).isEqualTo("Kotlin");
        verify(subjectRepository).save(org.mockito.ArgumentMatchers.argThat(subject ->
                subject.getSupportedLevels().containsAll(Set.of(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT))
        ));
    }

    @Test
    void approveAsNewRejectsDuplicateOfficialSubject() {
        SubjectSuggestion suggestion = suggestion(11L, SubjectSuggestionStatus.PENDING);
        when(suggestionRepository.findById(11L)).thenReturn(Optional.of(suggestion));
        when(subjectRepository.existsByNameIgnoreCaseAndCategoryId("Kotlin", 1L)).thenReturn(true);

        assertThatThrownBy(() -> service.approveAsNew(11L, "student@example.com"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Subject already exists in selected category");
    }

    @Test
    void mapExistingMarksSuggestionApprovedWithoutCreatingSubject() {
        SubjectSuggestion suggestion = suggestion(11L, SubjectSuggestionStatus.PENDING);
        Subject existing = new Subject();
        existing.setId(30L);
        existing.setName("Java");
        existing.setCategory(category);
        existing.setGroup(group);
        existing.setActive(true);
        existing.setSupportedLevels(Set.of(TeachingLevel.UNIVERSITY));
        when(suggestionRepository.findById(11L)).thenReturn(Optional.of(suggestion));
        when(subjectRepository.findById(30L)).thenReturn(Optional.of(existing));
        when(suggestionRepository.save(suggestion)).thenReturn(suggestion);
        MapSubjectSuggestionRequest request = new MapSubjectSuggestionRequest();
        request.setSubjectId(30L);

        var response = service.mapToExisting(11L, "student@example.com", request);

        assertThat(response.getStatus()).isEqualTo(SubjectSuggestionStatus.APPROVED);
        assertThat(response.getApprovedSubject().getName()).isEqualTo("Java");
    }

    @Test
    void rejectStoresReason() {
        SubjectSuggestion suggestion = suggestion(11L, SubjectSuggestionStatus.PENDING);
        when(suggestionRepository.findById(11L)).thenReturn(Optional.of(suggestion));
        when(suggestionRepository.save(suggestion)).thenReturn(suggestion);
        RejectSubjectSuggestionRequest request = new RejectSubjectSuggestionRequest();
        request.setReason("Already covered");

        var response = service.reject(11L, "student@example.com", request);

        assertThat(response.getStatus()).isEqualTo(SubjectSuggestionStatus.REJECTED);
        assertThat(response.getRejectionReason()).isEqualTo("Already covered");
    }

    private SubjectSuggestionRequest request() {
        SubjectSuggestionRequest request = new SubjectSuggestionRequest();
        request.setSuggestedName(" Kotlin ");
        request.setCategoryId(1L);
        request.setGroupId(2L);
        request.setLevels(new LinkedHashSet<>(List.of(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT)));
        return request;
    }

    private SubjectSuggestion suggestion(Long id, SubjectSuggestionStatus status) {
        SubjectSuggestion suggestion = new SubjectSuggestion();
        ReflectionTestUtils.setField(suggestion, "id", id);
        suggestion.setSuggestedBy(user);
        suggestion.setSuggestedName("Kotlin");
        suggestion.setCategory(category);
        suggestion.setGroup(group);
        suggestion.setLevels(Set.of(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT));
        suggestion.setStatus(status);
        return suggestion;
    }

    private User user(Long id, String email) {
        User nextUser = new User();
        ReflectionTestUtils.setField(nextUser, "id", id);
        nextUser.setEmail(email);
        nextUser.setFullName("Test User");
        nextUser.setPassword("hash");
        return nextUser;
    }

    private SubjectCategory category(Long id, String name) {
        SubjectCategory nextCategory = new SubjectCategory();
        nextCategory.setId(id);
        nextCategory.setName(name);
        return nextCategory;
    }

    private SubjectGroup group(Long id, String name, SubjectCategory category) {
        SubjectGroup nextGroup = new SubjectGroup();
        nextGroup.setId(id);
        nextGroup.setName(name);
        nextGroup.setCategory(category);
        nextGroup.setActive(true);
        return nextGroup;
    }
}
