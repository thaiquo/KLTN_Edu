package iuh.fit.account_service.entity;

import iuh.fit.account_service.enums.TeachingLevel;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "subjects")
public class Subject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 160)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private SubjectCategory category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private SubjectGroup group;

    @Column(nullable = false)
    private boolean active = true;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
            name = "subject_levels",
            joinColumns = @JoinColumn(name = "subject_id")
    )
    @Enumerated(EnumType.STRING)
    @Column(name = "level", nullable = false, length = 40)
    private Set<TeachingLevel> supportedLevels = new LinkedHashSet<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public SubjectCategory getCategory() {
        return category;
    }

    public void setCategory(SubjectCategory category) {
        this.category = category;
    }

    public SubjectGroup getGroup() {
        return group;
    }

    public void setGroup(SubjectGroup group) {
        this.group = group;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Set<TeachingLevel> getSupportedLevels() {
        return supportedLevels;
    }

    public void setSupportedLevels(Set<TeachingLevel> supportedLevels) {
        this.supportedLevels = supportedLevels == null ? new LinkedHashSet<>() : supportedLevels;
    }
}
