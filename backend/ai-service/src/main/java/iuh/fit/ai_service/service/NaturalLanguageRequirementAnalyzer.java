package iuh.fit.ai_service.service;

import iuh.fit.ai_service.dto.RequirementAnalysisDtos.AnalyzeRequirementRequest;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.AnalyzeRequirementResponse;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ConstraintMode;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ExtractedRequirement;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ExtractionStatus;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.GeminiRequirementExtraction;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class NaturalLanguageRequirementAnalyzer {
    private static final int MAX_TEXT_LENGTH = 400;
    private static final int MAX_LIST_ITEM_LENGTH = 120;
    private static final int MAX_LIST_ITEMS = 12;
    private static final BigDecimal MAX_REASONABLE_BUDGET = BigDecimal.valueOf(10_000_000);
    private static final Pattern EXPLICIT_TIME_RANGE = Pattern.compile(
            "(?iu)(?<!\\d)(\\d{1,2})(?:(:|h)\\s*(\\d{1,2})?)?\\s*(giờ)?\\s*(sáng|chiều|tối)?\\s*"
                    + "(?:-|–|—|đến|tới)\\s*"
                    + "(\\d{1,2})(?:(:|h)\\s*(\\d{1,2})?)?\\s*(giờ)?\\s*(sáng|chiều|tối)?"
    );
    private static final Pattern TOEIC_TARGET_SCORE = Pattern.compile(
            "(?iu)(?:toeic\\s*|(?:mục\\s*tiêu|đạt|band)\\s*)(\\d{3})\\s*\\+?"
    );

    private final RequirementExtractionClient extractionClient;

    public NaturalLanguageRequirementAnalyzer(RequirementExtractionClient extractionClient) {
        this.extractionClient = extractionClient;
    }

    public AnalyzeRequirementResponse analyze(AnalyzeRequirementRequest request) {
        String message = request.message().trim();
        GeminiRequirementExtraction extraction = extractionClient.extractRequirement(message);
        if (extraction == null || !Boolean.TRUE.equals(extraction.tutorSearchRelevant())) {
            return new AnalyzeRequirementResponse(
                    ExtractionStatus.INVALID,
                    emptyRequirement(),
                    List.of(),
                    cleanList(extraction == null ? null : extraction.ambiguousFields())
            );
        }

        ExtractedRequirement requirement = normalizeRequirement(extraction, message);
        List<String> missing = missingRequiredFields(requirement);
        ExtractionStatus status = missing.isEmpty() ? ExtractionStatus.EXTRACTED : ExtractionStatus.NEEDS_CLARIFICATION;
        return new AnalyzeRequirementResponse(
                status,
                requirement,
                missing,
                cleanList(extraction.ambiguousFields())
        );
    }

    private ExtractedRequirement normalizeRequirement(GeminiRequirementExtraction extraction, String sourceMessage) {
        return new ExtractedRequirement(
                trimToNull(extraction.subjectHint()),
                normalizeLevelHint(extraction, sourceMessage),
                extraction.teachingMode(),
                normalizeBudget(extraction.budget()),
                enrichExplicitTimeRange(normalizeSchedules(extraction.preferredSchedules()), sourceMessage),
                trimToNull(extraction.learningGoal()),
                cleanList(extraction.weakTopics()),
                cleanList(extraction.tutorPreferences()),
                trimToNull(extraction.locationHint()),
                normalizeScheduleMode(extraction.scheduleConstraintMode(), sourceMessage),
                normalizeBudgetMode(extraction.budgetConstraintMode(), sourceMessage)
        );
    }

    private ConstraintMode normalizeScheduleMode(ConstraintMode extracted, String sourceMessage) {
        if (extracted != null) return extracted;
        String source = normalizeText(sourceMessage == null ? "" : sourceMessage);
        if (source.matches(".*(?:chi co the|bat buoc|khong the).*hoc.*")) return ConstraintMode.HARD;
        return ConstraintMode.SOFT;
    }

    private ConstraintMode normalizeBudgetMode(ConstraintMode extracted, String sourceMessage) {
        if (extracted != null) return extracted;
        String source = normalizeText(sourceMessage == null ? "" : sourceMessage);
        if (source.matches(".*(?:ngan sach|hoc phi).*(?:toi da|khong qua|bat buoc).*")) return ConstraintMode.HARD;
        if (source.matches(".*(?:toi da|khong qua).*(?:ngan sach|hoc phi).*")) return ConstraintMode.HARD;
        return ConstraintMode.SOFT;
    }

    private String normalizeLevelHint(GeminiRequirementExtraction extraction, String sourceMessage) {
        String extracted = trimToNull(extraction.levelHint());
        if (extracted != null) {
            return extracted;
        }
        String subject = trimToNull(extraction.subjectHint());
        if (subject == null || !normalizeText(subject).contains("toeic") || !StringUtils.hasText(sourceMessage)) {
            return null;
        }
        Matcher matcher = TOEIC_TARGET_SCORE.matcher(sourceMessage);
        while (matcher.find()) {
            int score;
            try {
                score = Integer.parseInt(matcher.group(1));
            } catch (NumberFormatException ignored) {
                continue;
            }
            if (score >= 100 && score <= 990) {
                return score + "+";
            }
        }
        return null;
    }

    private String normalizeText(String value) {
        return java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(java.util.Locale.ROOT);
    }

    private List<PreferredSchedule> enrichExplicitTimeRange(List<PreferredSchedule> schedules, String sourceMessage) {
        if (schedules.isEmpty() || !StringUtils.hasText(sourceMessage)) {
            return schedules;
        }
        List<TimeRange> ranges = explicitTimeRanges(sourceMessage);
        if (ranges.size() != 1) {
            return schedules;
        }
        TimeRange range = ranges.getFirst();
        return schedules.stream()
                .map(schedule -> schedule.startTime() == null && schedule.endTime() == null
                        ? new PreferredSchedule(schedule.dayOfWeek(), range.start(), range.end(), schedule.timeOfDayHint())
                        : schedule)
                .toList();
    }

    private List<TimeRange> explicitTimeRanges(String sourceMessage) {
        Set<TimeRange> ranges = new LinkedHashSet<>();
        Matcher matcher = EXPLICIT_TIME_RANGE.matcher(sourceMessage);
        while (matcher.find()) {
            boolean hasExplicitTimeMarker = matcher.group(2) != null || matcher.group(4) != null
                    || matcher.group(7) != null || matcher.group(9) != null;
            if (!hasExplicitTimeMarker) {
                continue;
            }
            LocalTime start = parseVietnameseTime(matcher.group(1), matcher.group(3), matcher.group(5), matcher.group(10));
            LocalTime end = parseVietnameseTime(matcher.group(6), matcher.group(8), matcher.group(10), matcher.group(5));
            if (start != null && end != null && start.isBefore(end)) {
                ranges.add(new TimeRange(start.toString(), end.toString()));
            }
        }
        return List.copyOf(ranges);
    }

    private LocalTime parseVietnameseTime(String hourText, String minuteText, String ownPeriod, String sharedPeriod) {
        try {
            int hour = Integer.parseInt(hourText);
            int minute = minuteText == null ? 0 : Integer.parseInt(minuteText);
            String period = ownPeriod == null ? sharedPeriod : ownPeriod;
            if (period != null && (period.equalsIgnoreCase("chiều") || period.equalsIgnoreCase("tối")) && hour < 12) {
                hour += 12;
            } else if (period != null && period.equalsIgnoreCase("sáng") && hour == 12) {
                hour = 0;
            }
            return LocalTime.of(hour, minute);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private Budget normalizeBudget(Budget budget) {
        if (budget == null) {
            return null;
        }

        BigDecimal min = validMoney(budget.min());
        BigDecimal max = validMoney(budget.max());
        BigDecimal target = validMoney(budget.target());
        if (min != null && max != null && min.compareTo(max) > 0) {
            BigDecimal swappedMin = max;
            max = min;
            min = swappedMin;
        }
        if (min == null && max == null && target == null) {
            return null;
        }

        return new Budget(
                min,
                max,
                target,
                "VND",
                "SESSION",
                Boolean.TRUE.equals(budget.approximate())
        );
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

    private List<String> missingRequiredFields(ExtractedRequirement requirement) {
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

    private ExtractedRequirement emptyRequirement() {
        return new ExtractedRequirement(null, null, null, null, List.of(), null, List.of(), List.of(), null,
                ConstraintMode.SOFT, ConstraintMode.SOFT);
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

    private record TimeRange(String start, String end) {
    }
}
