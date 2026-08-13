package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.tutor.PublicTutorResponse;
import iuh.fit.account_service.dto.tutor.PublicTutorSubjectResponse;
import iuh.fit.account_service.dto.tutor.SubjectCategoryResponse;
import iuh.fit.account_service.dto.tutor.SubjectGroupResponse;
import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.TutorProfile;
import iuh.fit.account_service.entity.TutorSubject;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.TutorProfileRepository;
import iuh.fit.account_service.repository.TutorSubjectRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PublicTutorService {

    private static final int DEFAULT_LIMIT = 12;
    private static final int MAX_LIMIT = 50;

    private final TutorProfileRepository tutorProfileRepository;
    private final TutorSubjectRepository tutorSubjectRepository;

    public PublicTutorService(
            TutorProfileRepository tutorProfileRepository,
            TutorSubjectRepository tutorSubjectRepository
    ) {
        this.tutorProfileRepository = tutorProfileRepository;
        this.tutorSubjectRepository = tutorSubjectRepository;
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

        List<TutorProfile> profiles = tutorProfileRepository.searchPublicTutors(
                normalizeKeyword(keyword),
                subjectId,
                minRate,
                maxRate,
                PageRequest.of(0, normalizeLimit(limit))
        );

        if (profiles.isEmpty()) {
            return List.of();
        }

        List<Long> profileIds = profiles.stream().map(TutorProfile::getId).toList();
        Map<Long, List<TutorSubject>> subjectsByProfileId = tutorSubjectRepository.findActiveByTutorProfileIds(profileIds)
                .stream()
                .collect(Collectors.groupingBy(subject -> subject.getTutorProfile().getId()));

        return profiles.stream()
                .map(profile -> toResponse(
                        profile,
                        filterListSubjects(subjectsByProfileId.getOrDefault(profile.getId(), List.of()), subjectId, minRate, maxRate)
                ))
                .filter(response -> !response.getSubjects().isEmpty())
                .toList();
    }

    @Transactional(readOnly = true)
    public PublicTutorResponse getTutor(Long tutorProfileId) {
        TutorProfile profile = tutorProfileRepository.findByIdAndActiveTrue(tutorProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("Tutor profile not found"));

        List<TutorSubject> subjects = tutorSubjectRepository.findActiveByTutorProfileId(profile.getId());
        if (subjects.isEmpty()) {
            throw new ResourceNotFoundException("Tutor profile not found");
        }

        return toResponse(profile, subjects);
    }

    private List<TutorSubject> filterListSubjects(
            List<TutorSubject> subjects,
            Long subjectId,
            BigDecimal minRate,
            BigDecimal maxRate
    ) {
        return subjects.stream()
                .filter(subject -> subjectId == null || subject.getSubject().getId().equals(subjectId))
                .filter(subject -> minRate == null || subject.getOneToOneHourlyRate().compareTo(minRate) >= 0)
                .filter(subject -> maxRate == null || subject.getOneToOneHourlyRate().compareTo(maxRate) <= 0)
                .toList();
    }

    private PublicTutorResponse toResponse(TutorProfile profile, List<TutorSubject> subjects) {
        return new PublicTutorResponse(
                profile.getId(),
                profile.getUser().getId(),
                profile.getUser().getFullName(),
                profile.getBio(),
                subjects.stream().map(this::toSubjectResponse).toList(),
                profile.getCreatedAt()
        );
    }

    private PublicTutorSubjectResponse toSubjectResponse(TutorSubject tutorSubject) {
        Subject subject = tutorSubject.getSubject();
        return new PublicTutorSubjectResponse(
                subject.getId(),
                subject.getName(),
                new SubjectCategoryResponse(
                        subject.getCategory().getId(),
                        subject.getCategory().getName()
                ),
                subject.getGroup() == null ? null : new SubjectGroupResponse(
                        subject.getGroup().getId(),
                        subject.getGroup().getName(),
                        new SubjectCategoryResponse(
                                subject.getCategory().getId(),
                                subject.getCategory().getName()
                        )
                ),
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
