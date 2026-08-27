// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IEduConnectEscrow} from "./interfaces/IEduConnectEscrow.sol";

/// @title EduConnectEscrow
/// @notice One master escrow that isolates many student/classroom agreements.
contract EduConnectEscrow is IEduConnectEscrow, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant PAYMENT_WINDOW = 24 hours;
    uint256 public constant DISPUTE_WINDOW = 24 hours;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    IERC20 public immutable usdc;
    address public immutable platformWallet;

    mapping(bytes32 agreementId => Agreement agreement) private _agreements;
    mapping(bytes32 agreementId => mapping(bytes32 sessionId => SessionSettlement settlement)) private _sessions;

    error ZeroAddress();
    error InvalidToken();
    error InvalidIdentifier();
    error InvalidTermsHash();
    error SameParty();
    error InvalidAmount();
    error InvalidSessionCount();
    error AmountMismatch();
    error AgreementAlreadyExists(bytes32 agreementId);
    error AgreementNotFound(bytes32 agreementId);
    error InvalidAgreementStatus(AgreementStatus expected, AgreementStatus actual);
    error InvalidSessionStatus(SessionStatus expected, SessionStatus actual);
    error OnlyStudent(address expected, address actual);
    error PaymentDeadlinePassed(uint64 deadline);
    error PaymentDeadlineNotPassed(uint64 deadline);
    error DisputeWindowOpen(uint64 deadline);
    error DisputeWindowClosed(uint64 deadline);
    error InvalidDisputeOutcome(Outcome outcome);
    error InvalidEvidenceHash();
    error OpenSessionsExist(uint32 count);
    error AllSessionsAllocated();
    error TokenTransferAmountMismatch(uint256 expected, uint256 received);
    error TimestampOverflow();

    constructor(address usdcToken, address platformWallet_, address adminWallet) {
        if (usdcToken == address(0) || platformWallet_ == address(0) || adminWallet == address(0)) {
            revert ZeroAddress();
        }
        if (usdcToken.code.length == 0) revert InvalidToken();

        usdc = IERC20(usdcToken);
        platformWallet = platformWallet_;

        _grantRole(DEFAULT_ADMIN_ROLE, adminWallet);
        _grantRole(OPERATOR_ROLE, adminWallet);
        _grantRole(ARBITRATOR_ROLE, adminWallet);
    }

    function registerAgreement(
        bytes32 agreementId,
        address student,
        address tutor,
        bytes32 termsHash,
        uint256 totalAmount,
        uint256 pricePerSession,
        uint32 totalSessions
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        if (agreementId == bytes32(0)) revert InvalidIdentifier();
        if (student == address(0) || tutor == address(0)) revert ZeroAddress();
        if (student == tutor) revert SameParty();
        if (termsHash == bytes32(0)) revert InvalidTermsHash();
        if (totalSessions == 0) revert InvalidSessionCount();
        if (totalAmount == 0 || pricePerSession == 0) revert InvalidAmount();
        if (pricePerSession * uint256(totalSessions) != totalAmount) revert AmountMismatch();
        if (_agreements[agreementId].status != AgreementStatus.NONE) {
            revert AgreementAlreadyExists(agreementId);
        }

        uint64 paymentDeadline = _deadlineFromNow(PAYMENT_WINDOW);
        _agreements[agreementId] = Agreement({
            student: student,
            tutor: tutor,
            termsHash: termsHash,
            totalAmount: totalAmount,
            pricePerSession: pricePerSession,
            remainingAmount: 0,
            releasedAmount: 0,
            refundedAmount: 0,
            paymentDeadline: paymentDeadline,
            totalSessions: totalSessions,
            settledSessions: 0,
            openSessions: 0,
            status: AgreementStatus.CREATED
        });

        emit AgreementRegistered(
            agreementId, student, tutor, termsHash, totalAmount, pricePerSession, totalSessions, paymentDeadline
        );
    }

    function fundAgreement(bytes32 agreementId) external nonReentrant whenNotPaused {
        Agreement storage agreement = _getAgreement(agreementId);
        _requireAgreementStatus(agreement, AgreementStatus.CREATED);
        if (msg.sender != agreement.student) revert OnlyStudent(agreement.student, msg.sender);
        // Protocol deadlines intentionally use the chain timestamp; a few seconds of validator skew
        // cannot materially alter either 24-hour business window.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > agreement.paymentDeadline) {
            revert PaymentDeadlinePassed(agreement.paymentDeadline);
        }

        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), agreement.totalAmount);
        uint256 received = usdc.balanceOf(address(this)) - balanceBefore;
        if (received != agreement.totalAmount) {
            revert TokenTransferAmountMismatch(agreement.totalAmount, received);
        }

        agreement.remainingAmount = agreement.totalAmount;
        agreement.status = AgreementStatus.FUNDED;
        emit AgreementFunded(agreementId, msg.sender, agreement.totalAmount);
    }

    function proposeSessionSettlement(bytes32 agreementId, bytes32 sessionId, Outcome outcome, bytes32 evidenceHash)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
    {
        if (sessionId == bytes32(0)) revert InvalidIdentifier();
        Agreement storage agreement = _getAgreement(agreementId);
        _requireAgreementStatus(agreement, AgreementStatus.FUNDED);
        if (uint256(agreement.settledSessions) + uint256(agreement.openSessions) >= agreement.totalSessions) {
            revert AllSessionsAllocated();
        }

        SessionSettlement storage settlement = _sessions[agreementId][sessionId];
        _requireSessionStatus(settlement, SessionStatus.NONE);

        uint64 disputeDeadline = _deadlineFromNow(DISPUTE_WINDOW);
        settlement.proposedOutcome = outcome;
        settlement.status = SessionStatus.PROPOSED;
        settlement.disputeDeadline = disputeDeadline;
        settlement.proposalEvidenceHash = evidenceHash;
        agreement.openSessions += 1;

        emit SessionSettlementProposed(agreementId, sessionId, outcome, disputeDeadline, evidenceHash);
    }

    function openTutorFraudDispute(bytes32 agreementId, bytes32 sessionId, bytes32 evidenceHash)
        external
        onlyRole(OPERATOR_ROLE)
    {
        if (evidenceHash == bytes32(0)) revert InvalidEvidenceHash();
        Agreement storage agreement = _getAgreement(agreementId);
        _requireAgreementStatus(agreement, AgreementStatus.FUNDED);

        SessionSettlement storage settlement = _sessions[agreementId][sessionId];
        _requireSessionStatus(settlement, SessionStatus.PROPOSED);
        if (settlement.proposedOutcome != Outcome.BOTH_PRESENT) {
            revert InvalidDisputeOutcome(settlement.proposedOutcome);
        }
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > settlement.disputeDeadline) {
            revert DisputeWindowClosed(settlement.disputeDeadline);
        }

        settlement.status = SessionStatus.DISPUTED;
        settlement.disputeEvidenceHash = evidenceHash;
        emit TutorFraudDisputeOpened(agreementId, sessionId, evidenceHash);
    }

    function finalizeSession(bytes32 agreementId, bytes32 sessionId)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
    {
        Agreement storage agreement = _getAgreement(agreementId);
        _requireAgreementStatus(agreement, AgreementStatus.FUNDED);
        SessionSettlement storage settlement = _sessions[agreementId][sessionId];
        _requireSessionStatus(settlement, SessionStatus.PROPOSED);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp <= settlement.disputeDeadline) {
            revert DisputeWindowOpen(settlement.disputeDeadline);
        }

        if (settlement.proposedOutcome == Outcome.BOTH_PRESENT) {
            _settle(agreementId, sessionId, agreement, settlement, 8_500, 1_500, SessionStatus.SETTLED);
        } else if (settlement.proposedOutcome == Outcome.STUDENT_ABSENT_TUTOR_PRESENT) {
            _settle(agreementId, sessionId, agreement, settlement, 4_500, 1_000, SessionStatus.SETTLED);
        } else {
            _settle(agreementId, sessionId, agreement, settlement, 0, 0, SessionStatus.REFUNDED);
        }
    }

    function resolveTutorFraudDispute(
        bytes32 agreementId,
        bytes32 sessionId,
        bool complaintApproved,
        bytes32 resolutionHash
    ) external onlyRole(ARBITRATOR_ROLE) nonReentrant {
        if (resolutionHash == bytes32(0)) revert InvalidEvidenceHash();
        Agreement storage agreement = _getAgreement(agreementId);
        _requireAgreementStatus(agreement, AgreementStatus.FUNDED);
        SessionSettlement storage settlement = _sessions[agreementId][sessionId];
        _requireSessionStatus(settlement, SessionStatus.DISPUTED);

        settlement.resolutionHash = resolutionHash;
        emit TutorFraudDisputeResolved(agreementId, sessionId, complaintApproved, resolutionHash);

        if (complaintApproved) {
            _settle(agreementId, sessionId, agreement, settlement, 0, 0, SessionStatus.REFUNDED);
        } else {
            _settle(agreementId, sessionId, agreement, settlement, 8_500, 1_500, SessionStatus.SETTLED);
        }
    }

    function expireAgreement(bytes32 agreementId) external onlyRole(OPERATOR_ROLE) {
        Agreement storage agreement = _getAgreement(agreementId);
        _requireAgreementStatus(agreement, AgreementStatus.CREATED);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp <= agreement.paymentDeadline) {
            revert PaymentDeadlineNotPassed(agreement.paymentDeadline);
        }

        agreement.status = AgreementStatus.EXPIRED;
        emit AgreementExpired(agreementId);
    }

    function cancelAgreementAndRefundUnused(bytes32 agreementId, bytes32 reasonHash)
        external
        onlyRole(ARBITRATOR_ROLE)
        nonReentrant
    {
        if (reasonHash == bytes32(0)) revert InvalidEvidenceHash();
        Agreement storage agreement = _getAgreement(agreementId);
        _requireAgreementStatus(agreement, AgreementStatus.FUNDED);
        if (agreement.openSessions != 0) revert OpenSessionsExist(agreement.openSessions);

        uint256 refund = agreement.remainingAmount;
        agreement.remainingAmount = 0;
        agreement.refundedAmount += refund;
        agreement.status = AgreementStatus.CANCELLED;

        emit AgreementCancelled(agreementId, reasonHash);
        emit UnusedAmountRefunded(agreementId, agreement.student, refund);
        usdc.safeTransfer(agreement.student, refund);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getAgreement(bytes32 agreementId) external view returns (Agreement memory) {
        return _agreements[agreementId];
    }

    function getSessionSettlement(bytes32 agreementId, bytes32 sessionId)
        external
        view
        returns (SessionSettlement memory)
    {
        return _sessions[agreementId][sessionId];
    }

    function _settle(
        bytes32 agreementId,
        bytes32 sessionId,
        Agreement storage agreement,
        SessionSettlement storage settlement,
        uint256 tutorBps,
        uint256 platformBps,
        SessionStatus finalStatus
    ) private {
        uint256 sessionAmount = agreement.pricePerSession;
        uint256 tutorAmount = sessionAmount * tutorBps / BPS_DENOMINATOR;
        uint256 platformAmount = sessionAmount * platformBps / BPS_DENOMINATOR;
        uint256 studentRefund = sessionAmount - tutorAmount - platformAmount;

        settlement.status = finalStatus;
        agreement.openSessions -= 1;
        agreement.settledSessions += 1;
        agreement.remainingAmount -= sessionAmount;
        agreement.releasedAmount += tutorAmount + platformAmount;
        agreement.refundedAmount += studentRefund;

        if (agreement.remainingAmount == 0) {
            agreement.status = AgreementStatus.COMPLETED;
        }

        emit SessionSettled(
            agreementId, sessionId, settlement.proposedOutcome, finalStatus, tutorAmount, platformAmount, studentRefund
        );

        if (tutorAmount != 0) usdc.safeTransfer(agreement.tutor, tutorAmount);
        if (platformAmount != 0) usdc.safeTransfer(platformWallet, platformAmount);
        if (studentRefund != 0) usdc.safeTransfer(agreement.student, studentRefund);

        if (agreement.status == AgreementStatus.COMPLETED) {
            emit AgreementCompleted(agreementId);
        }
    }

    function _getAgreement(bytes32 agreementId) private view returns (Agreement storage agreement) {
        agreement = _agreements[agreementId];
        if (agreement.status == AgreementStatus.NONE) revert AgreementNotFound(agreementId);
    }

    function _requireAgreementStatus(Agreement storage agreement, AgreementStatus expected) private view {
        if (agreement.status != expected) revert InvalidAgreementStatus(expected, agreement.status);
    }

    function _requireSessionStatus(SessionSettlement storage settlement, SessionStatus expected) private view {
        if (settlement.status != expected) revert InvalidSessionStatus(expected, settlement.status);
    }

    function _deadlineFromNow(uint256 window) private view returns (uint64) {
        uint256 deadline = block.timestamp + window;
        if (deadline > type(uint64).max) revert TimestampOverflow();
        // The explicit upper-bound check above makes this narrowing conversion safe.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(deadline);
    }
}
