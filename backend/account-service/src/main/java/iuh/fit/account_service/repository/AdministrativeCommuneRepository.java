package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.AdministrativeCommune;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AdministrativeCommuneRepository extends JpaRepository<AdministrativeCommune, String> {

    List<AdministrativeCommune> findByProvince_CodeAndActiveTrueOrderBySortOrderAscNameAsc(String provinceCode);

    @Query("""
            select commune
            from AdministrativeCommune commune
            join fetch commune.province province
            where commune.active = true
              and province.active = true
            order by province.sortOrder asc, province.name asc, commune.sortOrder asc, commune.name asc
            """)
    List<AdministrativeCommune> findActiveSnapshotCommunes();

    Optional<AdministrativeCommune> findByCodeAndActiveTrue(String code);
}
