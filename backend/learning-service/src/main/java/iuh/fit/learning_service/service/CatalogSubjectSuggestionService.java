package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.CatalogSuggestionDtos;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class CatalogSubjectSuggestionService {
    private final CatalogSubjectSuggestionRepository suggestions;
    private final CatalogCategoryRepository categories;
    private final CatalogSubjectRepository subjects;
    private final CatalogLevelRepository levels;
    private final TeachingCatalogService mapper;

    public CatalogSubjectSuggestionService(CatalogSubjectSuggestionRepository suggestions,
            CatalogCategoryRepository categories, CatalogSubjectRepository subjects,
            CatalogLevelRepository levels, TeachingCatalogService mapper) {
        this.suggestions = suggestions; this.categories = categories; this.subjects = subjects;
        this.levels = levels; this.mapper = mapper;
    }

    @Transactional
    public CatalogSuggestionDtos.Response create(String email, CatalogSuggestionDtos.CreateRequest request) {
        CatalogCategory category = categories.findById(request.categoryId())
                .filter(CatalogCategory::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Catalog category not found"));
        CatalogSubjectSuggestion item = new CatalogSubjectSuggestion();
        item.setCategory(category); item.setSuggestedSubjectName(request.subjectName().trim());
        item.setSuggestedLevelName(request.levelName().trim()); item.setSuggestedLevelType(request.levelType());
        item.setNote(normalize(request.note())); item.setRequestedByEmail(email.toLowerCase(Locale.ROOT));
        return response(suggestions.save(item));
    }

    @Transactional(readOnly = true)
    public List<CatalogSuggestionDtos.Response> mine(String email) {
        return suggestions.findByRequestedByEmailIgnoreCaseOrderByCreatedAtDesc(email).stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public List<CatalogSuggestionDtos.Response> pending() {
        return suggestions.findByStatusOrderByCreatedAtAsc("PENDING").stream().map(this::response).toList();
    }

    @Transactional
    public CatalogSuggestionDtos.Response approve(Long id, String reviewerEmail) {
        CatalogSubjectSuggestion item = pending(id);
        CatalogCategory category = item.getCategory();
        if (subjects.existsByCategoryIdAndNameIgnoreCase(category.getId(), item.getSuggestedSubjectName())) {
            throw new ConflictException("Subject already exists in this category; map to the existing subject instead");
        }
        CatalogSubject subject = new CatalogSubject();
        subject.setCategory(category); subject.setName(item.getSuggestedSubjectName());
        int nextSubjectOrder = subjects.findByCategoryIdOrderByOrderIndexAscNameAsc(category.getId()).stream()
                .mapToInt(CatalogSubject::getOrderIndex)
                .max()
                .orElse(0) + 1;
        subject.setCode(uniqueCode(item.getSuggestedSubjectName(), id)); subject.setActive(true); subject.setOrderIndex(nextSubjectOrder);
        subject = subjects.save(subject);
        CatalogLevel level = new CatalogLevel();
        level.setSubject(subject); level.setName(item.getSuggestedLevelName());
        level.setCode(uniqueCode(item.getSuggestedLevelName(), id)); level.setType(item.getSuggestedLevelType());
        level.setActive(true); level.setOrderIndex(1); level = levels.save(level);
        item.setStatus("APPROVED"); item.setApprovedSubject(subject); item.setApprovedLevel(level);
        item.setReviewedByEmail(reviewerEmail); item.setReviewedAt(LocalDateTime.now()); item.setRejectReason(null);
        return response(suggestions.save(item));
    }

    @Transactional
    public CatalogSuggestionDtos.Response reject(Long id, String reviewerEmail, CatalogSuggestionDtos.RejectRequest request) {
        CatalogSubjectSuggestion item = pending(id); item.setStatus("REJECTED");
        item.setReviewedByEmail(reviewerEmail); item.setReviewedAt(LocalDateTime.now());
        item.setRejectReason(request.reason().trim()); return response(suggestions.save(item));
    }

    private CatalogSubjectSuggestion pending(Long id) {
        CatalogSubjectSuggestion item = suggestions.findById(id).orElseThrow(() -> new ResourceNotFoundException("Suggestion not found"));
        if (!"PENDING".equals(item.getStatus())) throw new ConflictException("Suggestion has already been processed");
        return item;
    }

    private CatalogSuggestionDtos.Response response(CatalogSubjectSuggestion value) {
        return new CatalogSuggestionDtos.Response(value.getId(), mapper.category(value.getCategory()),
                value.getSuggestedSubjectName(), value.getSuggestedLevelName(), value.getSuggestedLevelType(),
                value.getNote(), value.getRequestedByEmail(), value.getStatus(), value.getReviewedByEmail(),
                value.getReviewedAt(), value.getRejectReason(), value.getApprovedSubject() == null ? null : value.getApprovedSubject().getId(),
                value.getApprovedLevel() == null ? null : value.getApprovedLevel().getId(), value.getCreatedAt());
    }

    private String uniqueCode(String value, Long id) {
        String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String code = ascii.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
        return (code.isBlank() ? "ITEM" : code) + "_" + id;
    }
    private String normalize(String value) { if (value == null) return null; String result=value.trim(); return result.isEmpty()?null:result; }
}
