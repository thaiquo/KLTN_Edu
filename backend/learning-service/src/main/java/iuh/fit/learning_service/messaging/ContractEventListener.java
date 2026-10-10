package iuh.fit.learning_service.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.learning_service.service.EnrollmentRequestService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class ContractEventListener {
    private static final Logger log = LoggerFactory.getLogger(ContractEventListener.class);

    private final EnrollmentRequestService enrollmentRequestService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ContractEventListener(EnrollmentRequestService enrollmentRequestService) {
        this.enrollmentRequestService = enrollmentRequestService;
    }

    @RabbitListener(queues = LearningRabbitConfig.CONTRACT_ACTIVATED_QUEUE)
    public void onContractActivated(Object message) {
        try {
            Map<?, ?> map = parsePayload(message);
            Long classroomId = parseLong(map.get("classroomId"));
            Long studentId = parseLong(map.get("studentId"));
            String agreementId = map.get("agreementId") != null ? map.get("agreementId").toString() : null;

            log.info("Received contract.activated.v1 event for classroomId: {}, studentId: {}, agreementId: {}",
                    classroomId, studentId, agreementId);

            enrollmentRequestService.activateEnrollment(classroomId, studentId, agreementId);
        } catch (Exception e) {
            log.error("Failed to process contract.activated.v1 event: {}", e.getMessage(), e);
            // Do not acknowledge a confirmed funding event when Learning has not
            // persisted ENROLLED yet. RabbitMQ must redeliver it after a transient
            // database/service failure instead of silently stranding the student.
            throw new IllegalStateException("Could not activate enrollment from contract event", e);
        }
    }

    @RabbitListener(queues = LearningRabbitConfig.CONTRACT_EXPIRED_QUEUE)
    public void onContractExpired(Object message) {
        try {
            Map<?, ?> map = parsePayload(message);
            Long classroomId = parseLong(map.get("classroomId"));
            Long studentId = parseLong(map.get("studentId"));
            String agreementId = map.get("agreementId") != null ? map.get("agreementId").toString() : null;

            log.info("Received contract.expired.v1 event for classroomId: {}, studentId: {}, agreementId: {}",
                    classroomId, studentId, agreementId);

            enrollmentRequestService.expireEnrollment(classroomId, studentId, agreementId);
        } catch (Exception e) {
            log.error("Failed to process contract.expired.v1 event: {}", e.getMessage(), e);
            throw new IllegalStateException("Could not expire enrollment from contract event", e);
        }
    }

    private Map<?, ?> parsePayload(Object message) throws Exception {
        if (message instanceof Map) {
            return (Map<?, ?>) message;
        }
        if (message instanceof org.springframework.amqp.core.Message amqpMessage) {
            return objectMapper.readValue(amqpMessage.getBody(), Map.class);
        }
        if (message instanceof String str) {
            return objectMapper.readValue(str, Map.class);
        }
        if (message instanceof byte[] bytes) {
            return objectMapper.readValue(bytes, Map.class);
        }
        return objectMapper.convertValue(message, Map.class);
    }

    private Long parseLong(Object val) {
        if (val == null) return null;
        if (val instanceof Number num) return num.longValue();
        try {
            return Long.parseLong(val.toString());
        } catch (Exception ignored) {
            return null;
        }
    }
}
