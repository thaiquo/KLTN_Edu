package iuh.fit.ai_service.service.semantic;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class QdrantProperties {
    private final String url;
    private final String collection;
    private final int vectorSize;
    private final int topK;

    public QdrantProperties(
            @Value("${qdrant.url:http://localhost:6333}") String url,
            @Value("${qdrant.collection:tutor_capabilities_v1}") String collection,
            @Value("${qdrant.vector-size:768}") int vectorSize,
            @Value("${semantic.search.top-k:20}") int topK
    ) {
        this.url = stripTrailingSlash(StringUtils.hasText(url) ? url.trim() : "http://localhost:6333");
        this.collection = StringUtils.hasText(collection) ? collection.trim() : "tutor_capabilities_v1";
        this.vectorSize = vectorSize;
        this.topK = Math.max(1, topK);
        if (vectorSize < 128 || vectorSize > 3072) {
            throw new SemanticVectorStoreException("Qdrant vector size must be between 128 and 3072.");
        }
    }

    public String url() {
        return url;
    }

    public String collection() {
        return collection;
    }

    public int vectorSize() {
        return vectorSize;
    }

    public int topK() {
        return topK;
    }

    private String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
