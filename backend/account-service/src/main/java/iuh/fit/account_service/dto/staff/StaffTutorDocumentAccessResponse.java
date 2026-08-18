package iuh.fit.account_service.dto.staff;

public record StaffTutorDocumentAccessResponse(
        Long id,
        String filename,
        String contentType,
        Long fileSize,
        boolean previewable,
        String url
) {
}
