package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.tutor.TutorResponse;
import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.enums.TutorStatus;
import iuh.fit.account_service.repository.TutorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class StaffService {

    private final TutorRepository tutorRepository;
    private final TutorService tutorService;

    public StaffService(TutorRepository tutorRepository, TutorService tutorService) {
        this.tutorRepository = tutorRepository;
        this.tutorService = tutorService;
    }

    @Transactional(readOnly = true)
    public List<TutorResponse> getPendingTutors() {
        return tutorRepository.findByStatus(TutorStatus.PENDING).stream()
                .map(tutorService::toResponse)
                .toList();
    }

    @Transactional
    public TutorResponse approveTutor(Long tutorId) {
        Tutor tutor = getTutor(tutorId);
        tutor.setStatus(TutorStatus.APPROVED);
        tutor.setRejectionReason(null);

        return tutorService.toResponse(tutorRepository.save(tutor));
    }

    @Transactional
    public TutorResponse rejectTutor(Long tutorId, String reason) {
        Tutor tutor = getTutor(tutorId);
        tutor.setStatus(TutorStatus.REJECTED);
        tutor.setRejectionReason(reason);

        return tutorService.toResponse(tutorRepository.save(tutor));
    }

    private Tutor getTutor(Long tutorId) {
        return tutorRepository.findById(tutorId)
                .orElseThrow(() -> new RuntimeException("Tutor profile not found"));
    }
}
