package iuh.fit.ai_service.service.semantic;

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
}
