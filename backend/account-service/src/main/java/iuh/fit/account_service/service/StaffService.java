package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.tutor.TutorResponse;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorStatus;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class StaffService {

    private final TutorRepository tutorRepository;
    private final TutorApplicationRepository tutorApplicationRepository;
    private final TutorService tutorService;

    public StaffService(
            TutorRepository tutorRepository,
            TutorApplicationRepository tutorApplicationRepository,
            TutorService tutorService
    ) {
        this.tutorRepository = tutorRepository;
        this.tutorApplicationRepository = tutorApplicationRepository;
        this.tutorService = tutorService;
    }

    @Transactional(readOnly = true)
    public List<TutorResponse> getPendingTutors() {
        return tutorApplicationRepository.findByStatus(TutorApplicationStatus.PENDING)
                .stream()
                .map(TutorApplication::getUser)
                .map(user -> tutorRepository.findByUserId(user.getId())
                        .orElseThrow(() -> new RuntimeException("Tutor profile not found")))
                .map(tutorService::toResponse)
                .toList();
    }

    @Transactional
    public TutorResponse approveTutor(Long tutorId) {
        Tutor tutor = getTutor(tutorId);
        TutorApplication application = getSubmittedApplication(tutor);
        tutor.setStatus(TutorStatus.APPROVED);
        tutor.setRejectionReason(null);
        application.setStatus(TutorApplicationStatus.APPROVED);
        application.setReviewedAt(LocalDateTime.now());
        application.setRejectionReason(null);
        application.setReviewNote(null);
        tutorApplicationRepository.save(application);

        return tutorService.toResponse(tutorRepository.save(tutor));
    }

    @Transactional
    public TutorResponse rejectTutor(Long tutorId, String reason) {
        Tutor tutor = getTutor(tutorId);
        TutorApplication application = getSubmittedApplication(tutor);
        tutor.setStatus(TutorStatus.REJECTED);
        tutor.setRejectionReason(reason);
        application.setStatus(TutorApplicationStatus.REJECTED);
        application.setReviewedAt(LocalDateTime.now());
        application.setRejectionReason(reason);
        tutorApplicationRepository.save(application);

        return tutorService.toResponse(tutorRepository.save(tutor));
    }

    private Tutor getTutor(Long tutorId) {
        return tutorRepository.findById(tutorId)
                .orElseThrow(() -> new RuntimeException("Tutor profile not found"));
    }

    private TutorApplication getSubmittedApplication(Tutor tutor) {
        return tutorApplicationRepository.findByUserId(tutor.getUser().getId())
                .filter(application -> application.getStatus() == TutorApplicationStatus.PENDING)
                .orElseThrow(() -> new ConflictException("Tutor application has not been submitted for review"));
    }
}
