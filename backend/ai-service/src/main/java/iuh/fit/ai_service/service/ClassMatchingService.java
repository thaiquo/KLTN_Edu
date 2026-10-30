package iuh.fit.ai_service.service;

import iuh.fit.ai_service.client.LearningPublicClassClient;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchResult;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchingRequest;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchingResponse;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassSchedule;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassScoreBreakdown;
import iuh.fit.ai_service.dto.ClassMatchingDtos.MatchedClassLevel;
import iuh.fit.ai_service.dto.ClassMatchingDtos.MatchedClassSubject;
import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassSource;
import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundedClassRequirement;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.TimeOfDayHint;
import iuh.fit.ai_service.dto.TutorMatchingDtos.ScoreComponent;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SemanticScoreComponent;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.ClassSemanticSearchRequest;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.ClassSemanticSearchResult;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.ClassSemanticSearchStatus;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.SemanticClassCandidate;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class ClassMatchingService {
    private static final int SCHEDULE_WEIGHT = 35;
    private static final int BUDGET_WEIGHT = 30;
    private static final int START_TIMING_WEIGHT = 10;
    private static final int CAPACITY_WEIGHT = 10;
    private static final int RATING_WEIGHT = 15;
    private static final Map<String, Integer> WEIGHTS = Map.of(
            "schedule", SCHEDULE_WEIGHT,
            "budget", BUDGET_WEIGHT,
            "startTiming", START_TIMING_WEIGHT,
            "capacity", CAPACITY_WEIGHT,
            "ratingConfidence", RATING_WEIGHT
    );
    private static final SemanticScoreComponent SEMANTIC_NOT_APPLIED = new SemanticScoreComponent(
            false,
            false,
            null,
            BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP),
            "Semantic class matching was not applied; structured class score is used."
    );

    private final LearningPublicClassClient publicClassClient;
    private final ClassSemanticSearchService semanticSearchService;
    private final ClassHybridMatchingProperties hybridProperties;

    public ClassMatchingService(
            LearningPublicClassClient publicClassClient,
            ClassSemanticSearchService semanticSearchService,
            ClassHybridMatchingProperties hybridProperties
    ) {
        this.publicClassClient = publicClassClient;
        this.semanticSearchService = semanticSearchService;
        this.hybridProperties = hybridProperties;
    }

    public ClassMatchingResponse match(ClassMatchingRequest request) {
        GroundedClassRequirement requirement = request.requirement();
        validateCoreRequirement(requirement);
        int topK = request.topK() == null || request.topK() <= 0 ? 20 : request.topK();
        Long subjectId = requirement.subject().id();
        Long levelId = requirement.level().id();
        TeachingMode mode = requirement.teachingMode();
        List<PublicClassSource> candidates = publicClassClient.findSemanticSources(null, subjectId, levelId, mode, true, null);
        List<ScoredClassMatch> structured = candidates.stream()
                .map(source -> scoreCandidate(requirement, source))
                .flatMap(java.util.Optional::stream)
                .sorted(structuredComparator())
                .toList();
        List<ScoredClassMatch> ranked = applyHybridRanking(requirement, structured, topK).stream()
                .sorted(hybridComparator())
                .limit(topK)
                .toList();
        return new ClassMatchingResponse(
                requirement,
                candidates.size(),
                structured.size(),
                ranked.stream().anyMatch(item -> item.semanticBoost().compareTo(BigDecimal.ZERO) > 0) ? "HYBRID_V2" : "STRUCTURED_V1",
                ranked.stream().map(ScoredClassMatch::result).toList()
        );
    }

    private void validateCoreRequirement(GroundedClassRequirement requirement) {
        if (requirement == null || requirement.subject() == null || requirement.subject().id() == null
                || requirement.level() == null || requirement.level().id() == null || requirement.teachingMode() == null) {
            throw new IllegalArgumentException("Class matching requires grounded subjectId, levelId, and teachingMode.");
        }
    }

    private java.util.Optional<ScoredClassMatch> scoreCandidate(GroundedClassRequirement requirement, PublicClassSource source) {
        if (!isEligible(requirement, source)) {
            return java.util.Optional.empty();
        }
        List<String> missingData = new ArrayList<>();
        ScoreComponent schedule = scheduleScore(requirement.availableSchedules(), source.schedules());
        ScoreComponent budget = budgetScore(requirement.budget(), source.pricePerSession(), missingData);
        ScoreComponent startTiming = startTimingScore(source.startDate(), missingData);
        ScoreComponent capacity = capacityScore(source.availableSlots(), missingData);
        ScoreComponent rating = ratingScore(source.averageRating(), source.reviewCount(), missingData);
        BigDecimal rawScore = schedule.weightedScore()
                .add(budget.weightedScore())
                .add(startTiming.weightedScore())
                .add(capacity.weightedScore())
                .add(rating.weightedScore())
                .setScale(4, RoundingMode.HALF_UP);
        ClassScoreBreakdown breakdown = new ClassScoreBreakdown(
                schedule,
                budget,
                startTiming,
                capacity,
                rating,
                SEMANTIC_NOT_APPLIED,
                rawScore,
                new LinkedHashMap<>(WEIGHTS)
        );
        MatchExplanation explanation = explain(requirement, source, budget, schedule, capacity, rating);
        ClassMatchResult result = toResult(
                source,
                rawScore,
                breakdown,
                explanation.matchingReasons(),
                explanation.mismatchReasons(),
                missingData
        );
        return java.util.Optional.of(new ScoredClassMatch(result, rawScore, rawScore, null, BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP)));
    }

    private boolean isEligible(GroundedClassRequirement requirement, PublicClassSource source) {
        if (source == null || source.registration() == null || source.level() == null || source.learningMode() == null) {
            return false;
        }
        String status = source.status();
        return ("PUBLISHED".equalsIgnoreCase(status) || "ACTIVE".equalsIgnoreCase(status))
                && Objects.equals(source.registration().subjectId(), requirement.subject().id())
                && Objects.equals(source.level().id(), requirement.level().id())
                && source.learningMode() == requirement.teachingMode()
                && source.availableSlots() != null
                && source.availableSlots() > 0
                && scheduleCompatible(requirement.availableSchedules(), source.schedules());
    }

    private ScoreComponent scheduleScore(List<PreferredSchedule> preferred, List<ClassSchedule> schedules) {
        if (preferred == null || preferred.isEmpty()) {
            return component(SCHEDULE_WEIGHT, 0.8, "No schedule preference provided; neutral-high schedule compatibility.");
        }
        return component(SCHEDULE_WEIGHT, 1.0, "Class schedules fit inside the requested day/time windows.");
    }

    private boolean scheduleCompatible(List<PreferredSchedule> preferred, List<ClassSchedule> schedules) {
        if (preferred == null || preferred.isEmpty()) {
            return true;
        }
        if (schedules == null || schedules.isEmpty()) {
            return false;
        }
        return schedules.stream().allMatch(schedule -> fitsAnyPreferredSlot(schedule, preferred));
    }

    private boolean fitsAnyPreferredSlot(ClassSchedule schedule, List<PreferredSchedule> preferred) {
        Integer day = normalizeDay(schedule.dayOfWeek());
        LocalTime classStart = parseTime(schedule.startTime());
        LocalTime classEnd = parseTime(schedule.endTime());
        if (day == null || classStart == null || classEnd == null) {
            return false;
        }
        return preferred.stream().anyMatch(slot -> {
            Integer preferredDay = normalizeDay(slot.dayOfWeek());
            if (preferredDay != null && !preferredDay.equals(day)) {
                return false;
            }
            LocalTime preferredStart = parseTime(slot.startTime());
            LocalTime preferredEnd = parseTime(slot.endTime());
            if (preferredStart == null && preferredEnd == null && slot.timeOfDayHint() != null) {
                return overlapsTimeOfDay(classStart, classEnd, slot.timeOfDayHint());
            }
            return (preferredStart == null || !classStart.isBefore(preferredStart))
                    && (preferredEnd == null || !classEnd.isAfter(preferredEnd));
        });
    }

    private boolean overlapsTimeOfDay(LocalTime classStart, LocalTime classEnd, TimeOfDayHint hint) {
        LocalTime windowStart = switch (hint) {
            case MORNING -> LocalTime.of(5, 0);
            case AFTERNOON -> LocalTime.NOON;
            case EVENING -> LocalTime.of(18, 0);
            case NIGHT -> LocalTime.of(22, 0);
        };
        LocalTime windowEnd = switch (hint) {
            case MORNING -> LocalTime.NOON;
            case AFTERNOON -> LocalTime.of(18, 0);
            case EVENING -> LocalTime.of(22, 0);
            case NIGHT -> LocalTime.MAX;
        };
        return classStart.isBefore(windowEnd) && classEnd.isAfter(windowStart);
    }

    private ScoreComponent budgetScore(Budget budget, BigDecimal price, List<String> missingData) {
        if (price == null) {
            missingData.add("classPrice");
            return component(BUDGET_WEIGHT, 0.45, "Class price is missing; controlled neutral-low budget compatibility.");
        }
        if (budget == null || (budget.min() == null && budget.max() == null && budget.target() == null)) {
            missingData.add("studentBudget");
            return component(BUDGET_WEIGHT, 0.7, "No student budget provided; neutral budget compatibility.");
        }
        BigDecimal min = budget.min();
        BigDecimal max = budget.max();
        if (min != null && max != null && price.compareTo(min) >= 0 && price.compareTo(max) <= 0) {
            return component(BUDGET_WEIGHT, 1.0, "Class price is inside the requested budget range.");
        }
        if (max != null && price.compareTo(max) <= 0) {
            return component(BUDGET_WEIGHT, 0.95, "Class price is within the requested maximum budget.");
        }
        BigDecimal target = budget.target() != null ? budget.target() : max;
        if (target == null || target.compareTo(BigDecimal.ZERO) <= 0) {
            return component(BUDGET_WEIGHT, 0.65, "Budget signal is incomplete; neutral budget compatibility.");
        }
        double ratio = price.subtract(target).abs().divide(target, 4, RoundingMode.HALF_UP).doubleValue();
        double score = Math.max(0.25, 1.0 - ratio);
        return component(BUDGET_WEIGHT, score, "Class price is near but not exactly inside the requested budget.");
    }

    private ScoreComponent startTimingScore(LocalDate startDate, List<String> missingData) {
        if (startDate == null) {
            missingData.add("classStartDate");
            return component(START_TIMING_WEIGHT, 0.6, "Class start date is missing; neutral start timing.");
        }
        long days = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), startDate);
        if (days <= 45) {
            return component(START_TIMING_WEIGHT, 1.0, "Class starts soon.");
        }
        if (days <= 90) {
            return component(START_TIMING_WEIGHT, 0.8, "Class starts within a reasonable upcoming window.");
        }
        return component(START_TIMING_WEIGHT, 0.6, "Class starts later than most near-term learning needs.");
    }

    private ScoreComponent capacityScore(Long availableSlots, List<String> missingData) {
        if (availableSlots == null) {
            missingData.add("classCapacity");
            return component(CAPACITY_WEIGHT, 0.4, "Class capacity is missing; controlled neutral-low capacity compatibility.");
        }
        if (availableSlots >= 3) {
            return component(CAPACITY_WEIGHT, 1.0, "Class has multiple available seats.");
        }
        if (availableSlots == 2) {
            return component(CAPACITY_WEIGHT, 0.8, "Class has two available seats.");
        }
        return component(CAPACITY_WEIGHT, 0.6, "Class has one available seat.");
    }

    private ScoreComponent ratingScore(Double averageRating, Long reviewCount, List<String> missingData) {
        if (averageRating == null || reviewCount == null || reviewCount <= 0) {
            missingData.add("classTutorReviews");
            return component(RATING_WEIGHT, 0.6, "Tutor review confidence is missing; neutral rating compatibility.");
        }
        double ratingScore = Math.max(0.0, Math.min(1.0, averageRating / 5.0));
        double confidence = Math.min(1.0, reviewCount / 10.0);
        return component(RATING_WEIGHT, ratingScore * (0.75 + confidence * 0.25), "Tutor rating is used as a modest confidence signal.");
    }

    private List<ScoredClassMatch> applyHybridRanking(GroundedClassRequirement requirement, List<ScoredClassMatch> structured, int topK) {
        if (structured.isEmpty() || !hybridProperties.semanticMatchingEnabled()) {
            return structured;
        }
        ClassSemanticSearchResult semanticResult;
        try {
            semanticResult = semanticSearchService.search(new ClassSemanticSearchRequest(
                    requirement.subject().id(),
                    requirement.subject().name(),
                    requirement.level().id(),
                    requirement.level().name(),
                    requirement.teachingMode(),
                    requirement.learningGoal(),
                    requirement.weakTopics(),
                    requirement.classPreferences(),
                    topK
            ));
        } catch (RuntimeException exception) {
            return structured;
        }
        if (semanticResult == null
                || semanticResult.status() != ClassSemanticSearchStatus.APPLICABLE
                || semanticResult.candidates() == null
                || semanticResult.candidates().isEmpty()) {
            return structured;
        }
        Map<Long, SemanticCandidateRank> semanticByClassId = semanticRanks(semanticResult.candidates());
        return structured.stream()
                .map(result -> applySemanticRankBoost(result, semanticByClassId.get(result.result().classId())))
                .toList();
    }

    private Map<Long, SemanticCandidateRank> semanticRanks(List<SemanticClassCandidate> candidates) {
        Map<Long, SemanticCandidateRank> ranks = new LinkedHashMap<>();
        int count = candidates.size();
        for (int index = 0; index < count; index++) {
            SemanticClassCandidate candidate = candidates.get(index);
            if (candidate.classId() == null) {
                continue;
            }
            double normalizedRank = count <= 1 ? 1.0 : 1.0 - (index / (double) (count - 1));
            ranks.putIfAbsent(candidate.classId(), new SemanticCandidateRank(candidate, round(normalizedRank)));
        }
        return ranks;
    }

    private ScoredClassMatch applySemanticRankBoost(ScoredClassMatch scored, SemanticCandidateRank semanticRank) {
        if (semanticRank == null) {
            SemanticScoreComponent semantic = new SemanticScoreComponent(
                    true,
                    false,
                    null,
                    BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP),
                    "No validated semantic candidate was available for this eligible class; no semantic boost applied."
            );
            return replaceSemantic(scored, semantic, scored.structuredScore(), BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
        }
        BigDecimal boost = BigDecimal.valueOf(semanticRank.normalizedSignal())
                .multiply(BigDecimal.valueOf(hybridProperties.maxSemanticRankBoost()))
                .setScale(4, RoundingMode.HALF_UP);
        BigDecimal hybridScore = scored.structuredScore().add(boost).setScale(4, RoundingMode.HALF_UP);
        SemanticScoreComponent semantic = new SemanticScoreComponent(
                true,
                boost.compareTo(BigDecimal.ZERO) > 0,
                semanticRank.normalizedSignal(),
                boost,
                "Validated class semantic candidate is used as a bounded rank-based boost; raw cosine is not converted to a percentage."
        );
        return replaceSemantic(scored, semantic, hybridScore, boost);
    }

    private ScoredClassMatch replaceSemantic(
            ScoredClassMatch scored,
            SemanticScoreComponent semantic,
            BigDecimal hybridScore,
            BigDecimal semanticBoost
    ) {
        ClassMatchResult current = scored.result();
        ClassScoreBreakdown currentBreakdown = current.scoreBreakdown();
        ClassScoreBreakdown breakdown = new ClassScoreBreakdown(
                currentBreakdown.schedule(),
                currentBreakdown.budget(),
                currentBreakdown.startTiming(),
                currentBreakdown.capacity(),
                currentBreakdown.ratingConfidence(),
                semantic,
                currentBreakdown.rawScore(),
                currentBreakdown.weights()
        );
        ClassMatchResult updated = new ClassMatchResult(
                current.classId(),
                current.tutorSubjectRegistrationId(),
                current.tutorProfileId(),
                current.tutorFullName(),
                current.name(),
                current.description(),
                current.teachingMode(),
                current.address(),
                current.subject(),
                current.level(),
                current.pricePerSession(),
                current.sessionsPerWeek(),
                current.durationPerSessionMinutes(),
                current.startDate(),
                current.endDate(),
                current.totalSessions(),
                current.availableSlots(),
                current.averageRating(),
                current.reviewCount(),
                current.schedules(),
                current.topicChips(),
                percentage(hybridScore),
                breakdown,
                current.matchingReasons(),
                current.mismatchReasons(),
                current.missingData()
        );
        return new ScoredClassMatch(updated, scored.structuredScore(), hybridScore, semantic.normalizedSignal(), semanticBoost);
    }

    private ClassMatchResult toResult(
            PublicClassSource source,
            BigDecimal score,
            ClassScoreBreakdown breakdown,
            List<String> reasons,
            List<String> mismatchReasons,
            List<String> missingData
    ) {
        return new ClassMatchResult(
                source.id(),
                source.tutorSubjectRegistrationId(),
                source.tutorProfileId(),
                source.tutorFullName(),
                source.name(),
                source.description(),
                source.learningMode(),
                source.address(),
                new MatchedClassSubject(
                        source.registration().subjectId(),
                        source.registration().subjectName(),
                        source.registration().categoryId(),
                        source.registration().categoryName()
                ),
                new MatchedClassLevel(source.level().id(), source.level().name()),
                source.pricePerSession(),
                source.sessionsPerWeek(),
                source.durationPerSessionMinutes(),
                source.startDate(),
                source.endDate(),
                source.totalSessions(),
                source.availableSlots(),
                source.averageRating(),
                source.reviewCount(),
                source.schedules() == null ? List.of() : source.schedules(),
                source.topicChips() == null ? List.of() : source.topicChips(),
                percentage(score),
                breakdown,
                reasons,
                mismatchReasons,
                List.copyOf(missingData)
        );
    }

    private MatchExplanation explain(
            GroundedClassRequirement requirement,
            PublicClassSource source,
            ScoreComponent budget,
            ScoreComponent schedule,
            ScoreComponent capacity,
            ScoreComponent rating
    ) {
        List<String> reasons = new ArrayList<>();
        List<String> mismatches = new ArrayList<>();
        reasons.add("Lớp đúng môn " + source.registration().subjectName()
                + ", cấp độ " + source.level().name() + ".");

        String evidenceText = classEvidenceText(source);
        List<String> matchedTopics = supportedPhrases(requirement.weakTopics(), evidenceText);
        List<String> matchedPreferences = supportedPhrases(requirement.classPreferences(), evidenceText);
        if (!matchedTopics.isEmpty()) {
            reasons.add("Nội dung lớp nêu rõ " + quotedList(matchedTopics, 2)
                    + ", phù hợp phần kiến thức bạn đang yếu.");
        } else if (!matchedPreferences.isEmpty()) {
            reasons.add("Nội dung lớp phù hợp mong muốn " + quotedList(matchedPreferences, 2) + ".");
        }

        if (schedule.normalizedScore() >= 0.9 && requirement.availableSchedules() != null
                && !requirement.availableSchedules().isEmpty()) {
            List<Integer> days = safeList(source.schedules()).stream()
                    .map(ClassSchedule::dayOfWeek)
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
            reasons.add(days.isEmpty()
                    ? "Lịch học phù hợp với thời gian đã chọn."
                    : "Lịch lớp trùng " + days.stream().map(this::dayLabel)
                            .collect(java.util.stream.Collectors.joining(", ")) + ".");
        }
        if (budgetWithinRequirement(requirement.budget(), source.pricePerSession())) {
            reasons.add("Học phí nằm trong ngân sách đã nêu.");
        }
        if (capacity.normalizedScore() >= 0.8) reasons.add("Lớp còn chỗ đăng ký.");
        if (rating.normalizedScore() >= 0.75) reasons.add("Gia sư của lớp có đánh giá tốt.");
        if (reasons.size() < 4) {
            reasons.add(source.learningMode() == TeachingMode.ONLINE
                    ? "Lớp hỗ trợ học online theo đúng hình thức bạn chọn."
                    : "Lớp hỗ trợ học trực tiếp theo đúng hình thức bạn chọn.");
        }

        for (String topic : safeList(requirement.weakTopics())) {
            if (!matchedTopics.contains(topic)) {
                mismatches.add("Nội dung công khai chưa nêu rõ “" + topic + "”.");
            }
        }
        if (requirement.budget() != null && !budgetWithinRequirement(requirement.budget(), source.pricePerSession())) {
            mismatches.add("Học phí chưa khớp hoàn toàn với ngân sách đã nêu.");
        }
        return new MatchExplanation(distinctLimited(reasons, 4), distinctLimited(mismatches, 2));
    }

    private boolean budgetWithinRequirement(Budget budget, BigDecimal price) {
        if (budget == null || price == null) return false;
        if (budget.min() != null && price.compareTo(budget.min()) < 0) return false;
        if (budget.max() != null && price.compareTo(budget.max()) > 0) return false;
        return budget.min() != null || budget.max() != null;
    }

    private String classEvidenceText(PublicClassSource source) {
        List<String> values = new ArrayList<>();
        values.add(source.name());
        values.add(source.description());
        values.addAll(safeList(source.topicChips()));
        safeList(source.chapters()).forEach(chapter -> {
            values.add(chapter.title());
            values.add(chapter.description());
        });
        String evidence = values.stream().filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.joining(" "));
        return normalizeText(evidence);
    }

    private List<String> supportedPhrases(List<String> phrases, String evidenceText) {
        return safeList(phrases).stream()
                .filter(Objects::nonNull)
                .filter(phrase -> phraseSupported(phrase, evidenceText))
                .distinct()
                .toList();
    }

    private boolean phraseSupported(String phrase, String evidenceText) {
        String normalizedPhrase = normalizeText(phrase);
        return !normalizedPhrase.isBlank()
                && (" " + evidenceText + " ").contains(" " + normalizedPhrase + " ");
    }

    private String normalizeText(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replace('đ', 'd')
                .replaceAll("[^a-z0-9]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }

    private String quotedList(List<String> values, int limit) {
        return values.stream().limit(limit).map(value -> "“" + value + "”")
                .collect(java.util.stream.Collectors.joining(", "));
    }

    private String dayLabel(Integer day) {
        return Integer.valueOf(8).equals(day) ? "Chủ nhật" : "Thứ " + day;
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }

    private List<String> distinctLimited(List<String> values, int limit) {
        return values.stream().filter(Objects::nonNull).distinct().limit(limit).toList();
    }

    private ScoreComponent component(int weight, double normalizedScore, String policy) {
        double bounded = Math.max(0.0, Math.min(1.0, normalizedScore));
        BigDecimal weighted = BigDecimal.valueOf(weight)
                .multiply(BigDecimal.valueOf(bounded))
                .setScale(4, RoundingMode.HALF_UP);
        return new ScoreComponent(weight, round(bounded), weighted, policy);
    }

    private int percentage(BigDecimal score) {
        int value = score.setScale(0, RoundingMode.HALF_UP).intValue();
        return Math.max(0, Math.min(100, value));
    }

    private Integer normalizeDay(Integer day) {
        if (day == null) return null;
        return day == 1 ? 8 : day;
    }

    private LocalTime parseTime(String value) {
        try {
            return value == null || value.isBlank() ? null : LocalTime.parse(value.trim());
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private Comparator<ScoredClassMatch> structuredComparator() {
        return Comparator.comparing(ScoredClassMatch::structuredScore, Comparator.reverseOrder())
                .thenComparing(scored -> scored.result().startDate(), Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(scored -> scored.result().classId());
    }

    private Comparator<ScoredClassMatch> hybridComparator() {
        return Comparator.comparing(ScoredClassMatch::hybridScore, Comparator.reverseOrder())
                .thenComparing(scored -> scored.semanticSignal() == null ? -1.0 : scored.semanticSignal(), Comparator.reverseOrder())
                .thenComparing(scored -> scored.result().startDate(), Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(scored -> scored.result().classId());
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP).doubleValue();
    }

    private record SemanticCandidateRank(SemanticClassCandidate candidate, double normalizedSignal) {
    }

    private record MatchExplanation(List<String> matchingReasons, List<String> mismatchReasons) {
    }

    private record ScoredClassMatch(
            ClassMatchResult result,
            BigDecimal structuredScore,
            BigDecimal hybridScore,
            Double semanticSignal,
            BigDecimal semanticBoost
    ) {
    }
}
