// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";

import {EduConnectEscrowV2} from "../src/EduConnectEscrowV2.sol";
import {IEduConnectEscrow} from "../src/interfaces/IEduConnectEscrow.sol";
import {IEduConnectEscrowV2} from "../src/interfaces/IEduConnectEscrowV2.sol";
import {EduTestUSDC} from "../src/mocks/EduTestUSDC.sol";

contract EduConnectEscrowV2Test is Test {
    uint256 internal constant USDC = 1e6;
    uint256 internal constant TOTAL_AMOUNT = 40 * USDC;
    uint256 internal constant SESSION_AMOUNT = 4 * USDC;
    uint32 internal constant TOTAL_SESSIONS = 10;

    bytes32 internal constant AGREEMENT_ID_1 = keccak256("agreement-1");
    bytes32 internal constant AGREEMENT_ID_2 = keccak256("agreement-2");
    bytes32 internal constant TERMS_HASH = keccak256("terms-v2");
    bytes32 internal constant EVIDENCE_HASH = keccak256("attendance-evidence");
    bytes32 internal constant DISPUTE_HASH = keccak256("dispute-evidence");
    bytes32 internal constant RESOLUTION_HASH = keccak256("resolution-evidence");
    bytes32 internal constant REASON_HASH = keccak256("batch-cancel-reason");

    address internal admin = makeAddr("admin");
    address internal platform = makeAddr("platform");
    address internal student1 = makeAddr("student1");
    address internal student2 = makeAddr("student2");
    address internal tutor = makeAddr("tutor");
    address internal outsider = makeAddr("outsider");

    EduTestUSDC internal token;
    EduConnectEscrowV2 internal escrow;

    function setUp() public {
        token = new EduTestUSDC();
        escrow = new EduConnectEscrowV2(address(token), platform, admin);

        token.mint(student1, 1_000 * USDC);
        token.mint(student2, 1_000 * USDC);

        vm.prank(student1);
        token.approve(address(escrow), type(uint256).max);

        vm.prank(student2);
        token.approve(address(escrow), type(uint256).max);
    }

    // -------------------------------------------------------------
    // HELPERS
    // -------------------------------------------------------------

    function _registerAndFund(bytes32 id, address student, uint256 totalAmount, uint256 pricePerSession, uint32 sessions) internal {
        vm.prank(admin);
        escrow.registerAgreement(id, student, tutor, TERMS_HASH, totalAmount, pricePerSession, sessions);
        vm.prank(student);
        escrow.fundAgreement(id);
    }

    // -------------------------------------------------------------
    // TESTS: TOKEN RESCUE
    // -------------------------------------------------------------

    function testRescueNonUSDCTokenSuccess() public {
        EduTestUSDC otherToken = new EduTestUSDC();
        otherToken.mint(address(escrow), 500 * USDC);

        vm.prank(admin);
        escrow.rescueERC20(address(otherToken), admin, 500 * USDC);

        assertEq(otherToken.balanceOf(admin), 500 * USDC);
        assertEq(otherToken.balanceOf(address(escrow)), 0);
    }

    function testRescueUSDCSurplusSuccess() public {
        _registerAndFund(AGREEMENT_ID_1, student1, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);
        assertEq(escrow.totalEscrowLiability(), TOTAL_AMOUNT);

        // Send 10 USDC surplus to contract directly by mistake
        token.mint(address(escrow), 10 * USDC);
        assertEq(token.balanceOf(address(escrow)), TOTAL_AMOUNT + 10 * USDC);

        // Admin can rescue exactly the surplus
        vm.prank(admin);
        escrow.rescueERC20(address(token), admin, 10 * USDC);

        assertEq(token.balanceOf(admin), 10 * USDC);
        assertEq(token.balanceOf(address(escrow)), TOTAL_AMOUNT);
    }

    function testRescueUSDCRevertsWhenExceedingSurplus() public {
        _registerAndFund(AGREEMENT_ID_1, student1, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);

        // Contract balance = 40 USDC (liability = 40 USDC, surplus = 0)
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                EduConnectEscrowV2.CannotRescueCommittedEscrowFunds.selector,
                1 * USDC,
                0
            )
        );
        escrow.rescueERC20(address(token), admin, 1 * USDC);
    }

    function testRescueOnlyAdmin() public {
        vm.prank(outsider);
        vm.expectRevert();
        escrow.rescueERC20(address(token), outsider, 10 * USDC);
    }

    // -------------------------------------------------------------
    // TESTS: BATCH CANCELLATION
    // -------------------------------------------------------------

    function testBatchCancelAgreementsSuccess() public {
        _registerAndFund(AGREEMENT_ID_1, student1, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);
        _registerAndFund(AGREEMENT_ID_2, student2, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);

        assertEq(escrow.totalEscrowLiability(), TOTAL_AMOUNT * 2);

        bytes32[] memory ids = new bytes32[](2);
        ids[0] = AGREEMENT_ID_1;
        ids[1] = AGREEMENT_ID_2;

        uint256 student1Before = token.balanceOf(student1);
        uint256 student2Before = token.balanceOf(student2);

        vm.prank(admin);
        escrow.batchCancelAgreementsAndRefundUnused(ids, REASON_HASH);

        assertEq(token.balanceOf(student1), student1Before + TOTAL_AMOUNT);
        assertEq(token.balanceOf(student2), student2Before + TOTAL_AMOUNT);
        assertEq(escrow.totalEscrowLiability(), 0);

        IEduConnectEscrow.Agreement memory ag1 = escrow.getAgreement(AGREEMENT_ID_1);
        assertEq(uint8(ag1.status), uint8(IEduConnectEscrow.AgreementStatus.CANCELLED));
        assertEq(ag1.remainingAmount, 0);
        assertEq(ag1.refundedAmount, TOTAL_AMOUNT);

        IEduConnectEscrow.Agreement memory ag2 = escrow.getAgreement(AGREEMENT_ID_2);
        assertEq(uint8(ag2.status), uint8(IEduConnectEscrow.AgreementStatus.CANCELLED));
    }

    function testBatchCancelRevertsOnEmptyArray() public {
        bytes32[] memory emptyIds = new bytes32[](0);
        vm.prank(admin);
        vm.expectRevert(EduConnectEscrowV2.EmptyBatchArray.selector);
        escrow.batchCancelAgreementsAndRefundUnused(emptyIds, REASON_HASH);
    }

    // -------------------------------------------------------------
    // TESTS: EXTENDED DISPUTE & RESOLUTION
    // -------------------------------------------------------------

    function testOpenDisputeOnStudentAbsentTutorPresent() public {
        _registerAndFund(AGREEMENT_ID_1, student1, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);
        bytes32 sessionId = keccak256("session-1");

        // Operator proposes STUDENT_ABSENT_TUTOR_PRESENT
        vm.prank(admin);
        escrow.proposeSessionSettlement(
            AGREEMENT_ID_1,
            sessionId,
            IEduConnectEscrow.Outcome.STUDENT_ABSENT_TUTOR_PRESENT,
            EVIDENCE_HASH
        );

        // V2 allows dispute on STUDENT_ABSENT_TUTOR_PRESENT
        vm.prank(admin);
        escrow.openDispute(AGREEMENT_ID_1, sessionId, DISPUTE_HASH);

        IEduConnectEscrow.SessionSettlement memory s = escrow.getSessionSettlement(AGREEMENT_ID_1, sessionId);
        assertEq(uint8(s.status), uint8(IEduConnectEscrow.SessionStatus.DISPUTED));
        assertEq(s.disputeEvidenceHash, DISPUTE_HASH);
    }

    function testResolveDisputeWithStudentAbsentTutorPresentOutcome() public {
        _registerAndFund(AGREEMENT_ID_1, student1, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);
        bytes32 sessionId = keccak256("session-1");

        vm.prank(admin);
        escrow.proposeSessionSettlement(
            AGREEMENT_ID_1,
            sessionId,
            IEduConnectEscrow.Outcome.BOTH_PRESENT,
            EVIDENCE_HASH
        );

        vm.prank(admin);
        escrow.openDispute(AGREEMENT_ID_1, sessionId, DISPUTE_HASH);

        uint256 tutorBefore = token.balanceOf(tutor);
        uint256 platformBefore = token.balanceOf(platform);
        uint256 studentBefore = token.balanceOf(student1);

        // Arbitrator decides finalOutcome = STUDENT_ABSENT_TUTOR_PRESENT (45% tutor, 10% platform, 45% student refund)
        vm.prank(admin);
        escrow.resolveDispute(
            AGREEMENT_ID_1,
            sessionId,
            IEduConnectEscrow.Outcome.STUDENT_ABSENT_TUTOR_PRESENT,
            RESOLUTION_HASH
        );

        uint256 expectedTutor = SESSION_AMOUNT * 4_500 / 10_000;
        uint256 expectedPlatform = SESSION_AMOUNT * 1_000 / 10_000;
        uint256 expectedStudentRefund = SESSION_AMOUNT - expectedTutor - expectedPlatform;

        assertEq(token.balanceOf(tutor), tutorBefore + expectedTutor);
        assertEq(token.balanceOf(platform), platformBefore + expectedPlatform);
        assertEq(token.balanceOf(student1), studentBefore + expectedStudentRefund);
        assertEq(escrow.totalEscrowLiability(), TOTAL_AMOUNT - SESSION_AMOUNT);
    }

    function testResolveDisputeWithTutorAbsentOutcome() public {
        _registerAndFund(AGREEMENT_ID_1, student1, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);
        bytes32 sessionId = keccak256("session-1");

        vm.prank(admin);
        escrow.proposeSessionSettlement(
            AGREEMENT_ID_1,
            sessionId,
            IEduConnectEscrow.Outcome.BOTH_PRESENT,
            EVIDENCE_HASH
        );

        vm.prank(admin);
        escrow.openDispute(AGREEMENT_ID_1, sessionId, DISPUTE_HASH);

        uint256 studentBefore = token.balanceOf(student1);

        // Arbitrator decides finalOutcome = TUTOR_ABSENT (100% refund)
        vm.prank(admin);
        escrow.resolveDispute(
            AGREEMENT_ID_1,
            sessionId,
            IEduConnectEscrow.Outcome.TUTOR_ABSENT,
            RESOLUTION_HASH
        );

        assertEq(token.balanceOf(student1), studentBefore + SESSION_AMOUNT);
        assertEq(escrow.totalEscrowLiability(), TOTAL_AMOUNT - SESSION_AMOUNT);
    }
}
