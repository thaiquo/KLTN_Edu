package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.TeachingCatalogDtos;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TeachingCatalogService {
    private final ProgramTypeRepository programTypes;
    private final EducationLevelRepository educationLevels;
    private final CatalogCategoryRepository categories;
    private final CatalogSubjectRepository subjects;
    private final CatalogLevelRepository levels;

    public TeachingCatalogService(ProgramTypeRepository programTypes, EducationLevelRepository educationLevels,
                                  CatalogCategoryRepository categories, CatalogSubjectRepository subjects,
                                  CatalogLevelRepository levels) {
        this.programTypes = programTypes;
        this.educationLevels = educationLevels;
        this.categories = categories;
        this.subjects = subjects;
        this.levels = levels;
    }

    @Transactional(readOnly = true)
    public List<TeachingCatalogDtos.Option> programTypes() {
        return programTypes.findByActiveTrueOrderByOrderIndexAscNameAsc().stream().map(this::option).toList();
    }

    @Transactional(readOnly = true)
    public List<TeachingCatalogDtos.Option> educationLevels() {
        return educationLevels.findByActiveTrueOrderByOrderIndexAscNameAsc().stream().map(this::option).toList();
    }

    @Transactional(readOnly = true)
    public List<TeachingCatalogDtos.CategoryOption> categories(Long programTypeId, Long educationLevelId) {
        List<CatalogCategory> result = educationLevelId == null
                ? categories.findByProgramTypeIdAndEducationLevelIsNullAndActiveTrueOrderByOrderIndexAscNameAsc(programTypeId)
                : categories.findByProgramTypeIdAndEducationLevelIdAndActiveTrueOrderByOrderIndexAscNameAsc(programTypeId, educationLevelId);
        return result.stream().map(this::category).toList();
    }

    @Transactional(readOnly = true)
    public List<TeachingCatalogDtos.SubjectOption> subjects(Long categoryId) {
        return subjects.findByCategoryIdAndActiveTrueOrderByOrderIndexAscNameAsc(categoryId).stream().map(this::subject).toList();
    }

    @Transactional(readOnly = true)
    public List<TeachingCatalogDtos.LevelOption> levels(Long subjectId) {
        return levels.findBySubjectIdAndActiveTrueOrderByOrderIndexAscNameAsc(subjectId).stream().map(this::level).toList();
    }

    @Transactional(readOnly = true)
    public TeachingCatalogDtos.GroundingCatalogSnapshot groundingSnapshot() {
        List<CatalogSubject> activeSubjects = subjects.findActiveGroundingSubjects();
        if (activeSubjects.isEmpty()) {
            return new TeachingCatalogDtos.GroundingCatalogSnapshot(List.of());
        }
        List<Long> subjectIds = activeSubjects.stream().map(CatalogSubject::getId).toList();
        Map<Long, List<TeachingCatalogDtos.LevelOption>> levelsBySubject = levels
                .findBySubject_IdInAndActiveTrueOrderByOrderIndexAscNameAsc(subjectIds)
                .stream()
                .collect(Collectors.groupingBy(
                        value -> value.getSubject().getId(),
                        Collectors.collectingAndThen(Collectors.toList(), values -> values.stream()
                                .sorted(Comparator
                                        .comparing((CatalogLevel value) -> value.getOrderIndex() == null ? 0 : value.getOrderIndex())
                                        .thenComparing(CatalogLevel::getName))
                                .map(this::level)
                                .toList())
                ));
        return new TeachingCatalogDtos.GroundingCatalogSnapshot(activeSubjects.stream()
                .map(subject -> new TeachingCatalogDtos.GroundingSubjectOption(
                        subject.getId(),
                        subject.getCode(),
                        subject.getName(),
                        subject.getDescription(),
                        category(subject.getCategory()),
                        levelsBySubject.getOrDefault(subject.getId(), List.of())
                ))
                .toList());
    }

    TeachingCatalogDtos.Option option(ProgramType value) { return new TeachingCatalogDtos.Option(value.getId(), value.getCode(), value.getName(), value.getDescription()); }
    TeachingCatalogDtos.Option option(EducationLevel value) { return value == null ? null : new TeachingCatalogDtos.Option(value.getId(), value.getCode(), value.getName(), value.getDescription()); }
    TeachingCatalogDtos.CategoryOption category(CatalogCategory value) { return new TeachingCatalogDtos.CategoryOption(value.getId(), value.getCode(), value.getName(), option(value.getProgramType()), option(value.getEducationLevel())); }
    TeachingCatalogDtos.SubjectOption subject(CatalogSubject value) { return new TeachingCatalogDtos.SubjectOption(value.getId(), value.getCode(), value.getName(), value.getDescription(), category(value.getCategory())); }
    TeachingCatalogDtos.LevelOption level(CatalogLevel value) { return new TeachingCatalogDtos.LevelOption(value.getId(), value.getCode(), value.getName(), value.getType(), value.getDescription()); }
}
