package iuh.fit.learning_service.entity;

import iuh.fit.learning_service.enums.LevelType;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.Getter;
import lombok.Setter;

@Embeddable
@Getter
@Setter
public class ProposedRegistrationLevel {
    @Column(name = "level_code", length = 80)
    private String code;

    @Column(name = "level_name", nullable = false, length = 160)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "level_type", nullable = false, length = 40)
    private LevelType type;
}
