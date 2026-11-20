package iuh.fit.account_service.service;

import java.util.function.Supplier;

public interface LoginProtection {
    <T> T execute(String normalizedEmail, String turnstileToken, String remoteIp, Supplier<T> authentication);

    default <T> T executeMobile(String normalizedEmail, String remoteIp, Supplier<T> authentication) {
        return execute(normalizedEmail, null, remoteIp, authentication);
    }

    static LoginProtection disabled() {
        return new LoginProtection() {
            @Override
            public <T> T execute(String normalizedEmail, String turnstileToken, String remoteIp,
                                 Supplier<T> authentication) {
                return authentication.get();
            }
        };
    }
}
