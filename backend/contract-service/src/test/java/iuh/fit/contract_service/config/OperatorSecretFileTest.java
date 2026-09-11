package iuh.fit.contract_service.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.web3j.crypto.Credentials;

import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class OperatorSecretFileTest {
    @TempDir Path directory;

    @Test void readsMountedSecretWithoutRemovingPasswordSpaces() throws Exception {
        Path secret = directory.resolve("password");
        Files.writeString(secret, " password with spaces \r\n");
        var properties = new OperatorSignerProperties();
        properties.setKeystorePasswordFile(secret);
        assertEquals(" password with spaces ", properties.resolveKeystorePassword());
        properties.setKeystorePassword("runtime-secret");
        assertEquals("runtime-secret", properties.resolveKeystorePassword());
    }

    @Test void refusesEmptySecret() throws Exception {
        Path secret = directory.resolve("password");
        Files.writeString(secret, "\n");
        var properties = new OperatorSignerProperties();
        properties.setKeystorePasswordFile(secret);
        assertThrows(IllegalStateException.class, properties::resolveKeystorePassword);
    }

    @Test void validatesWithPrivateKeyDirectly() {
        var properties = new OperatorSignerProperties();
        properties.setEnabled(true);
        properties.setAddress("0x10dd719B6a13e9d275990d706C2640ab6F1CA28e");
        properties.setPrivateKey("8cd9b38e3b85ad17cd8029df66149276f82acd7e53180330b7b55bab9317be3e");
        assertTrue(properties.isCompleteWhenEnabled());
        Credentials credentials = Credentials.create(properties.getPrivateKey());
        assertTrue(credentials.getAddress().equalsIgnoreCase(properties.getAddress()));
    }
}
