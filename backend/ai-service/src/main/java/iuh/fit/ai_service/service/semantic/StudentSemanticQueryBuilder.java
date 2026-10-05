package iuh.fit.ai_service.service.semantic;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Component
public class StudentSemanticQueryBuilder {
    public String build(StudentSemanticQueryInput input) {
        if (input == null) {
            throw new IllegalArgumentException("Student semantic query input is required.");
        }
        List<String> lines = new ArrayList<>();
        add(lines, "Subject", input.subjectName());
        add(lines, "Level", input.levelName());
        add(lines, "Learning goal", input.learningGoal());
        addList(lines, "Weak topics", input.weakTopics());
        addList(lines, "Tutor preferences", input.tutorPreferences());
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("Student semantic query must contain at least one semantic field.");
        }
        return "task: search result | query: " + String.join(System.lineSeparator(), lines);
    }

    private void add(List<String> lines, String label, String value) {
        if (StringUtils.hasText(value)) {
            lines.add(label + ": " + value.trim());
        }
    }

    private void addList(List<String> lines, String label, List<String> values) {
        List<String> cleaned = values == null ? List.of() : values.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();
        if (!cleaned.isEmpty()) {
            lines.add(label + ": " + String.join(", ", cleaned));
        }
    }

    public record StudentSemanticQueryInput(
            String subjectName,
            String levelName,
            String learningGoal,
            List<String> weakTopics,
            List<String> tutorPreferences
    ) {
    }
}
