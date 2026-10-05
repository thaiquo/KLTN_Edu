package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.client.TutorCandidateClient;
import iuh.fit.ai_service.client.AccountLocationClient;
import iuh.fit.ai_service.client.LearningPublicClassClient;
import iuh.fit.ai_service.client.LearningCatalogClient;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassSchedule;
import iuh.fit.ai_service.dto.ClassMatchingDtos.LevelBrief;
import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassSource;
import iuh.fit.ai_service.dto.ClassMatchingDtos.RegistrationBrief;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ClassGeminiRequirementExtraction;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.GeminiRequirementExtraction;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.TimeOfDayHint;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCatalogSnapshot;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCategory;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningLevel;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningOption;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningSubject;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LocationSnapshot;
import iuh.fit.ai_service.dto.TutorMatchingDtos.AvailabilitySlot;
import iuh.fit.ai_service.dto.TutorMatchingDtos.Level;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SafeLocation;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SubjectCapability;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;
import iuh.fit.ai_service.service.RequirementExtractionClient;
import iuh.fit.ai_service.service.ClassRequirementExtractionClient;
import iuh.fit.ai_service.service.CatalogGroundingService.CatalogGroundingUnavailableException;
import iuh.fit.ai_service.service.CatalogGroundingService.LocationGroundingUnavailableException;
import iuh.fit.ai_service.service.GeminiService.GeminiUnavailableException;
import iuh.fit.ai_service.service.semantic.ClassSemanticIndexService;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchService;
import iuh.fit.ai_service.service.semantic.ClassSemanticVectorStore;
import iuh.fit.ai_service.service.semantic.SemanticVectorStore;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchService;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexService;
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

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Set;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "jwt.secret=0123456789ABCDEF0123456789ABCDEF",
        "account.service.url=http://localhost:18081"
})
@AutoConfigureMockMvc
class TutorMatchingSecurityTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF";
    private static final Long SUBJECT_ID = 5L;
    private static final Long LEVEL_ID = 9L;

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TutorCandidateClient candidateClient;

    @MockBean
    private RequirementExtractionClient extractionClient;

    @MockBean
    private ClassRequirementExtractionClient classExtractionClient;

    @MockBean
    private LearningCatalogClient learningCatalogClient;

    @MockBean
    private LearningPublicClassClient learningPublicClassClient;

    @MockBean
    private AccountLocationClient accountLocationClient;

    @MockBean
    private SemanticVectorStore semanticVectorStore;

    @MockBean
    private TutorSemanticIndexService tutorSemanticIndexService;

    @MockBean
    private StudentSemanticSearchService studentSemanticSearchService;

    @MockBean
    private ClassSemanticVectorStore classSemanticVectorStore;

    @MockBean
    private ClassSemanticIndexService classSemanticIndexService;

    @MockBean
    private ClassSemanticSearchService classSemanticSearchService;

    @Test
    void unauthenticatedMatchingRequestReturns401() throws Exception {
        mockMvc.perform(post("/api/ai/matching/tutors")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(candidateClient);
    }

    @Test
    void authenticatedStudentCanUseMatching() throws Exception {
        when(candidateClient.findCandidates(eq(SUBJECT_ID), eq(LEVEL_ID), eq(TeachingMode.ONLINE)))
                .thenReturn(List.of(candidate()));

        mockMvc.perform(post("/api/ai/matching/tutors")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eligibleCandidates").value(1))
                .andExpect(jsonPath("$.results[0].matchPercentage").isNumber());

        verify(candidateClient).findCandidates(SUBJECT_ID, LEVEL_ID, TeachingMode.ONLINE);
    }

    @Test
    void authenticatedTutorReceives403() throws Exception {
        mockMvc.perform(post("/api/ai/matching/tutors")
                        .with(csrf())
                        .cookie(accessToken("tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(candidateClient);
    }

    @Test
    void authenticatedStaffReceives403() throws Exception {
        mockMvc.perform(post("/api/ai/matching/tutors")
                        .with(csrf())
                        .cookie(accessToken("staff@gmail.com", "STAFF", List.of("STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(candidateClient);
    }

    @Test
    void authenticatedAdminReceives403() throws Exception {
        mockMvc.perform(post("/api/ai/matching/tutors")
                        .with(csrf())
                        .cookie(accessToken("admin@gmail.com", "ADMIN", List.of("ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(candidateClient);
    }

    @Test
    void invalidJwtReceives401() throws Exception {
        mockMvc.perform(post("/api/ai/matching/tutors")
                        .with(csrf())
                        .cookie(new Cookie("access_token", "not-a-jwt"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(candidateClient);
    }

    @Test
    void expiredJwtReceives401() throws Exception {
        mockMvc.perform(post("/api/ai/matching/tutors")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT"), -60))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(candidateClient);
    }

    @Test
    void validStudentJwtMapsCorrectAuthority() throws Exception {
        when(candidateClient.findCandidates(eq(SUBJECT_ID), eq(LEVEL_ID), eq(TeachingMode.ONLINE)))
                .thenReturn(List.of(candidate()));

        mockMvc.perform(post("/api/ai/matching/tutors")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT", "TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].tutorId").value(920001));
    }

    @Test
    void requestBodyCannotSpoofStudentRole() throws Exception {
        String spoofedBody = """
                {
                  "subjectId": 5,
                  "levelId": 9,
                  "teachingMode": "ONLINE",
                  "budgetMin": 200000,
                  "budgetMax": 300000,
                  "role": "STUDENT",
                  "preferredSchedules": [
                    { "dayOfWeek": 2, "startTime": "18:30", "endTime": "20:30" }
                  ]
                }
                """;

        mockMvc.perform(post("/api/ai/matching/tutors")
                        .with(csrf())
                        .cookie(accessToken("tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(spoofedBody))
                .andExpect(status().isForbidden());

        verifyNoInteractions(candidateClient);
    }

    @Test
    void csrfProtectionRemainsEnabledForMatchingPost() throws Exception {
        mockMvc.perform(post("/api/ai/matching/tutors")
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(candidateClient);
    }

    @Test
    void unauthenticatedAnalyzeRequestReturns401() throws Exception {
        mockMvc.perform(post("/api/ai/matching/analyze")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(analyzeBody()))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(extractionClient);
    }

    @Test
    void authenticatedStudentCanAnalyzeRequirement() throws Exception {
        when(extractionClient.extractRequirement(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(analysisExtraction());

        mockMvc.perform(post("/api/ai/matching/analyze")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(analyzeBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXTRACTED"))
                .andExpect(jsonPath("$.requirement.subjectHint").value("Toán"))
                .andExpect(jsonPath("$.requirement.teachingMode").value("ONLINE"));

        verify(extractionClient).extractRequirement(org.mockito.ArgumentMatchers.contains("Toán"));
    }

    @Test
    void authenticatedTutorCannotAnalyzeRequirement() throws Exception {
        mockMvc.perform(post("/api/ai/matching/analyze")
                        .with(csrf())
                        .cookie(accessToken("tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(analyzeBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(extractionClient);
    }

    @Test
    void authenticatedStaffCannotAnalyzeRequirement() throws Exception {
        mockMvc.perform(post("/api/ai/matching/analyze")
                        .with(csrf())
                        .cookie(accessToken("staff@gmail.com", "STAFF", List.of("STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(analyzeBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(extractionClient);
    }

    @Test
    void authenticatedAdminCannotAnalyzeRequirement() throws Exception {
        mockMvc.perform(post("/api/ai/matching/analyze")
                        .with(csrf())
                        .cookie(accessToken("admin@gmail.com", "ADMIN", List.of("ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(analyzeBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(extractionClient);
    }

    @Test
    void analyzeRequestBodyCannotSpoofRole() throws Exception {
        String spoofedBody = """
                {
                  "message": "Em muốn học Toán lớp 12 online.",
                  "role": "STUDENT",
                  "studentId": 1
                }
                """;

        mockMvc.perform(post("/api/ai/matching/analyze")
                        .with(csrf())
                        .cookie(accessToken("tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(spoofedBody))
                .andExpect(status().isForbidden());

        verifyNoInteractions(extractionClient);
    }

    @Test
    void analyzeProviderFailureReturnsControlled503() throws Exception {
        when(extractionClient.extractRequirement(org.mockito.ArgumentMatchers.anyString()))
                .thenThrow(new GeminiUnavailableException("Gemini 503 high demand"));

        mockMvc.perform(post("/api/ai/matching/analyze")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(analyzeBody()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Gemini requirement analysis is temporarily unavailable"));
    }

    @Test
    void unauthenticatedGroundRequestReturns401() throws Exception {
        mockMvc.perform(post("/api/ai/matching/ground")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groundBody()))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(learningCatalogClient);
    }

    @Test
    void authenticatedStudentCanGroundRequirement() throws Exception {
        when(learningCatalogClient.groundingSnapshot()).thenReturn(catalogSnapshot());

        mockMvc.perform(post("/api/ai/matching/ground")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groundBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GROUNDED"))
                .andExpect(jsonPath("$.coreMatchingReady").value(true))
                .andExpect(jsonPath("$.requirement.subject.id").value(5))
                .andExpect(jsonPath("$.requirement.level.id").value(9));
    }

    @Test
    void authenticatedTutorCannotGroundRequirement() throws Exception {
        mockMvc.perform(post("/api/ai/matching/ground")
                        .with(csrf())
                        .cookie(accessToken("tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groundBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(learningCatalogClient);
    }

    @Test
    void authenticatedStaffCannotGroundRequirement() throws Exception {
        mockMvc.perform(post("/api/ai/matching/ground")
                        .with(csrf())
                        .cookie(accessToken("staff@gmail.com", "STAFF", List.of("STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groundBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(learningCatalogClient);
    }

    @Test
    void authenticatedAdminCannotGroundRequirement() throws Exception {
        mockMvc.perform(post("/api/ai/matching/ground")
                        .with(csrf())
                        .cookie(accessToken("admin@gmail.com", "ADMIN", List.of("ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groundBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(learningCatalogClient);
    }

    @Test
    void groundCatalogUnavailableReturnsControlled503() throws Exception {
        when(learningCatalogClient.groundingSnapshot())
                .thenThrow(new CatalogGroundingUnavailableException("Learning catalog is unavailable"));

        mockMvc.perform(post("/api/ai/matching/ground")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groundBody()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Learning catalog grounding is temporarily unavailable"));
    }

    @Test
    void groundLocationUnavailableReturnsControlled503() throws Exception {
        when(learningCatalogClient.groundingSnapshot()).thenReturn(catalogSnapshot());
        when(accountLocationClient.locationSnapshot())
                .thenThrow(new LocationGroundingUnavailableException("Location data is unavailable"));

        mockMvc.perform(post("/api/ai/matching/ground")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offlineGroundBody()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Location grounding is temporarily unavailable"));
    }

    @Test
    void authenticatedStudentCannotInitializeSemanticCollection() throws Exception {
        mockMvc.perform(post("/api/ai/semantic/collection/init")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT"))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(semanticVectorStore);
    }

    @Test
    void authenticatedStaffCanInitializeSemanticCollection() throws Exception {
        mockMvc.perform(post("/api/ai/semantic/collection/init")
                        .with(csrf())
                        .cookie(accessToken("staff@gmail.com", "STAFF", List.of("STAFF"))))
                .andExpect(status().isOk());

        verify(semanticVectorStore).initializeCollection();
    }

    @Test
    void authenticatedAdminCanInitializeSemanticCollection() throws Exception {
        mockMvc.perform(post("/api/ai/semantic/collection/init")
                        .with(csrf())
                        .cookie(accessToken("admin@gmail.com", "ADMIN", List.of("ADMIN"))))
                .andExpect(status().isOk());

        verify(semanticVectorStore).initializeCollection();
    }

    @Test
    void unauthenticatedClassAnalyzeRequestReturns401() throws Exception {
        mockMvc.perform(post("/api/ai/classes/analyze")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(classAnalyzeBody()))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(classExtractionClient);
    }

    @Test
    void authenticatedStudentCanAnalyzeClassRequirement() throws Exception {
        when(classExtractionClient.extractClassRequirement(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(classAnalysisExtraction());

        mockMvc.perform(post("/api/ai/classes/analyze")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(classAnalyzeBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXTRACTED"))
                .andExpect(jsonPath("$.requirement.subjectHint").value("Toán"))
                .andExpect(jsonPath("$.requirement.teachingMode").value("ONLINE"));
    }

    @Test
    void authenticatedTutorCannotAnalyzeClassRequirement() throws Exception {
        mockMvc.perform(post("/api/ai/classes/analyze")
                        .with(csrf())
                        .cookie(accessToken("tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(classAnalyzeBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(classExtractionClient);
    }

    @Test
    void authenticatedStudentCanGroundClassRequirement() throws Exception {
        when(learningCatalogClient.groundingSnapshot()).thenReturn(catalogSnapshot());

        mockMvc.perform(post("/api/ai/classes/ground")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(classGroundBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GROUNDED"))
                .andExpect(jsonPath("$.coreSearchReady").value(true))
                .andExpect(jsonPath("$.requirement.subject.id").value(5))
                .andExpect(jsonPath("$.requirement.level.id").value(9));
    }

    @Test
    void authenticatedStaffCannotGroundClassRequirement() throws Exception {
        mockMvc.perform(post("/api/ai/classes/ground")
                        .with(csrf())
                        .cookie(accessToken("staff@gmail.com", "STAFF", List.of("STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(classGroundBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(learningCatalogClient);
    }

    @Test
    void authenticatedStudentCanMatchClasses() throws Exception {
        when(learningPublicClassClient.findSemanticSources(
                eq(null),
                eq(SUBJECT_ID),
                eq(LEVEL_ID),
                eq(TeachingMode.ONLINE),
                eq(true),
                eq(null)
        )).thenReturn(List.of(publicClass()));

        mockMvc.perform(post("/api/ai/classes/match")
                        .with(csrf())
                        .cookie(accessToken("student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(classMatchBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eligibleCandidates").value(1))
                .andExpect(jsonPath("$.results[0].classId").value(7001));
    }

    @Test
    void authenticatedTutorCannotMatchClasses() throws Exception {
        mockMvc.perform(post("/api/ai/classes/match")
                        .with(csrf())
                        .cookie(accessToken("tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(classMatchBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(learningPublicClassClient);
    }

    private Cookie accessToken(String email, String activeRole, List<String> roles) {
        return accessToken(email, activeRole, roles, 900);
    }

    private Cookie accessToken(String email, String activeRole, List<String> roles, long expiresInSeconds) {
        Instant now = Instant.now();
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .subject(email)
                .claim("activeRole", activeRole)
                .claim("roles", roles)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(expiresInSeconds)))
                .signWith(key)
                .compact();
        return new Cookie("access_token", token);
    }

    private String requestBody() {
        return """
                {
                  "subjectId": 5,
                  "levelId": 9,
                  "teachingMode": "ONLINE",
                  "budgetMin": 200000,
                  "budgetMax": 300000,
                  "preferredSchedules": [
                    { "dayOfWeek": 2, "startTime": "18:30", "endTime": "20:30" },
                    { "dayOfWeek": 4, "startTime": "18:30", "endTime": "20:30" }
                  ],
                  "learningGoal": "Ôn thi THPT môn Toán"
                }
                """;
    }

    private String analyzeBody() {
        return """
                {
                  "message": "Em học lớp 12, mất gốc Toán và muốn học online tối thứ 2."
                }
                """;
    }

    private String classAnalyzeBody() {
        return """
                {
                  "message": "Em muốn tìm lớp Toán lớp 12 online tối thứ 2, 4, 6."
                }
                """;
    }

    private String groundBody() {
        return """
                {
                  "requirement": {
                    "subjectHint": "ToÃ¡n",
                    "levelHint": "Lá»›p 12",
                    "teachingMode": "ONLINE",
                    "budget": null,
                    "preferredSchedules": [],
                    "learningGoal": "Ã”n thi tá»‘t nghiá»‡p",
                    "weakTopics": ["TÃ­ch phÃ¢n"],
                    "tutorPreferences": ["Dáº¡y cháº­m"],
                    "locationHint": null
                  }
                }
                """;
    }

    private String offlineGroundBody() {
        return """
                {
                  "requirement": {
                    "subjectHint": "MATH",
                    "levelHint": "GRADE_12",
                    "teachingMode": "OFFLINE",
                    "budget": null,
                    "preferredSchedules": [],
                    "learningGoal": "On thi",
                    "weakTopics": [],
                    "tutorPreferences": [],
                    "locationHint": "TP.HCM"
                  }
                }
                """;
    }

    private String classGroundBody() {
        return """
                {
                  "requirement": {
                    "subjectHint": "MATH",
                    "levelHint": "GRADE_12",
                    "teachingMode": "ONLINE",
                    "budget": null,
                    "availableSchedules": [],
                    "learningGoal": "On thi tot nghiep",
                    "weakTopics": ["Hinh hoc khong gian"],
                    "classPreferences": ["Lop nho"],
                    "locationHint": null
                  }
                }
                """;
    }

    private String classMatchBody() {
        return """
                {
                  "requirement": {
                    "subject": { "id": 5, "code": "MATH", "name": "Toan", "context": null },
                    "level": { "id": 9, "code": "GRADE_12", "name": "Lop 12", "context": null },
                    "teachingMode": "ONLINE",
                    "budget": { "min": 200000, "max": 350000, "target": 250000, "currency": "VND", "unit": "SESSION", "approximate": true },
                    "availableSchedules": [
                      { "dayOfWeek": 2, "startTime": "18:00", "endTime": "21:00", "timeOfDayHint": null }
                    ],
                    "learningGoal": "On thi tot nghiep",
                    "weakTopics": ["Hinh hoc khong gian"],
                    "classPreferences": ["Lop nho"],
                    "locationHint": null
                  },
                  "topK": 5
                }
                """;
    }

    private GeminiRequirementExtraction analysisExtraction() {
        return new GeminiRequirementExtraction(
                true,
                "Toán",
                "Lớp 12",
                TeachingMode.ONLINE,
                new Budget(null, null, BigDecimal.valueOf(250_000), "VND", "SESSION", true),
                List.of(new PreferredSchedule(2, null, null, TimeOfDayHint.EVENING)),
                "Ôn thi tốt nghiệp",
                List.of("Tích phân"),
                List.of("Dạy chậm"),
                null,
                List.of()
        );
    }

    private ClassGeminiRequirementExtraction classAnalysisExtraction() {
        return new ClassGeminiRequirementExtraction(
                true,
                "Toán",
                "Lớp 12",
                TeachingMode.ONLINE,
                new Budget(null, null, BigDecimal.valueOf(250_000), "VND", "SESSION", true),
                List.of(
                        new PreferredSchedule(2, null, null, TimeOfDayHint.EVENING),
                        new PreferredSchedule(4, null, null, TimeOfDayHint.EVENING),
                        new PreferredSchedule(6, null, null, TimeOfDayHint.EVENING)
                ),
                "Ôn thi tốt nghiệp",
                List.of("Hình học không gian"),
                List.of("Lớp nhỏ"),
                null,
                List.of()
        );
    }

    private TutorCandidate candidate() {
        return new TutorCandidate(
                920001L,
                920001L,
                "Nguyễn Minh Anh",
                null,
                "Ôn thi Toán",
                true,
                new SafeLocation("HO_CHI_MINH", "Thành phố Hồ Chí Minh", "HCM_SAI_GON", "Phường Sài Gòn", null),
                Set.of("ONLINE", "OFFLINE"),
                List.of(new SubjectCapability(
                        16L,
                        SUBJECT_ID,
                        "Toán",
                        6L,
                        "Khoa học tự nhiên",
                        List.of(new Level(LEVEL_ID, "Lớp 12")),
                        7,
                        BigDecimal.valueOf(250_000),
                        BigDecimal.valueOf(350_000),
                        "Ôn thi THPT Quốc gia môn Toán"
                )),
                BigDecimal.valueOf(250_000),
                List.of(
                        new AvailabilitySlot(1L, 2, "18:30", "21:30"),
                        new AvailabilitySlot(2L, 4, "18:30", "21:30")
                ),
                4.75,
                4L,
                0L,
                null
        );
    }

    private PublicClassSource publicClass() {
        return new PublicClassSource(
                7001L,
                16L,
                new RegistrationBrief(
                        16L,
                        1L,
                        "Hoc thuat",
                        2L,
                        "THPT",
                        6L,
                        "Khoa hoc tu nhien",
                        SUBJECT_ID,
                        "Toan",
                        "MATH",
                        BigDecimal.valueOf(200_000),
                        BigDecimal.valueOf(350_000)
                ),
                new LevelBrief(LEVEL_ID, "Lop 12", "GRADE_12"),
                930001L,
                "Nguyen Minh Anh",
                "Lop on thi Toan 12",
                "On thi tot nghiep mon Toan",
                TeachingMode.ONLINE,
                null,
                12,
                3L,
                9L,
                false,
                BigDecimal.valueOf(250_000),
                BigDecimal.valueOf(3_000_000),
                3,
                90,
                java.time.LocalDate.now().plusDays(10),
                java.time.LocalDate.now().plusMonths(3),
                36,
                "OPEN_REQUEST",
                "PUBLISHED",
                4.8,
                12L,
                List.of(new ClassSchedule(1L, 2, "18:30", "20:00")),
                List.of(),
                List.of("Ham so"),
                java.time.LocalDateTime.now(),
                java.time.LocalDateTime.now()
        );
    }

    private LearningCatalogSnapshot catalogSnapshot() {
        LearningCategory category = new LearningCategory(
                6L,
                "ACADEMIC",
                "Khoa há»c tá»± nhiÃªn",
                new LearningOption(1L, "ACADEMIC", "Há»c thuáº­t", null),
                new LearningOption(2L, "HIGH_SCHOOL", "THPT", null)
        );
        return new LearningCatalogSnapshot(List.of(new LearningSubject(
                5L,
                "MATH",
                "ToÃ¡n",
                null,
                category,
                List.of(new LearningLevel(9L, "GRADE_12", "Lá»›p 12", "GRADE", null))
        )));
    }
}
