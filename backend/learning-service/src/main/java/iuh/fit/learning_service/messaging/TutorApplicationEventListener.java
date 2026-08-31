package iuh.fit.learning_service.messaging;

import iuh.fit.learning_service.entity.ProcessedEvent;
import iuh.fit.learning_service.entity.Subject;
import iuh.fit.learning_service.entity.TutorAuthorizationState;
import iuh.fit.learning_service.entity.TutorSubject;
import iuh.fit.learning_service.messaging.event.TutorApprovedEvent;
import iuh.fit.learning_service.messaging.event.TutorRejectedEvent;
import iuh.fit.learning_service.repository.ProcessedEventRepository;
import iuh.fit.learning_service.repository.SubjectRepository;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import iuh.fit.learning_service.repository.TutorSubjectRepository;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class TutorApplicationEventListener {
    private final ProcessedEventRepository processedEventRepository;
    private final SubjectRepository subjectRepository;
    private final TutorAuthorizationStateRepository tutorAuthorizationStateRepository;
    private final TutorSubjectRepository tutorSubjectRepository;

    public TutorApplicationEventListener(
            ProcessedEventRepository processedEventRepository,
            SubjectRepository subjectRepository,
            TutorAuthorizationStateRepository tutorAuthorizationStateRepository,
            TutorSubjectRepository tutorSubjectRepository
    ) {
        this.processedEventRepository = processedEventRepository;
        this.subjectRepository = subjectRepository;
        this.tutorAuthorizationStateRepository = tutorAuthorizationStateRepository;
        this.tutorSubjectRepository = tutorSubjectRepository;
    }

    @Transactional
    @RabbitListener(queues = LearningRabbitConfig.TUTOR_APPROVED_QUEUE)
    public void onTutorApproved(TutorApprovedEvent event) {
        if (event == null || event.eventId() == null || processedEventRepository.existsById(event.eventId())) {
            return;
        }

        Set<Long> approvedSubjectIds = event.subjects() == null ? Set.of() : event.subjects().stream()
                .map(TutorApprovedEvent.SubjectItem::subjectId)
                .collect(Collectors.toSet());

        for (TutorApprovedEvent.SubjectItem item : event.subjects() == null ? Set.<TutorApprovedEvent.SubjectItem>of() : event.subjects()) {
            Subject subject = subjectRepository.findByIdAndActiveTrue(item.subjectId())
                    .orElseThrow(() -> new IllegalStateException("Subject not found: " + item.subjectId()));
            TutorSubject tutorSubject = tutorSubjectRepository
                    .findByTutorProfileIdAndSubjectId(event.tutorProfileId(), item.subjectId())
                    .orElseGet(TutorSubject::new);
            tutorSubject.setTutorProfileId(event.tutorProfileId());
            tutorSubject.setUserId(event.userId());
            tutorSubject.setSubject(subject);
            tutorSubject.setLevels(new LinkedHashSet<>(item.levels()));
            tutorSubject.setOneToOneHourlyRate(item.oneToOneHourlyRate());
            tutorSubject.setExperienceYears(item.experienceYears());
            tutorSubject.setDescription(item.description());
            tutorSubject.setActive(true);
            tutorSubject.setSourceEventId(event.eventId());
            tutorSubjectRepository.save(tutorSubject);
        }

        for (TutorSubject existing : tutorSubjectRepository.findByTutorProfileIdOrderByCreatedAtAsc(event.tutorProfileId())) {
            if (!approvedSubjectIds.contains(existing.getSubject().getId())) {
                existing.setActive(false);
                tutorSubjectRepository.save(existing);
            }
        }
        upsertTutorAuthorization(event.userId(), event.tutorProfileId(), "APPROVED", event.eventId());
        markProcessed(event.eventId(), TutorApprovedEvent.class.getSimpleName());
    }

    @Transactional
    @RabbitListener(queues = LearningRabbitConfig.TUTOR_REJECTED_QUEUE)
    public void onTutorRejected(TutorRejectedEvent event) {
        if (event == null || event.eventId() == null || processedEventRepository.existsById(event.eventId())) {
            return;
        }
        upsertTutorAuthorization(event.userId(), null, "REJECTED", event.eventId());
        for (TutorSubject subject : tutorSubjectRepository.findByUserIdAndActiveTrueOrderByCreatedAtAsc(event.userId())) {
            subject.setActive(false);
            tutorSubjectRepository.save(subject);
        }
        markProcessed(event.eventId(), TutorRejectedEvent.class.getSimpleName());
    }

    private void upsertTutorAuthorization(Long userId, Long tutorProfileId, String status, String eventId) {
        if (userId == null) {
            return;
        }
        TutorAuthorizationState state = tutorAuthorizationStateRepository.findById(userId)
                .orElseGet(() -> {
                    TutorAuthorizationState created = new TutorAuthorizationState();
                    created.setUserId(userId);
                    return created;
                });
        state.setStatus(status);
        if (tutorProfileId != null) {
            state.setTutorProfileId(tutorProfileId);
        }
        state.setSourceEventId(eventId);
        tutorAuthorizationStateRepository.save(state);
    }

    private void markProcessed(String eventId, String eventType) {
        ProcessedEvent processedEvent = new ProcessedEvent();
        processedEvent.setEventId(eventId);
        processedEvent.setEventType(eventType);
        processedEventRepository.save(processedEvent);
    }
}
