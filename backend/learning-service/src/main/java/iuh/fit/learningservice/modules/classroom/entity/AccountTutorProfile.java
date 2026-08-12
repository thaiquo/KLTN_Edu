package iuh.fit.learningservice.modules.classroom.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "tutor_profiles", schema = "account")
@Getter
@Setter
@NoArgsConstructor
public class AccountTutorProfile {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @Column(name = "verification_status", nullable = false)
    private String verificationStatus;
}
