package iuh.fit.contract_service.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.net.URI;
import java.util.regex.Pattern;

@Validated
@ConfigurationProperties(prefix = "blockchain")
public class BlockchainProperties {
    private static final Pattern ETHEREUM_ADDRESS = Pattern.compile("^0x[0-9a-fA-F]{40}$");

    private boolean enabled;
    private long chainId;
    private URI rpcUrl;
    private String escrowAddress;
    private String usdcAddress;

    @Min(0)
    @Max(18)
    private int tokenDecimals = 6;

    @Min(1)
    private int confirmations = 1;

    @Min(0)
    private long startBlock;

    @Min(1)
    @Max(10_000)
    private int eventBlockBatchSize = 500;

    @AssertTrue(message = "enabled blockchain configuration requires chain ID, HTTP(S) RPC URL, and valid distinct contract/token addresses")
    public boolean isCompleteWhenEnabled() {
        if (!enabled) {
            return true;
        }
        return chainId > 0
                && isHttpRpc(rpcUrl)
                && isAddress(escrowAddress)
                && isAddress(usdcAddress)
                && !escrowAddress.equalsIgnoreCase(usdcAddress);
    }

    private static boolean isHttpRpc(URI value) {
        if (value == null || value.getScheme() == null || value.getHost() == null) {
            return false;
        }
        return value.getScheme().equalsIgnoreCase("http")
                || value.getScheme().equalsIgnoreCase("https");
    }

    private static boolean isAddress(String value) {
        return value != null && ETHEREUM_ADDRESS.matcher(value).matches();
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public long getChainId() {
        return chainId;
    }

    public void setChainId(long chainId) {
        this.chainId = chainId;
    }

    public URI getRpcUrl() {
        return rpcUrl;
    }

    public void setRpcUrl(URI rpcUrl) {
        this.rpcUrl = rpcUrl;
    }

    public String getEscrowAddress() {
        return escrowAddress;
    }

    public void setEscrowAddress(String escrowAddress) {
        this.escrowAddress = escrowAddress;
    }

    public String getUsdcAddress() {
        return usdcAddress;
    }

    public void setUsdcAddress(String usdcAddress) {
        this.usdcAddress = usdcAddress;
    }

    public int getConfirmations() {
        return confirmations;
    }

    public void setConfirmations(int confirmations) {
        this.confirmations = confirmations;
    }

    public int getTokenDecimals() {
        return tokenDecimals;
    }

    public void setTokenDecimals(int tokenDecimals) {
        this.tokenDecimals = tokenDecimals;
    }

    public long getStartBlock() {
        return startBlock;
    }

    public void setStartBlock(long startBlock) {
        this.startBlock = startBlock;
    }

    public int getEventBlockBatchSize() {
        return eventBlockBatchSize;
    }

    public void setEventBlockBatchSize(int eventBlockBatchSize) {
        this.eventBlockBatchSize = eventBlockBatchSize;
    }
}
