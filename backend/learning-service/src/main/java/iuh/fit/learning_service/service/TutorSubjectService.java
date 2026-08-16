package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.TutorSubjectDtos;
import iuh.fit.learning_service.entity.Subject;
import iuh.fit.learning_service.entity.SubjectCategory;
import iuh.fit.learning_service.entity.SubjectGroup;
import iuh.fit.learning_service.entity.TutorSubject;
import iuh.fit.learning_service.repository.TutorSubjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
public class TutorSubjectService {
    private final TutorSubjectRepository tutorSubjectRepository;

    public TutorSubjectService(TutorSubjectRepository tutorSubjectRepository) {
        this.tutorSubjectRepository = tutorSubjectRepository;
    }

    @Transactional(readOnly = true)
    public List<TutorSubjectDtos.Response> getActiveByProfileIds(List<Long> tutorProfileIds) {
        if (tutorProfileIds == null || tutorProfileIds.isEmpty()) {
            return List.of();
        }
        return tutorSubjectRepository.findByTutorProfileIdInAndActiveTrueOrderByCreatedAtAsc(tutorProfileIds)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TutorSubjectDtos.Response> getActiveByProfileId(Long tutorProfileId) {
        return tutorSubjectRepository.findByTutorProfileIdAndActiveTrueOrderByCreatedAtAsc(tutorProfileId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private TutorSubjectDtos.Response toResponse(TutorSubject tutorSubject) {
        Subject subject = tutorSubject.getSubject();
        SubjectCategory category = subject.getCategory();
        SubjectGroup group = subject.getGroup();
        return new TutorSubjectDtos.Response(
                tutorSubject.getTutorProfileId(),
                subject.getId(),
                subject.getName(),
                category == null ? null : category.getName(),
                group == null ? null : group.getName(),
                Set.copyOf(tutorSubject.getLevels()),
                tutorSubject.getOneToOneHourlyRate(),
                tutorSubject.getExperienceYears(),
                tutorSubject.getDescription()
        );
    }
}
