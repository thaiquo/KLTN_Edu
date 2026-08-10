package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.tutor.SubjectCategoryResponse;
import iuh.fit.account_service.dto.tutor.SubjectResponse;
import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.repository.SubjectRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SubjectService {

    private final SubjectRepository subjectRepository;

    public SubjectService(SubjectRepository subjectRepository) {
        this.subjectRepository = subjectRepository;
    }

    public List<SubjectResponse> getSubjects(Long categoryId, String keyword) {
        List<Subject> subjects;

        if (keyword != null && !keyword.isBlank()) {
            subjects = subjectRepository.findByNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(keyword.trim());
        } else if (categoryId != null) {
            subjects = subjectRepository.findByCategoryIdAndActiveTrueOrderByNameAsc(categoryId);
        } else {
            subjects = subjectRepository.findByActiveTrueOrderByNameAsc();
        }

        return subjects.stream().map(this::toResponse).toList();
    }

    private SubjectResponse toResponse(Subject subject) {
        return new SubjectResponse(
                subject.getId(),
                subject.getName(),
                new SubjectCategoryResponse(
                        subject.getCategory().getId(),
                        subject.getCategory().getName()
                )
        );
    }
}
