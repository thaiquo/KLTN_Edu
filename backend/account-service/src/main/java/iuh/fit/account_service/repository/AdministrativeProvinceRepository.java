package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.AdministrativeProvince;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AdministrativeProvinceRepository extends JpaRepository<AdministrativeProvince, String> {

    List<AdministrativeProvince> findByActiveTrueOrderBySortOrderAscNameAsc();

    Optional<AdministrativeProvince> findByCodeAndActiveTrue(String code);
}
