-- Preserve historical signatures, payments and failed transaction hashes.
-- These exact Sepolia agreements were verified NONE on-chain on 2026-09-12.
ALTER TABLE contract_agreement ADD COLUMN legacy_excluded BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE contract_agreement SET legacy_excluded = TRUE, updated_at = CURRENT_TIMESTAMP
WHERE id IN ('1d30dead-c614-4db3-90f1-6de62dece56a', '49ac05d6-f58a-48b5-8973-d5cfd19c9658',
             'dfd0ca2d-9060-46c3-af63-9b841547d13f', '64103f50-c735-4e38-9d73-5bfc9b447f3b')
  AND chain_id = 11155111
  AND LOWER(escrow_contract_address) = '0x984bec42561bbc9f63bee4ba1469872cd369d3b3'
  AND NOT EXISTS (SELECT 1 FROM escrow_payment p JOIN processed_event e
      ON e.chain_id = p.chain_id AND LOWER(e.transaction_hash) = LOWER(p.fund_tx_hash)
      AND e.event_type = 'AGREEMENT_FUNDED'
      WHERE p.agreement_id = contract_agreement.id);

UPDATE session_settlement SET status = 'EXCLUDED_LEGACY', updated_at = CURRENT_TIMESTAMP
WHERE agreement_id IN (SELECT id FROM contract_agreement WHERE legacy_excluded = TRUE)
  AND status IN ('PREPARING', 'PROPOSE_PENDING', 'FAILED_RETRYABLE')
  AND propose_tx_hash IS NULL AND finalize_tx_hash IS NULL;
