package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.reference.AdministrativeUnitResponse;
import iuh.fit.account_service.service.ReferenceDataService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reference")
public class ReferenceDataController {

    private final ReferenceDataService referenceDataService;

    public ReferenceDataController(ReferenceDataService referenceDataService) {
        this.referenceDataService = referenceDataService;
    }

    @GetMapping("/provinces")
    public List<AdministrativeUnitResponse> provinces() {
        return referenceDataService.provinces();
    }

    @GetMapping("/provinces/{provinceCode}/communes")
    public List<AdministrativeUnitResponse> communes(@PathVariable String provinceCode) {
        return referenceDataService.communes(provinceCode);
    }
}
