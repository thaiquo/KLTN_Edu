package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.dto.ClassMatchingDtos.ChapterBrief;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Component
public class ClassSemanticDocumentBuilder {
    public String build(ClassSemanticDocumentInput input) {
        if (input == null) {
            throw new IllegalArgumentException("Class semantic document input is required.");
        }
        List<String> lines = new ArrayList<>();
        add(lines, "Class title", input.classTitle());
        add(lines, "Class description", input.classDescription());
        add(lines, "Subject", input.subjectName());
        add(lines, "Category", input.categoryName());
        add(lines, "Level", input.levelName());
        if (input.chapters() != null) {
            input.chapters().stream()
                    .filter(chapter -> chapter != null && (StringUtils.hasText(chapter.title()) || StringUtils.hasText(chapter.description())))
                    .sorted((left, right) -> {
                        int leftOrder = left.orderIndex() == null ? 0 : left.orderIndex();
                        int rightOrder = right.orderIndex() == null ? 0 : right.orderIndex();
                        return Integer.compare(leftOrder, rightOrder);
                    })
                    .forEach(chapter -> {
                        add(lines, "Chapter title", chapter.title());
                        add(lines, "Chapter description", chapter.description());
                    });
        }
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("Class semantic document must contain at least one public semantic field.");
        }
        return "title: " + safe(input.classTitle()) + " | text: " + String.join(System.lineSeparator(), lines);
    }

    private void add(List<String> lines, String label, String value) {
        if (StringUtils.hasText(value)) {
            lines.add(label + ": " + value.trim());
        }
    }

    private String safe(String value) {
        return StringUtils.hasText(value) ? value.trim() : "none";
    }

    public record ClassSemanticDocumentInput(
            String classTitle,
            String classDescription,
            String subjectName,
            String categoryName,
            String levelName,
            List<ChapterBrief> chapters
    ) {
    }
}
