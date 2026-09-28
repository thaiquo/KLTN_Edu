package iuh.fit.ai_service.client;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;

import java.util.List;

public interface TutorCandidateClient {
    List<TutorCandidate> findCandidates(Long subjectId, Long levelId, TeachingMode teachingMode);
}
