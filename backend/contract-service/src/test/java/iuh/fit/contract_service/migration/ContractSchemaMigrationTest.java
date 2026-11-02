package iuh.fit.contract_service.migration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
class ContractSchemaMigrationTest {
    private static final String MAX_UINT256_DECIMAL =
            "115792089237316195423570985008687907853269984665640564039457584007913129639935";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void removeTrialRowsCreatedByMigrationTests() {
        jdbcTemplate.update("DELETE FROM tutor_absence_probation");
        jdbcTemplate.update("DELETE FROM class_tutor_attendance_signal");
        jdbcTemplate.update("DELETE FROM agreement_trial");
        jdbcTemplate.update("DELETE FROM termination_item");
        jdbcTemplate.update("DELETE FROM termination_case");
    }

    @Test
    void storesUint256SizedAmountsWithoutFloatingPointLoss() {
        UUID agreementId = UUID.randomUUID();
        insertAgreement(agreementId, 1001, 2001, 1, new BigDecimal(MAX_UINT256_DECIMAL));

        BigDecimal stored = jdbcTemplate.queryForObject(
                "SELECT total_amount_usdc_units FROM contract_agreement WHERE id = ?",
                BigDecimal.class,
                agreementId);

        assertEquals(new BigDecimal(MAX_UINT256_DECIMAL), stored);
    }

    @Test
    void rejectsDuplicateAgreementBusinessKey() {
        insertAgreement(UUID.randomUUID(), 1002, 2002, 1, BigDecimal.valueOf(40_000_000));

        assertThrows(DataIntegrityViolationException.class,
                () -> insertAgreement(UUID.randomUUID(), 1002, 2002, 1,
                        BigDecimal.valueOf(40_000_000)));
    }

    @Test
    void rejectsDuplicateBlockchainCommandIdempotencyKey() {
        String sql = """
                INSERT INTO blockchain_transaction (
                    id, idempotency_key, action, chain_id, from_address, to_address,
                    calldata_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        Object[] command = {
                UUID.randomUUID(), "REGISTER:31337:agreement-1", "REGISTER_AGREEMENT", 31_337L,
                "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
                "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
                "0x729fd3bac149a0c2bb6fa80f6f61a6cf6ad8abd63211178d47b396c088a04cec",
                "CREATED", OffsetDateTime.now(), OffsetDateTime.now()
        };
        jdbcTemplate.update(sql, command);
        command[0] = UUID.randomUUID();

        assertThrows(DataIntegrityViolationException.class,
                () -> jdbcTemplate.update(sql, command));
    }

    @Test
    void rejectsSameEventForSameConsumerButAllowsAnotherConsumer() {
        UUID eventId = UUID.randomUUID();
        insertProcessedEvent(UUID.randomUUID(), "contract-agreement-consumer", eventId);

        assertThrows(DataIntegrityViolationException.class,
                () -> insertProcessedEvent(UUID.randomUUID(), "contract-agreement-consumer", eventId));

        insertProcessedEvent(UUID.randomUUID(), "notification-consumer", eventId);
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processed_event WHERE event_id = ?",
                Integer.class,
                eventId);
        assertEquals(2, count);
    }

    @Test
    void legacyAgreementDoesNotRequireTrialRow() {
        UUID agreementId = UUID.randomUUID();
        insertAgreement(agreementId, 1003, 2003, 3, BigDecimal.valueOf(40_000_000));

        Integer trialRows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM agreement_trial WHERE agreement_id = ?",
                Integer.class,
                agreementId);

        assertEquals(0, trialRows);
    }

    @Test
    void agreementTrialAcceptsValidSnapshotAndRejectsInvalidState() {
        OffsetDateTime firstSession = OffsetDateTime.parse("2026-11-02T18:00:00+07:00");
        OffsetDateTime secondSession = OffsetDateTime.parse("2026-11-04T18:00:00+07:00");
        UUID validAgreementId = UUID.randomUUID();
        insertAgreement(validAgreementId, 1004, 2004, 4, BigDecimal.valueOf(40_000_000));

        insertTrial(validAgreementId, firstSession, secondSession, "NOT_STARTED", null, null);

        String storedStatus = jdbcTemplate.queryForObject(
                "SELECT status FROM agreement_trial WHERE agreement_id = ?",
                String.class,
                validAgreementId);
        assertEquals("NOT_STARTED", storedStatus);

        UUID invalidStatusAgreementId = UUID.randomUUID();
        insertAgreement(invalidStatusAgreementId, 1005, 2005, 4, BigDecimal.valueOf(40_000_000));
        assertThrows(DataIntegrityViolationException.class,
                () -> insertTrial(invalidStatusAgreementId, firstSession, secondSession,
                        "UNKNOWN", null, null));

        UUID inconsistentAgreementId = UUID.randomUUID();
        insertAgreement(inconsistentAgreementId, 1006, 2006, 4, BigDecimal.valueOf(40_000_000));
        assertThrows(DataIntegrityViolationException.class,
                () -> insertTrial(inconsistentAgreementId, firstSession, secondSession,
                        "CONTINUED", "AUTO_DEADLINE", null));
    }

    @Test
    void agreementTrialValidatesOptOutAndLateFundingConstraints() {
        OffsetDateTime firstSession = OffsetDateTime.parse("2026-11-02T18:00:00+07:00");
        OffsetDateTime secondSession = OffsetDateTime.parse("2026-11-04T18:00:00+07:00");
        OffsetDateTime now = OffsetDateTime.now();

        // 1. OPT_OUT_PENDING without termination_case_id or opt_out_received_at must fail
        UUID optOutAgreementId = UUID.randomUUID();
        insertAgreement(optOutAgreementId, 1007, 2007, 4, BigDecimal.valueOf(40_000_000));
        assertThrows(DataIntegrityViolationException.class, () -> {
            jdbcTemplate.update("""
                INSERT INTO agreement_trial (
                    agreement_id, policy_version, trial_session_sequence, next_session_sequence,
                    trial_session_start_at, trial_deadline, schedule_fingerprint, status,
                    decision_source, decision_at
                ) VALUES (?, 1, 1, 2, ?, ?, '8f762c047d43e36feae680100789e39d9dc3512deaa6bb884d755e57e790628d',
                    'OPT_OUT_PENDING', 'STUDENT_OPT_OUT', ?)
                """, optOutAgreementId, firstSession, secondSession, now);
        });

        // 2. LATE_FUNDING_RECOVERY without termination_case_id must fail
        UUID lateFundingAgreementId = UUID.randomUUID();
        insertAgreement(lateFundingAgreementId, 1008, 2008, 4, BigDecimal.valueOf(40_000_000));
        assertThrows(DataIntegrityViolationException.class, () -> {
            jdbcTemplate.update("""
                INSERT INTO agreement_trial (
                    agreement_id, policy_version, trial_session_sequence, next_session_sequence,
                    trial_session_start_at, trial_deadline, schedule_fingerprint, status,
                    decision_source, decision_at
                ) VALUES (?, 1, 1, 2, ?, ?, '8f762c047d43e36feae680100789e39d9dc3512deaa6bb884d755e57e790628d',
                    'LATE_FUNDING_RECOVERY', 'SYSTEM_LATE_FUNDING', ?)
                """, lateFundingAgreementId, firstSession, secondSession, now);
        });

        // 3. Valid LATE_FUNDING_RECOVERY with termination_case_id succeeds
        UUID caseId = UUID.randomUUID();
        insertTerminationCase(caseId, lateFundingAgreementId, "SYSTEM_LATE_FUNDING");
        jdbcTemplate.update("""
            INSERT INTO agreement_trial (
                agreement_id, policy_version, trial_session_sequence, next_session_sequence,
                trial_session_start_at, trial_deadline, schedule_fingerprint, status,
                decision_source, decision_at, termination_case_id
            ) VALUES (?, 1, 1, 2, ?, ?, '8f762c047d43e36feae680100789e39d9dc3512deaa6bb884d755e57e790628d',
                'LATE_FUNDING_RECOVERY', 'SYSTEM_LATE_FUNDING', ?, ?)
            """, lateFundingAgreementId, firstSession, secondSession, now, caseId);

        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM agreement_trial WHERE agreement_id = ?",
                String.class, lateFundingAgreementId);
        assertEquals("LATE_FUNDING_RECOVERY", status);
    }

    private void insertTerminationCase(UUID id, UUID anchorAgreementId, String origin) {
        jdbcTemplate.update("""
            INSERT INTO termination_case (
                id, anchor_agreement_id, classroom_id, whole_class, reason,
                requested_by, status, origin, created_at, updated_at, audit_json, version
            ) VALUES (?, ?, 1, false, 'Late funding recovery test', 'system', 'HOLD_PENDING', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]', 0)
            """, id, anchorAgreementId, origin);
    }

    private void insertAgreement(UUID id, long classroomId, long studentId, int version, BigDecimal amount) {
        jdbcTemplate.update("""
                        INSERT INTO contract_agreement (
                            id, classroom_id, student_id, tutor_id, classroom_reviewer_email,
                            student_wallet, tutor_wallet, platform_wallet, terms_json, terms_hash,
                            contract_version, total_price_vnd, vnd_per_usdc,
                            total_amount_usdc_units, price_per_session_usdc_units,
                            total_sessions, status, legacy_excluded, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)
                        """,
                id, classroomId, studentId, 3001L, "staff@educonnect.test",
                "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
                "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
                "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
                "{}", "0x729fd3bac149a0c2bb6fa80f6f61a6cf6ad8abd63211178d47b396c088a04cec",
                version, BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(25_000),
                amount, BigDecimal.ONE, 10, "DRAFT", OffsetDateTime.now(), OffsetDateTime.now());
    }

    private void insertProcessedEvent(UUID id, String consumer, UUID eventId) {
        jdbcTemplate.update("""
                        INSERT INTO processed_event (id, consumer_name, event_id, event_type, processed_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                id, consumer, eventId, "enrollment.request.accepted.v1", OffsetDateTime.now());
    }

    private void insertTrial(
            UUID agreementId,
            OffsetDateTime trialSessionStart,
            OffsetDateTime trialDeadline,
            String status,
            String decisionSource,
            OffsetDateTime decisionAt) {
        jdbcTemplate.update("""
                        INSERT INTO agreement_trial (
                            agreement_id, policy_version,
                            trial_session_sequence, next_session_sequence,
                            trial_session_start_at, trial_deadline,
                            schedule_fingerprint, status, decision_source, decision_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                agreementId, 1, 1, 2,
                trialSessionStart, trialDeadline,
                "8f762c047d43e36feae680100789e39d9dc3512deaa6bb884d755e57e790628d",
                status, decisionSource, decisionAt);
    }

    @Test
    void storesAndEnforcesAbsenceGovernanceCaseConstraints() {
        UUID agreementId = UUID.randomUUID();
        insertAgreement(agreementId, 1009, 2009, 1, BigDecimal.valueOf(10_000_000));

        UUID caseId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime nextStart = now.plusHours(48);
        OffsetDateTime responseDeadline = now.plusHours(24);
        OffsetDateTime decisionDeadline = nextStart;

        jdbcTemplate.update("""
                INSERT INTO termination_case (
                    id, anchor_agreement_id, classroom_id, whole_class, reason, requested_by,
                    status, origin, created_at, updated_at, audit_json, version,
                    absence_governance_version, trigger_session_sequence, next_session_sequence,
                    next_session_start_at, response_deadline, decision_deadline, hold_command_id
                ) VALUES (?, ?, 1009, true, 'Absence test', 'system', 'HOLD_PENDING', 'AUTO_TUTOR_ABSENCE',
                          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]', 0,
                          1, 3, 4, ?, ?, ?, ?)
                """, caseId, agreementId, nextStart, responseDeadline, decisionDeadline, UUID.randomUUID());

        Integer triggerSeq = jdbcTemplate.queryForObject(
                "SELECT trigger_session_sequence FROM termination_case WHERE id = ?",
                Integer.class, caseId);
        assertEquals(3, triggerSeq);

        // Reject invalid next sequence <= trigger sequence
        UUID invalidSeqCaseId = UUID.randomUUID();
        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("""
                INSERT INTO termination_case (
                    id, anchor_agreement_id, classroom_id, whole_class, reason, requested_by,
                    status, origin, created_at, updated_at, audit_json, version,
                    absence_governance_version, trigger_session_sequence, next_session_sequence,
                    next_session_start_at, response_deadline, decision_deadline, hold_command_id
                ) VALUES (?, ?, 1009, true, 'Invalid seq', 'system', 'HOLD_PENDING', 'AUTO_TUTOR_ABSENCE',
                          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]', 0,
                          1, 3, 3, ?, ?, ?, ?)
                """, invalidSeqCaseId, agreementId, nextStart, responseDeadline, decisionDeadline, UUID.randomUUID()));

        // Reject response deadline > decision deadline
        UUID invalidDeadlineCaseId = UUID.randomUUID();
        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("""
                INSERT INTO termination_case (
                    id, anchor_agreement_id, classroom_id, whole_class, reason, requested_by,
                    status, origin, created_at, updated_at, audit_json, version,
                    absence_governance_version, trigger_session_sequence, next_session_sequence,
                    next_session_start_at, response_deadline, decision_deadline, hold_command_id
                ) VALUES (?, ?, 1009, true, 'Invalid deadline', 'system', 'HOLD_PENDING', 'AUTO_TUTOR_ABSENCE',
                          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]', 0,
                          1, 3, 4, ?, ?, ?, ?)
                """, invalidDeadlineCaseId, agreementId, nextStart, nextStart.plusHours(1), decisionDeadline, UUID.randomUUID()));

        // Reject invalid auto decision reason
        UUID invalidReasonCaseId = UUID.randomUUID();
        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("""
                INSERT INTO termination_case (
                    id, anchor_agreement_id, classroom_id, whole_class, reason, requested_by,
                    status, origin, created_at, updated_at, audit_json, version,
                    absence_governance_version, trigger_session_sequence, next_session_sequence,
                    next_session_start_at, response_deadline, decision_deadline,
                    auto_decision_at, auto_decision_reason, hold_command_id
                ) VALUES (?, ?, 1009, true, 'Invalid reason', 'system', 'APPROVED', 'AUTO_TUTOR_ABSENCE',
                          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]', 0,
                          1, 3, 4, ?, ?, ?, CURRENT_TIMESTAMP, 'INVALID_REASON', ?)
                """, invalidReasonCaseId, agreementId, nextStart, responseDeadline, decisionDeadline, UUID.randomUUID()));
    }

    @Test
    void storesAndEnforcesProbationAndAttendanceSignalConstraints() {
        UUID agreementId = UUID.randomUUID();
        insertAgreement(agreementId, 1010, 2010, 1, BigDecimal.valueOf(10_000_000));

        UUID caseId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        jdbcTemplate.update("""
                INSERT INTO termination_case (
                    id, anchor_agreement_id, classroom_id, whole_class, reason, requested_by,
                    status, origin, created_at, updated_at, audit_json, version
                ) VALUES (?, ?, 1010, true, 'Probation test', 'system', 'REJECTED', 'AUTO_TUTOR_ABSENCE',
                          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]', 0)
                """, caseId, agreementId);

        // Probation insert
        UUID probationId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO tutor_absence_probation (
                    id, classroom_id, source_case_id, session_sequence, session_start_at, status,
                    active_classroom_guard
                ) VALUES (?, 1010, ?, 4, ?, 'ACTIVE', 1010)
                """, probationId, caseId, now.plusHours(48));

        String probationStatus = jdbcTemplate.queryForObject(
                "SELECT status FROM tutor_absence_probation WHERE id = ?",
                String.class, probationId);
        assertEquals("ACTIVE", probationStatus);

        UUID secondCaseId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO termination_case (
                    id, anchor_agreement_id, classroom_id, whole_class, reason, requested_by,
                    status, origin, created_at, updated_at, audit_json, version
                ) VALUES (?, ?, 1010, true, 'Second probation test', 'system', 'REJECTED',
                          'AUTO_TUTOR_ABSENCE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]', 0)
                """, secondCaseId, agreementId);
        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("""
                INSERT INTO tutor_absence_probation (
                    id, classroom_id, source_case_id, session_sequence, session_start_at, status,
                    active_classroom_guard
                ) VALUES (?, 1010, ?, 5, ?, 'ACTIVE', 1010)
                """, UUID.randomUUID(), secondCaseId, now.plusHours(72)));

        jdbcTemplate.update("""
                UPDATE tutor_absence_probation
                   SET status = 'PASSED', active_classroom_guard = NULL,
                       resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?
                """, probationId);

        // Attendance signal insert
        UUID signalId = UUID.randomUUID();
        String sourceEventId = "att-sig-1010-1";
        jdbcTemplate.update("""
                INSERT INTO class_tutor_attendance_signal (
                    id, classroom_id, learning_session_id, session_sequence,
                    tutor_attendance_outcome, finalized_at, source_event_id
                ) VALUES (?, 1010, 5001, 1, 'TUTOR_ABSENT', CURRENT_TIMESTAMP, ?)
                """, signalId, sourceEventId);

        // Duplicate source_event_id must be rejected
        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("""
                INSERT INTO class_tutor_attendance_signal (
                    id, classroom_id, learning_session_id, session_sequence,
                    tutor_attendance_outcome, finalized_at, source_event_id
                ) VALUES (?, 1010, 5002, 2, 'TUTOR_ABSENT', CURRENT_TIMESTAMP, ?)
                """, UUID.randomUUID(), sourceEventId));

        // Duplicate (classroom_id, session_sequence) must be rejected
        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("""
                INSERT INTO class_tutor_attendance_signal (
                    id, classroom_id, learning_session_id, session_sequence,
                    tutor_attendance_outcome, finalized_at, source_event_id
                ) VALUES (?, 1010, 5003, 1, 'TUTOR_PRESENT', CURRENT_TIMESTAMP, 'att-sig-1010-distinct')
                """, UUID.randomUUID()));
    }

    @Test
    void relapseGovernanceCaseDoesNotInventNextSessionSnapshot() {
        UUID agreementId = UUID.randomUUID();
        insertAgreement(agreementId, 1011, 2011, 1, BigDecimal.valueOf(10_000_000));

        jdbcTemplate.update("""
                INSERT INTO termination_case (
                    id, anchor_agreement_id, classroom_id, whole_class, reason, requested_by,
                    status, origin, created_at, updated_at, audit_json, version,
                    absence_governance_version, trigger_session_sequence, hold_command_id,
                    auto_decision_at, auto_decision_reason
                ) VALUES (?, ?, 1011, true, 'Relapse test', 'system', 'APPROVED',
                          'AUTO_TUTOR_ABSENCE_RELAPSE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]', 0,
                          1, 4, ?, CURRENT_TIMESTAMP, 'PROBATION_RELAPSE')
                """, UUID.randomUUID(), agreementId, UUID.randomUUID());

        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("""
                INSERT INTO termination_case (
                    id, anchor_agreement_id, classroom_id, whole_class, reason, requested_by,
                    status, origin, created_at, updated_at, audit_json, version,
                    absence_governance_version, trigger_session_sequence, next_session_sequence,
                    next_session_start_at, response_deadline, decision_deadline, hold_command_id
                ) VALUES (?, ?, 1011, true, 'Fake relapse snapshot', 'system', 'APPROVED',
                          'AUTO_TUTOR_ABSENCE_RELAPSE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '[]', 0,
                          1, 4, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
                """, UUID.randomUUID(), agreementId, UUID.randomUUID()));
    }
}
