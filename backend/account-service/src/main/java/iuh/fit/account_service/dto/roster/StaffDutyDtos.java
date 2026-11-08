package iuh.fit.account_service.dto.roster;

import iuh.fit.account_service.enums.ShiftAssignmentStatus;
import iuh.fit.account_service.enums.ShiftAuditAction;
import iuh.fit.account_service.enums.ShiftCode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class StaffDutyDtos {
    private StaffDutyDtos() {}

    public record Slot(@NotNull LocalDate workDate, @NotNull ShiftCode shiftCode) {}

    public record AvailabilityRequest(
            @NotNull LocalDate weekStartDate,
            @NotNull List<@Valid Slot> slots
    ) {}

    public record ManualAssignRequest(@NotNull Long staffId) {}

    public record EmergencyReplaceRequest(
            @NotNull Long newStaffId,
            @NotBlank @Size(max = 1000) String reason
    ) {}

    public record StaffOption(Long id, String fullName, String email) {}

    public record StaffAvailabilityView(Long staffId, LocalDate workDate, ShiftCode shiftCode) {}

    public record AssignmentView(
            Long id,
            LocalDate workDate,
            ShiftCode shiftCode,
            Long staffId,
            String staffName,
            String staffEmail,
            ShiftAssignmentStatus status,
            Instant publishedAt,
            Instant checkInAt,
            Instant completedAt,
            Long version
    ) {}

    public record WeeklyRoster(
            LocalDate weekStartDate,
            LocalDate weekEndDate,
            boolean published,
            boolean availabilityEditable,
            List<Slot> availability,
            List<AssignmentView> assignments,
            List<StaffOption> activeStaff,
            List<StaffAvailabilityView> staffAvailability
    ) {}

    public record DutyStatus(
            String status,
            boolean enforcementEnabled,
            boolean writeAllowed,
            boolean canStart,
            AssignmentView assignment
    ) {}

    public record WriteAccess(
            boolean allowed,
            String status,
            Long assignmentId,
            ShiftCode shiftCode,
            Instant shiftEndAt
    ) {}

    public record AuditView(
            Long id,
            Long assignmentId,
            ShiftAuditAction action,
            Long previousStaffId,
            String previousStaffName,
            Long newStaffId,
            String newStaffName,
            Long changedBy,
            String changedByName,
            String reason,
            Instant createdAt
    ) {}
}
