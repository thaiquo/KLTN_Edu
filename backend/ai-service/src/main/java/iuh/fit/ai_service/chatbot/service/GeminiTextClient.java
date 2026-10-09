package iuh.fit.ai_service.chatbot.service;

import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import iuh.fit.ai_service.service.GeminiService.GeminiUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class GeminiTextClient {
    private final String apiKey;
    private final String configuredModel;

    public GeminiTextClient(
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model:gemini-3.5-flash}") String configuredModel
    ) {
        this.apiKey = apiKey;
        this.configuredModel = configuredModel;
    }

    public String generateText(String systemInstruction, String prompt, int maxOutputTokens) {
        if (!StringUtils.hasText(apiKey)) {
            throw new GeminiUnavailableException("GEMINI_API_KEY is missing.");
        }
        if (!StringUtils.hasText(prompt)) {
            throw new IllegalArgumentException("prompt is required");
        }

        GenerateContentConfig config = GenerateContentConfig.builder()
                .temperature(0.2f)
                .maxOutputTokens(Math.max(64, Math.min(maxOutputTokens, 1024)))
                .systemInstruction(Content.fromParts(Part.fromText(systemInstruction)))
                .build();

        try (Client client = Client.builder().apiKey(apiKey).build()) {
            GenerateContentResponse response = client.models.generateContent(configuredModel, prompt, config);
            String content = response.text();
            if (!StringUtils.hasText(content)) {
                throw new GeminiUnavailableException("Gemini returned an empty chatbot response.");
            }
            return content.trim();
        } catch (GeminiUnavailableException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new GeminiUnavailableException("Gemini chatbot response failed: " + exception.getMessage(), exception);
        }
    }
}
