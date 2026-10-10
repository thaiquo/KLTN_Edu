package iuh.fit.ai_service.chatbot.controller;

import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeSearchHit;
import iuh.fit.ai_service.chatbot.rag.ChatRagRetriever;
import iuh.fit.ai_service.chatbot.service.GeminiTextClient;
import iuh.fit.ai_service.chatbot.service.private_tools.PrivateContractClient;
import iuh.fit.ai_service.chatbot.service.private_tools.PrivateLearningClient;
import iuh.fit.ai_service.client.AccountLocationClient;
import iuh.fit.ai_service.client.AccountPublicTutorLookupClient;
import iuh.fit.ai_service.client.LearningCatalogClient;
import iuh.fit.ai_service.client.LearningPublicClassClient;
import iuh.fit.ai_service.client.TutorCandidateClient;
import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassSearchPage;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCatalogSnapshot;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCategory;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningLevel;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningOption;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningSubject;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorSearchPage;
import iuh.fit.ai_service.service.ClassRequirementExtractionClient;
import iuh.fit.ai_service.service.RequirementExtractionClient;
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
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
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
class ChatbotControllerTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF";

    @Autowired
    private MockMvc mockMvc;

    @MockBean private GeminiTextClient geminiTextClient;
    @MockBean private ChatRagRetriever chatRagRetriever;
    @MockBean private TutorCandidateClient candidateClient;
    @MockBean private RequirementExtractionClient extractionClient;
    @MockBean private ClassRequirementExtractionClient classExtractionClient;
    @MockBean private LearningCatalogClient learningCatalogClient;
    @MockBean private AccountPublicTutorLookupClient accountPublicTutorLookupClient;
    @MockBean private LearningPublicClassClient learningPublicClassClient;
    @MockBean private AccountLocationClient accountLocationClient;
    @MockBean private SemanticVectorStore semanticVectorStore;
    @MockBean private TutorSemanticIndexService tutorSemanticIndexService;
    @MockBean private StudentSemanticSearchService studentSemanticSearchService;
    @MockBean private ClassSemanticVectorStore classSemanticVectorStore;
    @MockBean private ClassSemanticIndexService classSemanticIndexService;
    @MockBean private ClassSemanticSearchService classSemanticSearchService;
    @MockBean private PrivateLearningClient privateLearningClient;
    @MockBean private PrivateContractClient privateContractClient;

    @Test
    void guestCanCallChatEndpoint() throws Exception {
        when(chatRagRetriever.retrieve(anyString(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(new KnowledgeSearchHit(
                        "point-1", "overview", "Tổng quan EduConnect", "EduConnect là gì?",
                        "overview", "EduConnect là nền tảng kết nối Student và Tutor.", 0.88
                )));
        when(geminiTextClient.generateText(anyString(), anyString(), anyInt()))
                .thenReturn("EduConnect là nền tảng kết nối học viên và gia sư.");

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "EduConnect là gì?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("GENERAL_KNOWLEDGE"))
                .andExpect(jsonPath("$.message").value("EduConnect là nền tảng kết nối học viên và gia sư."))
                .andExpect(jsonPath("$.sources[0].title").value("Tổng quan EduConnect"))
                .andExpect(jsonPath("$.sources[0].section").value("EduConnect là gì?"));
    }

    @Test
    void emptyMessageIsRejected() throws Exception {
        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "   " }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"));

        verifyNoInteractions(geminiTextClient);
    }

    @Test
    void guestPrivateDataRequestIsGuidedToLoginWithoutDownstreamCall() throws Exception {
        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "Tôi có bài tập gì?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("HOMEWORK"))
                .andExpect(jsonPath("$.actions[0].id").value("OPEN_LOGIN"));

        verifyNoInteractions(privateLearningClient, privateContractClient, geminiTextClient);
    }

    @Test
    void guestClassQuestionIsGuidedToLoginWithoutDownstreamCall() throws Exception {
        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "T\u00f4i \u0111ang h\u1ecdc l\u1edbp n\u00e0o?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("MY_CLASSES"))
                .andExpect(jsonPath("$.actions[0].id").value("OPEN_LOGIN"));

        verifyNoInteractions(privateLearningClient, privateContractClient, geminiTextClient);
    }

    @Test
    void authenticatedStudentClassQuestionUsesStudentClassesToolAndEmptyState() throws Exception {
        when(privateLearningClient.studentClasses()).thenReturn(List.of());

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(101L, "student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "T\u00f4i \u0111ang h\u1ecdc l\u1edbp n\u00e0o?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("MY_CLASSES"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("ch\u01b0a tham gia l\u1edbp h\u1ecdc n\u00e0o")))
                .andExpect(jsonPath("$.toolResult.type").value("STUDENT_CLASSES"))
                .andExpect(jsonPath("$.toolResult.totalCount").value(0))
                .andExpect(jsonPath("$.toolResult.items").isEmpty());

        verify(privateLearningClient).studentClasses();
        verifyNoInteractions(privateContractClient, geminiTextClient);
    }

    @Test
    void publicTutorCountUsesAuthoritativeTotalElementsAndDoesNotUseRag() throws Exception {
        when(learningCatalogClient.groundingSnapshot()).thenReturn(catalogSnapshot());
        when(accountPublicTutorLookupClient.search(10L, null, 3))
                .thenReturn(new TutorSearchPage(List.of(), 0, 3, 12, 4, false));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "C\u00f3 bao nhi\u00eau gia s\u01b0 d\u1ea1y To\u00e1n?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("PUBLIC_TUTOR_LOOKUP"))
                .andExpect(jsonPath("$.message").value("Hi\u1ec7n c\u00f3 12 gia s\u01b0 c\u00f4ng khai d\u1ea1y To\u00e1n."))
                .andExpect(jsonPath("$.sources").isEmpty())
                .andExpect(jsonPath("$.toolResult.type").value("PUBLIC_TUTOR_LOOKUP"))
                .andExpect(jsonPath("$.toolResult.total").value(12))
                .andExpect(jsonPath("$.toolResult.filters.subjectId").value(10))
                .andExpect(jsonPath("$.toolResult.countSource").value("totalElements"));

        verifyNoInteractions(chatRagRetriever, geminiTextClient, privateLearningClient, privateContractClient);
    }

    @Test
    void publicClassCountUsesAuthoritativeTotalElementsAndDoesNotUseRag() throws Exception {
        when(learningCatalogClient.groundingSnapshot()).thenReturn(catalogSnapshot());
        when(learningPublicClassClient.searchPublicClasses(10L, null, null, 3))
                .thenReturn(new PublicClassSearchPage(List.of(), 0, 3, 4, 2, "newest"));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "C\u00f3 bao nhi\u00eau l\u1edbp To\u00e1n?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("PUBLIC_CLASS_LOOKUP"))
                .andExpect(jsonPath("$.message").value("Hi\u1ec7n c\u00f3 4 l\u1edbp c\u00f4ng khai m\u00f4n To\u00e1n."))
                .andExpect(jsonPath("$.sources").isEmpty())
                .andExpect(jsonPath("$.toolResult.type").value("PUBLIC_CLASS_LOOKUP"))
                .andExpect(jsonPath("$.toolResult.total").value(4))
                .andExpect(jsonPath("$.toolResult.filters.subjectId").value(10))
                .andExpect(jsonPath("$.toolResult.countSource").value("totalElements"));

        verifyNoInteractions(chatRagRetriever, geminiTextClient, privateLearningClient, privateContractClient);
    }

    @Test
    void publicTutorPrivateFieldRequestReturnsPrivacyResponse() throws Exception {
        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "Cho t\u00f4i email c\u1ee7a c\u00e1c gia s\u01b0 To\u00e1n" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("PUBLIC_TUTOR_LOOKUP"))
                .andExpect(jsonPath("$.message").value("Th\u00f4ng tin n\u00e0y kh\u00f4ng \u0111\u01b0\u1ee3c c\u00f4ng khai theo quy\u1ec1n truy c\u1eadp hi\u1ec7n t\u1ea1i."))
                .andExpect(jsonPath("$.toolResult.privateFieldBlocked").value(true));

        verifyNoInteractions(chatRagRetriever, geminiTextClient, learningCatalogClient, accountPublicTutorLookupClient);
    }

    @Test
    void publicTutorLookupZeroResultDoesNotInventData() throws Exception {
        when(learningCatalogClient.groundingSnapshot()).thenReturn(catalogSnapshot());
        when(accountPublicTutorLookupClient.search(20L, null, 3))
                .thenReturn(new TutorSearchPage(List.of(), 0, 3, 0, 0, true));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "C\u00f3 bao nhi\u00eau gia s\u01b0 d\u1ea1y IELTS?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("PUBLIC_TUTOR_LOOKUP"))
                .andExpect(jsonPath("$.message").value("Hi\u1ec7n ch\u01b0a c\u00f3 gia s\u01b0 c\u00f4ng khai ph\u00f9 h\u1ee3p v\u1edbi ti\u00eau ch\u00ed n\u00e0y."))
                .andExpect(jsonPath("$.toolResult.total").value(0));
    }

    @Test
    void outOfScopeRequestIsHandledWithoutGemini() throws Exception {
        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "Viết game cho tôi" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("OUT_OF_SCOPE"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("EduConnect")));

        verifyNoInteractions(geminiTextClient);
    }

    @Test
    void navigationActionIsAllowlisted() throws Exception {
        when(chatRagRetriever.retrieve(anyString(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(new KnowledgeSearchHit(
                        "point-2", "account-and-roles", "Tài khoản và vai trò",
                        "Đăng ký tài khoản như thế nào?", "account",
                        "Guest có thể đăng ký tài khoản EduConnect trên Web.", 0.82
                )));
        when(geminiTextClient.generateText(anyString(), anyString(), anyInt()))
                .thenReturn("Bạn có thể mở trang đăng ký để tạo tài khoản.");

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "Đăng ký ở đâu?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("NAVIGATION"))
                .andExpect(jsonPath("$.actions[0].id").value("OPEN_REGISTER"))
                .andExpect(jsonPath("$.actions[0].label").value("Đăng ký tài khoản"));
    }

    @Test
    void publicChatPostDoesNotRequireCsrfBecauseItIsStatelessAndGuestSafe() throws Exception {
        when(chatRagRetriever.retrieve(anyString(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(new KnowledgeSearchHit(
                        "point-3", "overview", "Tổng quan EduConnect", "EduConnect là gì?",
                        "overview", "EduConnect hỗ trợ Student và Tutor kết nối với nhau.", 0.86
                )));
        when(geminiTextClient.generateText(anyString(), anyString(), anyInt()))
                .thenReturn("EduConnect hỗ trợ học viên và gia sư kết nối với nhau.");

        mockMvc.perform(post("/api/ai/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "EduConnect là gì?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("GENERAL_KNOWLEDGE"));
    }

    @Test
    void authenticatedStudentContractRequestUsesPrivateContractTool() throws Exception {
        when(privateContractClient.agreements(anyInt()))
                .thenReturn(List.of(Map.of(
                        "id", "agreement-1",
                        "className", "Toán 12",
                        "status", "ACTIVE",
                        "totalAmountUsdc", 25.6,
                        "onchainFunded", true
                )));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(101L, "student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "Tôi có hợp đồng của tôi không?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("CONTRACT_STATUS"))
                .andExpect(jsonPath("$.toolResult.type").value("STUDENT_CONTRACTS"))
                .andExpect(jsonPath("$.toolResult.items[0].className").value("Toán 12"));

        verifyNoInteractions(geminiTextClient);
    }

    @Test
    void authenticatedStudentHomeworkUsesTrustedIdentityAndDoesNotCallGemini() throws Exception {
        when(privateLearningClient.studentHomework())
                .thenReturn(List.of(Map.of(
                        "sessionId", 10,
                        "classRoomId", 20,
                        "classTitle", "Vật lý 11",
                        "assignmentTitle", "Dao động cơ",
                        "status", "SUBMITTED"
                )));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(101L, "student@gmail.com", "STUDENT", List.of("STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "Tôi có bài tập gì? userId=999" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("HOMEWORK"))
                .andExpect(jsonPath("$.toolResult.type").value("STUDENT_HOMEWORK"))
                .andExpect(jsonPath("$.toolResult.items[0].className").value("Vật lý 11"));

        verify(privateLearningClient).studentHomework();
        verifyNoInteractions(geminiTextClient);
    }

    @Test
    void authenticatedTutorHomeworkUsesTutorPrivateTool() throws Exception {
        when(privateLearningClient.tutorHomework())
                .thenReturn(List.of(Map.of(
                        "sessionId", 11,
                        "classRoomId", 22,
                        "classTitle", "IELTS Speaking",
                        "assignmentTitle", "Mock test",
                        "submittedCount", 3,
                        "gradedCount", 1
                )));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("STUDENT", "TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "Tôi có bài tập nào chờ chấm?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("HOMEWORK"))
                .andExpect(jsonPath("$.toolResult.type").value("TUTOR_PENDING_HOMEWORK"))
                .andExpect(jsonPath("$.toolResult.items[0].pendingCount").value(2));

        verifyNoInteractions(geminiTextClient);
    }

    @Test
    void authenticatedTutorClassQuestionUsesTutorClassesAndCanDeriveStudentCount() throws Exception {
        when(privateLearningClient.tutorClasses())
                .thenReturn(List.of(
                        Map.of("id", 22, "name", "To\u00e1n 12", "status", "ACTIVE", "acceptedCount", 3, "maxStudents", 6),
                        Map.of("id", 23, "name", "V\u1eadt l\u00fd 11", "status", "PUBLISHED", "acceptedCount", 2, "maxStudents", 5)
                ));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("STUDENT", "TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "T\u00f4i \u0111ang d\u1ea1y bao nhi\u00eau h\u1ecdc vi\u00ean?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("MY_CLASSES"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("5 h\u1ecdc vi\u00ean")))
                .andExpect(jsonPath("$.toolResult.type").value("TUTOR_CLASSES"))
                .andExpect(jsonPath("$.toolResult.totalCount").value(2))
                .andExpect(jsonPath("$.toolResult.items[0].acceptedCount").value(3));

        verify(privateLearningClient).tutorClasses();
        verifyNoInteractions(geminiTextClient, privateContractClient);
    }

    @Test
    void authenticatedTutorScheduleQuestionUsesTutorScheduleToolInsteadOfPublicClassLookup() throws Exception {
        when(privateLearningClient.tutorClasses())
                .thenReturn(List.of(Map.of("id", 22, "name", "To\u00e1n 12", "status", "ACTIVE")));
        when(privateLearningClient.classSessions(22L))
                .thenReturn(List.of(Map.of(
                        "id", 31,
                        "classRoomId", 22,
                        "sequenceNumber", 4,
                        "topic", "\u00d4n h\u00e0m s\u1ed1",
                        "sessionDate", java.time.LocalDate.now().toString(),
                        "startTime", "19:00",
                        "endTime", "20:30",
                        "status", "SCHEDULED"
                )));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "H\u00f4m nay t\u00f4i d\u1ea1y g\u00ec?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("CURRENT_SCHEDULE"))
                .andExpect(jsonPath("$.toolResult.type").value("TUTOR_SCHEDULE"))
                .andExpect(jsonPath("$.toolResult.totalCount").value(1))
                .andExpect(jsonPath("$.toolResult.items[0].className").value("To\u00e1n 12"));

        verify(privateLearningClient).tutorClasses();
        verify(privateLearningClient).classSessions(22L);
        verifyNoInteractions(learningPublicClassClient, geminiTextClient, privateContractClient);
    }

    @Test
    void authenticatedTutorEnrollmentRequestToolReturnsOnlyPendingRequests() throws Exception {
        when(privateLearningClient.tutorEnrollmentRequests())
                .thenReturn(List.of(
                        Map.of("id", 1, "classRoomId", 22, "className", "To\u00e1n 12", "studentName", "An", "status", "PENDING"),
                        Map.of("id", 2, "classRoomId", 22, "className", "To\u00e1n 12", "studentName", "B\u00ecnh", "status", "ACCEPTED")
                ));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "C\u00f3 y\u00eau c\u1ea7u tham gia l\u1edbp n\u00e0o \u0111ang ch\u1edd kh\u00f4ng?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("ENROLLMENT_REQUESTS"))
                .andExpect(jsonPath("$.toolResult.type").value("TUTOR_ENROLLMENT_REQUESTS"))
                .andExpect(jsonPath("$.toolResult.totalCount").value(1))
                .andExpect(jsonPath("$.toolResult.items[0].studentName").value("An"));

        verify(privateLearningClient).tutorEnrollmentRequests();
        verifyNoInteractions(geminiTextClient, privateContractClient);
    }

    @Test
    void tutorActiveRoleCannotUseStudentPrivateClassOrHomeworkTools() throws Exception {
        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("STUDENT", "TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "T\u00f4i \u0111ang h\u1ecdc l\u1edbp n\u00e0o?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("MY_CLASSES"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("vai tr\u00f2 Tutor")))
                .andExpect(jsonPath("$.toolResult").doesNotExist());

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("STUDENT", "TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "T\u00f4i c\u00f2n b\u00e0i n\u00e0o ch\u01b0a n\u1ed9p?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("HOMEWORK"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("vai tr\u00f2 Tutor")))
                .andExpect(jsonPath("$.toolResult").doesNotExist());

        verifyNoInteractions(privateLearningClient, privateContractClient, geminiTextClient);
    }

    @Test
    void authenticatedTutorContractSettlementAndAvailabilityToolsRemainReadOnly() throws Exception {
        when(privateContractClient.agreements(anyInt()))
                .thenReturn(List.of(Map.of(
                        "id", "agreement-1",
                        "className", "To\u00e1n 12",
                        "status", "ACTIVE",
                        "totalAmountUsdc", 25.6,
                        "onchainFunded", true
                )));
        when(privateContractClient.settlements("agreement-1"))
                .thenReturn(List.of(Map.of(
                        "id", "settlement-1",
                        "sessionId", 31,
                        "status", "PENDING_FINALIZATION",
                        "tutorAmountUsdc", 21.76
                )));
        when(privateLearningClient.tutorAvailability())
                .thenReturn(List.of(Map.of("dayOfWeek", 2, "startTime", "19:00", "endTime", "21:00")));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "H\u1ee3p \u0111\u1ed3ng c\u1ee7a t\u00f4i \u0111ang th\u1ebf n\u00e0o?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("CONTRACT_STATUS"))
                .andExpect(jsonPath("$.toolResult.type").value("TUTOR_CONTRACTS"));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "Kho\u1ea3n quy\u1ebft to\u00e1n c\u1ee7a t\u00f4i th\u1ebf n\u00e0o?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("SETTLEMENTS"))
                .andExpect(jsonPath("$.toolResult.type").value("TUTOR_SETTLEMENTS"))
                .andExpect(jsonPath("$.toolResult.items[0].tutorAmountUsdc").value(21.76));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "L\u1ecbch r\u1ea3nh c\u1ee7a t\u00f4i hi\u1ec7n ra sao?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("AVAILABILITY"))
                .andExpect(jsonPath("$.toolResult.type").value("TUTOR_AVAILABILITY"))
                .andExpect(jsonPath("$.toolResult.totalCount").value(1));

        verifyNoInteractions(geminiTextClient);
    }

    @Test
    void authenticatedTutorCanStillUsePublicTutorAndClassLookup() throws Exception {
        when(learningCatalogClient.groundingSnapshot()).thenReturn(catalogSnapshot());
        when(accountPublicTutorLookupClient.search(10L, null, 3))
                .thenReturn(new TutorSearchPage(List.of(), 0, 3, 7, 3, false));
        when(learningPublicClassClient.searchPublicClasses(10L, null, null, 3))
                .thenReturn(new PublicClassSearchPage(List.of(), 0, 3, 4, 2, "newest"));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "C\u00f3 bao nhi\u00eau gia s\u01b0 d\u1ea1y To\u00e1n?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("PUBLIC_TUTOR_LOOKUP"))
                .andExpect(jsonPath("$.toolResult.total").value(7));

        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "C\u00f3 bao nhi\u00eau l\u1edbp To\u00e1n?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("PUBLIC_CLASS_LOOKUP"))
                .andExpect(jsonPath("$.toolResult.total").value(4));

        verifyNoInteractions(privateLearningClient, privateContractClient, geminiTextClient);
    }

    @Test
    void studentActiveRoleCannotUseTutorAvailabilityTool() throws Exception {
        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(101L, "student@gmail.com", "STUDENT", List.of("STUDENT", "TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "Lịch rảnh của tôi thế nào?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("AVAILABILITY"))
                .andExpect(jsonPath("$.toolResult").doesNotExist());

        verifyNoInteractions(privateLearningClient, privateContractClient, geminiTextClient);
    }

    @Test
    void mutationRequestIsDeniedWithoutCallingPrivateServices() throws Exception {
        mockMvc.perform(post("/api/ai/chat")
                        .with(csrf())
                        .cookie(accessToken(202L, "tutor@gmail.com", "TUTOR", List.of("TUTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "Chấp nhận yêu cầu tham gia lớp giúp tôi" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("MUTATION_REQUEST"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("không thể thực hiện thao tác")));

        verifyNoInteractions(privateLearningClient, privateContractClient, geminiTextClient);
    }

    @Test
    void genericLearningAdviceDoesNotUseRagOrSources() throws Exception {
        when(geminiTextClient.generateText(anyString(), anyString(), anyInt()))
                .thenReturn("Bạn nên đặt mục tiêu rõ, học đều và tự kiểm tra lại kiến thức.");

        mockMvc.perform(post("/api/ai/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "message": "Làm sao học hiệu quả?" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("GENERAL_KNOWLEDGE"))
                .andExpect(jsonPath("$.sources").isEmpty());

        verifyNoInteractions(chatRagRetriever);
    }

    private Cookie accessToken(Long userId, String email, String activeRole, List<String> roles) {
        Instant now = Instant.now();
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .subject(email)
                .claim("userId", userId)
                .claim("activeRole", activeRole)
                .claim("roles", roles)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(900)))
                .signWith(key)
                .compact();
        return new Cookie("access_token", token);
    }

    private LearningCatalogSnapshot catalogSnapshot() {
        LearningOption program = new LearningOption(1L, "SCHOOL", "Ph\u1ed5 th\u00f4ng", null);
        LearningOption education = new LearningOption(2L, "HIGH", "THPT", null);
        LearningCategory category = new LearningCategory(3L, "CORE", "M\u00f4n ph\u1ed5 th\u00f4ng", program, education);
        return new LearningCatalogSnapshot(List.of(
                new LearningSubject(10L, "MATH", "To\u00e1n", null, category, List.of(
                        new LearningLevel(101L, "GRADE_12", "L\u1edbp 12", "GRADE", null)
                )),
                new LearningSubject(20L, "IELTS", "IELTS", null, category, List.of(
                        new LearningLevel(201L, "B1", "B1", "CEFR", null)
                ))
        ));
    }
}
