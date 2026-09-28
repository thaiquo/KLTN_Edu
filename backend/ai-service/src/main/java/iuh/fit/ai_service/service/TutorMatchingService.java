package iuh.fit.ai_service.service;

import iuh.fit.ai_service.client.TutorCandidateClient;
import iuh.fit.ai_service.dto.TutorMatchingDtos.AvailabilitySlot;
import iuh.fit.ai_service.dto.TutorMatchingDtos.MatchedSubject;
import iuh.fit.ai_service.dto.TutorMatchingDtos.MatchingInputEcho;
import iuh.fit.ai_service.dto.TutorMatchingDtos.PreferredScheduleRequest;
import iuh.fit.ai_service.dto.TutorMatchingDtos.ScoreBreakdown;
import iuh.fit.ai_service.dto.TutorMatchingDtos.ScoreComponent;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SubjectCapability;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchResult;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingRequest;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingResponse;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class TutorMatchingService {
    private static final int SCHEDULE_WEIGHT = 30;
    private static final int BUDGET_WEIGHT = 25;
    private static final int LOCATION_WEIGHT = 20;
    private static final int EXPERIENCE_WEIGHT = 12;
    private static final int RATING_WEIGHT = 13;
    private static final Map<String, Integer> WEIGHTS = Map.of(
            "schedule", SCHEDULE_WEIGHT,
            "budget", BUDGET_WEIGHT,
            "location", LOCATION_WEIGHT,
            "experience", EXPERIENCE_WEIGHT,
            "ratingConfidence", RATING_WEIGHT
    );
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final TutorCandidateClient candidateClient;

    public TutorMatchingService(TutorCandidateClient candidateClient) {
        this.candidateClient = candidateClient;
    }

    public TutorMatchingResponse match(TutorMatchingRequest request) {
        TutorMatchingRequest normalized = normalize(request);
        List<TutorCandidate> candidates = candidateClient.findCandidates(
                normalized.subjectId(),
                normalized.levelId(),
                normalized.teachingMode()
        );

        List<TutorMatchResult> results = candidates.stream()
                .map(candidate -> scoreCandidate(normalized, candidate))
                .flatMap(Optional::stream)
                .sorted(resultComparator())
                .toList();

        return new TutorMatchingResponse(
                new MatchingInputEcho(
                        normalized.subjectId(),
                        normalized.levelId(),
                        normalized.teachingMode(),
                        normalized.budgetMin(),
                        normalized.budgetMax(),
                        normalized.provinceCode(),
                        normalized.communeCode(),
                        normalized.preferredSchedules(),
                        normalized.learningGoal()
                ),
                candidates.size(),
                results.size(),
                List.of(),
                results
        );
    }

    private Optional<TutorMatchResult> scoreCandidate(TutorMatchingRequest request, TutorCandidate candidate) {
        Optional<SubjectCapability> matchedCapability = findMatchedCapability(request, candidate);
        if (matchedCapability.isEmpty() || !isEligible(request, candidate)) {
            return Optional.empty();
        }

        SubjectCapability capability = matchedCapability.get();
        List<String> missingData = new ArrayList<>();
        ScoreComponent schedule = scheduleScore(request.preferredSchedules(), candidate.availability(), missingData);
        ScoreComponent budget = budgetScore(request.budgetMin(), request.budgetMax(), capability, missingData);
        ScoreComponent location = locationScore(request, candidate, missingData);
        ScoreComponent experience = experienceScore(capability.experienceYears(), missingData);
        ScoreComponent rating = ratingScore(candidate.averageRating(), candidate.reviewCount(), missingData);

        BigDecimal rawScore = schedule.weightedScore()
                .add(budget.weightedScore())
                .add(location.weightedScore())
                .add(experience.weightedScore())
                .add(rating.weightedScore())
                .setScale(4, RoundingMode.HALF_UP);
        int matchPercentage = rawScore.setScale(0, RoundingMode.HALF_UP).intValue();
        matchPercentage = Math.max(0, Math.min(100, matchPercentage));

        ScoreBreakdown breakdown = new ScoreBreakdown(
                schedule,
                budget,
                location,
                experience,
                rating,
                rawScore,
                new LinkedHashMap<>(WEIGHTS)
        );

        return Optional.of(new TutorMatchResult(
                candidate.tutorId(),
                candidate.userId(),
                candidate.fullName(),
                candidate.avatarUrl(),
                candidate.bio(),
                candidate.location(),
                candidate.teachingModes(),
                toMatchedSubject(request.levelId(), capability),
                candidate.startingTuition(),
                candidate.availability() == null ? List.of() : candidate.availability(),
                safeRating(candidate.averageRating()),
                safeReviewCount(candidate.reviewCount()),
                candidate.publishedClassCount() == null ? 0L : candidate.publishedClassCount(),
                matchPercentage,
                breakdown,
                matchingReasons(request, capability, candidate, schedule, budget, location, experience, rating),
                List.copyOf(missingData),
                List.of()
        ));
    }

    private boolean isEligible(TutorMatchingRequest request, TutorCandidate candidate) {
        return candidate != null
                && candidate.approvedOrVerified()
                && candidate.teachingModes() != null
                && candidate.teachingModes().stream().anyMatch(mode -> mode.equalsIgnoreCase(request.teachingMode().name()))
                && findMatchedCapability(request, candidate).isPresent();
    }

    private Optional<SubjectCapability> findMatchedCapability(TutorMatchingRequest request, TutorCandidate candidate) {
        if (candidate == null || candidate.subjects() == null) {
            return Optional.empty();
        }
        return candidate.subjects().stream()
                .filter(capability -> request.subjectId().equals(capability.subjectId()))
                .filter(capability -> capability.levels() != null
                        && capability.levels().stream().anyMatch(level -> request.levelId().equals(level.levelId())))
                .max(Comparator
                        .comparing((SubjectCapability capability) -> budgetScoreValue(request.budgetMin(), request.budgetMax(), capability))
                        .thenComparing(capability -> capability.experienceYears() == null ? 0 : capability.experienceYears()));
    }

    private ScoreComponent budgetScore(BigDecimal budgetMin, BigDecimal budgetMax, SubjectCapability capability, List<String> missingData) {
        double score = budgetScoreValue(budgetMin, budgetMax, capability);
        String policy;
        if (budgetMin == null && budgetMax == null) {
            policy = "No student budget provided; neutral budget compatibility.";
            missingData.add("studentBudget");
        } else if (capability.tuitionMin() == null || capability.tuitionMax() == null) {
            policy = "Tutor capability tuition is missing; controlled neutral-low compatibility.";
            missingData.add("tutorTuition");
        } else if (score >= 0.95) {
            policy = "Tutor tuition range overlaps the requested budget.";
        } else if (score >= 0.55) {
            policy = "Tutor tuition is near the requested budget but not an exact overlap.";
        } else {
            policy = "Tutor tuition is far from the requested budget.";
        }
        return component(BUDGET_WEIGHT, score, policy);
    }

    private double budgetScoreValue(BigDecimal budgetMin, BigDecimal budgetMax, SubjectCapability capability) {
        if (budgetMin == null && budgetMax == null) {
            return 0.65;
        }
        if (capability == null || capability.tuitionMin() == null || capability.tuitionMax() == null) {
            return 0.45;
        }

        BigDecimal studentMin = budgetMin == null ? BigDecimal.ZERO : budgetMin;
        BigDecimal studentMax = budgetMax == null ? budgetMin : budgetMax;
        if (studentMax == null) {
            studentMax = capability.tuitionMax();
        }
        BigDecimal tutorMin = capability.tuitionMin();
        BigDecimal tutorMax = capability.tuitionMax();

        if (rangesOverlap(studentMin, studentMax, tutorMin, tutorMax)) {
            BigDecimal overlapStart = studentMin.max(tutorMin);
            BigDecimal overlapEnd = studentMax.min(tutorMax);
            BigDecimal overlap = overlapEnd.subtract(overlapStart).max(BigDecimal.ZERO);
            BigDecimal studentWidth = studentMax.subtract(studentMin).max(BigDecimal.ONE);
            double coverage = clamp(overlap.divide(studentWidth, 6, RoundingMode.HALF_UP).doubleValue());
            return Math.max(0.85, Math.min(1.0, 0.85 + coverage * 0.15));
        }

        BigDecimal gap = tutorMin.compareTo(studentMax) > 0
                ? tutorMin.subtract(studentMax)
                : studentMin.subtract(tutorMax);
        BigDecimal reference = studentMax.max(BigDecimal.ONE);
        double ratio = gap.divide(reference, 6, RoundingMode.HALF_UP).doubleValue();
        if (ratio <= 0.10) {
            return 0.70;
        }
        if (ratio <= 0.25) {
            return 0.45;
        }
        if (ratio <= 0.50) {
            return 0.20;
        }
        return 0.05;
    }

    private ScoreComponent scheduleScore(List<PreferredScheduleRequest> preferredSchedules, List<AvailabilitySlot> availability,
                                         List<String> missingData) {
        if (preferredSchedules == null || preferredSchedules.isEmpty()) {
            missingData.add("studentPreferredSchedules");
            return component(SCHEDULE_WEIGHT, 0.60, "No preferred schedules provided; neutral schedule compatibility.");
        }
        if (availability == null || availability.isEmpty()) {
            missingData.add("tutorAvailability");
            return component(SCHEDULE_WEIGHT, 0.35, "Tutor availability is missing; controlled low schedule compatibility.");
        }

        double total = 0.0;
        for (PreferredScheduleRequest requested : preferredSchedules) {
            double best = availability.stream()
                    .mapToDouble(slot -> scheduleSlotScore(requested, slot))
                    .max()
                    .orElse(0.0);
            total += best;
        }
        double score = total / preferredSchedules.size();
        String policy = score >= 0.95
                ? "Tutor availability fully covers the preferred schedule slots."
                : score > 0.0
                ? "Tutor availability partially matches the preferred schedule slots."
                : "Tutor availability does not match the preferred schedule slots.";
        return component(SCHEDULE_WEIGHT, score, policy);
    }

    private double scheduleSlotScore(PreferredScheduleRequest requested, AvailabilitySlot available) {
        if (requested == null || available == null || !requested.dayOfWeek().equals(available.dayOfWeek())) {
            return 0.0;
        }
        LocalTime requestedStart = LocalTime.parse(requested.startTime());
        LocalTime requestedEnd = LocalTime.parse(requested.endTime());
        LocalTime availableStart = parseTime(available.startTime());
        LocalTime availableEnd = parseTime(available.endTime());
        if (availableStart == null || availableEnd == null || !availableStart.isBefore(availableEnd)) {
            return 0.0;
        }
        if (!availableStart.isAfter(requestedStart) && !availableEnd.isBefore(requestedEnd)) {
            return 1.0;
        }
        LocalTime overlapStart = requestedStart.isAfter(availableStart) ? requestedStart : availableStart;
        LocalTime overlapEnd = requestedEnd.isBefore(availableEnd) ? requestedEnd : availableEnd;
        if (!overlapStart.isBefore(overlapEnd)) {
            return 0.0;
        }
        long requestedMinutes = Math.max(1, Duration.between(requestedStart, requestedEnd).toMinutes());
        long overlapMinutes = Duration.between(overlapStart, overlapEnd).toMinutes();
        return clamp((overlapMinutes / (double) requestedMinutes) * 0.75);
    }

    private ScoreComponent locationScore(TutorMatchingRequest request, TutorCandidate candidate, List<String> missingData) {
        if (request.teachingMode() == TeachingMode.ONLINE) {
            return component(LOCATION_WEIGHT, 1.0, "ONLINE matching does not depend on offline location.");
        }
        if (!StringUtils.hasText(request.provinceCode())) {
            missingData.add("studentProvince");
            return component(LOCATION_WEIGHT, 0.60, "OFFLINE province was not provided; neutral location compatibility.");
        }
        if (candidate.location() == null || !StringUtils.hasText(candidate.location().provinceCode())) {
            missingData.add("tutorLocation");
            return component(LOCATION_WEIGHT, 0.40, "Tutor safe location is missing.");
        }
        boolean sameProvince = request.provinceCode().equalsIgnoreCase(candidate.location().provinceCode());
        boolean requestedCommune = StringUtils.hasText(request.communeCode());
        boolean sameCommune = requestedCommune
                && StringUtils.hasText(candidate.location().communeCode())
                && request.communeCode().equalsIgnoreCase(candidate.location().communeCode());
        if (sameCommune) {
            return component(LOCATION_WEIGHT, 1.0, "Tutor is in the requested commune.");
        }
        if (sameProvince) {
            return component(LOCATION_WEIGHT, requestedCommune ? 0.75 : 0.85, "Tutor is in the requested province.");
        }
        return component(LOCATION_WEIGHT, 0.15, "Tutor is outside the requested province.");
    }

    private ScoreComponent experienceScore(Integer experienceYears, List<String> missingData) {
        if (experienceYears == null) {
            missingData.add("experienceYears");
            return component(EXPERIENCE_WEIGHT, 0.50, "Experience is missing; neutral compatibility.");
        }
        double score = clamp(experienceYears / 5.0);
        String policy = experienceYears >= 5
                ? "Tutor has at least five years of relevant experience."
                : "Tutor experience is normalized with a five-year cap.";
        return component(EXPERIENCE_WEIGHT, score, policy);
    }

    private ScoreComponent ratingScore(Double averageRating, Long reviewCount, List<String> missingData) {
        long reviews = reviewCount == null ? 0 : reviewCount;
        if (reviews <= 0 || averageRating == null || averageRating <= 0.0) {
            missingData.add("reviews");
            return component(RATING_WEIGHT, 0.58, "No reviews yet; neutral rating confidence, not treated as bad quality.");
        }
        double priorRating = 4.2;
        double priorWeight = 5.0;
        double adjusted = ((averageRating * reviews) + (priorRating * priorWeight)) / (reviews + priorWeight);
        double score = clamp((adjusted - 3.0) / 2.0);
        String policy = "Bayesian-adjusted rating using averageRating, reviewCount, prior 4.2 and prior weight 5.";
        return component(RATING_WEIGHT, score, policy);
    }

    private List<String> matchingReasons(TutorMatchingRequest request, SubjectCapability capability, TutorCandidate candidate,
                                         ScoreComponent schedule, ScoreComponent budget, ScoreComponent location,
                                         ScoreComponent experience, ScoreComponent rating) {
        List<String> reasons = new ArrayList<>();
        reasons.add("Dạy đúng môn và cấp độ học đã chọn.");
        reasons.add("Hỗ trợ hình thức học " + request.teachingMode().name() + ".");
        if (schedule.normalizedScore() >= 0.95) {
            reasons.add("Lịch dạy phù hợp với thời gian bạn mong muốn.");
        } else if (schedule.normalizedScore() > 0.0 && schedule.normalizedScore() < 0.95) {
            reasons.add("Có một phần lịch dạy trùng với thời gian bạn mong muốn.");
        }
        if (budget.normalizedScore() >= 0.85) {
            reasons.add("Mức nhận dạy nằm trong khoảng ngân sách.");
        } else if (budget.normalizedScore() >= 0.45) {
            reasons.add("Mức nhận dạy gần với khoảng ngân sách.");
        }
        if (request.teachingMode() == TeachingMode.OFFLINE && location.normalizedScore() >= 0.75) {
            reasons.add("Phù hợp khu vực học trực tiếp.");
        }
        if (capability.experienceYears() != null && experience.normalizedScore() >= 0.80) {
            reasons.add("Có nhiều năm kinh nghiệm giảng dạy.");
        }
        if (candidate.reviewCount() != null && candidate.reviewCount() >= 5 && rating.normalizedScore() >= 0.75) {
            reasons.add("Có đánh giá tích cực từ nhiều học viên.");
        }
        return reasons;
    }

    private MatchedSubject toMatchedSubject(Long requestedLevelId, SubjectCapability capability) {
        return new MatchedSubject(
                capability.registrationId(),
                capability.subjectId(),
                capability.subjectName(),
                requestedLevelId,
                capability.levels().stream()
                        .filter(level -> requestedLevelId.equals(level.levelId()))
                        .map(level -> level.levelName())
                        .findFirst()
                        .orElse(null),
                capability.categoryId(),
                capability.categoryName(),
                capability.experienceYears(),
                capability.tuitionMin(),
                capability.tuitionMax(),
                capability.description()
        );
    }

    private TutorMatchingRequest normalize(TutorMatchingRequest request) {
        return new TutorMatchingRequest(
                request.subjectId(),
                request.levelId(),
                request.teachingMode(),
                request.budgetMin(),
                request.budgetMax(),
                trimToNull(request.provinceCode()),
                trimToNull(request.communeCode()),
                request.preferredSchedules() == null ? List.of() : request.preferredSchedules(),
                trimToNull(request.learningGoal())
        );
    }

    private Comparator<TutorMatchResult> resultComparator() {
        return Comparator
                .comparing(TutorMatchResult::matchPercentage).reversed()
                .thenComparing(result -> result.scoreBreakdown().rawScore(), Comparator.reverseOrder())
                .thenComparing(result -> result.averageRating() == null ? 0.0 : result.averageRating(), Comparator.reverseOrder())
                .thenComparing(result -> result.reviewCount() == null ? 0L : result.reviewCount(), Comparator.reverseOrder())
                .thenComparing(TutorMatchResult::tutorId, Comparator.nullsLast(Long::compareTo));
    }

    private ScoreComponent component(int weight, double normalizedScore, String policy) {
        double clamped = clamp(normalizedScore);
        BigDecimal weighted = BigDecimal.valueOf(clamped)
                .multiply(BigDecimal.valueOf(weight))
                .setScale(4, RoundingMode.HALF_UP);
        return new ScoreComponent(weight, round(clamped), weighted, policy);
    }

    private boolean rangesOverlap(BigDecimal leftMin, BigDecimal leftMax, BigDecimal rightMin, BigDecimal rightMax) {
        return leftMax.compareTo(rightMin) >= 0 && rightMax.compareTo(leftMin) >= 0;
    }

    private LocalTime parseTime(String value) {
        try {
            return StringUtils.hasText(value) ? LocalTime.parse(value.trim()) : null;
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private Double safeRating(Double value) {
        return value == null ? 0.0 : value;
    }

    private Long safeReviewCount(Long value) {
        return value == null ? 0L : value;
    }

    private double clamp(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP).doubleValue();
    }
}
