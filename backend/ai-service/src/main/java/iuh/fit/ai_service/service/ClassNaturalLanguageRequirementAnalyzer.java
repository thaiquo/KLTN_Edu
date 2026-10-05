package iuh.fit.ai_service.service;

import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.AnalyzeClassRequirementRequest;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.AnalyzeClassRequirementResponse;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ClassExtractedRequirement;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ClassGeminiRequirementExtraction;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ExtractionStatus;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class ClassNaturalLanguageRequirementAnalyzer {
    private static final int MAX_TEXT_LENGTH = 400;
    private static final int MAX_LIST_ITEM_LENGTH = 120;
    private static final int MAX_LIST_ITEMS = 12;
    private static final BigDecimal MAX_REASONABLE_BUDGET = BigDecimal.valueOf(10_000_000);

    private final ClassRequirementExtractionClient extractionClient;

    public ClassNaturalLanguageRequirementAnalyzer(ClassRequirementExtractionClient extractionClient) {
        this.extractionClient = extractionClient;
    }

    public AnalyzeClassRequirementResponse analyze(AnalyzeClassRequirementRequest request) {
        String message = request.message().trim();
        ClassGeminiRequirementExtraction extraction = extractionClient.extractClassRequirement(message);
        if (extraction == null || !Boolean.TRUE.equals(extraction.classSearchRelevant())) {
            return new AnalyzeClassRequirementResponse(
                    ExtractionStatus.INVALID,
                    emptyRequirement(),
                    List.of(),
                    cleanList(extraction == null ? null : extraction.ambiguousFields())
            );
        }

        ClassExtractedRequirement requirement = normalizeRequirement(extraction);
        List<String> missing = missingRequiredFields(requirement);
        ExtractionStatus status = missing.isEmpty() ? ExtractionStatus.EXTRACTED : ExtractionStatus.NEEDS_CLARIFICATION;
        return new AnalyzeClassRequirementResponse(status, requirement, missing, cleanList(extraction.ambiguousFields()));
    }

    private ClassExtractedRequirement normalizeRequirement(ClassGeminiRequirementExtraction extraction) {
        return new ClassExtractedRequirement(
                trimToNull(extraction.subjectHint()),
                trimToNull(extraction.levelHint()),
                extraction.teachingMode(),
                normalizeBudget(extraction.budget()),
                normalizeSchedules(extraction.availableSchedules()),
                trimToNull(extraction.learningGoal()),
                cleanList(extraction.weakTopics()),
                cleanList(extraction.classPreferences()),
                trimToNull(extraction.locationHint())
        );
    }

    private Budget normalizeBudget(Budget budget) {
        if (budget == null) {
            return null;
        }
        BigDecimal min = validMoney(budget.min());
        BigDecimal max = validMoney(budget.max());
        BigDecimal target = validMoney(budget.target());
        if (min != null && max != null && min.compareTo(max) > 0) {
            BigDecimal swapped = min;
            min = max;
            max = swapped;
        }
        if (min == null && max == null && target == null) {
            return null;
        }
        return new Budget(min, max, target, "VND", "SESSION", Boolean.TRUE.equals(budget.approximate()));
    }

    private BigDecimal validMoney(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0 || value.compareTo(MAX_REASONABLE_BUDGET) > 0) {
            return null;
        }
        return value.stripTrailingZeros();
    }

    private List<PreferredSchedule> normalizeSchedules(List<PreferredSchedule> schedules) {
        if (schedules == null || schedules.isEmpty()) {
            return List.of();
        }
        Set<String> seen = new LinkedHashSet<>();
        List<PreferredSchedule> normalized = new ArrayList<>();
        for (PreferredSchedule schedule : schedules) {
            if (schedule == null || normalized.size() >= MAX_LIST_ITEMS) {
                continue;
            }
            Integer dayOfWeek = validDayOfWeek(schedule.dayOfWeek());
            String startTime = validTime(schedule.startTime());
            String endTime = validTime(schedule.endTime());
            if ((startTime == null && endTime != null) || (startTime != null && endTime == null)) {
                startTime = null;
                endTime = null;
            }
            if (startTime != null && !LocalTime.parse(startTime).isBefore(LocalTime.parse(endTime))) {
                startTime = null;
                endTime = null;
            }
            if (dayOfWeek == null && startTime == null && endTime == null && schedule.timeOfDayHint() == null) {
                continue;
            }
            PreferredSchedule candidate = new PreferredSchedule(dayOfWeek, startTime, endTime, schedule.timeOfDayHint());
            String key = candidate.dayOfWeek() + "|" + candidate.startTime() + "|" + candidate.endTime() + "|" + candidate.timeOfDayHint();
            if (seen.add(key)) {
                normalized.add(candidate);
            }
        }
        return List.copyOf(normalized);
    }

    private Integer validDayOfWeek(Integer dayOfWeek) {
        return dayOfWeek != null && dayOfWeek >= 2 && dayOfWeek <= 8 ? dayOfWeek : null;
    }

    private String validTime(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        try {
            return LocalTime.parse(trimmed).toString();
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private List<String> missingRequiredFields(ClassExtractedRequirement requirement) {
        List<String> missing = new ArrayList<>();
        if (!StringUtils.hasText(requirement.subjectHint())) {
            missing.add("subject");
        }
        if (!StringUtils.hasText(requirement.levelHint())) {
            missing.add("level");
        }
        if (requirement.teachingMode() == null) {
            missing.add("teachingMode");
        }
        return List.copyOf(missing);
    }

    private List<String> cleanList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        Set<String> cleaned = new LinkedHashSet<>();
        for (String value : values) {
            String trimmed = trimToNull(value);
            if (trimmed != null) {
                cleaned.add(limitLength(trimmed, MAX_LIST_ITEM_LENGTH));
            }
            if (cleaned.size() >= MAX_LIST_ITEMS) {
                break;
            }
        }
        return List.copyOf(cleaned);
    }

    private ClassExtractedRequirement emptyRequirement() {
        return new ClassExtractedRequirement(null, null, null, null, List.of(), null, List.of(), List.of(), null);
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return limitLength(value.trim(), MAX_TEXT_LENGTH);
    }

    private String limitLength(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
