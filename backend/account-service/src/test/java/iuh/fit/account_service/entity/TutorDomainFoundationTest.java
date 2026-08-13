package iuh.fit.account_service.entity;

import iuh.fit.account_service.enums.TeachingLevel;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class TutorDomainFoundationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void tutorApplicationDefaultsToDraftAndOwnsApplicationSubjects() {
        TutorApplication application = new TutorApplication();
        TutorApplicationSubject applicationSubject = new TutorApplicationSubject();

        applicationSubject.setTutorApplication(application);
        application.getSubjects().add(applicationSubject);

        assertThat(application.getStatus()).isEqualTo(TutorApplicationStatus.DRAFT);
        assertThat(application.getSubjects()).containsExactly(applicationSubject);
        assertThat(applicationSubject.getTutorApplication()).isSameAs(application);
    }

    @Test
    void tutorProfileOwnsOfficialTutorSubjects() {
        TutorProfile profile = new TutorProfile();
        TutorSubject tutorSubject = new TutorSubject();

        tutorSubject.setTutorProfile(profile);
        profile.getSubjects().add(tutorSubject);

        assertThat(profile.isActive()).isTrue();
        assertThat(tutorSubject.isActive()).isTrue();
        assertThat(profile.getSubjects()).containsExactly(tutorSubject);
        assertThat(tutorSubject.getTutorProfile()).isSameAs(profile);
    }

    @Test
    void applicationSubjectRejectsInvalidMoneyExperienceAndLongDescription() {
        TutorApplicationSubject subject = new TutorApplicationSubject();
        subject.setOneToOneHourlyRate(BigDecimal.ZERO);
        subject.setExperienceYears(-1);
        subject.setDescription("x".repeat(1001));

        assertThat(validator.validate(subject))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains(
                        "oneToOneHourlyRate",
                        "experienceYears",
                        "description"
                );
    }

    @Test
    void tutorSubjectUsesBigDecimalForOneToOneHourlyRate() {
        TutorSubject subject = new TutorSubject();
        subject.setOneToOneHourlyRate(new BigDecimal("180000.00"));
        subject.setExperienceYears(2);
        subject.setDescription("Java Core and Spring Boot mentoring.");

        assertThat(validator.validate(subject)).isEmpty();
        assertThat(subject.getOneToOneHourlyRate()).isEqualByComparingTo("180000.00");
    }

    @Test
    void subjectAndTutorSubjectLevelsAreEnumSets() {
        Subject subject = new Subject();
        subject.setSupportedLevels(Set.of(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT));

        TutorApplicationSubject applicationSubject = new TutorApplicationSubject();
        applicationSubject.setLevels(Set.of(TeachingLevel.UNIVERSITY));

        TutorSubject tutorSubject = new TutorSubject();
        tutorSubject.setLevels(Set.of(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT));

        assertThat(subject.getSupportedLevels()).containsExactlyInAnyOrder(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT);
        assertThat(applicationSubject.getLevels()).containsExactly(TeachingLevel.UNIVERSITY);
        assertThat(tutorSubject.getLevels()).containsExactlyInAnyOrder(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT);
    }
}
