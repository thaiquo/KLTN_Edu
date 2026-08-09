package iuh.fit.authservice.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "auth.outbox")
public class OutboxRelayProperties {

    private String exchange = "auth.outbox.exchange";
    private String queue = "auth.outbox.queue";
    private long relayFixedDelayMs = 5000;

    public String getExchange() {
        return exchange;
    }

    public void setExchange(String exchange) {
        this.exchange = exchange;
    }

    public String getQueue() {
        return queue;
    }

    public void setQueue(String queue) {
        this.queue = queue;
    }

    public long getRelayFixedDelayMs() {
        return relayFixedDelayMs;
    }

    public void setRelayFixedDelayMs(long relayFixedDelayMs) {
        this.relayFixedDelayMs = relayFixedDelayMs;
    }
}