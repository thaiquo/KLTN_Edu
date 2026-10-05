package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.client.LearningPublicClassClient;
import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassSource;
import iuh.fit.ai_service.dto.ClassMatchingDtos.RegistrationBrief;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.service.embedding.EmbeddingProperties;
import iuh.fit.ai_service.service.embedding.EmbeddingService;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import iuh.fit.ai_service.service.semantic.ClassSemanticDocumentBuilder.ClassSemanticDocumentInput;
import iuh.fit.ai_service.service.semantic.ClassSemanticIndexDtos.ClassDeleteResult;
import iuh.fit.ai_service.service.semantic.ClassSemanticIndexDtos.ClassSyncResult;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class ClassSemanticIndexService {
    private final LearningPublicClassClient sourceClient;
    private final ClassSemanticDocumentBuilder documentBuilder;
    private final EmbeddingService embeddingService;
    private final EmbeddingProperties embeddingProperties;
    private final ClassSemanticVectorStore vectorStore;

    public ClassSemanticIndexService(
            LearningPublicClassClient sourceClient,
            ClassSemanticDocumentBuilder documentBuilder,
            EmbeddingService embeddingService,
            EmbeddingProperties embeddingProperties,
            ClassSemanticVectorStore vectorStore
    ) {
        this.sourceClient = sourceClient;
        this.documentBuilder = documentBuilder;
        this.embeddingService = embeddingService;
        this.embeddingProperties = embeddingProperties;
        this.vectorStore = vectorStore;
    }

    public ClassSyncResult sync(Integer maxClasses) {
        vectorStore.initializeCollection();
        List<PublicClassSource> sourceClasses = sourceClient.findSemanticSources(null, null, null, null, false, maxClasses);
        List<ClassSemanticDocument> documents = sourceClasses.stream()
                .filter(this::isIndexEligible)
                .map(this::toDocument)
                .sorted(Comparator.comparing(ClassSemanticDocument::pointId))
                .toList();
        int limit = maxClasses == null || maxClasses <= 0 ? documents.size() : Math.min(maxClasses, documents.size());
        int indexed = 0;
        int skipped = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();
        for (ClassSemanticDocument document : documents.subList(0, limit)) {
            try {
                if (isUnchanged(document)) {
                    skipped++;
                    continue;
                }
                EmbeddingVector vector = embeddingService.embed(document.semanticDocument());
                ClassSemanticPayload payload = new ClassSemanticPayload(
                        document.classId(),
                        document.tutorProfileId(),
                        document.registrationId(),
                        document.subjectId(),
                        document.levelId(),
                        document.teachingMode().name(),
                        document.status(),
                        SemanticConstants.DOCUMENT_VERSION,
                        embeddingProperties.model(),
                        embeddingProperties.dimensions(),
                        document.documentHash(),
                        Instant.now()
                );
                vectorStore.upsert(document.pointId(), vector, payload);
                indexed++;
            } catch (RuntimeException exception) {
                failed++;
                errors.add(document.pointId() + ": " + safeMessage(exception));
            }
        }
        int staleRemoved = removeStale(documents);
        return new ClassSyncResult(sourceClasses.size(), documents.size(), indexed, skipped, failed, staleRemoved, errors);
    }

    public ClassDeleteResult delete(Long classId) {
        String pointId = SemanticPointIds.publicClass(classId);
        vectorStore.delete(pointId);
        return new ClassDeleteResult(pointId, true);
    }

    private int removeStale(List<ClassSemanticDocument> documents) {
        Set<String> activePointIds = documents.stream()
                .map(ClassSemanticDocument::pointId)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        int removed = 0;
        for (ClassSemanticStoredPoint point : vectorStore.listPayloads()) {
            if (point == null || point.pointId() == null || activePointIds.contains(point.pointId())) {
                continue;
            }
            vectorStore.delete(point.pointId());
            removed++;
        }
        return removed;
    }

    private boolean isIndexEligible(PublicClassSource source) {
        if (source == null || source.id() == null || source.registration() == null || source.level() == null) {
            return false;
        }
        String status = source.status();
        return ("PUBLISHED".equalsIgnoreCase(status) || "ACTIVE".equalsIgnoreCase(status))
                && source.registration().subjectId() != null
                && source.level().id() != null
                && source.learningMode() != null;
    }

    private ClassSemanticDocument toDocument(PublicClassSource source) {
        RegistrationBrief registration = source.registration();
        String document = documentBuilder.build(new ClassSemanticDocumentInput(
                source.name(),
                source.description(),
                registration.subjectName(),
                registration.categoryName(),
                source.level().name(),
                source.chapters()
        ));
        return new ClassSemanticDocument(
                SemanticPointIds.publicClass(source.id()),
                source.id(),
                source.tutorProfileId(),
                source.tutorSubjectRegistrationId(),
                registration.subjectId(),
                source.level().id(),
                source.learningMode(),
                source.status(),
                document,
                SemanticHash.sha256(document),
                source
        );
    }

    private boolean isUnchanged(ClassSemanticDocument document) {
        ClassSemanticPayload existing = vectorStore.getPayload(document.pointId());
        return existing != null
                && document.documentHash().equals(existing.documentHash())
                && embeddingProperties.model().equals(existing.embeddingModel())
                && Integer.valueOf(embeddingProperties.dimensions()).equals(existing.embeddingDimensions())
                && Integer.valueOf(SemanticConstants.DOCUMENT_VERSION).equals(existing.semanticDocumentVersion());
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message.replaceAll("(?i)(api-key|key|token|secret)=[^\\s]+", "$1=<redacted>");
    }
}
