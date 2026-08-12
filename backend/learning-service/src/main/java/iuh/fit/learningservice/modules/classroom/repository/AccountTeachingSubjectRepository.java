package iuh.fit.learningservice.modules.classroom.repository;

import iuh.fit.learningservice.modules.classroom.entity.AccountTeachingSubject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AccountTeachingSubjectRepository extends JpaRepository<AccountTeachingSubject, UUID> {

    @Query("SELECT s FROM AccountTeachingSubject s WHERE s.tutorApplication.userId = :tutorId AND s.tutorApplication.status = 'APPROVED'")
    List<AccountTeachingSubject> findAllApprovedByTutorId(@Param("tutorId") UUID tutorId);
}
