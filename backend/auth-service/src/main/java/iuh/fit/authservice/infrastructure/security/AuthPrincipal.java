package iuh.fit.authservice.infrastructure.security;

import iuh.fit.authservice.shared.enums.Role;
import org.springframework.security.core.GrantedAuthority;

import java.io.Serializable;
import java.util.Collection;
import java.util.UUID;

public record AuthPrincipal(UUID id, String email, Role role, long tokenVersion) implements Serializable {

    public Collection<? extends GrantedAuthority> authorities() {
        return role.authorities();
    }
}