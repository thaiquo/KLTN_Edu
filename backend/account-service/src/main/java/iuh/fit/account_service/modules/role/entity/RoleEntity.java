package iuh.fit.account_service.modules.role.entity;

import iuh.fit.account_service.shared.enums.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "roles")
public class RoleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, unique = true, length = 32)
    private Role name;

    protected RoleEntity() {
    }

    public RoleEntity(Role name) {
        this.name = name;
    }

    public Long getId() {
        return id;
    }

    public Role getName() {
        return name;
    }
}
