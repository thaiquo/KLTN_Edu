package iuh.fit.learningservice.modules.classroom.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "tutor_application_subjects", schema = "account")
@Getter
@Setter
@NoArgsConstructor
public class AccountTeachingSubject {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "tutor_application_id", nullable = false)
    private AccountTutorApplication tutorApplication;

    @Column(name = "level_group", nullable = false)
    private String levelGroup;

    @Column(name = "subject_name", nullable = false)
    private String subjectName;

    @Column(name = "teaching_level", nullable = false)
    private String teachingLevel;
}
