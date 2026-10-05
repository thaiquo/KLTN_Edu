package iuh.fit.ai_service.service.semantic;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public record ClassSemanticPayload(
        Long classId,
        Long tutorProfileId,
        Long registrationId,
        Long subjectId,
        Long levelId,
        String teachingMode,
        String status,
        Integer semanticDocumentVersion,
        String embeddingModel,
        Integer embeddingDimensions,
        String documentHash,
        Instant indexedAt
) {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public Map<String, Object> toMap() {
        Map<String, Object> payload = new LinkedHashMap<>();
        put(payload, "classId", classId);
        put(payload, "tutorProfileId", tutorProfileId);
        put(payload, "registrationId", registrationId);
        put(payload, "subjectId", subjectId);
        put(payload, "levelId", levelId);
        put(payload, "teachingMode", teachingMode);
        put(payload, "status", status);
        put(payload, "semanticDocumentVersion", semanticDocumentVersion);
        put(payload, "embeddingModel", embeddingModel);
        put(payload, "embeddingDimensions", embeddingDimensions);
        put(payload, "documentHash", documentHash);
        put(payload, "indexedAt", indexedAt == null ? null : indexedAt.toString());
        return payload;
    }

    public static ClassSemanticPayload fromMap(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }
        return new ClassSemanticPayload(
                asLong(payload.get("classId")),
                asLong(payload.get("tutorProfileId")),
                asLong(payload.get("registrationId")),
                asLong(payload.get("subjectId")),
                asLong(payload.get("levelId")),
                asString(payload.get("teachingMode")),
                asString(payload.get("status")),
                asInteger(payload.get("semanticDocumentVersion")),
                asString(payload.get("embeddingModel")),
                asInteger(payload.get("embeddingDimensions")),
                asString(payload.get("documentHash")),
                asInstant(payload.get("indexedAt"))
        );
    }

    @SuppressWarnings("unused")
    private static Map<String, Object> asMap(Object value) {
        if (value == null) {
            return Map.of();
        }
        return OBJECT_MAPPER.convertValue(value, new TypeReference<>() {});
    }

    private static void put(Map<String, Object> payload, String key, Object value) {
        if (value != null) {
            payload.put(key, value);
        }
    }

    private static Long asLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static Integer asInteger(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Instant asInstant(Object value) {
        try {
            return value == null ? null : Instant.parse(String.valueOf(value));
        } catch (RuntimeException ignored) {
            return null;
        }
    }
}
