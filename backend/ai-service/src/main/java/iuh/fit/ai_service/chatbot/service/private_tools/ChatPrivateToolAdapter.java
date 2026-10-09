package iuh.fit.ai_service.chatbot.service.private_tools;

import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatAction;
import iuh.fit.ai_service.chatbot.model.ChatIntent;
import iuh.fit.ai_service.chatbot.model.ChatTool;
import iuh.fit.ai_service.chatbot.model.NavigationAction;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.chatbot.service.ChatMatchingResult;
import iuh.fit.ai_service.chatbot.service.ChatToolRegistry;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Component
public class ChatPrivateToolAdapter {
    private static final int ITEM_LIMIT = 5;
    private static final Set<String> ACTIVE_CLASS_STATUSES = Set.of("ACTIVE", "PUBLISHED", "PRIVATE", "LOCKED");

    private final PrivateLearningClient learningClient;
    private final PrivateContractClient contractClient;
    private final ChatToolRegistry toolRegistry;

    public ChatPrivateToolAdapter(
            PrivateLearningClient learningClient,
            PrivateContractClient contractClient,
            ChatToolRegistry toolRegistry
    ) {
        this.learningClient = learningClient;
        this.contractClient = contractClient;
        this.toolRegistry = toolRegistry;
    }

    public ChatMatchingResult respond(String message, ChatIntent intent, AiUserContext userContext) {
        if (userContext == null || !userContext.authenticated()) {
            return new ChatMatchingResult(
                    "Bạn cần đăng nhập để tôi xem thông tin cá nhân như lớp học, lịch, bài tập, hợp đồng hoặc thanh toán của bạn.",
                    List.of(new ChatAction(NavigationAction.OPEN_LOGIN, "Đăng nhập")),
                    null
            );
        }
        if (userContext.hasActiveRole("STUDENT")) {
            return studentResponse(message, intent, userContext);
        }
        if (userContext.hasActiveRole("TUTOR")) {
            return tutorResponse(message, intent, userContext);
        }
        return new ChatMatchingResult(
                "Hiện trợ lý chỉ hỗ trợ công cụ đọc dữ liệu riêng cho vai trò Student hoặc Tutor đang hoạt động.",
                List.of(),
                null
        );
    }

    public ChatMatchingResult mutationDenied(AiUserContext userContext) {
        return new ChatMatchingResult(
                "Tôi không thể thực hiện thao tác thay bạn. Bạn có thể mở đúng trang để kiểm tra và tự xác nhận các hành động như duyệt yêu cầu, nộp/chấm bài, ký hoặc thanh toán hợp đồng.",
                userContext != null && userContext.authenticated()
                        ? List.of()
                        : List.of(new ChatAction(NavigationAction.OPEN_LOGIN, "Đăng nhập")),
                null
        );
    }

    private ChatMatchingResult studentResponse(String message, ChatIntent intent, AiUserContext userContext) {
        return switch (intent) {
            case MY_CLASSES -> buildLearningResult(
                    () -> studentClasses(learningClient.studentClasses()),
                    ChatTool.STUDENT_MY_CLASSES,
                    NavigationAction.OPEN_STUDENT_CLASSES,
                    "Mở lớp của tôi",
                    userContext
            );
            case CURRENT_SCHEDULE -> buildLearningResult(
                    () -> studentSchedule(learningClient.studentSchedule(), message),
                    ChatTool.STUDENT_SCHEDULE,
                    NavigationAction.OPEN_STUDENT_SCHEDULE,
                    "Mở lịch học",
                    userContext
            );
            case HOMEWORK -> buildLearningResult(
                    () -> studentHomework(learningClient.studentHomework()),
                    ChatTool.STUDENT_HOMEWORK,
                    NavigationAction.OPEN_STUDENT_HOMEWORK,
                    "Mở bài tập",
                    userContext
            );
            case ENROLLMENT_REQUESTS -> buildLearningResult(
                    () -> enrollmentRequests("STUDENT_ENROLLMENT_REQUESTS", learningClient.studentEnrollmentRequests()),
                    ChatTool.STUDENT_ENROLLMENT_REQUESTS,
                    NavigationAction.OPEN_STUDENT_CLASSES,
                    "Mở lớp của tôi",
                    userContext
            );
            case CONTRACT_STATUS -> buildContractResult(
                    () -> contracts("STUDENT_CONTRACTS", contractClient.agreements(20)),
                    ChatTool.STUDENT_CONTRACTS,
                    NavigationAction.OPEN_STUDENT_CONTRACTS,
                    "Mở hợp đồng",
                    userContext
            );
            case PAYMENT_STATUS -> buildContractResult(
                    () -> payments(contractClient.agreements(20)),
                    ChatTool.STUDENT_PAYMENT_STATUS,
                    NavigationAction.OPEN_STUDENT_WALLET,
                    "Mở ví và thanh toán",
                    userContext
            );
            default -> roleMismatch("student", "Bạn đang ở vai trò Student. Tôi chỉ có thể xem dữ liệu học viên của bạn trong vai trò này.");
        };
    }

    private ChatMatchingResult tutorResponse(String message, ChatIntent intent, AiUserContext userContext) {
        return switch (intent) {
            case MY_CLASSES -> buildLearningResult(
                    () -> tutorClasses(learningClient.tutorClasses()),
                    ChatTool.TUTOR_MY_CLASSES,
                    NavigationAction.OPEN_TUTOR_CLASSES,
                    "Mở lớp đang dạy",
                    userContext
            );
            case CURRENT_SCHEDULE -> buildLearningResult(
                    () -> tutorSchedule(message),
                    ChatTool.TUTOR_SCHEDULE,
                    NavigationAction.OPEN_TUTOR_SCHEDULE,
                    "Mở lịch dạy",
                    userContext
            );
            case HOMEWORK -> buildLearningResult(
                    () -> tutorPendingHomework(learningClient.tutorHomework()),
                    ChatTool.TUTOR_PENDING_HOMEWORK,
                    NavigationAction.OPEN_TUTOR_HOMEWORK,
                    "Mở chấm bài",
                    userContext
            );
            case ENROLLMENT_REQUESTS -> buildLearningResult(
                    () -> enrollmentRequests("TUTOR_ENROLLMENT_REQUESTS", learningClient.tutorEnrollmentRequests()),
                    ChatTool.TUTOR_ENROLLMENT_REQUESTS,
                    NavigationAction.OPEN_TUTOR_ENROLLMENT_REQUESTS,
                    "Mở yêu cầu tham gia",
                    userContext
            );
            case CONTRACT_STATUS -> buildContractResult(
                    () -> contracts("TUTOR_CONTRACTS", contractClient.agreements(20)),
                    ChatTool.TUTOR_CONTRACTS,
                    NavigationAction.OPEN_TUTOR_CONTRACTS,
                    "Mở hợp đồng",
                    userContext
            );
            case SETTLEMENTS -> buildContractResult(
                    () -> settlements(contractClient.agreements(10)),
                    ChatTool.TUTOR_SETTLEMENTS,
                    NavigationAction.OPEN_TUTOR_CONTRACTS,
                    "Mở quyết toán",
                    userContext
            );
            case AVAILABILITY -> buildLearningResult(
                    () -> availability(learningClient.tutorAvailability()),
                    ChatTool.TUTOR_AVAILABILITY,
                    NavigationAction.OPEN_TUTOR_AVAILABILITY,
                    "Mở lịch rảnh",
                    userContext
            );
            default -> roleMismatch("tutor", "Bạn đang ở vai trò Tutor. Tôi chỉ có thể xem dữ liệu gia sư của bạn trong vai trò này.");
        };
    }

    private ChatMatchingResult buildLearningResult(ResultSupplier supplier, ChatTool tool, NavigationAction action,
                                                   String label, AiUserContext userContext) {
        return buildResult(supplier, tool, action, label, userContext);
    }

    private ChatMatchingResult buildContractResult(ResultSupplier supplier, ChatTool tool, NavigationAction action,
                                                   String label, AiUserContext userContext) {
        return buildResult(supplier, tool, action, label, userContext);
    }

    private ChatMatchingResult buildResult(ResultSupplier supplier, ChatTool tool, NavigationAction action,
                                           String label, AiUserContext userContext) {
        try {
            PrivateToolView view = supplier.get();
            return new ChatMatchingResult(
                    view.message(),
                    toolRegistry.privateNavigationAction(userContext, tool, action, label),
                    view.toolResult()
            );
        } catch (PrivateToolException exception) {
            return privateToolFailure(exception);
        }
    }

    private ChatMatchingResult privateToolFailure(PrivateToolException exception) {
        String message = switch (exception.reason()) {
            case UNAUTHORIZED -> "Phiên đăng nhập của bạn có thể đã hết hạn. Vui lòng đăng nhập lại để xem dữ liệu riêng tư.";
            case FORBIDDEN -> "Vai trò hiện tại không có quyền xem dữ liệu này. Hãy kiểm tra vai trò đang hoạt động trong tài khoản.";
            case DOWNSTREAM_UNAVAILABLE -> "Hiện tôi chưa đọc được dữ liệu từ dịch vụ liên quan. Bạn có thể mở trang tương ứng hoặc thử lại sau.";
        };
        return new ChatMatchingResult(message, List.of(), null);
    }

    private ChatMatchingResult roleMismatch(String role, String message) {
        NavigationAction action = "student".equals(role) ? NavigationAction.OPEN_STUDENT_CLASSES : NavigationAction.OPEN_TUTOR_CLASSES;
        return new ChatMatchingResult(message, List.of(new ChatAction(action, "Mở khu vực phù hợp")), null);
    }

    private PrivateToolView studentClasses(List<Map<String, Object>> classes) {
        List<Map<String, Object>> items = classes.stream()
                .limit(ITEM_LIMIT)
                .map(this::classItem)
                .toList();
        if (classes.isEmpty()) {
            return view("STUDENT_CLASSES", items, 0, "Hi\u1ec7n t\u1ea1i b\u1ea1n ch\u01b0a tham gia l\u1edbp h\u1ecdc n\u00e0o.");
        }
        return view("STUDENT_CLASSES", items, classes.size(), "Tôi tìm thấy " + classes.size() + " lớp học trong tài khoản Student của bạn.");
    }

    private PrivateToolView tutorClasses(List<Map<String, Object>> classes) {
        List<Map<String, Object>> items = classes.stream()
                .limit(ITEM_LIMIT)
                .map(this::classItem)
                .toList();
        if (classes.isEmpty()) {
            return view("TUTOR_CLASSES", items, 0, "Hi\u1ec7n t\u1ea1i b\u1ea1n ch\u01b0a qu\u1ea3n l\u00fd l\u1edbp h\u1ecdc n\u00e0o.");
        }
        return view("TUTOR_CLASSES", items, classes.size(), "Tôi tìm thấy " + classes.size() + " lớp bạn đang quản lý.");
    }

    @SuppressWarnings("unchecked")
    private PrivateToolView studentSchedule(Map<String, Object> schedule, String message) {
        List<Map<String, Object>> sessions = list(schedule.get("sessions"));
        List<Map<String, Object>> recurring = list(schedule.get("recurringSchedules"));
        List<Map<String, Object>> filtered = filterByTimeHint(sessions, message).stream()
                .limit(ITEM_LIMIT)
                .map(this::sessionItem)
                .toList();
        Map<String, Object> result = result("STUDENT_SCHEDULE", filtered, sessions.size());
        result.put("recurringCount", recurring.size());
        return new PrivateToolView(
                "Tôi tìm thấy " + sessions.size() + " buổi học sắp tới và " + recurring.size() + " lịch học định kỳ của bạn.",
                result
        );
    }

    private PrivateToolView tutorSchedule(String message) {
        List<Map<String, Object>> classes = learningClient.tutorClasses().stream()
                .filter(item -> ACTIVE_CLASS_STATUSES.contains(text(item, "status").toUpperCase(Locale.ROOT)))
                .limit(8)
                .toList();
        List<Map<String, Object>> sessions = new ArrayList<>();
        for (Map<String, Object> classItem : classes) {
            Long classId = longValue(classItem.get("id"));
            if (classId == null) {
                continue;
            }
            for (Map<String, Object> session : learningClient.classSessions(classId)) {
                Map<String, Object> safe = sessionItem(session);
                safe.putIfAbsent("className", text(classItem, "name"));
                sessions.add(safe);
            }
        }
        List<Map<String, Object>> filtered = filterByTimeHint(sessions, message).stream()
                .limit(ITEM_LIMIT)
                .toList();
        return view("TUTOR_SCHEDULE", filtered, sessions.size(), "Tôi tìm thấy " + sessions.size() + " buổi dạy từ các lớp đang hoạt động của bạn.");
    }

    private PrivateToolView studentHomework(List<Map<String, Object>> homework) {
        List<Map<String, Object>> items = homework.stream()
                .limit(ITEM_LIMIT)
                .map(this::studentHomeworkItem)
                .toList();
        long pending = homework.stream().filter(item -> !"GRADED".equalsIgnoreCase(text(item, "status"))).count();
        return view("STUDENT_HOMEWORK", items, homework.size(), "Bạn có " + pending + " bài tập chưa hoàn tất/chưa được chấm trong danh sách hiện tại.");
    }

    private PrivateToolView tutorPendingHomework(List<Map<String, Object>> homework) {
        List<Map<String, Object>> pending = homework.stream()
                .filter(item -> intValue(item.get("submittedCount")) > intValue(item.get("gradedCount")))
                .toList();
        List<Map<String, Object>> items = pending.stream()
                .limit(ITEM_LIMIT)
                .map(this::tutorHomeworkItem)
                .toList();
        return view("TUTOR_PENDING_HOMEWORK", items, pending.size(), "Bạn có " + pending.size() + " buổi có bài nộp đang chờ chấm.");
    }

    private PrivateToolView enrollmentRequests(String type, List<Map<String, Object>> requests) {
        List<Map<String, Object>> items = requests.stream()
                .limit(ITEM_LIMIT)
                .map(this::requestItem)
                .toList();
        return view(type, items, requests.size(), "Tôi tìm thấy " + requests.size() + " yêu cầu tham gia lớp liên quan đến tài khoản của bạn.");
    }

    private PrivateToolView contracts(String type, List<Map<String, Object>> agreements) {
        List<Map<String, Object>> items = agreements.stream()
                .limit(ITEM_LIMIT)
                .map(this::contractItem)
                .toList();
        return view(type, items, agreements.size(), "Tôi tìm thấy " + agreements.size() + " hợp đồng mà bạn có quyền xem.");
    }

    private PrivateToolView payments(List<Map<String, Object>> agreements) {
        List<Map<String, Object>> items = agreements.stream()
                .limit(ITEM_LIMIT)
                .map(this::paymentItem)
                .toList();
        long funded = agreements.stream().filter(item -> Boolean.TRUE.equals(item.get("onchainFunded"))).count();
        return view("PAYMENT_STATUS", items, agreements.size(), funded + "/" + agreements.size() + " hợp đồng của bạn đã có trạng thái funded on-chain.");
    }

    private PrivateToolView settlements(List<Map<String, Object>> agreements) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> agreement : agreements.stream().limit(5).toList()) {
            String agreementId = text(agreement, "id");
            for (Map<String, Object> settlement : contractClient.settlements(agreementId)) {
                Map<String, Object> safe = settlementItem(settlement);
                safe.put("agreementId", agreementId);
                safe.put("className", text(agreement, "className"));
                items.add(safe);
            }
        }
        items.sort(Comparator.comparing(item -> text(item, "updatedAt"), Comparator.nullsLast(Comparator.reverseOrder())));
        List<Map<String, Object>> limited = items.stream().limit(ITEM_LIMIT).toList();
        return view("TUTOR_SETTLEMENTS", limited, items.size(), "Tôi tìm thấy " + items.size() + " bản ghi quyết toán từ các hợp đồng bạn có quyền xem.");
    }

    private PrivateToolView availability(List<Map<String, Object>> slots) {
        List<Map<String, Object>> items = slots.stream()
                .limit(ITEM_LIMIT)
                .map(item -> mapOf(
                        "dayOfWeek", item.get("dayOfWeek"),
                        "startTime", text(item, "startTime"),
                        "endTime", text(item, "endTime")
                ))
                .toList();
        return view("TUTOR_AVAILABILITY", items, slots.size(), "Tôi tìm thấy " + slots.size() + " khung giờ rảnh đang được lưu cho Tutor của bạn.");
    }

    private Map<String, Object> classItem(Map<String, Object> item) {
        Map<String, Object> registration = map(item.get("registration"));
        Map<String, Object> level = map(item.get("level"));
        return mapOf(
                "classId", item.get("id"),
                "title", text(item, "name"),
                "subjectName", text(registration, "subjectName"),
                "levelName", text(level, "name"),
                "status", text(item, "status"),
                "teachingMode", text(item, "learningMode"),
                "startDate", text(item, "startDate"),
                "endDate", text(item, "endDate"),
                "pricePerSession", item.get("pricePerSession"),
                "availableSlots", item.get("availableSlots")
        );
    }

    private Map<String, Object> sessionItem(Map<String, Object> item) {
        return mapOf(
                "sessionId", item.get("sessionId") != null ? item.get("sessionId") : item.get("id"),
                "classId", item.get("classRoomId"),
                "className", text(item, "className"),
                "sequenceNumber", item.get("sequenceNumber"),
                "topic", text(item, "topic"),
                "sessionDate", text(item, "sessionDate"),
                "startTime", text(item, "startTime"),
                "endTime", text(item, "endTime"),
                "status", text(item, "status")
        );
    }

    private Map<String, Object> studentHomeworkItem(Map<String, Object> item) {
        return mapOf(
                "sessionId", item.get("sessionId"),
                "classId", item.get("classRoomId"),
                "className", text(item, "classTitle"),
                "title", Optional.ofNullable(text(item, "assignmentTitle")).filter(v -> !v.isBlank()).orElse(text(item, "topic")),
                "dueAt", text(item, "assignmentDueAt"),
                "status", text(item, "status"),
                "submittedAt", text(item, "submittedAt"),
                "gradeScore", text(item, "gradeScore")
        );
    }

    private Map<String, Object> tutorHomeworkItem(Map<String, Object> item) {
        return mapOf(
                "sessionId", item.get("sessionId"),
                "classId", item.get("classRoomId"),
                "className", text(item, "classTitle"),
                "title", Optional.ofNullable(text(item, "assignmentTitle")).filter(v -> !v.isBlank()).orElse(text(item, "topic")),
                "dueAt", text(item, "assignmentDueAt"),
                "submittedCount", item.get("submittedCount"),
                "gradedCount", item.get("gradedCount"),
                "pendingCount", Math.max(0, intValue(item.get("submittedCount")) - intValue(item.get("gradedCount")))
        );
    }

    private Map<String, Object> requestItem(Map<String, Object> item) {
        return mapOf(
                "requestId", item.get("id"),
                "classId", item.get("classRoomId"),
                "className", text(item, "className"),
                "studentName", text(item, "studentName"),
                "tutorName", text(item, "tutorFullName"),
                "status", text(item, "status"),
                "createdAt", text(item, "createdAt"),
                "updatedAt", text(item, "updatedAt")
        );
    }

    private Map<String, Object> contractItem(Map<String, Object> item) {
        return mapOf(
                "agreementId", item.get("id"),
                "classId", item.get("classroomId"),
                "className", text(item, "className"),
                "studentName", text(item, "studentName"),
                "tutorName", text(item, "tutorName"),
                "status", text(item, "status"),
                "totalAmountUsdc", item.get("totalAmountUsdc"),
                "settledSessions", item.get("settledSessions"),
                "totalSessions", item.get("totalSessions"),
                "onchainFunded", item.get("onchainFunded")
        );
    }

    private Map<String, Object> paymentItem(Map<String, Object> item) {
        return mapOf(
                "agreementId", item.get("id"),
                "className", text(item, "className"),
                "status", text(item, "status"),
                "onchainFunded", item.get("onchainFunded"),
                "totalAmountUsdc", item.get("totalAmountUsdc"),
                "remainingDeposit", item.get("remainingDeposit"),
                "releasedAmountUsdc", item.get("releasedAmountUsdc"),
                "refundedAmountUsdc", item.get("refundedAmountUsdc")
        );
    }

    private Map<String, Object> settlementItem(Map<String, Object> item) {
        return mapOf(
                "settlementId", item.get("id"),
                "sessionId", item.get("sessionId"),
                "outcome", text(item, "outcome"),
                "status", text(item, "status"),
                "amountUsdc", item.get("amountUsdc"),
                "tutorAmountUsdc", item.get("tutorAmountUsdc"),
                "platformAmountUsdc", item.get("platformAmountUsdc"),
                "studentRefundUsdc", item.get("studentRefundUsdc"),
                "createdAt", text(item, "createdAt"),
                "updatedAt", text(item, "updatedAt")
        );
    }

    private PrivateToolView view(String type, List<Map<String, Object>> items, int total, String message) {
        return new PrivateToolView(message, result(type, items, total));
    }

    private Map<String, Object> result(String type, List<Map<String, Object>> items, int total) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", type);
        result.put("items", items);
        result.put("totalCount", total);
        return result;
    }

    private List<Map<String, Object>> filterByTimeHint(List<Map<String, Object>> sessions, String message) {
        String normalized = normalize(message);
        if (!normalized.contains("hom nay") && !normalized.contains("ngay mai") && !normalized.contains("tuan nay")) {
            return sessions;
        }
        LocalDate now = LocalDate.now(ZoneId.systemDefault());
        LocalDate start = now;
        LocalDate end = now.plusDays(normalized.contains("tuan nay") ? 7 : 0);
        if (normalized.contains("ngay mai")) {
            start = now.plusDays(1);
            end = start;
        }
        LocalDate finalStart = start;
        LocalDate finalEnd = end;
        return sessions.stream()
                .filter(item -> {
                    try {
                        LocalDate date = LocalDate.parse(text(item, "sessionDate"));
                        return !date.isBefore(finalStart) && !date.isAfter(finalEnd);
                    } catch (RuntimeException exception) {
                        return false;
                    }
                })
                .toList();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> list(Object value) {
        if (value instanceof List<?> list) {
            return list.stream().filter(Map.class::isInstance).map(item -> (Map<String, Object>) item).toList();
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> raw ? (Map<String, Object>) raw : Map.of();
    }

    private Map<String, Object> mapOf(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int index = 0; index + 1 < keyValues.length; index += 2) {
            Object value = keyValues[index + 1];
            if (value != null && (!(value instanceof String text) || !text.isBlank())) {
                map.put(Objects.toString(keyValues[index]), value);
            }
        }
        return map;
    }

    private String text(Map<String, Object> item, String key) {
        Object value = item == null ? null : item.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private Long longValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return value == null ? null : Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private int intValue(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return value == null ? 0 : Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String noAccent = java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return noAccent.toLowerCase(Locale.ROOT).replace('đ', 'd').replace('Đ', 'd').trim();
    }

    private interface ResultSupplier {
        PrivateToolView get();
    }

    private record PrivateToolView(String message, Map<String, Object> toolResult) {
    }
}
