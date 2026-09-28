package iuh.fit.account_service.dto.reference;

import java.util.List;

public record AdministrativeLocationSnapshotResponse(
        List<ProvinceLocation> provinces
) {
    public record ProvinceLocation(
            String code,
            String name,
            List<CommuneLocation> communes
    ) {
    }

    public record CommuneLocation(
            String code,
            String name,
            String provinceCode,
            String provinceName
    ) {
    }
}
