package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.tutor.SubjectCategoryResponse;
import iuh.fit.account_service.dto.tutor.SubjectGroupResponse;
import iuh.fit.account_service.dto.tutor.SubjectResponse;
import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.SubjectCategory;
import iuh.fit.account_service.entity.SubjectGroup;
import iuh.fit.account_service.repository.SubjectCategoryRepository;
import iuh.fit.account_service.repository.SubjectGroupRepository;
import iuh.fit.account_service.repository.SubjectRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.LinkedHashSet;

@Service
public class SubjectService {

    private static final int DEFAULT_LIMIT = 10;
    private static final int MAX_LIMIT = 20;

    private final SubjectRepository subjectRepository;
    private final SubjectCategoryRepository subjectCategoryRepository;
    private final SubjectGroupRepository subjectGroupRepository;

    public SubjectService(
            SubjectRepository subjectRepository,
            SubjectCategoryRepository subjectCategoryRepository,
            SubjectGroupRepository subjectGroupRepository
    ) {
        this.subjectRepository = subjectRepository;
        this.subjectCategoryRepository = subjectCategoryRepository;
        this.subjectGroupRepository = subjectGroupRepository;
    }

    public List<SubjectCategoryResponse> getCategories() {
        return subjectCategoryRepository.findAll()
                .stream()
                .map(this::toCategoryResponse)
                .toList();
    }

    public List<SubjectGroupResponse> getGroups(Long categoryId) {
        List<SubjectGroup> groups = categoryId == null
                ? subjectGroupRepository.findByActiveTrueOrderByNameAsc()
                : subjectGroupRepository.findByCategoryIdAndActiveTrueOrderByNameAsc(categoryId);

        return groups.stream().map(this::toGroupResponse).toList();
    }

    public List<SubjectResponse> getSubjects(Long categoryId, Long groupId, String keyword, Integer limit) {
        List<Subject> subjects;
        Pageable page = PageRequest.of(0, normalizeLimit(limit));
        String normalizedKeyword = normalizeKeyword(keyword);

        if (normalizedKeyword != null && groupId != null) {
            subjects = subjectRepository.findByGroupIdAndNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                    groupId,
                    normalizedKeyword,
                    page
            );
        } else if (groupId != null) {
            subjects = subjectRepository.findByGroupIdAndActiveTrueOrderByNameAsc(groupId, page);
        } else if (normalizedKeyword != null && categoryId != null) {
            subjects = subjectRepository.findByCategoryIdAndNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                    categoryId,
                    normalizedKeyword,
                    page
            );
        } else if (normalizedKeyword != null) {
            subjects = subjectRepository.findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(normalizedKeyword, page);
        } else if (categoryId != null) {
            subjects = subjectRepository.findByCategoryIdAndActiveTrueOrderByNameAsc(categoryId, page);
        } else {
            subjects = subjectRepository.findByActiveTrueOrderByNameAsc(page);
        }

        return subjects.stream().map(this::toResponse).toList();
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }

        if (limit < 1) {
            return DEFAULT_LIMIT;
        }

        return Math.min(limit, MAX_LIMIT);
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null) {
            return null;
        }

        String trimmed = keyword.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private SubjectResponse toResponse(Subject subject) {
        return new SubjectResponse(
                subject.getId(),
                subject.getName(),
                toCategoryResponse(subject.getCategory()),
                subject.getGroup() == null ? null : toGroupResponse(subject.getGroup()),
                new LinkedHashSet<>(subject.getSupportedLevels())
        );
    }

    private SubjectCategoryResponse toCategoryResponse(SubjectCategory category) {
        return new SubjectCategoryResponse(category.getId(), category.getName());
    }

    private SubjectGroupResponse toGroupResponse(SubjectGroup group) {
        return new SubjectGroupResponse(
                group.getId(),
                group.getName(),
                toCategoryResponse(group.getCategory())
        );
    }
}
