package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.tutor.SubjectCategoryResponse;
import iuh.fit.account_service.dto.tutor.SubjectResponse;
import iuh.fit.account_service.service.SubjectService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SubjectControllerTest {

    private final SubjectService subjectService = mock(SubjectService.class);
    private final SubjectController subjectController = new SubjectController(subjectService);

    @Test
    void getSubjectsPassesKeywordCategoryAndLimitWithoutAuthenticationInput() {
        when(subjectService.getSubjects(2L, null, "java", 10)).thenReturn(List.of(
                new SubjectResponse(3L, "Java", new SubjectCategoryResponse(2L, "Cong nghe thong tin"), Set.of())
        ));

        var response = subjectController.getSubjects(2L, null, "java", 10);

        assertThat(response).hasSize(1);
        assertThat(response.get(0).getName()).isEqualTo("Java");
        verify(subjectService).getSubjects(2L, null, "java", 10);
    }
}
