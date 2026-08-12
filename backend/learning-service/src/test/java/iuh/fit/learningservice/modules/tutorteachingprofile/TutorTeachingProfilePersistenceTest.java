package iuh.fit.learningservice.modules.tutorteachingprofile;

import iuh.fit.learningservice.modules.tutorteachingprofile.entity.TeachingMode;
import iuh.fit.learningservice.modules.tutorteachingprofile.entity.TeachingProfileStatus;
import iuh.fit.learningservice.modules.tutorteachingprofile.entity.TutorTeachingProfile;
import iuh.fit.learningservice.modules.tutorteachingprofile.repository.TutorTeachingProfileRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class TutorTeachingProfilePersistenceTest {

    @Autowired
    private TutorTeachingProfileRepository repository;

    @Test
    void storesTeachingDataOutsideAccountProfile() {
        UUID tutorId = UUID.randomUUID();
        TutorTeachingProfile profile = repository.saveAndFlush(new TutorTeachingProfile(
            tutorId,
            new BigDecimal("250000.00"),
            TeachingMode.HYBRID,
            Set.of("Ho Chi Minh City"),
            TeachingProfileStatus.ACTIVE
        ));

        TutorTeachingProfile persisted = repository.findByTutorId(tutorId).orElseThrow();
        assertThat(persisted.getId()).isEqualTo(profile.getId());
        assertThat(persisted.getLocations()).containsExactly("Ho Chi Minh City");
        assertThat(persisted.getCreatedAt()).isNotNull();
    }
}
