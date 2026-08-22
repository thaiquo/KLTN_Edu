package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.TeachingCatalogDtos;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus;
import iuh.fit.learning_service.enums.LevelType;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TutorSubjectRegistrationService {
    private static final Set<Integer> PRIMARY_GRADES = Set.of(1, 2, 3, 4, 5);
    private static final Set<Integer> SECONDARY_GRADES = Set.of(6, 7, 8, 9);
    private static final Set<Integer> HIGH_SCHOOL_GRADES = Set.of(10, 11, 12);
    private static final Pattern GRADE_NUMBER_PATTERN = Pattern.compile("\\b(\\d{1,2})\\b");
    private static final Set<TutorSubjectRegistrationStatus> ACTIVE_STATUSES = Set.of(
            TutorSubjectRegistrationStatus.DRAFT,
            TutorSubjectRegistrationStatus.PENDING,
            TutorSubjectRegistrationStatus.APPROVED
    );

    private final TutorSubjectRegistrationRepository registrations;
    private final CatalogSubjectRepository subjects;
    private final CatalogLevelRepository levels;
    private final CatalogCategoryRepository categories;
    private final TeachingCatalogService catalogMapper;
    private final TutorIdentityLookup tutorIdentityLookup;

    public TutorSubjectRegistrationService(TutorSubjectRegistrationRepository registrations,
                                           CatalogSubjectRepository subjects,
                                           CatalogLevelRepository levels,
                                           CatalogCategoryRepository categories,
                                           TeachingCatalogService catalogMapper,
                                           TutorIdentityLookup tutorIdentityLookup) {
        this.registrations = registrations;
        this.subjects = subjects;
        this.levels = levels;
        this.categories = categories;
        this.catalogMapper = catalogMapper;
        this.tutorIdentityLookup = tutorIdentityLookup;
    }

    @Transactional(readOnly = true)
    public List<TeachingCatalogDtos.RegistrationResponse> mine(String tutorEmail) {
        return registrations.findByTutorEmailIgnoreCaseOrderByCreatedAtDesc(tutorEmail).stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public List<TeachingCatalogDtos.RegistrationResponse> pending(boolean includeProposals) {
        return registrations.findByStatusOrderBySubmittedAtAsc(TutorSubjectRegistrationStatus.PENDING).stream()
                .filter(registration -> includeProposals || registration.getSubject() != null)
                .map(this::response)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TeachingCatalogDtos.RegistrationResponse> history(boolean includeProposals) {
        return registrations.findByStatusInOrderByReviewedAtDesc(List.of(
                TutorSubjectRegistrationStatus.APPROVED,
                TutorSubjectRegistrationStatus.REJECTED
        )).stream()
                .filter(registration -> includeProposals || registration.getProposedSubjectName() == null)
                .map(this::response)
                .toList();
    }

    @Transactional
    public TeachingCatalogDtos.RegistrationResponse create(String tutorEmail, TeachingCatalogDtos.CreateRegistrationRequest request) {
        return createBatch(tutorEmail, new TeachingCatalogDtos.CreateRegistrationBatchRequest(
                request.subjectId(), List.of(request.levelId()), request.experienceYears(), request.tuitionMin(),
                request.tuitionMax(), request.description(), request.evidence(),
                null, null, null, null, null, null
        ));
    }

    @Transactional
    public TeachingCatalogDtos.RegistrationResponse createBatch(
            String tutorEmail, TeachingCatalogDtos.CreateRegistrationBatchRequest request) {
        
        CatalogCategory category;
        CatalogSubject subject = null;
        List<CatalogLevel> selectedLevels = new ArrayList<>();
        List<ProposedRegistrationLevel> proposedLevels = List.of();

        if (request.subjectId() == null) {
            // PROPOSAL FLOW
            if (request.categoryId() == null) {
                throw new BadRequestException("Category ID is required for a new subject proposal");
            }
            if (request.proposedSubjectName() == null || request.proposedSubjectName().isBlank()) {
                throw new BadRequestException("Proposed subject name is required");
            }
            category = categories.findById(request.categoryId())
                    .filter(CatalogCategory::isActive)
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found or inactive"));

            proposedLevels = standardizeProposedLevels(category, resolveProposedLevels(request));
            validateProposedLevels(category, proposedLevels);

            // Check if proposed subject already exists in this category
            if (subjects.existsByCategoryIdAndNameIgnoreCase(category.getId(), request.proposedSubjectName().trim())) {
                throw new ConflictException("Môn học đề xuất này đã tồn tại trong danh mục, vui lòng đăng ký chọn trực tiếp từ danh mục.");
            }
        } else {
            // STANDARD FLOW
            subject = subjects.findByIdAndActiveTrue(request.subjectId())
                    .orElseThrow(() -> new ResourceNotFoundException("Subject not found or inactive"));

            if (request.levelIds() == null || request.levelIds().isEmpty()) {
                throw new BadRequestException("Level IDs are required for a standard subject registration");
            }
            LinkedHashSet<Long> uniqueLevelIds = new LinkedHashSet<>(request.levelIds());
            if (uniqueLevelIds.size() != request.levelIds().size()) {
                throw new BadRequestException("Level list contains duplicate values");
            }

            selectedLevels = new ArrayList<>(levels.findAllById(uniqueLevelIds));
            if (selectedLevels.size() != uniqueLevelIds.size()
                    || selectedLevels.stream().anyMatch(level -> !level.isActive())) {
                throw new ResourceNotFoundException("One or more levels were not found or are inactive");
            }
            final CatalogSubject finalSubject = subject;
            if (selectedLevels.stream().anyMatch(level -> !level.getSubject().getId().equals(finalSubject.getId()))) {
                throw new BadRequestException("All selected levels must belong to the selected subject");
            }

            category = subject.getCategory();

            if (registrations.existsActiveLevelOverlap(
                    tutorEmail, subject.getId(), uniqueLevelIds, ACTIVE_STATUSES)) {
                throw new ConflictException("You already have an active registration for one or more selected levels");
            }
        }

        validateCatalogBranch(category);
        if (request.tuitionMin().compareTo(request.tuitionMax()) > 0) {
            throw new BadRequestException("Minimum tuition must not exceed maximum tuition");
        }
        validateEvidenceCount(request.evidence());

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

        if (request.subjectId() == null) {
            registration.setProposedSubjectName(request.proposedSubjectName().trim());
            registration.getProposedLevels().addAll(proposedLevels);
            registration.setProposedNote(normalize(request.proposedNote()));
        }

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
    public TeachingCatalogDtos.RegistrationResponse approve(Long id, String reviewerEmail,
                                                             TeachingCatalogDtos.ReviewRequest request,
                                                             boolean isAdmin) {
        TutorSubjectRegistration registration = pending(id);

        requireAdminForProposal(registration, isAdmin);

        if (registration.getSubject() == null) {
            // PROPOSAL APPROVAL: Create Subject & Level
            CatalogCategory category = registration.getCategory();
            if (subjects.existsByCategoryIdAndNameIgnoreCase(category.getId(), registration.getProposedSubjectName())) {
                throw new ConflictException("Môn học đề xuất đã tồn tại trong danh mục này. Vui lòng từ chối đề xuất này và yêu cầu gia sư đăng ký trực tiếp.");
            }

            CatalogSubject subject = new CatalogSubject();
            subject.setCategory(category);
            subject.setName(registration.getProposedSubjectName());

            int nextSubjectOrder = subjects.findByCategoryIdOrderByOrderIndexAscNameAsc(category.getId()).stream()
                    .mapToInt(CatalogSubject::getOrderIndex)
                    .max()
                    .orElse(0) + 1;

            subject.setCode(uniqueCode(registration.getProposedSubjectName(), id));
            subject.setActive(true);
            subject.setOrderIndex(nextSubjectOrder);
            subject = subjects.save(subject);

            registration.setSubject(subject);
            List<ProposedRegistrationLevel> proposedLevels = standardizeProposedLevels(category, effectiveProposedLevels(registration));
            validateProposedLevels(category, proposedLevels);
            for (int index = 0; index < proposedLevels.size(); index++) {
                ProposedRegistrationLevel proposedLevel = proposedLevels.get(index);
                CatalogLevel level = new CatalogLevel();
                level.setSubject(subject);
                level.setName(proposedLevel.getName());
                level.setCode(proposedLevel.getCode() == null ? uniqueCode(proposedLevel.getName(), id) : proposedLevel.getCode());
                level.setType(proposedLevel.getType());
                level.setActive(true);
                level.setOrderIndex(index + 1);
                registration.getLevels().add(levels.save(level));
            }
        }

        registration.setStatus(TutorSubjectRegistrationStatus.APPROVED);
        registration.setReviewedAt(LocalDateTime.now());
        registration.setReviewedByEmail(reviewerEmail);
        registration.setReviewNote(request == null ? null : normalize(request.note()));
        registration.setRejectReason(null);
        return response(registrations.save(registration));
    }

    @Transactional
    public TeachingCatalogDtos.RegistrationResponse reject(Long id, String reviewerEmail,
                                                            TeachingCatalogDtos.RejectRequest request,
                                                            boolean isAdmin) {
        TutorSubjectRegistration registration = pending(id);
        requireAdminForProposal(registration, isAdmin);
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

    private void requireAdminForProposal(TutorSubjectRegistration registration, boolean isAdmin) {
        if (registration.getSubject() == null && !isAdmin) {
            throw new AccessDeniedException("Only admins can review new subject proposals");
        }
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

    private List<String> proposalLevelNames(String rawValue, LevelType type) {
        if (rawValue == null) return List.of();
        String trimmedValue = rawValue.trim();
        if (type != LevelType.GRADE) {
            return trimmedValue.isBlank() ? List.of() : List.of(trimmedValue);
        }
        List<String> names = java.util.Arrays.stream(rawValue.split(","))
                .map(String::trim)
                .filter(name -> !name.isBlank())
                .distinct()
                .toList();
        if (names.isEmpty() || names.size() > 12) {
            throw new BadRequestException("A proposal must contain between 1 and 12 levels");
        }
        return names;
    }

    private List<ProposedRegistrationLevel> resolveProposedLevels(TeachingCatalogDtos.CreateRegistrationBatchRequest request) {
        if (request.proposedLevels() != null && !request.proposedLevels().isEmpty()) {
            List<ProposedRegistrationLevel> result = request.proposedLevels().stream().map(input -> {
                ProposedRegistrationLevel level = new ProposedRegistrationLevel();
                level.setCode(normalizeProposalCode(input.code()));
                level.setName(input.name().trim());
                level.setType(input.type());
                return level;
            }).toList();
            validateProposalLevelUniqueness(result);
            return result;
        }
        if (request.proposedLevelName() == null || request.proposedLevelName().isBlank() || request.proposedLevelType() == null) {
            throw new BadRequestException("At least one structured proposed level is required");
        }
        List<ProposedRegistrationLevel> legacyLevels = proposalLevelNames(request.proposedLevelName(), request.proposedLevelType()).stream()
                .map(name -> {
                    ProposedRegistrationLevel level = new ProposedRegistrationLevel();
                    level.setName(name);
                    level.setType(request.proposedLevelType());
                    return level;
                }).toList();
        validateProposalLevelUniqueness(legacyLevels);
        return legacyLevels;
    }

    private List<ProposedRegistrationLevel> effectiveProposedLevels(TutorSubjectRegistration registration) {
        return registration.getProposedLevels() == null ? List.of() : List.copyOf(registration.getProposedLevels());
    }

    private List<ProposedRegistrationLevel> standardizeProposedLevels(CatalogCategory category, List<ProposedRegistrationLevel> proposedLevels) {
        return proposedLevels.stream().map(level -> {
            ProposedRegistrationLevel normalizedLevel = new ProposedRegistrationLevel();
            normalizedLevel.setName(level.getName().trim());
            normalizedLevel.setType(level.getType());
            normalizedLevel.setCode(level.getCode() == null ? standardProposalCode(category, level) : level.getCode());
            return normalizedLevel;
        }).toList();
    }

    private void validateProposalLevelUniqueness(List<ProposedRegistrationLevel> proposedLevels) {
        if (proposedLevels.isEmpty() || proposedLevels.size() > 12) {
            throw new BadRequestException("A proposal must contain between 1 and 12 levels");
        }
        long uniqueNames = proposedLevels.stream().map(level -> level.getName().toLowerCase(Locale.ROOT)).distinct().count();
        long codedCount = proposedLevels.stream().filter(level -> level.getCode() != null).count();
        long uniqueCodes = proposedLevels.stream().map(ProposedRegistrationLevel::getCode).filter(java.util.Objects::nonNull).distinct().count();
        if (uniqueNames != proposedLevels.size() || codedCount != uniqueCodes) {
            throw new BadRequestException("Proposed levels must have unique names and codes");
        }
    }

    private String normalizeProposalCode(String value) {
        String normalized = normalize(value);
        if (normalized == null) return null;
        normalized = normalized.toUpperCase(Locale.ROOT);
        if (!normalized.matches("[A-Z0-9_]{2,80}")) {
            throw new BadRequestException("Proposed level code must contain only A-Z, 0-9, and underscore");
        }
        return normalized;
    }

    private void validateProposedLevels(CatalogCategory category, List<ProposedRegistrationLevel> proposedLevels) {
        validateProposalLevelUniqueness(proposedLevels);
        String programCode = category.getProgramType().getCode();
        if (!"ACADEMIC".equals(programCode)) {
            if (proposedLevels.stream().anyMatch(level -> !Set.of(LevelType.SKILL_LEVEL, LevelType.CERTIFICATE_TARGET, LevelType.COACHING_LEVEL).contains(level.getType()))) {
                throw new BadRequestException("Skill and certificate proposals require a skill, certificate, or coaching level");
            }
            return;
        }

        String educationCode = category == null || category.getEducationLevel() == null ? null : category.getEducationLevel().getCode();
        if ("UNIVERSITY".equals(educationCode)) {
            if (proposedLevels.stream().anyMatch(level -> !Set.of(LevelType.UNIVERSITY_LEVEL, LevelType.EXAM_PREPARATION, LevelType.COACHING_LEVEL).contains(level.getType()))) {
                throw new BadRequestException("University proposals require a university, exam, or coaching level");
            }
            return;
        }

        Set<Integer> allowedGrades = switch (educationCode == null ? "" : educationCode) {
            case "PRIMARY" -> PRIMARY_GRADES;
            case "SECONDARY" -> SECONDARY_GRADES;
            case "HIGH_SCHOOL" -> HIGH_SCHOOL_GRADES;
            default -> Set.of();
        };
        if (proposedLevels.stream().allMatch(level -> level.getType() == LevelType.GRADE)) {
            Set<Integer> gradeNumbers = proposedLevels.stream()
                    .map(level -> gradeNumber(level.getName()))
                    .collect(java.util.stream.Collectors.toSet());
            if (gradeNumbers.contains(null) || allowedGrades.isEmpty() || !allowedGrades.containsAll(gradeNumbers)) {
                throw new BadRequestException("Selected grades do not belong to the chosen education level");
            }
            boolean mismatchedCode = proposedLevels.stream().anyMatch(level -> level.getCode() != null
                    && !level.getCode().equals(gradeCode(gradeNumber(level.getName()))));
            if (mismatchedCode) {
                throw new BadRequestException("Grade code does not match the selected grade name");
            }
            return;
        }
        if (proposedLevels.size() != 1 || proposedLevels.getFirst().getType() != LevelType.EXAM_PREPARATION || !category.getCode().contains("EXAM")) {
            throw new BadRequestException("School proposals must select grades from the chosen level or one exam target");
        }
        String expectedExamCode = switch (educationCode == null ? "" : educationCode) {
            case "SECONDARY" -> "GRADE_10_ENTRANCE_EXAM";
            case "HIGH_SCHOOL" -> "NATIONAL_EXAM";
            default -> null;
        };
        if (proposedLevels.getFirst().getCode() != null && !proposedLevels.getFirst().getCode().equals(expectedExamCode)) {
            throw new BadRequestException("Exam target code does not belong to the chosen education level");
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

    private String standardProposalCode(CatalogCategory category, ProposedRegistrationLevel level) {
        if (level.getType() == LevelType.GRADE) {
            Integer grade = gradeNumber(level.getName());
            return grade == null ? null : gradeCode(grade);
        }
        String educationCode = category.getEducationLevel() == null ? null : category.getEducationLevel().getCode();
        if (level.getType() == LevelType.EXAM_PREPARATION) {
            if ("SECONDARY".equals(educationCode) || normalizedText(level.getName()).contains("vao lop 10")) {
                return "GRADE_10_ENTRANCE_EXAM";
            }
            if ("HIGH_SCHOOL".equals(educationCode) || normalizedText(level.getName()).contains("thpt")
                    || normalizedText(level.getName()).contains("quoc gia")) {
                return "NATIONAL_EXAM";
            }
        }
        String normalizedName = normalizedText(level.getName());
        if (level.getType() == LevelType.UNIVERSITY_LEVEL) {
            if (normalizedName.contains("nam 1")) return "YEAR_1";
            if (normalizedName.contains("nam 2")) return "YEAR_2";
            if (normalizedName.contains("nam 3")) return "YEAR_3";
            if (normalizedName.contains("nam 4") || normalizedName.contains("4+")) return "YEAR_4_PLUS";
        }
        if (level.getType() == LevelType.SKILL_LEVEL) {
            if (normalizedName.contains("co ban")) return "BEGINNER";
            if (normalizedName.contains("trung cap")) return "INTERMEDIATE";
            if (normalizedName.contains("nang cao")) return "ADVANCED";
        }
        return null;
    }

    private Integer gradeNumber(String value) {
        if (value == null) return null;
        Matcher matcher = GRADE_NUMBER_PATTERN.matcher(normalizedText(value));
        if (!matcher.find()) return null;
        int grade = Integer.parseInt(matcher.group(1));
        return grade >= 1 && grade <= 12 ? grade : null;
    }

    private String gradeCode(Integer grade) {
        return grade == null ? null : "GRADE_" + grade;
    }

    private String normalizedText(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .trim();
    }

    private TeachingCatalogDtos.RegistrationResponse response(TutorSubjectRegistration value) {
        List<ProposedRegistrationLevel> proposalLevels = standardizeProposedLevels(
                value.getCategory(), effectiveProposedLevels(value));
        return new TeachingCatalogDtos.RegistrationResponse(
                value.getId(), value.getTutorEmail(),
                tutorIdentityLookup.fullName(value.getTutorEmail(), value.getTutorProfileId()).orElse(null),
                value.getTutorProfileId(),
                catalogMapper.option(value.getProgramType()), catalogMapper.option(value.getEducationLevel()),
                catalogMapper.category(value.getCategory()),
                value.getSubject() == null ? null : catalogMapper.subject(value.getSubject()),
                value.getLevels().stream().map(catalogMapper::level).toList(), value.getExperienceYears(), value.getTuitionMin(),
                value.getTuitionMax(), value.getDescription(), value.getStatus(), value.getRejectReason(),
                value.getReviewNote(), value.getSubmittedAt(), value.getReviewedAt(), value.getReviewedByEmail(),
                value.getEvidence().stream().map(item -> new TeachingCatalogDtos.EvidenceResponse(
                        item.getId(), item.getEvidenceType(), item.getTitle(), item.getAccountDocumentId(), item.getFileUrl()
                )).toList(),
                value.getProposedSubjectName(),
                proposalLevels.stream().map(ProposedRegistrationLevel::getName)
                        .collect(java.util.stream.Collectors.joining(", ")),
                proposalLevels.isEmpty() ? null : proposalLevels.getFirst().getType(),
                value.getProposedNote(),
                proposalLevels.stream().map(level -> new TeachingCatalogDtos.ProposedLevelResponse(
                        level.getCode(), level.getName(), level.getType()
                )).toList()
        );
    }

    private String uniqueCode(String value, Long id) {
        String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String code = ascii.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
        return (code.isBlank() ? "ITEM" : code) + "_" + id;
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
