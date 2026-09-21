package iuh.fit.learning_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity @Table(name = "learning_termination_stop")
@Getter @Setter
public class LearningTerminationStop {
    @Id @Column(length = 36) private String agreementId;
    private Long classroomId;
    private Long studentId;
    private Integer cutoffSession;
    private boolean closed;
}
