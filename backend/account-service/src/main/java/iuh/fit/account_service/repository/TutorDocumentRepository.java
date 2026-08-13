package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.TutorDocument;
import iuh.fit.account_service.enums.TutorDocumentType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TutorDocumentRepository extends JpaRepository<TutorDocument, Long> {

    List<TutorDocument> findByTutorApplication_IdOrderByUploadedAtDesc(Long tutorApplicationId);

    Optional<TutorDocument> findByIdAndTutorApplication_Id(Long id, Long tutorApplicationId);

    long countByTutorApplication_IdAndDocumentType(Long tutorApplicationId, TutorDocumentType documentType);

    long countByTutorApplication_Id(Long tutorApplicationId);
}
