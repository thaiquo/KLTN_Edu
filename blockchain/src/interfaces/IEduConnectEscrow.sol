// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

interface IEduConnectEscrow {
    enum AgreementStatus {
        NONE,
        CREATED,
        FUNDED,
        COMPLETED,
        EXPIRED,
        CANCELLED
    }

    enum SessionStatus {
        NONE,
        PROPOSED,
        DISPUTED,
        SETTLED,
        REFUNDED
    }

    enum Outcome {
        BOTH_PRESENT,
        STUDENT_ABSENT_TUTOR_PRESENT,
        TUTOR_ABSENT
    }

    struct Agreement {
        address student;
        address tutor;
        bytes32 termsHash;
        uint256 totalAmount;
        uint256 pricePerSession;
        uint256 remainingAmount;
        uint256 releasedAmount;
        uint256 refundedAmount;
        uint64 paymentDeadline;
        uint32 totalSessions;
        uint32 settledSessions;
        uint32 openSessions;
        AgreementStatus status;
    }

    struct SessionSettlement {
        Outcome proposedOutcome;
        SessionStatus status;
        uint64 disputeDeadline;
        bytes32 proposalEvidenceHash;
        bytes32 disputeEvidenceHash;
        bytes32 resolutionHash;
    }

    event AgreementRegistered(
        bytes32 indexed agreementId,
        address indexed student,
        address indexed tutor,
        bytes32 termsHash,
        uint256 totalAmount,
        uint256 pricePerSession,
        uint32 totalSessions,
        uint64 paymentDeadline
    );
    event AgreementFunded(bytes32 indexed agreementId, address indexed student, uint256 amount);
    event SessionSettlementProposed(
        bytes32 indexed agreementId,
        bytes32 indexed sessionId,
        Outcome outcome,
        uint64 disputeDeadline,
        bytes32 evidenceHash
    );
    event TutorFraudDisputeOpened(bytes32 indexed agreementId, bytes32 indexed sessionId, bytes32 evidenceHash);
    event SessionSettled(
        bytes32 indexed agreementId,
        bytes32 indexed sessionId,
        Outcome outcome,
        SessionStatus finalStatus,
        uint256 tutorAmount,
        uint256 platformAmount,
        uint256 studentRefund
    );
    event TutorFraudDisputeResolved(
        bytes32 indexed agreementId, bytes32 indexed sessionId, bool complaintApproved, bytes32 resolutionHash
    );
    event AgreementCompleted(bytes32 indexed agreementId);
    event AgreementExpired(bytes32 indexed agreementId);
    event AgreementCancelled(bytes32 indexed agreementId, bytes32 reasonHash);
    event UnusedAmountRefunded(bytes32 indexed agreementId, address indexed student, uint256 amount);

    function registerAgreement(
        bytes32 agreementId,
        address student,
        address tutor,
        bytes32 termsHash,
        uint256 totalAmount,
        uint256 pricePerSession,
        uint32 totalSessions
    ) external;

    function fundAgreement(bytes32 agreementId) external;

    function proposeSessionSettlement(bytes32 agreementId, bytes32 sessionId, Outcome outcome, bytes32 evidenceHash)
        external;

    function openTutorFraudDispute(bytes32 agreementId, bytes32 sessionId, bytes32 evidenceHash) external;

    function finalizeSession(bytes32 agreementId, bytes32 sessionId) external;

    function resolveTutorFraudDispute(
        bytes32 agreementId,
        bytes32 sessionId,
        bool complaintApproved,
        bytes32 resolutionHash
    ) external;

    function expireAgreement(bytes32 agreementId) external;

    function cancelAgreementAndRefundUnused(bytes32 agreementId, bytes32 reasonHash) external;

    function getAgreement(bytes32 agreementId) external view returns (Agreement memory);

    function getSessionSettlement(bytes32 agreementId, bytes32 sessionId)
        external
        view
        returns (SessionSettlement memory);
}
