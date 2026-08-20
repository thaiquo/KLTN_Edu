package iuh.fit.account_service.service;

import iuh.fit.account_service.client.LearningTutorSubjectClient;
import iuh.fit.account_service.dto.learning.LearningTutorSubjectResponse;
import iuh.fit.account_service.dto.tutor.PublicTutorResponse;
import iuh.fit.account_service.dto.tutor.PublicTutorSubjectResponse;
import iuh.fit.account_service.dto.tutor.SubjectCategoryResponse;
import iuh.fit.account_service.dto.tutor.SubjectGroupResponse;
import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.TutorRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.stream.Collectors;

import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.repository.TutorApplicationRepository;

@Service
public class PublicTutorService {

    private static final int DEFAULT_LIMIT = 12;
    private static final int MAX_LIMIT = 50;

    private final TutorRepository tutorRepository;
    private final TutorApplicationRepository tutorApplicationRepository;
    private final LearningTutorSubjectClient learningTutorSubjectClient;

    public PublicTutorService(
            TutorRepository tutorRepository,
            TutorApplicationRepository tutorApplicationRepository,
            LearningTutorSubjectClient learningTutorSubjectClient
    ) {
        this.tutorRepository = tutorRepository;
        this.tutorApplicationRepository = tutorApplicationRepository;
        this.learningTutorSubjectClient = learningTutorSubjectClient;
    }

    @Transactional(readOnly = true)
    public List<PublicTutorResponse> searchTutors(
            String keyword,
            Long subjectId,
            BigDecimal minRate,
            BigDecimal maxRate,
            Integer limit
    ) {
        validateRateRange(minRate, maxRate);

        String normalizedKeyword = normalizeKeyword(keyword);
        PageRequest pageRequest = PageRequest.of(0, normalizeLimit(limit));
        List<Tutor> profiles = normalizedKeyword == null
                ? tutorRepository.findPublicTutors(pageRequest)
                : tutorRepository.findPublicTutorsByKeyword(normalizedKeyword, pageRequest);

        if (profiles.isEmpty()) {
            return List.of();
        }

        List<Long> profileIds = profiles.stream().map(Tutor::getId).toList();
        Map<Long, List<LearningTutorSubjectResponse>> subjectsByProfileId = learningTutorSubjectClient.getTutorSubjects(profileIds)
                .stream()
                .collect(Collectors.groupingBy(LearningTutorSubjectResponse::getTutorProfileId));

        return profiles.stream()
                .map(profile -> toResponse(
                        profile,
                        filterListSubjects(subjectsByProfileId.getOrDefault(profile.getId(), List.of()), subjectId, minRate, maxRate)
                ))
                .filter(response -> subjectId == null && minRate == null && maxRate == null
                        || !response.getSubjects().isEmpty())
                .toList();
    }

    @Transactional(readOnly = true)
    public PublicTutorResponse getTutor(Long tutorProfileId) {
        Tutor profile = tutorRepository.findById(tutorProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("Tutor profile not found"));

        TutorApplication app = tutorApplicationRepository.findByUserId(profile.getUser().getId()).orElse(null);
        if (app == null || app.getStatus() != TutorApplicationStatus.APPROVED) {
            throw new ResourceNotFoundException("Hồ sơ gia sư chưa được Ban quản trị phê duyệt");
        }

        List<LearningTutorSubjectResponse> subjects = learningTutorSubjectClient.getTutorSubjects(profile.getId());
        return toResponse(profile, subjects);
    }

    private List<LearningTutorSubjectResponse> filterListSubjects(
            List<LearningTutorSubjectResponse> subjects,
            Long subjectId,
            BigDecimal minRate,
            BigDecimal maxRate
    ) {
        return subjects.stream()
                .filter(subject -> subjectId == null || subject.getSubjectId().equals(subjectId))
                .filter(subject -> minRate == null || subject.getOneToOneHourlyRate().compareTo(minRate) >= 0)
                .filter(subject -> maxRate == null || subject.getOneToOneHourlyRate().compareTo(maxRate) <= 0)
                .toList();
    }

    private PublicTutorResponse toResponse(Tutor profile, List<LearningTutorSubjectResponse> subjects) {
        return new PublicTutorResponse(
                profile.getId(),
                profile.getUser().getId(),
                profile.getUser().getFullName(),
                profile.getBio() == null || profile.getBio().isBlank()
                        ? profile.getUser().getBio()
                        : profile.getBio(),
                subjects.stream().map(this::toSubjectResponse).toList(),
                profile.getCreatedAt()
        );
    }

    private PublicTutorSubjectResponse toSubjectResponse(LearningTutorSubjectResponse tutorSubject) {
        return new PublicTutorSubjectResponse(
                tutorSubject.getSubjectId(),
                tutorSubject.getSubjectName(),
                tutorSubject.getSubjectCategoryName() == null ? null : new SubjectCategoryResponse(null, tutorSubject.getSubjectCategoryName()),
                tutorSubject.getSubjectGroupName() == null ? null : new SubjectGroupResponse(null, tutorSubject.getSubjectGroupName(),
                        tutorSubject.getSubjectCategoryName() == null ? null : new SubjectCategoryResponse(null, tutorSubject.getSubjectCategoryName())),
                new LinkedHashSet<>(tutorSubject.getLevels()),
                tutorSubject.getOneToOneHourlyRate(),
                tutorSubject.getExperienceYears(),
                tutorSubject.getDescription()
        );
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null) {
            return null;
        }

        String trimmed = keyword.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null || limit < 1) {
            return DEFAULT_LIMIT;
        }

        return Math.min(limit, MAX_LIMIT);
    }

    private void validateRateRange(BigDecimal minRate, BigDecimal maxRate) {
        if (minRate != null && minRate.signum() < 0) {
            throw new BadRequestException("Minimum rate must not be negative");
        }

        if (maxRate != null && maxRate.signum() < 0) {
            throw new BadRequestException("Maximum rate must not be negative");
        }

        if (minRate != null && maxRate != null && minRate.compareTo(maxRate) > 0) {
            throw new BadRequestException("Minimum rate must be less than or equal to maximum rate");
        }
    }
}
