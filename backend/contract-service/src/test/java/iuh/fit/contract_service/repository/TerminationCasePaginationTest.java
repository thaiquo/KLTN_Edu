package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.TerminationCase;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@Transactional
class TerminationCasePaginationTest {
    private static final Sort STABLE_SORT = Sort.by(
            Sort.Order.desc("createdAt"),
            Sort.Order.desc("id"));

    @Autowired
    private TerminationCaseRepository repository;

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 10, 11, 100, 1000})
    void databasePaginationKeepsRequestedPageSizeAndTotal(int count) {
        seed(count);

        var first = repository.findAll(PageRequest.of(0, 10, STABLE_SORT));
        var second = repository.findAll(PageRequest.of(1, 10, STABLE_SORT));

        assertThat(first.getTotalElements()).isEqualTo(count);
        assertThat(first.getContent()).hasSize(Math.min(10, count));
        assertThat(second.getContent()).hasSize(Math.min(10, Math.max(0, count - 10)));
        var firstIds = new HashSet<>(first.getContent().stream().map(TerminationCase::getId).toList());
        var secondIds = new HashSet<>(second.getContent().stream().map(TerminationCase::getId).toList());
        assertThat(java.util.Collections.disjoint(firstIds, secondIds)).isTrue();
    }

    @Test
    void stableSortDoesNotDuplicateOrSkipRowsAcrossPages() {
        seed(100);
        List<UUID> ids = new ArrayList<>();

        for (int page = 0; page < 10; page++) {
            ids.addAll(repository.findAll(PageRequest.of(page, 10, STABLE_SORT)).stream()
                    .map(TerminationCase::getId)
                    .toList());
        }

        assertThat(ids).hasSize(100);
        assertThat(new HashSet<>(ids)).hasSize(100);
        assertThat(repository.findAll(PageRequest.of(10, 10, STABLE_SORT)).getContent()).isEmpty();
    }

    private void seed(int count) {
        repository.deleteAll();
        OffsetDateTime base = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        List<TerminationCase> rows = new ArrayList<>(count);
        for (int index = 0; index < count; index++) {
            TerminationCase row = new TerminationCase();
            row.setId(UUID.randomUUID());
            row.setAnchorAgreementId(UUID.randomUUID());
            row.setClassroomId((long) (index % 20 + 1));
            row.setReason("pagination-" + index);
            row.setRequestedBy("test@educonnect.local");
            row.setStatus(index % 2 == 0 ? "REQUESTED" : "RECOMMENDED");
            row.setOrigin("PARTY_REQUEST");
            row.setCreatedAt(base.plusSeconds(index / 2));
            row.setAuditJson("[]");
            rows.add(row);
        }
        repository.saveAllAndFlush(rows);
    }
}
