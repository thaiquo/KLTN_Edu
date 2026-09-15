package iuh.fit.contract_service.document;

import iuh.fit.contract_service.config.ContractDocumentProperties;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PoiTlContractDocxRendererTest {

    @Test
    void testRenderTemplateSuccessfully() {
        ContractDocumentProperties properties = new ContractDocumentProperties(
                "classpath:contract-templates/EDUCONNECT_HOP_DONG_TEMPLATE_V1.docx",
                "EDUCONNECT_HOP_DONG_TEMPLATE_V1",
                "http://localhost:3000/forms/libreoffice/convert",
                Duration.ofSeconds(5),
                Duration.ofSeconds(60),
                10_485_760L,
                20_971_520L,
                "http://localhost:5173/contracts/verify",
                "EduConnect",
                "Hệ thống EduConnect",
                "support@educonnect.vn"
        );

        PoiTlContractDocxRenderer renderer = new PoiTlContractDocxRenderer(new DefaultResourceLoader(), properties);

        Map<String, Object> model = new HashMap<>();
        model.put("contractNo", "EDU-2026-TEST");
        model.put("contractVersion", 1);
        model.put("agreementUuid", "test-uuid-1234");
        model.put("contractDate", "15/09/2026");
        model.put("agreementKey", "0x1234567890abcdef");
        model.put("agreementKeyShort", "0x1234...cdef");
        model.put("termsHash", "0xabcdef1234567890");
        model.put("termsHashShort", "0xabcd...7890");
        model.put("chainName", "Ethereum Sepolia Testnet");
        model.put("chainId", "11155111");
        model.put("contractPlace", "Hệ thống EduConnect");

        model.put("tutorFullName", "Nguyễn Văn Gia Sư");
        model.put("tutorId", "Đã xác thực nội bộ");
        model.put("tutorEmail", "giasu@example.com");
        model.put("tutorPhone", "0901234567");
        model.put("tutorWallet", "0x71C836343791330F6d724A3e890885e3F6531B29");
        model.put("tutorWalletShort", "0x71C8...1B29");
        model.put("tutorSignature", "0xsignature1");
        model.put("tutorSignatureShort", "0xsig...re1");
        model.put("tutorSignedAt", "15/09/2026 10:00:00");
        model.put("tutorStatus", "Tài khoản EduConnect đã xác thực");
        model.put("tutorAddress", "TP. Hồ Chí Minh");

        model.put("studentFullName", "Trần Thị Học Viên");
        model.put("studentId", "Đã xác thực nội bộ");
        model.put("studentEmail", "hocvien@example.com");
        model.put("studentPhone", "0987654321");
        model.put("studentWallet", "0x5342F5594C115f5cAc3eEfC87b4096055d787728");
        model.put("studentWalletShort", "0x5342...7728");
        model.put("studentSignature", "0xsignature2");
        model.put("studentSignatureShort", "0xsig...re2");
        model.put("studentSignedAt", "15/09/2026 11:00:00");
        model.put("studentDateOfBirth", "01/01/2005");
        model.put("studentGrade", "Lớp 12");
        model.put("studentAddress", "TP. Hồ Chí Minh");

        model.put("hasGuardian", false);
        model.put("guardianFullName", "Chưa cập nhật");
        model.put("guardianRelationship", "Chưa cập nhật");
        model.put("guardianPhone", "Chưa cập nhật");
        model.put("guardianEmail", "Chưa cập nhật");

        model.put("platformOperatorName", "EduConnect");
        model.put("platformContactAddress", "Hệ thống EduConnect");
        model.put("platformSupportEmail", "support@educonnect.vn");
        model.put("platformWallet", "0x0000000000000000000000000000000000000000");
        model.put("escrowContract", "0x770aBC99D4884EB180c44B4C025219e59d95f8CE");

        model.put("className", "Toán 12 Nâng Cao");
        model.put("classroomId", "Đã xác thực nội bộ");
        model.put("totalSessions", 10);
        model.put("durationPerSessionMinutes", 90);
        model.put("learningMode", "ONLINE");
        model.put("meetingPlatform", "Google Meet");
        model.put("meetingLink", "https://meet.google.com/abc-defg-hij");
        model.put("learningAddress", "Chưa cập nhật");
        model.put("courseStartDate", "01/10/2026");
        model.put("courseEndDate", "30/11/2026");

        model.put("ss", List.of(
                Map.of(
                        "no", "2",
                        "topic", "Buổi học định kỳ",
                        "at", "Thứ Hai 18:00 - 19:30",
                        "min", "90",
                        "location", "https://meet.google.com/abc-defg-hij",
                        "state", "ONLINE"
                ),
                Map.of(
                        "no", "4",
                        "topic", "Buổi học định kỳ",
                        "at", "Thứ Tư 18:00 - 19:30",
                        "min", "90",
                        "location", "https://meet.google.com/abc-defg-hij",
                        "state", "ONLINE"
                )
        ));

        model.put("vndPerUsdc", "25000");
        model.put("pricePerSessionVnd", "200000");
        model.put("pricePerSessionUsdc", "8");
        model.put("totalAmountVnd", "2000000");
        model.put("totalAmountUsdc", "80");
        model.put("paymentTokenSymbol", "USDC");
        model.put("paymentTokenAddress", "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
        model.put("paymentTokenDecimals", 6);
        model.put("paymentDeadline", "16/09/2026 10:00:00");
        model.put("agreementStatus", "ACTIVE");
        model.put("fundingTxHash", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
        model.put("activatedAt", "15/09/2026 12:00:00");
        model.put("signatureBundleHash", "0xbundlehash");
        model.put("eip712DomainName", "EduConnectEscrow");
        model.put("eip712DomainVersion", "1");
        model.put("verificationUrl", "http://localhost:5173/contracts/verify/test-uuid-1234");

        byte[] result = renderer.render(model);
        assertNotNull(result);
        assertTrue(result.length > 1000);
        System.out.println("RENDERED DOCX SIZE: " + result.length + " bytes!");

        try {
            GotenbergDocumentConverter converter = new GotenbergDocumentConverter(properties);
            byte[] pdf = converter.docxToPdf(result, "contract-test.docx");
            assertNotNull(pdf);
            assertTrue(pdf.length > 1000);
            System.out.println("CONVERTED PDF SIZE VIA GOTENBERG: " + pdf.length + " bytes!");
        } catch (Exception ex) {
            System.out.println("Gotenberg test notice: " + ex.getMessage());
        }
    }
}
