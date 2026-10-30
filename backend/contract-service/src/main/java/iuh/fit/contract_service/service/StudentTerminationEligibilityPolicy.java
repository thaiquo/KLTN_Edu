package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.ContractAgreement;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Comparator;

/**
 * Party-request eligibility derived only from the immutable signed snapshot.
 * The first session must have reached its scheduled end in Vietnam business time
 * so attendance remains available for the complete session window.
 */
public final class StudentTerminationEligibilityPolicy {
    public static final String NOT_STARTED_CODE = "FIRST_SESSION_NOT_ENDED";
    public static final String UNAVAILABLE_CODE = "FIRST_SESSION_TIME_UNAVAILABLE";
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_DAYS_TO_SCAN = 14;

    public record Result(boolean eligible, String code, String message, OffsetDateTime firstSessionEnd) {}

    private StudentTerminationEligibilityPolicy() {}

    public static Result evaluate(ContractAgreement agreement, OffsetDateTime now) {
        try {
            ContractTermsSnapshot snapshot = new ContractTermsSnapshotService()
                    .parse(agreement.getTermsJson())
                    .orElseThrow();
            if (ContractTermsSnapshotService.SCHEMA_VERSION_V2.equals(snapshot.schemaVersion())
                    || ContractTermsSnapshotService.SCHEMA_VERSION_V3.equals(snapshot.schemaVersion())
                    || ContractTermsSnapshotService.SCHEMA_VERSION_V4.equals(snapshot.schemaVersion())) {
                return new Result(true, "LEGACY_SIGNED_POLICY",
                        "Hợp đồng giữ nguyên quy tắc chấm dứt tại thời điểm đã ký.", null);
            }
            if (!ContractTermsSnapshotService.SCHEMA_VERSION_V5.equals(snapshot.schemaVersion())) {
                return unavailable();
            }
            var classroom = snapshot.classroom();
            if (classroom == null || classroom.startDate() == null
                    || classroom.schedules() == null || classroom.schedules().isEmpty()) {
                return unavailable();
            }

            LocalDate startDate = LocalDate.parse(classroom.startDate());
            OffsetDateTime firstEnd = null;
            for (int day = 0; day <= MAX_DAYS_TO_SCAN && firstEnd == null; day++) {
                LocalDate date = startDate.plusDays(day);
                int projectDayOfWeek = date.getDayOfWeek().getValue() + 1;
                var firstSlot = classroom.schedules().stream()
                        .filter(slot -> slot != null && slot.dayOfWeek() != null
                                && slot.dayOfWeek() == projectDayOfWeek)
                        .filter(slot -> slot.startTime() != null && slot.endTime() != null)
                        .min(Comparator.comparing(slot -> LocalTime.parse(slot.startTime())));
                if (firstSlot.isPresent()) {
                    LocalTime start = LocalTime.parse(firstSlot.get().startTime());
                    LocalTime end = LocalTime.parse(firstSlot.get().endTime());
                    if (!start.isBefore(end)) return unavailable();
                    firstEnd = date.atTime(end).atZone(BUSINESS_ZONE).toOffsetDateTime();
                }
            }
            if (firstEnd == null) return unavailable();

            boolean eligible = !now.toInstant().isBefore(firstEnd.toInstant());
            return new Result(
                    eligible,
                    eligible ? null : NOT_STARTED_CODE,
                    eligible
                            ? "Có thể gửi yêu cầu chấm dứt thông thường."
                            : "Chỉ có thể gửi yêu cầu chấm dứt sau khi buổi học đầu tiên kết thúc.",
                    firstEnd);
        } catch (RuntimeException invalidSnapshot) {
            return unavailable();
        }
    }

    private static Result unavailable() {
        return new Result(false, UNAVAILABLE_CODE,
                "Chưa xác định được thời điểm kết thúc buổi học đầu tiên từ điều khoản đã ký; vui lòng liên hệ hỗ trợ.",
                null);
    }
}
