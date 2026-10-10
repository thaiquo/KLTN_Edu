package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.model.ChatIntent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class ChatIntentClassifierTest {
    private final ChatIntentClassifier classifier = new ChatIntentClassifier();

    @ParameterizedTest
    @ValueSource(strings = {
            "T\u00f4i mu\u1ed1n t\u00ecm gia s\u01b0 d\u1ea1y to\u00e1n",
            "T\u00ecm gia s\u01b0 d\u1ea1y To\u00e1n",
            "T\u00f4i c\u1ea7n gia s\u01b0 To\u00e1n",
            "C\u1ea7n t\u00ecm gia s\u01b0 m\u00f4n To\u00e1n",
            "Mu\u1ed1n h\u1ecdc To\u00e1n v\u1edbi gia s\u01b0",
            "Cho t\u00f4i gia s\u01b0 To\u00e1n"
    })
    void routesTutorMatchingRequestToTutorToolIntent(String message) {
        assertThat(classifier.classify(message))
                .isEqualTo(ChatIntent.TUTOR_MATCHING);
    }

    @Test
    void keepsRichTutorSearchWithCoTheInMatchingIntent() {
        assertThat(classifier.classify("Tôi muốn tìm gia sư dạy toán lớp 12, tôi có thể học trực tiếp và online, kinh nghiệm trên 3 năm"))
                .isEqualTo(ChatIntent.TUTOR_MATCHING);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "T\u00f4i mu\u1ed1n t\u00ecm l\u1edbp To\u00e1n",
            "T\u00ecm l\u1edbp h\u1ecdc To\u00e1n",
            "C\u1ea7n l\u1edbp IELTS",
            "G\u1ee3i \u00fd l\u1edbp IELTS online cu\u1ed1i tu\u1ea7n ph\u00f9 h\u1ee3p"
    })
    void routesClassMatchingRequestToClassToolIntent(String message) {
        assertThat(classifier.classify(message))
                .isEqualTo(ChatIntent.CLASS_MATCHING);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "C\u00f3 bao nhi\u00eau gia s\u01b0?",
            "C\u00f3 bao nhi\u00eau gia s\u01b0 d\u1ea1y To\u00e1n?",
            "C\u00f3 m\u1ea5y gia s\u01b0 IELTS?",
            "C\u00f3 gia s\u01b0 To\u00e1n online kh\u00f4ng?",
            "Cho t\u00f4i email c\u1ee7a c\u00e1c gia s\u01b0 To\u00e1n"
    })
    void routesPublicTutorLookupToLookupIntent(String message) {
        assertThat(classifier.classify(message))
                .isEqualTo(ChatIntent.PUBLIC_TUTOR_LOOKUP);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "C\u00f3 bao nhi\u00eau l\u1edbp?",
            "C\u00f3 bao nhi\u00eau l\u1edbp To\u00e1n?",
            "C\u00f3 l\u1edbp IELTS online kh\u00f4ng?"
    })
    void routesPublicClassLookupToLookupIntent(String message) {
        assertThat(classifier.classify(message))
                .isEqualTo(ChatIntent.PUBLIC_CLASS_LOOKUP);
    }

    @Test
    void keepsAiMatchingExplanationInRagKnowledgeIntent() {
        assertThat(classifier.classify("AI Matching l\u00e0 g\u00ec?"))
                .isEqualTo(ChatIntent.GENERAL_KNOWLEDGE);
    }

    @Test
    void routesPrivateHomeworkToPrivateIntent() {
        assertThat(classifier.classify("T\u00f4i c\u00f3 b\u00e0i t\u1eadp g\u00ec?"))
                .isEqualTo(ChatIntent.HOMEWORK);
    }

    @Test
    void routesStudentClassQuestionToMyClassesIntent() {
        assertThat(classifier.classify("T\u00f4i \u0111ang h\u1ecdc l\u1edbp n\u00e0o?"))
                .isEqualTo(ChatIntent.MY_CLASSES);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "T\u00f4i \u0111ang d\u1ea1y l\u1edbp n\u00e0o?",
            "T\u00f4i \u0111ang d\u1ea1y bao nhi\u00eau h\u1ecdc vi\u00ean?",
            "L\u1edbp t\u00f4i d\u1ea1y hi\u1ec7n ra sao?"
    })
    void routesTutorClassQuestionsToMyClassesIntent(String message) {
        assertThat(classifier.classify(message))
                .isEqualTo(ChatIntent.MY_CLASSES);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "H\u00f4m nay t\u00f4i d\u1ea1y g\u00ec?",
            "Tu\u1ea7n n\u00e0y t\u00f4i c\u00f3 l\u1ecbch d\u1ea1y n\u00e0o?",
            "C\u00f3 l\u1edbp n\u00e0o s\u1eafp di\u1ec5n ra kh\u00f4ng?"
    })
    void routesTutorScheduleQuestionsToScheduleIntent(String message) {
        assertThat(classifier.classify(message))
                .isEqualTo(ChatIntent.CURRENT_SCHEDULE);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "C\u00f3 y\u00eau c\u1ea7u tham gia l\u1edbp n\u00e0o \u0111ang ch\u1edd kh\u00f4ng?",
            "C\u00f3 h\u1ecdc vi\u00ean xin v\u00e0o l\u1edbp kh\u00f4ng?"
    })
    void routesTutorEnrollmentRequestQuestionsToEnrollmentIntent(String message) {
        assertThat(classifier.classify(message))
                .isEqualTo(ChatIntent.ENROLLMENT_REQUESTS);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "C\u00f3 b\u00e0i n\u00e0o \u0111ang ch\u1edd ch\u1ea5m?",
            "C\u00f3 b\u00e0i n\u00e0o ch\u01b0a ch\u1ea5m?"
    })
    void routesTutorPendingGradingQuestionsToHomeworkIntent(String message) {
        assertThat(classifier.classify(message))
                .isEqualTo(ChatIntent.HOMEWORK);
    }

    @Test
    void keepsEduConnectContractKnowledgeOutOfPrivateContractIntent() {
        assertThat(classifier.classify("H\u1ee3p \u0111\u1ed3ng \u0111i\u1ec7n t\u1eed c\u1ee7a EduConnect ho\u1ea1t \u0111\u1ed9ng th\u1ebf n\u00e0o?"))
                .isEqualTo(ChatIntent.GENERAL_KNOWLEDGE);
    }

    @Test
    void keepsOwnClassCountPrivate() {
        assertThat(classifier.classify("T\u00f4i c\u00f3 bao nhi\u00eau l\u1edbp?"))
                .isEqualTo(ChatIntent.MY_CLASSES);
    }

    @Test
    void routesMutationOutOfReadOnlyTools() {
        assertThat(classifier.classify("Nh\u1eafn tin gia s\u01b0 \u0111\u1ea7u ti\u00ean gi\u00fap t\u00f4i"))
                .isEqualTo(ChatIntent.MUTATION_REQUEST);
    }
}
