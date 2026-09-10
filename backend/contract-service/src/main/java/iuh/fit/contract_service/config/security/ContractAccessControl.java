package iuh.fit.contract_service.config.security;

import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.Dispute;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Component
public class ContractAccessControl {

    public List<ContractAgreement> filterAgreements(List<ContractAgreement> agreements, ContractUserPrincipal user) {
        if (isActiveAdmin(user)) {
            return agreements;
        }
        if (isActiveStaff(user)) {
            return agreements.stream()
                    .filter(agreement -> user.matchesEmail(agreement.getClassroomReviewerEmail()))
                    .toList();
        }
        return agreements.stream()
                .filter(agreement -> canViewAgreement(agreement, user))
                .toList();
    }

    public boolean canViewAgreement(ContractAgreement agreement, ContractUserPrincipal user) {
        if (agreement == null) {
            return false;
        }
        if (isActiveAdmin(user)) {
            return true;
        }
        if (isActiveStaff(user)) {
            return user.matchesEmail(agreement.getClassroomReviewerEmail());
        }
        if (user.hasActiveAuthority("TUTOR")) {
            return user.matchesUserId(agreement.getTutorId())
                    || user.matchesEmail(agreement.getTutorEmail());
        }
        if (user.hasActiveAuthority("STUDENT")) {
            return user.matchesUserId(agreement.getStudentId())
                    || user.matchesEmail(agreement.getStudentEmail());
        }
        return false;
    }

    public void requireCanViewAgreement(ContractAgreement agreement, ContractUserPrincipal user) {
        if (!canViewAgreement(agreement, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
    }

    public void requireCanInitiateAgreement(ContractAgreementSeed seed, ContractUserPrincipal user) {
        if (!user.hasActiveAuthority("TUTOR")
                || (!user.matchesUserId(seed.tutorId()) && !user.matchesEmail(seed.tutorEmail()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the authenticated tutor can initiate this agreement.");
        }
    }

    public void requireCanSign(ContractAgreement agreement, String signingRole, ContractUserPrincipal user) {
        if ("TUTOR".equalsIgnoreCase(signingRole)) {
            if (!user.hasActiveAuthority("TUTOR")
                    || (!user.matchesUserId(agreement.getTutorId()) && !user.matchesEmail(agreement.getTutorEmail()))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the agreement tutor can sign as tutor.");
            }
            return;
        }
        if ("STUDENT".equalsIgnoreCase(signingRole)) {
            if (!user.hasActiveAuthority("STUDENT")
                    || (!user.matchesUserId(agreement.getStudentId()) && !user.matchesEmail(agreement.getStudentEmail()))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the agreement student can sign as student.");
            }
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid signing role.");
    }

    public void requireCanSubmitPayment(ContractAgreement agreement, ContractUserPrincipal user) {
        if (!user.hasActiveAuthority("STUDENT")
                || (!user.matchesUserId(agreement.getStudentId()) && !user.matchesEmail(agreement.getStudentEmail()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the agreement student can submit payment.");
        }
    }

    public void requireCanManageSettlement(ContractAgreement agreement, ContractUserPrincipal user) {
        if (isActiveAdmin(user)) {
            return;
        }
        if (isActiveStaff(user) && user.matchesEmail(agreement.getClassroomReviewerEmail())) {
            return;
        }
        if (user.hasActiveAuthority("TUTOR")
                && (user.matchesUserId(agreement.getTutorId()) || user.matchesEmail(agreement.getTutorEmail()))) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the agreement tutor, assigned staff, or admin can manage settlement.");
    }

    public void requireCanOpenDispute(ContractAgreement agreement, ContractUserPrincipal user) {
        if (!user.hasActiveAuthority("STUDENT")
                || (!user.matchesUserId(agreement.getStudentId()) && !user.matchesEmail(agreement.getStudentEmail()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the agreement student can open a dispute.");
        }
    }

    public void requireCanManageAgreementLifecycle(ContractAgreement agreement, ContractUserPrincipal user) {
        if (isActiveAdmin(user)) {
            return;
        }
        if (isActiveStaff(user) && user.matchesEmail(agreement.getClassroomReviewerEmail())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only assigned staff or admin can manage agreement lifecycle.");
    }

    public List<Dispute> filterDisputes(List<Dispute> disputes, ContractUserPrincipal user) {
        if (isActiveAdmin(user)) {
            return disputes;
        }
        if (isActiveStaff(user)) {
            return disputes.stream()
                    .filter(dispute -> user.matchesEmail(dispute.getSettlement().getAgreement().getClassroomReviewerEmail()))
                    .toList();
        }
        return disputes.stream()
                .filter(dispute -> canViewDispute(dispute, user))
                .toList();
    }

    public boolean canViewDispute(Dispute dispute, ContractUserPrincipal user) {
        if (dispute == null) {
            return false;
        }
        return user.matchesUserId(dispute.getComplainantId())
                || canViewAgreement(dispute.getSettlement().getAgreement(), user);
    }

    public void requireCanResolveDispute(Dispute dispute, ContractUserPrincipal user) {
        if (isActiveAdmin(user)) {
            return;
        }
        if (isActiveStaff(user)
                && user.matchesEmail(dispute.getSettlement().getAgreement().getClassroomReviewerEmail())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only assigned staff or admin can resolve this dispute.");
    }

    public boolean canViewTransactionsAsStaffOrAdmin(ContractUserPrincipal user) {
        return isActiveAdmin(user) || isActiveStaff(user);
    }

    private boolean isActiveAdmin(ContractUserPrincipal user) {
        return user.hasActiveAuthority("ADMIN");
    }

    private boolean isActiveStaff(ContractUserPrincipal user) {
        return user.hasActiveAuthority("STAFF");
    }

    public record ContractAgreementSeed(Long tutorId, String tutorEmail) {}
}
