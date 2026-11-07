package iuh.fit.account_service.service;

import iuh.fit.account_service.config.StaffDutyTimeConfig;
import iuh.fit.account_service.dto.roster.StaffDutyDtos.*;
import iuh.fit.account_service.entity.*;
import iuh.fit.account_service.enums.*;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.messaging.AccountEventPublisher;
import iuh.fit.account_service.messaging.event.StaffRosterPublishedEvent;
import iuh.fit.account_service.messaging.event.StaffShiftReassignedEvent;
import iuh.fit.account_service.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class StaffDutyRosterService {
    private static final Set<ShiftAssignmentStatus> ACTIVE_STATUSES =
            EnumSet.of(ShiftAssignmentStatus.DRAFT, ShiftAssignmentStatus.ASSIGNED, ShiftAssignmentStatus.CHECKED_IN);

    private final StaffAvailabilityRepository availabilityRepository;
    private final StaffShiftAssignmentRepository assignmentRepository;
    private final StaffShiftAuditRepository auditRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final AccountEventPublisher eventPublisher;
    private final Clock clock;
    private final boolean enforcementEnabled;

    public StaffDutyRosterService(
            StaffAvailabilityRepository availabilityRepository,
            StaffShiftAssignmentRepository assignmentRepository,
            StaffShiftAuditRepository auditRepository,
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            AccountEventPublisher eventPublisher,
            Clock staffDutyClock,
            @Value("${staff.duty.enforcement-enabled:false}") boolean enforcementEnabled
    ) {
        this.availabilityRepository = availabilityRepository;
        this.assignmentRepository = assignmentRepository;
        this.auditRepository = auditRepository;
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.eventPublisher = eventPublisher;
        this.clock = staffDutyClock;
        this.enforcementEnabled = enforcementEnabled;
    }

    @Transactional
    public WeeklyRoster submitAvailability(String staffEmail, AvailabilityRequest request) {
        User staff = requireActiveStaffByEmail(staffEmail);
        LocalDate weekStart = request.weekStartDate();
        validateNextWeek(weekStart);
        validateSlots(weekStart, request.slots());
        LocalDate weekEnd = weekStart.plusDays(5);
        if (isPublished(assignmentRepository.findByWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(weekStart, weekEnd))) {
            throw new ConflictException("Lịch tuần này đã được công bố nên không thể sửa ca rảnh");
        }

        availabilityRepository.deleteByStaffIdAndWorkDateBetween(staff.getId(), weekStart, weekEnd);
        for (Slot slot : request.slots()) {
            StaffAvailability row = new StaffAvailability();
            row.setStaff(staff);
            row.setWorkDate(slot.workDate());
            row.setShiftCode(slot.shiftCode());
            availabilityRepository.save(row);
        }
        return myRoster(staffEmail, weekStart);
    }

    @Transactional
    public WeeklyRoster createDraft(LocalDate weekStart, String adminEmail) {
        requireMonday(weekStart);
        requireUser(adminEmail);
        ensureTwelveDraftSlots(weekStart);
        return adminRoster(weekStart);
    }

    @Transactional
    public WeeklyRoster autoAssign(LocalDate weekStart, String adminEmail) {
        requireMonday(weekStart);
        User admin = requireUser(adminEmail);
        LocalDate weekEnd = weekStart.plusDays(5);
        ensureTwelveDraftSlots(weekStart);
        List<StaffShiftAssignment> assignments = assignmentRepository.findWeekForUpdate(weekStart, weekEnd);
        if (isPublished(assignments)) return adminRoster(weekStart);

        List<User> activeStaff = activeStaff();
        Map<String, StaffAvailability> availability = availabilityRepository
                .findByWorkDateBetween(weekStart, weekEnd).stream()
                .collect(Collectors.toMap(
                        a -> slotKey(a.getStaff().getId(), a.getWorkDate(), a.getShiftCode()),
                        Function.identity(),
                        (left, right) -> left
                ));
        Map<Long, Integer> counts = new HashMap<>();
        Set<String> occupiedDays = new HashSet<>();
        for (StaffShiftAssignment assignment : assignments) {
            if (assignment.getStaff() != null) {
                counts.merge(assignment.getStaff().getId(), 1, Integer::sum);
                occupiedDays.add(dayKey(assignment.getStaff().getId(), assignment.getWorkDate()));
            }
        }

        for (StaffShiftAssignment assignment : assignments) {
            if (assignment.getStatus() != ShiftAssignmentStatus.DRAFT || assignment.getStaff() != null) continue;
            User selected = activeStaff.stream()
                    .filter(staff -> availability.containsKey(slotKey(
                            staff.getId(), assignment.getWorkDate(), assignment.getShiftCode())))
                    .filter(staff -> !occupiedDays.contains(dayKey(staff.getId(), assignment.getWorkDate())))
                    .min(Comparator.<User>comparingInt(staff -> counts.getOrDefault(staff.getId(), 0))
                            .thenComparing(User::getId))
                    .orElse(null);
            if (selected == null) continue;
            assignment.setStaff(selected);
            counts.merge(selected.getId(), 1, Integer::sum);
            occupiedDays.add(dayKey(selected.getId(), assignment.getWorkDate()));
            saveAudit(assignment, ShiftAuditAction.AUTO_ASSIGNED, null, selected, admin, null);
        }
        assignmentRepository.saveAll(assignments);
        return adminRoster(weekStart);
    }

    @Transactional
    public AssignmentView manualAssign(Long assignmentId, Long staffId, String adminEmail) {
        User admin = requireUser(adminEmail);
        StaffShiftAssignment assignment = assignmentRepository.findByIdForUpdate(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ca trực"));
        if (assignment.getStatus() != ShiftAssignmentStatus.DRAFT) {
            throw new ConflictException("Chỉ được sửa tay lịch chưa công bố");
        }
        User next = requireActiveStaff(staffId);
        ensureNoOtherShiftSameDay(next.getId(), assignment);
        User previous = assignment.getStaff();
        if (previous != null && previous.getId().equals(next.getId())) return toView(assignment);
        assignment.setStaff(next);
        saveAudit(assignment, ShiftAuditAction.MANUAL_ASSIGNED, previous, next, admin,
                "Admin phân công thủ công trước khi công bố");
        return toView(assignmentRepository.save(assignment));
    }

    @Transactional
    public WeeklyRoster publish(LocalDate weekStart, String adminEmail) {
        requireMonday(weekStart);
        User admin = requireUser(adminEmail);
        LocalDate weekEnd = weekStart.plusDays(5);
        List<StaffShiftAssignment> assignments = assignmentRepository.findWeekForUpdate(weekStart, weekEnd);
        if (assignments.size() != 12) {
            throw new ConflictException("Lịch phải có đủ 12 ca trước khi công bố");
        }
        if (isPublished(assignments)) return adminRoster(weekStart);
        if (!clock.instant().isBefore(shiftStart(assignments.getFirst()))) {
            throw new ConflictException("Không thể công bố hồi tố một tuần trực đã bắt đầu");
        }
        Set<Long> activeIds = activeStaff().stream().map(User::getId).collect(Collectors.toSet());
        boolean invalid = assignments.stream().anyMatch(a ->
                a.getStatus() != ShiftAssignmentStatus.DRAFT
                        || a.getStaff() == null
                        || !activeIds.contains(a.getStaff().getId()));
        if (invalid) throw new ConflictException("Không thể công bố khi còn ca trống hoặc Staff không còn hoạt động");

        Instant now = clock.instant();
        for (StaffShiftAssignment assignment : assignments) {
            assignment.setStatus(ShiftAssignmentStatus.ASSIGNED);
            assignment.setPublishedAt(now);
            saveAudit(assignment, ShiftAuditAction.PUBLISHED, assignment.getStaff(), assignment.getStaff(), admin, null);
        }
        assignmentRepository.saveAll(assignments);
        assignments.stream()
                .map(StaffShiftAssignment::getStaff)
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(User::getId, Function.identity(), (left, right) -> left))
                .values()
                .forEach(staff -> eventPublisher.publishStaffRosterPublished(new StaffRosterPublishedEvent(
                        "staff-roster-published:" + weekStart + ":" + staff.getId(),
                        staff.getId(),
                        weekStart,
                        weekEnd,
                        LocalDateTime.ofInstant(now, StaffDutyTimeConfig.DUTY_ZONE)
                )));
        return adminRoster(weekStart);
    }

    @Transactional
    public AssignmentView startShift(String staffEmail) {
        User staff = requireActiveStaffByEmail(staffEmail);
        ZonedDateTime now = ZonedDateTime.now(clock);
        List<StaffShiftAssignment> today = assignmentRepository
                .findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                        staff.getId(), now.toLocalDate(), now.toLocalDate());
        StaffShiftAssignment assignment = today.stream()
                .filter(a -> a.getStatus() == ShiftAssignmentStatus.ASSIGNED
                        || a.getStatus() == ShiftAssignmentStatus.CHECKED_IN)
                .findFirst()
                .orElseThrow(() -> new ConflictException("Bạn không có ca trực được công bố hôm nay"));
        if (assignment.getStatus() == ShiftAssignmentStatus.CHECKED_IN) return toView(assignment);

        Instant earliest = shiftStart(assignment).minus(Duration.ofMinutes(15));
        Instant end = shiftEnd(assignment);
        Instant current = clock.instant();
        if (current.isBefore(earliest)) throw new ConflictException("Chưa đến thời gian bắt đầu ca trực");
        if (!current.isBefore(end)) throw new ConflictException("Ca trực đã kết thúc");

        assignment.setStatus(ShiftAssignmentStatus.CHECKED_IN);
        assignment.setCheckInAt(current);
        saveAudit(assignment, ShiftAuditAction.CHECKED_IN, staff, staff, staff,
                current.isAfter(shiftStart(assignment)) ? "Nhận ca trễ" : null);
        return toView(assignmentRepository.save(assignment));
    }

    @Transactional
    public AssignmentView replace(Long assignmentId, EmergencyReplaceRequest request, String adminEmail) {
        User admin = requireUser(adminEmail);
        StaffShiftAssignment assignment = assignmentRepository.findByIdForUpdate(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ca trực"));
        if (assignment.getStatus() != ShiftAssignmentStatus.ASSIGNED) {
            throw new ConflictException("Chỉ được thay người cho ca đã công bố nhưng chưa nhận");
        }
        if (!clock.instant().isBefore(shiftEnd(assignment))) {
            throw new ConflictException("Ca trực đã kết thúc");
        }
        User next = requireActiveStaff(request.newStaffId());
        User previous = assignment.getStaff();
        Long previousVersion = assignment.getVersion();
        if (previous != null && previous.getId().equals(next.getId())) {
            throw new BadRequestException("Staff mới phải khác Staff hiện tại");
        }
        ensureNoOtherShiftSameDay(next.getId(), assignment);
        assignment.setStaff(next);
        assignment.setCheckInAt(null);
        saveAudit(assignment, ShiftAuditAction.REASSIGNED, previous, next, admin, request.reason().trim());
        StaffShiftAssignment saved = assignmentRepository.save(assignment);
        String eventId = "staff-shift-reassigned:" + assignment.getId() + ":"
                + (previousVersion == null ? 0 : previousVersion) + ":"
                + (previous == null ? "none" : previous.getId()) + ":" + next.getId();
        LocalDateTime occurredAt = LocalDateTime.ofInstant(clock.instant(), StaffDutyTimeConfig.DUTY_ZONE);
        if (previous != null) {
            eventPublisher.publishStaffShiftReassigned(new StaffShiftReassignedEvent(
                    eventId, previous.getId(), assignment.getId(), assignment.getWorkDate(),
                    assignment.getShiftCode().name(), "REMOVED", occurredAt));
        }
        eventPublisher.publishStaffShiftReassigned(new StaffShiftReassignedEvent(
                eventId, next.getId(), assignment.getId(), assignment.getWorkDate(),
                assignment.getShiftCode().name(), "ASSIGNED", occurredAt));
        return toView(saved);
    }

    @Transactional(readOnly = true)
    public WeeklyRoster myRoster(String staffEmail, LocalDate weekStart) {
        requireMonday(weekStart);
        User staff = requireActiveStaffByEmail(staffEmail);
        LocalDate weekEnd = weekStart.plusDays(5);
        List<Slot> slots = availabilityRepository.findByStaffIdAndWorkDateBetween(staff.getId(), weekStart, weekEnd)
                .stream().map(a -> new Slot(a.getWorkDate(), a.getShiftCode())).toList();
        List<StaffShiftAssignment> assignments = assignmentRepository
                .findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(staff.getId(), weekStart, weekEnd);
        boolean weekPublished = isPublished(
                assignmentRepository.findByWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(weekStart, weekEnd));
        return new WeeklyRoster(weekStart, weekEnd, weekPublished, slots,
                assignments.stream().map(this::toView).toList(), List.of(), List.of());
    }

    @Transactional(readOnly = true)
    public WeeklyRoster adminRoster(LocalDate weekStart) {
        requireMonday(weekStart);
        LocalDate weekEnd = weekStart.plusDays(5);
        List<StaffShiftAssignment> assignments =
                assignmentRepository.findByWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(weekStart, weekEnd);
        List<StaffOption> staff = activeStaff().stream()
                .map(user -> new StaffOption(user.getId(), user.getFullName(), user.getEmail())).toList();
        List<StaffAvailabilityView> availability = availabilityRepository
                .findByWorkDateBetween(weekStart, weekEnd).stream()
                .map(item -> new StaffAvailabilityView(
                        item.getStaff().getId(), item.getWorkDate(), item.getShiftCode()))
                .toList();
        return new WeeklyRoster(weekStart, weekEnd, isPublished(assignments), List.of(),
                assignments.stream().map(this::toView).toList(), staff, availability);
    }

    @Transactional(readOnly = true)
    public DutyStatus status(String staffEmail) {
        User staff = requireActiveStaffByEmail(staffEmail);
        ZonedDateTime now = ZonedDateTime.now(clock);
        List<StaffShiftAssignment> today = assignmentRepository
                .findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                        staff.getId(), now.toLocalDate(), now.toLocalDate());
        StaffShiftAssignment current = today.stream()
                .filter(a -> clock.instant().isBefore(shiftEnd(a)))
                .findFirst().orElse(null);
        if (current == null) return new DutyStatus("OFF_DUTY", enforcementEnabled,
                !enforcementEnabled, false, null);
        boolean onDuty = current.getStatus() == ShiftAssignmentStatus.CHECKED_IN
                && !clock.instant().isBefore(shiftStart(current))
                && clock.instant().isBefore(shiftEnd(current));
        boolean canStart = current.getStatus() == ShiftAssignmentStatus.ASSIGNED
                && !clock.instant().isBefore(shiftStart(current).minus(Duration.ofMinutes(15)))
                && clock.instant().isBefore(shiftEnd(current));
        return new DutyStatus(onDuty ? "ON_DUTY" : "UPCOMING_SHIFT", enforcementEnabled,
                !enforcementEnabled || onDuty, canStart, toView(current));
    }

    @Transactional(readOnly = true)
    public WriteAccess writeAccess(String staffEmail) {
        User staff = userRepository.findByEmailIgnoreCase(staffEmail).orElse(null);
        if (staff == null || staff.getAccountStatus() != AccountStatus.ACTIVE
                || !userRoleRepository.existsByUserIdAndRole(staff.getId(), Role.STAFF)) {
            return new WriteAccess(false, "OFF_DUTY", null, null, null);
        }
        LocalDate today = ZonedDateTime.now(clock).toLocalDate();
        StaffShiftAssignment assignment = assignmentRepository
                .findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(staff.getId(), today, today)
                .stream()
                .filter(a -> a.getStatus() == ShiftAssignmentStatus.CHECKED_IN)
                .filter(a -> !clock.instant().isBefore(shiftStart(a)) && clock.instant().isBefore(shiftEnd(a)))
                .findFirst().orElse(null);
        if (assignment == null) return new WriteAccess(false, "OFF_DUTY", null, null, null);
        return new WriteAccess(true, "ON_DUTY", assignment.getId(), assignment.getShiftCode(), shiftEnd(assignment));
    }

    @Transactional
    public int closeExpiredShifts() {
        LocalDate today = ZonedDateTime.now(clock).toLocalDate();
        List<StaffShiftAssignment> candidates = assignmentRepository.findByStatusInAndWorkDateLessThanEqual(
                List.of(ShiftAssignmentStatus.ASSIGNED, ShiftAssignmentStatus.CHECKED_IN), today);
        int changed = 0;
        Instant now = clock.instant();
        for (StaffShiftAssignment assignment : candidates) {
            if (now.isBefore(shiftEnd(assignment))) continue;
            ShiftAuditAction action;
            if (assignment.getStatus() == ShiftAssignmentStatus.CHECKED_IN) {
                assignment.setStatus(ShiftAssignmentStatus.COMPLETED);
                action = ShiftAuditAction.COMPLETED;
            } else {
                assignment.setStatus(ShiftAssignmentStatus.ABSENT);
                action = ShiftAuditAction.ABSENT;
            }
            assignment.setCompletedAt(now);
            saveAudit(assignment, action, assignment.getStaff(), assignment.getStaff(), null, null);
            changed++;
        }
        assignmentRepository.saveAll(candidates);
        return changed;
    }

    @Transactional(readOnly = true)
    public Page<AuditView> audits(Pageable pageable) {
        return auditRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::toAuditView);
    }

    private void ensureTwelveDraftSlots(LocalDate weekStart) {
        LocalDate end = weekStart.plusDays(5);
        Map<String, StaffShiftAssignment> existing = assignmentRepository
                .findByWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(weekStart, end).stream()
                .collect(Collectors.toMap(a -> a.getWorkDate() + ":" + a.getShiftCode(), Function.identity()));
        List<StaffShiftAssignment> created = new ArrayList<>();
        for (int day = 0; day < 6; day++) {
            LocalDate date = weekStart.plusDays(day);
            for (ShiftCode code : ShiftCode.values()) {
                String key = date + ":" + code;
                if (existing.containsKey(key)) continue;
                StaffShiftAssignment assignment = new StaffShiftAssignment();
                assignment.setWorkDate(date);
                assignment.setShiftCode(code);
                assignment.setStatus(ShiftAssignmentStatus.DRAFT);
                created.add(assignment);
            }
        }
        if (created.isEmpty()) return;
        assignmentRepository.saveAllAndFlush(created).forEach(assignment ->
                saveAudit(assignment, ShiftAuditAction.CREATED, null, null, null, null));
    }

    private void validateNextWeek(LocalDate weekStart) {
        requireMonday(weekStart);
        LocalDate expected = LocalDate.now(clock).with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        if (!weekStart.equals(expected)) {
            throw new BadRequestException("Chỉ được đăng ký ca rảnh cho tuần kế tiếp");
        }
    }

    private void validateSlots(LocalDate weekStart, List<Slot> slots) {
        Set<String> unique = new HashSet<>();
        for (Slot slot : slots) {
            if (slot.workDate().isBefore(weekStart) || slot.workDate().isAfter(weekStart.plusDays(5))) {
                throw new BadRequestException("Ca rảnh phải thuộc thứ Hai đến thứ Bảy của tuần đã chọn");
            }
            if (!unique.add(slot.workDate() + ":" + slot.shiftCode())) {
                throw new BadRequestException("Danh sách ca rảnh bị trùng");
            }
        }
    }

    private void requireMonday(LocalDate weekStart) {
        if (weekStart == null || weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new BadRequestException("weekStartDate phải là thứ Hai");
        }
    }

    private void ensureNoOtherShiftSameDay(Long staffId, StaffShiftAssignment target) {
        boolean occupied = assignmentRepository
                .findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                        staffId, target.getWorkDate(), target.getWorkDate()).stream()
                .anyMatch(a -> !Objects.equals(a.getId(), target.getId()) && ACTIVE_STATUSES.contains(a.getStatus()));
        if (occupied) throw new ConflictException("Staff đã có ca khác trong ngày này");
    }

    private User requireActiveStaffByEmail(String email) {
        User user = requireUser(email);
        if (user.getAccountStatus() != AccountStatus.ACTIVE
                || !userRoleRepository.existsByUserIdAndRole(user.getId(), Role.STAFF)) {
            throw new ConflictException("Tài khoản không phải Staff đang hoạt động");
        }
        return user;
    }

    private User requireActiveStaff(Long id) {
        // Serialize assignments for the same Staff across different shift rows.
        // Locking only the target assignment would allow two concurrent Admin
        // requests to both pass the same-day check before either transaction commits.
        User user = userRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Staff"));
        if (user.getAccountStatus() != AccountStatus.ACTIVE
                || !userRoleRepository.existsByUserIdAndRole(id, Role.STAFF)) {
            throw new ConflictException("Tài khoản không phải Staff đang hoạt động");
        }
        return user;
    }

    private User requireUser(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));
    }

    private List<User> activeStaff() {
        return userRoleRepository.findUsersByRoleAndAccountStatus(Role.STAFF, AccountStatus.ACTIVE);
    }

    private boolean isPublished(List<StaffShiftAssignment> assignments) {
        return assignments.size() == 12 && assignments.stream().allMatch(a -> a.getPublishedAt() != null);
    }

    private Instant shiftStart(StaffShiftAssignment assignment) {
        return ZonedDateTime.of(assignment.getWorkDate(), assignment.getShiftCode().getStartTime(),
                StaffDutyTimeConfig.DUTY_ZONE).toInstant();
    }

    private Instant shiftEnd(StaffShiftAssignment assignment) {
        return ZonedDateTime.of(assignment.getWorkDate(), assignment.getShiftCode().getEndTime(),
                StaffDutyTimeConfig.DUTY_ZONE).toInstant();
    }

    private void saveAudit(StaffShiftAssignment assignment, ShiftAuditAction action,
                           User previous, User next, User actor, String reason) {
        StaffShiftAudit audit = new StaffShiftAudit();
        audit.setAssignment(assignment);
        audit.setAction(action);
        audit.setPreviousStaff(previous);
        audit.setNewStaff(next);
        audit.setChangedBy(actor);
        audit.setReason(reason);
        auditRepository.save(audit);
    }

    private AssignmentView toView(StaffShiftAssignment assignment) {
        User staff = assignment.getStaff();
        return new AssignmentView(
                assignment.getId(), assignment.getWorkDate(), assignment.getShiftCode(),
                staff == null ? null : staff.getId(),
                staff == null ? null : staff.getFullName(),
                staff == null ? null : staff.getEmail(),
                assignment.getStatus(), assignment.getPublishedAt(), assignment.getCheckInAt(),
                assignment.getCompletedAt(), assignment.getVersion()
        );
    }

    private AuditView toAuditView(StaffShiftAudit audit) {
        return new AuditView(
                audit.getId(), audit.getAssignment().getId(), audit.getAction(),
                id(audit.getPreviousStaff()), name(audit.getPreviousStaff()),
                id(audit.getNewStaff()), name(audit.getNewStaff()),
                id(audit.getChangedBy()), name(audit.getChangedBy()),
                audit.getReason(), audit.getCreatedAt()
        );
    }

    private Long id(User user) { return user == null ? null : user.getId(); }
    private String name(User user) { return user == null ? null : user.getFullName(); }
    private String slotKey(Long staffId, LocalDate date, ShiftCode code) { return staffId + ":" + date + ":" + code; }
    private String dayKey(Long staffId, LocalDate date) { return staffId + ":" + date; }
}
