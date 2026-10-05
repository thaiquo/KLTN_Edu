package iuh.fit.ai_service.service.semantic;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class QdrantClassSemanticVectorStore implements ClassSemanticVectorStore {
    private static final String DISTANCE = "Cosine";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final ClassQdrantProperties properties;

    public QdrantClassSemanticVectorStore(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            ClassQdrantProperties properties
    ) {
        this.restClient = restClientBuilder.baseUrl(properties.url()).build();
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @Override
    public void initializeCollection() {
        Map<String, Object> info = collectionInfo();
        if (info == null) {
            createCollection();
        } else {
            validateCollection(info);
        }
        createPayloadIndexes();
    }

    @Override
    public ClassSemanticPayload getPayload(String pointId) {
        Map<String, Object> body = Map.of("ids", List.of(pointId), "with_payload", true, "with_vector", false);
        Map<String, Object> response = request("retrieve point", () -> restClient.post()
                .uri("/collections/{collection}/points", properties.collection())
                .body(body)
                .retrieve()
                .body(mapType()));
        List<Map<String, Object>> result = resultList(response);
        if (result.isEmpty()) {
            return null;
        }
        return ClassSemanticPayload.fromMap(asMap(result.getFirst().get("payload")));
    }

    @Override
    public void upsert(String pointId, EmbeddingVector vector, ClassSemanticPayload payload) {
        validateVector(vector);
        Map<String, Object> point = new LinkedHashMap<>();
        point.put("id", pointId);
        point.put("vector", vector.values());
        point.put("payload", payload.toMap());
        request("upsert point", () -> restClient.put()
                .uri("/collections/{collection}/points?wait=true", properties.collection())
                .body(Map.of("points", List.of(point)))
                .retrieve()
                .body(mapType()));
    }

    @Override
    public void delete(String pointId) {
        request("delete point", () -> restClient.post()
                .uri("/collections/{collection}/points/delete?wait=true", properties.collection())
                .body(Map.of("points", List.of(pointId)))
                .retrieve()
                .body(mapType()));
    }

    @Override
    public List<ClassSemanticStoredPoint> listPayloads() {
        List<ClassSemanticStoredPoint> points = new ArrayList<>();
        Object offset = null;
        do {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("limit", 100);
            body.put("with_payload", true);
            body.put("with_vector", false);
            if (offset != null) {
                body.put("offset", offset);
            }
            Map<String, Object> response = request("scroll points", () -> restClient.post()
                    .uri("/collections/{collection}/points/scroll", properties.collection())
                    .body(body)
                    .retrieve()
                    .body(mapType()));
            Map<String, Object> result = asMap(response == null ? null : response.get("result"));
            points.addAll(resultList(Map.of("result", result.getOrDefault("points", List.of()))).stream()
                    .map(point -> new ClassSemanticStoredPoint(
                            String.valueOf(point.get("id")),
                            ClassSemanticPayload.fromMap(asMap(point.get("payload")))))
                    .toList());
            offset = result.get("next_page_offset");
        } while (offset != null);
        return points;
    }

    @Override
    public List<ClassSemanticSearchHit> search(EmbeddingVector queryVector, ClassSemanticSearchFilter filter, int limit) {
        validateVector(queryVector);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("vector", queryVector.values());
        body.put("limit", Math.max(1, limit));
        body.put("with_payload", true);
        body.put("with_vector", false);
        Map<String, Object> qdrantFilter = toQdrantFilter(filter);
        if (!qdrantFilter.isEmpty()) {
            body.put("filter", qdrantFilter);
        }
        Map<String, Object> response = request("search points", () -> restClient.post()
                .uri("/collections/{collection}/points/search", properties.collection())
                .body(body)
                .retrieve()
                .body(mapType()));
        return resultList(response).stream().map(this::toHit).toList();
    }

    private Map<String, Object> collectionInfo() {
        try {
            return restClient.get()
                    .uri("/collections/{collection}", properties.collection())
                    .retrieve()
                    .body(mapType());
        } catch (HttpClientErrorException exception) {
            if (exception.getStatusCode() == HttpStatus.NOT_FOUND) {
                return null;
            }
            throw new SemanticVectorStoreException("Qdrant class collection lookup failed: " + safeMessage(exception), exception);
        } catch (RestClientException exception) {
            throw new SemanticVectorStoreException("Qdrant class collection lookup failed: " + safeMessage(exception), exception);
        }
    }

    private void createCollection() {
        Map<String, Object> vectors = Map.of("size", properties.vectorSize(), "distance", DISTANCE);
        request("create collection", () -> restClient.put()
                .uri("/collections/{collection}", properties.collection())
                .body(Map.of("vectors", vectors))
                .retrieve()
                .body(mapType()));
    }

    private void validateCollection(Map<String, Object> info) {
        Map<String, Object> result = asMap(info.get("result"));
        Map<String, Object> config = asMap(result.get("config"));
        Map<String, Object> params = asMap(config.get("params"));
        Map<String, Object> vectors = asMap(params.get("vectors"));
        Integer size = asInteger(vectors.get("size"));
        String distance = asString(vectors.get("distance"));
        if (!Integer.valueOf(properties.vectorSize()).equals(size)) {
            throw new SemanticVectorStoreException("Qdrant class collection vector size mismatch. Expected "
                    + properties.vectorSize() + " but got " + size + ".");
        }
        if (distance == null || !DISTANCE.equalsIgnoreCase(distance)) {
            throw new SemanticVectorStoreException("Qdrant class collection distance mismatch. Expected COSINE but got " + distance + ".");
        }
    }

    private void createPayloadIndexes() {
        createPayloadIndex("classId", "integer");
        createPayloadIndex("subjectId", "integer");
        createPayloadIndex("levelId", "integer");
        createPayloadIndex("teachingMode", "keyword");
        createPayloadIndex("status", "keyword");
    }

    private void createPayloadIndex(String fieldName, String schema) {
        try {
            restClient.put()
                    .uri("/collections/{collection}/index?wait=true", properties.collection())
                    .body(Map.of("field_name", fieldName, "field_schema", schema))
                    .retrieve()
                    .body(mapType());
        } catch (RestClientException exception) {
            String message = safeMessage(exception).toLowerCase(Locale.ROOT);
            if (!message.contains("already exists")) {
                throw new SemanticVectorStoreException("Qdrant class payload index creation failed for " + fieldName + ": "
                        + safeMessage(exception), exception);
            }
        }
    }

    private Map<String, Object> toQdrantFilter(ClassSemanticSearchFilter filter) {
        if (filter == null) {
            return Map.of();
        }
        List<Map<String, Object>> must = new ArrayList<>();
        addMatch(must, "subjectId", filter.subjectId());
        addMatch(must, "levelId", filter.levelId());
        TeachingMode teachingMode = filter.teachingMode();
        if (teachingMode != null) {
            addMatch(must, "teachingMode", teachingMode.name());
        }
        return must.isEmpty() ? Map.of() : Map.of("must", must);
    }

    private void addMatch(List<Map<String, Object>> must, String key, Object value) {
        if (value != null) {
            must.add(Map.of("key", key, "match", Map.of("value", value)));
        }
    }

    private ClassSemanticSearchHit toHit(Map<String, Object> point) {
        ClassSemanticPayload payload = ClassSemanticPayload.fromMap(asMap(point.get("payload")));
        return new ClassSemanticSearchHit(
                String.valueOf(point.get("id")),
                payload == null ? null : payload.classId(),
                payload == null ? null : payload.tutorProfileId(),
                payload == null ? null : payload.registrationId(),
                payload == null ? null : payload.subjectId(),
                payload == null ? null : payload.levelId(),
                payload == null ? null : payload.teachingMode(),
                payload == null ? null : payload.status(),
                asDouble(point.get("score"))
        );
    }

    private void validateVector(EmbeddingVector vector) {
        if (vector.dimension() != properties.vectorSize()) {
            throw new SemanticVectorStoreException("Qdrant class vector dimension mismatch. Expected "
                    + properties.vectorSize() + " but got " + vector.dimension() + ".");
        }
    }

    private Map<String, Object> request(String operation, Request request) {
        try {
            return request.execute();
        } catch (RestClientException exception) {
            throw new SemanticVectorStoreException("Qdrant class " + operation + " failed: " + safeMessage(exception), exception);
        }
    }

    private List<Map<String, Object>> resultList(Map<String, Object> response) {
        Object result = response == null ? null : response.get("result");
        if (!(result instanceof List<?> raw)) {
            return List.of();
        }
        return raw.stream()
                .filter(Map.class::isInstance)
                .map(item -> objectMapper.convertValue(item, new TypeReference<Map<String, Object>>() {}))
                .toList();
    }

    private Map<String, Object> asMap(Object value) {
        if (value == null) {
            return Map.of();
        }
        return objectMapper.convertValue(value, new TypeReference<Map<String, Object>>() {});
    }

    private Integer asInteger(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    private double asDouble(Object value) {
        return value instanceof Number number ? number.doubleValue() : 0.0;
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private ParameterizedTypeReference<Map<String, Object>> mapType() {
        return new ParameterizedTypeReference<>() {};
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message.replaceAll("(?i)(api-key|key|token|secret)=[^\\s]+", "$1=<redacted>");
    }

    @FunctionalInterface
    private interface Request {
        Map<String, Object> execute();
    }
}
