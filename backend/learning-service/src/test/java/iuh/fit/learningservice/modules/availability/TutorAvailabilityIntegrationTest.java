package iuh.fit.learningservice.modules.availability;

import iuh.fit.learningservice.modules.availability.entity.AvailabilityResourceType;
import iuh.fit.learningservice.modules.availability.entity.TutorAvailability;
import iuh.fit.learningservice.modules.availability.entity.TutorAvailabilityUsage;
import iuh.fit.learningservice.modules.availability.repository.TutorAvailabilityRepository;
import iuh.fit.learningservice.modules.availability.repository.TutorAvailabilityUsageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TutorAvailabilityIntegrationTest {

    private static final String USER_ID_HEADER = "X-User-Id";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TutorAvailabilityRepository availabilityRepository;

    @Autowired
    private TutorAvailabilityUsageRepository usageRepository;

    @BeforeEach
    void cleanDatabase() {
        usageRepository.deleteAll();
        availabilityRepository.deleteAll();
    }

    @Test
    void replacesAndReadsTutorAvailability() throws Exception {
        UUID tutorId = UUID.randomUUID();

        mockMvc.perform(put("/tutors/me/availability")
                .header(USER_ID_HEADER, tutorId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "availabilities": [
                        {
                          "dayOfWeek": "MONDAY",
                          "startTime": "19:00:00",
                          "endTime": "21:00:00",
                          "status": "AVAILABLE"
                        },
                        {
                          "dayOfWeek": "WEDNESDAY",
                          "startTime": "08:00:00",
                          "endTime": "10:00:00",
                          "status": "AVAILABLE"
                        },
                        {
                          "dayOfWeek": "FRIDAY",
                          "startTime": "18:00:00",
                          "endTime": "20:00:00",
                          "status": "AVAILABLE"
                        }
                      ]
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].tutorId").value(tutorId.toString()))
            .andExpect(jsonPath("$[0].dayOfWeek").value("MONDAY"))
            .andExpect(jsonPath("$[1].dayOfWeek").value("WEDNESDAY"));

        mockMvc.perform(get("/tutors/{tutorId}/availability", tutorId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(3));

        mockMvc.perform(get("/tutors/me/availability").header(USER_ID_HEADER, tutorId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void rejectsOverlappingSlots() throws Exception {
        UUID tutorId = UUID.randomUUID();

        mockMvc.perform(put("/tutors/me/availability")
                .header(USER_ID_HEADER, tutorId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "availabilities": [
                        {
                          "dayOfWeek": "MONDAY",
                          "startTime": "19:00:00",
                          "endTime": "21:00:00",
                          "status": "AVAILABLE"
                        },
                        {
                          "dayOfWeek": "MONDAY",
                          "startTime": "20:00:00",
                          "endTime": "22:00:00",
                          "status": "AVAILABLE"
                        },
                        {
                          "dayOfWeek": "WEDNESDAY",
                          "startTime": "20:00:00",
                          "endTime": "22:00:00",
                          "status": "AVAILABLE"
                        }
                      ]
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_AVAILABILITY"));

        assertThat(availabilityRepository.count()).isZero();
    }

    @Test
    void rejectsSlotsBelowRequiredWeeklyMinimumOrDuration() throws Exception {
        UUID tutorId = UUID.randomUUID();

        mockMvc.perform(put("/tutors/me/availability")
                .header(USER_ID_HEADER, tutorId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"availabilities": [{"dayOfWeek":"MONDAY","startTime":"19:00:00","endTime":"20:00:00","status":"AVAILABLE"}]}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Cần tạo ít nhất 3 lịch trống trong tuần"));

        mockMvc.perform(put("/tutors/me/availability")
                .header(USER_ID_HEADER, tutorId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"availabilities": [
                      {"dayOfWeek":"MONDAY","startTime":"19:00:00","endTime":"20:00:00","status":"AVAILABLE"},
                      {"dayOfWeek":"WEDNESDAY","startTime":"19:00:00","endTime":"21:00:00","status":"AVAILABLE"},
                      {"dayOfWeek":"FRIDAY","startTime":"19:00:00","endTime":"21:00:00","status":"AVAILABLE"}
                    ]}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Mỗi lịch trống phải kéo dài ít nhất 90 phút"));
    }

    @Test
    void returnsConflictWhenActiveClassUsesChangedAvailability() throws Exception {
        UUID tutorId = UUID.randomUUID();
        TutorAvailability availability = availabilityRepository.saveAndFlush(new TutorAvailability(
            tutorId,
            DayOfWeek.MONDAY,
            LocalTime.of(19, 0),
            LocalTime.of(21, 0),
            iuh.fit.learningservice.modules.availability.entity.AvailabilityStatus.AVAILABLE
        ));
        usageRepository.saveAndFlush(new TutorAvailabilityUsage(
            availability,
            AvailabilityResourceType.CLASSROOM,
            UUID.randomUUID()
        ));

        mockMvc.perform(put("/tutors/me/availability")
                .header(USER_ID_HEADER, tutorId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "availabilities": [
                        {
                          "id": "%s",
                          "dayOfWeek": "MONDAY",
                          "startTime": "20:00:00",
                          "endTime": "22:00:00",
                          "status": "AVAILABLE"
                        },
                        {
                          "dayOfWeek": "WEDNESDAY",
                          "startTime": "19:00:00",
                          "endTime": "21:00:00",
                          "status": "AVAILABLE"
                        },
                        {
                          "dayOfWeek": "FRIDAY",
                          "startTime": "19:00:00",
                          "endTime": "21:00:00",
                          "status": "AVAILABLE"
                        }
                      ]
                    }
                    """.formatted(availability.getId())))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("AVAILABILITY_IN_USE"))
            .andExpect(jsonPath("$.message")
                .value("Cannot update availability because it is used by an active class"));

        mockMvc.perform(put("/tutors/me/availability")
                .header(USER_ID_HEADER, tutorId)
                .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"availabilities": [
                  {"dayOfWeek":"TUESDAY","startTime":"19:00:00","endTime":"21:00:00","status":"AVAILABLE"},
                  {"dayOfWeek":"WEDNESDAY","startTime":"19:00:00","endTime":"21:00:00","status":"AVAILABLE"},
                  {"dayOfWeek":"THURSDAY","startTime":"19:00:00","endTime":"21:00:00","status":"AVAILABLE"}
                ]}
                """))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("AVAILABILITY_IN_USE"));

        List<TutorAvailability> persisted = availabilityRepository.findAll();
        assertThat(persisted).hasSize(1);
        assertThat(persisted.getFirst().getStartTime()).isEqualTo(LocalTime.of(19, 0));
        assertThat(persisted.getFirst().getEndTime()).isEqualTo(LocalTime.of(21, 0));
    }
}
