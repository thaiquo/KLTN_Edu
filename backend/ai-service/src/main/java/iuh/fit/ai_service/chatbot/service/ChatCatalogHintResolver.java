package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.client.LearningCatalogClient;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCatalogSnapshot;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningLevel;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningSubject;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class ChatCatalogHintResolver {
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_ALNUM = Pattern.compile("[^\\p{IsAlphabetic}\\p{IsDigit}]+");
    private static final Set<String> CONTEXT_TOKENS = Set.of(
            "gia", "su", "lop", "hoc", "day", "tim", "online", "offline", "truc", "tiep",
            "on", "thi", "thpt", "quoc", "giai", "de", "van", "dung", "buoc", "suy", "luan",
            "kinh", "nghiem", "nam", "lo", "trinh", "nang", "cao", "tap", "trung", "uu", "tien"
    );

    private final LearningCatalogClient catalogClient;

    public ChatCatalogHintResolver(LearningCatalogClient catalogClient) {
        this.catalogClient = catalogClient;
    }

    public Optional<SubjectHint> subjectHint(String message) {
        String normalizedMessage = normalize(message);
        if (normalizedMessage.isBlank()) {
            return Optional.empty();
        }
        LearningCatalogSnapshot snapshot = catalogClient.groundingSnapshot();
        List<LearningSubject> subjects = snapshot == null || snapshot.subjects() == null ? List.of() : snapshot.subjects();
        return subjects.stream()
                .filter(subject -> subjectMatches(normalizedMessage, subject))
                .findFirst()
                .map(subject -> new SubjectHint(subject.id(), subject.name(), levels(subject)));
    }

    private List<LevelHint> levels(LearningSubject subject) {
        if (subject == null || subject.levels() == null) {
            return List.of();
        }
        return subject.levels().stream()
                .filter(level -> level != null && level.id() != null && hasText(level.name()))
                .map(level -> new LevelHint(level.id(), level.code(), level.name()))
                .toList();
    }

    private boolean subjectMatches(String normalizedMessage, LearningSubject subject) {
        String name = normalize(subject.name());
        String code = normalize(subject.code());
        if (hasText(name) && (containsTokenSequence(normalizedMessage, name) || subjectTokenInMessage(normalizedMessage, name))) {
            return true;
        }
        return hasText(code) && containsTokenSequence(normalizedMessage, code);
    }

    private boolean containsTokenSequence(String text, String sequence) {
        return text.equals(sequence)
                || text.startsWith(sequence + " ")
                || text.endsWith(" " + sequence)
                || text.contains(" " + sequence + " ");
    }

    private boolean subjectTokenInMessage(String text, String subjectName) {
        if (subjectName.length() < 4) {
            return false;
        }
        for (String token : subjectName.split(" ")) {
            if (CONTEXT_TOKENS.contains(token)) {
                continue;
            }
            if (token.length() >= 4 && containsTokenSequence(text, token)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String repaired = repairMojibake(value);
        String withoutDiacritics = DIACRITICS.matcher(Normalizer.normalize(repaired, Normalizer.Form.NFD)).replaceAll("");
        String normalized = NON_ALNUM.matcher(withoutDiacritics.toLowerCase(Locale.ROOT)
                .replace("\u0111", "d")
                .replace("\u0110", "d")).replaceAll(" ").trim();
        return normalized.replaceAll("\\s+", " ");
    }

    private String repairMojibake(String value) {
        if (value == null || (!value.contains("Ã") && !value.contains("Â") && !value.contains("áº") && !value.contains("á»"))) {
            return value;
        }
        try {
            return new String(value.getBytes(StandardCharsets.ISO_8859_1), StandardCharsets.UTF_8);
        } catch (RuntimeException exception) {
            return value;
        }
    }

    public record SubjectHint(Long id, String name, List<LevelHint> levels) {
        public SubjectHint(Long id, String name) {
            this(id, name, List.of());
        }
    }

    public record LevelHint(Long id, String code, String name) {
    }
}
