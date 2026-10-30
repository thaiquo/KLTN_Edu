package iuh.fit.ai_service.service;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

final class CommunitySafetyPolicy {
    Optional<Decision> decide(String title, String content) {
        String text = normalize((title == null ? "" : title) + " " + (content == null ? "" : content));
        if (containsAny(text, "phong chong", "nhan biet tac hai", "phan tich tac hai", "canh bao tac hai")
                && containsAny(text, "co bac", "song bac", "mua dam", "ban dam", "mai dam", "tinh duc")) {
            return Optional.of(allowed("Nội dung thảo luận chủ đề nhạy cảm trong ngữ cảnh phòng ngừa hoặc giáo dục rõ ràng."));
        }
        if (containsAny(text, "to chuc co bac", "to chuc song bac", "mo song bac", "dieu hanh song bac",
                "van hanh song bac", "mo phong doi truy tinh duc", "tim dich vu tinh duc",
                "can dich vu tinh duc", "mua dich vu tinh duc", "cung cap dich vu tinh duc",
                "muon mua dam", "can mua dam", "tim nguoi mua dam", "tim nguoi ban dam",
                "cung cap mai dam", "kinh doanh mai dam")) {
            boolean sexual = containsAny(text, "tinh duc", "mua dam", "ban dam", "mai dam");
            return Optional.of(new Decision(CommunityModerationClassifier.Recommendation.REJECT,
                    CommunityModerationClassifier.Risk.HIGH,
                    List.of(sexual ? CommunityModerationClassifier.Category.SEXUAL_INAPPROPRIATE
                            : CommunityModerationClassifier.Category.OTHER_UNSAFE),
                    "Nội dung thể hiện mục đích không phù hợp với môi trường giáo dục và không thể được AI chỉnh sửa tự động."));
        }
        if (containsAny(text, "giao duc gioi tinh", "suc khoe sinh san", "tinh duc an toan")) {
            return Optional.of(allowed("Nội dung có mục tiêu giáo dục sức khỏe rõ ràng."));
        }
        if (containsAny(text, "may tro nguoi lon", "may thu 18", "chuyen 18",
                "kiem tien bang danh bai", "kiem tien tu danh bai")) {
            return Optional.of(new Decision(CommunityModerationClassifier.Recommendation.NEEDS_REVIEW,
                    CommunityModerationClassifier.Risk.MEDIUM,
                    List.of(CommunityModerationClassifier.Category.OTHER_UNSAFE),
                    "Nội dung chưa cung cấp đủ ngữ cảnh để xác định mục tiêu giáo dục; cần Staff/Admin kiểm duyệt."));
        }
        boolean cardTerms = containsAny(text, "choi bai", "danh bai", "bo bai", "ca cuoc", "co bac");
        boolean educationalContext = containsAny(text, "xac suat", "ly thuyet tro choi", "bai toan", "mon toan");
        if (cardTerms && educationalContext) {
            return Optional.of(allowed("Nội dung dùng ví dụ trò chơi trong ngữ cảnh học tập rõ ràng."));
        }
        if (cardTerms && containsAny(text, "gia su", "nguoi day", "muon hoc", "can hoc")) {
            return Optional.of(needsEdit(CommunityModerationClassifier.Category.OTHER_UNSAFE,
                    "Nội dung có cách diễn đạt chưa phù hợp, nhưng nhu cầu học tập vẫn có thể chỉnh sửa theo hướng xác suất hoặc lý thuyết trò chơi."));
        }
        if (text.contains("tinh duc")) {
            return Optional.of(needsEdit(CommunityModerationClassifier.Category.SEXUAL_INAPPROPRIATE,
                    "Nội dung có cách diễn đạt nhạy cảm; hãy nêu rõ mục tiêu giáo dục giới tính hoặc sức khỏe."));
        }
        return Optional.empty();
    }

    private Decision allowed(String reason) {
        return new Decision(CommunityModerationClassifier.Recommendation.ALLOW,
                CommunityModerationClassifier.Risk.LOW, List.of(), reason);
    }

    private Decision needsEdit(CommunityModerationClassifier.Category category, String reason) {
        return new Decision(CommunityModerationClassifier.Recommendation.NEEDS_EDIT,
                CommunityModerationClassifier.Risk.MEDIUM, List.of(category), reason);
    }

    private boolean containsAny(String text, String... phrases) {
        for (String phrase : phrases) if (text.contains(phrase)) return true;
        return false;
    }

    private String normalize(String value) {
        String decomposed = Normalizer.normalize(value, Normalizer.Form.NFD).replace('đ', 'd').replace('Đ', 'D');
        return decomposed.replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ").trim();
    }

    record Decision(CommunityModerationClassifier.Recommendation recommendation,
                    CommunityModerationClassifier.Risk risk,
                    List<CommunityModerationClassifier.Category> categories,
                    String reason) {}
}
