package iuh.fit.ai_service.service.embedding;

import java.util.List;

public record EmbeddingVector(List<Float> values) {
    public EmbeddingVector {
        if (values == null || values.isEmpty()) {
            throw new EmbeddingException("Embedding provider returned an empty vector.");
        }
        values = List.copyOf(values);
        for (Float value : values) {
            if (value == null || !Float.isFinite(value)) {
                throw new EmbeddingException("Embedding provider returned an invalid vector value.");
            }
        }
    }

    public int dimension() {
        return values.size();
    }
}
