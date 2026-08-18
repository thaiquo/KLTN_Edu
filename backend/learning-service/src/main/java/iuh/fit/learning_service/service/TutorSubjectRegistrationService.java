package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.TeachingCatalogDtos;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;

@Service
public class TutorSubjectRegistrationService {
    private static final Set<TutorSubjectRegistrationStatus> ACTIVE_STATUSES = Set.of(
            TutorSubjectRegistrationStatus.DRAFT,
            TutorSubjectRegistrationStatus.PENDING,
            TutorSubjectRegistrationStatus.APPROVED
    );

    private final TutorSubjectRegistrationRepository registrations;
    private final CatalogSubjectRepository subjects;
    private final CatalogLevelRepository levels;
    private final TeachingCatalogService catalogMapper;

    public TutorSubjectRegistrationService(TutorSubjectRegistrationRepository registrations,
                                           CatalogSubjectRepository subjects,
                                           CatalogLevelRepository levels,
                                           TeachingCatalogService catalogMapper) {
        this.registrations = registrations;
        this.subjects = subjects;
        this.levels = levels;
        this.catalogMapper = catalogMapper;
    }

    @Transactional(readOnly = true)
    public List<TeachingCatalogDtos.RegistrationResponse> mine(String tutorEmail) {
        return registrations.findByTutorEmailIgnoreCaseOrderByCreatedAtDesc(tutorEmail).stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public List<TeachingCatalogDtos.RegistrationResponse> pending() {
        return registrations.findByStatusOrderBySubmittedAtAsc(TutorSubjectRegistrationStatus.PENDING).stream().map(this::response).toList();
    }

    @Transactional
    public TeachingCatalogDtos.RegistrationResponse create(String tutorEmail, TeachingCatalogDtos.CreateRegistrationRequest request) {
        return createBatch(tutorEmail, new TeachingCatalogDtos.CreateRegistrationBatchRequest(
                request.subjectId(), List.of(request.levelId()), request.experienceYears(), request.tuitionMin(),
                request.tuitionMax(), request.description(), request.evidence()
        ));
    }

    @Transactional
    public TeachingCatalogDtos.RegistrationResponse createBatch(
            String tutorEmail, TeachingCatalogDtos.CreateRegistrationBatchRequest request) {
        LinkedHashSet<Long> uniqueLevelIds = new LinkedHashSet<>(request.levelIds());
        if (uniqueLevelIds.size() != request.levelIds().size()) {
            throw new BadRequestException("Level list contains duplicate values");
        }

        CatalogSubject subject = subjects.findByIdAndActiveTrue(request.subjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found or inactive"));
        List<CatalogLevel> selectedLevels = new ArrayList<>(levels.findAllById(uniqueLevelIds));
        if (selectedLevels.size() != uniqueLevelIds.size()
                || selectedLevels.stream().anyMatch(level -> !level.isActive())) {
            throw new ResourceNotFoundException("One or more levels were not found or are inactive");
        }
        if (selectedLevels.stream().anyMatch(level -> !level.getSubject().getId().equals(subject.getId()))) {
            throw new BadRequestException("All selected levels must belong to the selected subject");
        }

        CatalogCategory category = subject.getCategory();
        validateCatalogBranch(category);
        if (request.tuitionMin().compareTo(request.tuitionMax()) > 0) {
            throw new BadRequestException("Minimum tuition must not exceed maximum tuition");
        }
        validateEvidenceCount(request.evidence());
        if (registrations.existsActiveLevelOverlap(
                tutorEmail, subject.getId(), uniqueLevelIds, ACTIVE_STATUSES)) {
            throw new ConflictException("You already have an active registration for one or more selected levels");
        }

        TutorSubjectRegistration registration = new TutorSubjectRegistration();
        registration.setTutorEmail(tutorEmail.trim().toLowerCase());
        registration.setProgramType(category.getProgramType());
        registration.setEducationLevel(category.getEducationLevel());
        registration.setCategory(category);
        registration.setSubject(subject);
        registration.getLevels().addAll(selectedLevels);
        registration.setExperienceYears(request.experienceYears());
        registration.setTuitionMin(request.tuitionMin());
        registration.setTuitionMax(request.tuitionMax());
        registration.setDescription(request.description().trim());
        registration.setStatus(TutorSubjectRegistrationStatus.PENDING);
        registration.setSubmittedAt(LocalDateTime.now());

        for (TeachingCatalogDtos.EvidenceRequest input : request.evidence()) {
            if (input.accountDocumentId() == null && (input.fileUrl() == null || input.fileUrl().isBlank())) {
                throw new BadRequestException("Evidence must reference an uploaded document or URL");
            }
            RegistrationEvidence evidence = new RegistrationEvidence();
            evidence.setRegistration(registration);
            evidence.setEvidenceType(input.evidenceType());
            evidence.setTitle(input.title().trim());
            evidence.setAccountDocumentId(input.accountDocumentId());
            evidence.setFileUrl(normalize(input.fileUrl()));
            registration.getEvidence().add(evidence);
        }

        try {
            return response(registrations.save(registration));
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Could not create the teaching registration");
        }
    }

    @Transactional
    public TeachingCatalogDtos.RegistrationResponse approve(Long id, String reviewerEmail, TeachingCatalogDtos.ReviewRequest request) {
        TutorSubjectRegistration registration = pending(id);
        registration.setStatus(TutorSubjectRegistrationStatus.APPROVED);
        registration.setReviewedAt(LocalDateTime.now());
        registration.setReviewedByEmail(reviewerEmail);
        registration.setReviewNote(request == null ? null : normalize(request.note()));
        registration.setRejectReason(null);
        return response(registrations.save(registration));
    }

    @Transactional
    public TeachingCatalogDtos.RegistrationResponse reject(Long id, String reviewerEmail, TeachingCatalogDtos.RejectRequest request) {
        TutorSubjectRegistration registration = pending(id);
        registration.setStatus(TutorSubjectRegistrationStatus.REJECTED);
        registration.setReviewedAt(LocalDateTime.now());
        registration.setReviewedByEmail(reviewerEmail);
        registration.setRejectReason(request.reason().trim());
        registration.setReviewNote(normalize(request.note()));
        return response(registrations.save(registration));
    }

    private TutorSubjectRegistration pending(Long id) {
        TutorSubjectRegistration registration = registrations.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Teaching registration not found"));
        if (registration.getStatus() != TutorSubjectRegistrationStatus.PENDING) {
            throw new ConflictException("Teaching registration has already been processed");
        }
        return registration;
    }

    private void validateCatalogBranch(CatalogCategory category) {
        String code = category.getProgramType().getCode();
        if ("ACADEMIC".equals(code) && category.getEducationLevel() == null) {
            throw new BadRequestException("Academic category requires an education level");
        }
        if ("SKILL".equals(code) && category.getEducationLevel() != null) {
            throw new BadRequestException("Skill category must not have an education level");
        }
    }

    private void validateEvidenceCount(List<TeachingCatalogDtos.EvidenceRequest> evidence) {
        if (evidence == null || evidence.isEmpty()) {
            throw new BadRequestException("At least one evidence document is required");
        }
        if (evidence.size() > 5) {
            throw new BadRequestException("A teaching registration can include at most 5 evidence documents");
        }
    }

    private TeachingCatalogDtos.RegistrationResponse response(TutorSubjectRegistration value) {
        return new TeachingCatalogDtos.RegistrationResponse(
                value.getId(), value.getTutorEmail(), value.getTutorProfileId(),
                catalogMapper.option(value.getProgramType()), catalogMapper.option(value.getEducationLevel()),
                catalogMapper.category(value.getCategory()), catalogMapper.subject(value.getSubject()),
                value.getLevels().stream().map(catalogMapper::level).toList(), value.getExperienceYears(), value.getTuitionMin(),
                value.getTuitionMax(), value.getDescription(), value.getStatus(), value.getRejectReason(),
                value.getReviewNote(), value.getSubmittedAt(), value.getReviewedAt(), value.getReviewedByEmail(),
                value.getEvidence().stream().map(item -> new TeachingCatalogDtos.EvidenceResponse(
                        item.getId(), item.getEvidenceType(), item.getTitle(), item.getAccountDocumentId(), item.getFileUrl()
                )).toList()
        );
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
