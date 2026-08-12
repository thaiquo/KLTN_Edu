package iuh.fit.account_service.infrastructure.security;

import iuh.fit.account_service.infrastructure.config.LoginSecurityProperties;
import iuh.fit.account_service.shared.exception.UnauthorizedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoginRateLimitServiceTest {

    @Mock
    StringRedisTemplate redisTemplate;

    @Mock
    ValueOperations<String, String> valueOperations;

    LoginRateLimitService service;

    @BeforeEach
    void setUp() {
        LoginSecurityProperties properties = new LoginSecurityProperties();
        properties.setMaxAttempts(3);
        properties.setWindowMinutes(10);
        properties.setBlockMinutes(15);
        service = new LoginRateLimitService(redisTemplate, properties);
    }

    @Test
    void ensureAllowed_shouldThrow_whenKeyIsBlocked() {
        when(redisTemplate.hasKey("auth:login:block:user@example.com:127.0.0.1")).thenReturn(true);

        assertThatThrownBy(() -> service.ensureAllowed("user@example.com", "127.0.0.1"))
            .isInstanceOf(UnauthorizedException.class)
            .hasMessageContaining("Too many login attempts");
    }

    @Test
    void registerFailure_shouldCreateBlockAfterThreshold() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment("auth:login:attempts:user@example.com:127.0.0.1")).thenReturn(3L);

        service.registerFailure("user@example.com", "127.0.0.1");

        verify(valueOperations).increment("auth:login:attempts:user@example.com:127.0.0.1");
        verify(redisTemplate).delete("auth:login:attempts:user@example.com:127.0.0.1");
        verify(valueOperations).set(eq("auth:login:block:user@example.com:127.0.0.1"), eq("1"), eq(Duration.ofMinutes(15)));
    }
}