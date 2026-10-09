package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.client.AccountPublicTutorLookupClient;
import iuh.fit.ai_service.client.LearningPublicClassClient;
import iuh.fit.ai_service.chatbot.model.ChatTool;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassCard;
import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassSearchPage;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SubjectCapability;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorSearchPage;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Component
public class ChatPublicLookupAdapter {
    private static final int PREVIEW_LIMIT = 3;
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_ALNUM = Pattern.compile("[^\\p{IsAlphabetic}\\p{IsDigit}]+");

    private final AccountPublicTutorLookupClient tutorLookupClient;
    private final LearningPublicClassClient classClient;
    private final ChatCatalogHintResolver catalogHintResolver;
    private final RoleToolAuthorizer authorizer;

    public ChatPublicLookupAdapter(
            AccountPublicTutorLookupClient tutorLookupClient,
            LearningPublicClassClient classClient,
            ChatCatalogHintResolver catalogHintResolver,
            RoleToolAuthorizer authorizer
    ) {
        this.tutorLookupClient = tutorLookupClient;
        this.classClient = classClient;
        this.catalogHintResolver = catalogHintResolver;
        this.authorizer = authorizer;
    }

    public ChatMatchingResult tutorLookup(String message, AiUserContext userContext) {
        if (!authorizer.isAllowed(userContext, ChatTool.PUBLIC_TUTOR_LOOKUP)) {
            return new ChatMatchingResult("Bạn chưa có quyền tra cứu dữ liệu gia sư công khai trong trợ lý.", List.of(), null);
        }
        if (asksPrivateTutorField(message)) {
            return privacy("PUBLIC_TUTOR_LOOKUP");
        }
        try {
            ChatCatalogHintResolver.SubjectHint subject = resolveSubject(message);
            TeachingMode mode = teachingModeHint(message);
            TutorSearchPage page = tutorLookupClient.search(subject == null ? null : subject.id(), mode, PREVIEW_LIMIT);
            long total = page == null ? 0 : page.totalElements();
            List<Map<String, Object>> items = page == null || page.content() == null
                    ? List.of()
                    : page.content().stream().limit(PREVIEW_LIMIT).map(this::tutorItem).toList();
            return new ChatMatchingResult(
                    tutorCountMessage(total, subject, mode),
                    List.of(),
                    lookupResult("PUBLIC_TUTOR_LOOKUP", total, subject, mode, items)
            );
        } catch (RuntimeException exception) {
            return new ChatMatchingResult(
                    "Hiện tôi chưa thể lấy dữ liệu gia sư công khai. Bạn có thể thử lại sau.",
                    List.of(),
                    Map.of("type", "PUBLIC_TUTOR_LOOKUP", "available", false)
            );
        }
    }

    public ChatMatchingResult classLookup(String message, AiUserContext userContext) {
        if (!authorizer.isAllowed(userContext, ChatTool.PUBLIC_CLASS_LOOKUP)) {
            return new ChatMatchingResult("Bạn chưa có quyền tra cứu dữ liệu lớp công khai trong trợ lý.", List.of(), null);
        }
        if (asksPrivateClassField(message)) {
            return privacy("PUBLIC_CLASS_LOOKUP");
        }
        try {
            ChatCatalogHintResolver.SubjectHint subject = resolveSubject(message);
            TeachingMode mode = teachingModeHint(message);
            Boolean availableOnly = normalize(message).contains("dang tuyen") ? Boolean.TRUE : null;
            PublicClassSearchPage page = classClient.searchPublicClasses(subject == null ? null : subject.id(), mode, availableOnly, PREVIEW_LIMIT);
            long total = page == null ? 0 : page.totalElements();
            List<Map<String, Object>> items = page == null || page.content() == null
                    ? List.of()
                    : page.content().stream().limit(PREVIEW_LIMIT).map(this::classItem).toList();
            return new ChatMatchingResult(
                    classCountMessage(total, subject, mode),
                    List.of(),
                    lookupResult("PUBLIC_CLASS_LOOKUP", total, subject, mode, items)
            );
        } catch (RuntimeException exception) {
            return new ChatMatchingResult(
                    "Hiện tôi chưa thể lấy dữ liệu lớp công khai. Bạn có thể thử lại sau.",
                    List.of(),
                    Map.of("type", "PUBLIC_CLASS_LOOKUP", "available", false)
            );
        }
    }

    private ChatMatchingResult privacy(String type) {
        return new ChatMatchingResult(
                "Thông tin này không được công khai theo quyền truy cập hiện tại.",
                List.of(),
                Map.of("type", type, "privateFieldBlocked", true)
        );
    }

    private String tutorCountMessage(long total, ChatCatalogHintResolver.SubjectHint subject, TeachingMode mode) {
        if (total == 0) {
            return "Hiện chưa có gia sư công khai phù hợp với tiêu chí này.";
        }
        StringBuilder builder = new StringBuilder("Hiện có ")
                .append(total)
                .append(" gia sư công khai");
        if (subject != null) {
            builder.append(" dạy ").append(subject.name());
        }
        if (mode != null) {
            builder.append(mode == TeachingMode.ONLINE ? " theo hình thức online" : " theo hình thức trực tiếp");
        }
        return builder.append(".").toString();
    }

    private String classCountMessage(long total, ChatCatalogHintResolver.SubjectHint subject, TeachingMode mode) {
        if (total == 0) {
            return "Hiện chưa có lớp công khai phù hợp với tiêu chí này.";
        }
        StringBuilder builder = new StringBuilder("Hiện có ")
                .append(total)
                .append(" lớp công khai");
        if (subject != null) {
            builder.append(" môn ").append(subject.name());
        }
        if (mode != null) {
            builder.append(mode == TeachingMode.ONLINE ? " theo hình thức online" : " theo hình thức trực tiếp");
        }
        return builder.append(".").toString();
    }

    private Map<String, Object> lookupResult(String type, long total, ChatCatalogHintResolver.SubjectHint subject, TeachingMode mode, List<Map<String, Object>> items) {
        Map<String, Object> filters = new LinkedHashMap<>();
        if (subject != null) {
            filters.put("subjectId", subject.id());
            filters.put("subject", subject.name());
        }
        if (mode != null) {
            filters.put("teachingMode", mode.name());
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", type);
        result.put("total", total);
        result.put("filters", filters);
        result.put("items", items);
        result.put("countSource", "totalElements");
        result.put("resultLimit", PREVIEW_LIMIT);
        return result;
    }

    private Map<String, Object> tutorItem(TutorCandidate tutor) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("tutorId", tutor.tutorId());
        item.put("displayName", tutor.fullName());
        item.put("avatarUrl", tutor.avatarUrl());
        item.put("bio", tutor.bio());
        item.put("teachingModes", tutor.teachingModes());
        item.put("startingTuition", tutor.startingTuition());
        item.put("averageRating", tutor.averageRating());
        item.put("reviewCount", tutor.reviewCount());
        item.put("subjects", safeList(tutor.subjects()).stream().limit(3).map(this::subjectItem).toList());
        return item;
    }

    private Map<String, Object> subjectItem(SubjectCapability subject) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("subjectId", subject.subjectId());
        item.put("subjectName", subject.subjectName());
        item.put("categoryName", subject.categoryName());
        item.put("experienceYears", subject.experienceYears());
        item.put("tuitionMin", subject.tuitionMin());
        item.put("tuitionMax", subject.tuitionMax());
        return item;
    }

    private Map<String, Object> classItem(PublicClassCard item) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("classId", item.id());
        result.put("title", item.name());
        result.put("description", item.description());
        result.put("tutorName", item.tutorFullName());
        result.put("subjectName", item.registration() == null ? null : item.registration().subjectName());
        result.put("levelName", item.level() == null ? null : item.level().name());
        result.put("teachingMode", item.learningMode());
        result.put("pricePerSession", item.pricePerSession());
        result.put("availableSlots", item.availableSlots());
        result.put("averageRating", item.averageRating());
        result.put("reviewCount", item.reviewCount());
        return result;
    }

    private ChatCatalogHintResolver.SubjectHint resolveSubject(String message) {
        return catalogHintResolver.subjectHint(message).orElse(null);
    }

    private TeachingMode teachingModeHint(String message) {
        String normalized = normalize(message);
        if (normalized.contains("online") || normalized.contains("truc tuyen")) {
            return TeachingMode.ONLINE;
        }
        if (normalized.contains("offline") || normalized.contains("truc tiep")) {
            return TeachingMode.OFFLINE;
        }
        return null;
    }

    private boolean asksPrivateTutorField(String message) {
        String normalized = normalize(message);
        return normalized.contains("email")
                || normalized.contains("so dien thoai")
                || normalized.contains("phone")
                || normalized.contains("cccd")
                || normalized.contains("cmnd")
                || normalized.contains("dia chi rieng");
    }

    private boolean asksPrivateClassField(String message) {
        String normalized = normalize(message);
        return normalized.contains("meeting link")
                || normalized.contains("link phong")
                || normalized.contains("ma vao lop")
                || normalized.contains("join key")
                || normalized.contains("danh sach hoc vien");
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String withoutDiacritics = DIACRITICS.matcher(Normalizer.normalize(value, Normalizer.Form.NFD)).replaceAll("");
        String normalized = NON_ALNUM.matcher(withoutDiacritics.toLowerCase(Locale.ROOT)
                .replace("\u0111", "d")
                .replace("\u0110", "d")).replaceAll(" ").trim();
        return normalized.replaceAll("\\s+", " ");
    }
}
