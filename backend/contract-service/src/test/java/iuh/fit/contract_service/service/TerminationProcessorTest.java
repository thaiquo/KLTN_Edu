package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.*;
import iuh.fit.contract_service.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TerminationProcessorTest {
    @Mock TerminationCaseRepository cases;
    @Mock TerminationItemRepository items;
    @Mock ContractAgreementRepository agreements;
    @Mock SessionSettlementRepository settlements;
    @Mock BlockchainTransactionRepository transactions;
    @Mock ProcessedEventRepository events;
    @Mock AgreementLifecycleWorkflowService lifecycle;
    @Mock TerminationLearningClient learning;
    @Mock NotificationDispatcher notifications;
    TerminationProcessor processor;
    ContractAgreement a;
    TerminationCase c;
    TerminationItem item;

    @BeforeEach void setup() {
        processor = new TerminationProcessor(cases, items, agreements, settlements, transactions, events,
                lifecycle, learning, notifications, new ObjectMapper());
        a = ContractAgreement.builder().id(UUID.randomUUID()).classroomId(1L).studentId(2L)
                .chainId(11155111L).status(ContractAgreementStatus.ACTIVE).terminationCutoffSession(-1)
                .onchainAgreementId("0xagreement").escrowContractAddress("0xescrow").studentWallet("0xstudent").build();
        c = new TerminationCase(); c.setId(UUID.randomUUID()); c.setStatus("APPROVED"); c.setReason("Tutor accident");
        c.setAnchorAgreementId(a.getId());
        item = new TerminationItem(); item.setAgreementId(a.getId()); item.setCaseId(c.getId()); item.setStatus("LEARNING_PENDING");
        when(agreements.lockById(a.getId())).thenReturn(Optional.of(a));
        when(items.findById(a.getId())).thenReturn(Optional.of(item));
    }
    void freeze(int cutoff, Long... sessions) {
        when(cases.findById(c.getId())).thenReturn(Optional.of(c));
        when(learning.send(1L, 2L, a.getId(), false, "FREEZE"))
                .thenReturn(new TerminationLearningClient.Snapshot(cutoff, List.of(sessions)));
    }
    @Test void waitsForPastSessionNotYetDeliveredEvenWithoutOpenDbRows() {
        freeze(2, 1L, 2L);
        when(settlements.findByAgreementId(a.getId())).thenReturn(List.of());
        processor.process(a.getId());
        assertThat(item.getStatus()).isEqualTo("WAITING_SETTLEMENT");
        assertThat(a.getTerminationCutoffSession()).isEqualTo(2);
        verifyNoInteractions(lifecycle);
    }
    @Test void waitingDisputeIsNeverBypassed() {
        freeze(1, 1L);
        var s = mock(SessionSettlement.class);
        when(s.getSessionId()).thenReturn(1L); when(s.getStatus()).thenReturn(SettlementStatus.DISPUTED);
        when(settlements.findByAgreementId(a.getId())).thenReturn(List.of(s));
        processor.process(a.getId());
        verifyNoInteractions(lifecycle);
    }
    @Test void emptyCourseQueuesExistingV1CancelButDoesNotClaimRefund() {
        freeze(0);
        when(settlements.findByAgreementId(a.getId())).thenReturn(List.of());
        var tx = mock(BlockchainTransaction.class); when(tx.getStatus()).thenReturn(BlockchainTransactionStatus.SUBMITTED);
        when(transactions.findByIdempotencyKey("CANCEL:11155111:" + a.getId())).thenReturn(Optional.of(tx));
        processor.process(a.getId());
        verify(lifecycle).initiateCancellation(a.getId(), "Tutor accident");
        assertThat(item.getStatus()).isEqualTo("BLOCKCHAIN_PENDING");
        assertThat(item.getRefundedUnits()).isNull();
        assertThat(a.getStatus()).isEqualTo(ContractAgreementStatus.ACTIVE);
        verify(learning, never()).send(any(), any(), any(), anyBoolean(), eq("CLOSE"));
    }
    @Test void cannotExpireBeforeOnchainDeadline() {
        freeze(0); a.setStatus(ContractAgreementStatus.WAITING_PAYMENT);
        a.setPaymentDeadline(OffsetDateTime.now().plusHours(1));
        processor.process(a.getId());
        assertThat(item.getStatus()).isEqualTo("WAITING_PAYMENT");
        verifyNoInteractions(lifecycle);
    }
    @Test void cancellationStatusAloneDoesNotClaimRefundOrCloseEnrollment() {
        freeze(0); a.setStatus(ContractAgreementStatus.CANCELLED);
        when(events.findByEventTypeIgnoreCaseAndChainId("UNUSED_AMOUNT_REFUNDED", 11155111L)).thenReturn(List.of());
        processor.process(a.getId());
        assertThat(item.getStatus()).isEqualTo("WAITING_REFUND_EVENT");
        assertThat(item.getRefundedUnits()).isNull();
        verify(learning, never()).send(any(), any(), any(), anyBoolean(), eq("CLOSE"));
    }
    @Test void confirmedRefundUsesExactEventAmountAndThenClosesEnrollment() {
        freeze(0); a.setStatus(ContractAgreementStatus.CANCELLED);
        var event = mock(ProcessedEvent.class); when(event.getContractAddress()).thenReturn("0xescrow"); when(event.getTransactionHash()).thenReturn("0xtx");
        when(event.getDecodedPayload()).thenReturn("{\"agreementId\":\"0xagreement\",\"attributes\":{\"student\":\"0xstudent\",\"amount\":\"12345678\"}}");
        when(events.findByEventTypeIgnoreCaseAndChainId("UNUSED_AMOUNT_REFUNDED", 11155111L)).thenReturn(List.of(event));
        processor.process(a.getId());
        assertThat(item.getStatus()).isEqualTo("COMPLETED");
        assertThat(item.getRefundedUnits()).isEqualTo(new BigInteger("12345678"));
        verify(learning).send(1L, 2L, a.getId(), false, "CLOSE");
        verify(notifications, times(2)).sendAsync(any(), any(), any(), any(), eq("TERMINATION_COMPLETED"), eq("AGREEMENT"), eq(a.getId().toString()));
    }
    @Test void completedItemIsIdempotent() {
        item.setStatus("COMPLETED");
        processor.process(a.getId());
        verifyNoInteractions(lifecycle, learning, events);
    }
    @Test void unavailableLearningPreventsCancellation() {
        when(cases.findById(c.getId())).thenReturn(Optional.of(c));
        when(learning.send(any(), any(), any(), anyBoolean(), eq("FREEZE"))).thenThrow(new IllegalStateException("offline"));
        assertThatThrownBy(() -> processor.process(a.getId())).hasMessage("offline");
        verifyNoInteractions(lifecycle);
    }
}
