package iuh.fit.ai_service.service;

import iuh.fit.ai_service.client.AccountLocationClient;
import iuh.fit.ai_service.client.LearningCatalogClient;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ExtractedRequirement;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.TimeOfDayHint;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.ClarificationField;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.ClarificationReason;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundRequirementRequest;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundingStatus;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCatalogSnapshot;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCategory;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningLevel;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningOption;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningSubject;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LocationCommune;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LocationProvince;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LocationSnapshot;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CatalogGroundingServiceTest {
    private final StubCatalogClient catalogClient = new StubCatalogClient();
    private final StubLocationClient locationClient = new StubLocationClient();
    private final CatalogGroundingService service = new CatalogGroundingService(catalogClient, locationClient);

    @Test
    void exactSubjectAndLevelMatchGroundsRealIds() {
        var response = service.ground(request(requirement("Toan", "Lop 12", TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.coreMatchingReady()).isTrue();
        assertThat(response.requirement().subject().id()).isEqualTo(5L);
        assertThat(response.requirement().level().id()).isEqualTo(9L);
        assertThat(response.clarifications()).isEmpty();
    }

    @Test
    void duplicateSubjectNamesUseLevelHintToSelectSubject() {
        LearningCategory category = category(6L, "ACADEMIC");
        catalogClient.snapshot = new LearningCatalogSnapshot(List.of(
                subject(21L, "MATHEMATICS", "Toan", category, List.of(level(72L, "GRADE_6", "Lop 6"))),
                subject(5L, "MATHEMATICS", "Toan", category, List.of(level(9L, "GRADE_12", "Lop 12"))),
                subject(12L, "MATHEMATICS", "Toan", category, List.of(level(57L, "GRADE_1", "Lop 1")))
        ));

        var response = service.ground(request(requirement("Toan", "Lop 12", TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.requirement().subject().id()).isEqualTo(5L);
        assertThat(response.requirement().level().id()).isEqualTo(9L);
    }

    @Test
    void unicodeAndCaseNormalizationGroundsSubjectAndLevel() {
        var response = service.ground(request(requirement("  tOaN  ", "lop 12", TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.requirement().subject().name()).isEqualTo("Toan");
        assertThat(response.requirement().level().name()).isEqualTo("Lop 12");
    }

    @Test
    void missingSubjectNeedsClarification() {
        var response = service.ground(request(requirement(null, "Lop 12", TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.NEEDS_CLARIFICATION);
        assertThat(response.coreMatchingReady()).isFalse();
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.SUBJECT);
            assertThat(clarification.reason()).isEqualTo(ClarificationReason.MISSING);
            assertThat(clarification.blocking()).isTrue();
        });
    }

    @Test
    void missingLevelReturnsOnlyLevelsForGroundedSubject() {
        var response = service.ground(request(requirement("Toan", null, TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.NEEDS_CLARIFICATION);
        assertThat(response.requirement().subject().id()).isEqualTo(5L);
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.LEVEL);
            assertThat(clarification.options()).extracting("id").containsExactly(7L, 8L, 9L);
        });
    }

    @Test
    void missingTeachingModeKeepsCatalogGroundingButNeedsClarification() {
        var response = service.ground(request(requirement("Toan", "Lop 12", null)));

        assertThat(response.status()).isEqualTo(GroundingStatus.NEEDS_CLARIFICATION);
        assertThat(response.requirement().subject().id()).isEqualTo(5L);
        assertThat(response.requirement().level().id()).isEqualTo(9L);
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.TEACHING_MODE);
            assertThat(clarification.options()).extracting("value").containsExactly("ONLINE", "OFFLINE");
        });
    }

    @Test
    void ambiguousSubjectReturnsRealCatalogCandidates() {
        var response = service.ground(request(requirement("Lap trinh", "Co ban", TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.NEEDS_CLARIFICATION);
        assertThat(response.requirement().subject()).isNull();
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.SUBJECT);
            assertThat(clarification.reason()).isEqualTo(ClarificationReason.AMBIGUOUS);
            assertThat(clarification.options()).extracting("name")
                    .containsExactly("Lap trinh C++", "Lap trinh Web");
        });
    }

    @Test
    void subjectNotFoundIsControlled() {
        var response = service.ground(request(requirement("Chiem tinh", "Co ban", TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.NOT_FOUND);
        assertThat(response.requirement().subject()).isNull();
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.SUBJECT);
            assertThat(clarification.reason()).isEqualTo(ClarificationReason.NOT_FOUND);
        });
    }

    @Test
    void invalidSubjectLevelRelationshipDoesNotReturnMismatchedLevel() {
        var response = service.ground(request(requirement("Toan", "IELTS 6.5", TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.INVALID);
        assertThat(response.requirement().subject().id()).isEqualTo(5L);
        assertThat(response.requirement().level()).isNull();
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.LEVEL);
            assertThat(clarification.reason()).isEqualTo(ClarificationReason.INVALID_RELATIONSHIP);
            assertThat(clarification.options()).extracting("id").containsExactly(7L, 8L, 9L);
        });
    }

    @Test
    void dynamicNewlyAddedSubjectCanBeGroundedWithoutCodeChange() {
        catalogClient.snapshot = new LearningCatalogSnapshot(List.of(
                subject(99L, "ROBOTICS", "Robotics", category(20L, "STEM"), List.of(level(199L, "BEGINNER", "Co ban")))
        ));

        var response = service.ground(request(requirement("robotics", "co ban", TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.requirement().subject().id()).isEqualTo(99L);
        assertThat(response.requirement().level().id()).isEqualTo(199L);
    }

    @Test
    void onlineWithNoLocationDoesNotCallLocationClient() {
        var response = service.ground(request(requirement("Toan", "Lop 12", TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.requirement().location()).isNull();
        assertThat(response.clarifications()).noneMatch(clarification -> clarification.field() == ClarificationField.LOCATION);
        assertThat(locationClient.calls).isZero();
    }

    @Test
    void onlineWithLocationHintIgnoresLocationAndDoesNotCallLocationClient() {
        var response = service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.ONLINE, null, List.of(), null, List.of(), List.of(), "Quan 1, TP.HCM"
        )));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.requirement().locationHint()).isNull();
        assertThat(response.requirement().location()).isNull();
        assertThat(response.clarifications()).noneMatch(clarification -> clarification.field() == ClarificationField.LOCATION);
        assertThat(locationClient.calls).isZero();
    }

    @Test
    void offlineProvinceOnlyGroundsProvinceAndDoesNotBlockCoreReady() {
        var response = service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.OFFLINE, null, List.of(), null, List.of(), List.of(), "TP.HCM"
        )));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.coreMatchingReady()).isTrue();
        assertThat(response.requirement().location().provinceCode()).isEqualTo("HO_CHI_MINH");
        assertThat(response.requirement().location().communeCode()).isNull();
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.LOCATION);
            assertThat(clarification.reason()).isEqualTo(ClarificationReason.OPTIONAL_REFINEMENT);
            assertThat(clarification.blocking()).isFalse();
        });
    }

    @Test
    void offlineProvinceAndCommuneGroundsBothCodes() {
        var response = service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.OFFLINE, null, List.of(), null, List.of(), List.of(),
                "Phuong Ben Thanh, TP HCM"
        )));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.requirement().location().provinceCode()).isEqualTo("HO_CHI_MINH");
        assertThat(response.requirement().location().communeCode()).isEqualTo("HCM_BEN_THANH");
        assertThat(response.clarifications()).noneMatch(clarification -> clarification.field() == ClarificationField.LOCATION);
    }

    @Test
    void vietnameseUnicodeLocationNormalizationGroundsCommune() {
        var response = service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.OFFLINE, null, List.of(), null, List.of(), List.of(),
                "phuong Go Vap, thanh pho Ho Chi Minh"
        )));

        assertThat(response.requirement().location().provinceCode()).isEqualTo("HO_CHI_MINH");
        assertThat(response.requirement().location().communeCode()).isEqualTo("HCM_GO_VAP");
    }

    @Test
    void ambiguousLocationReturnsOptionalClarification() {
        var response = service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.OFFLINE, null, List.of(), null, List.of(), List.of(), "Phuong An"
        )));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.coreMatchingReady()).isTrue();
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.LOCATION);
            assertThat(clarification.reason()).isEqualTo(ClarificationReason.AMBIGUOUS);
            assertThat(clarification.blocking()).isFalse();
            assertThat(clarification.options()).extracting("code").contains("HCM_AN_DONG", "HCM_AN_NHON");
        });
    }

    @Test
    void locationNotFoundIsOptionalAndPreservesAlreadyGroundedFields() {
        var response = service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.OFFLINE, null, List.of(), null, List.of(), List.of(), "Atlantis"
        )));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.coreMatchingReady()).isTrue();
        assertThat(response.requirement().subject().id()).isEqualTo(5L);
        assertThat(response.requirement().level().id()).isEqualTo(9L);
        assertThat(response.requirement().location()).isNull();
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.LOCATION);
            assertThat(clarification.reason()).isEqualTo(ClarificationReason.NOT_FOUND);
            assertThat(clarification.blocking()).isFalse();
        });
    }

    @Test
    void communeDoesNotBelongToResolvedProvinceDoesNotCrossCombineCodes() {
        var response = service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.OFFLINE, null, List.of(), null, List.of(), List.of(),
                "Hoan Kiem, TP.HCM"
        )));

        assertThat(response.requirement().location().provinceCode()).isEqualTo("HO_CHI_MINH");
        assertThat(response.requirement().location().communeCode()).isNull();
    }

    @Test
    void districtOnlyInputDoesNotFabricateCommune() {
        var response = service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.OFFLINE, null, List.of(), null, List.of(), List.of(), "Quan 1"
        )));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.requirement().location()).isNull();
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.LOCATION);
            assertThat(clarification.reason()).isEqualTo(ClarificationReason.NOT_FOUND);
            assertThat(clarification.blocking()).isFalse();
        });
    }

    @Test
    void missingOfflineLocationDoesNotBlockCoreMatchingReady() {
        var response = service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.OFFLINE, null, List.of(), null, List.of(), List.of(), null
        )));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.coreMatchingReady()).isTrue();
        assertThat(response.requirement().location()).isNull();
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.LOCATION);
            assertThat(clarification.reason()).isEqualTo(ClarificationReason.OPTIONAL_REFINEMENT);
            assertThat(clarification.blocking()).isFalse();
        });
    }

    @Test
    void approximateScheduleIsPreservedAndDoesNotBlockCoreReadiness() {
        var response = service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.ONLINE, null,
                List.of(new PreferredSchedule(2, null, null, TimeOfDayHint.EVENING)),
                null, List.of(), List.of(), null
        )));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.coreMatchingReady()).isTrue();
        assertThat(response.requirement().preferredSchedules()).hasSize(1);
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.SCHEDULE);
            assertThat(clarification.blocking()).isFalse();
        });
    }

    @Test
    void budgetAndSemanticFieldsArePreserved() {
        var budget = new Budget(BigDecimal.valueOf(200_000), BigDecimal.valueOf(300_000), null, "VND", "SESSION", false);
        var response = service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.ONLINE, budget, List.of(), "On thi",
                List.of("Tich phan"), List.of("Day cham"), null
        )));

        assertThat(response.requirement().budget()).isEqualTo(budget);
        assertThat(response.requirement().learningGoal()).isEqualTo("On thi");
        assertThat(response.requirement().weakTopics()).containsExactly("Tich phan");
        assertThat(response.requirement().tutorPreferences()).containsExactly("Day cham");
    }

    @Test
    void catalogUnavailablePropagatesControlledException() {
        catalogClient.snapshot = null;

        assertThatThrownBy(() -> service.ground(request(requirement("Toan", "Lop 12", TeachingMode.ONLINE))))
                .isInstanceOf(CatalogGroundingService.CatalogGroundingUnavailableException.class);
    }

    @Test
    void locationReferenceUnavailablePropagatesControlledException() {
        locationClient.snapshot = null;

        assertThatThrownBy(() -> service.ground(request(new ExtractedRequirement(
                "Toan", "Lop 12", TeachingMode.OFFLINE, null, List.of(), null, List.of(), List.of(), "TP.HCM"
        )))).isInstanceOf(CatalogGroundingService.LocationGroundingUnavailableException.class);
    }

    private GroundRequirementRequest request(ExtractedRequirement requirement) {
        return new GroundRequirementRequest(requirement);
    }

    private ExtractedRequirement requirement(String subjectHint, String levelHint, TeachingMode teachingMode) {
        return new ExtractedRequirement(subjectHint, levelHint, teachingMode, null, List.of(), null, List.of(), List.of(), null);
    }

    private LearningCatalogSnapshot defaultSnapshot() {
        LearningCategory academic = category(6L, "ACADEMIC");
        LearningCategory language = category(7L, "LANGUAGE");
        LearningCategory programming = category(8L, "PROGRAMMING");
        return new LearningCatalogSnapshot(List.of(
                subject(5L, "MATH", "Toan", academic, List.of(
                        level(7L, "GRADE_10", "Lop 10"),
                        level(8L, "GRADE_11", "Lop 11"),
                        level(9L, "GRADE_12", "Lop 12")
                )),
                subject(6L, "ENGLISH", "Tieng Anh", language, List.of(level(11L, "IELTS_65", "IELTS 6.5"))),
                subject(30L, "WEB_PROGRAMMING", "Lap trinh Web", programming, List.of(level(31L, "BASIC", "Co ban"))),
                subject(32L, "CPP_PROGRAMMING", "Lap trinh C++", programming, List.of(level(33L, "BASIC", "Co ban")))
        ));
    }

    private LearningSubject subject(Long id, String code, String name, LearningCategory category, List<LearningLevel> levels) {
        return new LearningSubject(id, code, name, null, category, levels);
    }

    private LearningLevel level(Long id, String code, String name) {
        return new LearningLevel(id, code, name, "GRADE", null);
    }

    private LearningCategory category(Long id, String code) {
        return new LearningCategory(
                id,
                code,
                code,
                new LearningOption(1L, "ACADEMIC", "Academic", null),
                new LearningOption(2L, "HIGH_SCHOOL", "High school", null)
        );
    }

    private final class StubCatalogClient implements LearningCatalogClient {
        private LearningCatalogSnapshot snapshot = defaultSnapshot();

        @Override
        public LearningCatalogSnapshot groundingSnapshot() {
            if (snapshot == null) {
                throw new CatalogGroundingService.CatalogGroundingUnavailableException("catalog unavailable");
            }
            return snapshot;
        }
    }

    private final class StubLocationClient implements AccountLocationClient {
        private int calls;
        private LocationSnapshot snapshot = defaultLocationSnapshot();

        @Override
        public LocationSnapshot locationSnapshot() {
            calls++;
            if (snapshot == null) {
                throw new CatalogGroundingService.LocationGroundingUnavailableException("location unavailable");
            }
            return snapshot;
        }
    }

    private LocationSnapshot defaultLocationSnapshot() {
        return new LocationSnapshot(List.of(
                new LocationProvince("HO_CHI_MINH", "Thanh pho Ho Chi Minh", List.of(
                        new LocationCommune("HCM_BEN_THANH", "Phuong Ben Thanh", "HO_CHI_MINH", "Thanh pho Ho Chi Minh"),
                        new LocationCommune("HCM_GO_VAP", "Phuong Go Vap", "HO_CHI_MINH", "Thanh pho Ho Chi Minh"),
                        new LocationCommune("HCM_AN_DONG", "Phuong An Dong", "HO_CHI_MINH", "Thanh pho Ho Chi Minh"),
                        new LocationCommune("HCM_AN_NHON", "Phuong An Nhon", "HO_CHI_MINH", "Thanh pho Ho Chi Minh")
                )),
                new LocationProvince("HA_NOI", "Thanh pho Ha Noi", List.of(
                        new LocationCommune("HN_HOAN_KIEM", "Phuong Hoan Kiem", "HA_NOI", "Thanh pho Ha Noi")
                ))
        ));
    }
}
