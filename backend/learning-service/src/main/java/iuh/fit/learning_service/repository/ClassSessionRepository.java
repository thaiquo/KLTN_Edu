package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ClassSessionRepository extends JpaRepository<ClassSession, Long> {
    List<ClassSession> findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus status);

    List<ClassSession> findByClassRoomIdOrderBySequenceNumberAsc(Long classRoomId);

    long countByClassRoomId(Long classRoomId);

    List<ClassSession> findByClassRoomIdAndStatus(Long classRoomId, ClassSessionStatus status);

    List<ClassSession> findByClassRoomIdInOrderBySessionDateAscStartTimeAsc(Collection<Long> classRoomIds);
}
