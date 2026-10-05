package iuh.fit.ai_service.service.semantic;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Component
public class TutorSemanticDocumentBuilder {
    public String build(TutorSemanticDocumentInput input) {
        if (input == null) {
            throw new IllegalArgumentException("Tutor semantic document input is required.");
        }
        List<String> lines = new ArrayList<>();
        add(lines, "Tutor bio", input.bio());
        add(lines, "Subject", input.subjectName());
        add(lines, "Category", input.categoryName());
        add(lines, "Level", input.levelName());
        if (input.experienceYears() != null && input.experienceYears() >= 0) {
            lines.add("Experience context: " + input.experienceYears() + " years teaching this capability");
        }
        add(lines, "Teaching description", input.capabilityDescription());
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("Tutor semantic document must contain at least one public semantic field.");
        }
        return "title: none | text: " + String.join(System.lineSeparator(), lines);
    }

    private void add(List<String> lines, String label, String value) {
        if (StringUtils.hasText(value)) {
            lines.add(label + ": " + value.trim());
        }
    }

    public record TutorSemanticDocumentInput(
            String bio,
            String subjectName,
            String categoryName,
            String levelName,
            Integer experienceYears,
            String capabilityDescription
    ) {
    }
}
