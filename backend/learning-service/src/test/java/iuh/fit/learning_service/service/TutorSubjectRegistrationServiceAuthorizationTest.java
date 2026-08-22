package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.TeachingCatalogDtos;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.EvidenceType;
import iuh.fit.learning_service.enums.LevelType;
import iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.repository.CatalogCategoryRepository;
import iuh.fit.learning_service.repository.CatalogLevelRepository;
import iuh.fit.learning_service.repository.CatalogSubjectRepository;
import iuh.fit.learning_service.repository.TutorSubjectRegistrationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;

class TutorSubjectRegistrationServiceAuthorizationTest {
    private TutorSubjectRegistrationRepository registrations;
    private CatalogSubjectRepository subjects;
    private CatalogLevelRepository levels;
    private CatalogCategoryRepository categories;
    private TutorSubjectRegistrationService service;

    @BeforeEach
    void setUp() {
        registrations = mock(TutorSubjectRegistrationRepository.class);
        subjects = mock(CatalogSubjectRepository.class);
        levels = mock(CatalogLevelRepository.class);
        categories = mock(CatalogCategoryRepository.class);
        TutorIdentityLookup tutorIdentityLookup = mock(TutorIdentityLookup.class);
        when(tutorIdentityLookup.fullName(any(), any())).thenReturn(Optional.empty());
        service = new TutorSubjectRegistrationService(
                registrations,
                subjects,
                levels,
                categories,
                mock(TeachingCatalogService.class),
                tutorIdentityLookup
        );
    }

    @Test
    void staffCannotApproveNewSubjectProposal() {
        TutorSubjectRegistration proposal = pendingProposal(10L);
        when(registrations.findById(10L)).thenReturn(Optional.of(proposal));

        assertThatThrownBy(() -> service.approve(10L, "staff@example.com", null, false))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("Only admins can review new subject proposals");
    }

    @Test
    void staffCannotRejectNewSubjectProposal() {
        TutorSubjectRegistration proposal = pendingProposal(11L);
        when(registrations.findById(11L)).thenReturn(Optional.of(proposal));

        assertThatThrownBy(() -> service.reject(11L, "staff@example.com", null, false))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("Only admins can review new subject proposals");
    }

    @Test
    void staffPendingQueueExcludesNewSubjectProposals() {
        TutorSubjectRegistration proposal = pendingProposal(12L);
        TutorSubjectRegistration standard = pendingProposal(13L);
        standard.setSubject(new CatalogSubject());
        when(registrations.findByStatusOrderBySubmittedAtAsc(TutorSubjectRegistrationStatus.PENDING))
                .thenReturn(List.of(proposal, standard));

        assertThat(service.pending(false))
                .extracting(response -> response.id())
                .containsExactly(13L);
        assertThat(service.pending(true))
                .extracting(response -> response.id())
                .containsExactly(12L, 13L);
    }

    @Test
    void academicProposalRejectsGradeOutsideSelectedEducationLevel() {
        CatalogCategory primaryCategory = academicCategory("PRIMARY", "PRIMARY_GENERAL");
        when(categories.findById(20L)).thenReturn(Optional.of(primaryCategory));

        assertThatThrownBy(() -> service.createBatch("tutor@example.com", proposalRequest(20L, "Lớp 6", LevelType.GRADE)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Selected grades do not belong to the chosen education level");
    }

    @Test
    void academicProposalRejectsMismatchedStructuredGradeCode() {
        CatalogCategory primaryCategory = academicCategory("PRIMARY", "PRIMARY_GENERAL");
        when(categories.findById(20L)).thenReturn(Optional.of(primaryCategory));
        TeachingCatalogDtos.CreateRegistrationBatchRequest request = new TeachingCatalogDtos.CreateRegistrationBatchRequest(
                null, null, 1, BigDecimal.valueOf(100_000), BigDecimal.valueOf(150_000),
                "Teaching experience", List.of(new TeachingCatalogDtos.EvidenceRequest(
                        EvidenceType.OTHER, "Portfolio", null, "https://example.com/evidence.pdf")),
                20L, "New subject", null, null, null,
                List.of(new TeachingCatalogDtos.ProposedLevelRequest("GRADE_12", "Lớp 1", LevelType.GRADE))
        );

        assertThatThrownBy(() -> service.createBatch("tutor@example.com", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Grade code does not match the selected grade name");
    }

    @Test
    void legacyAcademicProposalInfersStandardGradeCodesOnCreate() {
        CatalogCategory primaryCategory = academicCategory("PRIMARY", "PRIMARY_GENERAL");
        when(categories.findById(20L)).thenReturn(Optional.of(primaryCategory));
        when(registrations.save(any(TutorSubjectRegistration.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.createBatch("tutor@example.com", proposalRequest(20L, "Lớp 1, Lớp 3", LevelType.GRADE));

        verify(registrations).save(argThat(registration ->
                registration.getProposedLevels().size() == 2
                        && "GRADE_1".equals(registration.getProposedLevels().get(0).getCode())
                        && "GRADE_3".equals(registration.getProposedLevels().get(1).getCode())
        ));
    }

    @Test
    void adminApprovalCreatesOneCatalogLevelForEverySelectedGrade() {
        TutorSubjectRegistration proposal = pendingProposal(21L);
        proposal.setTutorEmail("tutor@example.com");
        proposal.setCategory(academicCategory("PRIMARY", "PRIMARY_GENERAL"));
        proposal.setProgramType(proposal.getCategory().getProgramType());
        proposal.setEducationLevel(proposal.getCategory().getEducationLevel());
        proposal.setProposedSubjectName("Khoa học máy tính");
        proposal.getProposedLevels().add(proposedLevel("GRADE_1", "Lớp 1", LevelType.GRADE));
        proposal.getProposedLevels().add(proposedLevel("GRADE_3", "Lớp 3", LevelType.GRADE));
        proposal.getProposedLevels().add(proposedLevel("GRADE_5", "Lớp 5", LevelType.GRADE));
        when(registrations.findById(21L)).thenReturn(Optional.of(proposal));
        when(subjects.findByCategoryIdOrderByOrderIndexAscNameAsc(20L)).thenReturn(List.of());
        when(subjects.save(any(CatalogSubject.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(levels.save(any(CatalogLevel.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(registrations.save(any(TutorSubjectRegistration.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.approve(21L, "admin@example.com", null, true);

        assertThat(proposal.getLevels())
                .extracting(CatalogLevel::getName)
                .containsExactly("Lớp 1", "Lớp 3", "Lớp 5");
        assertThat(proposal.getLevels())
                .extracting(CatalogLevel::getCode)
                .containsExactly("GRADE_1", "GRADE_3", "GRADE_5");
    }

    @Test
    void adminApprovalInfersStandardGradeCodesForStructuredProposal() {
        TutorSubjectRegistration proposal = pendingProposal(22L);
        proposal.setTutorEmail("tutor@example.com");
        proposal.setCategory(academicCategory("PRIMARY", "PRIMARY_GENERAL"));
        proposal.setProgramType(proposal.getCategory().getProgramType());
        proposal.setEducationLevel(proposal.getCategory().getEducationLevel());
        proposal.setProposedSubjectName("Khoa học máy tính");
        proposal.getProposedLevels().add(proposedLevel(null, "Lớp 1", LevelType.GRADE));
        proposal.getProposedLevels().add(proposedLevel(null, "Lớp 3", LevelType.GRADE));
        when(registrations.findById(22L)).thenReturn(Optional.of(proposal));
        when(subjects.findByCategoryIdOrderByOrderIndexAscNameAsc(20L)).thenReturn(List.of());
        when(subjects.save(any(CatalogSubject.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(levels.save(any(CatalogLevel.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(registrations.save(any(TutorSubjectRegistration.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.approve(22L, "admin@example.com", null, true);

        assertThat(proposal.getLevels())
                .extracting(CatalogLevel::getCode)
                .containsExactly("GRADE_1", "GRADE_3");
    }


    private TeachingCatalogDtos.CreateRegistrationBatchRequest proposalRequest(Long categoryId, String levelNames, LevelType type) {
        return new TeachingCatalogDtos.CreateRegistrationBatchRequest(
                null, null, 1, BigDecimal.valueOf(100_000), BigDecimal.valueOf(150_000),
                "Teaching experience", List.of(new TeachingCatalogDtos.EvidenceRequest(
                        EvidenceType.OTHER, "Portfolio", null, "https://example.com/evidence.pdf")),
                categoryId, "New subject", levelNames, type, null, null
        );
    }

    private CatalogCategory academicCategory(String educationCode, String categoryCode) {
        ProgramType program = new ProgramType();
        program.setCode("ACADEMIC");
        EducationLevel education = new EducationLevel();
        education.setCode(educationCode);
        CatalogCategory category = new CatalogCategory();
        category.setId(20L);
        category.setCode(categoryCode);
        category.setProgramType(program);
        category.setEducationLevel(education);
        category.setActive(true);
        return category;
    }

    private ProposedRegistrationLevel proposedLevel(String code, String name, LevelType type) {
        ProposedRegistrationLevel level = new ProposedRegistrationLevel();
        level.setCode(code);
        level.setName(name);
        level.setType(type);
        return level;
    }

    private TutorSubjectRegistration pendingProposal(Long id) {
        TutorSubjectRegistration registration = new TutorSubjectRegistration();
        registration.setId(id);
        registration.setStatus(TutorSubjectRegistrationStatus.PENDING);
        registration.setProposedSubjectName("New subject");
        return registration;
    }
}
