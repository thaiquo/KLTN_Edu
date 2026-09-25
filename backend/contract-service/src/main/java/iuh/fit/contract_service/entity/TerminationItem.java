package iuh.fit.contract_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "termination_item")
@Getter @Setter
public class TerminationItem {
    @Id private UUID agreementId;
    private UUID caseId;
    private String status;
    @Column(columnDefinition = "TEXT") private String lastError;
    private String transactionHash;
    @Column(precision = 78, scale = 0) private BigInteger refundedUnits;
    private OffsetDateTime updatedAt;
}
