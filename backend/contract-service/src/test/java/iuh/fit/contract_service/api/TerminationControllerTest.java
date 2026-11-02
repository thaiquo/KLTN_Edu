package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.repository.TerminationEvidenceRepository;
import iuh.fit.contract_service.service.DisputeEvidenceStorageService;
import iuh.fit.contract_service.service.TerminationService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TerminationControllerTest {

    @Test
    void actionConflictReturnsSpecificReasonInsteadOfGenericStatusTitle() throws Exception {
        TerminationService service = mock(TerminationService.class);
        CurrentUserContext users = mock(CurrentUserContext.class);
        var controller = new TerminationController(
                service,
                users,
                mock(DisputeEvidenceStorageService.class),
                mock(TerminationEvidenceRepository.class));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(controller).build();
        UUID caseId = UUID.randomUUID();
        ContractUserPrincipal principal = new ContractUserPrincipal(
                1L, "admin@test.vn", "ADMIN", List.of("ADMIN"));
        when(users.requireCurrentUser()).thenReturn(principal);
        when(service.act(eq(caseId), eq("APPROVE"), eq("Chấp nhận"), any()))
                .thenThrow(new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Learning hold is not ready; retry after synchronization"));

        mvc.perform(post("/api/contracts/terminations/{id}/actions", caseId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"APPROVE\",\"reason\":\"Chấp nhận\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message")
                        .value("Learning hold is not ready; retry after synchronization"));
    }
}
