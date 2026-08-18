package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.CatalogSubjectSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CatalogSubjectSuggestionRepository extends JpaRepository<CatalogSubjectSuggestion, Long> {
    List<CatalogSubjectSuggestion> findByRequestedByEmailIgnoreCaseOrderByCreatedAtDesc(String email);
    List<CatalogSubjectSuggestion> findByStatusOrderByCreatedAtAsc(String status);
}
