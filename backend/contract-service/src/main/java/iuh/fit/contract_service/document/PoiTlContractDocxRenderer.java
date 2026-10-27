package iuh.fit.contract_service.document;

import com.deepoove.poi.XWPFTemplate;
import com.deepoove.poi.config.Configure;
import com.deepoove.poi.plugin.table.LoopRowTableRenderPolicy;
import iuh.fit.contract_service.config.ContractDocumentProperties;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;

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
    private final Configure configure;

    public PoiTlContractDocxRenderer(ResourceLoader resourceLoader, ContractDocumentProperties properties) {
        this.resourceLoader = resourceLoader;
        this.properties = properties;
        this.configure = Configure.builder()
                .bind("ss", new LoopRowTableRenderPolicy(true))
                .build();
    }

    @Override
    public byte[] render(Map<String, Object> model) {
        try (InputStream input = resourceLoader.getResource(properties.templateResource()).getInputStream();
             ByteArrayOutputStream output = new ByteArrayOutputStream();
             XWPFTemplate template = XWPFTemplate.compile(input, configure).render(model)) {
            template.write(output);
            byte[] result = appendTrialPolicy(output.toByteArray(), model);
            if (result.length == 0 || result.length > properties.maxDocxBytes()) {
                throw new IllegalStateException("Kích thước DOCX không hợp lệ");
            }
            assertNoPlaceholders(result);
            return result;
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể render hợp đồng DOCX: " + ex.getMessage(), ex);
        }
    }

    private byte[] appendTrialPolicy(byte[] rendered, Map<String, Object> model) throws Exception {
        if (!Boolean.TRUE.equals(model.get("hasTrialPolicy"))) return rendered;
        try (XWPFDocument document = new XWPFDocument(new java.io.ByteArrayInputStream(rendered));
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var heading = document.createParagraph();
            heading.setAlignment(ParagraphAlignment.CENTER);
            var headingRun = heading.createRun();
            headingRun.setBold(true);
            headingRun.setText("PHỤ LỤC ĐIỀU KHOẢN GIAI ĐOẠN TRẢI NGHIỆM CÓ BẢO CHỨNG ESCROW");

            addParagraph(document, "Chính sách phiên bản " + model.get("trialPolicyVersion")
                    + " áp dụng cho Buổi #" + model.get("trialSessionSequence") + ".");
            addParagraph(document, "Học viên được quyền yêu cầu dừng sau khi buổi trải nghiệm hoàn tất và trước thời hạn "
                    + model.get("trialDeadline") + ". Hệ thống dùng thời điểm server tiếp nhận yêu cầu; tại hoặc sau thời hạn này quyền dừng theo chính sách trải nghiệm đóng lại.");
            addParagraph(document, "Lịch xác định buổi trải nghiệm, buổi kế tiếp và thời hạn là bất biến kể từ khi quy trình ký hợp đồng bắt đầu. Việc tiếp tục học không yêu cầu ký lại hợp đồng.");
            addParagraph(document, "Ký quỹ phải được xác nhận trước khi buổi trải nghiệm bắt đầu. Khi dừng đúng hạn, buổi đã học vẫn được quyết toán theo kết quả điểm danh; chỉ phần ký quỹ chưa sử dụng được hoàn sau khi các quyết toán bắt buộc và sự kiện blockchain được đối soát.");
            document.write(output);
            return output.toByteArray();
        }
    }

    private void addParagraph(XWPFDocument document, String text) {
        var paragraph = document.createParagraph();
        paragraph.createRun().setText(text);
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
