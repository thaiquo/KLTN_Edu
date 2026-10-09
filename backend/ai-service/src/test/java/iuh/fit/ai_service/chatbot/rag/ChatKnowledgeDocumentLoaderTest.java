package iuh.fit.ai_service.chatbot.rag;

import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeChunk;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ChatKnowledgeDocumentLoaderTest {
    @TempDir
    Path tempDir;

    @Test
    void discoversMarkdownFilesReadsUtf8AndIgnoresUnsupportedFiles() throws Exception {
        Files.writeString(tempDir.resolve("overview.md"), """
                # Tổng quan EduConnect

                ## EduConnect là gì?

                EduConnect là nền tảng kết nối Student và Tutor.

                <!-- Source references:
                - docs/PROJECT.md
                -->
                """, StandardCharsets.UTF_8);
        Files.writeString(tempDir.resolve("notes.txt"), "ignore me", StandardCharsets.UTF_8);

        ChatKnowledgeDocumentLoader loader = new ChatKnowledgeDocumentLoader(properties());

        var documents = loader.loadDocuments();
        List<KnowledgeChunk> chunks = loader.loadChunks();

        assertThat(documents).hasSize(1);
        assertThat(documents.getFirst().title()).isEqualTo("Tổng quan EduConnect");
        assertThat(chunks).hasSize(1);
        assertThat(chunks.getFirst().content()).contains("EduConnect là nền tảng kết nối");
        assertThat(chunks.getFirst().content()).doesNotContain("Source references");
        assertThat(chunks.getFirst().roleVisibility()).containsExactly("PUBLIC", "GUEST");
    }

    @Test
    void createsHeadingBasedChunksWithStableOrderAndMetadata() throws Exception {
        Files.writeString(tempDir.resolve("account-and-roles.md"), """
                # Tài khoản và vai trò

                Mở đầu.

                ## Đăng ký tài khoản như thế nào?

                Guest có thể đăng ký tài khoản.

                ## Tôi quên mật khẩu thì làm gì?

                EduConnect có luồng quên mật khẩu.
                """, StandardCharsets.UTF_8);

        ChatKnowledgeDocumentLoader loader = new ChatKnowledgeDocumentLoader(properties());

        List<KnowledgeChunk> chunks = loader.loadChunks();

        assertThat(chunks).hasSize(2);
        assertThat(chunks).extracting(KnowledgeChunk::section)
                .containsExactly("Đăng ký tài khoản như thế nào?", "Tôi quên mật khẩu thì làm gì?");
        assertThat(chunks).extracting(KnowledgeChunk::chunkIndex).containsExactly(0, 1);
        assertThat(chunks).allSatisfy(chunk -> {
            assertThat(chunk.documentId()).isEqualTo("account-and-roles");
            assertThat(chunk.title()).isEqualTo("Tài khoản và vai trò");
            assertThat(chunk.content()).isNotBlank();
            assertThat(chunk.contentHash()).hasSize(64);
        });
    }

    private ChatKnowledgeProperties properties() {
        return new ChatKnowledgeProperties(tempDir.toString(), "educonnect_chatbot_knowledge_v1", 768, 4, 0.35, 1);
    }
}
