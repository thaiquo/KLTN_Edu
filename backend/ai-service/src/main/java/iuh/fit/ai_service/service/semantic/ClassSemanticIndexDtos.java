package iuh.fit.ai_service.service.semantic;

import java.time.Instant;
import java.util.List;

import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.ReadinessStatus;

public final class ClassSemanticIndexDtos {
    private ClassSemanticIndexDtos() {
    }

    public record ClassSyncRequest(
            Integer maxClasses
    ) {
    }

    public record ClassSyncResult(
            int sourceClasses,
            int eligibleClasses,
            int indexed,
            int skipped,
            int failed,
            int staleRemoved,
            List<String> errors
    ) {
    }

    public record ClassDeleteResult(
            String pointId,
            boolean deleted
    ) {
    }

    public record ClassHealthResponse(
            String collectionName,
            boolean collectionExists,
            long pointCount,
            Instant lastSuccessfulSyncAt,
            ReadinessStatus status
    ) {
    }
}
