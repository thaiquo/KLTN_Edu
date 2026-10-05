package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.service.semantic.StudentSemanticQueryBuilder.StudentSemanticQueryInput;
import iuh.fit.ai_service.service.semantic.TutorSemanticDocumentBuilder.TutorSemanticDocumentInput;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SemanticTextBuilderTest {

    private final StudentSemanticQueryBuilder studentBuilder = new StudentSemanticQueryBuilder();
    private final TutorSemanticDocumentBuilder tutorBuilder = new TutorSemanticDocumentBuilder();

    @Test
    void buildsStudentSemanticQueryFromLearningNeedFields() {
        String text = studentBuilder.build(new StudentSemanticQueryInput(
                "Toan",
                "Lop 10",
                "Can cung co ham so va hinh hoc",
                List.of("ham so", "hinh hoc", "ham so"),
                List.of("giai thich cham", "co bai tap thuc hanh")
        ));

        assertThat(text)
                .startsWith("task: search result | query: ")
                .contains("Subject: Toan")
                .contains("Level: Lop 10")
                .contains("Learning goal: Can cung co ham so va hinh hoc")
                .contains("Weak topics: ham so, hinh hoc")
                .contains("Tutor preferences: giai thich cham, co bai tap thuc hanh");
    }

    @Test
    void studentSemanticQueryContainsOnlyLearningNeedFields() {
        String text = studentBuilder.build(new StudentSemanticQueryInput(
                "Toan",
                "Lop 12",
                "Muon on hinh hoc khong gian",
                List.of("hinh hoc khong gian"),
                List.of("day cham")
        ));

        assertThat(text)
                .doesNotContain("studentId")
                .doesNotContain("userId")
                .doesNotContain("email")
                .doesNotContain("phone")
                .doesNotContain("JWT")
                .doesNotContain("cookie")
                .doesNotContain("KYC")
                .doesNotContain("contract")
                .doesNotContain("payment")
                .doesNotContain("dispute")
                .doesNotContain("private message");
    }

    @Test
    void studentSemanticQueryRequiresAtLeastOneField() {
        assertThatThrownBy(() -> studentBuilder.build(new StudentSemanticQueryInput(
                " ",
                null,
                "",
                List.of(),
                null
        ))).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least one semantic field");
    }

    @Test
    void buildsTutorSemanticDocumentFromPublicTutorFields() {
        String text = tutorBuilder.build(new TutorSemanticDocumentInput(
                "Gia su Toan THPT, uu tien nen tang",
                "Toan",
                "Khoa hoc tu nhien",
                "Lop 10",
                4,
                "Day cham, nhieu vi du va bai tap"
        ));

        assertThat(text)
                .startsWith("title: none | text: ")
                .contains("Tutor bio: Gia su Toan THPT")
                .contains("Subject: Toan")
                .contains("Category: Khoa hoc tu nhien")
                .contains("Level: Lop 10")
                .contains("Experience context: 4 years")
                .contains("Teaching description: Day cham");
    }

    @Test
    void tutorSemanticDocumentRequiresAtLeastOneField() {
        assertThatThrownBy(() -> tutorBuilder.build(new TutorSemanticDocumentInput(
                null,
                " ",
                "",
                null,
                null,
                ""
        ))).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least one public semantic field");
    }
}
