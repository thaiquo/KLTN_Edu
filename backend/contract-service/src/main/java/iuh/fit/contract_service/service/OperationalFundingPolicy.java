package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.EscrowPaymentRepository;
import iuh.fit.contract_service.repository.ProcessedEventRepository;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/** Shared boundary for API, schedulers and recovery commands. */
@Service
public class OperationalFundingPolicy {
    private final ContractAgreementRepository agreements;
    private final EscrowPaymentRepository payments;
    private final ProcessedEventRepository events;
    private final ObjectMapper mapper;

    public OperationalFundingPolicy(ContractAgreementRepository agreements, EscrowPaymentRepository payments,
                                    ProcessedEventRepository events, ObjectMapper mapper) {
        this.agreements = agreements;
        this.payments = payments;
        this.events = events;
        this.mapper = mapper;
    }

    public boolean isFunded(ContractAgreement agreement) {
        if (agreement.isLegacyExcluded() || agreement.getChainId() == null) return false;
        return payments.findByAgreementId(agreement.getId())
                .filter(p -> p.getFundTxHash() != null && agreement.getChainId().equals(p.getChainId()))
                .map(p -> events.findByEventTypeIgnoreCaseAndChainIdAndTransactionHashIgnoreCase(
                        "AGREEMENT_FUNDED", agreement.getChainId(), p.getFundTxHash()).stream().anyMatch(event -> {
                    if (!equalsHex(event.getContractAddress(), agreement.getEscrowContractAddress())) return false;
                    try {
                        DecodedEscrowEvent decoded = mapper.readValue(event.getDecodedPayload(), DecodedEscrowEvent.class);
                        return equalsHex(decoded.agreementId(), agreement.getOnchainAgreementId())
                                && equalsHex(decoded.attributes().get("student"), agreement.getStudentWallet())
                                && agreement.getTotalAmountUsdcUnits().toString().equals(decoded.attributes().get("amount"));
                    } catch (RuntimeException invalidEvent) {
                        return false;
                    }
                })).orElse(false);
    }

    public void requireCommand(BlockchainTransactionCommand command) {
        if (command.action() == iuh.fit.contract_service.enums.BlockchainTransactionAction.REGISTER
                || command.action() == iuh.fit.contract_service.enums.BlockchainTransactionAction.EXPIRE) return;
        ContractAgreement agreement = agreements.findById(command.agreementId()).orElseThrow();
        if (agreement.getStatus() != ContractAgreementStatus.ACTIVE || !isFunded(agreement)
                || !agreement.getChainId().equals(command.chainId())
                || !equalsHex(agreement.getEscrowContractAddress(), command.toAddress())) {
            throw new IllegalStateException("Agreement is audit-only or has no matching confirmed AgreementFunded event");
        }
    }

    private static boolean equalsHex(String a, String b) {
        return a != null && b != null && a.equalsIgnoreCase(b);
    }
}
