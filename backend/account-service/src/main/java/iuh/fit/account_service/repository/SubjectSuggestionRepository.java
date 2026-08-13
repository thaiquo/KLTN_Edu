package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.SubjectSuggestion;
import iuh.fit.account_service.enums.SubjectSuggestionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubjectSuggestionRepository extends JpaRepository<SubjectSuggestion, Long> {

    List<SubjectSuggestion> findBySuggestedBy_IdOrderByCreatedAtDesc(Long userId);

    List<SubjectSuggestion> findByStatusOrderByCreatedAtAsc(SubjectSuggestionStatus status);
}
