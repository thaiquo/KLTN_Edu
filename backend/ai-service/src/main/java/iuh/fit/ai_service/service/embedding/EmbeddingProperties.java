package iuh.fit.ai_service.service.embedding;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class EmbeddingProperties {
    public static final String GEMINI_PROVIDER = "gemini";
    public static final int MIN_DIMENSIONS = 128;
    public static final int MAX_DIMENSIONS = 3072;

    private final String provider;
    private final String model;
    private final int dimensions;
    private final String apiKey;

    public EmbeddingProperties(
            @Value("${embedding.provider:gemini}") String provider,
            @Value("${embedding.model:gemini-embedding-2}") String model,
            @Value("${embedding.dimensions:768}") int dimensions,
            @Value("${embedding.api-key:${gemini.api-key:}}") String apiKey
    ) {
        this.provider = normalize(provider, GEMINI_PROVIDER);
        this.model = normalize(model, "gemini-embedding-2");
        this.dimensions = dimensions;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        validate();
    }

    public String provider() {
        return provider;
    }

    public String model() {
        return model;
    }

    public int dimensions() {
        return dimensions;
    }

    public String apiKey() {
        return apiKey;
    }

    private void validate() {
        if (!GEMINI_PROVIDER.equals(provider)) {
            throw new EmbeddingException("Unsupported embedding provider: " + provider);
        }
        if (!StringUtils.hasText(model)) {
            throw new EmbeddingException("Embedding model must be configured.");
        }
        if (dimensions < MIN_DIMENSIONS || dimensions > MAX_DIMENSIONS) {
            throw new EmbeddingException("Embedding dimensions must be between 128 and 3072.");
        }
    }

    private String normalize(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }
}
