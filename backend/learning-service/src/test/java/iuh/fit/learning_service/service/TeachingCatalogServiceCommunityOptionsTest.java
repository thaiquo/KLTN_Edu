package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.CatalogCategory;
import iuh.fit.learning_service.entity.CatalogLevel;
import iuh.fit.learning_service.entity.CatalogSubject;
import iuh.fit.learning_service.repository.CatalogCategoryRepository;
import iuh.fit.learning_service.repository.CatalogLevelRepository;
import iuh.fit.learning_service.repository.CatalogSubjectRepository;
import iuh.fit.learning_service.repository.EducationLevelRepository;
import iuh.fit.learning_service.repository.ProgramTypeRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TeachingCatalogServiceCommunityOptionsTest {

    private final ProgramTypeRepository programTypes = mock(ProgramTypeRepository.class);
    private final EducationLevelRepository educationLevels = mock(EducationLevelRepository.class);
    private final CatalogCategoryRepository categories = mock(CatalogCategoryRepository.class);
    private final CatalogSubjectRepository subjects = mock(CatalogSubjectRepository.class);
    private final CatalogLevelRepository levels = mock(CatalogLevelRepository.class);
    private final TeachingCatalogService service = new TeachingCatalogService(
            programTypes, educationLevels, categories, subjects, levels);

    @Test
    void communityOptionsReturnsEveryActiveSubjectWithOnlyItsActiveLevels() {
        CatalogCategory mathCategory = new CatalogCategory();
        mathCategory.setName("Toán và tư duy");
        CatalogSubject math = subject(10L, "Toán", mathCategory);
        CatalogSubject physics = subject(20L, "Vật lý", mathCategory);
        CatalogLevel grade11 = level(11L, "Lớp 11", math);
        CatalogLevel grade12 = level(21L, "Lớp 12", physics);
        when(subjects.findActiveGroundingSubjects()).thenReturn(List.of(math, physics));
        when(levels.findBySubject_IdInAndActiveTrueOrderByOrderIndexAscNameAsc(List.of(10L, 20L)))
                .thenReturn(List.of(grade11, grade12));

        var result = service.communityOptions();

        assertThat(result.subjects()).hasSize(2);
        assertThat(result.subjects().getFirst().levels()).extracting("id").containsExactly(11L);
        assertThat(result.subjects().get(1).levels()).extracting("id").containsExactly(21L);
        assertThat(result.subjects()).extracting("name").doesNotHaveDuplicates();
        verify(subjects).findActiveGroundingSubjects();
    }

    @Test
    void communityOptionsReturnsStableEmptyPayloadWhenCatalogIsEmpty() {
        when(subjects.findActiveGroundingSubjects()).thenReturn(List.of());

        assertThat(service.communityOptions().subjects()).isEmpty();
    }

    private CatalogSubject subject(Long id, String name, CatalogCategory category) {
        CatalogSubject subject = new CatalogSubject();
        subject.setId(id);
        subject.setName(name);
        subject.setCategory(category);
        subject.setActive(true);
        return subject;
    }

    private CatalogLevel level(Long id, String name, CatalogSubject subject) {
        CatalogLevel level = new CatalogLevel();
        level.setId(id);
        level.setName(name);
        level.setSubject(subject);
        level.setActive(true);
        return level;
    }
}
