// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";

import {EduConnectEscrow} from "../src/EduConnectEscrow.sol";
import {IEduConnectEscrow} from "../src/interfaces/IEduConnectEscrow.sol";
import {EduTestUSDC} from "../src/mocks/EduTestUSDC.sol";

contract EduConnectEscrowTest is Test {
    uint256 internal constant USDC = 1e6;
    uint256 internal constant TOTAL_AMOUNT = 40 * USDC;
    uint256 internal constant SESSION_AMOUNT = 4 * USDC;
    uint32 internal constant TOTAL_SESSIONS = 10;

    bytes32 internal constant AGREEMENT_ID = keccak256("agreement-1");
    bytes32 internal constant TERMS_HASH = keccak256("terms-v1");
    bytes32 internal constant EVIDENCE_HASH = keccak256("attendance-evidence");
    bytes32 internal constant DISPUTE_HASH = keccak256("student-dispute");
    bytes32 internal constant RESOLUTION_HASH = keccak256("admin-resolution");
    bytes32 internal constant REASON_HASH = keccak256("cancel-reason");

    address internal admin = makeAddr("admin");
    address internal platform = makeAddr("platform");
    address internal student = makeAddr("student");
    address internal tutor = makeAddr("tutor");
    address internal outsider = makeAddr("outsider");

    EduTestUSDC internal token;
    EduConnectEscrow internal escrow;

    function setUp() public {
        token = new EduTestUSDC();
        escrow = new EduConnectEscrow(address(token), platform, admin);
        token.mint(student, 1_000 * USDC);
        vm.prank(student);
        token.approve(address(escrow), type(uint256).max);
    }

    function testConstructorConfiguresTokenWalletAndRoles() public view {
        assertEq(address(escrow.usdc()), address(token));
        assertEq(escrow.platformWallet(), platform);
        assertTrue(escrow.hasRole(escrow.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(escrow.hasRole(escrow.OPERATOR_ROLE(), admin));
        assertTrue(escrow.hasRole(escrow.ARBITRATOR_ROLE(), admin));
        assertFalse(escrow.hasRole(escrow.OPERATOR_ROLE(), outsider));
    }

    function testConstructorRejectsInvalidAddressesAndToken() public {
        vm.expectRevert(EduConnectEscrow.ZeroAddress.selector);
        new EduConnectEscrow(address(0), platform, admin);

        vm.expectRevert(EduConnectEscrow.ZeroAddress.selector);
        new EduConnectEscrow(address(token), address(0), admin);

        vm.expectRevert(EduConnectEscrow.ZeroAddress.selector);
        new EduConnectEscrow(address(token), platform, address(0));

        vm.expectRevert(EduConnectEscrow.InvalidToken.selector);
        new EduConnectEscrow(outsider, platform, admin);
    }

    function testMockUsesSixDecimalsAndCanMint() public {
        assertEq(token.name(), "Edu Test USDC");
        assertEq(token.symbol(), "mUSDC");
        assertEq(token.decimals(), 6);
        token.mint(outsider, USDC);
        assertEq(token.balanceOf(outsider), USDC);
    }

    function testOnlyOperatorCanRegisterAgreement() public {
        vm.prank(outsider);
        vm.expectRevert();
        _registerAsCurrentCaller(AGREEMENT_ID, student, tutor, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);
    }

    function testRegisterAgreementStoresCanonicalValuesAndDeadline() public {
        uint256 registeredAt = block.timestamp;
        _register(AGREEMENT_ID, student, tutor, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);

        IEduConnectEscrow.Agreement memory agreement = escrow.getAgreement(AGREEMENT_ID);
        assertEq(agreement.student, student);
        assertEq(agreement.tutor, tutor);
        assertEq(agreement.termsHash, TERMS_HASH);
        assertEq(agreement.totalAmount, TOTAL_AMOUNT);
        assertEq(agreement.pricePerSession, SESSION_AMOUNT);
        assertEq(agreement.totalSessions, TOTAL_SESSIONS);
        assertEq(agreement.paymentDeadline, registeredAt + 24 hours);
        assertEq(uint8(agreement.status), uint8(IEduConnectEscrow.AgreementStatus.CREATED));
        assertEq(agreement.remainingAmount, 0);
    }

    function testRegisterRejectsDuplicateAndInvalidInput() public {
        _registerDefault();

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(EduConnectEscrow.AgreementAlreadyExists.selector, AGREEMENT_ID));
        _registerAsCurrentCaller(AGREEMENT_ID, student, tutor, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);

        vm.startPrank(admin);
        vm.expectRevert(EduConnectEscrow.InvalidIdentifier.selector);
        _registerAsCurrentCaller(bytes32(0), student, tutor, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);

        vm.expectRevert(EduConnectEscrow.ZeroAddress.selector);
        _registerAsCurrentCaller(
            keccak256("zero-student"), address(0), tutor, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS
        );

        vm.expectRevert(EduConnectEscrow.SameParty.selector);
        _registerAsCurrentCaller(
            keccak256("same-party"), student, student, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS
        );

        vm.expectRevert(EduConnectEscrow.InvalidTermsHash.selector);
        escrow.registerAgreement(
            keccak256("zero-hash"), student, tutor, bytes32(0), TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS
        );

        vm.expectRevert(EduConnectEscrow.InvalidSessionCount.selector);
        _registerAsCurrentCaller(keccak256("zero-sessions"), student, tutor, TOTAL_AMOUNT, SESSION_AMOUNT, 0);

        vm.expectRevert(EduConnectEscrow.InvalidAmount.selector);
        _registerAsCurrentCaller(keccak256("zero-amount"), student, tutor, 0, 0, TOTAL_SESSIONS);

        vm.expectRevert(EduConnectEscrow.AmountMismatch.selector);
        _registerAsCurrentCaller(
            keccak256("amount-mismatch"), student, tutor, TOTAL_AMOUNT + 1, SESSION_AMOUNT, TOTAL_SESSIONS
        );
        vm.stopPrank();
    }

    function testOnlyStudentCanFundAndFundingLocksExactAmount() public {
        _registerDefault();

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(EduConnectEscrow.OnlyStudent.selector, student, outsider));
        escrow.fundAgreement(AGREEMENT_ID);

        uint256 studentBefore = token.balanceOf(student);
        vm.prank(student);
        escrow.fundAgreement(AGREEMENT_ID);

        IEduConnectEscrow.Agreement memory agreement = escrow.getAgreement(AGREEMENT_ID);
        assertEq(token.balanceOf(student), studentBefore - TOTAL_AMOUNT);
        assertEq(token.balanceOf(address(escrow)), TOTAL_AMOUNT);
        assertEq(agreement.remainingAmount, TOTAL_AMOUNT);
        assertEq(uint8(agreement.status), uint8(IEduConnectEscrow.AgreementStatus.FUNDED));
    }

    function testFundingRequiresBalanceAllowanceAndCannotRepeat() public {
        _registerDefault();
        vm.prank(student);
        token.approve(address(escrow), 0);

        vm.prank(student);
        vm.expectRevert();
        escrow.fundAgreement(AGREEMENT_ID);

        vm.prank(student);
        token.approve(address(escrow), TOTAL_AMOUNT);
        vm.prank(student);
        escrow.fundAgreement(AGREEMENT_ID);

        vm.prank(student);
        vm.expectRevert();
        escrow.fundAgreement(AGREEMENT_ID);

        address poorStudent = makeAddr("poor-student");
        bytes32 poorAgreement = keccak256("poor-agreement");
        _register(poorAgreement, poorStudent, tutor, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);
        vm.prank(poorStudent);
        token.approve(address(escrow), TOTAL_AMOUNT);
        vm.prank(poorStudent);
        vm.expectRevert();
        escrow.fundAgreement(poorAgreement);
    }

    function testCannotFundAfterDeadlineAndCanExpire() public {
        _registerDefault();
        IEduConnectEscrow.Agreement memory agreement = escrow.getAgreement(AGREEMENT_ID);
        vm.warp(agreement.paymentDeadline + 1);

        vm.prank(student);
        vm.expectRevert(
            abi.encodeWithSelector(EduConnectEscrow.PaymentDeadlinePassed.selector, agreement.paymentDeadline)
        );
        escrow.fundAgreement(AGREEMENT_ID);

        vm.prank(admin);
        escrow.expireAgreement(AGREEMENT_ID);
        agreement = escrow.getAgreement(AGREEMENT_ID);
        assertEq(uint8(agreement.status), uint8(IEduConnectEscrow.AgreementStatus.EXPIRED));
    }

    function testCannotExpireBeforeDeadlineOrAfterFunding() public {
        _registerDefault();
        IEduConnectEscrow.Agreement memory agreement = escrow.getAgreement(AGREEMENT_ID);
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(EduConnectEscrow.PaymentDeadlineNotPassed.selector, agreement.paymentDeadline)
        );
        escrow.expireAgreement(AGREEMENT_ID);

        _fundDefault();
        vm.warp(agreement.paymentDeadline + 1);
        vm.prank(admin);
        vm.expectRevert();
        escrow.expireAgreement(AGREEMENT_ID);
    }

    function testCannotProposeBeforeFundingOrDuplicateSession() public {
        _registerDefault();
        vm.prank(admin);
        vm.expectRevert();
        escrow.proposeSessionSettlement(
            AGREEMENT_ID, _sessionId(1), IEduConnectEscrow.Outcome.BOTH_PRESENT, EVIDENCE_HASH
        );

        _fundDefault();
        _propose(_sessionId(1), IEduConnectEscrow.Outcome.BOTH_PRESENT);
        vm.prank(admin);
        vm.expectRevert();
        escrow.proposeSessionSettlement(
            AGREEMENT_ID, _sessionId(1), IEduConnectEscrow.Outcome.BOTH_PRESENT, EVIDENCE_HASH
        );
    }

    function testCannotAllocateMoreSessionsThanAgreementTotal() public {
        bytes32 oneSessionAgreement = keccak256("one-session");
        _register(oneSessionAgreement, student, tutor, SESSION_AMOUNT, SESSION_AMOUNT, 1);
        _fund(oneSessionAgreement, student);
        _proposeFor(oneSessionAgreement, _sessionId(1), IEduConnectEscrow.Outcome.BOTH_PRESENT);

        vm.prank(admin);
        vm.expectRevert(EduConnectEscrow.AllSessionsAllocated.selector);
        escrow.proposeSessionSettlement(
            oneSessionAgreement, _sessionId(2), IEduConnectEscrow.Outcome.BOTH_PRESENT, EVIDENCE_HASH
        );
    }

    function testCannotFinalizeBeforeDisputeDeadline() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _propose(sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT);
        IEduConnectEscrow.SessionSettlement memory settlement = escrow.getSessionSettlement(AGREEMENT_ID, sessionId);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(EduConnectEscrow.DisputeWindowOpen.selector, settlement.disputeDeadline));
        escrow.finalizeSession(AGREEMENT_ID, sessionId);
    }

    function testFinalizeBothPresentPaysEightyFiveFifteen() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _proposeAndWarp(sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT);

        uint256 tutorBefore = token.balanceOf(tutor);
        uint256 platformBefore = token.balanceOf(platform);
        vm.prank(admin);
        escrow.finalizeSession(AGREEMENT_ID, sessionId);

        assertEq(token.balanceOf(tutor) - tutorBefore, 3_400_000);
        assertEq(token.balanceOf(platform) - platformBefore, 600_000);
        _assertAfterOneSession(sessionId, IEduConnectEscrow.SessionStatus.SETTLED, 36 * USDC, 4 * USDC, 0);
    }

    function testFinalizeStudentAbsentPaysFortyFiveTenFortyFive() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _proposeAndWarp(sessionId, IEduConnectEscrow.Outcome.STUDENT_ABSENT_TUTOR_PRESENT);

        uint256 tutorBefore = token.balanceOf(tutor);
        uint256 platformBefore = token.balanceOf(platform);
        uint256 studentBefore = token.balanceOf(student);
        vm.prank(admin);
        escrow.finalizeSession(AGREEMENT_ID, sessionId);

        assertEq(token.balanceOf(tutor) - tutorBefore, 1_800_000);
        assertEq(token.balanceOf(platform) - platformBefore, 400_000);
        assertEq(token.balanceOf(student) - studentBefore, 1_800_000);
        _assertAfterOneSession(sessionId, IEduConnectEscrow.SessionStatus.SETTLED, 36 * USDC, 2_200_000, 1_800_000);
    }

    function testFinalizeTutorAbsentRefundsStudentFully() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _proposeAndWarp(sessionId, IEduConnectEscrow.Outcome.TUTOR_ABSENT);

        uint256 studentBefore = token.balanceOf(student);
        vm.prank(admin);
        escrow.finalizeSession(AGREEMENT_ID, sessionId);

        assertEq(token.balanceOf(student) - studentBefore, SESSION_AMOUNT);
        assertEq(token.balanceOf(tutor), 0);
        assertEq(token.balanceOf(platform), 0);
        _assertAfterOneSession(sessionId, IEduConnectEscrow.SessionStatus.REFUNDED, 36 * USDC, 0, SESSION_AMOUNT);
    }

    function testSessionCannotSettleTwice() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _proposeAndWarp(sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT);
        vm.prank(admin);
        escrow.finalizeSession(AGREEMENT_ID, sessionId);

        vm.prank(admin);
        vm.expectRevert();
        escrow.finalizeSession(AGREEMENT_ID, sessionId);
    }

    function testOnlyBothPresentCanOpenTutorFraudDispute() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _propose(sessionId, IEduConnectEscrow.Outcome.STUDENT_ABSENT_TUTOR_PRESENT);

        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                EduConnectEscrow.InvalidDisputeOutcome.selector, IEduConnectEscrow.Outcome.STUDENT_ABSENT_TUTOR_PRESENT
            )
        );
        escrow.openTutorFraudDispute(AGREEMENT_ID, sessionId, DISPUTE_HASH);
    }

    function testDisputeMustOpenWithinWindowWithEvidence() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _propose(sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT);

        vm.prank(admin);
        vm.expectRevert(EduConnectEscrow.InvalidEvidenceHash.selector);
        escrow.openTutorFraudDispute(AGREEMENT_ID, sessionId, bytes32(0));

        IEduConnectEscrow.SessionSettlement memory settlement = escrow.getSessionSettlement(AGREEMENT_ID, sessionId);
        vm.warp(settlement.disputeDeadline + 1);
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(EduConnectEscrow.DisputeWindowClosed.selector, settlement.disputeDeadline)
        );
        escrow.openTutorFraudDispute(AGREEMENT_ID, sessionId, DISPUTE_HASH);
    }

    function testDisputeBlocksFinalizeEvenAfterWindow() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _propose(sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT);
        _openDispute(sessionId);
        IEduConnectEscrow.SessionSettlement memory settlement = escrow.getSessionSettlement(AGREEMENT_ID, sessionId);
        vm.warp(settlement.disputeDeadline + 1);

        vm.prank(admin);
        vm.expectRevert();
        escrow.finalizeSession(AGREEMENT_ID, sessionId);
    }

    function testApprovedComplaintRefundsStudentFully() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _propose(sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT);
        _openDispute(sessionId);

        uint256 studentBefore = token.balanceOf(student);
        vm.prank(admin);
        escrow.resolveTutorFraudDispute(AGREEMENT_ID, sessionId, true, RESOLUTION_HASH);

        assertEq(token.balanceOf(student) - studentBefore, SESSION_AMOUNT);
        _assertAfterOneSession(sessionId, IEduConnectEscrow.SessionStatus.REFUNDED, 36 * USDC, 0, SESSION_AMOUNT);
    }

    function testRejectedComplaintPaysEightyFiveFifteen() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _propose(sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT);
        _openDispute(sessionId);

        vm.prank(admin);
        escrow.resolveTutorFraudDispute(AGREEMENT_ID, sessionId, false, RESOLUTION_HASH);

        assertEq(token.balanceOf(tutor), 3_400_000);
        assertEq(token.balanceOf(platform), 600_000);
        _assertAfterOneSession(sessionId, IEduConnectEscrow.SessionStatus.SETTLED, 36 * USDC, SESSION_AMOUNT, 0);
    }

    function testOnlyArbitratorCanResolveAndCannotResolveTwice() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _propose(sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT);
        _openDispute(sessionId);

        vm.prank(outsider);
        vm.expectRevert();
        escrow.resolveTutorFraudDispute(AGREEMENT_ID, sessionId, true, RESOLUTION_HASH);

        vm.prank(admin);
        escrow.resolveTutorFraudDispute(AGREEMENT_ID, sessionId, true, RESOLUTION_HASH);
        vm.prank(admin);
        vm.expectRevert();
        escrow.resolveTutorFraudDispute(AGREEMENT_ID, sessionId, true, RESOLUTION_HASH);
    }

    function testCancellationRefundsOnlyUnusedAmount() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _proposeAndWarp(sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT);
        vm.prank(admin);
        escrow.finalizeSession(AGREEMENT_ID, sessionId);

        uint256 studentBefore = token.balanceOf(student);
        vm.prank(admin);
        escrow.cancelAgreementAndRefundUnused(AGREEMENT_ID, REASON_HASH);

        IEduConnectEscrow.Agreement memory agreement = escrow.getAgreement(AGREEMENT_ID);
        assertEq(token.balanceOf(student) - studentBefore, 36 * USDC);
        assertEq(agreement.remainingAmount, 0);
        assertEq(agreement.releasedAmount, SESSION_AMOUNT);
        assertEq(agreement.refundedAmount, 36 * USDC);
        assertEq(uint8(agreement.status), uint8(IEduConnectEscrow.AgreementStatus.CANCELLED));
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testCancellationRequiresArbitratorAndNoOpenSession() public {
        _registerAndFundDefault();
        _propose(_sessionId(1), IEduConnectEscrow.Outcome.BOTH_PRESENT);

        vm.prank(outsider);
        vm.expectRevert();
        escrow.cancelAgreementAndRefundUnused(AGREEMENT_ID, REASON_HASH);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(EduConnectEscrow.OpenSessionsExist.selector, 1));
        escrow.cancelAgreementAndRefundUnused(AGREEMENT_ID, REASON_HASH);
    }

    function testPauseBlocksNormalFlowButAllowsResolutionAndRefund() public {
        _registerAndFundDefault();
        bytes32 disputedSession = _sessionId(1);
        _propose(disputedSession, IEduConnectEscrow.Outcome.BOTH_PRESENT);
        _openDispute(disputedSession);

        vm.prank(admin);
        escrow.pause();

        vm.prank(admin);
        vm.expectRevert();
        _registerAsCurrentCaller(
            keccak256("paused-register"), student, tutor, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS
        );

        vm.prank(admin);
        vm.expectRevert();
        escrow.proposeSessionSettlement(
            AGREEMENT_ID, _sessionId(2), IEduConnectEscrow.Outcome.BOTH_PRESENT, EVIDENCE_HASH
        );

        vm.prank(admin);
        escrow.resolveTutorFraudDispute(AGREEMENT_ID, disputedSession, true, RESOLUTION_HASH);

        vm.prank(admin);
        escrow.cancelAgreementAndRefundUnused(AGREEMENT_ID, REASON_HASH);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testPauseBlocksFunding() public {
        _registerDefault();
        vm.prank(admin);
        escrow.pause();

        vm.prank(student);
        vm.expectRevert();
        escrow.fundAgreement(AGREEMENT_ID);
    }

    function testPauseBlocksOrdinaryFinalize() public {
        _registerAndFundDefault();
        bytes32 sessionId = _sessionId(1);
        _proposeAndWarp(sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT);
        vm.prank(admin);
        escrow.pause();

        vm.prank(admin);
        vm.expectRevert();
        escrow.finalizeSession(AGREEMENT_ID, sessionId);
    }

    function testOnlyAdminCanPauseAndUnpause() public {
        vm.prank(outsider);
        vm.expectRevert();
        escrow.pause();

        vm.prank(admin);
        escrow.pause();
        assertTrue(escrow.paused());

        vm.prank(outsider);
        vm.expectRevert();
        escrow.unpause();

        vm.prank(admin);
        escrow.unpause();
        assertFalse(escrow.paused());
    }

    function testOneMasterContractKeepsAgreementsIsolated() public {
        address studentTwo = makeAddr("student-two");
        address tutorTwo = makeAddr("tutor-two");
        bytes32 agreementTwo = keccak256("agreement-two");
        token.mint(studentTwo, 20 * USDC);
        vm.prank(studentTwo);
        token.approve(address(escrow), type(uint256).max);

        _registerAndFundDefault();
        _register(agreementTwo, studentTwo, tutorTwo, 20 * USDC, 2 * USDC, 10);
        _fund(agreementTwo, studentTwo);

        _proposeAndWarp(_sessionId(1), IEduConnectEscrow.Outcome.BOTH_PRESENT);
        vm.prank(admin);
        escrow.finalizeSession(AGREEMENT_ID, _sessionId(1));

        IEduConnectEscrow.Agreement memory first = escrow.getAgreement(AGREEMENT_ID);
        IEduConnectEscrow.Agreement memory second = escrow.getAgreement(agreementTwo);
        assertEq(first.remainingAmount, 36 * USDC);
        assertEq(second.remainingAmount, 20 * USDC);
        assertEq(second.settledSessions, 0);
        assertEq(token.balanceOf(address(escrow)), 56 * USDC);
    }

    function testOneSessionAgreementCompletesWithZeroRemaining() public {
        bytes32 oneSessionAgreement = keccak256("complete-one-session");
        bytes32 sessionId = keccak256("only-session");
        _register(oneSessionAgreement, student, tutor, SESSION_AMOUNT, SESSION_AMOUNT, 1);
        _fund(oneSessionAgreement, student);
        _proposeFor(oneSessionAgreement, sessionId, IEduConnectEscrow.Outcome.BOTH_PRESENT);
        IEduConnectEscrow.SessionSettlement memory settlement =
            escrow.getSessionSettlement(oneSessionAgreement, sessionId);
        vm.warp(settlement.disputeDeadline + 1);
        vm.prank(admin);
        escrow.finalizeSession(oneSessionAgreement, sessionId);

        IEduConnectEscrow.Agreement memory agreement = escrow.getAgreement(oneSessionAgreement);
        assertEq(agreement.remainingAmount, 0);
        assertEq(agreement.settledSessions, 1);
        assertEq(uint8(agreement.status), uint8(IEduConnectEscrow.AgreementStatus.COMPLETED));
    }

    function testFuzzPayoutAlwaysConservesSessionAmount(uint128 rawAmount, uint8 rawOutcome) public {
        uint256 amount = bound(uint256(rawAmount), 1, type(uint96).max);
        IEduConnectEscrow.Outcome outcome = IEduConnectEscrow.Outcome(bound(rawOutcome, 0, 2));
        bytes32 agreementId = keccak256(abi.encode("fuzz-agreement", amount, rawOutcome));
        bytes32 sessionId = keccak256(abi.encode("fuzz-session", amount, rawOutcome));

        token.mint(student, amount);
        _register(agreementId, student, tutor, amount, amount, 1);
        _fund(agreementId, student);
        _proposeFor(agreementId, sessionId, outcome);
        IEduConnectEscrow.SessionSettlement memory settlement = escrow.getSessionSettlement(agreementId, sessionId);
        vm.warp(settlement.disputeDeadline + 1);

        uint256 tutorBefore = token.balanceOf(tutor);
        uint256 platformBefore = token.balanceOf(platform);
        uint256 studentBefore = token.balanceOf(student);
        vm.prank(admin);
        escrow.finalizeSession(agreementId, sessionId);

        uint256 distributed = (token.balanceOf(tutor) - tutorBefore) + (token.balanceOf(platform) - platformBefore)
            + (token.balanceOf(student) - studentBefore);
        assertEq(distributed, amount);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function _registerDefault() internal {
        _register(AGREEMENT_ID, student, tutor, TOTAL_AMOUNT, SESSION_AMOUNT, TOTAL_SESSIONS);
    }

    function _fundDefault() internal {
        _fund(AGREEMENT_ID, student);
    }

    function _registerAndFundDefault() internal {
        _registerDefault();
        _fundDefault();
    }

    function _register(
        bytes32 agreementId,
        address agreementStudent,
        address agreementTutor,
        uint256 totalAmount,
        uint256 pricePerSession,
        uint32 totalSessions
    ) internal {
        vm.prank(admin);
        _registerAsCurrentCaller(
            agreementId, agreementStudent, agreementTutor, totalAmount, pricePerSession, totalSessions
        );
    }

    function _registerAsCurrentCaller(
        bytes32 agreementId,
        address agreementStudent,
        address agreementTutor,
        uint256 totalAmount,
        uint256 pricePerSession,
        uint32 totalSessions
    ) internal {
        escrow.registerAgreement(
            agreementId, agreementStudent, agreementTutor, TERMS_HASH, totalAmount, pricePerSession, totalSessions
        );
    }

    function _fund(bytes32 agreementId, address agreementStudent) internal {
        vm.prank(agreementStudent);
        escrow.fundAgreement(agreementId);
    }

    function _propose(bytes32 sessionId, IEduConnectEscrow.Outcome outcome) internal {
        _proposeFor(AGREEMENT_ID, sessionId, outcome);
    }

    function _proposeFor(bytes32 agreementId, bytes32 sessionId, IEduConnectEscrow.Outcome outcome) internal {
        vm.prank(admin);
        escrow.proposeSessionSettlement(agreementId, sessionId, outcome, EVIDENCE_HASH);
    }

    function _proposeAndWarp(bytes32 sessionId, IEduConnectEscrow.Outcome outcome) internal {
        _propose(sessionId, outcome);
        IEduConnectEscrow.SessionSettlement memory settlement = escrow.getSessionSettlement(AGREEMENT_ID, sessionId);
        vm.warp(settlement.disputeDeadline + 1);
    }

    function _openDispute(bytes32 sessionId) internal {
        vm.prank(admin);
        escrow.openTutorFraudDispute(AGREEMENT_ID, sessionId, DISPUTE_HASH);
    }

    function _sessionId(uint256 sequence) internal pure returns (bytes32) {
        return keccak256(abi.encode("session", sequence));
    }

    function _assertAfterOneSession(
        bytes32 sessionId,
        IEduConnectEscrow.SessionStatus expectedStatus,
        uint256 expectedRemaining,
        uint256 expectedReleased,
        uint256 expectedRefunded
    ) internal view {
        IEduConnectEscrow.Agreement memory agreement = escrow.getAgreement(AGREEMENT_ID);
        IEduConnectEscrow.SessionSettlement memory settlement = escrow.getSessionSettlement(AGREEMENT_ID, sessionId);
        assertEq(uint8(settlement.status), uint8(expectedStatus));
        assertEq(agreement.remainingAmount, expectedRemaining);
        assertEq(agreement.releasedAmount, expectedReleased);
        assertEq(agreement.refundedAmount, expectedRefunded);
        assertEq(agreement.settledSessions, 1);
        assertEq(agreement.openSessions, 0);
        assertEq(token.balanceOf(address(escrow)), expectedRemaining);
    }
}
