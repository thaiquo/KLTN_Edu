package iuh.fit.contract_service.document;

public interface DocumentConverter {
    byte[] docxToPdf(byte[] docx, String filename);
}
