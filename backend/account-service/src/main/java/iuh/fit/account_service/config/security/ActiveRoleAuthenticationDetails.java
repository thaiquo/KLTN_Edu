package iuh.fit.account_service.config.security;

import org.springframework.security.web.authentication.WebAuthenticationDetails;

public record ActiveRoleAuthenticationDetails(String activeRole, WebAuthenticationDetails webDetails) {}
