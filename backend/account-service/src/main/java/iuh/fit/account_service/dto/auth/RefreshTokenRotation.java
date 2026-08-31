package iuh.fit.account_service.dto.auth;

import iuh.fit.account_service.entity.RefreshSession;

public class RefreshTokenRotation {

    private final RefreshSession refreshSession;
    private final String rawRefreshToken;

    public RefreshTokenRotation(RefreshSession refreshSession, String rawRefreshToken) {
        this.refreshSession = refreshSession;
        this.rawRefreshToken = rawRefreshToken;
    }

    public RefreshSession getRefreshSession() {
        return refreshSession;
    }

    public String getRawRefreshToken() {
        return rawRefreshToken;
    }
}
