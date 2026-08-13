package iuh.fit.account_service.dto.reference;

public class AdministrativeUnitResponse {

    private String code;
    private String name;

    public AdministrativeUnitResponse(String code, String name) {
        this.code = code;
        this.name = name;
    }

    public String getCode() { return code; }
    public String getName() { return name; }
}
