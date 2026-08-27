// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {EduConnectEscrow} from "../src/EduConnectEscrow.sol";
import {IEduConnectEscrow} from "../src/interfaces/IEduConnectEscrow.sol";
import {EduTestUSDC} from "../src/mocks/EduTestUSDC.sol";

contract EduConnectEscrowHandler is Test {
    uint256 private constant SESSION_AMOUNT = 4e6;

    EduConnectEscrow public immutable escrow;
    bytes32[] private _agreementIds;
    mapping(bytes32 agreementId => uint32 nextSequence) private _nextSequence;

    constructor(EduConnectEscrow escrow_, bytes32[] memory agreementIds_) {
        escrow = escrow_;
        _agreementIds = agreementIds_;
    }

    function finalizeSession(uint256 agreementSeed, uint8 outcomeSeed) external {
        bytes32 agreementId = _agreementIds[agreementSeed % _agreementIds.length];
        IEduConnectEscrow.Agreement memory agreement = escrow.getAgreement(agreementId);
        if (agreement.status != IEduConnectEscrow.AgreementStatus.FUNDED) return;
        if (uint256(agreement.settledSessions) + uint256(agreement.openSessions) >= agreement.totalSessions) return;

        uint32 sequence = _nextSequence[agreementId]++;
        bytes32 sessionId = keccak256(abi.encode("invariant-session", agreementId, sequence));
        IEduConnectEscrow.Outcome outcome = IEduConnectEscrow.Outcome(bound(outcomeSeed, 0, 2));
        escrow.proposeSessionSettlement(agreementId, sessionId, outcome, keccak256("invariant-evidence"));
        IEduConnectEscrow.SessionSettlement memory settlement = escrow.getSessionSettlement(agreementId, sessionId);
        vm.warp(settlement.disputeDeadline + 1);
        escrow.finalizeSession(agreementId, sessionId);
    }

    function resolveDispute(uint256 agreementSeed, bool complaintApproved) external {
        bytes32 agreementId = _agreementIds[agreementSeed % _agreementIds.length];
        IEduConnectEscrow.Agreement memory agreement = escrow.getAgreement(agreementId);
        if (agreement.status != IEduConnectEscrow.AgreementStatus.FUNDED) return;
        if (uint256(agreement.settledSessions) + uint256(agreement.openSessions) >= agreement.totalSessions) return;

        uint32 sequence = _nextSequence[agreementId]++;
        bytes32 sessionId = keccak256(abi.encode("invariant-dispute", agreementId, sequence));
        escrow.proposeSessionSettlement(
            agreementId, sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT, keccak256("invariant-evidence")
        );
        escrow.openTutorFraudDispute(agreementId, sessionId, keccak256("invariant-dispute-evidence"));
        escrow.resolveTutorFraudDispute(agreementId, sessionId, complaintApproved, keccak256("invariant-resolution"));
    }

    function cancelAgreement(uint256 agreementSeed) external {
        bytes32 agreementId = _agreementIds[agreementSeed % _agreementIds.length];
        IEduConnectEscrow.Agreement memory agreement = escrow.getAgreement(agreementId);
        if (agreement.status != IEduConnectEscrow.AgreementStatus.FUNDED || agreement.openSessions != 0) return;
        escrow.cancelAgreementAndRefundUnused(agreementId, keccak256("invariant-cancel"));
    }

    function sessionAmount() external pure returns (uint256) {
        return SESSION_AMOUNT;
    }
}

contract EduConnectEscrowInvariantTest is StdInvariant, Test {
    uint256 private constant SESSION_AMOUNT = 4e6;
    uint32 private constant TOTAL_SESSIONS = 10;

    EduTestUSDC internal token;
    EduConnectEscrow internal escrow;
    EduConnectEscrowHandler internal handler;
    bytes32[] internal agreementIds;
    mapping(bytes32 agreementId => uint256 fundedAmount) internal fundedAmounts;

    function setUp() public {
        token = new EduTestUSDC();
        escrow = new EduConnectEscrow(address(token), makeAddr("platform"), address(this));

        for (uint256 index = 0; index < 3; index++) {
            address student = makeAddr(string.concat("invariant-student-", vm.toString(index)));
            address tutor = makeAddr(string.concat("invariant-tutor-", vm.toString(index)));
            bytes32 agreementId = keccak256(abi.encode("invariant-agreement", index));
            uint256 totalAmount = SESSION_AMOUNT * TOTAL_SESSIONS;

            agreementIds.push(agreementId);
            fundedAmounts[agreementId] = totalAmount;
            escrow.registerAgreement(
                agreementId,
                student,
                tutor,
                keccak256(abi.encode("invariant-terms", index)),
                totalAmount,
                SESSION_AMOUNT,
                TOTAL_SESSIONS
            );
            token.mint(student, totalAmount);
            vm.prank(student);
            token.approve(address(escrow), totalAmount);
            vm.prank(student);
            escrow.fundAgreement(agreementId);
        }

        handler = new EduConnectEscrowHandler(escrow, agreementIds);
        escrow.grantRole(escrow.OPERATOR_ROLE(), address(handler));
        escrow.grantRole(escrow.ARBITRATOR_ROLE(), address(handler));
        targetContract(address(handler));
    }

    function invariantEscrowBalanceEqualsRemainingLiability() public view {
        uint256 remainingLiability;
        for (uint256 index = 0; index < agreementIds.length; index++) {
            remainingLiability += escrow.getAgreement(agreementIds[index]).remainingAmount;
        }
        assertEq(token.balanceOf(address(escrow)), remainingLiability);
    }

    function invariantAgreementAccountingIsConserved() public view {
        for (uint256 index = 0; index < agreementIds.length; index++) {
            bytes32 agreementId = agreementIds[index];
            IEduConnectEscrow.Agreement memory agreement = escrow.getAgreement(agreementId);
            assertEq(
                agreement.releasedAmount + agreement.refundedAmount + agreement.remainingAmount,
                fundedAmounts[agreementId]
            );
            assertLe(agreement.remainingAmount, agreement.totalAmount);
            assertLe(agreement.settledSessions, agreement.totalSessions);
            assertLe(uint256(agreement.settledSessions) + uint256(agreement.openSessions), agreement.totalSessions);
        }
    }
}
