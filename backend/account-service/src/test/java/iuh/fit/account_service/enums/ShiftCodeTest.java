package iuh.fit.account_service.enums;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

class ShiftCodeTest {

    @Test
    void twoDailyShiftsCoverEightToTwentyTwoWithoutGap() {
        assertThat(ShiftCode.MORNING.getStartTime()).isEqualTo(LocalTime.of(8, 0));
        assertThat(ShiftCode.MORNING.getEndTime()).isEqualTo(LocalTime.of(15, 0));
        assertThat(ShiftCode.EVENING.getStartTime()).isEqualTo(LocalTime.of(15, 0));
        assertThat(ShiftCode.EVENING.getEndTime()).isEqualTo(LocalTime.of(22, 0));
        assertThat(ShiftCode.MORNING.getEndTime()).isEqualTo(ShiftCode.EVENING.getStartTime());
        assertThat(Duration.between(ShiftCode.MORNING.getStartTime(), ShiftCode.MORNING.getEndTime()))
                .isEqualTo(Duration.ofHours(7));
        assertThat(Duration.between(ShiftCode.EVENING.getStartTime(), ShiftCode.EVENING.getEndTime()))
                .isEqualTo(Duration.ofHours(7));
    }
}
