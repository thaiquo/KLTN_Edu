package iuh.fit.ai_service.chatbot.rag;

import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeChunk;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeDocument;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Component
public class ChatKnowledgeDocumentLoader {
    private static final Pattern SOURCE_COMMENT = Pattern.compile("(?s)<!--\\s*Source references:.*?-->");
    private static final Pattern HTML_COMMENT = Pattern.compile("(?s)<!--.*?-->");
    private static final List<String> ROLE_VISIBILITY = List.of("PUBLIC", "GUEST");

    private final ChatKnowledgeProperties properties;

    public ChatKnowledgeDocumentLoader(ChatKnowledgeProperties properties) {
        this.properties = properties;
    }

    public List<KnowledgeDocument> loadDocuments() {
        Path directory = resolveKnowledgeDirectory();
        if (!Files.isDirectory(directory)) {
            throw new ChatKnowledgeException("Chatbot knowledge directory not found: " + directory.toAbsolutePath());
        }
        try (var paths = Files.list(directory)) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".md"))
                    .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                    .map(this::readDocument)
                    .toList();
        } catch (IOException exception) {
            throw new ChatKnowledgeException("Failed to list chatbot knowledge files: " + exception.getMessage(), exception);
        }
    }

    public List<KnowledgeChunk> loadChunks() {
        List<KnowledgeChunk> chunks = new ArrayList<>();
        for (KnowledgeDocument document : loadDocuments()) {
            chunks.addAll(chunk(document));
        }
        return chunks;
    }

    public List<KnowledgeChunk> chunk(KnowledgeDocument document) {
        List<SectionBuilder> sections = new ArrayList<>();
        SectionBuilder current = null;
        String title = document.title();
        StringBuilder preamble = new StringBuilder();
        boolean hasSectionHeading = false;

        for (String rawLine : document.content().split("\\R")) {
            String line = rawLine.stripTrailing();
            if (line.startsWith("# ")) {
                title = cleanHeading(line.substring(2));
                continue;
            }
            if (line.startsWith("## ")) {
                hasSectionHeading = true;
                if (current != null && StringUtils.hasText(current.content())) {
                    sections.add(current);
                }
                current = new SectionBuilder(cleanHeading(line.substring(3)));
                continue;
            }
            if (current == null) {
                if (StringUtils.hasText(line)) {
                    if (preamble.length() > 0) {
                        preamble.append('\n');
                    }
                    preamble.append(line);
                }
            } else {
                current.append(line);
            }
        }
        if (current != null && StringUtils.hasText(current.content())) {
            sections.add(current);
        }
        if (!hasSectionHeading && StringUtils.hasText(preamble.toString())) {
            sections.add(new SectionBuilder(title).appendAndReturn(preamble.toString()));
        }

        List<KnowledgeChunk> chunks = new ArrayList<>();
        int index = 0;
        for (SectionBuilder section : sections) {
            String content = normalizeWhitespace(section.content());
            if (!StringUtils.hasText(content)) {
                continue;
            }
            chunks.add(new KnowledgeChunk(
                    document.documentId(),
                    title,
                    section.section(),
                    document.category(),
                    document.sourceName(),
                    index++,
                    title + "\n" + section.section() + "\n" + content,
                    sha256(document.documentId() + "|" + section.section() + "|" + content),
                    ROLE_VISIBILITY
            ));
        }
        return chunks;
    }

    private KnowledgeDocument readDocument(Path path) {
        try {
            String raw = Files.readString(path, StandardCharsets.UTF_8);
            String cleaned = cleanMarkdown(raw);
            String title = extractTitle(cleaned, path.getFileName().toString());
            String sourceName = path.getFileName().toString();
            String documentId = sourceName.replaceFirst("(?i)\\.md$", "");
            return new KnowledgeDocument(
                    documentId,
                    title,
                    categoryFromDocumentId(documentId),
                    sourceName,
                    sourceName,
                    cleaned
            );
        } catch (IOException exception) {
            throw new ChatKnowledgeException("Failed to read chatbot knowledge file " + path.getFileName() + ": "
                    + exception.getMessage(), exception);
        }
    }

    private Path resolveKnowledgeDirectory() {
        Path configured = Path.of(properties.knowledgeDirectory());
        if (configured.isAbsolute()) {
            return configured.normalize();
        }
        List<Path> candidates = List.of(
                configured,
                Path.of("..", "..", properties.knowledgeDirectory()),
                Path.of("..", properties.knowledgeDirectory())
        );
        return candidates.stream()
                .map(Path::normalize)
                .filter(Files::isDirectory)
                .findFirst()
                .orElse(candidates.getFirst().normalize());
    }

    private String cleanMarkdown(String raw) {
        String noSource = SOURCE_COMMENT.matcher(raw == null ? "" : raw).replaceAll("");
        String noComments = HTML_COMMENT.matcher(noSource).replaceAll("");
        return normalizeWhitespace(noComments);
    }

    private String extractTitle(String content, String fallback) {
        for (String line : content.split("\\R")) {
            if (line.startsWith("# ")) {
                return cleanHeading(line.substring(2));
            }
        }
        return fallback.replaceFirst("(?i)\\.md$", "");
    }

    private String categoryFromDocumentId(String documentId) {
        return documentId == null ? "general" : documentId.replace('-', '_');
    }

    private String cleanHeading(String value) {
        return value == null ? "" : value.replace("#", "").trim();
    }

    private String normalizeWhitespace(String value) {
        if (value == null) {
            return "";
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFC)
                .replace("\uFEFF", "")
                .replaceAll("[ \\t]+", " ")
                .replaceAll("\\R{3,}", "\n\n")
                .trim();
        return normalized;
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private static final class SectionBuilder {
        private final String section;
        private final StringBuilder content = new StringBuilder();

        private SectionBuilder(String section) {
            this.section = section;
        }

        private void append(String line) {
            if (content.length() > 0) {
                content.append('\n');
            }
            content.append(line == null ? "" : line);
        }

        private SectionBuilder appendAndReturn(String line) {
            append(line);
            return this;
        }

        private String section() {
            return section;
        }

        private String content() {
            return content.toString();
        }
    }
}
