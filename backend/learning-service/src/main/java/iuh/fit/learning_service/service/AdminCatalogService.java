package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.*;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.LevelType;
import iuh.fit.learning_service.exception.*;
import iuh.fit.learning_service.repository.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class AdminCatalogService {
    private final CatalogCategoryRepository categories;
    private final CatalogSubjectRepository subjects;
    private final CatalogLevelRepository levels;
    private final TeachingCatalogService mapper;
    private final JdbcTemplate jdbc;

    public AdminCatalogService(CatalogCategoryRepository categories, CatalogSubjectRepository subjects,
                               CatalogLevelRepository levels, TeachingCatalogService mapper, JdbcTemplate jdbc) {
        this.categories=categories; this.subjects=subjects; this.levels=levels; this.mapper=mapper; this.jdbc=jdbc;
    }

    @Transactional
    public TeachingCatalogDtos.SubjectOption create(AdminCatalogDtos.CreateSubjectRequest request) {
        CatalogCategory category = categories.findById(request.categoryId()).filter(CatalogCategory::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Catalog category not found"));
        if (subjects.existsByCategoryIdAndNameIgnoreCase(category.getId(), request.name())
                || subjects.findByCategoryIdAndCodeIgnoreCase(category.getId(), request.code()).isPresent()) {
            throw new ConflictException("Subject name or code already exists in this category");
        }
        CatalogSubject subject = new CatalogSubject();
        subject.setCategory(category); subject.setCode(normalizeCode(request.code())); subject.setName(request.name().trim());
        subject.setDescription(text(request.description())); subject.setOrderIndex(request.orderIndex() == null ? 999 : request.orderIndex());
        subject = subjects.save(subject);
        Set<String> levelCodes = new HashSet<>();
        for (AdminCatalogDtos.LevelInput input : request.levels()) {
            String code = normalizeCode(input.code());
            if (!levelCodes.add(code)) throw new BadRequestException("Duplicate level code: " + code);
            CatalogLevel level = new CatalogLevel(); level.setSubject(subject); level.setCode(code); level.setName(input.name().trim());
            level.setType(input.type()); level.setDescription(text(input.description()));
            level.setOrderIndex(input.orderIndex() == null ? 999 : input.orderIndex()); levels.save(level);
        }
        return mapper.subject(subject);
    }

    @Transactional
    public TeachingCatalogDtos.SubjectOption updateSubject(Long id, AdminCatalogDtos.UpdateSubjectRequest request) {
        CatalogSubject subject = subjects.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Catalog subject not found"));
        String code = normalizeCode(request.code());
        boolean duplicate = subjects.findByCategoryIdOrderByOrderIndexAscNameAsc(subject.getCategory().getId()).stream()
                .anyMatch(item -> !item.getId().equals(id)
                        && (item.getCode().equalsIgnoreCase(code) || item.getName().equalsIgnoreCase(request.name().trim())));
        if (duplicate) throw new ConflictException("Subject name or code already exists in this category");
        subject.setCode(code); subject.setName(request.name().trim()); subject.setDescription(text(request.description()));
        subject.setOrderIndex(request.orderIndex() == null ? subject.getOrderIndex() : request.orderIndex());
        subject.setActive(request.active());
        return mapper.subject(subjects.save(subject));
    }

    @Transactional
    public void deactivateSubject(Long id) {
        CatalogSubject subject = subjects.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Catalog subject not found"));
        subject.setActive(false);
        subjects.save(subject);
    }

    @Transactional
    public TeachingCatalogDtos.LevelOption createLevel(AdminCatalogDtos.CreateLevelRequest request) {
        CatalogSubject subject = subjects.findById(request.subjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Catalog subject not found"));
        String code = normalizeCode(request.code());
        boolean duplicate = levels.findBySubjectIdOrderByOrderIndexAscNameAsc(subject.getId()).stream()
                .anyMatch(item -> item.getCode().equalsIgnoreCase(code) || item.getName().equalsIgnoreCase(request.name().trim()));
        if (duplicate) throw new ConflictException("Level name or code already exists for this subject");
        CatalogLevel level = new CatalogLevel();
        level.setSubject(subject); level.setCode(code); level.setName(request.name().trim()); level.setType(request.type());
        level.setDescription(text(request.description())); level.setOrderIndex(request.orderIndex() == null ? 999 : request.orderIndex());
        return mapper.level(levels.save(level));
    }

    @Transactional
    public TeachingCatalogDtos.LevelOption updateLevel(Long id, AdminCatalogDtos.UpdateLevelRequest request) {
        CatalogLevel level = levels.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Catalog level not found"));
        String code = normalizeCode(request.code());
        boolean duplicate = levels.findBySubjectIdOrderByOrderIndexAscNameAsc(level.getSubject().getId()).stream()
                .anyMatch(item -> !item.getId().equals(id)
                        && (item.getCode().equalsIgnoreCase(code) || item.getName().equalsIgnoreCase(request.name().trim())));
        if (duplicate) throw new ConflictException("Level name or code already exists for this subject");
        level.setCode(code); level.setName(request.name().trim()); level.setType(request.type());
        level.setDescription(text(request.description()));
        level.setOrderIndex(request.orderIndex() == null ? level.getOrderIndex() : request.orderIndex());
        level.setActive(request.active());
        return mapper.level(levels.save(level));
    }

    @Transactional
    public void deactivateLevel(Long id) {
        CatalogLevel level = levels.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Catalog level not found"));
        level.setActive(false);
        levels.save(level);
    }

    public AdminCatalogDtos.ImportResponse importCsv(String reviewerEmail, MultipartFile file) {
        if (file == null || file.isEmpty()) throw new BadRequestException("CSV file is required");
        String filename = Optional.ofNullable(file.getOriginalFilename()).orElse("catalog.csv");
        if (!filename.toLowerCase(Locale.ROOT).endsWith(".csv")) {
            throw new BadRequestException("Use a UTF-8 CSV file exported from Excel");
        }
        Long jobId = jdbc.queryForObject("INSERT INTO catalog_import_jobs(original_filename,status,created_by_email) VALUES (?, 'PROCESSING', ?) RETURNING id", Long.class, filename, reviewerEmail);
        int total=0, success=0; List<String> errors=new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String header=reader.readLine();
            if (header == null) throw new BadRequestException("CSV file is empty");
            String line;
            while ((line=reader.readLine()) != null) {
                if (line.isBlank()) continue; total++;
                try { importRow(parseCsv(line)); success++; }
                catch (RuntimeException ex) { errors.add("Dòng " + (total+1) + ": " + ex.getMessage()); }
            }
            int failed=total-success; String status=failed==0?"COMPLETED":success==0?"FAILED":"PARTIAL";
            jdbc.update("UPDATE catalog_import_jobs SET status=?,total_rows=?,success_rows=?,failed_rows=?,error_report=?,completed_at=? WHERE id=?",
                    status,total,success,failed,String.join("\n",errors),Timestamp.valueOf(LocalDateTime.now()),jobId);
            return new AdminCatalogDtos.ImportResponse(jobId,total,success,failed,errors);
        } catch (IOException ex) {
            jdbc.update("UPDATE catalog_import_jobs SET status='FAILED',error_report=?,completed_at=? WHERE id=?", ex.getMessage(),Timestamp.valueOf(LocalDateTime.now()),jobId);
            throw new BadRequestException("Cannot read CSV file");
        }
    }

    @Transactional
    protected void importRow(List<String> cells) {
        if (cells.size()<6) throw new BadRequestException("Cần 6 cột: categoryCode,subjectCode,subjectName,levelCode,levelName,levelType");
        CatalogCategory category=categories.findFirstByCodeIgnoreCaseAndActiveTrue(cells.get(0).trim())
                .orElseThrow(() -> new ResourceNotFoundException("Category code not found: " + cells.get(0)));
        String subjectCode=normalizeCode(cells.get(1));
        CatalogSubject subject=subjects.findByCategoryIdAndCodeIgnoreCase(category.getId(),subjectCode).orElseGet(() -> {
            CatalogSubject created=new CatalogSubject(); created.setCategory(category); created.setCode(subjectCode);
            created.setName(cells.get(2).trim()); created.setOrderIndex(999); return subjects.save(created);
        });
        String levelCode=normalizeCode(cells.get(3));
        boolean exists=levels.findBySubjectIdAndActiveTrueOrderByOrderIndexAscNameAsc(subject.getId()).stream().anyMatch(item -> item.getCode().equalsIgnoreCase(levelCode));
        if (exists) throw new ConflictException("Level already exists: " + levelCode);
        CatalogLevel level=new CatalogLevel(); level.setSubject(subject); level.setCode(levelCode); level.setName(cells.get(4).trim());
        try { level.setType(LevelType.valueOf(cells.get(5).trim().toUpperCase(Locale.ROOT))); }
        catch (IllegalArgumentException ex) { throw new BadRequestException("Invalid levelType: " + cells.get(5)); }
        level.setOrderIndex(999); levels.save(level);
    }

    private List<String> parseCsv(String line) {
        List<String> result=new ArrayList<>(); StringBuilder cell=new StringBuilder(); boolean quoted=false;
        for (int i=0;i<line.length();i++) { char ch=line.charAt(i); if (ch=='"') { if (quoted&&i+1<line.length()&&line.charAt(i+1)=='"') { cell.append('"'); i++; } else quoted=!quoted; } else if (ch==','&&!quoted) { result.add(cell.toString()); cell.setLength(0); } else cell.append(ch); }
        result.add(cell.toString()); return result;
    }
    private String normalizeCode(String value) { String code=value==null?"":value.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]+","_"); if(code.isBlank())throw new BadRequestException("Code is required"); return code; }
    private String text(String value) { if(value==null)return null; String result=value.trim(); return result.isEmpty()?null:result; }
}
