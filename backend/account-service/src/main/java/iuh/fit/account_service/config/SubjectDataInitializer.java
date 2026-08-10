package iuh.fit.account_service.config;

import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.SubjectCategory;
import iuh.fit.account_service.repository.SubjectCategoryRepository;
import iuh.fit.account_service.repository.SubjectRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class SubjectDataInitializer implements CommandLineRunner {

    private final SubjectCategoryRepository categoryRepository;
    private final SubjectRepository subjectRepository;

    public SubjectDataInitializer(
            SubjectCategoryRepository categoryRepository,
            SubjectRepository subjectRepository
    ) {
        this.categoryRepository = categoryRepository;
        this.subjectRepository = subjectRepository;
    }

    @Override
    public void run(String... args) {
        if (subjectRepository.count() > 0) {
            return;
        }

        SubjectCategory math = category("Toan hoc");
        SubjectCategory it = category("Cong nghe thong tin");
        SubjectCategory language = category("Ngoai ngu");
        SubjectCategory science = category("Khoa hoc tu nhien");

        subjectRepository.saveAll(List.of(
                subject("Toan lop 12", math),
                subject("Giai tich 1", math),
                subject("Java", it),
                subject("Spring Boot", it),
                subject("Co so du lieu", it),
                subject("Data Structures", it),
                subject("Machine Learning", it),
                subject("IELTS", language),
                subject("English", language),
                subject("Vat ly", science),
                subject("Hoa hoc", science)
        ));
    }

    private SubjectCategory category(String name) {
        return categoryRepository.findByName(name)
                .orElseGet(() -> {
                    SubjectCategory category = new SubjectCategory();
                    category.setName(name);
                    return categoryRepository.save(category);
                });
    }

    private Subject subject(String name, SubjectCategory category) {
        Subject subject = new Subject();
        subject.setName(name);
        subject.setCategory(category);
        subject.setActive(true);
        return subject;
    }
}
