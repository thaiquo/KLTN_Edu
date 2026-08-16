package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.SubjectDtos;
import iuh.fit.learning_service.entity.Subject;
import iuh.fit.learning_service.entity.SubjectCategory;
import iuh.fit.learning_service.entity.SubjectGroup;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.SubjectCategoryRepository;
import iuh.fit.learning_service.repository.SubjectGroupRepository;
import iuh.fit.learning_service.repository.SubjectRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;

@Service
public class SubjectService {
    private static final int DEFAULT_LIMIT = 10;
    private static final int MAX_LIMIT = 50;

    private final SubjectRepository subjectRepository;
    private final SubjectCategoryRepository categoryRepository;
    private final SubjectGroupRepository groupRepository;

    public SubjectService(SubjectRepository subjectRepository, SubjectCategoryRepository categoryRepository, SubjectGroupRepository groupRepository) {
        this.subjectRepository = subjectRepository;
        this.categoryRepository = categoryRepository;
        this.groupRepository = groupRepository;
    }

    @Transactional(readOnly = true)
    public List<SubjectDtos.CategoryResponse> getCategories() {
        return categoryRepository.findAll().stream().map(this::toCategory).toList();
    }

    @Transactional(readOnly = true)
    public List<SubjectDtos.GroupResponse> getGroups(Long categoryId) {
        List<SubjectGroup> groups = categoryId == null
                ? groupRepository.findByActiveTrueOrderByNameAsc()
                : groupRepository.findByCategoryIdAndActiveTrueOrderByNameAsc(categoryId);
        return groups.stream().map(this::toGroup).toList();
    }

    @Transactional(readOnly = true)
    public List<SubjectDtos.SubjectResponse> getSubjects(Long categoryId, Long groupId, String keyword, Integer limit) {
        Pageable page = PageRequest.of(0, normalizeLimit(limit));
        String normalizedKeyword = normalizeKeyword(keyword);
        List<Subject> subjects;
        if (normalizedKeyword != null && groupId != null) {
            subjects = subjectRepository.findByGroupIdAndNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(groupId, normalizedKeyword, page);
        } else if (groupId != null) {
            subjects = subjectRepository.findByGroupIdAndActiveTrueOrderByNameAsc(groupId, page);
        } else if (normalizedKeyword != null && categoryId != null) {
            subjects = subjectRepository.findByCategoryIdAndNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(categoryId, normalizedKeyword, page);
        } else if (normalizedKeyword != null) {
            subjects = subjectRepository.findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(normalizedKeyword, page);
        } else if (categoryId != null) {
            subjects = subjectRepository.findByCategoryIdAndActiveTrueOrderByNameAsc(categoryId, page);
        } else {
            subjects = subjectRepository.findByActiveTrueOrderByNameAsc(page);
        }
        return subjects.stream().map(this::toSubject).toList();
    }

    @Transactional(readOnly = true)
    public SubjectDtos.SubjectResponse getActiveSubject(Long subjectId) {
        return subjectRepository.findByIdAndActiveTrue(subjectId)
                .map(this::toSubject)
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found"));
    }

    SubjectDtos.SubjectResponse toSubject(Subject subject) {
        return new SubjectDtos.SubjectResponse(
                subject.getId(),
                subject.getName(),
                toCategory(subject.getCategory()),
                subject.getGroup() == null ? null : toGroup(subject.getGroup()),
                new LinkedHashSet<>(subject.getSupportedLevels())
        );
    }

    SubjectDtos.CategoryResponse toCategory(SubjectCategory category) {
        return new SubjectDtos.CategoryResponse(category.getId(), category.getName());
    }

    SubjectDtos.GroupResponse toGroup(SubjectGroup group) {
        return new SubjectDtos.GroupResponse(group.getId(), group.getName(), toCategory(group.getCategory()));
    }

    private int normalizeLimit(Integer limit) {
        return limit == null || limit < 1 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null) return null;
        String trimmed = keyword.trim();
        return trimmed.isBlank() ? null : trimmed;
    }
}
