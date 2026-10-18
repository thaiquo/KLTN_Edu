package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.service.CommunityModerationClassifier;
import iuh.fit.ai_service.service.CommunityRewriteAssistant;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "jwt.secret=0123456789ABCDEF0123456789ABCDEF")
@AutoConfigureMockMvc
class CommunityModerationHttpSecurityTest {
    @Autowired MockMvc mvc;
    @MockBean CommunityModerationClassifier classifier;
    @MockBean CommunityRewriteAssistant rewriteAssistant;
    private static final String URL = "/api/ai/internal/community/moderate";
    private static final String BODY = "{\"postType\":\"TUTOR_POLL\",\"title\":\"test\",\"content\":\"test\"}";
    private String token(String subject, String scope, int seconds) {
        var b = Jwts.builder().subject(subject).expiration(Date.from(Instant.now().plusSeconds(seconds)));
        if (scope != null) b.claim("serviceScope", scope);
        return b.signWith(Keys.hmacShaKeyFor("0123456789ABCDEF0123456789ABCDEF".getBytes(StandardCharsets.UTF_8))).compact();
    }
    @Test void onlyScopedServiceTokenIsAcceptedThroughSecurityChain() throws Exception {
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isUnauthorized());
        mvc.perform(post(URL).cookie(new Cookie("access_token", token("student", null, 60)))
                .contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isUnauthorized());
        for (String invalid : new String[]{"bad", token("contract-service", "community-moderation", 60),
                token("learning-service", null, 60), token("learning-service", "community-moderation", -60)}) {
            mvc.perform(post(URL).header("X-Service-Token", invalid).contentType(MediaType.APPLICATION_JSON).content(BODY))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post(URL).header("X-Service-Token", token("learning-service", "community-moderation", 60))
                .contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isOk());
        verify(classifier, times(1)).classify(any());
    }

    @Test void ordinaryJwtCannotCallRewriteAndScopedServiceCan() throws Exception {
        String url = "/api/ai/internal/community/rewrite";
        String body = "{\"postType\":\"TUTOR_POLL\",\"title\":\"test\",\"content\":\"test\","
                + "\"moderationStatus\":\"REJECTED\",\"moderationCategories\":[\"SPAM\"],\"moderationReason\":\"Lý do\"}";
        when(rewriteAssistant.rewrite(any())).thenReturn(new CommunityRewriteAssistant.Result(
                true, "Tiêu đề", "Nội dung", "Đã sửa"));
        mvc.perform(post(url).cookie(new Cookie("access_token", token("student", null, 60)))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        mvc.perform(post(url).header("X-Service-Token", token("learning-service", "community-moderation", 60))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        mvc.perform(post(url).header("X-Service-Token", token("learning-service", "community-rewrite", 60))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
    }
}
