package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.TutorSubjectDtos;
import iuh.fit.learning_service.entity.Subject;
import iuh.fit.learning_service.entity.SubjectCategory;
import iuh.fit.learning_service.entity.SubjectGroup;
import iuh.fit.learning_service.entity.TutorSubject;
import iuh.fit.learning_service.entity.TutorSubjectRegistration;
import iuh.fit.learning_service.enums.TeachingLevel;
import iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus;
import iuh.fit.learning_service.repository.TutorSubjectRegistrationRepository;
import iuh.fit.learning_service.repository.TutorSubjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class TutorSubjectService {
    private final TutorSubjectRepository tutorSubjectRepository;
    private final TutorSubjectRegistrationRepository registrationRepository;

    public TutorSubjectService(
            TutorSubjectRepository tutorSubjectRepository,
            TutorSubjectRegistrationRepository registrationRepository
    ) {
        this.tutorSubjectRepository = tutorSubjectRepository;
        this.registrationRepository = registrationRepository;
    }

    @Transactional(readOnly = true)
    public List<TutorSubjectDtos.Response> getActiveByProfileIds(List<Long> tutorProfileIds) {
        if (tutorProfileIds == null || tutorProfileIds.isEmpty()) {
            return List.of();
        }
        Map<String, TutorSubjectDtos.Response> subjects = new LinkedHashMap<>();
        tutorSubjectRepository.findByTutorProfileIdInAndActiveTrueOrderByCreatedAtAsc(tutorProfileIds)
                .stream().map(this::toResponse)
                .forEach(response -> subjects.put(subjectKey(response), response));
        registrationRepository.findByTutorProfileIdInAndStatusOrderByCreatedAtAsc(
                        tutorProfileIds,
                        TutorSubjectRegistrationStatus.APPROVED
                ).stream().map(this::toResponse)
                .forEach(response -> subjects.putIfAbsent(subjectKey(response), response));
        return List.copyOf(subjects.values());
    }

    @Transactional(readOnly = true)
    public List<TutorSubjectDtos.Response> getActiveByProfileId(Long tutorProfileId) {
        Map<String, TutorSubjectDtos.Response> subjects = new LinkedHashMap<>();
        tutorSubjectRepository.findByTutorProfileIdAndActiveTrueOrderByCreatedAtAsc(tutorProfileId)
                .stream().map(this::toResponse)
                .forEach(response -> subjects.put(subjectKey(response), response));
        registrationRepository.findByTutorProfileIdAndStatusOrderByCreatedAtAsc(
                        tutorProfileId,
                        TutorSubjectRegistrationStatus.APPROVED
                ).stream().map(this::toResponse)
                .forEach(response -> subjects.putIfAbsent(subjectKey(response), response));
        return List.copyOf(subjects.values());
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

    private TutorSubjectDtos.Response toResponse(TutorSubjectRegistration registration) {
        Set<TeachingLevel> levels = Set.of();
        if (registration.getEducationLevel() != null) {
            try {
                levels = Set.of(TeachingLevel.valueOf(registration.getEducationLevel().getCode()));
            } catch (IllegalArgumentException ignored) {
                // Detailed catalog levels remain available on the published classes.
            }
        }

        return new TutorSubjectDtos.Response(
                registration.getTutorProfileId(),
                registration.getSubject() == null ? null : registration.getSubject().getId(),
                registration.getSubject() == null ? registration.getProposedSubjectName() : registration.getSubject().getName(),
                registration.getCategory() == null ? null : registration.getCategory().getName(),
                null,
                levels,
                registration.getTuitionMin(),
                registration.getExperienceYears(),
                registration.getDescription()
        );
    }

    private String subjectKey(TutorSubjectDtos.Response response) {
        return response.tutorProfileId() + ":" + response.subjectId() + ":" + response.subjectName();
    }
}
