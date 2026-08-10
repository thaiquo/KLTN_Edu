package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.tutor.SubjectSummaryResponse;
import iuh.fit.account_service.dto.tutor.TutorProfileRequest;
import iuh.fit.account_service.dto.tutor.TutorRegistrationProfileRequest;
import iuh.fit.account_service.dto.tutor.TutorResponse;
import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.enums.TutorStatus;
import iuh.fit.account_service.repository.SubjectRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class TutorService {

    private final TutorRepository tutorRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final SubjectRepository subjectRepository;

    public TutorService(
            TutorRepository tutorRepository,
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            SubjectRepository subjectRepository
    ) {
        this.tutorRepository = tutorRepository;
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.subjectRepository = subjectRepository;
    }

    @Transactional
    public TutorResponse createProfile(String email, TutorProfileRequest request) {
        User user = getCurrentTutorUser(email);

        if (tutorRepository.existsByUserId(user.getId())) {
            throw new RuntimeException("Tutor profile already exists");
        }

        Tutor tutor = new Tutor();
        tutor.setUser(user);
        applyProfileData(tutor, request);
        tutor.setStatus(TutorStatus.PENDING);
        tutor.setRejectionReason(null);

        return toResponse(tutorRepository.save(tutor));
    }

    @Transactional
    public TutorResponse createRegistrationProfile(TutorRegistrationProfileRequest request) {
        User user = getCurrentTutorUser(request.getEmail());

        if (!user.isEmailVerified()) {
            throw new RuntimeException("Please verify your email first");
        }

        if (tutorRepository.existsByUserId(user.getId())) {
            throw new RuntimeException("Tutor profile already exists");
        }

        Tutor tutor = new Tutor();
        tutor.setUser(user);
        tutor.setBio(request.getBio());
        tutor.setEducation(request.getEducation());
        tutor.setExperienceYears(request.getExperienceYears());
        tutor.setSubjects(loadSubjects(request.getSubjectIds()));
        tutor.setStatus(TutorStatus.PENDING);
        tutor.setRejectionReason(null);

        return toResponse(tutorRepository.save(tutor));
    }

    @Transactional(readOnly = true)
    public TutorResponse getProfile(String email) {
        User user = getCurrentTutorUser(email);

        Tutor tutor = tutorRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Tutor profile not found"));

        return toResponse(tutor);
    }

    @Transactional
    public TutorResponse updateProfile(String email, TutorProfileRequest request) {
        User user = getCurrentTutorUser(email);

        Tutor tutor = tutorRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Tutor profile not found"));

        applyProfileData(tutor, request);

        if (tutor.getStatus() == TutorStatus.REJECTED) {
            tutor.setStatus(TutorStatus.PENDING);
            tutor.setRejectionReason(null);
        }

        return toResponse(tutorRepository.save(tutor));
    }

    public TutorResponse toResponse(Tutor tutor) {
        List<SubjectSummaryResponse> subjects = tutor.getSubjects().stream()
                .map(subject -> new SubjectSummaryResponse(subject.getId(), subject.getName()))
                .toList();

        User user = tutor.getUser();

        return new TutorResponse(
                tutor.getId(),
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                tutor.getBio(),
                tutor.getEducation(),
                tutor.getExperienceYears(),
                tutor.getStatus(),
                tutor.getRejectionReason(),
                subjects,
                tutor.getCreatedAt(),
                tutor.getUpdatedAt()
        );
    }

    private User getCurrentTutorUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!userRoleRepository.existsByUserIdAndRole(user.getId(), Role.TUTOR)) {
            throw new RuntimeException("Current user is not a tutor");
        }

        return user;
    }

    private void applyProfileData(Tutor tutor, TutorProfileRequest request) {
        tutor.setBio(request.getBio());
        tutor.setEducation(request.getEducation());
        tutor.setExperienceYears(request.getExperienceYears());
        tutor.setSubjects(loadSubjects(request.getSubjectIds()));
    }

    private Set<Subject> loadSubjects(List<Long> subjectIds) {
        List<Subject> subjects = subjectRepository.findAllById(subjectIds);

        if (subjects.size() != new LinkedHashSet<>(subjectIds).size()) {
            throw new RuntimeException("One or more subjects are invalid");
        }

        if (subjects.stream().anyMatch(subject -> !subject.isActive())) {
            throw new RuntimeException("One or more subjects are inactive");
        }

        return new LinkedHashSet<>(subjects);
    }
}
