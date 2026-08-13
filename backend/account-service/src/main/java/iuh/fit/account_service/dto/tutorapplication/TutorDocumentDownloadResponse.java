package iuh.fit.account_service.dto.tutorapplication;

public class TutorDocumentDownloadResponse {

    private String url;

    public TutorDocumentDownloadResponse(String url) {
        this.url = url;
    }

    public String getUrl() {
        return url;
    }
}
