package iuh.fit.account_service.messaging;

import iuh.fit.account_service.messaging.event.TutorApplicationSubmittedEvent;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.MessageProperties;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AccountRabbitConfigTest {

    @Test
    void jsonMessageConverterSerializesTutorApplicationSubmittedEventWithLocalDateTime() {
        AccountRabbitConfig config = new AccountRabbitConfig();

        var message = config.jsonMessageConverter().toMessage(
                new TutorApplicationSubmittedEvent(
                        UUID.randomUUID().toString(),
                        10L,
                        20L,
                        LocalDateTime.now()
                ),
                new MessageProperties()
        );

        assertThat(message.getBody()).isNotEmpty();
    }
}
