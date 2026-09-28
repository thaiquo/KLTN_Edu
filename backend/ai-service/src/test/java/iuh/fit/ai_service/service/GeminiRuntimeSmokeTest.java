package iuh.fit.ai_service.service;

import iuh.fit.ai_service.service.GeminiService.GeminiSmokeResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "jwt.secret=0123456789ABCDEF0123456789ABCDEF",
        "gemini.api-key=${GEMINI_API_KEY:}",
        "gemini.model=${GEMINI_MODEL:gemini-3.5-flash}"
})
@EnabledIfEnvironmentVariable(named = "RUN_GEMINI_SMOKE", matches = "true")
class GeminiRuntimeSmokeTest {
    @Autowired
    private GeminiService geminiService;

    @Test
    void callsRealGeminiApi() {
        GeminiSmokeResult result = geminiService.smokeTest();

        assertThat(result.model()).isNotBlank();
        assertThat(result.response()).contains("EDUCONNECT_GEMINI_OK");
    }
}
