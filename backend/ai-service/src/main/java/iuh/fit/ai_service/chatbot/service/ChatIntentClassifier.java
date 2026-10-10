package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.model.ChatIntent;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

@Component
public class ChatIntentClassifier {
    private static final List<String> PRIVATE_HINTS = List.of(
            "cua toi", "cua minh", "my schedule", "my homework", "my contract", "my wallet", "my messages"
    );
    private static final List<String> NAVIGATION_HINTS = List.of(
            "dang nhap", "dang ky", "mo trang", "vao dau", "o dau"
    );
    private static final List<String> OUT_OF_SCOPE_HINTS = List.of(
            "viet game", "bat dong san", "crypto trading", "danh bac", "hack", "malware"
    );
    private static final List<String> MUTATION_HINTS = List.of(
            "chap nhan", "tu choi", "duyet", "huy yeu cau", "huy hop dong", "huy lop",
            "cham bai", "nop bai", "gui bai", "ky hop dong", "fund", "thanh toan giup",
            "sua lich", "doi lich", "luu lich", "tao lop", "sua lop", "xoa lop",
            "cap nhat", "nhan tin", "gui tin", "message"
    );

    public ChatIntent classify(String message) {
        String normalized = normalize(message);
        if (normalized.isBlank()) {
            return ChatIntent.GENERAL_KNOWLEDGE;
        }
        if (containsAny(normalized, OUT_OF_SCOPE_HINTS)) {
            return ChatIntent.OUT_OF_SCOPE;
        }
        if (containsAny(normalized, MUTATION_HINTS)) {
            return ChatIntent.MUTATION_REQUEST;
        }
        if (isAboutMatching(normalized) || isAboutEduConnectContractKnowledge(normalized)) {
            return ChatIntent.GENERAL_KNOWLEDGE;
        }
        if (isTutorTeachingStudentCountRequest(normalized)) {
            return ChatIntent.MY_CLASSES;
        }
        if (isTutorUpcomingScheduleRequest(normalized)) {
            return ChatIntent.CURRENT_SCHEDULE;
        }
        if (isPrivateClassCountRequest(normalized)) {
            return ChatIntent.MY_CLASSES;
        }
        if (isPublicTutorPrivateFieldRequest(normalized)) {
            return ChatIntent.PUBLIC_TUTOR_LOOKUP;
        }
        if (isPublicClassPrivateFieldRequest(normalized)) {
            return ChatIntent.PUBLIC_CLASS_LOOKUP;
        }
        if (isTutorMatchingRequest(normalized)) {
            return ChatIntent.TUTOR_MATCHING;
        }
        if (isClassMatchingRequest(normalized)) {
            return ChatIntent.CLASS_MATCHING;
        }
        if (isPublicTutorLookupRequest(normalized)) {
            return ChatIntent.PUBLIC_TUTOR_LOOKUP;
        }
        if (isPublicClassLookupRequest(normalized)) {
            return ChatIntent.PUBLIC_CLASS_LOOKUP;
        }
        ChatIntent privateIntent = privateIntent(normalized);
        if (privateIntent != null) {
            return privateIntent;
        }
        if (containsAny(normalized, PRIVATE_HINTS)) {
            return ChatIntent.PRIVATE_DATA_REQUEST;
        }
        if (containsAny(normalized, NAVIGATION_HINTS)) {
            return ChatIntent.NAVIGATION;
        }
        return ChatIntent.GENERAL_KNOWLEDGE;
    }

    private ChatIntent privateIntent(String value) {
        if (containsAny(value, List.of("lich ranh", "thoi gian ranh", "khung gio ranh", "availability"))) {
            return ChatIntent.AVAILABILITY;
        }
        if (containsAny(value, List.of("quyet toan", "giai ngan", "settlement", "thu nhap", "payout"))) {
            return ChatIntent.SETTLEMENTS;
        }
        if (containsAny(value, List.of("ky quy", "escrow", "payment", "thanh toan", "vi cua toi", "vi cua minh"))) {
            return ChatIntent.PAYMENT_STATUS;
        }
        if (containsAny(value, List.of("hop dong", "contract"))) {
            return ChatIntent.CONTRACT_STATUS;
        }
        if (containsAny(value, List.of("bai tap", "homework", "chua nop", "chua cham", "cho cham", "can cham", "sap het han"))) {
            return ChatIntent.HOMEWORK;
        }
        if (containsAny(value, List.of("yeu cau tham gia", "yeu cau hoc", "yeu cau vao lop", "xin vao lop", "enrollment request"))
                || (value.contains("dang cho") && containsAny(value, List.of("yeu cau", "xin vao lop", "tham gia lop")))) {
            return ChatIntent.ENROLLMENT_REQUESTS;
        }
        if (containsAny(value, List.of("lich hoc", "lich day", "hom nay", "ngay mai", "tuan nay", "schedule"))) {
            return ChatIntent.CURRENT_SCHEDULE;
        }
        if (isMyClassesRequest(value)) {
            return ChatIntent.MY_CLASSES;
        }
        return null;
    }

    private boolean isMyClassesRequest(String value) {
        if (containsAny(value, List.of("lop cua toi", "lop cua minh", "lop toi day", "lop minh day", "lop dang hoc", "lop dang day", "my class", "my classes"))) {
            return true;
        }
        return value.contains("lop")
                && containsAny(value, List.of(
                "dang hoc",
                "hoc lop nao",
                "dang day",
                "day lop nao",
                "tham gia lop",
                "quan ly lop"
        ));
    }

    private boolean isAboutMatching(String value) {
        return value.contains("ai matching la gi")
                || value.contains("matching la gi")
                || value.contains("ai matching hoat dong")
                || value.contains("giai thich ai matching");
    }

    private boolean isAboutEduConnectContractKnowledge(String value) {
        return value.contains("educonnect")
                && containsAny(value, List.of("hop dong dien tu", "hop dong thong minh", "smart contract"))
                && !containsAny(value, List.of("cua toi", "cua minh", "hop dong toi", "hop dong cua toi"));
    }

    private boolean isPrivateClassCountRequest(String value) {
        return value.contains("toi")
                && value.contains("lop")
                && containsAny(value, List.of("bao nhieu", "co may", "so luong", "may lop"));
    }

    private boolean isTutorTeachingStudentCountRequest(String value) {
        return value.contains("toi")
                && containsAny(value, List.of("dang day", "day bao nhieu", "quan ly bao nhieu"))
                && containsAny(value, List.of("hoc vien", "student"));
    }

    private boolean isTutorUpcomingScheduleRequest(String value) {
        return containsAny(value, List.of("sap dien ra", "sap toi", "gan toi", "lich day", "ca day"))
                && containsAny(value, List.of("lop", "buoi", "lich", "day"));
    }

    private boolean isPublicTutorLookupRequest(String value) {
        return containsAny(value, List.of("bao nhieu", "co may", "so luong", "danh sach", "co gia su", "co tutor"))
                && containsAny(value, List.of("gia su", "tutor", "nguoi day", "nguoi kem"));
    }

    private boolean isPublicClassLookupRequest(String value) {
        return !isPrivateClassCountRequest(value)
                && containsAny(value, List.of("bao nhieu", "co may", "so luong", "danh sach", "co lop", "co class"))
                && containsAny(value, List.of("lop hoc", "lop", "khoa hoc", "class"));
    }

    private boolean isPublicTutorPrivateFieldRequest(String value) {
        return containsAny(value, List.of("email", "so dien thoai", "phone", "cccd", "cmnd", "dia chi rieng"))
                && containsAny(value, List.of("gia su", "tutor", "nguoi day", "nguoi kem"));
    }

    private boolean isPublicClassPrivateFieldRequest(String value) {
        return containsAny(value, List.of("meeting link", "link phong", "ma vao lop", "join key", "danh sach hoc vien"))
                && containsAny(value, List.of("lop hoc", "lop", "khoa hoc", "class"));
    }

    private boolean isTutorMatchingRequest(String value) {
        boolean asksForSearch = containsAny(value, List.of("tim", "can", "muon", "cho toi", "goi y", "de xuat", "phu hop"));
        boolean tutorTarget = containsAny(value, List.of("gia su", "tutor", "nguoi day", "nguoi kem", "thay", "co giao"));
        return asksForSearch && tutorTarget;
    }

    private boolean isClassMatchingRequest(String value) {
        boolean asksForSearch = containsAny(value, List.of("tim", "can", "muon", "cho toi", "goi y", "de xuat", "phu hop"));
        boolean classTarget = containsAny(value, List.of("lop hoc", "lop", "khoa hoc", "class"));
        return asksForSearch && classTarget;
    }

    private boolean containsAny(String value, List<String> hints) {
        return hints.stream().anyMatch(value::contains);
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String noAccent = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return noAccent.toLowerCase(Locale.ROOT)
                .replace("\u0111", "d")
                .replace("\u0110", "d")
                .trim();
    }
}
