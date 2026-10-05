package iuh.fit.ai_service.service.semantic;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Component
public class ClassSemanticQueryBuilder {
    public String build(ClassSemanticQueryInput input) {
        if (input == null) {
            throw new IllegalArgumentException("Class semantic query input is required.");
        }
        List<String> lines = new ArrayList<>();
        add(lines, "Subject", input.subjectName());
        add(lines, "Level", input.levelName());
        add(lines, "Learning goal", input.learningGoal());
        addItems(lines, "Weak topic", input.weakTopics());
        addItems(lines, "Class preference", input.classPreferences());
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("Class semantic query must contain at least one semantic field.");
        }
        return "title: student class search | text: " + String.join(System.lineSeparator(), lines);
    }

    private void add(List<String> lines, String label, String value) {
        if (StringUtils.hasText(value)) {
            lines.add(label + ": " + value.trim());
        }
    }

    private void addItems(List<String> lines, String label, List<String> values) {
        if (values == null) {
            return;
        }
        values.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .forEach(value -> lines.add(label + ": " + value));
    }

    public record ClassSemanticQueryInput(
            String subjectName,
            String levelName,
            String learningGoal,
            List<String> weakTopics,
            List<String> classPreferences
    ) {
    }
}
