package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.AdministrativeCommune;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AdministrativeCommuneRepository extends JpaRepository<AdministrativeCommune, String> {

    List<AdministrativeCommune> findByProvince_CodeAndActiveTrueOrderBySortOrderAscNameAsc(String provinceCode);

    Optional<AdministrativeCommune> findByCodeAndActiveTrue(String code);
}
