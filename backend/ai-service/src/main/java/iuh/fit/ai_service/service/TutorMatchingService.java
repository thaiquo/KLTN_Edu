package iuh.fit.ai_service.service;

import iuh.fit.ai_service.client.TutorCandidateClient;
import iuh.fit.ai_service.dto.TutorMatchingDtos.AvailabilitySlot;
import iuh.fit.ai_service.dto.TutorMatchingDtos.CriterionScore;
import iuh.fit.ai_service.dto.TutorMatchingDtos.MatchedSubject;
import iuh.fit.ai_service.dto.TutorMatchingDtos.MatchingInputEcho;
import iuh.fit.ai_service.dto.TutorMatchingDtos.PreferredScheduleRequest;
import iuh.fit.ai_service.dto.TutorMatchingDtos.ScoreBreakdown;
import iuh.fit.ai_service.dto.TutorMatchingDtos.ScoreComponent;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SemanticScoreComponent;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SubjectCapability;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchResult;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingRequest;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingResponse;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchRequest;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchResult;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchStatus;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticTutorCandidate;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TutorMatchingService {
    private static final int SUBJECT_WEIGHT = 22;
    private static final int SCHEDULE_WEIGHT = 20;
    private static final int BUDGET_WEIGHT = 18;
    private static final int LOCATION_WEIGHT = 14;
    private static final int EXPERIENCE_WEIGHT = 16;
    private static final int RATING_WEIGHT = 12;
    private static final int SPECIALTY_WEIGHT = 34;
    private static final Pattern MIN_EXPERIENCE_PATTERN = Pattern.compile("\\b(?:tren|hon|tu|it nhat|toi thieu)\\s*(\\d{1,2})\\s*nam\\b");
    private static final Set<String> STOP_WORDS = Set.of(
            "toi", "em", "minh", "ban", "can", "muon", "tim", "gia", "su", "hoc", "day", "mon",
            "lop", "cap", "do", "va", "hoac", "de", "cho", "voi", "mot", "cac", "phan", "noi",
            "dung", "dang", "gap", "kho", "khan", "online", "offline", "truc", "tuyen", "tiep",
            "ngan", "sach", "buoi", "khoang", "uu", "tien", "co", "nhieu", "kinh", "nghiem"
    );
    private static final SemanticScoreComponent SEMANTIC_NOT_APPLIED = new SemanticScoreComponent(
            false,
            false,
            null,
            BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP),
            "Không có ngữ cảnh học tập đủ rõ để dùng truy hồi ngữ nghĩa; điểm được tính bằng các tiêu chí đã nêu."
    );

    private final TutorCandidateClient candidateClient;
    private final StudentSemanticSearchService semanticSearchService;
    private final HybridMatchingProperties hybridProperties;

    public TutorMatchingService(
            TutorCandidateClient candidateClient,
            StudentSemanticSearchService semanticSearchService,
            HybridMatchingProperties hybridProperties
    ) {
        this.candidateClient = candidateClient;
        this.semanticSearchService = semanticSearchService;
        this.hybridProperties = hybridProperties;
    }

    public TutorMatchingResponse match(TutorMatchingRequest request) {
        TutorMatchingRequest normalized = normalize(request);
        List<TutorCandidate> candidates = candidateClient.findCandidates(
                normalized.subjectId(),
                normalized.levelId(),
                normalized.teachingMode()
        );

        List<ScoredTutorMatch> structuredResults = candidates.stream()
                .map(candidate -> scoreCandidate(normalized, candidate))
                .flatMap(Optional::stream)
                .sorted(resultComparator())
                .toList();
        List<TutorMatchResult> results = applyHybridRanking(normalized, structuredResults).stream()
                .sorted(resultComparator())
                .map(ScoredTutorMatch::result)
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
                        normalized.learningGoal(),
                        normalized.weakTopics(),
                        normalized.tutorPreferences()
                ),
                candidates.size(),
                results.size(),
                List.of(),
                results
        );
    }

    private Optional<ScoredTutorMatch> scoreCandidate(TutorMatchingRequest request, TutorCandidate candidate) {
        Optional<SubjectCapability> matchedCapability = findMatchedCapability(request, candidate);
        if (matchedCapability.isEmpty() || !isEligible(request, candidate)) {
            return Optional.empty();
        }

        SubjectCapability capability = matchedCapability.get();
        List<String> missingData = new ArrayList<>();
        ScoringContext context = scoringContext(request);
        List<CriterionDraft> drafts = new ArrayList<>();
        drafts.add(new CriterionDraft(
                "subjectLevel",
                "Môn học và trình độ",
                subjectLevelRequested(request, capability),
                "Gia sư có hồ sơ được duyệt cho đúng môn và cấp độ đã chọn.",
                SUBJECT_WEIGHT,
                1.0,
                "MATCH",
                "Môn học, cấp độ và hình thức học là điều kiện lọc bắt buộc trước khi tính điểm."
        ));

        ScoreComponent schedule = inactiveComponent("Người học chưa nêu lịch học; lịch không tham gia mẫu số điểm.");
        if (hasSchedules(request)) {
            schedule = scheduleScore(request.preferredSchedules(), candidate.availability(), missingData);
            drafts.add(criterionFromComponent(
                    "schedule",
                    "Lịch học",
                    scheduleRequested(request.preferredSchedules()),
                    scheduleEvidence(schedule, candidate.availability()),
                    SCHEDULE_WEIGHT,
                    schedule
            ));
        }

        ScoreComponent budget = inactiveComponent("Người học chưa nêu ngân sách; học phí không tham gia mẫu số điểm.");
        if (hasBudget(request)) {
            budget = budgetScore(request.budgetMin(), request.budgetMax(), capability, missingData);
            drafts.add(criterionFromComponent(
                    "budget",
                    "Ngân sách",
                    budgetRequested(request.budgetMin(), request.budgetMax()),
                    budgetEvidence(capability),
                    BUDGET_WEIGHT,
                    budget
            ));
        }

        ScoreComponent location = inactiveComponent("Không có yêu cầu khu vực offline; vị trí không tham gia mẫu số điểm.");
        if (request.teachingMode() == TeachingMode.OFFLINE && StringUtils.hasText(request.provinceCode())) {
            location = locationScore(request, candidate, missingData);
            drafts.add(criterionFromComponent(
                    "location",
                    "Khu vực học trực tiếp",
                    locationRequested(request),
                    locationEvidence(candidate),
                    LOCATION_WEIGHT,
                    location
            ));
        }

        ScoreComponent experience = inactiveComponent("Người học chưa nêu yêu cầu kinh nghiệm; kinh nghiệm chỉ dùng để sắp xếp phụ.");
        if (context.minExperienceYears() != null) {
            experience = experienceScore(capability.experienceYears(), context.minExperienceYears(), missingData);
            drafts.add(criterionFromComponent(
                    "experience",
                    "Kinh nghiệm",
                    "Tối thiểu " + context.minExperienceYears() + " năm",
                    capability.experienceYears() == null ? "Gia sư chưa công bố số năm kinh nghiệm." : capability.experienceYears() + " năm kinh nghiệm",
                    EXPERIENCE_WEIGHT,
                    experience
            ));
        }

        ScoreComponent rating = inactiveComponent("Người học chưa nêu yêu cầu đánh giá; đánh giá chỉ dùng để sắp xếp phụ.");
        if (context.ratingRequested()) {
            rating = ratingScore(candidate.averageRating(), candidate.reviewCount(), missingData);
            drafts.add(criterionFromComponent(
                    "ratingConfidence",
                    "Độ tin cậy đánh giá",
                    "Ưu tiên hồ sơ có đánh giá tốt",
                    ratingEvidence(candidate),
                    RATING_WEIGHT,
                    rating
            ));
        }

        SpecialtyDraft specialty = SpecialtyDraft.inactive();
        if (context.hasSemanticContext()) {
            specialty = specialtyScore(context, capability, candidate, null);
            drafts.add(specialty.toCriterion(SPECIALTY_WEIGHT));
        }

        ScoreResult score = score(drafts);
        ScoreBreakdown breakdown = new ScoreBreakdown(
                dynamicComponent(schedule, score, "schedule"),
                dynamicComponent(budget, score, "budget"),
                dynamicComponent(location, score, "location"),
                dynamicComponent(experience, score, "experience"),
                dynamicComponent(rating, score, "ratingConfidence"),
                SEMANTIC_NOT_APPLIED,
                score.rawScore(),
                score.weights(),
                score.criteria(),
                score.totalWeight()
        );

        TutorMatchResult result = new TutorMatchResult(
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
                score.matchPercentage(),
                breakdown,
                matchingReasons(score.criteria()),
                mismatchReasons(score.criteria()),
                List.copyOf(missingData),
                List.of()
        );
        return Optional.of(new ScoredTutorMatch(
                result,
                score.rawScore(),
                score.rawScore(),
                specialty.normalizedSignal(),
                BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP)
        ));
    }

    private List<ScoredTutorMatch> applyHybridRanking(TutorMatchingRequest request, List<ScoredTutorMatch> structuredResults) {
        if (structuredResults.isEmpty()
                || !hybridProperties.semanticMatchingEnabled()
                || !scoringContext(request).hasSemanticContext()) {
            return structuredResults;
        }

        SemanticSearchResult semanticResult;
        try {
            semanticResult = semanticSearchService.search(toSemanticRequest(request, structuredResults));
        } catch (RuntimeException exception) {
            return structuredResults;
        }
        if (semanticResult == null
                || semanticResult.status() != SemanticSearchStatus.APPLICABLE
                || semanticResult.candidates() == null
                || semanticResult.candidates().isEmpty()) {
            return structuredResults;
        }

        Map<Long, SemanticCandidateRank> semanticByTutorId = semanticRanks(semanticResult.candidates());
        return structuredResults.stream()
                .map(result -> applySemanticEvidence(result, semanticByTutorId.get(result.result().tutorId())))
                .toList();
    }

    private SemanticSearchRequest toSemanticRequest(TutorMatchingRequest request, List<ScoredTutorMatch> structuredResults) {
        MatchedSubject matchedSubject = structuredResults.getFirst().result().matchedSubject();
        return new SemanticSearchRequest(
                request.subjectId(),
                matchedSubject == null ? null : matchedSubject.subjectName(),
                request.levelId(),
                matchedSubject == null ? null : matchedSubject.levelName(),
                request.teachingMode(),
                request.learningGoal(),
                request.weakTopics(),
                request.tutorPreferences(),
                null
        );
    }

    private Map<Long, SemanticCandidateRank> semanticRanks(List<SemanticTutorCandidate> candidates) {
        Map<Long, SemanticCandidateRank> ranks = new LinkedHashMap<>();
        int count = candidates.size();
        for (int index = 0; index < count; index++) {
            SemanticTutorCandidate candidate = candidates.get(index);
            if (candidate.tutorId() == null) {
                continue;
            }
            double normalizedRank = count <= 1 ? 1.0 : 1.0 - (index / (double) (count - 1));
            ranks.putIfAbsent(candidate.tutorId(), new SemanticCandidateRank(candidate, round(normalizedRank)));
        }
        return ranks;
    }

    private ScoredTutorMatch applySemanticEvidence(ScoredTutorMatch scored, SemanticCandidateRank semanticRank) {
        TutorMatchResult current = scored.result();
        ScoreBreakdown currentBreakdown = current.scoreBreakdown();
        List<CriterionDraft> drafts = currentBreakdown.criteria().stream()
                .map(CriterionDraft::fromScore)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        int specialtyIndex = indexOfCriterion(drafts, "specialty");
        if (specialtyIndex < 0) {
            return scored;
        }

        SemanticScoreComponent semantic;
        Double semanticSignal = null;
        if (semanticRank == null) {
            semantic = new SemanticScoreComponent(
                    true,
                    false,
                    null,
                    BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP),
                    "Không có vector ngữ nghĩa đã xác thực cho gia sư này; giữ điểm theo bằng chứng hồ sơ."
            );
        } else {
            semanticSignal = semanticRank.normalizedSignal();
            CriterionDraft currentSpecialty = drafts.get(specialtyIndex);
            double semanticScore = clamp(0.82 + (semanticSignal * 0.18));
            double nextScore = Math.max(currentSpecialty.normalizedScore(), semanticScore);
            drafts.set(specialtyIndex, new CriterionDraft(
                    currentSpecialty.criterion(),
                    currentSpecialty.label(),
                    currentSpecialty.requested(),
                    "Truy hồi ngữ nghĩa xác nhận hồ sơ có nội dung gần với mục tiêu học tập đã nêu.",
                    currentSpecialty.baseWeight(),
                    nextScore,
                    statusFor(nextScore),
                    "Ngữ nghĩa được dùng làm bằng chứng cho tiêu chí mục tiêu/chủ đề yếu, không cộng như một phần trăm riêng biệt."
            ));
            semantic = new SemanticScoreComponent(
                    true,
                    true,
                    semanticSignal,
                    BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP),
                    "Truy hồi ngữ nghĩa được dùng làm bằng chứng trong tiêu chí đang xét, không phải điểm cộng ẩn vào kết quả cuối."
            );
        }

        ScoreResult score = score(drafts);
        ScoreBreakdown breakdown = new ScoreBreakdown(
                rebuildComponent(currentBreakdown.schedule(), score, "schedule"),
                rebuildComponent(currentBreakdown.budget(), score, "budget"),
                rebuildComponent(currentBreakdown.location(), score, "location"),
                rebuildComponent(currentBreakdown.experience(), score, "experience"),
                rebuildComponent(currentBreakdown.ratingConfidence(), score, "ratingConfidence"),
                semantic,
                score.rawScore(),
                score.weights(),
                score.criteria(),
                score.totalWeight()
        );
        TutorMatchResult updated = new TutorMatchResult(
                current.tutorId(),
                current.userId(),
                current.fullName(),
                current.avatarUrl(),
                current.bio(),
                current.location(),
                current.teachingModes(),
                current.matchedSubject(),
                current.startingTuition(),
                current.availability(),
                current.averageRating(),
                current.reviewCount(),
                current.publishedClassCount(),
                score.matchPercentage(),
                breakdown,
                matchingReasons(score.criteria()),
                mismatchReasons(score.criteria()),
                current.missingData(),
                current.relaxedCriteria()
        );
        return new ScoredTutorMatch(updated, score.rawScore(), score.rawScore(), semanticSignal, BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
    }

    private int indexOfCriterion(List<CriterionDraft> drafts, String criterion) {
        for (int index = 0; index < drafts.size(); index++) {
            if (criterion.equals(drafts.get(index).criterion())) {
                return index;
            }
        }
        return -1;
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
        if (capability.tuitionMin() == null || capability.tuitionMax() == null) {
            policy = "Gia sư chưa công bố học phí cho môn này; dùng điểm thấp có kiểm soát.";
            missingData.add("tutorTuition");
        } else if (score >= 0.95) {
            policy = "Khoảng học phí của gia sư giao với ngân sách đã nêu.";
        } else if (score >= 0.55) {
            policy = "Học phí của gia sư gần với ngân sách nhưng chưa khớp hoàn toàn.";
        } else {
            policy = "Học phí của gia sư nằm xa ngân sách đã nêu.";
        }
        return component(BUDGET_WEIGHT, score, policy);
    }

    private double budgetScoreValue(BigDecimal budgetMin, BigDecimal budgetMax, SubjectCapability capability) {
        if (budgetMin == null && budgetMax == null) {
            return 1.0;
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
        if (availability == null || availability.isEmpty()) {
            missingData.add("tutorAvailability");
            return component(SCHEDULE_WEIGHT, 0.35, "Gia sư chưa công bố lịch rảnh; điểm lịch được giữ thấp có kiểm soát.");
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
                ? "Lịch rảnh của gia sư bao phủ các khung giờ đã nêu."
                : score > 0.0
                ? "Lịch rảnh của gia sư trùng một phần với các khung giờ đã nêu."
                : "Lịch rảnh của gia sư chưa trùng khung giờ đã nêu.";
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
        if (candidate.location() == null || !StringUtils.hasText(candidate.location().provinceCode())) {
            missingData.add("tutorLocation");
            return component(LOCATION_WEIGHT, 0.40, "Gia sư chưa công bố khu vực an toàn.");
        }
        boolean sameProvince = request.provinceCode().equalsIgnoreCase(candidate.location().provinceCode());
        boolean requestedCommune = StringUtils.hasText(request.communeCode());
        boolean sameCommune = requestedCommune
                && StringUtils.hasText(candidate.location().communeCode())
                && request.communeCode().equalsIgnoreCase(candidate.location().communeCode());
        if (sameCommune) {
            return component(LOCATION_WEIGHT, 1.0, "Gia sư ở đúng phường/xã đã nêu.");
        }
        if (sameProvince) {
            return component(LOCATION_WEIGHT, requestedCommune ? 0.75 : 0.85, "Gia sư ở đúng tỉnh/thành đã nêu.");
        }
        return component(LOCATION_WEIGHT, 0.15, "Gia sư ở ngoài tỉnh/thành đã nêu.");
    }

    private ScoreComponent experienceScore(Integer experienceYears, int minExperienceYears, List<String> missingData) {
        if (experienceYears == null) {
            missingData.add("experienceYears");
            return component(EXPERIENCE_WEIGHT, 0.50, "Gia sư chưa công bố số năm kinh nghiệm.");
        }
        double score = minExperienceYears <= 0 ? 1.0 : clamp(experienceYears / (double) minExperienceYears);
        String policy = experienceYears >= minExperienceYears
                ? "Gia sư đáp ứng yêu cầu số năm kinh nghiệm."
                : "Gia sư có ít kinh nghiệm hơn mức người học mong muốn.";
        return component(EXPERIENCE_WEIGHT, score, policy);
    }

    private ScoreComponent ratingScore(Double averageRating, Long reviewCount, List<String> missingData) {
        long reviews = reviewCount == null ? 0 : reviewCount;
        if (reviews <= 0 || averageRating == null || averageRating <= 0.0) {
            missingData.add("reviews");
            return component(RATING_WEIGHT, 0.58, "Chưa có đánh giá; không coi đây là tín hiệu xấu tuyệt đối.");
        }
        double priorRating = 4.2;
        double priorWeight = 5.0;
        double adjusted = ((averageRating * reviews) + (priorRating * priorWeight)) / (reviews + priorWeight);
        double score = clamp((adjusted - 3.0) / 2.0);
        return component(RATING_WEIGHT, score, "Điểm đánh giá được hiệu chỉnh theo số lượng review để tránh phóng đại hồ sơ ít dữ liệu.");
    }

    private SpecialtyDraft specialtyScore(ScoringContext context, SubjectCapability capability, TutorCandidate candidate,
                                         SemanticCandidateRank semanticRank) {
        String query = normalize(context.semanticText());
        String evidenceText = normalize(String.join(" ",
                nullToEmpty(capability.description()),
                nullToEmpty(capability.subjectName()),
                nullToEmpty(capability.categoryName()),
                nullToEmpty(candidate.bio()),
                nullToEmpty(candidate.fullName())
        ));
        if (!StringUtils.hasText(query)) {
            return SpecialtyDraft.inactive();
        }

        double lexicalScore = lexicalSpecialtyScore(query, evidenceText);
        double score = lexicalScore;
        Double semanticSignal = null;
        String evidence = lexicalEvidence(lexicalScore);
        String policy = "So khớp mục tiêu/chủ đề yếu với mô tả hồ sơ gia sư.";
        if (semanticRank != null) {
            semanticSignal = semanticRank.normalizedSignal();
            score = Math.max(score, clamp(0.82 + semanticSignal * 0.18));
            evidence = "Truy hồi ngữ nghĩa xác nhận hồ sơ có nội dung gần với mục tiêu học tập đã nêu.";
            policy = "Ngữ nghĩa được dùng làm bằng chứng cho tiêu chí mục tiêu/chủ đề yếu, không cộng như một phần trăm riêng biệt.";
        }
        return new SpecialtyDraft(
                context.semanticText(),
                evidence,
                score,
                statusFor(score),
                policy,
                semanticSignal
        );
    }

    private double lexicalSpecialtyScore(String query, String evidenceText) {
        List<String> terms = significantTerms(query);
        if (terms.isEmpty() || !StringUtils.hasText(evidenceText)) {
            return 0.55;
        }
        long matched = terms.stream().filter(evidenceText::contains).count();
        if (matched == 0) {
            return 0.55;
        }
        double ratio = matched / (double) terms.size();
        if (ratio >= 0.60) {
            return 0.92;
        }
        return clamp(0.62 + ratio * 0.28);
    }

    private List<String> significantTerms(String value) {
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        for (String token : normalize(value).split("[^a-z0-9]+")) {
            if (token.length() >= 3 && !STOP_WORDS.contains(token)) {
                terms.add(token);
            }
        }
        return List.copyOf(terms);
    }

    private ScoreResult score(List<CriterionDraft> drafts) {
        int totalBase = drafts.stream().mapToInt(CriterionDraft::baseWeight).sum();
        if (totalBase <= 0) {
            totalBase = 1;
        }
        List<CriterionScore> criteria = new ArrayList<>();
        Map<String, Integer> weights = new LinkedHashMap<>();
        BigDecimal raw = BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        int assignedWeight = 0;
        for (int index = 0; index < drafts.size(); index++) {
            CriterionDraft draft = drafts.get(index);
            int weight = index == drafts.size() - 1
                    ? 100 - assignedWeight
                    : BigDecimal.valueOf(draft.baseWeight())
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(totalBase), 0, RoundingMode.HALF_UP)
                    .intValue();
            assignedWeight += weight;
            BigDecimal contribution = BigDecimal.valueOf(clamp(draft.normalizedScore()))
                    .multiply(BigDecimal.valueOf(weight))
                    .setScale(4, RoundingMode.HALF_UP);
            raw = raw.add(contribution).setScale(4, RoundingMode.HALF_UP);
            weights.put(draft.criterion(), weight);
            criteria.add(new CriterionScore(
                    draft.criterion(),
                    draft.label(),
                    draft.requested(),
                    draft.evidence(),
                    weight,
                    round(draft.normalizedScore()),
                    contribution,
                    draft.status(),
                    draft.policy()
            ));
        }
        int matchPercentage = raw.setScale(0, RoundingMode.HALF_UP).intValue();
        return new ScoreResult(
                raw,
                Math.max(0, Math.min(100, matchPercentage)),
                new LinkedHashMap<>(weights),
                List.copyOf(criteria),
                BigDecimal.valueOf(totalBase).setScale(4, RoundingMode.HALF_UP)
        );
    }

    private CriterionDraft criterionFromComponent(String criterion, String label, String requested, String evidence,
                                                  int baseWeight, ScoreComponent component) {
        return new CriterionDraft(
                criterion,
                label,
                requested,
                evidence,
                baseWeight,
                component.normalizedScore(),
                statusFor(component.normalizedScore()),
                component.policy()
        );
    }

    private ScoreComponent dynamicComponent(ScoreComponent original, ScoreResult score, String criterion) {
        return rebuildComponent(original, score, criterion);
    }

    private ScoreComponent rebuildComponent(ScoreComponent original, ScoreResult score, String criterion) {
        CriterionScore criterionScore = score.criteria().stream()
                .filter(item -> criterion.equals(item.criterion()))
                .findFirst()
                .orElse(null);
        if (criterionScore == null) {
            return original;
        }
        return new ScoreComponent(
                criterionScore.weight(),
                criterionScore.normalizedScore(),
                criterionScore.contribution(),
                original.policy()
        );
    }

    private ScoreComponent inactiveComponent(String policy) {
        return new ScoreComponent(0, 1.0, BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP), policy);
    }

    private ScoreComponent component(int weight, double normalizedScore, String policy) {
        double clamped = clamp(normalizedScore);
        BigDecimal weighted = BigDecimal.valueOf(clamped)
                .multiply(BigDecimal.valueOf(weight))
                .setScale(4, RoundingMode.HALF_UP);
        return new ScoreComponent(weight, round(clamped), weighted, policy);
    }

    private List<String> matchingReasons(List<CriterionScore> criteria) {
        List<String> reasons = new ArrayList<>();
        for (CriterionScore criterion : criteria) {
            if ("MATCH".equals(criterion.status())) {
                reasons.add(matchReason(criterion));
            } else if ("PARTIAL".equals(criterion.status())) {
                reasons.add(partialReason(criterion));
            }
        }
        return reasons.stream().filter(StringUtils::hasText).distinct().toList();
    }

    private List<String> mismatchReasons(List<CriterionScore> criteria) {
        List<String> reasons = new ArrayList<>();
        for (CriterionScore criterion : criteria) {
            if ("MISMATCH".equals(criterion.status()) || "UNKNOWN".equals(criterion.status()) || "PARTIAL".equals(criterion.status())) {
                reasons.add(mismatchReason(criterion));
            }
        }
        return reasons.stream().filter(StringUtils::hasText).distinct().toList();
    }

    private String matchReason(CriterionScore criterion) {
        return switch (criterion.criterion()) {
            case "subjectLevel" -> "Dạy đúng môn và cấp độ học đã chọn.";
            case "schedule" -> "Lịch dạy phù hợp với thời gian bạn mong muốn.";
            case "budget" -> "Mức nhận dạy nằm trong khoảng ngân sách.";
            case "location" -> "Phù hợp khu vực học trực tiếp.";
            case "experience" -> "Đáp ứng yêu cầu kinh nghiệm bạn đã nêu.";
            case "ratingConfidence" -> "Có đánh giá tích cực từ học viên.";
            case "specialty" -> "Hồ sơ có tín hiệu phù hợp với mục tiêu hoặc phần bạn muốn cải thiện.";
            default -> criterion.evidence();
        };
    }

    private String partialReason(CriterionScore criterion) {
        return switch (criterion.criterion()) {
            case "schedule" -> "Có một phần lịch dạy trùng với thời gian bạn mong muốn.";
            case "budget" -> "Mức nhận dạy gần với khoảng ngân sách.";
            case "location" -> "Khu vực học trực tiếp gần đúng nhưng chưa khớp hoàn toàn.";
            case "experience" -> "Kinh nghiệm gần với mức bạn mong muốn.";
            case "ratingConfidence" -> "Đánh giá hiện có là tín hiệu tham khảo.";
            case "specialty" -> "Hồ sơ có một phần nội dung gần với mục tiêu học tập.";
            default -> criterion.evidence();
        };
    }

    private String mismatchReason(CriterionScore criterion) {
        return switch (criterion.criterion()) {
            case "schedule" -> "Lịch rảnh chưa khớp hoàn toàn với thời gian bạn đã nêu.";
            case "budget" -> "Học phí chưa khớp hoàn toàn với ngân sách đã nêu.";
            case "location" -> "Khu vực học trực tiếp chưa khớp hoàn toàn.";
            case "experience" -> "Kinh nghiệm chưa đạt mức bạn mong muốn.";
            case "ratingConfidence" -> "Dữ liệu đánh giá còn hạn chế.";
            case "specialty" -> "Bằng chứng về mục tiêu/chủ đề yếu trong hồ sơ còn hạn chế.";
            default -> null;
        };
    }

    private String statusFor(double score) {
        if (score >= 0.85) {
            return "MATCH";
        }
        if (score >= 0.60) {
            return "PARTIAL";
        }
        if (score >= 0.45) {
            return "UNKNOWN";
        }
        return "MISMATCH";
    }

    private ScoringContext scoringContext(TutorMatchingRequest request) {
        String semanticText = String.join(" ",
                nullToEmpty(request.learningGoal()),
                String.join(" ", safeList(request.weakTopics())),
                String.join(" ", safeList(request.tutorPreferences()))
        ).trim();
        String allText = normalize(semanticText);
        Integer minExperience = null;
        Matcher matcher = MIN_EXPERIENCE_PATTERN.matcher(allText);
        if (matcher.find()) {
            minExperience = Integer.valueOf(matcher.group(1));
        }
        boolean ratingRequested = allText.contains("danh gia")
                || allText.contains("review")
                || allText.contains("uy tin")
                || allText.contains("sao");
        return new ScoringContext(semanticText, StringUtils.hasText(semanticText), minExperience, ratingRequested);
    }

    private boolean hasBudget(TutorMatchingRequest request) {
        return request.budgetMin() != null || request.budgetMax() != null;
    }

    private boolean hasSchedules(TutorMatchingRequest request) {
        return request.preferredSchedules() != null && !request.preferredSchedules().isEmpty();
    }

    private String subjectLevelRequested(TutorMatchingRequest request, SubjectCapability capability) {
        String level = capability.levels() == null ? null : capability.levels().stream()
                .filter(item -> request.levelId().equals(item.levelId()))
                .map(item -> item.levelName())
                .findFirst()
                .orElse(null);
        return List.of(nullToEmpty(capability.subjectName()), nullToEmpty(level)).stream()
                .filter(StringUtils::hasText)
                .reduce((left, right) -> left + " - " + right)
                .orElse("Môn và cấp độ đã chọn");
    }

    private String scheduleRequested(List<PreferredScheduleRequest> schedules) {
        return safeList(schedules).stream()
                .map(slot -> "Thứ " + slot.dayOfWeek() + " " + slot.startTime() + "-" + slot.endTime())
                .reduce((left, right) -> left + "; " + right)
                .orElse("Lịch học đã nêu");
    }

    private String scheduleEvidence(ScoreComponent schedule, List<AvailabilitySlot> availability) {
        int count = availability == null ? 0 : availability.size();
        if (schedule.normalizedScore() >= 0.95) {
            return "Có lịch rảnh bao phủ khung giờ đã nêu.";
        }
        if (schedule.normalizedScore() > 0.0) {
            return "Có " + count + " khung giờ rảnh, trùng một phần với yêu cầu.";
        }
        return "Có " + count + " khung giờ rảnh nhưng chưa trùng yêu cầu.";
    }

    private String budgetRequested(BigDecimal budgetMin, BigDecimal budgetMax) {
        if (budgetMin != null && budgetMax != null && budgetMin.compareTo(budgetMax) != 0) {
            return money(budgetMin) + " - " + money(budgetMax) + "/buổi";
        }
        BigDecimal value = budgetMax == null ? budgetMin : budgetMax;
        return value == null ? "Ngân sách đã nêu" : "Tối đa khoảng " + money(value) + "/buổi";
    }

    private String budgetEvidence(SubjectCapability capability) {
        if (capability.tuitionMin() == null && capability.tuitionMax() == null) {
            return "Gia sư chưa công bố học phí.";
        }
        if (capability.tuitionMin() != null && capability.tuitionMax() != null) {
            return money(capability.tuitionMin()) + " - " + money(capability.tuitionMax()) + "/buổi";
        }
        BigDecimal value = capability.tuitionMin() == null ? capability.tuitionMax() : capability.tuitionMin();
        return money(value) + "/buổi";
    }

    private String locationRequested(TutorMatchingRequest request) {
        return StringUtils.hasText(request.communeCode())
                ? request.provinceCode() + " / " + request.communeCode()
                : request.provinceCode();
    }

    private String locationEvidence(TutorCandidate candidate) {
        if (candidate.location() == null) {
            return "Gia sư chưa công bố khu vực.";
        }
        return List.of(nullToEmpty(candidate.location().communeName()), nullToEmpty(candidate.location().provinceName())).stream()
                .filter(StringUtils::hasText)
                .reduce((left, right) -> left + ", " + right)
                .orElse(nullToEmpty(candidate.location().provinceCode()));
    }

    private String ratingEvidence(TutorCandidate candidate) {
        return safeRating(candidate.averageRating()) + "/5 từ " + safeReviewCount(candidate.reviewCount()) + " đánh giá";
    }

    private String lexicalEvidence(double lexicalScore) {
        if (lexicalScore >= 0.85) {
            return "Mô tả hồ sơ có nhiều nội dung phù hợp với mục tiêu học tập.";
        }
        if (lexicalScore >= 0.60) {
            return "Mô tả hồ sơ có một phần nội dung gần với mục tiêu học tập.";
        }
        return "Chưa thấy nhiều bằng chứng trực tiếp trong mô tả hồ sơ.";
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
                trimToNull(request.learningGoal()),
                cleanTextList(request.weakTopics()),
                cleanTextList(request.tutorPreferences())
        );
    }

    private Comparator<ScoredTutorMatch> resultComparator() {
        return Comparator
                .comparing(ScoredTutorMatch::hybridScore, Comparator.reverseOrder())
                .thenComparing(ScoredTutorMatch::structuredScore, Comparator.reverseOrder())
                .thenComparing(scored -> scored.semanticSignal() == null ? -1.0 : scored.semanticSignal(), Comparator.reverseOrder())
                .thenComparing(scored -> scored.result().averageRating() == null ? 0.0 : scored.result().averageRating(), Comparator.reverseOrder())
                .thenComparing(scored -> scored.result().reviewCount() == null ? 0L : scored.result().reviewCount(), Comparator.reverseOrder())
                .thenComparing(scored -> scored.result().tutorId(), Comparator.nullsLast(Long::compareTo));
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

    private List<String> cleanTextList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();
    }

    private <T> List<T> safeList(Iterable<T> values) {
        if (values == null) {
            return List.of();
        }
        ArrayList<T> copy = new ArrayList<>();
        values.forEach(copy::add);
        return List.copyOf(copy);
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

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String noAccent = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return noAccent.toLowerCase(Locale.ROOT)
                .replace("đ", "d")
                .replace("Đ", "d")
                .trim();
    }

    private String money(BigDecimal value) {
        if (value == null) {
            return "";
        }
        return value.setScale(0, RoundingMode.HALF_UP).toPlainString() + "đ";
    }

    private record ScoredTutorMatch(
            TutorMatchResult result,
            BigDecimal structuredScore,
            BigDecimal hybridScore,
            Double semanticSignal,
            BigDecimal semanticBoost
    ) {
    }

    private record SemanticCandidateRank(SemanticTutorCandidate candidate, double normalizedSignal) {
    }

    private record ScoringContext(
            String semanticText,
            boolean hasSemanticContext,
            Integer minExperienceYears,
            boolean ratingRequested
    ) {
    }

    private record CriterionDraft(
            String criterion,
            String label,
            String requested,
            String evidence,
            int baseWeight,
            double normalizedScore,
            String status,
            String policy
    ) {
        private static CriterionDraft fromScore(CriterionScore score) {
            return new CriterionDraft(
                    score.criterion(),
                    score.label(),
                    score.requested(),
                    score.evidence(),
                    score.weight(),
                    score.normalizedScore(),
                    score.status(),
                    score.policy()
            );
        }
    }

    private record SpecialtyDraft(
            String requested,
            String evidence,
            double normalizedScore,
            String status,
            String policy,
            Double normalizedSignal
    ) {
        private CriterionDraft toCriterion(int weight) {
            return new CriterionDraft(
                    "specialty",
                    "Mục tiêu và chủ đề cần cải thiện",
                    requested,
                    evidence,
                    weight,
                    normalizedScore,
                    status,
                    policy
            );
        }

        private static SpecialtyDraft inactive() {
            return new SpecialtyDraft(null, null, 1.0, "MATCH", "", null);
        }
    }

    private record ScoreResult(
            BigDecimal rawScore,
            int matchPercentage,
            Map<String, Integer> weights,
            List<CriterionScore> criteria,
            BigDecimal totalWeight
    ) {
    }
}
