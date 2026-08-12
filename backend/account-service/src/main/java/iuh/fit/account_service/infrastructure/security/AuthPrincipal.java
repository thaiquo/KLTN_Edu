package iuh.fit.account_service.infrastructure.security;

import iuh.fit.account_service.shared.enums.Role;
import org.springframework.security.core.GrantedAuthority;

import java.io.Serializable;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;

public record AuthPrincipal(UUID id, String email, Set<Role> roles, long tokenVersion) implements Serializable {

    public Collection<? extends GrantedAuthority> authorities() {
        return roles.stream().flatMap(role -> role.authorities().stream()).toList();
    }
}
