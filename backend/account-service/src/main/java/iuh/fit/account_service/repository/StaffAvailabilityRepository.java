package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.StaffAvailability;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface StaffAvailabilityRepository extends JpaRepository<StaffAvailability, Long> {
    List<StaffAvailability> findByStaffIdAndWorkDateBetween(Long staffId, LocalDate start, LocalDate end);
    List<StaffAvailability> findByWorkDateBetween(LocalDate start, LocalDate end);
    void deleteByStaffIdAndWorkDateBetween(Long staffId, LocalDate start, LocalDate end);
}
