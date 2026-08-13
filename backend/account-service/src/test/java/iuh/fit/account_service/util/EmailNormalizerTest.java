package iuh.fit.account_service.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EmailNormalizerTest {

    @Test
    void normalizesEmailByTrimmingAndLowercasing() {
        assertThat(EmailNormalizer.normalize("  USER.Name+Tag@Example.COM  "))
                .isEqualTo("user.name+tag@example.com");
    }

    @Test
    void keepsNullEmailAsNull() {
        assertThat(EmailNormalizer.normalize(null)).isNull();
    }
}
