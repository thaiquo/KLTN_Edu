package iuh.fit.contract_service.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;

@Validated
@ConfigurationProperties(prefix = "blockchain.operator")
public class OperatorSignerProperties {
    private static final Pattern ADDRESS = Pattern.compile("^0x[0-9a-fA-F]{40}$");

    private boolean enabled;
    private String address;
    private Path keystorePath;
    private String keystorePassword;

    @Min(21_000)
    private long gasLimit = 1_500_000;

    @AssertTrue(message = "enabled operator requires a valid address, readable keystore, and runtime password")
    public boolean isCompleteWhenEnabled() {
        if (!enabled) {
            return true;
        }
        return address != null
                && ADDRESS.matcher(address).matches()
                && keystorePath != null
                && Files.isRegularFile(keystorePath)
                && keystorePassword != null
                && !keystorePassword.isBlank();
    }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public Path getKeystorePath() { return keystorePath; }
    public void setKeystorePath(Path keystorePath) { this.keystorePath = keystorePath; }
    public String getKeystorePassword() { return keystorePassword; }
    public void setKeystorePassword(String keystorePassword) { this.keystorePassword = keystorePassword; }
    public long getGasLimit() { return gasLimit; }
    public void setGasLimit(long gasLimit) { this.gasLimit = gasLimit; }
}
