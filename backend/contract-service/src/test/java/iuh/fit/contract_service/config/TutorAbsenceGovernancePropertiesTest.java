package iuh.fit.contract_service.config;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class TutorAbsenceGovernancePropertiesTest {

    @Test
    void defaultsToOff() {
        var props = new TutorAbsenceGovernanceProperties(null, null);
        assertEquals(TutorAbsenceGovernanceProperties.Mode.OFF, props.resolvedMode());
        assertFalse(props.isEnabledFor(100L));
        assertFalse(props.isShadowFor(100L));
    }

    @Test
    void handlesShadowModeWithoutAllowlist() {
        var props = new TutorAbsenceGovernanceProperties("SHADOW", "");
        assertEquals(TutorAbsenceGovernanceProperties.Mode.SHADOW, props.resolvedMode());
        assertFalse(props.isEnabledFor(100L));
        assertTrue(props.isShadowFor(100L));
    }

    @Test
    void handlesEnforceModeWithoutAllowlist() {
        var props = new TutorAbsenceGovernanceProperties("ENFORCE", null);
        assertEquals(TutorAbsenceGovernanceProperties.Mode.ENFORCE, props.resolvedMode());
        assertTrue(props.isEnabledFor(100L));
        assertFalse(props.isShadowFor(100L));
    }

    @Test
    void handlesCanaryAllowlist() {
        var props = new TutorAbsenceGovernanceProperties("ENFORCE", "101, 102, 103");
        assertEquals(TutorAbsenceGovernanceProperties.Mode.ENFORCE, props.resolvedMode());
        assertTrue(props.isEnabledFor(101L));
        assertTrue(props.isEnabledFor(102L));
        assertFalse(props.isEnabledFor(104L));
        // Non-allowlisted classroom in ENFORCE mode falls back to shadow
        assertTrue(props.isShadowFor(104L));
    }

    @Test
    void shadowAllowlistNeverEnforcesAndInvalidTokensAreIgnored() {
        var shadow = new TutorAbsenceGovernanceProperties("SHADOW", "101");
        assertFalse(shadow.isEnabledFor(101L));
        assertTrue(shadow.isShadowFor(101L));

        var enforce = new TutorAbsenceGovernanceProperties("ENFORCE", "invalid, 101");
        assertTrue(enforce.isEnabledFor(101L));
        assertFalse(enforce.isEnabledFor(102L));
        assertTrue(enforce.isShadowFor(102L));
    }

    @Test
    void invalidNonEmptyCanaryAllowlistFailsClosedToShadow() {
        var props = new TutorAbsenceGovernanceProperties("ENFORCE", "not-a-classroom, 42x");

        assertFalse(props.isEnabledFor(42L));
        assertTrue(props.isShadowFor(42L));
    }
}
