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
    private String privateKey;
    private Path keystorePath;
    private String keystorePassword;
    private Path keystorePasswordFile;

    @Min(21_000)
    private long gasLimit = 1_500_000;

    @AssertTrue(message = "enabled operator requires a valid address, and either a private key or a readable keystore with runtime password")
    public boolean isCompleteWhenEnabled() {
        if (!enabled) {
            return true;
        }
        boolean hasValidAddress = address != null && ADDRESS.matcher(address).matches();
        boolean hasPrivateKey = privateKey != null && !privateKey.isBlank();
        boolean hasKeystore = keystorePath != null
                && Files.isRegularFile(keystorePath)
                && ((keystorePassword != null && !keystorePassword.isBlank())
                    || (keystorePasswordFile != null && Files.isRegularFile(keystorePasswordFile)
                        && Files.isReadable(keystorePasswordFile)));
        return hasValidAddress && (hasPrivateKey || hasKeystore);
    }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getPrivateKey() { return privateKey; }
    public void setPrivateKey(String privateKey) { this.privateKey = privateKey; }
    public Path getKeystorePath() { return keystorePath; }
    public void setKeystorePath(Path keystorePath) { this.keystorePath = keystorePath; }
    public String getKeystorePassword() { return keystorePassword; }
    public void setKeystorePassword(String keystorePassword) { this.keystorePassword = keystorePassword; }
    public Path getKeystorePasswordFile() { return keystorePasswordFile; }
    public void setKeystorePasswordFile(Path value) { this.keystorePasswordFile = value; }
    public String resolveKeystorePassword() throws java.io.IOException {
        if (keystorePassword != null && !keystorePassword.isBlank()) return keystorePassword;
        if (keystorePasswordFile == null) throw new IllegalStateException("Operator password is not configured");
        // Secret mounts commonly append one newline. Preserve spaces in passwords.
        String password = Files.readString(keystorePasswordFile).replaceFirst("\\r?\\n$", "");
        if (password.isBlank()) throw new IllegalStateException("Operator password file is empty");
        return password;
    }
    public long getGasLimit() { return gasLimit; }
    public void setGasLimit(long gasLimit) { this.gasLimit = gasLimit; }
}
