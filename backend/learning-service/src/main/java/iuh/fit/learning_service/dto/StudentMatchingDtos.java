package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.TeachingMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;

public final class StudentMatchingDtos {
    private StudentMatchingDtos() {}

    public record PreferredScheduleRequest(
            @NotNull(message = "ngày học là bắt buộc")
            @Min(value = 2, message = "ngày học phải từ Thứ 2 đến Chủ nhật")
            @Max(value = 8, message = "ngày học phải từ Thứ 2 đến Chủ nhật")
            Integer dayOfWeek,

            @NotBlank(message = "giờ bắt đầu là bắt buộc")
            @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "giờ bắt đầu phải có định dạng HH:mm")
            String startTime,

            @NotBlank(message = "giờ kết thúc là bắt buộc")
            @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "giờ kết thúc phải có định dạng HH:mm")
            String endTime
    ) {
        @AssertTrue(message = "giờ bắt đầu phải nhỏ hơn giờ kết thúc")
        public boolean isTimeRangeValid() {
            if (startTime == null || endTime == null) {
                return true;
            }
            try {
                return LocalTime.parse(startTime.trim()).isBefore(LocalTime.parse(endTime.trim()));
            } catch (DateTimeParseException ignored) {
                return true;
            }
        }
    }

    public record StudentMatchingInputRequest(
            @NotNull(message = "môn học là bắt buộc")
            Long subjectId,

            @NotNull(message = "cấp độ học là bắt buộc")
            Long levelId,

            @NotNull(message = "hình thức học là bắt buộc")
            TeachingMode teachingMode,

            @DecimalMin(value = "0", message = "ngân sách tối thiểu phải lớn hơn hoặc bằng 0")
            BigDecimal budgetMin,

            @DecimalMin(value = "0", message = "ngân sách tối đa phải lớn hơn hoặc bằng 0")
            BigDecimal budgetMax,

            @Size(max = 32, message = "mã tỉnh/thành quá dài")
            String provinceCode,

            @Size(max = 32, message = "mã xã/phường quá dài")
            String communeCode,

            @Size(max = 12, message = "chỉ nên chọn tối đa 12 khung giờ ưu tiên")
            List<@Valid PreferredScheduleRequest> preferredSchedules,

            @Size(max = 1200, message = "mục tiêu học tập tối đa 1200 ký tự")
            String learningGoal
    ) {
        @AssertTrue(message = "ngân sách tối thiểu không được lớn hơn ngân sách tối đa")
        public boolean isBudgetRangeValid() {
            if (budgetMin == null || budgetMax == null) {
                return true;
            }
            return budgetMin.compareTo(budgetMax) <= 0;
        }

        @AssertTrue(message = "vui lòng chọn tỉnh/thành trước khi chọn xã/phường")
        public boolean isCommuneScopedByProvince() {
            return !hasText(communeCode) || hasText(provinceCode);
        }
    }

    public record StudentMatchingInputResponse(
            Long subjectId,
            Long levelId,
            TeachingMode teachingMode,
            BigDecimal budgetMin,
            BigDecimal budgetMax,
            String provinceCode,
            String communeCode,
            List<PreferredScheduleRequest> preferredSchedules,
            String learningGoal,
            String status,
            List<String> notices
    ) {}

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
