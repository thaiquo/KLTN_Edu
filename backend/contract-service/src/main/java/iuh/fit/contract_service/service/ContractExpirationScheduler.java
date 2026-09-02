package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.OutboxEvent;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Component
public class ContractExpirationScheduler {
    private static final Logger log = LoggerFactory.getLogger(ContractExpirationScheduler.class);

    private final ContractAgreementRepository agreementRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final LearningServiceDispatcher learningServiceDispatcher;
    private final NotificationDispatcher notificationDispatcher;

    public ContractExpirationScheduler(
            ContractAgreementRepository agreementRepository,
            OutboxEventRepository outboxEventRepository,
            LearningServiceDispatcher learningServiceDispatcher,
            NotificationDispatcher notificationDispatcher) {
        this.agreementRepository = agreementRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.learningServiceDispatcher = learningServiceDispatcher;
        this.notificationDispatcher = notificationDispatcher;
    }

    @Scheduled(
            initialDelayString = "${contract.expiration.initial-delay-ms:10000}",
            fixedDelayString = "${contract.expiration.check-interval-ms:60000}")
    @Transactional
    public void sweepExpiredAgreements() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<ContractAgreement> expiredList = agreementRepository.findByStatusAndPaymentDeadlineBefore(
                ContractAgreementStatus.WAITING_PAYMENT, now);

        if (expiredList.isEmpty()) {
            return;
        }

        log.info("Found {} agreements in WAITING_PAYMENT past their 24h deadline. Expiring...", expiredList.size());

        for (ContractAgreement agreement : expiredList) {
            try {
                agreement.markExpired();
                agreement.setUpdatedAt(now);
                agreementRepository.saveAndFlush(agreement);

                // Publish outbox event
                String payloadJson = String.format(
                        "{\"agreementId\":\"%s\",\"classroomId\":%d,\"studentId\":%d,\"tutorId\":\"%d\",\"expiredAt\":\"%s\"}",
                        agreement.getId(),
                        agreement.getClassroomId(),
                        agreement.getStudentId(),
                        agreement.getTutorId(),
                        now);

                OutboxEvent outboxEvent = OutboxEvent.create(
                        "contract.expired.v1",
                        "ContractAgreement",
                        agreement.getId().toString(),
                        null,
                        payloadJson,
                        now);
                outboxEventRepository.saveAndFlush(outboxEvent);

                // Dispatch expiry to learning-service to free up the slot
                learningServiceDispatcher.expireEnrollmentAsync(
                        agreement.getClassroomId(), agreement.getStudentId(), agreement.getId().toString());

                // Notify student
                String studentEmail = agreement.getStudentEmail();
                if (studentEmail != null && !studentEmail.isBlank()) {
                    notificationDispatcher.sendAsync(
                            studentEmail,
                            agreement.getStudentId(),
                            "Hợp đồng đã hết hạn nạp cọc (24h)",
                            "Đã quá thời hạn 24 giờ nạp cọc Escrow cho lớp học. Suất giữ chỗ của bạn đã được giải phóng.",
                            "AGREEMENT_EXPIRED",
                            "AGREEMENT",
                            agreement.getId().toString()
                    );
                }

                // Notify tutor
                String tutorEmail = agreement.getClassroomReviewerEmail();
                if (tutorEmail != null && !tutorEmail.isBlank()) {
                    notificationDispatcher.sendAsync(
                            tutorEmail,
                            agreement.getTutorId(),
                            "Suất giữ chỗ đã hết hạn (24h)",
                            "Học viên đã không nạp cọc trong vòng 24 giờ. Suất giữ chỗ đã tự động được giải phóng cho danh sách chờ.",
                            "AGREEMENT_EXPIRED",
                            "AGREEMENT",
                            agreement.getId().toString()
                    );
                }

                log.info("Expired agreement {} and released reservation for classroom {}",
                        agreement.getId(), agreement.getClassroomId());
            } catch (Exception ex) {
                log.error("Failed to expire agreement {}: {}", agreement.getId(), ex.getMessage(), ex);
            }
        }
    }
}
