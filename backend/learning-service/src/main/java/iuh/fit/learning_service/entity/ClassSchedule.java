package iuh.fit.learning_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "class_schedules")
public class ClassSchedule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_room_id", nullable = false)
    private ClassRoom classRoom;

    @Column(nullable = false)
    private Integer dayOfWeek; // 2 -> Thứ 2, ..., 8 -> Chủ nhật

    @Column(nullable = false, length = 5)
    private String startTime; // "HH:mm"

    @Column(nullable = false, length = 5)
    private String endTime; // "HH:mm"
}
