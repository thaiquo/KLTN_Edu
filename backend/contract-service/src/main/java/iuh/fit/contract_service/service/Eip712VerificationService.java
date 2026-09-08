package iuh.fit.contract_service.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Hash;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;

@Service
public class Eip712VerificationService {

    private static final Logger log = LoggerFactory.getLogger(Eip712VerificationService.class);

    private static final byte[] EIP191_PREFIX = new byte[]{0x19, 0x01};

    // EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
    private static final byte[] DOMAIN_TYPEHASH = Hash.sha3(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    .getBytes(StandardCharsets.UTF_8)
    );

    // ClassContract(string contractId,address tutorAddress,address studentAddress,uint256 totalAmountUsdc,bytes32 termsHash,uint256 createdAt)
    private static final byte[] CLASS_CONTRACT_TYPEHASH = Hash.sha3(
            "ClassContract(string contractId,address tutorAddress,address studentAddress,uint256 totalAmountUsdc,bytes32 termsHash,uint256 createdAt)"
                    .getBytes(StandardCharsets.UTF_8)
    );

    public boolean verifySignature(
            String expectedSignerWallet,
            String signature,
            String contractId,
            String tutorAddress,
            String studentAddress,
            BigInteger totalAmountUsdc,
            String termsHash,
            long createdAtTimestamp,
            long chainId,
            String verifyingContractAddress) {

        if (signature == null || signature.isBlank() || expectedSignerWallet == null || expectedSignerWallet.isBlank()) {
            return false;
        }

        try {
            byte[] domainSeparator = computeDomainSeparator(chainId, verifyingContractAddress);
            byte[] structHash = computeStructHash(
                    contractId,
                    tutorAddress,
                    studentAddress,
                    totalAmountUsdc,
                    termsHash,
                    createdAtTimestamp
            );

            // Digest = keccak256("\x19\x01" + domainSeparator + structHash)
            ByteArrayOutputStream digestStream = new ByteArrayOutputStream();
            digestStream.write(EIP191_PREFIX);
            digestStream.write(domainSeparator);
            digestStream.write(structHash);
            byte[] digest = Hash.sha3(digestStream.toByteArray());

            // Recover signer address from signature
            String recovered = recoverAddressFromDigest(digest, signature);
            boolean matches = recovered != null && recovered.equalsIgnoreCase(expectedSignerWallet.trim());

            if (!matches) {
                log.warn("EIP-712 signature mismatch: expected {}, recovered {}", expectedSignerWallet, recovered);
            }
            return matches;

        } catch (Exception e) {
            log.error("Error during EIP-712 signature verification: {}", e.getMessage(), e);
            return false;
        }
    }

    public String recoverAddressFromDigest(byte[] digest, String signatureHex) {
        try {
            byte[] signatureBytes = Numeric.hexStringToByteArray(signatureHex);
            if (signatureBytes.length != 65) {
                return null;
            }

            byte v = signatureBytes[64];
            if (v < 27) {
                v += 27;
            }

            byte[] r = Arrays.copyOfRange(signatureBytes, 0, 32);
            byte[] s = Arrays.copyOfRange(signatureBytes, 32, 64);
            Sign.SignatureData signatureData = new Sign.SignatureData(v, r, s);

            BigInteger publicKey = Sign.signedMessageHashToKey(digest, signatureData);
            if (publicKey == null) {
                return null;
            }

            return "0x" + Keys.getAddress(publicKey).toLowerCase(Locale.ROOT);
        } catch (Exception e) {
            log.warn("Failed to recover address from signature: {}", e.getMessage());
            return null;
        }
    }

    private byte[] computeDomainSeparator(long chainId, String verifyingContract) throws Exception {
        byte[] nameHash = Hash.sha3("EduConnect Platform".getBytes(StandardCharsets.UTF_8));
        byte[] versionHash = Hash.sha3("1".getBytes(StandardCharsets.UTF_8));
        byte[] chainIdBytes = toUint256(BigInteger.valueOf(chainId));
        byte[] contractBytes = toAddress(verifyingContract);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(DOMAIN_TYPEHASH);
        out.write(nameHash);
        out.write(versionHash);
        out.write(chainIdBytes);
        out.write(contractBytes);

        return Hash.sha3(out.toByteArray());
    }

    private byte[] computeStructHash(
            String contractId,
            String tutorAddress,
            String studentAddress,
            BigInteger totalAmountUsdc,
            String termsHash,
            long createdAt) throws Exception {

        byte[] contractIdHash = Hash.sha3(contractId.getBytes(StandardCharsets.UTF_8));
        byte[] tutorBytes = toAddress(tutorAddress);
        byte[] studentBytes = toAddress(studentAddress);
        byte[] amountBytes = toUint256(totalAmountUsdc != null ? totalAmountUsdc : BigInteger.ZERO);
        byte[] termsHashBytes = toBytes32(termsHash);
        byte[] createdAtBytes = toUint256(BigInteger.valueOf(createdAt));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(CLASS_CONTRACT_TYPEHASH);
        out.write(contractIdHash);
        out.write(tutorBytes);
        out.write(studentBytes);
        out.write(amountBytes);
        out.write(termsHashBytes);
        out.write(createdAtBytes);

        return Hash.sha3(out.toByteArray());
    }

    private byte[] toUint256(BigInteger value) {
        byte[] raw = Numeric.toBytesPadded(value, 32);
        return raw;
    }

    private byte[] toAddress(String address) {
        BigInteger val = Numeric.toBigInt(address);
        return Numeric.toBytesPadded(val, 32);
    }

    private byte[] toBytes32(String hex32) {
        byte[] raw = Numeric.hexStringToByteArray(hex32);
        if (raw.length == 32) {
            return raw;
        }
        return Numeric.toBytesPadded(Numeric.toBigInt(hex32), 32);
    }
}
