package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.ClassChapter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassChapterRepository extends JpaRepository<ClassChapter, Long> {
    List<ClassChapter> findByClassRoomIdOrderByOrderIndexAscIdAsc(Long classRoomId);
    void deleteByClassRoomId(Long classRoomId);
}
