package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.subjectsuggestion.MapSubjectSuggestionRequest;
import iuh.fit.account_service.dto.subjectsuggestion.RejectSubjectSuggestionRequest;
import iuh.fit.account_service.dto.subjectsuggestion.SubjectSuggestionRequest;
import iuh.fit.account_service.dto.subjectsuggestion.SubjectSuggestionResponse;
import iuh.fit.account_service.dto.tutor.SubjectCategoryResponse;
import iuh.fit.account_service.dto.tutor.SubjectGroupResponse;
import iuh.fit.account_service.dto.tutor.SubjectResponse;
import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.SubjectCategory;
import iuh.fit.account_service.entity.SubjectGroup;
import iuh.fit.account_service.entity.SubjectSuggestion;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.SubjectSuggestionStatus;
import iuh.fit.account_service.enums.TeachingLevel;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.SubjectCategoryRepository;
import iuh.fit.account_service.repository.SubjectGroupRepository;
import iuh.fit.account_service.repository.SubjectRepository;
import iuh.fit.account_service.repository.SubjectSuggestionRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.util.EmailNormalizer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class SubjectSuggestionService {

    private final SubjectSuggestionRepository suggestionRepository;
    private final SubjectRepository subjectRepository;
    private final SubjectCategoryRepository categoryRepository;
    private final SubjectGroupRepository groupRepository;
    private final UserRepository userRepository;

    public SubjectSuggestionService(
            SubjectSuggestionRepository suggestionRepository,
            SubjectRepository subjectRepository,
            SubjectCategoryRepository categoryRepository,
            SubjectGroupRepository groupRepository,
            UserRepository userRepository
    ) {
        this.suggestionRepository = suggestionRepository;
        this.subjectRepository = subjectRepository;
        this.categoryRepository = categoryRepository;
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public SubjectSuggestionResponse createMySuggestion(String email, SubjectSuggestionRequest request) {
        User user = getUser(email);
        SubjectCategory category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Subject category not found"));
        SubjectGroup group = groupRepository.findByIdAndActiveTrue(request.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("Subject group not found"));
        if (!group.getCategory().getId().equals(category.getId())) {
            throw new BadRequestException("Subject group does not belong to selected category");
        }

        Set<TeachingLevel> levels = normalizeLevels(request.getLevels());

        SubjectSuggestion suggestion = new SubjectSuggestion();
        suggestion.setSuggestedBy(user);
        suggestion.setSuggestedName(requiredText(request.getSuggestedName(), "Suggested subject name is required"));
        suggestion.setCategory(category);
        suggestion.setGroup(group);
        suggestion.setLevels(levels);
        suggestion.setNote(normalize(request.getNote()));
        suggestion.setStatus(SubjectSuggestionStatus.PENDING);

        return toResponse(suggestionRepository.save(suggestion));
    }

    @Transactional(readOnly = true)
    public List<SubjectSuggestionResponse> listMySuggestions(String email) {
        User user = getUser(email);
        return suggestionRepository.findBySuggestedBy_IdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SubjectSuggestionResponse> listPendingSuggestions() {
        return suggestionRepository.findByStatusOrderByCreatedAtAsc(SubjectSuggestionStatus.PENDING)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public SubjectSuggestionResponse approveAsNew(Long suggestionId, String reviewerEmail) {
        SubjectSuggestion suggestion = getPendingSuggestion(suggestionId);
        User reviewer = getUser(reviewerEmail);
        if (subjectRepository.existsByNameIgnoreCaseAndCategoryId(
                suggestion.getSuggestedName(),
                suggestion.getCategory().getId()
        )) {
            throw new ConflictException("Subject already exists in selected category");
        }

        Subject subject = new Subject();
        subject.setName(suggestion.getSuggestedName());
        subject.setCategory(suggestion.getCategory());
        subject.setGroup(suggestion.getGroup());
        subject.setActive(true);
        subject.setSupportedLevels(new LinkedHashSet<>(suggestion.getLevels()));
        subject = subjectRepository.save(subject);

        markApproved(suggestion, reviewer, subject);
        return toResponse(suggestionRepository.save(suggestion));
    }

    @Transactional
    public SubjectSuggestionResponse mapToExisting(Long suggestionId, String reviewerEmail, MapSubjectSuggestionRequest request) {
        SubjectSuggestion suggestion = getPendingSuggestion(suggestionId);
        User reviewer = getUser(reviewerEmail);
        Subject subject = subjectRepository.findById(request.getSubjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found"));
        if (!subject.isActive()) {
            throw new BadRequestException("Subject is inactive");
        }

        markApproved(suggestion, reviewer, subject);
        return toResponse(suggestionRepository.save(suggestion));
    }

    @Transactional
    public SubjectSuggestionResponse reject(Long suggestionId, String reviewerEmail, RejectSubjectSuggestionRequest request) {
        SubjectSuggestion suggestion = getPendingSuggestion(suggestionId);
        User reviewer = getUser(reviewerEmail);

        suggestion.setStatus(SubjectSuggestionStatus.REJECTED);
        suggestion.setReviewedBy(reviewer);
        suggestion.setReviewedAt(LocalDateTime.now());
        suggestion.setRejectionReason(requiredText(request.getReason(), "Rejection reason is required"));

        return toResponse(suggestionRepository.save(suggestion));
    }

    private void markApproved(SubjectSuggestion suggestion, User reviewer, Subject subject) {
        suggestion.setStatus(SubjectSuggestionStatus.APPROVED);
        suggestion.setReviewedBy(reviewer);
        suggestion.setReviewedAt(LocalDateTime.now());
        suggestion.setApprovedSubject(subject);
        suggestion.setRejectionReason(null);
    }

    private SubjectSuggestion getPendingSuggestion(Long suggestionId) {
        SubjectSuggestion suggestion = suggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new ResourceNotFoundException("Subject suggestion not found"));
        if (suggestion.getStatus() != SubjectSuggestionStatus.PENDING) {
            throw new ConflictException("Subject suggestion has already been processed");
        }
        return suggestion;
    }

    private User getUser(String email) {
        return userRepository.findByEmailIgnoreCase(EmailNormalizer.normalize(email))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private Set<TeachingLevel> normalizeLevels(Set<TeachingLevel> levels) {
        if (levels == null || levels.isEmpty()) {
            throw new BadRequestException("At least one teaching level is required");
        }
        return new LinkedHashSet<>(levels);
    }

    private String requiredText(String value, String message) {
        String normalized = normalize(value);
        if (!StringUtils.hasText(normalized)) {
            throw new BadRequestException(message);
        }
        return normalized;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private SubjectSuggestionResponse toResponse(SubjectSuggestion suggestion) {
        return new SubjectSuggestionResponse(
                suggestion.getId(),
                suggestion.getSuggestedName(),
                toCategoryResponse(suggestion.getCategory()),
                toGroupResponse(suggestion.getGroup()),
                new LinkedHashSet<>(suggestion.getLevels()),
                suggestion.getNote(),
                suggestion.getStatus(),
                suggestion.getApprovedSubject() == null ? null : toSubjectResponse(suggestion.getApprovedSubject()),
                suggestion.getReviewedBy() == null ? null : suggestion.getReviewedBy().getFullName(),
                suggestion.getReviewedAt(),
                suggestion.getRejectionReason(),
                suggestion.getCreatedAt(),
                suggestion.getUpdatedAt()
        );
    }

    private SubjectResponse toSubjectResponse(Subject subject) {
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
        return new SubjectGroupResponse(group.getId(), group.getName(), toCategoryResponse(group.getCategory()));
    }
}
