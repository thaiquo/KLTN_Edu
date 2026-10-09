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
