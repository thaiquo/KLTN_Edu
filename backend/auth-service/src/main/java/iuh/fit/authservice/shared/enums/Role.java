package iuh.fit.authservice.shared.enums;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

public enum Role {
    GUEST,
    STUDENT,
    TUTOR,
    STAFF,
    ADMIN;

    public List<GrantedAuthority> authorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + name()));
    }
}