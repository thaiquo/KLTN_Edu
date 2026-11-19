package iuh.fit.learning_service.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record TutorStatisticsSourceResponse(
        String generatedAt,
        int rangeDays,
        TeachingOverview teaching,
        LearningOperations operations,
        ReviewStatistics reviews,
        List<ClassBreakdown> classes,
        List<UpcomingSession> upcomingSessions,
        List<String> unsupportedMetrics
) {
    public record TeachingOverview(
            long activeClasses,
            Long completedClasses,
            long upcomingClasses,
            long totalStudents,
            long totalSessions,
            long completedSessions,
            long upcomingSessionCount,
            long cancelledSessions
    ) { }

    public record LearningOperations(
            long assignmentsCreated,
            long submittedAssignments,
            long pendingSubmissions,
            long gradedSubmissions,
            long sessionActionsPending
    ) { }

    public record ReviewStatistics(
            double averageRating,
            long reviewCount,
            Map<Integer, Long> distribution,
            List<RecentReview> recent
    ) { }

    public record RecentReview(
            long id,
            long classRoomId,
            int rating,
            String comment,
            LocalDateTime createdAt
    ) { }

    public record ClassBreakdown(
            long classRoomId,
            String className,
            String status,
            long enrolledStudents,
            long totalSessions,
            long completedSessions,
            long upcomingSessions
    ) { }

    public record UpcomingSession(
            long sessionId,
            long classRoomId,
            String className,
            int sequenceNumber,
            String topic,
            LocalDate sessionDate,
            String startTime,
            String endTime
    ) { }
}
