package iuh.fit.ai_service.service.semantic;

import java.time.Instant;
import java.util.List;

public final class TutorSemanticIndexDtos {
    private TutorSemanticIndexDtos() {
    }

    public record SyncRequest(Integer maxCapabilities) {
    }

    public record SyncResult(
            int tutorsConsidered,
            int capabilitiesConsidered,
            int indexed,
            int skipped,
            int failed,
            int staleRemoved,
            List<String> errors
    ) {
    }

    public record DeleteResult(
            String pointId,
            boolean deleted
    ) {
    }

    public enum ReadinessStatus {
        READY,
        DEGRADED_EMPTY,
        UNAVAILABLE
    }

    public record VectorStoreHealth(
            String collectionName,
            boolean collectionExists,
            long pointCount,
            ReadinessStatus status
    ) {
        public static VectorStoreHealth unavailable(String collectionName) {
            return new VectorStoreHealth(collectionName, false, 0, ReadinessStatus.UNAVAILABLE);
        }
    }

    public record HealthResponse(
            String collectionName,
            boolean collectionExists,
            long pointCount,
            Instant lastSuccessfulSyncAt,
            ReadinessStatus status
    ) {
    }
}
