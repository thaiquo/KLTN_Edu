package iuh.fit.ai_service.service.embedding;

import com.google.genai.types.ContentEmbedding;
import com.google.genai.types.EmbedContentResponse;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EmbeddingServiceTest {

    @Test
    void vectorRejectsInvalidValues() {
        assertThatThrownBy(() -> new EmbeddingVector(List.of(1.0f, Float.NaN)))
                .isInstanceOf(EmbeddingException.class)
                .hasMessageContaining("invalid vector");
    }

    @Test
    void propertiesRejectUnsupportedProvider() {
        assertThatThrownBy(() -> new EmbeddingProperties("openai", "text-embedding-3-small", 768, "key"))
                .isInstanceOf(EmbeddingException.class)
                .hasMessageContaining("Unsupported embedding provider");
    }

    @Test
    void propertiesRejectInvalidDimensions() {
        assertThatThrownBy(() -> new EmbeddingProperties("gemini", "gemini-embedding-2", 64, "key"))
                .isInstanceOf(EmbeddingException.class)
                .hasMessageContaining("between 128 and 3072");
    }

    @Test
    void embedRejectsBlankTextBeforeProviderCall() {
        GeminiEmbeddingService service = new GeminiEmbeddingService(
                new EmbeddingProperties("gemini", "gemini-embedding-2", 768, "key")
        );

        assertThatThrownBy(() -> service.embed(" "))
                .isInstanceOf(EmbeddingException.class)
                .hasMessageContaining("must not be blank");
    }

    @Test
    void embedRejectsMissingApiKeyBeforeProviderCall() {
        GeminiEmbeddingService service = new GeminiEmbeddingService(
                new EmbeddingProperties("gemini", "gemini-embedding-2", 768, "")
        );

        assertThatThrownBy(() -> service.embed("Can lop Toan lop 10"))
                .isInstanceOf(EmbeddingException.class)
                .hasMessageContaining("GEMINI_API_KEY");
    }

    @Test
    void extractionValidatesProviderResponseDimension() {
        GeminiEmbeddingService service = new GeminiEmbeddingService(
                new EmbeddingProperties("gemini", "gemini-embedding-2", 128, "key")
        );

        EmbeddingVector vector = service.extractSingleVector(responseWithValues(values(128)));

        assertThat(vector.dimension()).isEqualTo(128);
    }

    @Test
    void extractionRejectsUnexpectedProviderResponseDimension() {
        GeminiEmbeddingService service = new GeminiEmbeddingService(
                new EmbeddingProperties("gemini", "gemini-embedding-2", 128, "key")
        );

        assertThatThrownBy(() -> service.extractSingleVector(responseWithValues(List.of(0.1f, 0.2f))))
                .isInstanceOf(EmbeddingException.class)
                .hasMessageContaining("dimension mismatch");
    }

    private EmbedContentResponse responseWithValues(List<Float> values) {
        ContentEmbedding embedding = mock(ContentEmbedding.class);
        when(embedding.values()).thenReturn(Optional.of(values));

        EmbedContentResponse response = mock(EmbedContentResponse.class);
        when(response.embeddings()).thenReturn(Optional.of(List.of(embedding)));
        return response;
    }

    private List<Float> values(int size) {
        return IntStream.range(0, size)
                .mapToObj(index -> index / 1000.0f)
                .toList();
    }
}
