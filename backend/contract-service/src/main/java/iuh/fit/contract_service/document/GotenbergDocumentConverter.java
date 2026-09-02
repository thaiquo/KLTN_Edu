package iuh.fit.contract_service.document;

import iuh.fit.contract_service.config.ContractDocumentProperties;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;

@Component
public class GotenbergDocumentConverter implements DocumentConverter {
    private final RestClient restClient;
    private final ContractDocumentProperties properties;

    public GotenbergDocumentConverter(ContractDocumentProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        if (properties != null) {
            if (properties.converterConnectTimeout() != null) {
                factory.setConnectTimeout(properties.converterConnectTimeout());
            }
            if (properties.converterReadTimeout() != null) {
                factory.setReadTimeout(properties.converterReadTimeout());
            }
        }
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public byte[] docxToPdf(byte[] docx, String filename) {
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("files", new ByteArrayResource(docx) {
            @Override public String getFilename() { return filename; }
        }).contentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));

        byte[] pdf = restClient.post()
                .uri(properties.converterUrl())
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body.build())
                .retrieve()
                .body(byte[].class);

        if (pdf == null || pdf.length < 5 || pdf.length > properties.maxPdfBytes()
                || !new String(pdf, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-")) {
            throw new IllegalStateException("Gotenberg trả về dữ liệu PDF không hợp lệ");
        }
        return pdf;
    }
}
