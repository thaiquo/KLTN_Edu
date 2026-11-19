package iuh.fit.account_service.service;

public interface TurnstileVerifier {
    VerificationResult verify(String token, String remoteIp);

    enum VerificationResult { VALID, INVALID, UNAVAILABLE }
}
