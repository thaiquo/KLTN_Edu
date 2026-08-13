package iuh.fit.account_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.unit.DataSize;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "app.file-policy")
public class FilePolicyProperties {

    private FileRule avatar = new FileRule();
    private FileRule identity = new FileRule();
    private FileRule certificate = new FileRule();
    private int maxCertificateCount = 10;

    public FileRule getAvatar() {
        return avatar;
    }

    public void setAvatar(FileRule avatar) {
        this.avatar = avatar;
    }

    public FileRule getIdentity() {
        return identity;
    }

    public void setIdentity(FileRule identity) {
        this.identity = identity;
    }

    public FileRule getCertificate() {
        return certificate;
    }

    public void setCertificate(FileRule certificate) {
        this.certificate = certificate;
    }

    public int getMaxCertificateCount() {
        return maxCertificateCount;
    }

    public void setMaxCertificateCount(int maxCertificateCount) {
        this.maxCertificateCount = maxCertificateCount;
    }

    public static class FileRule {

        private List<String> allowedContentTypes = new ArrayList<>();
        private List<String> allowedExtensions = new ArrayList<>();
        private DataSize maxSize = DataSize.ofMegabytes(1);

        public List<String> getAllowedContentTypes() {
            return allowedContentTypes;
        }

        public void setAllowedContentTypes(List<String> allowedContentTypes) {
            this.allowedContentTypes = allowedContentTypes;
        }

        public List<String> getAllowedExtensions() {
            return allowedExtensions;
        }

        public void setAllowedExtensions(List<String> allowedExtensions) {
            this.allowedExtensions = allowedExtensions;
        }

        public DataSize getMaxSize() {
            return maxSize;
        }

        public void setMaxSize(DataSize maxSize) {
            this.maxSize = maxSize;
        }
    }
}
