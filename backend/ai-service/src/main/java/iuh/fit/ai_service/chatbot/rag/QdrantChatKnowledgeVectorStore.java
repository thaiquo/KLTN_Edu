package iuh.fit.ai_service.chatbot.rag;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeChunk;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeSearchHit;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import iuh.fit.ai_service.service.semantic.QdrantProperties;
import iuh.fit.ai_service.service.semantic.SemanticVectorStoreException;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
public class QdrantChatKnowledgeVectorStore implements ChatKnowledgeVectorStore {
    private static final String DISTANCE = "Cosine";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final QdrantProperties qdrantProperties;
    private final ChatKnowledgeProperties properties;

    public QdrantChatKnowledgeVectorStore(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            QdrantProperties qdrantProperties,
            ChatKnowledgeProperties properties
    ) {
        this.restClient = restClientBuilder.baseUrl(qdrantProperties.url()).build();
        this.objectMapper = objectMapper;
        this.qdrantProperties = qdrantProperties;
        this.properties = properties;
    }

    @Override
    public void recreateCollection() {
        deleteCollectionIfExists();
        createCollection();
        createPayloadIndexes();
    }

    @Override
    public boolean collectionExists() {
        return collectionInfo() != null;
    }

    @Override
    public long countPoints() {
        if (!collectionExists()) {
            return 0L;
        }
        Map<String, Object> response = request("count points", () -> restClient.post()
                .uri("/collections/{collection}/points/count", collection())
                .body(Map.of("exact", true))
                .retrieve()
                .body(mapType()));
        Map<String, Object> result = asMap(response == null ? null : response.get("result"));
        Object count = result.get("count");
        return count instanceof Number number ? number.longValue() : 0L;
    }

    @Override
    public int countIndexedDocuments() {
        if (!collectionExists()) {
            return 0;
        }
        Set<String> documentIds = new LinkedHashSet<>();
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
                    .uri("/collections/{collection}/points/scroll", collection())
                    .body(body)
                    .retrieve()
                    .body(mapType()));
            Map<String, Object> result = asMap(response == null ? null : response.get("result"));
            for (Map<String, Object> point : resultList(Map.of("result", result.getOrDefault("points", List.of())))) {
                Map<String, Object> payload = asMap(point.get("payload"));
                Object documentId = payload.get("documentId");
                if (documentId != null) {
                    documentIds.add(String.valueOf(documentId));
                }
            }
            offset = result.get("next_page_offset");
        } while (offset != null);
        return documentIds.size();
    }

    @Override
    public void upsert(String pointId, EmbeddingVector vector, KnowledgeChunk chunk, int documentVersion) {
        validateVector(vector);
        Map<String, Object> point = new LinkedHashMap<>();
        point.put("id", pointId);
        point.put("vector", vector.values());
        point.put("payload", payload(chunk, documentVersion));
        request("upsert point", () -> restClient.put()
                .uri("/collections/{collection}/points?wait=true", collection())
                .body(Map.of("points", List.of(point)))
                .retrieve()
                .body(mapType()));
    }

    @Override
    public List<KnowledgeSearchHit> search(EmbeddingVector queryVector, List<String> roleVisibility, int limit, double minScore) {
        validateVector(queryVector);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("vector", queryVector.values());
        body.put("limit", Math.max(1, limit));
        body.put("with_payload", true);
        body.put("with_vector", false);
        Map<String, Object> filter = roleFilter(roleVisibility);
        if (!filter.isEmpty()) {
            body.put("filter", filter);
        }
        Map<String, Object> response = request("search points", () -> restClient.post()
                .uri("/collections/{collection}/points/search", collection())
                .body(body)
                .retrieve()
                .body(mapType()));
        return resultList(response).stream()
                .map(this::toHit)
                .filter(hit -> hit.score() >= minScore)
                .limit(limit)
                .toList();
    }

    private Map<String, Object> collectionInfo() {
        try {
            return restClient.get()
                    .uri("/collections/{collection}", collection())
                    .retrieve()
                    .body(mapType());
        } catch (HttpClientErrorException exception) {
            if (exception.getStatusCode() == HttpStatus.NOT_FOUND) {
                return null;
            }
            throw new SemanticVectorStoreException("Qdrant chatbot collection lookup failed: " + safeMessage(exception), exception);
        } catch (RestClientException exception) {
            throw new SemanticVectorStoreException("Qdrant chatbot collection lookup failed: " + safeMessage(exception), exception);
        }
    }

    private void deleteCollectionIfExists() {
        if (!collectionExists()) {
            return;
        }
        request("delete collection", () -> restClient.delete()
                .uri("/collections/{collection}?timeout=30", collection())
                .retrieve()
                .body(mapType()));
    }

    private void createCollection() {
        Map<String, Object> vectors = Map.of("size", properties.vectorSize(), "distance", DISTANCE);
        request("create collection", () -> restClient.put()
                .uri("/collections/{collection}", collection())
                .body(Map.of("vectors", vectors))
                .retrieve()
                .body(mapType()));
    }

    private void createPayloadIndexes() {
        createPayloadIndex("documentId", "keyword");
        createPayloadIndex("roleVisibility", "keyword");
        createPayloadIndex("category", "keyword");
    }

    private void createPayloadIndex(String fieldName, String schema) {
        try {
            restClient.put()
                    .uri("/collections/{collection}/index?wait=true", collection())
                    .body(Map.of("field_name", fieldName, "field_schema", schema))
                    .retrieve()
                    .body(mapType());
        } catch (RestClientException exception) {
            String message = safeMessage(exception).toLowerCase(Locale.ROOT);
            if (!message.contains("already exists")) {
                throw new SemanticVectorStoreException("Qdrant chatbot payload index creation failed for " + fieldName
                        + ": " + safeMessage(exception), exception);
            }
        }
    }

    private Map<String, Object> payload(KnowledgeChunk chunk, int documentVersion) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("documentId", chunk.documentId());
        payload.put("title", chunk.title());
        payload.put("section", chunk.section());
        payload.put("category", chunk.category());
        payload.put("roleVisibility", chunk.roleVisibility());
        payload.put("sourceType", "CHATBOT_KNOWLEDGE");
        payload.put("sourceName", chunk.sourceName());
        payload.put("version", documentVersion);
        payload.put("contentHash", chunk.contentHash());
        payload.put("chunkIndex", chunk.chunkIndex());
        payload.put("content", chunk.content());
        return payload;
    }

    private Map<String, Object> roleFilter(List<String> roleVisibility) {
        List<Map<String, Object>> should = new ArrayList<>();
        for (String role : roleVisibility == null ? List.<String>of() : roleVisibility) {
            if (role != null && !role.isBlank()) {
                should.add(Map.of("key", "roleVisibility", "match", Map.of("value", role.trim().toUpperCase(Locale.ROOT))));
            }
        }
        return should.isEmpty() ? Map.of() : Map.of("should", should);
    }

    private KnowledgeSearchHit toHit(Map<String, Object> point) {
        Map<String, Object> payload = asMap(point.get("payload"));
        return new KnowledgeSearchHit(
                String.valueOf(point.get("id")),
                asString(payload.get("documentId")),
                asString(payload.get("title")),
                asString(payload.get("section")),
                asString(payload.get("category")),
                asString(payload.get("content")),
                asDouble(point.get("score"))
        );
    }

    private void validateVector(EmbeddingVector vector) {
        if (vector.dimension() != properties.vectorSize()) {
            throw new SemanticVectorStoreException("Qdrant chatbot vector dimension mismatch. Expected "
                    + properties.vectorSize() + " but got " + vector.dimension() + ".");
        }
        if (properties.vectorSize() != qdrantProperties.vectorSize()) {
            throw new SemanticVectorStoreException("Chatbot vector size must match shared Qdrant vector size.");
        }
    }

    private Map<String, Object> request(String operation, Request request) {
        try {
            return request.execute();
        } catch (RestClientException exception) {
            throw new SemanticVectorStoreException("Qdrant chatbot " + operation + " failed: " + safeMessage(exception), exception);
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

    private double asDouble(Object value) {
        return value instanceof Number number ? number.doubleValue() : 0.0;
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private ParameterizedTypeReference<Map<String, Object>> mapType() {
        return new ParameterizedTypeReference<>() {};
    }

    private String collection() {
        return properties.collection();
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
