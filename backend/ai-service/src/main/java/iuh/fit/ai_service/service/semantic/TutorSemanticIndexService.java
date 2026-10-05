package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.dto.TutorMatchingDtos.Level;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SubjectCapability;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;
import iuh.fit.ai_service.service.embedding.EmbeddingProperties;
import iuh.fit.ai_service.service.embedding.EmbeddingService;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import iuh.fit.ai_service.service.semantic.TutorSemanticDocumentBuilder.TutorSemanticDocumentInput;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.DeleteResult;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.SyncResult;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class TutorSemanticIndexService {
    private final TutorSemanticSourceClient sourceClient;
    private final TutorSemanticDocumentBuilder documentBuilder;
    private final EmbeddingService embeddingService;
    private final EmbeddingProperties embeddingProperties;
    private final SemanticVectorStore vectorStore;

    public TutorSemanticIndexService(
            TutorSemanticSourceClient sourceClient,
            TutorSemanticDocumentBuilder documentBuilder,
            EmbeddingService embeddingService,
            EmbeddingProperties embeddingProperties,
            SemanticVectorStore vectorStore
    ) {
        this.sourceClient = sourceClient;
        this.documentBuilder = documentBuilder;
        this.embeddingService = embeddingService;
        this.embeddingProperties = embeddingProperties;
        this.vectorStore = vectorStore;
    }

    public SyncResult sync(Integer maxCapabilities) {
        vectorStore.initializeCollection();
        List<TutorCandidate> tutors = sourceClient.findEligibleTutorsForSemanticIndexing();
        List<TutorSemanticCapability> capabilities = tutors.stream()
                .filter(TutorCandidate::approvedOrVerified)
                .flatMap(tutor -> toCapabilities(tutor).stream())
                .sorted(Comparator.comparing(TutorSemanticCapability::pointId))
                .toList();
        int limit = maxCapabilities == null || maxCapabilities <= 0
                ? capabilities.size()
                : Math.min(maxCapabilities, capabilities.size());
        int indexed = 0;
        int skipped = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();
        for (TutorSemanticCapability capability : capabilities.subList(0, limit)) {
            try {
                if (isUnchanged(capability)) {
                    skipped++;
                    continue;
                }
                EmbeddingVector vector = embeddingService.embed(capability.semanticDocument());
                SemanticPayload payload = new SemanticPayload(
                        capability.tutorId(),
                        capability.userId(),
                        capability.registrationId(),
                        capability.subjectId(),
                        capability.levelId(),
                        capability.teachingModes().stream().map(Enum::name).sorted().toList(),
                        SemanticConstants.DOCUMENT_VERSION,
                        embeddingProperties.model(),
                        embeddingProperties.dimensions(),
                        capability.documentHash(),
                        Instant.now()
                );
                vectorStore.upsert(capability.pointId(), vector, payload);
                indexed++;
            } catch (RuntimeException exception) {
                failed++;
                errors.add(capability.pointId() + ": " + safeMessage(exception));
            }
        }
        return new SyncResult(tutors.size(), capabilities.size(), indexed, skipped, failed, 0, errors);
    }

    public DeleteResult delete(Long tutorId, Long registrationId, Long subjectId, Long levelId) {
        String pointId = SemanticPointIds.tutorCapability(tutorId, registrationId, subjectId, levelId);
        vectorStore.delete(pointId);
        return new DeleteResult(pointId, true);
    }

    public List<TutorSemanticCapability> previewCapabilities(Integer maxCapabilities) {
        List<TutorSemanticCapability> capabilities = sourceClient.findEligibleTutorsForSemanticIndexing().stream()
                .filter(TutorCandidate::approvedOrVerified)
                .flatMap(tutor -> toCapabilities(tutor).stream())
                .toList();
        int limit = maxCapabilities == null || maxCapabilities <= 0
                ? capabilities.size()
                : Math.min(maxCapabilities, capabilities.size());
        return capabilities.subList(0, limit);
    }

    private boolean isUnchanged(TutorSemanticCapability capability) {
        SemanticPayload existing = vectorStore.getPayload(capability.pointId());
        return existing != null
                && capability.documentHash().equals(existing.documentHash())
                && embeddingProperties.model().equals(existing.embeddingModel())
                && Integer.valueOf(embeddingProperties.dimensions()).equals(existing.embeddingDimensions())
                && Integer.valueOf(SemanticConstants.DOCUMENT_VERSION).equals(existing.semanticDocumentVersion());
    }

    private List<TutorSemanticCapability> toCapabilities(TutorCandidate tutor) {
        if (tutor.subjects() == null || tutor.subjects().isEmpty()) {
            return List.of();
        }
        Set<TeachingMode> modes = parseModes(tutor.teachingModes());
        List<TutorSemanticCapability> capabilities = new ArrayList<>();
        for (SubjectCapability subject : tutor.subjects()) {
            if (subject.registrationId() == null || subject.subjectId() == null || subject.levels() == null) {
                continue;
            }
            for (Level level : subject.levels()) {
                if (level.levelId() == null) {
                    continue;
                }
                String document = documentBuilder.build(new TutorSemanticDocumentInput(
                        tutor.bio(),
                        subject.subjectName(),
                        subject.categoryName(),
                        level.levelName(),
                        subject.experienceYears(),
                        subject.description()
                ));
                capabilities.add(new TutorSemanticCapability(
                        SemanticPointIds.tutorCapability(tutor.tutorId(), subject.registrationId(), subject.subjectId(), level.levelId()),
                        tutor.tutorId(),
                        tutor.userId(),
                        subject.registrationId(),
                        subject.subjectId(),
                        subject.subjectName(),
                        subject.categoryId(),
                        subject.categoryName(),
                        level.levelId(),
                        level.levelName(),
                        subject.experienceYears(),
                        subject.description(),
                        tutor.bio(),
                        modes,
                        document,
                        SemanticHash.sha256(document)
                ));
            }
        }
        return capabilities;
    }

    private Set<TeachingMode> parseModes(Set<String> values) {
        Set<TeachingMode> modes = new LinkedHashSet<>();
        if (values == null) {
            return modes;
        }
        for (String value : values) {
            try {
                modes.add(TeachingMode.valueOf(value));
            } catch (RuntimeException ignored) {
                // Ignore unknown source values; authoritative eligibility still lives upstream.
            }
        }
        return modes;
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message.replaceAll("(?i)(api-key|key|token|secret)=[^\\s]+", "$1=<redacted>");
    }
}
