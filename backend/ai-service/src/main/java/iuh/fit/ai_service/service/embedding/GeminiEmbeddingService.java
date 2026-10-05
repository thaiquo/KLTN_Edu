package iuh.fit.ai_service.service.embedding;

import com.google.genai.Client;
import com.google.genai.types.ContentEmbedding;
import com.google.genai.types.EmbedContentConfig;
import com.google.genai.types.EmbedContentResponse;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class GeminiEmbeddingService implements EmbeddingService {
    private final EmbeddingProperties properties;

    public GeminiEmbeddingService(EmbeddingProperties properties) {
        this.properties = properties;
    }

    @Override
    public EmbeddingVector embed(String text) {
        String normalizedText = normalizeText(text);
        if (!StringUtils.hasText(properties.apiKey())) {
            throw new EmbeddingException("GEMINI_API_KEY is required for embedding generation.");
        }

        EmbedContentConfig config = EmbedContentConfig.builder()
                .outputDimensionality(properties.dimensions())
                .build();

        try (Client client = Client.builder().apiKey(properties.apiKey()).build()) {
            EmbedContentResponse response = client.models.embedContent(properties.model(), normalizedText, config);
            return extractSingleVector(response);
        } catch (EmbeddingException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new EmbeddingException("Gemini embedding request failed: " + exception.getMessage(), exception);
        }
    }

    EmbeddingVector extractSingleVector(EmbedContentResponse response) {
        List<ContentEmbedding> embeddings = response == null ? List.of() : response.embeddings().orElse(List.of());
        if (embeddings.isEmpty()) {
            throw new EmbeddingException("Embedding provider returned no embeddings.");
        }

        List<Float> values = embeddings.getFirst().values().orElse(List.of());
        EmbeddingVector vector = new EmbeddingVector(values);
        if (vector.dimension() != properties.dimensions()) {
            throw new EmbeddingException("Embedding dimension mismatch. Expected "
                    + properties.dimensions() + " but got " + vector.dimension() + ".");
        }
        return vector;
    }

    private String normalizeText(String text) {
        if (!StringUtils.hasText(text)) {
            throw new EmbeddingException("Embedding text must not be blank.");
        }
        return text.trim();
    }
}
