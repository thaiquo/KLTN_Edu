package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.model.ChatTool;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.AnalyzeRequirementRequest;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.AnalyzeRequirementResponse;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ExtractedRequirement;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ExtractionStatus;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.Clarification;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundRequirementRequest;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundRequirementResponse;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundedRequirement;
import iuh.fit.ai_service.dto.TutorMatchingDtos.MatchedSubject;
import iuh.fit.ai_service.dto.TutorMatchingDtos.PreferredScheduleRequest;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchResult;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingRequest;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingResponse;
import iuh.fit.ai_service.service.CatalogGroundingService;
import iuh.fit.ai_service.service.NaturalLanguageRequirementAnalyzer;
import iuh.fit.ai_service.service.TutorMatchingService;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class ChatTutorMatchingAdapter {
    private static final int DEFAULT_LIMIT = 3;
    private static final int MAX_LIMIT = 5;
    private static final Pattern LEVEL_HINT = Pattern.compile("\\blop\\s*(\\d{1,2})\\b");
    private static final Pattern MIN_EXPERIENCE_HINT = Pattern.compile("\\b(?:tren|hon|tu)\\s*(\\d{1,2})\\s*nam\\b");

    private final NaturalLanguageRequirementAnalyzer analyzer;
    private final CatalogGroundingService groundingService;
    private final TutorMatchingService matchingService;
    private final ChatToolRegistry toolRegistry;
    private final RoleToolAuthorizer authorizer;
    private final ChatCatalogHintResolver catalogHintResolver;

    public ChatTutorMatchingAdapter(
            NaturalLanguageRequirementAnalyzer analyzer,
            CatalogGroundingService groundingService,
            TutorMatchingService matchingService,
            ChatToolRegistry toolRegistry,
            RoleToolAuthorizer authorizer,
            ChatCatalogHintResolver catalogHintResolver
    ) {
        this.analyzer = analyzer;
        this.groundingService = groundingService;
        this.matchingService = matchingService;
        this.toolRegistry = toolRegistry;
        this.authorizer = authorizer;
        this.catalogHintResolver = catalogHintResolver;
    }

    public ChatMatchingResult match(String message, AiUserContext userContext) {
        if (!authorizer.isAllowed(userContext, ChatTool.TUTOR_MATCHING_PUBLIC)) {
            return new ChatMatchingResult("Bạn chưa có quyền dùng công cụ tìm gia sư trong trợ lý.", List.of(), null);
        }
        try {
            AnalyzeRequirementResponse analysis = enrichAnalysisFromMessage(
                    analyzeOrFallback(message),
                    message
            );
            if (analysis.status() == ExtractionStatus.INVALID || analysis.requirement() == null) {
                return clarify("Bạn muốn tìm gia sư môn nào, trình độ nào và học online hay trực tiếp?");
            }

            ChatMatchingResult broadSubjectMatch = broadSubjectMatch(analysis.requirement(), message);
            if (broadSubjectMatch != null) {
                return broadSubjectMatch;
            }

            ChatMatchingResult missingCore = clarifyMissingCoreFields(analysis.requirement());
            if (missingCore != null) {
                return missingCore;
            }

            GroundRequirementResponse grounding = groundingService.ground(new GroundRequirementRequest(analysis.requirement()));
            if (!grounding.coreMatchingReady() || grounding.requirement() == null) {
                return clarify(firstBlockingQuestion(
                        grounding.clarifications(),
                        "Bạn bổ sung giúp tôi môn học, trình độ và hình thức học để tìm gia sư phù hợp nhé."
                ));
            }

            TutorMatchingResponse response = matchingService.match(toMatchingRequest(grounding.requirement()));
            List<Map<String, Object>> items = response.results().stream()
                    .limit(DEFAULT_LIMIT)
                    .map(this::toPublicItem)
                    .toList();
            return new ChatMatchingResult(
                    items.isEmpty()
                            ? "Tôi chưa tìm thấy gia sư phù hợp với nhu cầu này. Bạn có thể nới ngân sách, lịch học hoặc thử mô tả khác."
                            : "Tôi tìm được một vài gia sư phù hợp nhất theo nhu cầu của bạn.",
                    List.of(),
                    toolResult("TUTOR_MATCHES", items, response.totalCandidates(), response.eligibleCandidates(), response.relaxedCriteria(), null)
            );
        } catch (RuntimeException exception) {
            return new ChatMatchingResult(
                    "Hiện tôi chưa thể chạy tìm gia sư bằng AI. Bạn có thể thử lại sau ít phút hoặc mở trang Tìm gia sư.",
                    toolRegistry.publicNavigationActions(userContext, "gia sư"),
                    null
            );
        }
    }

    private AnalyzeRequirementResponse analyzeOrFallback(String message) {
        try {
            return analyzer.analyze(new AnalyzeRequirementRequest(message));
        } catch (RuntimeException exception) {
            return new AnalyzeRequirementResponse(ExtractionStatus.NEEDS_CLARIFICATION, null, List.of(), List.of());
        }
    }

    private ChatMatchingResult clarify(String question) {
        return new ChatMatchingResult(question, List.of(), Map.of(
                "type", "TUTOR_MATCHES",
                "items", List.of()
        ));
    }

    private ChatMatchingResult clarifyMissingCoreFields(ExtractedRequirement requirement) {
        if (requirement == null || !hasText(requirement.subjectHint())) {
            return null;
        }
        if (!hasText(requirement.levelHint())) {
            return clarify("Bạn đang muốn học ở cấp độ nào?");
        }
        if (requirement.teachingMode() == null) {
            return clarify("Bạn muốn học trực tuyến hay trực tiếp?");
        }
        return null;
    }

    private ChatMatchingResult broadSubjectMatch(ExtractedRequirement requirement, String message) {
        if (requirement == null || !hasText(requirement.subjectHint())) {
            return null;
        }
        Optional<ChatCatalogHintResolver.SubjectHint> subjectHint = catalogHintResolver.subjectHint(
                requirement.subjectHint() + " " + nullToEmpty(requirement.levelHint())
        );
        if (subjectHint.isEmpty()) {
            subjectHint = catalogHintResolver.subjectHint(message);
        }
        if (subjectHint.isEmpty() || subjectHint.get().id() == null || subjectHint.get().levels().isEmpty()) {
            return null;
        }
        List<ChatCatalogHintResolver.LevelHint> levels = levelsForBroadMatch(subjectHint.get(), requirement.levelHint(), message);
        if (levels.isEmpty()) {
            return null;
        }
        List<TeachingMode> modes = acceptsBothTeachingModes(message)
                ? List.of(TeachingMode.ONLINE, TeachingMode.OFFLINE)
                : requirement.teachingMode() == null
                ? List.of(TeachingMode.ONLINE, TeachingMode.OFFLINE)
                : List.of(requirement.teachingMode());

        Map<Long, TutorMatchResult> bestByTutorId = new LinkedHashMap<>();
        int totalCandidates = 0;
        int eligibleCandidates = 0;
        for (ChatCatalogHintResolver.LevelHint level : levels) {
            for (TeachingMode mode : modes) {
                TutorMatchingResponse response = matchingService.match(toBroadMatchingRequest(subjectHint.get(), level, mode, requirement));
                totalCandidates += response.totalCandidates();
                eligibleCandidates += response.eligibleCandidates();
                for (TutorMatchResult result : safeList(response.results())) {
                    if (result.tutorId() == null) {
                        continue;
                    }
                    TutorMatchResult current = bestByTutorId.get(result.tutorId());
                    if (current == null || result.matchPercentage() > current.matchPercentage()) {
                        bestByTutorId.put(result.tutorId(), result);
                    }
                }
            }
        }

        List<Map<String, Object>> items = bestByTutorId.values().stream()
                .sorted(Comparator
                        .comparing(TutorMatchResult::matchPercentage).reversed()
                        .thenComparing(result -> result.averageRating() == null ? 0.0 : result.averageRating(), Comparator.reverseOrder())
                        .thenComparing(TutorMatchResult::tutorId))
                .limit(DEFAULT_LIMIT)
                .map(this::toPublicItem)
                .toList();
        String responseMessage = items.isEmpty()
                ? "Tôi chưa tìm thấy gia sư phù hợp với môn " + subjectHint.get().name() + ". Bạn có thể bổ sung cấp độ, hình thức học hoặc thử môn khác."
                : "Tôi tìm được một vài gia sư phù hợp nhất cho môn " + subjectHint.get().name() + ".";
        return new ChatMatchingResult(
                responseMessage,
                List.of(),
                toolResult("TUTOR_MATCHES", items, totalCandidates, eligibleCandidates, List.of(), "BROAD_SUBJECT")
        );
    }

    private List<ChatCatalogHintResolver.LevelHint> levelsForBroadMatch(
            ChatCatalogHintResolver.SubjectHint subjectHint,
            String levelHint,
            String message
    ) {
        if (!hasText(levelHint)) {
            return subjectHint.levels();
        }
        String normalizedLevel = normalize(levelHint);
        List<ChatCatalogHintResolver.LevelHint> levels = subjectHint.levels().stream()
                .filter(level -> normalize(level.name()).equals(normalizedLevel)
                        || normalize(level.code()).equals(normalizedLevel)
                        || normalize(level.name()).contains(normalizedLevel)
                        || normalizedLevel.contains(normalize(level.name()))
                        || sameNumericLevel(normalizedLevel, level))
                .toList();
        if (!levels.isEmpty() || !hasText(message)) {
            return levels;
        }
        String normalizedMessage = normalize(message);
        return subjectHint.levels().stream()
                .filter(level -> normalize(level.name()).equals(normalizedMessage)
                        || normalize(level.code()).equals(normalizedMessage)
                        || normalizedMessage.contains(normalize(level.name()))
                        || normalizedMessage.contains(normalize(level.code()))
                        || sameNumericLevel(normalizedMessage, level))
                .toList();
    }

    private boolean sameNumericLevel(String normalizedLevel, ChatCatalogHintResolver.LevelHint level) {
        Matcher requested = Pattern.compile("\\b(\\d{1,2})\\b").matcher(normalizedLevel);
        if (!requested.find()) {
            return false;
        }
        String requestedNumber = requested.group(1);
        String levelName = normalize(level.name());
        String levelCode = normalize(level.code());
        return levelName.contains(" " + requestedNumber)
                || levelName.endsWith(requestedNumber)
                || levelCode.endsWith("_" + requestedNumber)
                || levelCode.endsWith(requestedNumber);
    }

    private TutorMatchingRequest toBroadMatchingRequest(
            ChatCatalogHintResolver.SubjectHint subject,
            ChatCatalogHintResolver.LevelHint level,
            TeachingMode mode,
            ExtractedRequirement requirement
    ) {
        Budget budget = requirement.budget();
        BigDecimal target = budget == null ? null : budget.target();
        return new TutorMatchingRequest(
                subject.id(),
                level.id(),
                mode,
                budget == null ? null : firstNonNull(budget.min(), target),
                budget == null ? null : firstNonNull(budget.max(), target),
                null,
                null,
                toPreferredSchedules(requirement.preferredSchedules()),
                requirement.learningGoal(),
                safeList(requirement.weakTopics()),
                safeList(requirement.tutorPreferences())
        );
    }

    private AnalyzeRequirementResponse enrichAnalysisFromMessage(AnalyzeRequirementResponse analysis, String message) {
        ExtractedRequirement original = analysis == null ? null : analysis.requirement();
        ExtractedRequirement enriched = enrichRequirement(original, message);
        if (analysis == null) {
            return new AnalyzeRequirementResponse(ExtractionStatus.NEEDS_CLARIFICATION, enriched, List.of(), List.of());
        }
        if (enriched == original) {
            return analysis;
        }
        ExtractionStatus status = analysis.status() == ExtractionStatus.INVALID && enriched.subjectHint() != null
                ? ExtractionStatus.NEEDS_CLARIFICATION
                : analysis.status();
        return new AnalyzeRequirementResponse(status, enriched, analysis.missingRequiredFields(), analysis.ambiguousFields());
    }

    private ExtractedRequirement enrichRequirement(ExtractedRequirement requirement, String message) {
        String subjectHint = hasText(requirement == null ? null : requirement.subjectHint())
                ? requirement.subjectHint()
                : subjectHint(message);
        String levelHint = hasText(requirement == null ? null : requirement.levelHint())
                ? requirement.levelHint()
                : levelHint(message);
        TeachingMode teachingMode = requirement == null ? null : requirement.teachingMode();
        if (teachingMode == null) {
            teachingMode = teachingModeHint(message);
        }
        List<String> tutorPreferences = enrichTutorPreferences(requirement, message);
        if (requirement != null
                && Objects.equals(requirement.subjectHint(), subjectHint)
                && Objects.equals(requirement.levelHint(), levelHint)
                && requirement.teachingMode() == teachingMode
                && Objects.equals(safeList(requirement.tutorPreferences()), tutorPreferences)) {
            return requirement;
        }
        return new ExtractedRequirement(
                subjectHint,
                levelHint,
                teachingMode,
                requirement == null ? null : requirement.budget(),
                requirement == null ? List.of() : safeList(requirement.preferredSchedules()),
                requirement == null ? null : requirement.learningGoal(),
                requirement == null ? List.of() : safeList(requirement.weakTopics()),
                tutorPreferences,
                requirement == null ? null : requirement.locationHint()
        );
    }

    private List<String> enrichTutorPreferences(ExtractedRequirement requirement, String message) {
        List<String> values = new ArrayList<>(requirement == null ? List.of() : safeList(requirement.tutorPreferences()));
        Integer minExperience = minExperienceHint(message);
        if (minExperience != null) {
            String preference = "Kinh nghiệm trên " + minExperience + " năm";
            if (values.stream().noneMatch(value -> normalize(value).equals(normalize(preference)))) {
                values.add(preference);
            }
        }
        return List.copyOf(values);
    }

    private String subjectHint(String message) {
        return catalogHintResolver.subjectHint(message)
                .map(ChatCatalogHintResolver.SubjectHint::name)
                .orElse(null);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String levelHint(String message) {
        Matcher matcher = LEVEL_HINT.matcher(normalize(message));
        return matcher.find() ? "Lớp " + matcher.group(1) : null;
    }

    private TeachingMode teachingModeHint(String message) {
        String normalized = normalize(message);
        if (acceptsBothTeachingModes(message)) {
            return null;
        }
        if (hasOnlineMarker(normalized)) {
            return TeachingMode.ONLINE;
        }
        if (hasOfflineMarker(normalized)) {
            return TeachingMode.OFFLINE;
        }
        return null;
    }

    private boolean acceptsBothTeachingModes(String message) {
        String normalized = normalize(message);
        return hasOnlineMarker(normalized) && hasOfflineMarker(normalized);
    }

    private boolean hasOnlineMarker(String normalized) {
        return normalized.contains("online") || normalized.contains("truc tuyen");
    }

    private boolean hasOfflineMarker(String normalized) {
        return normalized.contains("offline")
                || normalized.contains("truc tiep")
                || (normalized.contains("truc") && normalized.contains("tiep"))
                || (normalized.contains("tr c") && normalized.contains("ti p"));
    }

    private TutorMatchingRequest toMatchingRequest(GroundedRequirement requirement) {
        Budget budget = requirement.budget();
        BigDecimal target = budget == null ? null : budget.target();
        return new TutorMatchingRequest(
                requirement.subject().id(),
                requirement.level().id(),
                requirement.teachingMode(),
                budget == null ? null : firstNonNull(budget.min(), target),
                budget == null ? null : firstNonNull(budget.max(), target),
                requirement.teachingMode() == TeachingMode.OFFLINE && requirement.location() != null
                        ? requirement.location().provinceCode()
                        : null,
                requirement.teachingMode() == TeachingMode.OFFLINE && requirement.location() != null
                        ? requirement.location().communeCode()
                        : null,
                toPreferredSchedules(requirement.preferredSchedules()),
                requirement.learningGoal(),
                safeList(requirement.weakTopics()),
                safeList(requirement.tutorPreferences())
        );
    }

    private List<PreferredScheduleRequest> toPreferredSchedules(List<PreferredSchedule> schedules) {
        return safeList(schedules).stream()
                .filter(slot -> slot.dayOfWeek() != null && hasText(slot.startTime()) && hasText(slot.endTime()))
                .map(slot -> new PreferredScheduleRequest(slot.dayOfWeek(), slot.startTime(), slot.endTime()))
                .toList();
    }

    private Integer minExperienceHint(String message) {
        Matcher matcher = MIN_EXPERIENCE_HINT.matcher(normalize(message));
        return matcher.find() ? Integer.valueOf(matcher.group(1)) : null;
    }

    private Map<String, Object> toPublicItem(TutorMatchResult result) {
        MatchedSubject subject = result.matchedSubject();
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("tutorId", result.tutorId());
        item.put("displayName", result.fullName());
        item.put("avatarUrl", result.avatarUrl());
        item.put("bio", result.bio());
        item.put("matchedSubject", subject == null ? null : subject.subjectName());
        item.put("matchedLevel", subject == null ? null : subject.levelName());
        item.put("experienceYears", subject == null ? null : subject.experienceYears());
        item.put("tuitionMin", subject == null ? null : subject.tuitionMin());
        item.put("tuitionMax", subject == null ? null : subject.tuitionMax());
        item.put("startingTuition", result.startingTuition());
        item.put("teachingModes", safeList(result.teachingModes()));
        item.put("averageRating", result.averageRating());
        item.put("reviewCount", result.reviewCount());
        item.put("publishedClassCount", result.publishedClassCount());
        item.put("matchPercentage", result.matchPercentage());
        item.put("matchingReasons", safeList(result.matchingReasons()).stream().limit(3).toList());
        item.put("mismatchReasons", safeList(result.mismatchReasons()).stream().limit(2).toList());
        item.put("scoreBreakdown", result.scoreBreakdown());
        return item;
    }

    private Map<String, Object> toolResult(String type, List<Map<String, Object>> items, int totalCandidates,
                                           int eligibleCandidates, List<String> relaxedCriteria, String rankingMode) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", type);
        result.put("items", items);
        result.put("totalCandidates", totalCandidates);
        result.put("eligibleCandidates", eligibleCandidates);
        result.put("relaxedCriteria", safeList(relaxedCriteria));
        result.put("rankingMode", rankingMode);
        result.put("resultLimit", DEFAULT_LIMIT);
        result.put("maxResultLimit", MAX_LIMIT);
        return result;
    }

    private String firstBlockingQuestion(List<Clarification> clarifications, String fallback) {
        return safeList(clarifications).stream()
                .filter(Clarification::blocking)
                .map(Clarification::question)
                .filter(this::hasText)
                .findFirst()
                .orElse(fallback);
    }

    private BigDecimal firstNonNull(BigDecimal first, BigDecimal second) {
        return first == null ? second : first;
    }

    private <T> List<T> safeList(Iterable<T> values) {
        if (values == null) {
            return List.of();
        }
        ArrayList<T> copy = new ArrayList<>();
        values.forEach(copy::add);
        return List.copyOf(copy);
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String noAccent = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return noAccent.toLowerCase(Locale.ROOT)
                .replace("\u0111", "d")
                .replace("\u0110", "d")
                .trim();
    }
}
