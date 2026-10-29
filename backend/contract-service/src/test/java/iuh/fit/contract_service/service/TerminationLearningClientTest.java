package iuh.fit.contract_service.service;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TerminationLearningClientTest {

    @Test
    void snapshotDeserializationSupportsClassCancelled() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        String jsonWithFlag = "{\"cutoffSession\":1,\"requiredSessions\":[1],\"nextSessionStart\":null,\"classCancelled\":true}";
        var snapshot = mapper.readValue(jsonWithFlag, TerminationLearningClient.Snapshot.class);
        assertThat(snapshot.cutoffSession()).isEqualTo(1);
        assertThat(snapshot.requiredSessions()).containsExactly(1L);
        assertThat(snapshot.classCancelled()).isTrue();

        String jsonWithoutFlag = "{\"cutoffSession\":2,\"requiredSessions\":[1,2],\"nextSessionStart\":null}";
        var snapshotLegacy = mapper.readValue(jsonWithoutFlag, TerminationLearningClient.Snapshot.class);
        assertThat(snapshotLegacy.cutoffSession()).isEqualTo(2);
        assertThat(Boolean.TRUE.equals(snapshotLegacy.classCancelled())).isFalse();
    }
}
