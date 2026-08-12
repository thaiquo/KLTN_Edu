package iuh.fit.account_service.infrastructure.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "storage")
public class StorageProperties {
    private String provider = "local";
    private final Local local = new Local();
    private final S3 s3 = new S3();

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public Local getLocal() { return local; }
    public S3 getS3() { return s3; }

    public static class Local {
        private String root = "../../.data/storage";
        public String getRoot() { return root; }
        public void setRoot(String root) { this.root = root; }
    }

    public static class S3 {
        private String bucket;
        private String region = "ap-southeast-1";
        private String accessKey;
        private String secretKey;

        public String getBucket() { return bucket; }
        public void setBucket(String bucket) { this.bucket = bucket; }
        public String getRegion() { return region; }
        public void setRegion(String region) { this.region = region; }
        public String getAccessKey() { return accessKey; }
        public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
        public String getSecretKey() { return secretKey; }
        public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
    }
}
