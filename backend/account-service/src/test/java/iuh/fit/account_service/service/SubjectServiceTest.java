package iuh.fit.account_service.service;

import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.SubjectCategory;
import iuh.fit.account_service.repository.SubjectCategoryRepository;
import iuh.fit.account_service.repository.SubjectGroupRepository;
import iuh.fit.account_service.repository.SubjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SubjectServiceTest {

    private final SubjectRepository subjectRepository = mock(SubjectRepository.class);
    private final SubjectCategoryRepository subjectCategoryRepository = mock(SubjectCategoryRepository.class);
    private final SubjectGroupRepository subjectGroupRepository = mock(SubjectGroupRepository.class);
    private SubjectService subjectService;

    @BeforeEach
    void setUp() {
        subjectService = new SubjectService(subjectRepository, subjectCategoryRepository, subjectGroupRepository);
    }

    @Test
    void searchKeywordTrimsInputAndReturnsActiveMatches() {
        Subject java = subject(3L, "Java", 2L, "Cong nghe thong tin", true);
        when(subjectRepository.findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                org.mockito.ArgumentMatchers.eq("java"),
                org.mockito.ArgumentMatchers.any(Pageable.class)
        )).thenReturn(List.of(java));

        var response = subjectService.getSubjects(null, null, " java ", 10);

        assertThat(response).hasSize(1);
        assertThat(response.get(0).getName()).isEqualTo("Java");
        assertThat(response.get(0).getCategory().getName()).isEqualTo("Cong nghe thong tin");
        verify(subjectRepository).findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                org.mockito.ArgumentMatchers.eq("java"),
                org.mockito.ArgumentMatchers.any(Pageable.class)
        );
    }

    @Test
    void searchIsCaseInsensitiveByRepositoryContract() {
        when(subjectRepository.findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                org.mockito.ArgumentMatchers.eq("JAVA"),
                org.mockito.ArgumentMatchers.any(Pageable.class)
        )).thenReturn(List.of(subject(3L, "Java", 2L, "Cong nghe thong tin", true)));

        var response = subjectService.getSubjects(null, null, "JAVA", 10);

        assertThat(response).extracting(item -> item.getName()).containsExactly("Java");
        verify(subjectRepository).findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                org.mockito.ArgumentMatchers.eq("JAVA"),
                org.mockito.ArgumentMatchers.any(Pageable.class)
        );
    }

    @Test
    void blankKeywordReturnsLimitedActiveSuggestions() {
        when(subjectRepository.findByActiveTrueOrderByNameAsc(org.mockito.ArgumentMatchers.any(Pageable.class)))
                .thenReturn(List.of(subject(3L, "Java", 2L, "Cong nghe thong tin", true)));

        var response = subjectService.getSubjects(null, null, "   ", null);

        assertThat(response).extracting(item -> item.getName()).containsExactly("Java");
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(subjectRepository).findByActiveTrueOrderByNameAsc(pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(10);
    }

    @Test
    void categoryFilterSearchesOnlyActiveSubjectsInCategory() {
        when(subjectRepository.findByCategoryIdAndNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                org.mockito.ArgumentMatchers.eq(2L),
                org.mockito.ArgumentMatchers.eq("java"),
                org.mockito.ArgumentMatchers.any(Pageable.class)
        )).thenReturn(List.of(subject(3L, "Java", 2L, "Cong nghe thong tin", true)));

        var response = subjectService.getSubjects(2L, null, "java", 10);

        assertThat(response).hasSize(1);
        assertThat(response.get(0).getCategory().getId()).isEqualTo(2L);
        verify(subjectRepository).findByCategoryIdAndNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                org.mockito.ArgumentMatchers.eq(2L),
                org.mockito.ArgumentMatchers.eq("java"),
                org.mockito.ArgumentMatchers.any(Pageable.class)
        );
    }

    @Test
    void categoryFilterWithoutKeywordReturnsLimitedActiveSubjectsInCategory() {
        when(subjectRepository.findByCategoryIdAndActiveTrueOrderByNameAsc(
                org.mockito.ArgumentMatchers.eq(2L),
                org.mockito.ArgumentMatchers.any(Pageable.class)
        )).thenReturn(List.of(subject(4L, "Spring Boot", 2L, "Cong nghe thong tin", true)));

        var response = subjectService.getSubjects(2L, null, null, 5);

        assertThat(response).extracting(item -> item.getName()).containsExactly("Spring Boot");
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(subjectRepository).findByCategoryIdAndActiveTrueOrderByNameAsc(
                org.mockito.ArgumentMatchers.eq(2L),
                pageableCaptor.capture()
        );
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(5);
    }

    @Test
    void limitIsClampedToMaximumTwenty() {
        when(subjectRepository.findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                org.mockito.ArgumentMatchers.eq("java"),
                org.mockito.ArgumentMatchers.any(Pageable.class)
        )).thenReturn(List.of());

        subjectService.getSubjects(null, null, "java", 100000);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(subjectRepository).findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                org.mockito.ArgumentMatchers.eq("java"),
                pageableCaptor.capture()
        );
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(20);
    }

    @Test
    void nonPositiveLimitFallsBackToDefault() {
        when(subjectRepository.findByActiveTrueOrderByNameAsc(org.mockito.ArgumentMatchers.any(Pageable.class)))
                .thenReturn(List.of());

        subjectService.getSubjects(null, null, null, 0);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(subjectRepository).findByActiveTrueOrderByNameAsc(pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(10);
    }

    private Subject subject(Long id, String name, Long categoryId, String categoryName, boolean active) {
        SubjectCategory category = new SubjectCategory();
        category.setId(categoryId);
        category.setName(categoryName);

        Subject subject = new Subject();
        subject.setId(id);
        subject.setName(name);
        subject.setCategory(category);
        subject.setActive(active);
        return subject;
    }
}
