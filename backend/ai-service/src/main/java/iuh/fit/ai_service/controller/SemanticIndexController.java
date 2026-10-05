package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.service.semantic.SemanticVectorStore;
import iuh.fit.ai_service.service.semantic.ClassSemanticIndexDtos.ClassDeleteResult;
import iuh.fit.ai_service.service.semantic.ClassSemanticIndexDtos.ClassSyncRequest;
import iuh.fit.ai_service.service.semantic.ClassSemanticIndexDtos.ClassSyncResult;
import iuh.fit.ai_service.service.semantic.ClassSemanticIndexService;
import iuh.fit.ai_service.service.semantic.ClassSemanticVectorStore;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchRequest;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchResult;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchService;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.DeleteResult;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.SyncRequest;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.SyncResult;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/semantic")
public class SemanticIndexController {
    private final SemanticVectorStore vectorStore;
    private final TutorSemanticIndexService indexService;
    private final StudentSemanticSearchService searchService;
    private final ClassSemanticVectorStore classVectorStore;
    private final ClassSemanticIndexService classIndexService;

    public SemanticIndexController(
            SemanticVectorStore vectorStore,
            TutorSemanticIndexService indexService,
            StudentSemanticSearchService searchService,
            ClassSemanticVectorStore classVectorStore,
            ClassSemanticIndexService classIndexService
    ) {
        this.vectorStore = vectorStore;
        this.indexService = indexService;
        this.searchService = searchService;
        this.classVectorStore = classVectorStore;
        this.classIndexService = classIndexService;
    }

    @PostMapping("/collection/init")
    public void initializeCollection() {
        vectorStore.initializeCollection();
    }

    @PostMapping("/index/sync")
    public SyncResult sync(@RequestBody(required = false) SyncRequest request) {
        return indexService.sync(request == null ? null : request.maxCapabilities());
    }

    @DeleteMapping("/index/capability")
    public DeleteResult deleteCapability(
            @RequestParam Long tutorId,
            @RequestParam Long registrationId,
            @RequestParam Long subjectId,
            @RequestParam Long levelId
    ) {
        return indexService.delete(tutorId, registrationId, subjectId, levelId);
    }

    @PostMapping("/search")
    public SemanticSearchResult search(@RequestBody SemanticSearchRequest request) {
        return searchService.search(request);
    }

    @PostMapping("/classes/collection/init")
    public void initializeClassCollection() {
        classVectorStore.initializeCollection();
    }

    @PostMapping("/classes/index/sync")
    public ClassSyncResult syncClasses(@RequestBody(required = false) ClassSyncRequest request) {
        return classIndexService.sync(request == null ? null : request.maxClasses());
    }

    @DeleteMapping("/classes/index")
    public ClassDeleteResult deleteClass(@RequestParam Long classId) {
        return classIndexService.delete(classId);
    }
}
