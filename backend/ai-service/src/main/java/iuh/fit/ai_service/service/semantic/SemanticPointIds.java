package iuh.fit.ai_service.service.semantic;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

public final class SemanticPointIds {
    private SemanticPointIds() {
    }

    public static String tutorCapability(Long tutorId, Long registrationId, Long subjectId, Long levelId) {
        if (tutorId == null || registrationId == null || subjectId == null || levelId == null) {
            throw new IllegalArgumentException("Tutor semantic point id requires tutorId, registrationId, subjectId, and levelId.");
        }
        String identity = "tutor-capability:%d:%d:%d:%d".formatted(tutorId, registrationId, subjectId, levelId);
        return UUID.nameUUIDFromBytes(identity.getBytes(StandardCharsets.UTF_8)).toString();
    }

    public static String publicClass(Long classId) {
        if (classId == null) {
            throw new IllegalArgumentException("Class semantic point id requires classId.");
        }
        String identity = "public-class:%d".formatted(classId);
        return UUID.nameUUIDFromBytes(identity.getBytes(StandardCharsets.UTF_8)).toString();
    }
}
