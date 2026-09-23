package iuh.fit.account_service.service;

import iuh.fit.account_service.client.LearningTutorSearchDataClient;
import iuh.fit.account_service.dto.learning.LearningTutorSearchDataResponse;
import iuh.fit.account_service.dto.tutor.TutorSearchResponseV2;
import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class PublicTutorSearchV2Service {
    private static final int DEFAULT_PAGE_SIZE = 12;
    private static final int MAX_PAGE_SIZE = 50;

    private final TutorRepository tutorRepository;
    private final LearningTutorSearchDataClient learningClient;
    private final FileStorageService fileStorageService;

    public PublicTutorSearchV2Service(
            TutorRepository tutorRepository,
            LearningTutorSearchDataClient learningClient,
            FileStorageService fileStorageService
    ) {
        this.tutorRepository = tutorRepository;
        this.learningClient = learningClient;
        this.fileStorageService = fileStorageService;
    }

    @Transactional(readOnly = true)
    public TutorSearchResponseV2.PageResponse search(
            String keyword,
            Long programTypeId,
            Long educationLevelId,
            Long categoryId,
            Long subjectId,
            Long levelId,
            String teachingMode,
            String provinceCode,
            String province,
            String communeCode,
            String commune,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Double minRating,
            Integer minExperience,
            Integer dayOfWeek,
            String startTime,
            String endTime,
            Integer page,
            Integer size,
            String sort
    ) {
        validateRange(minPrice, maxPrice);
        validateNonNegative("minRating", minRating);
        validateNonNegative("minExperience", minExperience == null ? null : minExperience.doubleValue());
        int normalizedPage = Math.max(page == null ? 0 : page, 0);
        int normalizedSize = Math.min(Math.max(size == null ? DEFAULT_PAGE_SIZE : size, 1), MAX_PAGE_SIZE);

        List<Tutor> accountCandidates = tutorRepository.findAllPublicTutors().stream()
                .filter(tutor -> matchesAccountFilters(tutor, keyword, provinceCode, province, communeCode, commune))
                .toList();
        if (accountCandidates.isEmpty()) {
            return emptyPage(normalizedPage, normalizedSize);
        }

        List<Long> tutorProfileIds = accountCandidates.stream().map(Tutor::getId).toList();
        Map<Long, LearningTutorSearchDataResponse> learningByProfileId = new LinkedHashMap<>();
        learningClient.searchData(
                tutorProfileIds,
                programTypeId,
                educationLevelId,
                categoryId,
                subjectId,
                levelId,
                normalizeOptional(teachingMode),
                minPrice,
                maxPrice,
                minRating,
                minExperience,
                dayOfWeek,
                normalizeOptional(startTime),
                normalizeOptional(endTime)
        ).forEach(item -> learningByProfileId.put(item.getTutorProfileId(), item));

        List<TutorSearchResponseV2> responses = accountCandidates.stream()
                .filter(tutor -> learningByProfileId.containsKey(tutor.getId()))
                .map(tutor -> toResponse(tutor, learningByProfileId.get(tutor.getId())))
                .sorted(comparator(sort, hasCapabilityContext(programTypeId, educationLevelId, categoryId, subjectId)))
                .toList();

        long total = responses.size();
        int totalPages = normalizedSize == 0 ? 0 : (int) Math.ceil(total / (double) normalizedSize);
        int fromIndex = Math.min(normalizedPage * normalizedSize, responses.size());
        int toIndex = Math.min(fromIndex + normalizedSize, responses.size());
        List<TutorSearchResponseV2> content = responses.subList(fromIndex, toIndex);
        return new TutorSearchResponseV2.PageResponse(
                content,
                normalizedPage,
                normalizedSize,
                total,
                totalPages,
                normalizedPage >= Math.max(totalPages - 1, 0)
        );
    }

    @Transactional(readOnly = true)
    public TutorSearchResponseV2 detail(Long tutorProfileId) {
        Tutor tutor = tutorRepository.findAllPublicTutors().stream()
                .filter(candidate -> candidate.getId().equals(tutorProfileId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Tutor profile not found"));

        LearningTutorSearchDataResponse learning = learningClient.searchData(
                        List.of(tutorProfileId),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null
                ).stream()
                .filter(item -> tutorProfileId.equals(item.getTutorProfileId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Tutor public learning profile not found"));

        return toResponse(tutor, learning);
    }

    private boolean matchesAccountFilters(Tutor tutor, String keyword, String provinceCode, String province,
                                          String communeCode, String commune) {
        User user = tutor.getUser();
        if (StringUtils.hasText(keyword)) {
            String normalizedKeyword = keyword.trim().toLowerCase(Locale.ROOT);
            boolean match = contains(user.getFullName(), normalizedKeyword)
                    || contains(tutor.getBio(), normalizedKeyword)
                    || contains(user.getBio(), normalizedKeyword);
            if (!match) {
                return false;
            }
        }
        if (StringUtils.hasText(provinceCode) && !provinceCode.trim().equalsIgnoreCase(nullToEmpty(user.getProvinceCode()))) {
            return false;
        }
        if (StringUtils.hasText(province) && !contains(user.getProvince(), province.trim().toLowerCase(Locale.ROOT))) {
            return false;
        }
        if (StringUtils.hasText(communeCode) && !communeCode.trim().equalsIgnoreCase(nullToEmpty(user.getCommuneCode()))) {
            return false;
        }
        return !StringUtils.hasText(commune) || contains(user.getCommune(), commune.trim().toLowerCase(Locale.ROOT));
    }

    private TutorSearchResponseV2 toResponse(Tutor tutor, LearningTutorSearchDataResponse learning) {
        User user = tutor.getUser();
        return new TutorSearchResponseV2(
                tutor.getId(),
                user.getId(),
                user.getFullName(),
                resolveAvatarUrl(user.getAvatarKey()),
                StringUtils.hasText(tutor.getBio()) ? tutor.getBio() : user.getBio(),
                true,
                new TutorSearchResponseV2.LocationResponse(
                        user.getProvinceCode(),
                        user.getProvince(),
                        user.getCommuneCode(),
                        user.getCommune(),
                        user.getDistrict()
                ),
                learning.getTeachingModes() == null ? Set.of() : learning.getTeachingModes(),
                mapCapabilities(learning.getSubjects()),
                learning.getStartingTuition(),
                mapAvailability(learning.getAvailability()),
                learning.getAverageRating() == null ? 0.0 : learning.getAverageRating(),
                learning.getReviewCount() == null ? 0L : learning.getReviewCount(),
                learning.getPublishedClassCount() == null ? 0L : learning.getPublishedClassCount(),
                tutor.getCreatedAt()
        );
    }

    private List<TutorSearchResponseV2.SubjectCapabilityResponse> mapCapabilities(
            List<LearningTutorSearchDataResponse.CapabilityResponse> capabilities
    ) {
        if (capabilities == null) {
            return List.of();
        }
        return capabilities.stream()
                .map(item -> new TutorSearchResponseV2.SubjectCapabilityResponse(
                        item.getRegistrationId(),
                        item.getSubjectId(),
                        item.getSubjectName(),
                        item.getCategoryId(),
                        item.getCategoryName(),
                        mapLevels(item.getLevels()),
                        item.getExperienceYears(),
                        item.getTuitionMin(),
                        item.getTuitionMax(),
                        item.getDescription()
                ))
                .toList();
    }

    private List<TutorSearchResponseV2.LevelResponse> mapLevels(List<LearningTutorSearchDataResponse.LevelResponse> levels) {
        if (levels == null) {
            return List.of();
        }
        return levels.stream()
                .map(item -> new TutorSearchResponseV2.LevelResponse(item.getLevelId(), item.getLevelName()))
                .toList();
    }

    private List<TutorSearchResponseV2.AvailabilitySlotResponse> mapAvailability(
            List<LearningTutorSearchDataResponse.AvailabilitySlotResponse> availability
    ) {
        if (availability == null) {
            return List.of();
        }
        return availability.stream()
                .map(item -> new TutorSearchResponseV2.AvailabilitySlotResponse(
                        item.getId(),
                        item.getDayOfWeek(),
                        item.getStartTime(),
                        item.getEndTime()
                ))
                .toList();
    }

    private Comparator<TutorSearchResponseV2> comparator(String sort, boolean subjectContext) {
        SortSpec spec = SortSpec.parse(sort);
        Comparator<TutorSearchResponseV2> comparator = switch (spec.field()) {
            case "rating" -> Comparator.comparing(response -> nullToZero(response.averageRating()));
            case "reviewCount" -> Comparator.comparing(response -> nullToZero(response.reviewCount()));
            case "price" -> Comparator.comparing(response -> priceSortValue(response, subjectContext), Comparator.nullsLast(BigDecimal::compareTo));
            case "experience" -> Comparator.comparing(response -> experienceSortValue(response, subjectContext));
            case "name" -> Comparator.comparing(response -> nullToEmpty(response.fullName()).toLowerCase(Locale.ROOT));
            default -> Comparator.comparing(response -> nullToEmpty(response.fullName()).toLowerCase(Locale.ROOT));
        };
        if (spec.desc()) {
            comparator = comparator.reversed();
        }
        return comparator.thenComparing(TutorSearchResponseV2::tutorId);
    }

    private BigDecimal priceSortValue(TutorSearchResponseV2 response, boolean subjectContext) {
        if (!subjectContext) {
            return response.startingTuition();
        }
        return response.subjects().stream()
                .map(TutorSearchResponseV2.SubjectCapabilityResponse::tuitionMin)
                .filter(value -> value != null)
                .min(BigDecimal::compareTo)
                .orElse(response.startingTuition());
    }

    private Integer experienceSortValue(TutorSearchResponseV2 response, boolean subjectContext) {
        return response.subjects().stream()
                .map(TutorSearchResponseV2.SubjectCapabilityResponse::experienceYears)
                .filter(value -> value != null)
                .max(Integer::compareTo)
                .orElse(0);
    }

    private String resolveAvatarUrl(String avatarKey) {
        if (!StringUtils.hasText(avatarKey)) {
            return null;
        }
        try {
            return fileStorageService.createPresignedGetUrl(avatarKey);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private TutorSearchResponseV2.PageResponse emptyPage(int page, int size) {
        return new TutorSearchResponseV2.PageResponse(List.of(), page, size, 0, 0, true);
    }

    private boolean hasCapabilityContext(Long programTypeId, Long educationLevelId, Long categoryId, Long subjectId) {
        return programTypeId != null || educationLevelId != null || categoryId != null || subjectId != null;
    }

    private void validateRange(BigDecimal minPrice, BigDecimal maxPrice) {
        if (minPrice != null && minPrice.signum() < 0) {
            throw new BadRequestException("minPrice must not be negative");
        }
        if (maxPrice != null && maxPrice.signum() < 0) {
            throw new BadRequestException("maxPrice must not be negative");
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new BadRequestException("minPrice must be less than or equal to maxPrice");
        }
    }

    private void validateNonNegative(String field, Double value) {
        if (value != null && value < 0) {
            throw new BadRequestException(field + " must not be negative");
        }
    }

    private boolean contains(String value, String normalizedKeyword) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(normalizedKeyword);
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private double nullToZero(Double value) {
        return value == null ? 0.0 : value;
    }

    private long nullToZero(Long value) {
        return value == null ? 0L : value;
    }

    private record SortSpec(String field, boolean desc) {
        private static SortSpec parse(String raw) {
            if (!StringUtils.hasText(raw)) {
                return new SortSpec("name", false);
            }
            String[] parts = raw.trim().split(",", 2);
            String field = parts[0].trim();
            boolean desc = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim());
            return new SortSpec(field, desc);
        }
    }
}
