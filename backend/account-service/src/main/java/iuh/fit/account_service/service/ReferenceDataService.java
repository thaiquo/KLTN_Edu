package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.reference.AdministrativeUnitResponse;
import iuh.fit.account_service.entity.AdministrativeCommune;
import iuh.fit.account_service.entity.AdministrativeProvince;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.AdministrativeCommuneRepository;
import iuh.fit.account_service.repository.AdministrativeProvinceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ReferenceDataService {

    private final AdministrativeProvinceRepository provinceRepository;
    private final AdministrativeCommuneRepository communeRepository;

    public ReferenceDataService(
            AdministrativeProvinceRepository provinceRepository,
            AdministrativeCommuneRepository communeRepository
    ) {
        this.provinceRepository = provinceRepository;
        this.communeRepository = communeRepository;
    }

    @Transactional(readOnly = true)
    public List<AdministrativeUnitResponse> provinces() {
        return provinceRepository.findByActiveTrueOrderBySortOrderAscNameAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AdministrativeUnitResponse> communes(String provinceCode) {
        provinceRepository.findByCodeAndActiveTrue(provinceCode)
                .orElseThrow(() -> new ResourceNotFoundException("Province not found"));
        return communeRepository.findByProvince_CodeAndActiveTrueOrderBySortOrderAscNameAsc(provinceCode)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private AdministrativeUnitResponse toResponse(AdministrativeProvince province) {
        return new AdministrativeUnitResponse(province.getCode(), province.getName());
    }

    private AdministrativeUnitResponse toResponse(AdministrativeCommune commune) {
        return new AdministrativeUnitResponse(commune.getCode(), commune.getName());
    }
}
