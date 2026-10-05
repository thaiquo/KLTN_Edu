package iuh.fit.ai_service.service;

import iuh.fit.ai_service.client.AccountLocationClient;
import iuh.fit.ai_service.client.LearningCatalogClient;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ExtractedRequirement;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.CatalogContext;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.CatalogItem;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.CatalogReference;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.Clarification;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.ClarificationField;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.ClarificationOption;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.ClarificationReason;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundRequirementRequest;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundRequirementResponse;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundedLocation;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundedRequirement;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundingStatus;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCatalogSnapshot;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCategory;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningLevel;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningOption;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningSubject;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LocationCommune;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LocationProvince;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LocationSnapshot;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class CatalogGroundingService {
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_ALNUM = Pattern.compile("[^\\p{IsAlphabetic}\\p{IsDigit}]+");

    private final LearningCatalogClient catalogClient;
    private final AccountLocationClient locationClient;

    public CatalogGroundingService(LearningCatalogClient catalogClient, AccountLocationClient locationClient) {
        this.catalogClient = catalogClient;
        this.locationClient = locationClient;
    }

    public GroundRequirementResponse ground(GroundRequirementRequest request) {
        ExtractedRequirement input = request.requirement();
        LearningCatalogSnapshot snapshot = catalogClient.groundingSnapshot();
        if (snapshot == null || snapshot.subjects() == null) {
            throw new CatalogGroundingUnavailableException("Learning catalog snapshot is unavailable");
        }

        List<Clarification> clarifications = new ArrayList<>();
        SubjectResolution subjectResolution = resolveSubject(input.subjectHint(), input.levelHint(), snapshot.subjects());
        if (subjectResolution.clarification() != null) {
            clarifications.add(subjectResolution.clarification());
        }

        LevelResolution levelResolution = resolveLevel(input.levelHint(), subjectResolution.subject());
        if (levelResolution.clarification() != null) {
            clarifications.add(levelResolution.clarification());
        }

        if (input.teachingMode() == null) {
            clarifications.add(teachingModeClarification());
        }

        LocationResolution locationResolution = resolveLocation(input);
        if (locationResolution.clarification() != null) {
            clarifications.add(locationResolution.clarification());
        }
        clarifications.addAll(optionalClarifications(input));

        GroundedRequirement grounded = new GroundedRequirement(
                subjectResolution.subject() == null ? null : subjectItem(subjectResolution.subject()),
                levelResolution.level() == null || subjectResolution.subject() == null
                        ? null
                        : levelItem(levelResolution.level(), subjectResolution.subject()),
                input.teachingMode(),
                input.budget(),
                input.preferredSchedules() == null ? List.of() : input.preferredSchedules(),
                trimToNull(input.learningGoal()),
                input.weakTopics() == null ? List.of() : input.weakTopics(),
                input.tutorPreferences() == null ? List.of() : input.tutorPreferences(),
                input.teachingMode() == TeachingMode.ONLINE ? null : trimToNull(input.locationHint()),
                locationResolution.location()
        );

        boolean coreReady = grounded.subject() != null && grounded.level() != null && grounded.teachingMode() != null;
        return new GroundRequirementResponse(status(coreReady, clarifications), coreReady, grounded, List.copyOf(clarifications));
    }

    private SubjectResolution resolveSubject(String hint, String levelHint, List<LearningSubject> subjects) {
        List<String> normalizedHints = normalizedSubjectHints(hint);
        if (normalizedHints.isEmpty()) {
            return new SubjectResolution(null, new Clarification(
                    ClarificationField.SUBJECT,
                    ClarificationReason.MISSING,
                    true,
                    "Bạn muốn học môn nào?",
                    List.of(),
                    true
            ));
        }

        List<LearningSubject> exact = subjects.stream()
                .filter(subject -> normalizedHints.stream()
                        .anyMatch(normalizedHint -> normalizedHint.equals(normalize(subject.name()))
                                || normalizedHint.equals(normalize(subject.code()))))
                .toList();
        SubjectResolution exactResolution = resolveSubjectCandidates(exact, levelHint);
        if (exactResolution != null) {
            return exactResolution;
        }

        List<LearningSubject> candidates = subjects.stream()
                .filter(subject -> normalizedHints.stream()
                        .anyMatch(normalizedHint -> containsMatch(normalizedHint, subject.name())
                                || containsMatch(normalizedHint, subject.code())))
                .toList();
        SubjectResolution candidateResolution = resolveSubjectCandidates(candidates, levelHint);
        if (candidateResolution != null) {
            return candidateResolution;
        }

        return new SubjectResolution(null, new Clarification(
                ClarificationField.SUBJECT,
                ClarificationReason.NOT_FOUND,
                true,
                "Không tìm thấy môn học phù hợp trong danh mục đang hoạt động.",
                List.of(),
                true
        ));
    }

    private SubjectResolution resolveSubjectCandidates(List<LearningSubject> candidates, String levelHint) {
        if (candidates.isEmpty()) {
            return null;
        }
        if (candidates.size() == 1) {
            return new SubjectResolution(candidates.getFirst(), null);
        }

        String normalizedLevelHint = normalize(levelHint);
        if (normalizedLevelHint != null) {
            List<LearningSubject> levelScoped = candidates.stream()
                    .filter(subject -> subject.levels() != null && subject.levels().stream()
                            .anyMatch(level -> normalizedLevelHint.equals(normalize(level.name()))
                                    || normalizedLevelHint.equals(normalize(level.code()))
                                    || containsMatch(normalizedLevelHint, level.name())
                                    || containsMatch(normalizedLevelHint, level.code())))
                    .toList();
            if (levelScoped.size() == 1) {
                return new SubjectResolution(levelScoped.getFirst(), null);
            }
            if (levelScoped.size() > 1) {
                return ambiguousSubject(levelScoped);
            }
        }

        return ambiguousSubject(candidates);
    }

    private SubjectResolution ambiguousSubject(List<LearningSubject> candidates) {
        return new SubjectResolution(null, new Clarification(
                ClarificationField.SUBJECT,
                ClarificationReason.AMBIGUOUS,
                true,
                "Bạn muốn học môn nào?",
                subjectOptions(candidates),
                false
        ));
    }

    private LevelResolution resolveLevel(String hint, LearningSubject subject) {
        if (subject == null) {
            return new LevelResolution(null, null);
        }
        List<LearningLevel> levels = subject.levels() == null ? List.of() : subject.levels();
        String normalizedHint = normalize(hint);
        if (normalizedHint == null) {
            return new LevelResolution(null, new Clarification(
                    ClarificationField.LEVEL,
                    ClarificationReason.MISSING,
                    true,
                    "Bạn đang muốn học ở cấp độ nào?",
                    levelOptions(subject, levels),
                    false
            ));
        }

        List<LearningLevel> exact = levels.stream()
                .filter(level -> normalizedHint.equals(normalize(level.name())) || normalizedHint.equals(normalize(level.code())))
                .toList();
        if (exact.size() == 1) {
            return new LevelResolution(exact.getFirst(), null);
        }
        if (exact.size() > 1) {
            return ambiguousLevel(subject, exact);
        }

        List<LearningLevel> candidates = levels.stream()
                .filter(level -> containsMatch(normalizedHint, level.name()) || containsMatch(normalizedHint, level.code()))
                .toList();
        if (candidates.size() == 1) {
            return new LevelResolution(candidates.getFirst(), null);
        }
        if (candidates.size() > 1) {
            return ambiguousLevel(subject, candidates);
        }

        return new LevelResolution(null, new Clarification(
                ClarificationField.LEVEL,
                ClarificationReason.INVALID_RELATIONSHIP,
                true,
                "Bạn muốn học ở cấp độ nào?",
                levelOptions(subject, levels),
                false
        ));
    }

    private LevelResolution ambiguousLevel(LearningSubject subject, List<LearningLevel> candidates) {
        return new LevelResolution(null, new Clarification(
                ClarificationField.LEVEL,
                ClarificationReason.AMBIGUOUS,
                true,
                "Bạn muốn học ở cấp độ nào?",
                levelOptions(subject, candidates),
                false
        ));
    }

    private LocationResolution resolveLocation(ExtractedRequirement input) {
        if (input.teachingMode() != TeachingMode.OFFLINE) {
            return new LocationResolution(null, null);
        }

        String locationHint = trimToNull(input.locationHint());
        if (locationHint == null) {
            return new LocationResolution(null, locationClarification(
                    ClarificationReason.OPTIONAL_REFINEMENT,
                    "Bạn muốn học trực tiếp ở khu vực nào?",
                    List.of(),
                    true
            ));
        }

        LocationSnapshot snapshot = locationClient.locationSnapshot();
        if (snapshot == null || snapshot.provinces() == null) {
            throw new LocationGroundingUnavailableException("Account location snapshot is unavailable");
        }

        String normalizedHint = normalizeLocation(locationHint);
        List<LocationProvince> provinceCandidates = snapshot.provinces().stream()
                .filter(province -> provinceMatches(normalizedHint, province))
                .toList();
        if (provinceCandidates.size() > 1) {
            return new LocationResolution(null, locationClarification(
                    ClarificationReason.AMBIGUOUS,
                    "Bạn muốn học trực tiếp ở tỉnh/thành nào?",
                    provinceOptions(provinceCandidates),
                    false
            ));
        }

        LocationProvince province = provinceCandidates.size() == 1 ? provinceCandidates.getFirst() : null;
        LocationProvince provinceScope = province;
        List<LocationCommune> communeCandidates = snapshot.provinces().stream()
                .flatMap(candidateProvince -> safeCommunes(candidateProvince).stream())
                .filter(commune -> provinceScope == null || sameCode(commune.provinceCode(), provinceScope.code()))
                .filter(commune -> communeMatches(normalizedHint, commune))
                .toList();

        if (province == null && communeCandidates.stream().map(LocationCommune::provinceCode).distinct().count() == 1) {
            String provinceCode = communeCandidates.getFirst().provinceCode();
            province = snapshot.provinces().stream()
                    .filter(candidate -> sameCode(candidate.code(), provinceCode))
                    .findFirst()
                    .orElse(null);
        }

        if (communeCandidates.size() == 1) {
            LocationCommune commune = communeCandidates.getFirst();
            LocationProvince resolvedProvince = province == null ? provinceOf(snapshot, commune) : province;
            return new LocationResolution(location(resolvedProvince, commune, locationHint), null);
        }
        if (communeCandidates.size() > 1) {
            return new LocationResolution(
                    province == null ? null : location(province, null, locationHint),
                    locationClarification(
                            ClarificationReason.AMBIGUOUS,
                            "Bạn muốn học trực tiếp ở phường/xã nào?",
                            communeOptions(communeCandidates),
                            false
                    )
            );
        }
        if (province != null) {
            return new LocationResolution(location(province, null, locationHint), locationClarification(
                    ClarificationReason.OPTIONAL_REFINEMENT,
                    "Bạn có muốn chọn phường/xã cụ thể để tìm gia sư dạy trực tiếp gần hơn không?",
                    communeOptions(safeCommunes(province)),
                    true
            ));
        }

        return new LocationResolution(null, locationClarification(
                ClarificationReason.NOT_FOUND,
                "Hiện chưa tìm thấy khu vực này trong dữ liệu địa giới hành chính.",
                List.of(),
                true
        ));
    }

    private List<Clarification> optionalClarifications(ExtractedRequirement input) {
        List<Clarification> clarifications = new ArrayList<>();
        for (PreferredSchedule schedule : input.preferredSchedules() == null ? List.<PreferredSchedule>of() : input.preferredSchedules()) {
            if (schedule != null && schedule.dayOfWeek() != null && schedule.timeOfDayHint() != null
                    && (!StringUtils.hasText(schedule.startTime()) || !StringUtils.hasText(schedule.endTime()))) {
                clarifications.add(new Clarification(
                        ClarificationField.SCHEDULE,
                        ClarificationReason.OPTIONAL_REFINEMENT,
                        false,
                        "Bạn có muốn chọn giờ học cụ thể để lọc lịch chính xác hơn không?",
                        List.of(),
                        true
                ));
                break;
            }
        }
        return clarifications;
    }

    private GroundingStatus status(boolean coreReady, List<Clarification> clarifications) {
        List<Clarification> blocking = clarifications.stream().filter(Clarification::blocking).toList();
        if (blocking.isEmpty()) {
            return coreReady ? GroundingStatus.GROUNDED : GroundingStatus.NEEDS_CLARIFICATION;
        }
        if (blocking.stream().anyMatch(clarification -> clarification.reason() == ClarificationReason.INVALID_RELATIONSHIP)) {
            return GroundingStatus.INVALID;
        }
        if (blocking.stream().anyMatch(clarification -> clarification.reason() == ClarificationReason.NOT_FOUND)) {
            return GroundingStatus.NOT_FOUND;
        }
        return GroundingStatus.NEEDS_CLARIFICATION;
    }

    private Clarification teachingModeClarification() {
        return new Clarification(
                ClarificationField.TEACHING_MODE,
                ClarificationReason.MISSING,
                true,
                "Bạn muốn học trực tuyến hay trực tiếp?",
                List.of(
                        new ClarificationOption("ONLINE", null, "ONLINE", "Trực tuyến", null),
                        new ClarificationOption("OFFLINE", null, "OFFLINE", "Trực tiếp", null)
                ),
                false
        );
    }

    private Clarification locationClarification(
            ClarificationReason reason,
            String question,
            List<ClarificationOption> options,
            boolean freeTextAllowed
    ) {
        return new Clarification(
                ClarificationField.LOCATION,
                reason,
                false,
                question,
                options,
                freeTextAllowed
        );
    }

    private List<ClarificationOption> subjectOptions(List<LearningSubject> subjects) {
        return subjects.stream()
                .sorted(Comparator.comparing(LearningSubject::name))
                .map(subject -> new ClarificationOption(null, subject.id(), subject.code(), subject.name(), context(subject)))
                .toList();
    }

    private List<ClarificationOption> levelOptions(LearningSubject subject, List<LearningLevel> levels) {
        return levels.stream()
                .sorted(Comparator.comparing(level -> level.name() == null ? "" : level.name()))
                .map(level -> new ClarificationOption(null, level.id(), level.code(), level.name(), context(subject)))
                .toList();
    }

    private List<ClarificationOption> provinceOptions(List<LocationProvince> provinces) {
        return provinces.stream()
                .sorted(Comparator.comparing(province -> province.name() == null ? "" : province.name()))
                .map(province -> new ClarificationOption(province.code(), null, province.code(), province.name(), null))
                .toList();
    }

    private List<ClarificationOption> communeOptions(List<LocationCommune> communes) {
        return communes.stream()
                .sorted(Comparator.comparing(commune -> commune.name() == null ? "" : commune.name()))
                .map(commune -> new ClarificationOption(
                        commune.provinceCode() + "|" + commune.code(),
                        null,
                        commune.code(),
                        commune.name() + " - " + commune.provinceName(),
                        null
                ))
                .toList();
    }

    private CatalogItem subjectItem(LearningSubject subject) {
        return new CatalogItem(subject.id(), subject.code(), subject.name(), context(subject));
    }

    private CatalogItem levelItem(LearningLevel level, LearningSubject subject) {
        return new CatalogItem(level.id(), level.code(), level.name(), context(subject));
    }

    private CatalogContext context(LearningSubject subject) {
        LearningCategory category = subject.category();
        return new CatalogContext(
                category == null ? null : reference(category.programType()),
                category == null ? null : reference(category.educationLevel()),
                category == null ? null : new CatalogReference(category.id(), category.code(), category.name())
        );
    }

    private CatalogReference reference(LearningOption option) {
        return option == null ? null : new CatalogReference(option.id(), option.code(), option.name());
    }

    private GroundedLocation location(LocationProvince province, LocationCommune commune, String originalHint) {
        if (province == null && commune == null) {
            return null;
        }
        return new GroundedLocation(
                province == null ? commune.provinceCode() : province.code(),
                province == null ? commune.provinceName() : province.name(),
                commune == null ? null : commune.code(),
                commune == null ? null : commune.name(),
                originalHint
        );
    }

    private LocationProvince provinceOf(LocationSnapshot snapshot, LocationCommune commune) {
        if (commune == null || snapshot == null || snapshot.provinces() == null) {
            return null;
        }
        return snapshot.provinces().stream()
                .filter(province -> sameCode(province.code(), commune.provinceCode()))
                .findFirst()
                .orElse(null);
    }

    private List<LocationCommune> safeCommunes(LocationProvince province) {
        return province == null || province.communes() == null ? List.of() : province.communes();
    }

    private boolean provinceMatches(String normalizedHint, LocationProvince province) {
        String normalizedName = normalizeLocation(province.name());
        String normalizedCode = normalizeLocation(province.code());
        String compactHint = compact(normalizedHint);
        return normalizedHint != null
                && (normalizedHint.equals(normalizedName)
                || safeContains(normalizedHint, normalizedName)
                || safeContains(normalizedName, normalizedHint)
                || normalizedHint.equals(normalizedCode)
                || ("HO_CHI_MINH".equalsIgnoreCase(province.code())
                && (compactHint.equals("tphcm")
                || compactHint.equals("hcm")
                || normalizedHint.equals("ho chi minh")
                || normalizedHint.endsWith(" hcm")
                || normalizedHint.contains(" hcm "))));
    }

    private boolean communeMatches(String normalizedHint, LocationCommune commune) {
        String normalizedName = normalizeLocation(commune.name());
        String normalizedCode = normalizeLocation(commune.code());
        return normalizedHint != null
                && (normalizedHint.equals(normalizedName)
                || communeContains(normalizedHint, normalizedName)
                || communeContains(normalizedName, normalizedHint)
                || normalizedHint.equals(normalizedCode));
    }

    private boolean safeContains(String text, String fragment) {
        return text != null && fragment != null && fragment.length() >= 4 && text.contains(fragment);
    }

    private boolean communeContains(String text, String fragment) {
        return text != null && fragment != null && fragment.length() >= 2 && text.contains(fragment);
    }

    private List<String> normalizedSubjectHints(String hint) {
        String normalized = normalize(hint);
        if (normalized == null) {
            return List.of();
        }

        LinkedHashSet<String> variants = new LinkedHashSet<>();
        addSubjectHintVariant(variants, normalized);
        addSubjectHintVariant(variants, canonicalSubjectHint(normalized));
        return List.copyOf(variants);
    }

    private String canonicalSubjectHint(String normalized) {
        if (normalized == null) {
            return null;
        }
        String canonical = normalized
                .replaceAll("^mon\\s+", "")
                .replaceAll("\\bhoc\\b", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return canonical.isEmpty() ? null : canonical;
    }

    private void addSubjectHintVariant(LinkedHashSet<String> variants, String value) {
        if (value != null && value.length() >= 2) {
            variants.add(value);
        }
    }

    private boolean containsMatch(String normalizedHint, String value) {
        String normalizedValue = normalize(value);
        return normalizedHint != null
                && normalizedValue != null
                && normalizedValue.contains(normalizedHint);
    }

    private String normalize(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        String withoutDiacritics = DIACRITICS.matcher(Normalizer.normalize(trimmed, Normalizer.Form.NFD)).replaceAll("");
        String normalized = NON_ALNUM.matcher(withoutDiacritics.toLowerCase(Locale.ROOT)).replaceAll(" ").trim();
        return normalized.isEmpty() ? null : normalized.replaceAll("\\s+", " ");
    }

    private String normalizeLocation(String value) {
        String normalized = normalize(value);
        if (normalized == null) {
            return null;
        }
        String compact = compact(normalized);
        if (compact.equals("tphcm") || compact.equals("hcm")) {
            return "ho chi minh";
        }
        normalized = normalized
                .replaceAll("\\bthanh pho\\b", " ")
                .replaceAll("\\btp\\b", " ")
                .replaceAll("\\btinh\\b", " ")
                .replaceAll("\\bphuong\\b", " ")
                .replaceAll("\\bxa\\b", " ")
                .replaceAll("\\bquan\\b", " ")
                .replaceAll("\\bq\\s*(\\d+)\\b", "$1")
                .replaceAll("\\s+", " ")
                .trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String compact(String value) {
        return value == null ? "" : value.replace(" ", "");
    }

    private boolean sameCode(String left, String right) {
        return left != null && right != null && left.equalsIgnoreCase(right);
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private record SubjectResolution(LearningSubject subject, Clarification clarification) {
    }

    private record LevelResolution(LearningLevel level, Clarification clarification) {
    }

    private record LocationResolution(GroundedLocation location, Clarification clarification) {
    }

    public static class CatalogGroundingUnavailableException extends RuntimeException {
        public CatalogGroundingUnavailableException(String message) {
            super(message);
        }
    }

    public static class LocationGroundingUnavailableException extends RuntimeException {
        public LocationGroundingUnavailableException(String message) {
            super(message);
        }
    }
}
