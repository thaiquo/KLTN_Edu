package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.roster.StaffDutyDtos.WriteAccess;
import iuh.fit.account_service.dto.roster.StaffDutyDtos.EmergencyReplaceRequest;
import iuh.fit.account_service.dto.roster.StaffDutyDtos.AvailabilityRequest;
import iuh.fit.account_service.dto.roster.StaffDutyDtos.Slot;
import iuh.fit.account_service.entity.*;
import iuh.fit.account_service.enums.*;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.messaging.AccountEventPublisher;
import iuh.fit.account_service.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StaffDutyRosterServiceTest {
    @Mock StaffAvailabilityRepository availabilityRepository;
    @Mock StaffShiftAssignmentRepository assignmentRepository;
    @Mock StaffShiftAuditRepository auditRepository;
    @Mock UserRepository userRepository;
    @Mock UserRoleRepository userRoleRepository;
    @Mock AccountEventPublisher eventPublisher;

    private StaffDutyRosterService service;
    private Clock clock;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(Instant.parse("2026-11-09T01:30:00Z"), ZoneId.of("Asia/Bangkok"));
        service = new StaffDutyRosterService(
                availabilityRepository, assignmentRepository, auditRepository,
                userRepository, userRoleRepository, eventPublisher, clock, true);
    }

    @Test
    void submitAvailabilityFlushesDeletedSlotsBeforeReinsertingEditedSelection() {
        LocalDate monday = LocalDate.of(2026, 11, 16);
        User staff = user(1L, "staff1@edu.vn", "Staff 1");
        List<Slot> slots = List.of(
                new Slot(monday, ShiftCode.MORNING),
                new Slot(monday.plusDays(1), ShiftCode.EVENING));

        when(userRepository.findByEmailIgnoreCase(staff.getEmail())).thenReturn(Optional.of(staff));
        when(userRoleRepository.existsByUserIdAndRole(staff.getId(), Role.STAFF)).thenReturn(true);
        when(assignmentRepository.findByWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                monday, monday.plusDays(5))).thenReturn(List.of());
        when(availabilityRepository.findByStaffIdAndWorkDateBetween(
                staff.getId(), monday, monday.plusDays(5))).thenReturn(List.of());
        when(assignmentRepository.findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                staff.getId(), monday, monday.plusDays(5))).thenReturn(List.of());

        service.submitAvailability(staff.getEmail(), new AvailabilityRequest(monday, slots));

        InOrder writes = inOrder(availabilityRepository);
        writes.verify(availabilityRepository)
                .deleteByStaffIdAndWorkDateBetween(staff.getId(), monday, monday.plusDays(5));
        writes.verify(availabilityRepository).flush();
        writes.verify(availabilityRepository, times(slots.size())).save(any(StaffAvailability.class));
    }

    @Test
    void submitAvailabilityRejectsSundayButKeepsPreviouslySubmittedDataUntouched() {
        Clock sundayClock = Clock.fixed(
                Instant.parse("2026-11-08T03:00:00Z"), ZoneId.of("Asia/Bangkok"));
        StaffDutyRosterService sundayService = new StaffDutyRosterService(
                availabilityRepository, assignmentRepository, auditRepository,
                userRepository, userRoleRepository, eventPublisher, sundayClock, true);
        LocalDate monday = LocalDate.of(2026, 11, 9);
        User staff = user(1L, "staff1@edu.vn", "Staff 1");
        AvailabilityRequest request = new AvailabilityRequest(
                monday, List.of(new Slot(monday, ShiftCode.MORNING)));

        when(userRepository.findByEmailIgnoreCase(staff.getEmail())).thenReturn(Optional.of(staff));
        when(userRoleRepository.existsByUserIdAndRole(staff.getId(), Role.STAFF)).thenReturn(true);

        assertThatThrownBy(() -> sundayService.submitAvailability(staff.getEmail(), request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("hết hạn đăng ký");

        verify(availabilityRepository, never())
                .deleteByStaffIdAndWorkDateBetween(anyLong(), any(LocalDate.class), any(LocalDate.class));
        verify(availabilityRepository, never()).save(any(StaffAvailability.class));
    }

    @Test
    void sundayRosterRemainsReadableAndMarksAvailabilityReadOnly() {
        Clock sundayClock = Clock.fixed(
                Instant.parse("2026-11-08T03:00:00Z"), ZoneId.of("Asia/Bangkok"));
        StaffDutyRosterService sundayService = new StaffDutyRosterService(
                availabilityRepository, assignmentRepository, auditRepository,
                userRepository, userRoleRepository, eventPublisher, sundayClock, true);
        LocalDate monday = LocalDate.of(2026, 11, 9);
        User staff = user(1L, "staff1@edu.vn", "Staff 1");
        StaffAvailability saved = new StaffAvailability();
        saved.setStaff(staff);
        saved.setWorkDate(monday);
        saved.setShiftCode(ShiftCode.MORNING);

        when(userRepository.findByEmailIgnoreCase(staff.getEmail())).thenReturn(Optional.of(staff));
        when(userRoleRepository.existsByUserIdAndRole(staff.getId(), Role.STAFF)).thenReturn(true);
        when(availabilityRepository.findByStaffIdAndWorkDateBetween(
                staff.getId(), monday, monday.plusDays(5))).thenReturn(List.of(saved));
        when(assignmentRepository.findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                staff.getId(), monday, monday.plusDays(5))).thenReturn(List.of());
        when(assignmentRepository.findByWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                monday, monday.plusDays(5))).thenReturn(List.of());

        var roster = sundayService.myRoster(staff.getEmail(), monday);

        assertThat(roster.availability()).containsExactly(new Slot(monday, ShiftCode.MORNING));
        assertThat(roster.availabilityEditable()).isFalse();
    }

    @Test
    void autoAssignBalancesTwelveSlotsAcrossThreeAvailableStaff() {
        LocalDate monday = LocalDate.of(2026, 11, 9);
        User admin = user(99L, "admin@edu.vn", "Admin");
        List<User> staff = List.of(
                user(1L, "staff1@edu.vn", "Staff 1"),
                user(2L, "staff2@edu.vn", "Staff 2"),
                user(3L, "staff3@edu.vn", "Staff 3"));
        List<StaffShiftAssignment> assignments = assignments(monday);
        List<StaffAvailability> availability = new ArrayList<>();
        for (User member : staff) {
            for (StaffShiftAssignment assignment : assignments) {
                StaffAvailability row = new StaffAvailability();
                row.setStaff(member);
                row.setWorkDate(assignment.getWorkDate());
                row.setShiftCode(assignment.getShiftCode());
                availability.add(row);
            }
        }

        when(userRepository.findByEmailIgnoreCase(admin.getEmail())).thenReturn(Optional.of(admin));
        when(userRoleRepository.findUsersByRoleAndAccountStatus(Role.STAFF, AccountStatus.ACTIVE))
                .thenReturn(staff);
        when(assignmentRepository.findByWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                monday, monday.plusDays(5))).thenReturn(assignments);
        when(assignmentRepository.findWeekForUpdate(monday, monday.plusDays(5))).thenReturn(assignments);
        when(availabilityRepository.findByWorkDateBetween(monday, monday.plusDays(5))).thenReturn(availability);
        when(assignmentRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        service.autoAssign(monday, admin.getEmail());

        Map<Long, Long> counts = assignments.stream()
                .collect(Collectors.groupingBy(a -> a.getStaff().getId(), Collectors.counting()));
        assertThat(counts).containsEntry(1L, 4L).containsEntry(2L, 4L).containsEntry(3L, 4L);
        for (User member : staff) {
            assertThat(assignments.stream()
                    .filter(a -> a.getStaff().getId().equals(member.getId()))
                    .map(StaffShiftAssignment::getWorkDate))
                    .doesNotHaveDuplicates();
        }
        verify(auditRepository, times(12)).save(any(StaffShiftAudit.class));
    }

    @Test
    void autoAssignIsIdempotentWhenDraftSlotsAreAlreadyFilled() {
        LocalDate monday = LocalDate.of(2026, 11, 9);
        User admin = user(99L, "admin@edu.vn", "Admin");
        List<User> staff = List.of(
                user(1L, "staff1@edu.vn", "Staff 1"),
                user(2L, "staff2@edu.vn", "Staff 2"));
        List<StaffShiftAssignment> assignments = assignments(monday);
        List<StaffAvailability> availability = new ArrayList<>();
        for (User member : staff) {
            for (StaffShiftAssignment assignment : assignments) {
                StaffAvailability row = new StaffAvailability();
                row.setStaff(member);
                row.setWorkDate(assignment.getWorkDate());
                row.setShiftCode(assignment.getShiftCode());
                availability.add(row);
            }
        }

        when(userRepository.findByEmailIgnoreCase(admin.getEmail())).thenReturn(Optional.of(admin));
        when(userRoleRepository.findUsersByRoleAndAccountStatus(Role.STAFF, AccountStatus.ACTIVE))
                .thenReturn(staff);
        when(assignmentRepository.findByWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                monday, monday.plusDays(5))).thenReturn(assignments);
        when(assignmentRepository.findWeekForUpdate(monday, monday.plusDays(5))).thenReturn(assignments);
        when(availabilityRepository.findByWorkDateBetween(monday, monday.plusDays(5))).thenReturn(availability);
        when(assignmentRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        service.autoAssign(monday, admin.getEmail());
        service.autoAssign(monday, admin.getEmail());

        assertThat(assignments).allMatch(assignment -> assignment.getStaff() != null);
        verify(auditRepository, times(12)).save(any(StaffShiftAudit.class));
        verify(assignmentRepository, times(2)).saveAll(assignments);
    }

    @Test
    void createDraftAllowsAdminToStartWithoutAnyAvailabilityVotes() {
        LocalDate monday = LocalDate.of(2026, 11, 9);
        User admin = user(99L, "admin@edu.vn", "Admin");
        when(userRepository.findByEmailIgnoreCase(admin.getEmail())).thenReturn(Optional.of(admin));
        when(assignmentRepository.findByWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                monday, monday.plusDays(5))).thenReturn(List.of());
        when(userRoleRepository.findUsersByRoleAndAccountStatus(Role.STAFF, AccountStatus.ACTIVE))
                .thenReturn(List.of());
        when(assignmentRepository.saveAllAndFlush(anyList()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.createDraft(monday, admin.getEmail());

        verify(assignmentRepository).saveAllAndFlush(argThat(created ->
                java.util.stream.StreamSupport.stream(created.spliterator(), false).count() == 12));
        verify(auditRepository, times(12)).save(any(StaffShiftAudit.class));
    }

    @Test
    void publishRejectsRetroactiveWeekAfterItsFirstShiftStarted() {
        LocalDate monday = LocalDate.of(2026, 11, 9);
        User admin = user(99L, "admin@edu.vn", "Admin");
        when(userRepository.findByEmailIgnoreCase(admin.getEmail())).thenReturn(Optional.of(admin));
        when(assignmentRepository.findWeekForUpdate(monday, monday.plusDays(5)))
                .thenReturn(assignments(monday));

        assertThatThrownBy(() -> service.publish(monday, admin.getEmail()))
                .hasMessageContaining("hồi tố");
    }

    @Test
    void publishRejectsRosterWithAnEmptySlot() {
        LocalDate monday = LocalDate.of(2026, 11, 16);
        User admin = user(99L, "admin@edu.vn", "Admin");
        User staff = user(1L, "staff1@edu.vn", "Staff 1");
        List<StaffShiftAssignment> assignments = assignments(monday);
        assignments.forEach(assignment -> assignment.setStaff(staff));
        assignments.getLast().setStaff(null);

        when(userRepository.findByEmailIgnoreCase(admin.getEmail())).thenReturn(Optional.of(admin));
        when(userRoleRepository.findUsersByRoleAndAccountStatus(Role.STAFF, AccountStatus.ACTIVE))
                .thenReturn(List.of(staff));
        when(assignmentRepository.findWeekForUpdate(monday, monday.plusDays(5))).thenReturn(assignments);

        assertThatThrownBy(() -> service.publish(monday, admin.getEmail()))
                .isInstanceOf(ConflictException.class);
        verify(assignmentRepository, never()).saveAll(anyList());
    }

    @Test
    void publishRejectsRosterAssignedToInactiveStaff() {
        LocalDate monday = LocalDate.of(2026, 11, 16);
        User admin = user(99L, "admin@edu.vn", "Admin");
        User inactive = user(1L, "inactive@edu.vn", "Inactive Staff");
        inactive.setAccountStatus(AccountStatus.DISABLED);
        List<StaffShiftAssignment> assignments = assignments(monday);
        assignments.forEach(assignment -> assignment.setStaff(inactive));

        when(userRepository.findByEmailIgnoreCase(admin.getEmail())).thenReturn(Optional.of(admin));
        when(userRoleRepository.findUsersByRoleAndAccountStatus(Role.STAFF, AccountStatus.ACTIVE))
                .thenReturn(List.of());
        when(assignmentRepository.findWeekForUpdate(monday, monday.plusDays(5))).thenReturn(assignments);

        assertThatThrownBy(() -> service.publish(monday, admin.getEmail()))
                .isInstanceOf(ConflictException.class);
        verify(assignmentRepository, never()).saveAll(anyList());
    }

    @Test
    void manualAssignRejectsSecondActiveShiftForStaffOnSameDay() {
        User admin = user(99L, "admin@edu.vn", "Admin");
        User staff = user(1L, "staff1@edu.vn", "Staff 1");
        LocalDate workDate = LocalDate.of(2026, 11, 16);
        StaffShiftAssignment target = assignment(
                10L, null, workDate, ShiftCode.EVENING, ShiftAssignmentStatus.DRAFT);
        StaffShiftAssignment occupied = assignment(
                11L, staff, workDate, ShiftCode.MORNING, ShiftAssignmentStatus.ASSIGNED);

        when(userRepository.findByEmailIgnoreCase(admin.getEmail())).thenReturn(Optional.of(admin));
        when(userRepository.findByIdForUpdate(staff.getId())).thenReturn(Optional.of(staff));
        when(userRoleRepository.existsByUserIdAndRole(staff.getId(), Role.STAFF)).thenReturn(true);
        when(assignmentRepository.findByIdForUpdate(target.getId())).thenReturn(Optional.of(target));
        when(assignmentRepository.findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                staff.getId(), workDate, workDate)).thenReturn(List.of(occupied));

        assertThatThrownBy(() -> service.manualAssign(target.getId(), staff.getId(), admin.getEmail()))
                .isInstanceOf(ConflictException.class);
        verify(assignmentRepository, never()).save(target);
    }

    @Test
    void publishIsIdempotentAfterWeekHasBeenPublished() {
        LocalDate monday = LocalDate.of(2026, 11, 16);
        User admin = user(99L, "admin@edu.vn", "Admin");
        List<User> staff = List.of(
                user(1L, "staff1@edu.vn", "Staff 1"),
                user(2L, "staff2@edu.vn", "Staff 2"));
        List<StaffShiftAssignment> assignments = assignments(monday);
        for (int index = 0; index < assignments.size(); index++) {
            assignments.get(index).setStaff(staff.get(index % staff.size()));
        }

        when(userRepository.findByEmailIgnoreCase(admin.getEmail())).thenReturn(Optional.of(admin));
        when(userRoleRepository.findUsersByRoleAndAccountStatus(Role.STAFF, AccountStatus.ACTIVE))
                .thenReturn(staff);
        when(assignmentRepository.findWeekForUpdate(monday, monday.plusDays(5))).thenReturn(assignments);
        when(assignmentRepository.findByWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                monday, monday.plusDays(5))).thenReturn(assignments);
        when(assignmentRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        service.publish(monday, admin.getEmail());
        service.publish(monday, admin.getEmail());

        assertThat(assignments).allMatch(assignment ->
                assignment.getStatus() == ShiftAssignmentStatus.ASSIGNED
                        && assignment.getPublishedAt() != null);
        verify(auditRepository, times(12)).save(any(StaffShiftAudit.class));
        verify(assignmentRepository).saveAll(assignments);
        verify(eventPublisher, times(2)).publishStaffRosterPublished(any());
    }

    @Test
    void startShiftIsIdempotentAfterStaffCheckedIn() {
        User staff = user(1L, "staff1@edu.vn", "Staff 1");
        StaffShiftAssignment assignment = assignment(
                10L, staff, LocalDate.of(2026, 11, 9), ShiftCode.MORNING,
                ShiftAssignmentStatus.ASSIGNED);

        when(userRepository.findByEmailIgnoreCase(staff.getEmail())).thenReturn(Optional.of(staff));
        when(userRoleRepository.existsByUserIdAndRole(staff.getId(), Role.STAFF)).thenReturn(true);
        when(assignmentRepository.findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                staff.getId(), assignment.getWorkDate(), assignment.getWorkDate()))
                .thenReturn(List.of(assignment));
        when(assignmentRepository.save(assignment)).thenReturn(assignment);

        service.startShift(staff.getEmail());
        service.startShift(staff.getEmail());

        assertThat(assignment.getStatus()).isEqualTo(ShiftAssignmentStatus.CHECKED_IN);
        assertThat(assignment.getCheckInAt()).isEqualTo(clock.instant());
        verify(assignmentRepository).save(assignment);
        verify(auditRepository).save(any(StaffShiftAudit.class));
    }

    @Test
    void staffCanCheckInAtAnyTimeBeforeAssignedShiftEnds() {
        Clock lateClock = Clock.fixed(
                Instant.parse("2026-11-09T07:59:00Z"), ZoneId.of("Asia/Bangkok"));
        StaffDutyRosterService lateService = new StaffDutyRosterService(
                availabilityRepository, assignmentRepository, auditRepository,
                userRepository, userRoleRepository, eventPublisher, lateClock, true);
        User staff = user(1L, "staff1@edu.vn", "Staff 1");
        StaffShiftAssignment assignment = assignment(
                10L, staff, LocalDate.of(2026, 11, 9), ShiftCode.MORNING,
                ShiftAssignmentStatus.ASSIGNED);

        when(userRepository.findByEmailIgnoreCase(staff.getEmail())).thenReturn(Optional.of(staff));
        when(userRoleRepository.existsByUserIdAndRole(staff.getId(), Role.STAFF)).thenReturn(true);
        when(assignmentRepository.findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                staff.getId(), assignment.getWorkDate(), assignment.getWorkDate()))
                .thenReturn(List.of(assignment));
        when(assignmentRepository.save(assignment)).thenReturn(assignment);

        lateService.startShift(staff.getEmail());

        assertThat(assignment.getStatus()).isEqualTo(ShiftAssignmentStatus.CHECKED_IN);
        assertThat(assignment.getCheckInAt()).isEqualTo(lateClock.instant());
        assertThat(lateService.writeAccess(staff.getEmail()).allowed()).isTrue();
    }

    @Test
    void schedulerClosesMissedAndCheckedInShiftsAndIsSafeToRunAgain() {
        User first = user(1L, "staff1@edu.vn", "Staff 1");
        User second = user(2L, "staff2@edu.vn", "Staff 2");
        StaffShiftAssignment missed = assignment(
                10L, first, LocalDate.of(2026, 11, 7), ShiftCode.MORNING,
                ShiftAssignmentStatus.ASSIGNED);
        StaffShiftAssignment attended = assignment(
                11L, second, LocalDate.of(2026, 11, 7), ShiftCode.EVENING,
                ShiftAssignmentStatus.CHECKED_IN);
        List<StaffShiftAssignment> expired = List.of(missed, attended);
        when(assignmentRepository.findByStatusInAndWorkDateLessThanEqual(
                anyList(), eq(LocalDate.of(2026, 11, 9))))
                .thenReturn(expired, List.of());
        when(assignmentRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(service.closeExpiredShifts()).isEqualTo(2);
        assertThat(service.closeExpiredShifts()).isZero();

        assertThat(missed.getStatus()).isEqualTo(ShiftAssignmentStatus.ABSENT);
        assertThat(attended.getStatus()).isEqualTo(ShiftAssignmentStatus.COMPLETED);
        assertThat(missed.getCompletedAt()).isEqualTo(clock.instant());
        assertThat(attended.getCompletedAt()).isEqualTo(clock.instant());
        verify(auditRepository, times(2)).save(any(StaffShiftAudit.class));
    }

    @Test
    void emergencyReplacementTransfersWriteAccessOnlyAfterNewStaffChecksIn() {
        User admin = user(99L, "admin@edu.vn", "Admin");
        User previous = user(1L, "staff1@edu.vn", "Staff 1");
        User replacement = user(2L, "staff2@edu.vn", "Staff 2");
        StaffShiftAssignment assignment = assignment(
                10L, previous, LocalDate.of(2026, 11, 9), ShiftCode.MORNING,
                ShiftAssignmentStatus.ASSIGNED);

        when(userRepository.findByEmailIgnoreCase(admin.getEmail())).thenReturn(Optional.of(admin));
        when(userRepository.findByEmailIgnoreCase(previous.getEmail())).thenReturn(Optional.of(previous));
        when(userRepository.findByEmailIgnoreCase(replacement.getEmail())).thenReturn(Optional.of(replacement));
        when(userRepository.findByIdForUpdate(replacement.getId())).thenReturn(Optional.of(replacement));
        when(userRoleRepository.existsByUserIdAndRole(replacement.getId(), Role.STAFF)).thenReturn(true);
        when(userRoleRepository.existsByUserIdAndRole(previous.getId(), Role.STAFF)).thenReturn(true);
        when(assignmentRepository.findByIdForUpdate(assignment.getId())).thenReturn(Optional.of(assignment));
        when(assignmentRepository.findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                replacement.getId(), assignment.getWorkDate(), assignment.getWorkDate()))
                .thenReturn(List.of(), List.of(assignment), List.of(assignment), List.of(assignment));
        when(assignmentRepository.findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                previous.getId(), assignment.getWorkDate(), assignment.getWorkDate()))
                .thenReturn(List.of());
        when(assignmentRepository.save(assignment)).thenReturn(assignment);

        service.replace(assignment.getId(),
                new EmergencyReplaceRequest(replacement.getId(), "Nghỉ đột xuất"), admin.getEmail());

        assertThat(service.writeAccess(previous.getEmail()).allowed()).isFalse();
        assertThat(service.writeAccess(replacement.getEmail()).allowed()).isFalse();
        service.startShift(replacement.getEmail());
        assertThat(service.writeAccess(replacement.getEmail()).allowed()).isTrue();
        assertThat(assignment.getStaff()).isSameAs(replacement);
        verify(auditRepository, times(2)).save(any(StaffShiftAudit.class));
        verify(eventPublisher, times(2)).publishStaffShiftReassigned(any());
    }

    @Test
    void checkedInStaffInsideShiftHasWriteAccess() {
        User staff = user(1L, "staff1@edu.vn", "Staff 1");
        StaffShiftAssignment assignment = new StaffShiftAssignment();
        assignment.setId(10L);
        assignment.setStaff(staff);
        assignment.setWorkDate(LocalDate.of(2026, 11, 9));
        assignment.setShiftCode(ShiftCode.MORNING);
        assignment.setStatus(ShiftAssignmentStatus.CHECKED_IN);
        assignment.setCheckInAt(Instant.parse("2026-11-09T01:00:00Z"));

        when(userRepository.findByEmailIgnoreCase(staff.getEmail())).thenReturn(Optional.of(staff));
        when(userRoleRepository.existsByUserIdAndRole(1L, Role.STAFF)).thenReturn(true);
        when(assignmentRepository.findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                1L, assignment.getWorkDate(), assignment.getWorkDate())).thenReturn(List.of(assignment));

        WriteAccess access = service.writeAccess(staff.getEmail());

        assertThat(access.allowed()).isTrue();
        assertThat(access.status()).isEqualTo("ON_DUTY");
        assertThat(access.assignmentId()).isEqualTo(10L);
    }

    @Test
    void assignedButNotCheckedInStaffIsReadOnly() {
        User staff = user(1L, "staff1@edu.vn", "Staff 1");
        StaffShiftAssignment assignment = new StaffShiftAssignment();
        assignment.setId(10L);
        assignment.setStaff(staff);
        assignment.setWorkDate(LocalDate.of(2026, 11, 9));
        assignment.setShiftCode(ShiftCode.MORNING);
        assignment.setStatus(ShiftAssignmentStatus.ASSIGNED);

        when(userRepository.findByEmailIgnoreCase(staff.getEmail())).thenReturn(Optional.of(staff));
        when(userRoleRepository.existsByUserIdAndRole(1L, Role.STAFF)).thenReturn(true);
        when(assignmentRepository.findByStaffIdAndWorkDateBetweenOrderByWorkDateAscShiftCodeAsc(
                1L, assignment.getWorkDate(), assignment.getWorkDate())).thenReturn(List.of(assignment));

        assertThat(service.writeAccess(staff.getEmail()).allowed()).isFalse();
    }

    private List<StaffShiftAssignment> assignments(LocalDate monday) {
        List<StaffShiftAssignment> result = new ArrayList<>();
        long id = 1;
        for (int day = 0; day < 6; day++) {
            for (ShiftCode code : ShiftCode.values()) {
                StaffShiftAssignment assignment = new StaffShiftAssignment();
                assignment.setId(id++);
                assignment.setWorkDate(monday.plusDays(day));
                assignment.setShiftCode(code);
                assignment.setStatus(ShiftAssignmentStatus.DRAFT);
                result.add(assignment);
            }
        }
        return result;
    }

    private StaffShiftAssignment assignment(Long id, User staff, LocalDate workDate,
                                            ShiftCode shiftCode, ShiftAssignmentStatus status) {
        StaffShiftAssignment assignment = new StaffShiftAssignment();
        assignment.setId(id);
        assignment.setStaff(staff);
        assignment.setWorkDate(workDate);
        assignment.setShiftCode(shiftCode);
        assignment.setStatus(status);
        return assignment;
    }

    private User user(Long id, String email, String name) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setFullName(name);
        user.setAccountStatus(AccountStatus.ACTIVE);
        return user;
    }
}
