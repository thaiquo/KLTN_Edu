package iuh.fit.ai_service.client;

import iuh.fit.ai_service.chatbot.service.private_tools.CallerAuthForwarder;
import iuh.fit.ai_service.dto.LearningCopilotDtos.LessonContextResponse;
import iuh.fit.ai_service.dto.LearningCopilotDtos.HomeworkFeedbackContextResponse;
import iuh.fit.ai_service.exception.LearningCopilotException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.URI;

@Component
public class LearningCopilotContextClient {
    private static final ParameterizedTypeReference<LessonContextResponse> LESSON_CONTEXT =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<HomeworkFeedbackContextResponse> HOMEWORK_FEEDBACK_CONTEXT =
            new ParameterizedTypeReference<>() {};

    private final RestClient restClient;
    private final String learningServiceUrl;
    private final CallerAuthForwarder authForwarder;

    public LearningCopilotContextClient(
            RestClient.Builder restClientBuilder,
            @Value("${learning.service.url:http://localhost:8082}") String learningServiceUrl,
            CallerAuthForwarder authForwarder
    ) {
        this.restClient = restClientBuilder.build();
        this.learningServiceUrl = stripTrailingSlash(learningServiceUrl);
        this.authForwarder = authForwarder;
    }

    public LessonContextResponse lessonContext(Long classId, Long sessionId) {
        String path = "/api/internal/ai/classes/" + classId + "/sessions/" + sessionId + "/lesson-context";
        try {
            return restClient.get()
                    .uri(URI.create(learningServiceUrl + path))
                    .headers(authForwarder::apply)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        int status = response.getStatusCode().value();
                        if (status == 401) {
                            throw new LearningCopilotException(
                                    LearningCopilotException.Reason.UNAUTHORIZED,
                                    "Learning authentication expired"
                            );
                        }
                        if (status == 403) {
                            throw new LearningCopilotException(
                                    LearningCopilotException.Reason.FORBIDDEN,
                                    "Tutor is not allowed to use this class session"
                            );
                        }
                        throw new LearningCopilotException(
                                LearningCopilotException.Reason.BAD_REQUEST,
                                "Learning context request was rejected"
                        );
                    })
                    .body(LESSON_CONTEXT);
        } catch (LearningCopilotException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new LearningCopilotException(
                    LearningCopilotException.Reason.DOWNSTREAM_UNAVAILABLE,
                    "Learning service is temporarily unavailable"
            );
        }
    }

    public HomeworkFeedbackContextResponse homeworkFeedbackContext(Long classId, Long sessionId, Long attendanceId) {
        String path = "/api/internal/ai/classes/" + classId + "/sessions/" + sessionId
                + "/attendances/" + attendanceId + "/homework-feedback-context";
        try {
            return restClient.get()
                    .uri(URI.create(learningServiceUrl + path))
                    .headers(authForwarder::apply)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        int status = response.getStatusCode().value();
                        if (status == 401) {
                            throw new LearningCopilotException(LearningCopilotException.Reason.UNAUTHORIZED,
                                    "Learning authentication expired");
                        }
                        if (status == 403) {
                            throw new LearningCopilotException(LearningCopilotException.Reason.FORBIDDEN,
                                    "Tutor is not allowed to grade this homework");
                        }
                        throw new LearningCopilotException(LearningCopilotException.Reason.BAD_REQUEST,
                                "Homework feedback context request was rejected");
                    })
                    .body(HOMEWORK_FEEDBACK_CONTEXT);
        } catch (LearningCopilotException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new LearningCopilotException(LearningCopilotException.Reason.DOWNSTREAM_UNAVAILABLE,
                    "Learning service is temporarily unavailable");
        }
    }

    private String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:8082";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
