package iuh.fit.contract_service.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.web3j.crypto.*;
import org.web3j.utils.Numeric;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class Eip712VerificationServiceTest {

    private Eip712VerificationService service;
    private ECKeyPair keyPair;
    private String walletAddress;

    private static final byte[] EIP191_PREFIX = new byte[]{0x19, 0x01};
    private static final byte[] DOMAIN_TYPEHASH = Hash.sha3(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    .getBytes(StandardCharsets.UTF_8)
    );
    private static final byte[] TERMINATION_REQUEST_TYPEHASH = Hash.sha3(
            "TerminationRequest(string contractId,bytes32 reasonHash,bool wholeClass,uint256 requestedAt)"
                    .getBytes(StandardCharsets.UTF_8)
    );

    @BeforeEach
    void setUp() throws Exception {
        service = new Eip712VerificationService();
        // Fixed test key for deterministic test
        BigInteger privateKey = new BigInteger("c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3", 16);
        keyPair = ECKeyPair.create(privateKey);
        walletAddress = "0x" + Keys.getAddress(keyPair);
    }

    private String signTermination(String contractId, String reasonHash, boolean wholeClass, long requestedAt, long chainId, String verifyingContract) throws Exception {
        byte[] domainSeparator = computeDomainSeparator(chainId, verifyingContract);
        byte[] contractIdHash = Hash.sha3(contractId.getBytes(StandardCharsets.UTF_8));
        byte[] reasonHashBytes = Numeric.toBytesPadded(Numeric.toBigInt(reasonHash), 32);
        byte[] wholeClassBytes = Numeric.toBytesPadded(wholeClass ? BigInteger.ONE : BigInteger.ZERO, 32);
        byte[] requestedAtBytes = Numeric.toBytesPadded(BigInteger.valueOf(requestedAt), 32);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(TERMINATION_REQUEST_TYPEHASH);
        out.write(contractIdHash);
        out.write(reasonHashBytes);
        out.write(wholeClassBytes);
        out.write(requestedAtBytes);
        byte[] structHash = Hash.sha3(out.toByteArray());

        ByteArrayOutputStream digestStream = new ByteArrayOutputStream();
        digestStream.write(EIP191_PREFIX);
        digestStream.write(domainSeparator);
        digestStream.write(structHash);
        byte[] digest = Hash.sha3(digestStream.toByteArray());

        Sign.SignatureData sigData = Sign.signMessage(digest, keyPair, false);
        byte[] sigBytes = new byte[65];
        System.arraycopy(sigData.getR(), 0, sigBytes, 0, 32);
        System.arraycopy(sigData.getS(), 0, sigBytes, 32, 32);
        sigBytes[64] = (byte) (sigData.getV()[0] >= 27 ? sigData.getV()[0] : sigData.getV()[0] + 27);
        return Numeric.toHexString(sigBytes);
    }

    private byte[] computeDomainSeparator(long chainId, String verifyingContract) throws Exception {
        byte[] nameHash = Hash.sha3("EduConnect Platform".getBytes(StandardCharsets.UTF_8));
        byte[] versionHash = Hash.sha3("1".getBytes(StandardCharsets.UTF_8));
        byte[] chainIdBytes = Numeric.toBytesPadded(BigInteger.valueOf(chainId), 32);
        byte[] contractBytes = Numeric.toBytesPadded(Numeric.toBigInt(verifyingContract), 32);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(DOMAIN_TYPEHASH);
        out.write(nameHash);
        out.write(versionHash);
        out.write(chainIdBytes);
        out.write(contractBytes);
        return Hash.sha3(out.toByteArray());
    }

    @Test
    void validTerminationSignatureVerifiesSuccessfully() throws Exception {
        String contractId = "11111111-2222-3333-4444-555555555555";
        String reasonHash = Numeric.toHexString(Hash.sha3("Gia su gap tai nan".getBytes(StandardCharsets.UTF_8)));
        boolean wholeClass = false;
        long requestedAt = 1710000000L;
        long chainId = 11155111L;
        String escrowContract = "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3";

        String signature = signTermination(contractId, reasonHash, wholeClass, requestedAt, chainId, escrowContract);

        boolean verified = service.verifyTerminationSignature(
                walletAddress,
                signature,
                contractId,
                reasonHash,
                wholeClass,
                requestedAt,
                chainId,
                escrowContract
        );

        assertThat(verified).isTrue();
    }

    @Test
    void wrongWalletAddressFailsVerification() throws Exception {
        String contractId = "11111111-2222-3333-4444-555555555555";
        String reasonHash = Numeric.toHexString(Hash.sha3("Gia su gap tai nan".getBytes(StandardCharsets.UTF_8)));
        boolean wholeClass = false;
        long requestedAt = 1710000000L;
        long chainId = 11155111L;
        String escrowContract = "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3";

        String signature = signTermination(contractId, reasonHash, wholeClass, requestedAt, chainId, escrowContract);

        String wrongWallet = "0x0000000000000000000000000000000000000001";
        boolean verified = service.verifyTerminationSignature(
                wrongWallet,
                signature,
                contractId,
                reasonHash,
                wholeClass,
                requestedAt,
                chainId,
                escrowContract
        );

        assertThat(verified).isFalse();
    }

    @Test
    void tamperedReasonHashFailsVerification() throws Exception {
        String contractId = "11111111-2222-3333-4444-555555555555";
        String reasonHash = Numeric.toHexString(Hash.sha3("Gia su gap tai nan".getBytes(StandardCharsets.UTF_8)));
        boolean wholeClass = false;
        long requestedAt = 1710000000L;
        long chainId = 11155111L;
        String escrowContract = "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3";

        String signature = signTermination(contractId, reasonHash, wholeClass, requestedAt, chainId, escrowContract);

        String tamperedReasonHash = Numeric.toHexString(Hash.sha3("Tampered Reason".getBytes(StandardCharsets.UTF_8)));
        boolean verified = service.verifyTerminationSignature(
                walletAddress,
                signature,
                contractId,
                tamperedReasonHash,
                wholeClass,
                requestedAt,
                chainId,
                escrowContract
        );

        assertThat(verified).isFalse();
    }
}
