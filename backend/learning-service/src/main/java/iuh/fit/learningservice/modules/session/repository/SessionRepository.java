package iuh.fit.learningservice.modules.session.repository;

import iuh.fit.learningservice.modules.session.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {
    List<Session> findByClassRoomIdOrderByDateAscStartTimeAsc(UUID classRoomId);
}
