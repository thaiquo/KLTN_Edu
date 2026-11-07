package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.StaffShiftAssignment;
import iuh.fit.account_service.enums.ShiftAssignmentStatus;
import iuh.fit.account_service.enums.ShiftCode;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StaffShiftAssignmentRepository extends JpaRepository<StaffShiftAssignment, Long> {
    List<StaffShiftAssignment> findByWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(LocalDate start, LocalDate end);
    Optional<StaffShiftAssignment> findByWorkDateAndShiftCode(LocalDate workDate, ShiftCode shiftCode);
    List<StaffShiftAssignment> findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
            Long staffId, LocalDate start, LocalDate end);
    boolean existsByStaffIdAndWorkDateAndStatusIn(
            Long staffId, LocalDate workDate, Collection<ShiftAssignmentStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from StaffShiftAssignment a where a.id = :id")
    Optional<StaffShiftAssignment> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from StaffShiftAssignment a
             where a.workDate between :start and :end
             order by a.workDate, a.shiftCode
            """)
    List<StaffShiftAssignment> findWeekForUpdate(@Param("start") LocalDate start, @Param("end") LocalDate end);

    List<StaffShiftAssignment> findByStatusInAndWorkDateLessThanEqual(
            Collection<ShiftAssignmentStatus> statuses, LocalDate latestDate);
}
