package iuh.fit.contract_service.config.security;

import iuh.fit.contract_service.entity.ContractAgreement;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ContractAccessControlTest {

    private final ContractAccessControl accessControl = new ContractAccessControl();

    @Test
    void studentActiveRoleSeesOnlyStudentAgreementsEvenWhenUserAlsoHasTutorRole() {
        ContractAgreement studentAgreement = agreement(1L, "student@example.com", 20L, "tutor@example.com", "staff@example.com");
        ContractAgreement tutorAgreement = agreement(3L, "other-student@example.com", 1L, "student@example.com", "student@example.com");
        ContractAgreement otherAgreement = agreement(4L, "other@example.com", 5L, "other-tutor@example.com", "staff@example.com");
        ContractUserPrincipal user = user(1L, "student@example.com", "STUDENT", "STUDENT", "TUTOR");

        List<ContractAgreement> filtered = accessControl.filterAgreements(
                List.of(studentAgreement, tutorAgreement, otherAgreement),
                user);

        assertThat(filtered).containsExactly(studentAgreement);
    }

    @Test
    void tutorActiveRoleSeesOnlyTutorAgreements() {
        ContractAgreement tutorAgreement = agreement(3L, "student@example.com", 2L, "tutor@example.com", "reviewer@example.com");
        ContractAgreement otherAgreement = agreement(4L, "other@example.com", 5L, "other-tutor@example.com", "staff@example.com");
        ContractUserPrincipal user = user(2L, "tutor@example.com", "TUTOR", "TUTOR");

        List<ContractAgreement> filtered = accessControl.filterAgreements(List.of(tutorAgreement, otherAgreement), user);

        assertThat(filtered).containsExactly(tutorAgreement);
    }

    @Test
    void staffActiveRoleSeesOnlyReviewedClassAgreementsAndAdminSeesAll() {
        ContractAgreement reviewed = agreement(1L, "student@example.com", 2L, "tutor@example.com", "staff@example.com");
        ContractAgreement notReviewed = agreement(3L, "other@example.com", 4L, "other-tutor@example.com", "other-staff@example.com");
        ContractUserPrincipal staff = user(9L, "staff@example.com", "STAFF", "STAFF");
        ContractUserPrincipal admin = user(10L, "admin@example.com", "ADMIN", "ADMIN");

        assertThat(accessControl.filterAgreements(List.of(reviewed, notReviewed), staff)).containsExactly(reviewed);
        assertThat(accessControl.filterAgreements(List.of(reviewed, notReviewed), admin)).containsExactly(reviewed, notReviewed);
    }

    @Test
    void signRequiresMatchingAuthenticatedActiveRoleAndParty() {
        ContractAgreement agreement = agreement(1L, "student@example.com", 2L, "tutor@example.com", "staff@example.com");
        ContractUserPrincipal tutor = user(2L, "tutor@example.com", "TUTOR", "TUTOR");
        ContractUserPrincipal studentTryingTutorAction = user(1L, "student@example.com", "STUDENT", "STUDENT", "TUTOR");

        accessControl.requireCanSign(agreement, "TUTOR", tutor);

        assertThatThrownBy(() -> accessControl.requireCanSign(agreement, "TUTOR", studentTryingTutorAction))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void paymentSubmittedRequiresAgreementStudent() {
        ContractAgreement agreement = agreement(1L, "student@example.com", 2L, "tutor@example.com", "staff@example.com");
        ContractUserPrincipal student = user(1L, "student@example.com", "STUDENT", "STUDENT");
        ContractUserPrincipal otherStudent = user(3L, "other-student@example.com", "STUDENT", "STUDENT");
        ContractUserPrincipal tutor = user(2L, "tutor@example.com", "TUTOR", "TUTOR");

        accessControl.requireCanSubmitPayment(agreement, student);

        assertThatThrownBy(() -> accessControl.requireCanSubmitPayment(agreement, otherStudent))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
        assertThatThrownBy(() -> accessControl.requireCanSubmitPayment(agreement, tutor))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void initiateAgreementRequiresAuthenticatedTutorParty() {
        ContractUserPrincipal tutor = user(2L, "tutor@example.com", "TUTOR", "TUTOR");
        ContractUserPrincipal otherTutor = user(3L, "other@example.com", "TUTOR", "TUTOR");
        ContractUserPrincipal student = user(2L, "tutor@example.com", "STUDENT", "STUDENT", "TUTOR");
        var seed = new ContractAccessControl.ContractAgreementSeed(2L, "tutor@example.com");

        accessControl.requireCanInitiateAgreement(seed, tutor);

        assertThatThrownBy(() -> accessControl.requireCanInitiateAgreement(seed, otherTutor))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
        assertThatThrownBy(() -> accessControl.requireCanInitiateAgreement(seed, student))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void onlyAdminCanManageAgreementLifecycle() {
        ContractAgreement agreement = agreement(1L, "student@example.com", 2L, "tutor@example.com", "staff@example.com");
        ContractUserPrincipal admin = user(10L, "admin@example.com", "ADMIN", "ADMIN");
        ContractUserPrincipal assignedStaff = user(9L, "staff@example.com", "STAFF", "STAFF");
        ContractUserPrincipal otherStaff = user(8L, "other-staff@example.com", "STAFF", "STAFF");

        accessControl.requireCanManageAgreementLifecycle(agreement, admin);

        assertThatThrownBy(() -> accessControl.requireCanManageAgreementLifecycle(agreement, assignedStaff))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
        assertThatThrownBy(() -> accessControl.requireCanManageAgreementLifecycle(agreement, otherStaff))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    @Test
    void assignedStaffCanStillManageSettlementAndResolveDisputeScope() {
        ContractAgreement agreement = agreement(1L, "student@example.com", 2L, "tutor@example.com", "staff@example.com");
        ContractUserPrincipal assignedStaff = user(9L, "staff@example.com", "STAFF", "STAFF");
        ContractUserPrincipal otherStaff = user(8L, "other-staff@example.com", "STAFF", "STAFF");

        accessControl.requireCanManageSettlement(agreement, assignedStaff);

        assertThatThrownBy(() -> accessControl.requireCanManageSettlement(agreement, otherStaff))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    private ContractUserPrincipal user(Long userId, String email, String activeRole, String... roles) {
        return new ContractUserPrincipal(userId, email, activeRole, List.of(roles));
    }

    private ContractAgreement agreement(Long studentId, String studentEmail, Long tutorId, String tutorEmail, String reviewerEmail) {
        return ContractAgreement.builder()
                .id(UUID.randomUUID())
                .studentId(studentId)
                .studentEmail(studentEmail)
                .tutorId(tutorId)
                .tutorEmail(tutorEmail)
                .classroomReviewerEmail(reviewerEmail)
                .build();
    }
}
