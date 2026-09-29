package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.ClassroomMaterialRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import iuh.fit.learning_service.repository.SessionFileRepository;
import iuh.fit.learning_service.service.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

import java.util.LinkedHashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class LearningStorageCleanupService {

    private final ClassSessionRepository classSessionRepository;
    private final ClassroomMaterialRepository classroomMaterialRepository;
    private final SessionFileRepository sessionFileRepository;
    private final SessionAttendanceRepository sessionAttendanceRepository;
    private final FileStorageService fileStorageService;

    /** Collects object keys before deleting the classroom, whose database cascade removes their metadata. */
    public Set<String> collectClassroomObjectKeys(ClassRoom classRoom) {
        Set<String> keys = new LinkedHashSet<>();
        addKey(keys, classRoom.getSyllabusFileKey());

        classroomMaterialRepository.findByClassRoom_IdOrderByCreatedAtDesc(classRoom.getId())
                .forEach(material -> addKey(keys, material.getFileKey()));

        classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classRoom.getId()).forEach(session -> {
            sessionFileRepository.findBySession_IdOrderByFileOrderAscCreatedAtAsc(session.getId())
                    .forEach(file -> addKey(keys, file.getFileKey()));
            sessionAttendanceRepository.findBySessionId(session.getId())
                    .forEach(attendance -> addKey(keys, attendance.getSubmissionFileKey()));
        });

        return keys;
    }

    public void deleteObjects(Set<String> keys) {
        keys.forEach(this::deleteQuietly);
    }

    /** Deletes only after a successful database commit, so referenced objects are never removed on rollback. */
    public void deleteObjectsAfterCommit(Set<String> keys) {
        Set<String> validKeys = keys.stream().filter(StringUtils::hasText)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (validKeys.isEmpty()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteObjects(validKeys);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteObjects(validKeys);
            }
        });
    }

    public void deleteObjectAfterCommit(String key) {
        if (StringUtils.hasText(key)) {
            deleteObjectsAfterCommit(Set.of(key));
        }
    }

    private void addKey(Set<String> keys, String key) {
        if (StringUtils.hasText(key)) {
            keys.add(key);
        }
    }

    private void deleteQuietly(String key) {
        try {
            fileStorageService.delete(key);
        } catch (RuntimeException ex) {
            log.warn("Could not remove obsolete learning-storage object {}", key, ex);
        }
    }
}
