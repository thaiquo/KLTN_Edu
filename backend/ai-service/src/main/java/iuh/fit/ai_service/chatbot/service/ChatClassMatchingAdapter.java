package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.model.ChatTool;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchResult;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchingRequest;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchingResponse;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassSchedule;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.AnalyzeClassRequirementRequest;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.AnalyzeClassRequirementResponse;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ClassExtractedRequirement;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ExtractionStatus;
import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundClassRequirementRequest;
import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundClassRequirementResponse;
import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundedClassRequirement;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.CatalogItem;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.Clarification;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.service.ClassMatchingService;
import iuh.fit.ai_service.service.ClassNaturalLanguageRequirementAnalyzer;
import iuh.fit.ai_service.service.ClassRequirementGroundingService;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class ChatClassMatchingAdapter {
    private static final int DEFAULT_LIMIT = 3;
    private static final int MAX_LIMIT = 5;
    private static final Pattern LEVEL_HINT = Pattern.compile("\\blop\\s*(\\d{1,2})\\b");

    private final ClassNaturalLanguageRequirementAnalyzer analyzer;
    private final ClassRequirementGroundingService groundingService;
    private final ClassMatchingService matchingService;
    private final ChatToolRegistry toolRegistry;
    private final RoleToolAuthorizer authorizer;
    private final ChatCatalogHintResolver catalogHintResolver;

    public ChatClassMatchingAdapter(
            ClassNaturalLanguageRequirementAnalyzer analyzer,
            ClassRequirementGroundingService groundingService,
            ClassMatchingService matchingService,
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
        if (!authorizer.isAllowed(userContext, ChatTool.CLASS_MATCHING_PUBLIC)) {
            return new ChatMatchingResult("Bạn chưa có quyền dùng công cụ tìm lớp trong trợ lý.", List.of(), null);
        }
        try {
            AnalyzeClassRequirementResponse analysis = enrichAnalysisFromMessage(
                    analyzeOrFallback(message),
                    message
            );
            if (analysis.status() == ExtractionStatus.INVALID || analysis.requirement() == null) {
                return clarify("Bạn muốn tìm lớp môn nào, trình độ nào và học online hay trực tiếp?");
            }

            ChatMatchingResult broadSubjectMatch = broadSubjectMatch(analysis.requirement(), message);
            if (broadSubjectMatch != null) {
                return broadSubjectMatch;
            }

            ChatMatchingResult missingCore = clarifyMissingCoreFields(analysis.requirement());
            if (missingCore != null) {
                return missingCore;
            }

            GroundClassRequirementResponse grounding = groundingService.ground(new GroundClassRequirementRequest(analysis.requirement()));
            if (!grounding.coreSearchReady() || grounding.requirement() == null) {
                return clarify(firstBlockingQuestion(
                        grounding.clarifications(),
                        "Bạn bổ sung giúp tôi môn học, trình độ và hình thức học để tìm lớp phù hợp nhé."
                ));
            }

            ClassMatchingResponse response = matchingService.match(new ClassMatchingRequest(grounding.requirement(), MAX_LIMIT));
            List<Map<String, Object>> items = response.results().stream()
                    .limit(DEFAULT_LIMIT)
                    .map(this::toPublicItem)
                    .toList();
            return new ChatMatchingResult(
                    items.isEmpty()
                            ? "Tôi chưa tìm thấy lớp phù hợp với nhu cầu này. Bạn có thể nới lịch học, học phí hoặc thử mô tả khác."
                            : "Tôi tìm được một vài lớp phù hợp nhất theo nhu cầu của bạn.",
                    List.of(),
                    toolResult(items, response.totalCandidates(), response.eligibleCandidates(), response.rankingMode())
            );
        } catch (RuntimeException exception) {
            return new ChatMatchingResult(
                    "Hiện tôi chưa thể chạy tìm lớp bằng AI. Bạn có thể thử lại sau ít phút hoặc mở trang Lớp học.",
                    toolRegistry.publicNavigationActions(userContext, "lớp"),
                    null
            );
        }
    }

    private AnalyzeClassRequirementResponse analyzeOrFallback(String message) {
        try {
            return analyzer.analyze(new AnalyzeClassRequirementRequest(message));
        } catch (RuntimeException exception) {
            return new AnalyzeClassRequirementResponse(ExtractionStatus.NEEDS_CLARIFICATION, null, List.of(), List.of());
        }
    }

    private ChatMatchingResult clarify(String question) {
        return new ChatMatchingResult(question, List.of(), Map.of(
                "type", "CLASS_MATCHES",
                "items", List.of()
        ));
    }

    private ChatMatchingResult clarifyMissingCoreFields(ClassExtractedRequirement requirement) {
        if (requirement == null || !hasText(requirement.subjectHint())) {
            return null;
        }
        if (!hasText(requirement.levelHint())) {
            return clarify("Bạn muốn tìm lớp ở trình độ nào?");
        }
        if (requirement.teachingMode() == null) {
            return clarify("Bạn muốn học lớp trực tuyến hay trực tiếp?");
        }
        return null;
    }

    private ChatMatchingResult broadSubjectMatch(ClassExtractedRequirement requirement, String message) {
        if (requirement == null || !hasText(requirement.subjectHint())
                || (hasText(requirement.levelHint()) && requirement.teachingMode() != null)) {
            return null;
        }
        java.util.Optional<ChatCatalogHintResolver.SubjectHint> subjectHint = catalogHintResolver.subjectHint(message);
        if (subjectHint.isEmpty() || subjectHint.get().id() == null || subjectHint.get().levels().isEmpty()) {
            return null;
        }
        List<ChatCatalogHintResolver.LevelHint> levels = levelsForBroadMatch(subjectHint.get(), requirement.levelHint());
        if (levels.isEmpty()) {
            return null;
        }
        List<TeachingMode> modes = requirement.teachingMode() == null
                ? List.of(TeachingMode.ONLINE, TeachingMode.OFFLINE)
                : List.of(requirement.teachingMode());

        Map<Long, ClassMatchResult> bestByClassId = new LinkedHashMap<>();
        int totalCandidates = 0;
        int eligibleCandidates = 0;
        String rankingMode = "BROAD_SUBJECT";
        for (ChatCatalogHintResolver.LevelHint level : levels) {
            for (TeachingMode mode : modes) {
                ClassMatchingResponse response = matchingService.match(new ClassMatchingRequest(
                        toBroadGroundedRequirement(subjectHint.get(), level, mode, requirement),
                        MAX_LIMIT
                ));
                totalCandidates += response.totalCandidates();
                eligibleCandidates += response.eligibleCandidates();
                if (response.rankingMode() != null && !"STRUCTURED_V1".equalsIgnoreCase(response.rankingMode())) {
                    rankingMode = response.rankingMode();
                }
                for (ClassMatchResult result : safeList(response.results())) {
                    if (result.classId() == null) {
                        continue;
                    }
                    ClassMatchResult current = bestByClassId.get(result.classId());
                    if (current == null || result.matchPercentage() > current.matchPercentage()) {
                        bestByClassId.put(result.classId(), result);
                    }
                }
            }
        }

        List<Map<String, Object>> items = bestByClassId.values().stream()
                .sorted(java.util.Comparator
                        .comparing(ClassMatchResult::matchPercentage).reversed()
                        .thenComparing(result -> result.startDate(), java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
                        .thenComparing(ClassMatchResult::classId))
                .limit(DEFAULT_LIMIT)
                .map(this::toPublicItem)
                .toList();
        String responseMessage = items.isEmpty()
                ? "Tôi chưa tìm thấy lớp phù hợp với môn " + subjectHint.get().name() + ". Bạn có thể bổ sung trình độ, hình thức học hoặc thử môn khác."
                : "Tôi tìm được một vài lớp phù hợp nhất cho môn " + subjectHint.get().name() + ".";
        return new ChatMatchingResult(
                responseMessage,
                List.of(),
                toolResult(items, totalCandidates, eligibleCandidates, rankingMode)
        );
    }

    private List<ChatCatalogHintResolver.LevelHint> levelsForBroadMatch(
            ChatCatalogHintResolver.SubjectHint subjectHint,
            String levelHint
    ) {
        if (!hasText(levelHint)) {
            return subjectHint.levels();
        }
        String normalizedLevel = normalize(levelHint);
        return subjectHint.levels().stream()
                .filter(level -> normalize(level.name()).equals(normalizedLevel)
                        || normalize(level.code()).equals(normalizedLevel)
                        || normalize(level.name()).contains(normalizedLevel)
                        || normalizedLevel.contains(normalize(level.name())))
                .toList();
    }

    private GroundedClassRequirement toBroadGroundedRequirement(
            ChatCatalogHintResolver.SubjectHint subject,
            ChatCatalogHintResolver.LevelHint level,
            TeachingMode mode,
            ClassExtractedRequirement requirement
    ) {
        return new GroundedClassRequirement(
                new CatalogItem(subject.id(), null, subject.name(), null),
                new CatalogItem(level.id(), level.code(), level.name(), null),
                mode,
                requirement.budget(),
                safeList(requirement.availableSchedules()),
                requirement.learningGoal(),
                safeList(requirement.weakTopics()),
                safeList(requirement.classPreferences()),
                requirement.locationHint()
        );
    }

    private AnalyzeClassRequirementResponse enrichAnalysisFromMessage(AnalyzeClassRequirementResponse analysis, String message) {
        ClassExtractedRequirement original = analysis == null ? null : analysis.requirement();
        ClassExtractedRequirement enriched = enrichRequirement(original, message);
        if (analysis == null) {
            return new AnalyzeClassRequirementResponse(ExtractionStatus.NEEDS_CLARIFICATION, enriched, List.of(), List.of());
        }
        if (enriched == original) {
            return analysis;
        }
        ExtractionStatus status = analysis.status() == ExtractionStatus.INVALID && enriched.subjectHint() != null
                ? ExtractionStatus.NEEDS_CLARIFICATION
                : analysis.status();
        return new AnalyzeClassRequirementResponse(status, enriched, analysis.missingRequiredFields(), analysis.ambiguousFields());
    }

    private ClassExtractedRequirement enrichRequirement(ClassExtractedRequirement requirement, String message) {
        String subjectHint = hasText(requirement == null ? null : requirement.subjectHint())
                ? requirement.subjectHint()
                : subjectHint(message);
        String levelHint = hasText(requirement == null ? null : requirement.levelHint())
                ? requirement.levelHint()
                : levelHint(message);
        iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode teachingMode = requirement == null ? null : requirement.teachingMode();
        if (teachingMode == null) {
            teachingMode = teachingModeHint(message);
        }
        if (requirement != null
                && Objects.equals(requirement.subjectHint(), subjectHint)
                && Objects.equals(requirement.levelHint(), levelHint)
                && requirement.teachingMode() == teachingMode) {
            return requirement;
        }
        return new ClassExtractedRequirement(
                subjectHint,
                levelHint,
                teachingMode,
                requirement == null ? null : requirement.budget(),
                requirement == null ? List.of() : safeList(requirement.availableSchedules()),
                requirement == null ? null : requirement.learningGoal(),
                requirement == null ? List.of() : safeList(requirement.weakTopics()),
                requirement == null ? List.of() : safeList(requirement.classPreferences()),
                requirement == null ? null : requirement.locationHint()
        );
    }

    private String subjectHint(String message) {
        return catalogHintResolver.subjectHint(message)
                .map(ChatCatalogHintResolver.SubjectHint::name)
                .orElse(null);
    }

    private String levelHint(String message) {
        Matcher matcher = LEVEL_HINT.matcher(normalize(message));
        return matcher.find() ? "L\u1edbp " + matcher.group(1) : null;
    }

    private iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode teachingModeHint(String message) {
        String normalized = normalize(message);
        if (normalized.contains("online") || normalized.contains("truc tuyen")) {
            return iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode.ONLINE;
        }
        if (normalized.contains("offline") || normalized.contains("truc tiep")) {
            return iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode.OFFLINE;
        }
        return null;
    }

    private Map<String, Object> toPublicItem(ClassMatchResult result) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("classId", result.classId());
        item.put("title", result.name());
        item.put("description", result.description());
        item.put("tutorName", result.tutorFullName());
        item.put("subjectName", result.subject() == null ? null : result.subject().subjectName());
        item.put("levelName", result.level() == null ? null : result.level().levelName());
        item.put("teachingMode", result.teachingMode());
        item.put("address", result.address());
        item.put("pricePerSession", result.pricePerSession());
        item.put("sessionsPerWeek", result.sessionsPerWeek());
        item.put("durationPerSessionMinutes", result.durationPerSessionMinutes());
        item.put("startDate", result.startDate());
        item.put("endDate", result.endDate());
        item.put("availableSlots", result.availableSlots());
        item.put("averageRating", result.averageRating());
        item.put("reviewCount", result.reviewCount());
        item.put("topicChips", safeList(result.topicChips()).stream().limit(3).toList());
        item.put("schedules", safeList(result.schedules()).stream().limit(2).map(this::scheduleItem).toList());
        item.put("matchPercentage", result.matchPercentage());
        item.put("matchingReasons", safeList(result.matchingReasons()).stream().limit(3).toList());
        return item;
    }

    private Map<String, Object> scheduleItem(ClassSchedule schedule) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("dayOfWeek", schedule.dayOfWeek());
        item.put("startTime", schedule.startTime());
        item.put("endTime", schedule.endTime());
        return item;
    }

    private Map<String, Object> toolResult(List<Map<String, Object>> items, int totalCandidates,
                                           int eligibleCandidates, String rankingMode) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", "CLASS_MATCHES");
        result.put("items", items);
        result.put("totalCandidates", totalCandidates);
        result.put("eligibleCandidates", eligibleCandidates);
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

    private <T> List<T> safeList(Iterable<T> values) {
        if (values == null) {
            return List.of();
        }
        java.util.ArrayList<T> copy = new java.util.ArrayList<>();
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
