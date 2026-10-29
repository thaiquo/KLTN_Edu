package iuh.fit.contract_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "tutor_absence_probation")
@Getter @Setter
public class TutorAbsenceProbation {
    @Id
    private UUID id;

    @Column(nullable = false)
    private Long classroomId;

    @Column(nullable = false, unique = true)
    private UUID sourceCaseId;

    @Column(nullable = false)
    private Integer sessionSequence;

    @Column(nullable = false)
    private OffsetDateTime sessionStartAt;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "active_classroom_guard", unique = true)
    private Long activeClassroomGuard;

    private UUID failureCaseId;

    private OffsetDateTime resolvedAt;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @Version
    private Long version = 0L;
}
