package iuh.fit.contract_service.service;

import org.springframework.jdbc.core.JdbcTemplate;
import java.util.UUID;
import java.util.Map;
import tools.jackson.databind.ObjectMapper;

final class FundingTestEvidence {
    static void insert(JdbcTemplate jdbc, UUID id) {
        var a = jdbc.queryForMap("SELECT * FROM contract_agreement WHERE id = ?", id);
        if (!"ACTIVE".equals(a.get("status"))) return;
        String tx = org.web3j.crypto.Hash.sha3String("fund:" + id);
        jdbc.update("""
                INSERT INTO escrow_payment (id, agreement_id, chain_id, token_address, escrow_contract_address,
                    expected_amount, fund_tx_hash, status, version, created_at, updated_at)
                SELECT ?, id, chain_id, token_address, escrow_contract_address, total_amount_usdc_units,
                    ?, 'LOCKED', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM contract_agreement WHERE id = ?
                """, UUID.randomUUID(), tx, id);
        String payload = new ObjectMapper().writeValueAsString(Map.of(
                "type", "AGREEMENT_FUNDED", "agreementId", a.get("onchain_agreement_id"),
                "attributes", Map.of("student", a.get("student_wallet"),
                        "amount", a.get("total_amount_usdc_units").toString())));
        jdbc.update("""
                INSERT INTO processed_event (id, consumer_name, event_id, event_type, processed_at,
                    chain_id, contract_address, transaction_hash, log_index, block_number, block_hash, decoded_payload)
                VALUES (?, 'test-funding', ?, 'AGREEMENT_FUNDED', CURRENT_TIMESTAMP, ?, ?, ?, 0, 1, ?, ?)
                """, UUID.randomUUID(), UUID.randomUUID(), a.get("chain_id"), a.get("escrow_contract_address"),
                tx, "0x" + "11".repeat(32), payload);
    }
}
