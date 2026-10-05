package iuh.fit.ai_service.service.semantic;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record SemanticPayload(
        Long tutorId,
        Long userId,
        Long capabilityId,
        Long subjectId,
        Long levelId,
        List<String> teachingModes,
        Integer semanticDocumentVersion,
        String embeddingModel,
        Integer embeddingDimensions,
        String documentHash,
        Instant indexedAt
) {
    public Map<String, Object> toMap() {
        Map<String, Object> payload = new LinkedHashMap<>();
        put(payload, "tutorId", tutorId);
        put(payload, "userId", userId);
        put(payload, "capabilityId", capabilityId);
        put(payload, "subjectId", subjectId);
        put(payload, "levelId", levelId);
        payload.put("teachingModes", teachingModes == null ? List.of() : List.copyOf(teachingModes));
        put(payload, "semanticDocumentVersion", semanticDocumentVersion);
        put(payload, "embeddingModel", embeddingModel);
        put(payload, "embeddingDimensions", embeddingDimensions);
        put(payload, "documentHash", documentHash);
        put(payload, "indexedAt", indexedAt == null ? null : indexedAt.toString());
        return payload;
    }

    @SuppressWarnings("unchecked")
    public static SemanticPayload fromMap(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }
        return new SemanticPayload(
                asLong(payload.get("tutorId")),
                asLong(payload.get("userId")),
                asLong(payload.get("capabilityId")),
                asLong(payload.get("subjectId")),
                asLong(payload.get("levelId")),
                payload.get("teachingModes") instanceof List<?> values
                        ? values.stream().map(String::valueOf).toList()
                        : List.of(),
                asInteger(payload.get("semanticDocumentVersion")),
                asString(payload.get("embeddingModel")),
                asInteger(payload.get("embeddingDimensions")),
                asString(payload.get("documentHash")),
                parseInstant(payload.get("indexedAt"))
        );
    }

    private static Long asLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static void put(Map<String, Object> payload, String key, Object value) {
        if (value != null) {
            payload.put(key, value);
        }
    }

    private static Integer asInteger(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Instant parseInstant(Object value) {
        if (value == null) {
            return null;
        }
        return Instant.parse(String.valueOf(value));
    }
}
