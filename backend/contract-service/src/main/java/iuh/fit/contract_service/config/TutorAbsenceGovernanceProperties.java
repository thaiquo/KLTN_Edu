package iuh.fit.contract_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;

@ConfigurationProperties(prefix = "tutor.absence.governance")
public record TutorAbsenceGovernanceProperties(String mode, String classroomIds) {

    public enum Mode { OFF, SHADOW, ENFORCE }

    public TutorAbsenceGovernanceProperties() {
        this("OFF", "");
    }

    public TutorAbsenceGovernanceProperties(String mode) {
        this(mode, "");
    }

    public Mode resolvedMode() {
        if (mode == null || mode.isBlank()) return Mode.OFF;
        try {
            return Mode.valueOf(mode.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return Mode.OFF;
        }
    }

    public Mode getEffectiveMode(Long classroomId) {
        if (isEnabledFor(classroomId)) return Mode.ENFORCE;
        if (isShadowFor(classroomId)) return Mode.SHADOW;
        return Mode.OFF;
    }

    public boolean isEnabledFor(Long classroomId) {
        Mode m = resolvedMode();
        if (m != Mode.ENFORCE || classroomId == null) return false;
        Set<Long> allowlist = parseAllowlist();
        if (!hasConfiguredAllowlist()) {
            return m == Mode.ENFORCE;
        }
        return allowlist.contains(classroomId);
    }

    public boolean isShadowFor(Long classroomId) {
        Mode m = resolvedMode();
        if (m == Mode.OFF || classroomId == null) return false;
        Set<Long> allowlist = parseAllowlist();
        if (m == Mode.SHADOW) return true;
        return hasConfiguredAllowlist() && !allowlist.contains(classroomId);
    }

    private boolean hasConfiguredAllowlist() {
        return classroomIds != null && !classroomIds.isBlank();
    }

    private Set<Long> parseAllowlist() {
        if (classroomIds == null || classroomIds.isBlank()) return Collections.emptySet();
        return Arrays.stream(classroomIds.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(value -> {
                    try {
                        return Long.parseLong(value);
                    } catch (NumberFormatException error) {
                        return null;
                    }
                })
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
    }
}
