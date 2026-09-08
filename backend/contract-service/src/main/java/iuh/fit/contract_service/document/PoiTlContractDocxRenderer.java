package iuh.fit.contract_service.document;

import com.deepoove.poi.XWPFTemplate;
import iuh.fit.contract_service.config.ContractDocumentProperties;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Component
public class PoiTlContractDocxRenderer implements ContractDocxRenderer {
    private final ResourceLoader resourceLoader;
    private final ContractDocumentProperties properties;

    public PoiTlContractDocxRenderer(ResourceLoader resourceLoader, ContractDocumentProperties properties) {
        this.resourceLoader = resourceLoader;
        this.properties = properties;
    }

    @Override
    public byte[] render(Map<String, Object> model) {
        try (InputStream input = resourceLoader.getResource(properties.templateResource()).getInputStream();
             ByteArrayOutputStream output = new ByteArrayOutputStream();
             XWPFTemplate template = XWPFTemplate.compile(input).render(model)) {
            template.write(output);
            byte[] result = output.toByteArray();
            if (result.length == 0 || result.length > properties.maxDocxBytes()) {
                throw new IllegalStateException("Kích thước DOCX không hợp lệ");
            }
            assertNoPlaceholders(result);
            return result;
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể render hợp đồng DOCX", ex);
        }
    }

    private void assertNoPlaceholders(byte[] docx) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new java.io.ByteArrayInputStream(docx))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.getName().startsWith("word/") && entry.getName().endsWith(".xml")) {
                    String xml = new String(zip.readAllBytes(), StandardCharsets.UTF_8);
                    if (xml.contains("{{") || xml.contains("}}")) {
                        throw new IllegalStateException("DOCX còn placeholder chưa được render: " + entry.getName());
                    }
                }
            }
        }
    }
}
