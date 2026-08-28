package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.SubjectDtos;
import iuh.fit.learning_service.dto.SubjectRequestDtos;
import iuh.fit.learning_service.entity.Subject;
import iuh.fit.learning_service.entity.SubjectCategory;
import iuh.fit.learning_service.entity.SubjectGroup;
import iuh.fit.learning_service.entity.SubjectRequest;
import iuh.fit.learning_service.enums.SubjectRequestStatus;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.realtime.RealtimeEventHub;
import iuh.fit.learning_service.repository.SubjectCategoryRepository;
import iuh.fit.learning_service.repository.SubjectGroupRepository;
import iuh.fit.learning_service.repository.SubjectRepository;
import iuh.fit.learning_service.repository.SubjectRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

@Service
public class SubjectRequestService {
    private final SubjectRequestRepository requestRepository;
    private final SubjectRepository subjectRepository;
    private final SubjectCategoryRepository categoryRepository;
    private final SubjectGroupRepository groupRepository;
    private final SubjectService subjectService;
    private final LearningEventPublisher eventPublisher;
    private final RealtimeEventHub realtimeEventHub;

    public SubjectRequestService(SubjectRequestRepository requestRepository, SubjectRepository subjectRepository, SubjectCategoryRepository categoryRepository, SubjectGroupRepository groupRepository, SubjectService subjectService, LearningEventPublisher eventPublisher, RealtimeEventHub realtimeEventHub) {
        this.requestRepository = requestRepository;
        this.subjectRepository = subjectRepository;
        this.categoryRepository = categoryRepository;
        this.groupRepository = groupRepository;
        this.subjectService = subjectService;
        this.eventPublisher = eventPublisher;
        this.realtimeEventHub = realtimeEventHub;
    }

    @Transactional
    public SubjectRequestDtos.Response create(SubjectRequestDtos.CreateRequest request) {
        SubjectCategory category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Subject category not found"));
        SubjectGroup group = request.getGroupId() == null ? null : groupRepository.findByIdAndActiveTrue(request.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("Subject group not found"));
        if (group != null && !group.getCategory().getId().equals(category.getId())) {
            throw new BadRequestException("Subject group does not belong to selected category");
        }
        if (request.getLevels() == null || request.getLevels().isEmpty()) {
            throw new BadRequestException("At least one teaching level is required");
        }

        SubjectRequest subjectRequest = new SubjectRequest();
        subjectRequest.setRequestedName(requiredText(request.getRequestedName(), "Requested subject name is required"));
        subjectRequest.setCategory(category);
        subjectRequest.setGroup(group);
        subjectRequest.setRequestedByUserId(request.getRequestedByUserId());
        subjectRequest.setNote(normalize(request.getNote()));
        subjectRequest.setLevels(new LinkedHashSet<>(request.getLevels()));
        SubjectRequest saved = requestRepository.save(subjectRequest);
        realtimeEventHub.publishToReviewers("SUBJECT_REQUEST_SUBMITTED", saved.getId(), Map.of(
                "userId", saved.getRequestedByUserId(),
                "status", saved.getStatus().name()
        ));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<SubjectRequestDtos.Response> mine(Long userId) {
        return requestRepository.findByRequestedByUserIdOrderByCreatedAtDesc(userId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<SubjectRequestDtos.Response> pending() {
        return requestRepository.findByStatusOrderByCreatedAtAsc(SubjectRequestStatus.PENDING).stream().map(this::toResponse).toList();
    }

    @Transactional
    public SubjectRequestDtos.Response approve(Long id, Long reviewerUserId) {
        SubjectRequest request = getPending(id);
        if (subjectRepository.existsByNameIgnoreCaseAndCategoryId(request.getRequestedName(), request.getCategory().getId())) {
            throw new ConflictException("Subject already exists in selected category");
        }
        Subject subject = new Subject();
        subject.setName(request.getRequestedName());
        subject.setCategory(request.getCategory());
        subject.setGroup(request.getGroup());
        subject.setActive(true);
        subject.setSupportedLevels(new LinkedHashSet<>(request.getLevels()));
        subject = subjectRepository.save(subject);

        request.setStatus(SubjectRequestStatus.APPROVED);
        request.setReviewedByUserId(reviewerUserId);
        request.setReviewedAt(LocalDateTime.now());
        request.setApprovedSubjectId(subject.getId());
        request.setRejectReason(null);
        SubjectRequest saved = requestRepository.save(request);
        eventPublisher.publishSubjectRequestApproved(saved.getId(), saved.getRequestedByUserId(), subject.getId());
        publishSubjectReviewRealtime(saved);
        return toResponse(saved);
    }

    @Transactional
    public SubjectRequestDtos.Response reject(Long id, SubjectRequestDtos.RejectRequest rejectRequest) {
        SubjectRequest request = getPending(id);
        request.setStatus(SubjectRequestStatus.REJECTED);
        request.setReviewedByUserId(rejectRequest.getReviewedByUserId());
        request.setReviewedAt(LocalDateTime.now());
        request.setRejectReason(requiredText(rejectRequest.getReason(), "Rejection reason is required"));
        SubjectRequest saved = requestRepository.save(request);
        eventPublisher.publishSubjectRequestRejected(saved.getId(), saved.getRequestedByUserId(), saved.getRejectReason());
        publishSubjectReviewRealtime(saved);
        return toResponse(saved);
    }

    private void publishSubjectReviewRealtime(SubjectRequest request) {
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("userId", request.getRequestedByUserId());
        payload.put("status", request.getStatus().name());
        payload.put("reason", request.getRejectReason());
        realtimeEventHub.publishToAll("SUBJECT_REQUEST_REVIEWED", request.getId(), payload);
    }

    private SubjectRequest getPending(Long id) {
        SubjectRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subject request not found"));
        if (request.getStatus() != SubjectRequestStatus.PENDING) {
            throw new ConflictException("Subject request has already been processed");
        }
        return request;
    }

    private SubjectRequestDtos.Response toResponse(SubjectRequest request) {
        SubjectDtos.SubjectResponse approvedSubject = request.getApprovedSubjectId() == null ? null : subjectRepository
                .findById(request.getApprovedSubjectId())
                .map(subjectService::toSubject)
                .orElse(null);
        return new SubjectRequestDtos.Response(
                request.getId(),
                request.getRequestedName(),
                subjectService.toCategory(request.getCategory()),
                request.getGroup() == null ? null : subjectService.toGroup(request.getGroup()),
                request.getRequestedByUserId(),
                new LinkedHashSet<>(request.getLevels()),
                request.getNote(),
                request.getStatus(),
                request.getReviewedByUserId(),
                request.getReviewedAt(),
                request.getRejectReason(),
                approvedSubject,
                request.getCreatedAt(),
                request.getUpdatedAt()
        );
    }

    private String requiredText(String value, String message) {
        String normalized = normalize(value);
        if (!StringUtils.hasText(normalized)) throw new BadRequestException(message);
        return normalized;
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }
}
