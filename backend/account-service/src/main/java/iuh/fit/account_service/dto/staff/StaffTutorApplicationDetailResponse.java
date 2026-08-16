package iuh.fit.account_service.dto.staff;

import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.CredentialValidityType;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.enums.TutorDocumentVerificationStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

public class StaffTutorApplicationDetailResponse {

    private Applicant applicant;
    private Application application;
    private List<SubjectItem> subjects;
    private List<DocumentItem> documents;

    public StaffTutorApplicationDetailResponse(
            Applicant applicant,
            Application application,
            List<SubjectItem> subjects,
            List<DocumentItem> documents
    ) {
        this.applicant = applicant;
        this.application = application;
        this.subjects = subjects;
        this.documents = documents;
    }

    public Applicant getApplicant() { return applicant; }
    public Application getApplication() { return application; }
    public List<SubjectItem> getSubjects() { return subjects; }
    public List<DocumentItem> getDocuments() { return documents; }

    public static class Applicant {
        private Long id;
        private String fullName;
        private String email;
        private String phone;
        private LocalDate dateOfBirth;
        private String gender;
        private String province;
        private String commune;
        private String addressDetail;
        private AccountStatus accountStatus;
        private String avatarUrl;

        public Applicant(
                Long id,
                String fullName,
                String email,
                String phone,
                LocalDate dateOfBirth,
                String gender,
                String province,
                String commune,
                String addressDetail,
                AccountStatus accountStatus,
                String avatarUrl
        ) {
            this.id = id;
            this.fullName = fullName;
            this.email = email;
            this.phone = phone;
            this.dateOfBirth = dateOfBirth;
            this.gender = gender;
            this.province = province;
            this.commune = commune;
            this.addressDetail = addressDetail;
            this.accountStatus = accountStatus;
            this.avatarUrl = avatarUrl;
        }

        public Long getId() { return id; }
        public String getFullName() { return fullName; }
        public String getEmail() { return email; }
        public String getPhone() { return phone; }
        public LocalDate getDateOfBirth() { return dateOfBirth; }
        public String getGender() { return gender; }
        public String getProvince() { return province; }
        public String getCommune() { return commune; }
        public String getAddressDetail() { return addressDetail; }
        public AccountStatus getAccountStatus() { return accountStatus; }
        public String getAvatarUrl() { return avatarUrl; }
    }

    public static class Application {
        private Long id;
        private TutorApplicationStatus status;
        private String educationLevel;
        private String institution;
        private String major;
        private String experienceSummary;
        private String bio;
        private LocalDateTime submittedAt;
        private LocalDateTime reviewedAt;
        private String reviewerName;
        private String rejectionReason;
        private String reviewNote;

        public Application(
                Long id,
                TutorApplicationStatus status,
                String educationLevel,
                String institution,
                String major,
                String experienceSummary,
                String bio,
                LocalDateTime submittedAt,
                LocalDateTime reviewedAt,
                String reviewerName,
                String rejectionReason,
                String reviewNote
        ) {
            this.id = id;
            this.status = status;
            this.educationLevel = educationLevel;
            this.institution = institution;
            this.major = major;
            this.experienceSummary = experienceSummary;
            this.bio = bio;
            this.submittedAt = submittedAt;
            this.reviewedAt = reviewedAt;
            this.reviewerName = reviewerName;
            this.rejectionReason = rejectionReason;
            this.reviewNote = reviewNote;
        }

        public Long getId() { return id; }
        public TutorApplicationStatus getStatus() { return status; }
        public String getEducationLevel() { return educationLevel; }
        public String getInstitution() { return institution; }
        public String getMajor() { return major; }
        public String getExperienceSummary() { return experienceSummary; }
        public String getBio() { return bio; }
        public LocalDateTime getSubmittedAt() { return submittedAt; }
        public LocalDateTime getReviewedAt() { return reviewedAt; }
        public String getReviewerName() { return reviewerName; }
        public String getRejectionReason() { return rejectionReason; }
        public String getReviewNote() { return reviewNote; }
    }

    public static class SubjectItem {
        private Long id;
        private Long subjectId;
        private String name;
        private String category;
        private String group;
        private BigDecimal oneToOneHourlyRate;
        private Integer experienceYears;
        private String description;
        private Set<String> levels;

        public SubjectItem(Long id, Long subjectId, String name, String category, String group, BigDecimal oneToOneHourlyRate, Integer experienceYears, String description, Set<String> levels) {
            this.id = id;
            this.subjectId = subjectId;
            this.name = name;
            this.category = category;
            this.group = group;
            this.oneToOneHourlyRate = oneToOneHourlyRate;
            this.experienceYears = experienceYears;
            this.description = description;
            this.levels = levels;
        }

        public Long getId() { return id; }
        public Long getSubjectId() { return subjectId; }
        public String getName() { return name; }
        public String getCategory() { return category; }
        public String getGroup() { return group; }
        public BigDecimal getOneToOneHourlyRate() { return oneToOneHourlyRate; }
        public Integer getExperienceYears() { return experienceYears; }
        public String getDescription() { return description; }
        public Set<String> getLevels() { return levels; }
    }

    public static class DocumentItem {
        private Long id;
        private TutorDocumentType documentType;
        private String originalFilename;
        private String contentType;
        private Long fileSize;
        private TutorDocumentVerificationStatus verificationStatus;
        private String title;
        private String issuer;
        private LocalDate issueDate;
        private CredentialValidityType validityType;
        private LocalDate expiryDate;
        private String credentialNumber;
        private boolean expired;

        public DocumentItem(Long id, TutorDocumentType documentType, String originalFilename, String contentType, Long fileSize, TutorDocumentVerificationStatus verificationStatus, String title, String issuer, LocalDate issueDate, CredentialValidityType validityType, LocalDate expiryDate, String credentialNumber, boolean expired) {
            this.id = id;
            this.documentType = documentType;
            this.originalFilename = originalFilename;
            this.contentType = contentType;
            this.fileSize = fileSize;
            this.verificationStatus = verificationStatus;
            this.title = title;
            this.issuer = issuer;
            this.issueDate = issueDate;
            this.validityType = validityType;
            this.expiryDate = expiryDate;
            this.credentialNumber = credentialNumber;
            this.expired = expired;
        }

        public Long getId() { return id; }
        public TutorDocumentType getDocumentType() { return documentType; }
        public String getOriginalFilename() { return originalFilename; }
        public String getContentType() { return contentType; }
        public Long getFileSize() { return fileSize; }
        public TutorDocumentVerificationStatus getVerificationStatus() { return verificationStatus; }
        public String getTitle() { return title; }
        public String getIssuer() { return issuer; }
        public LocalDate getIssueDate() { return issueDate; }
        public CredentialValidityType getValidityType() { return validityType; }
        public LocalDate getExpiryDate() { return expiryDate; }
        public String getCredentialNumber() { return credentialNumber; }
        public boolean isExpired() { return expired; }
    }
}
