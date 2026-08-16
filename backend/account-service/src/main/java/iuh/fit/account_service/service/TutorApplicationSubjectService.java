package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.tutorapplication.TutorApplicationSubjectRequest;
import iuh.fit.account_service.dto.tutorapplication.TutorApplicationSubjectResponse;
import iuh.fit.account_service.dto.tutorapplication.UpdateTutorApplicationSubjectRequest;
import iuh.fit.account_service.dto.learning.LearningSubjectResponse;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.TutorApplicationSubject;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorApplicationSubjectRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.util.EmailNormalizer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;

@Service
public class TutorApplicationSubjectService {

    private final TutorApplicationRepository tutorApplicationRepository;
    private final TutorApplicationSubjectRepository tutorApplicationSubjectRepository;
    private final LearningSubjectLookupService learningSubjectLookupService;
    private final UserRepository userRepository;

    public TutorApplicationSubjectService(
            TutorApplicationRepository tutorApplicationRepository,
            TutorApplicationSubjectRepository tutorApplicationSubjectRepository,
            LearningSubjectLookupService learningSubjectLookupService,
            UserRepository userRepository
    ) {
        this.tutorApplicationRepository = tutorApplicationRepository;
        this.tutorApplicationSubjectRepository = tutorApplicationSubjectRepository;
        this.learningSubjectLookupService = learningSubjectLookupService;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<TutorApplicationSubjectResponse> listMySubjects(String email) {
        TutorApplication application = getCurrentApplication(email);

        return tutorApplicationSubjectRepository
                .findByTutorApplication_IdOrderByCreatedAtAsc(application.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TutorApplicationSubjectResponse addSubject(
            String email,
            TutorApplicationSubjectRequest request
    ) {
        TutorApplication application = getCurrentApplication(email);
        assertEditable(application);

        LearningSubjectResponse subject = learningSubjectLookupService.getActiveSubject(request.getSubjectId());
        if (tutorApplicationSubjectRepository.existsByTutorApplication_IdAndSubjectId(
                application.getId(),
                subject.getId()
        )) {
            throw new ConflictException("Subject already exists in tutor application");
        }

        TutorApplicationSubject applicationSubject = new TutorApplicationSubject();
        applicationSubject.setTutorApplication(application);
        applySubjectSnapshot(applicationSubject, subject);
        applyMetadata(
                applicationSubject,
                subject,
                request.getLevels(),
                request.getOneToOneHourlyRate(),
                request.getExperienceYears(),
                request.getDescription()
        );

        return toResponse(tutorApplicationSubjectRepository.save(applicationSubject));
    }

    @Transactional
    public TutorApplicationSubjectResponse updateSubject(
            String email,
            Long applicationSubjectId,
            UpdateTutorApplicationSubjectRequest request
    ) {
        TutorApplication application = getCurrentApplication(email);
        assertEditable(application);

        TutorApplicationSubject applicationSubject = tutorApplicationSubjectRepository
                .findByIdAndTutorApplication_Id(applicationSubjectId, application.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Tutor application subject not found"));

        applyMetadata(
                applicationSubject,
                learningSubjectLookupService.getActiveSubject(applicationSubject.getSubjectId()),
                request.getLevels(),
                request.getOneToOneHourlyRate(),
                request.getExperienceYears(),
                request.getDescription()
        );

        return toResponse(tutorApplicationSubjectRepository.save(applicationSubject));
    }

    @Transactional
    public void deleteSubject(String email, Long applicationSubjectId) {
        TutorApplication application = getCurrentApplication(email);
        assertEditable(application);

        TutorApplicationSubject applicationSubject = tutorApplicationSubjectRepository
                .findByIdAndTutorApplication_Id(applicationSubjectId, application.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Tutor application subject not found"));

        tutorApplicationSubjectRepository.delete(applicationSubject);
    }

    private TutorApplication getCurrentApplication(String email) {
        User user = getCurrentUser(email);
        return tutorApplicationRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Tutor application not found"));
    }

    private User getCurrentUser(String email) {
        String normalizedEmail = EmailNormalizer.normalize(email);
        return userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private void assertEditable(TutorApplication application) {
        if (application.getStatus() == TutorApplicationStatus.DRAFT
                || application.getStatus() == TutorApplicationStatus.REJECTED) {
            return;
        }

        throw new ConflictException("Tutor application is not editable in current status");
    }

    private void applyMetadata(
            TutorApplicationSubject applicationSubject,
            LearningSubjectResponse subject,
            Set<String> levels,
            java.math.BigDecimal oneToOneHourlyRate,
            Integer experienceYears,
            String description
    ) {
        applicationSubject.setLevels(validateLevels(subject, levels));
        applicationSubject.setOneToOneHourlyRate(oneToOneHourlyRate);
        applicationSubject.setExperienceYears(experienceYears);
        applicationSubject.setDescription(normalizeBlankToNull(description));
    }

    private Set<String> validateLevels(LearningSubjectResponse subject, Set<String> requestedLevels) {
        if (requestedLevels == null || requestedLevels.isEmpty()) {
            throw new BadRequestException("At least one teaching level is required");
        }

        Set<String> normalizedLevels = requestedLevels.stream()
                .filter(java.util.Objects::nonNull)
                .map(String::trim)
                .filter(level -> !level.isBlank())
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        Set<String> supportedLevels = subject.getSupportedLevels();
        if (supportedLevels == null || supportedLevels.isEmpty()) {
            throw new BadRequestException("Subject does not support teaching levels");
        }

        if (!supportedLevels.containsAll(normalizedLevels)) {
            throw new BadRequestException("One or more teaching levels are not supported by this subject");
        }

        return normalizedLevels;
    }

    private String normalizeBlankToNull(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private TutorApplicationSubjectResponse toResponse(TutorApplicationSubject applicationSubject) {
        return new TutorApplicationSubjectResponse(
                applicationSubject.getId(),
                new TutorApplicationSubjectResponse.SubjectSummary(
                        applicationSubject.getSubjectId(),
                        applicationSubject.getSubjectName(),
                        applicationSubject.getSubjectCategoryName(),
                        applicationSubject.getSubjectGroupName(),
                        new LinkedHashSet<>(applicationSubject.getLevels())
                ),
                new LinkedHashSet<>(applicationSubject.getLevels()),
                applicationSubject.getOneToOneHourlyRate(),
                applicationSubject.getExperienceYears(),
                applicationSubject.getDescription(),
                applicationSubject.getCreatedAt(),
                applicationSubject.getUpdatedAt()
        );
    }

    private void applySubjectSnapshot(TutorApplicationSubject applicationSubject, LearningSubjectResponse subject) {
        applicationSubject.setSubjectId(subject.getId());
        applicationSubject.setSubjectName(subject.getName());
        applicationSubject.setSubjectCategoryName(subject.getCategory() == null ? null : subject.getCategory().getName());
        applicationSubject.setSubjectGroupName(subject.getGroup() == null ? null : subject.getGroup().getName());
    }
}
