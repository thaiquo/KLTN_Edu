package iuh.fit.contract_service.blockchain;

public class BlockchainReorgDetectedException extends RuntimeException {
    public BlockchainReorgDetectedException(long blockNumber, String expectedHash, String actualHash) {
        super("Block hash mismatch at " + blockNumber + ": expected " + expectedHash + ", actual " + actualHash);
    }
}
