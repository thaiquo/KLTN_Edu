package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.HealthResponse;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.ReadinessStatus;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.SyncResult;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TutorSemanticIndexRecoverySchedulerTest {

    @Test
    void readyIndexIsNotRebuilt() {
        TutorSemanticIndexService service = mock(TutorSemanticIndexService.class);
        when(service.health()).thenReturn(new HealthResponse(
                "tutor_capabilities_v1", true, 107, Instant.now(), ReadinessStatus.READY));

        new TutorSemanticIndexRecoveryScheduler(service).recoverIfNeeded();

        verify(service, never()).sync(null);
    }

    @Test
    void emptyIndexTriggersIdempotentFullSync() {
        TutorSemanticIndexService service = mock(TutorSemanticIndexService.class);
        when(service.health()).thenReturn(new HealthResponse(
                "tutor_capabilities_v1", true, 0, null, ReadinessStatus.DEGRADED_EMPTY));
        when(service.sync(null)).thenReturn(new SyncResult(30, 107, 107, 0, 0, 0, List.of()));

        new TutorSemanticIndexRecoveryScheduler(service).recoverIfNeeded();

        verify(service).sync(null);
    }

    @Test
    void persistedReadyIndexGetsOneIdempotentSyncAfterProcessRestart() {
        TutorSemanticIndexService service = mock(TutorSemanticIndexService.class);
        when(service.health()).thenReturn(new HealthResponse(
                "tutor_capabilities_v1", true, 107, null, ReadinessStatus.READY));
        when(service.sync(null)).thenReturn(new SyncResult(30, 107, 0, 107, 0, 0, List.of()));

        new TutorSemanticIndexRecoveryScheduler(service).recoverIfNeeded();

        verify(service).sync(null);
    }

    @Test
    void unavailableQdrantDoesNotCrashSchedulerThread() {
        TutorSemanticIndexService service = mock(TutorSemanticIndexService.class);
        when(service.health()).thenThrow(new SemanticVectorStoreException("Qdrant unavailable"));

        new TutorSemanticIndexRecoveryScheduler(service).recoverIfNeeded();

        verify(service, never()).sync(null);
    }
}
