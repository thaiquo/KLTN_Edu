package iuh.fit.contract_service.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import iuh.fit.contract_service.api.ContractManagementController.InitiateAgreementRequest;
import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.server.ResponseStatusException;
import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Date;
import java.util.List;

@Component
public class ContractSourceSnapshotClient {
    private final RestClient account;
    private final RestClient learning;
    private final SecretKey key;

    public ContractSourceSnapshotClient(@Value("${ACCOUNT_SERVICE_URL:http://localhost:8081}") String accountUrl,
                                        @Value("${LEARNING_SERVICE_URL:http://localhost:8082}") String learningUrl,
                                        @Value("${jwt.secret}") String secret) {
        this.account = RestClient.builder().baseUrl(accountUrl).build();
        this.learning = RestClient.builder().baseUrl(learningUrl).build();
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public record Party(Long userId, String email, String fullName, String phone, LocalDate dateOfBirth,
                        String address, String walletAddress, List<String> roles) {}
    public record Classroom(Long classroomId, String className, String classDescription, Long tutorId,
                            String tutorEmail, Long studentId, String studentEmail,
                            BigDecimal pricePerSessionVnd, int totalSessions, String classroomReviewerEmail,
                            String learningMode, String meetingLink, String learningAddress,
                            LocalDate courseStartDate, LocalDate courseEndDate, int durationPerSessionMinutes,
                            List<Schedule> schedules, List<Chapter> syllabus) {}
    public record Schedule(int dayOfWeek, String startTime, String endTime) {}
    public record Chapter(int order, String title, String description, int expectedSessions) {}

    public InitiateAgreementRequest resolve(InitiateAgreementRequest intent, ContractUserPrincipal actor) {
        if (intent.classroomId() == null || intent.studentId() == null || intent.tutorId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Classroom and party identifiers are required");
        }
        String token = serviceToken();
        try {
            Party tutor = account.get().uri("/api/internal/contract-snapshot/users/{id}", intent.tutorId())
                    .header("X-Service-Token", token).retrieve().body(Party.class);
            Party student = account.get().uri("/api/internal/contract-snapshot/users/{id}", intent.studentId())
                    .header("X-Service-Token", token).retrieve().body(Party.class);
            Classroom room = learning.get().uri(uri -> uri.path("/api/learning/internal/contracts/snapshot")
                            .queryParam("classroomId", intent.classroomId())
                            .queryParam("studentId", intent.studentId()).build())
                    .header("X-Service-Token", token).retrieve().body(Classroom.class);
            return authoritative(intent, actor, tutor, student, room);
        } catch (HttpClientErrorException exception) {
            int status = exception.getStatusCode().value();
            if (status == 404 || status == 409) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Contract source data is unavailable or inconsistent", exception);
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Contract source authentication failed", exception);
        } catch (ResourceAccessException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Contract source is unavailable", exception);
        }
    }

    InitiateAgreementRequest authoritative(InitiateAgreementRequest intent, ContractUserPrincipal actor,
                                           Party tutor, Party student, Classroom room) {
        if (tutor == null || student == null || room == null
                || !actor.matchesUserId(tutor.userId())
                || !java.util.Objects.equals(room.tutorId(), tutor.userId())
                || !java.util.Objects.equals(room.studentId(), student.userId())
                || room.tutorEmail() == null || tutor.email() == null
                || !room.tutorEmail().equalsIgnoreCase(tutor.email())
                || room.studentEmail() == null || student.email() == null
                || !room.studentEmail().equalsIgnoreCase(student.email())
                || tutor.roles() == null || student.roles() == null
                || !tutor.roles().contains("TUTOR") || !student.roles().contains("STUDENT")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Contract parties do not match authoritative data");
        }
        if (room.pricePerSessionVnd() == null || room.pricePerSessionVnd().signum() <= 0
                || room.totalSessions() <= 0 || room.courseStartDate() == null
                || room.courseEndDate() == null || room.schedules() == null || room.syllabus() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Classroom contract terms are incomplete");
        }
        if (tutor.walletAddress() == null || student.walletAddress() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Both parties must link wallets before agreement creation");
        }
        return new InitiateAgreementRequest(room.classroomId(), room.className(), student.userId(),
                student.fullName(), student.email(), student.phone(),
                student.dateOfBirth() == null ? null : student.dateOfBirth().toString(), student.address(),
                tutor.userId(), tutor.fullName(), tutor.email(), tutor.phone(), tutor.address(),
                student.walletAddress(), tutor.walletAddress(), room.pricePerSessionVnd(), room.totalSessions(),
                room.classroomReviewerEmail(), room.classDescription(), room.learningMode(),
                intent.meetingPlatform(), room.meetingLink(), room.learningAddress(),
                room.courseStartDate().toString(), room.courseEndDate().toString(), room.durationPerSessionMinutes(),
                room.schedules().stream().map(s -> new ContractTermsSnapshot.ScheduleTerms(
                        s.dayOfWeek(), s.startTime(), s.endTime())).toList(),
                room.syllabus().stream().map(c -> new ContractTermsSnapshot.SyllabusTerms(
                        c.order(), c.title(), c.description(), c.expectedSessions())).toList());
    }

    private String serviceToken() {
        Instant now = Instant.now();
        return Jwts.builder().subject("contract-service").claim("serviceScope", "contract-snapshot")
                .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(60)))
                .signWith(key).compact();
    }
}
