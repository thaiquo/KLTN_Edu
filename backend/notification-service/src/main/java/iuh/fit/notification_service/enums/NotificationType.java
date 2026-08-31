package iuh.fit.notification_service.enums;

public enum NotificationType {
    // Blockchain Escrow
    AGREEMENT_REGISTERED,
    AGREEMENT_FUNDED,
    SESSION_SETTLED,
    DISPUTE_OPENED,
    DISPUTE_RESOLVED,
    
    // Tutor & Account Lifecycle
    TUTOR_APPLICATION_SUBMITTED,
    TUTOR_APPLICATION_REVIEWED,
    
    // Learning & Classroom
    TEACHING_REGISTRATION_SUBMITTED,
    TEACHING_REGISTRATION_REVIEWED,
    SUBJECT_REQUEST_SUBMITTED,
    SUBJECT_REQUEST_REVIEWED,
    CLASS_SUBMITTED,
    CLASS_REVIEWED,
    CLASS_MUTATED,
    
    // Chat & System
    CHAT_MESSAGE_RECEIVED,
    SYSTEM_ALERT
}
