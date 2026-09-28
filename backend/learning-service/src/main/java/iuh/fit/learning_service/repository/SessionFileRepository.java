package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.SessionFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionFileRepository extends JpaRepository<SessionFile, Long> {

    List<SessionFile> findBySession_IdOrderByFileOrderAscCreatedAtAsc(Long sessionId);

    List<SessionFile> findBySession_IdAndFileCategoryOrderByFileOrderAscCreatedAtAsc(Long sessionId, String fileCategory);

    long countBySession_IdAndFileCategory(Long sessionId, String fileCategory);
}
