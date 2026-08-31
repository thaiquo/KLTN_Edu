package iuh.fit.learning_service.messaging;

import iuh.fit.learning_service.messaging.event.TutorRejectedEvent;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.MessageProperties;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class LearningRabbitConfigTest {

    @Test
    void jsonMessageConverterSerializesTutorRejectedEventWithLocalDateTime() {
        LearningRabbitConfig config = new LearningRabbitConfig();

        var message = config.jsonMessageConverter().toMessage(
                new TutorRejectedEvent(
                        UUID.randomUUID().toString(),
                        10L,
                        20L,
                        "Cần bổ sung giấy tờ định danh rõ hơn.",
                        LocalDateTime.now()
                ),
                new MessageProperties()
        );

        assertThat(message.getBody()).isNotEmpty();
    }
}
