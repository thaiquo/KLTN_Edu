# EDUCONNECT — LUỒNG GIA SƯ ĐĂNG KÝ MÔN DẠY & TẠO LỚP

> File này thay thế phần `.md` cũ liên quan đến Subject/Level/ClassRoom.  
> Mục tiêu: giúp AI Coding Assistant hiểu đúng luồng **gia sư đăng ký môn học**, **admin duyệt quyền dạy**, và **gia sư chỉ được tạo lớp từ môn/trình độ đã được duyệt**.

---

## 1. Nguyên tắc chốt

Hệ thống không cho Tutor tạo lớp bằng cách chọn tự do `Subject` và `Level`.

Tutor phải đi qua flow:

```text
TutorProfile
  ↓
TutorSubjectRegistration
  ↓
Upload Certificate / Evidence
  ↓
Admin / Staff review
  ↓
APPROVED
  ↓
Tutor được phép tạo ClassRoom từ registration đã duyệt
```

Quy tắc quan trọng nhất:

```text
ClassRoom phải được tạo từ TutorSubjectRegistration có status = APPROVED
```

Không nên thiết kế:

```text
TutorProfile -> Subject
TutorProfile -> Level
ClassRoom -> Subject
```

Mà nên thiết kế:

```text
TutorProfile -> TutorSubjectRegistration -> Subject
TutorProfile -> TutorSubjectRegistration -> Level
TutorSubjectRegistration -> ClassRoom
```

---

## 2. Hai nhánh chương trình dạy

UI và database phải hỗ trợ 2 nhánh lớn:

```text
ProgramType
├── ACADEMIC
│   └── Học thuật / Theo cấp học
│
└── SKILL
    └── Kỹ năng / Chứng chỉ / Nghề nghiệp
```

### 2.1. Nhánh ACADEMIC

Dùng cho chương trình học theo cấp học:

```text
Tiểu học
THCS
THPT
Đại học / Cao đẳng
```

Flow UI:

```text
Chọn loại chương trình
  ↓
Học thuật / Theo cấp học
  ↓
Chọn cấp học
  ↓
Chọn nhóm môn
  ↓
Chọn môn học
  ↓
Chọn lớp / trình độ / đối tượng học
  ↓
Upload minh chứng
  ↓
Gửi duyệt
```

Ví dụ:

```text
ProgramType: ACADEMIC
EducationLevel: THPT
Category: Khoa học tự nhiên
Subject: Vật lý
Level: Lớp 10
Certificate: Bằng cấp / bảng điểm / chứng chỉ
```

Ví dụ đại học:

```text
ProgramType: ACADEMIC
EducationLevel: Đại học / Cao đẳng
Category: Công nghệ thông tin
Subject: Lập trình C
Level: Sinh viên năm 1 / Cơ bản / Ôn thi học phần
Certificate: Bảng điểm / bằng CNTT / dự án GitHub
```

### 2.2. Nhánh SKILL

Dùng cho kỹ năng, chứng chỉ, nghề nghiệp.

Không ép TOEIC, Photoshop, Guitar, kỹ năng mềm đi theo cấp học.

Flow UI:

```text
Chọn loại chương trình
  ↓
Kỹ năng / Chứng chỉ / Nghề nghiệp
  ↓
Chọn lĩnh vực / nhóm lớn
  ↓
Chọn nhóm môn
  ↓
Chọn môn học
  ↓
Chọn trình độ / mục tiêu
  ↓
Upload minh chứng
  ↓
Gửi duyệt
```

Ví dụ TOEIC:

```text
ProgramType: SKILL
EducationLevel: null
Category: Ngoại ngữ
Subject: TOEIC
Level: TOEIC 500+
Certificate: Bảng điểm TOEIC
```

Ví dụ Photoshop:

```text
ProgramType: SKILL
EducationLevel: null
Category: Thiết kế đồ họa
Subject: Photoshop
Level: Cơ bản
Certificate: Portfolio
```

---

## 3. Catalog dữ liệu môn học

Catalog phải đủ linh hoạt để dùng cho cả học thuật và kỹ năng.

### 3.1. ProgramType

```text
ProgramType
- id
- code
- name
- description
- status
```

Dữ liệu mẫu:

```text
ACADEMIC = Học thuật / Theo cấp học
SKILL = Kỹ năng / Chứng chỉ / Nghề nghiệp
```

Có thể dùng enum nếu muốn đơn giản, nhưng nếu admin cần quản lý trong database thì dùng entity.

---

### 3.2. EducationLevel

Chỉ dùng cho nhánh ACADEMIC.

```text
EducationLevel
- id
- code
- name
- description
- status
- orderIndex
```

Dữ liệu gợi ý:

```text
PRIMARY       = Tiểu học
SECONDARY     = THCS
HIGH_SCHOOL   = THPT
UNIVERSITY    = Đại học / Cao đẳng
```

Với nhánh SKILL:

```text
educationLevel = null
```

---

### 3.3. Category

Category là nhóm môn / lĩnh vực.

```text
Category
- id
- programTypeId
- educationLevelId nullable
- name
- description
- status
- orderIndex
```

Ví dụ ACADEMIC:

```text
ProgramType: ACADEMIC
EducationLevel: THPT
Category:
- Khoa học tự nhiên
- Khoa học xã hội
- Ngôn ngữ
- Tin học
- Ôn thi THPT Quốc gia
```

Ví dụ SKILL:

```text
ProgramType: SKILL
EducationLevel: null
Category:
- Ngoại ngữ
- CNTT & Công nghệ
- Thiết kế đồ họa
- Kỹ năng mềm
- Âm nhạc
```

---

### 3.4. Subject

Subject là môn học cụ thể.

```text
Subject
- id
- categoryId
- name
- description
- status
- orderIndex
```

Ví dụ:

```text
Category: Khoa học tự nhiên
Subject:
- Toán
- Vật lý
- Hóa học
- Sinh học
```

```text
Category: Ngoại ngữ
Subject:
- IELTS
- TOEIC
- TOEFL
```

```text
Category: Backend
Subject:
- Spring Boot
- NestJS
- Django
```

---

### 3.5. Level

Level không chỉ là lớp 1, lớp 2.

Level là khái niệm rộng, bao gồm:

```text
- lớp phổ thông
- mục tiêu chứng chỉ
- trình độ kỹ năng
- năm học đại học
- mục tiêu ôn thi
```

```text
Level
- id
- subjectId
- name
- type
- description
- status
- orderIndex
```

Enum:

```text
LevelType
- GRADE
- EXAM_PREPARATION
- UNIVERSITY_LEVEL
- CERTIFICATE_TARGET
- SKILL_LEVEL
- COACHING_LEVEL
```

Ví dụ:

```text
Subject: Toán
Level: Lớp 5
Type: GRADE
```

```text
Subject: Vật lý
Level: Lớp 10
Type: GRADE
```

```text
Subject: TOEIC
Level: TOEIC 500+
Type: CERTIFICATE_TARGET
```

```text
Subject: Photoshop
Level: Cơ bản
Type: SKILL_LEVEL
```

```text
Subject: Lập trình C
Level: Sinh viên năm 1
Type: UNIVERSITY_LEVEL
```

---

## 4. Dữ liệu `subject.md` hiện tại nên map như thế nào?

File `subject.md` hiện tại đang chia dữ liệu thành các nhóm:

```text
PRIMARY
SECONDARY
HIGH_SCHOOL
UNIVERSITY
LANGUAGE
IT_SKILLS
SOFT_SKILLS
```

Nên map lại như sau:

| Nhóm trong subject.md | ProgramType | EducationLevel | Ý nghĩa |
|---|---|---|---|
| PRIMARY | ACADEMIC | PRIMARY | Tiểu học |
| SECONDARY | ACADEMIC | SECONDARY | THCS |
| HIGH_SCHOOL | ACADEMIC | HIGH_SCHOOL | THPT |
| UNIVERSITY | ACADEMIC | UNIVERSITY | Đại học / Cao đẳng |
| LANGUAGE | SKILL | null | Ngoại ngữ / chứng chỉ |
| IT_SKILLS | SKILL | null | CNTT & Công nghệ |
| SOFT_SKILLS | SKILL | null | Kỹ năng mềm |

### Ví dụ map PRIMARY

```text
ProgramType: ACADEMIC
EducationLevel: PRIMARY
Category: Tiểu học
Subjects:
- Mathematics
- Vietnamese
- English
- Informatics
- Science
- History & Geography
- Music
- Fine Arts

Levels:
- Grade 1
- Grade 2
- Grade 3
- Grade 4
- Grade 5
```

### Ví dụ map HIGH_SCHOOL

```text
ProgramType: ACADEMIC
EducationLevel: HIGH_SCHOOL
Category: THPT
Subjects:
- Mathematics
- Literature
- English
- Physics
- Chemistry
- Biology
- History
- Geography
- Economic & Law Education
- Informatics
- Technology

Levels:
- Grade 10
- Grade 11
- Grade 12
- National High School Exam Preparation
```

### Ví dụ map LANGUAGE

```text
ProgramType: SKILL
EducationLevel: null
Category: LANGUAGE / Ngoại ngữ
Subjects:
- English Communication
- English Grammar
- IELTS
- TOEIC
- TOEFL
- JLPT N5
- JLPT N4
- JLPT N3
- TOPIK I
- TOPIK II
- HSK 1
- HSK 2

Levels:
- Beginner
- Elementary
- Intermediate
- Upper Intermediate
- Advanced
```

### Ví dụ map IT_SKILLS

```text
ProgramType: SKILL
EducationLevel: null
Category: IT_SKILLS / CNTT & Công nghệ
Sub-categories có thể là:
- Frontend
- Backend
- Programming Languages
- Database
- DevOps & Cloud
- Software Engineering
- UI/UX

Subjects:
- ReactJS
- Spring Boot
- PostgreSQL
- Docker
- Git/GitHub
- Figma

Levels:
- Beginner
- Intermediate
- Advanced
- Interview Preparation
- Project Mentoring
```

---

## 5. TutorSubjectRegistration

Đây là class trung tâm của luồng đăng ký dạy.

```text
TutorSubjectRegistration
- id
- tutorProfileId
- programTypeId
- educationLevelId nullable
- categoryId
- subjectId
- levelId
- experienceYears
- tuitionMin
- tuitionMax
- description
- status
- rejectReason
- submittedAt
- approvedAt
- reviewedBy
- createdAt
- updatedAt
```

Enum:

```text
RegistrationStatus
- DRAFT
- PENDING
- APPROVED
- REJECTED
- SUSPENDED
```

### 5.1. Vì sao bắt buộc cần class này?

Vì một Tutor có thể đăng ký nhiều quyền dạy khác nhau:

```text
Tutor A:
- Toán - Lớp 5
- Vật lý - Lớp 10
- TOEIC - TOEIC 500+
- Photoshop - Cơ bản
```

Mỗi dòng phải có:
- subject riêng,
- level riêng,
- certificate riêng,
- trạng thái duyệt riêng,
- học phí/kinh nghiệm riêng nếu cần,
- lý do từ chối riêng.

Nếu chỉ nối `TutorProfile` trực tiếp với `Subject` thì thiếu trạng thái `PENDING / APPROVED / REJECTED` và thiếu level cụ thể.

---

## 6. Certificate / Evidence

Certificate nên gắn với `TutorSubjectRegistration`, không chỉ gắn chung chung với `TutorProfile`.

```text
Certificate
- id
- tutorSubjectRegistrationId
- name
- issuer
- issueDate
- expiryDate
- fileUrl
- evidenceType
- verificationStatus
- isVerified
- createdAt
```

Enum:

```text
EvidenceType
- DEGREE
- CERTIFICATE
- TRANSCRIPT
- PORTFOLIO
- VIDEO
- GITHUB_PROJECT
- WORK_EXPERIENCE
- OTHER
```

Ví dụ:

```text
TOEIC 900 certificate
  -> dùng cho registration TOEIC - TOEIC 500+

Portfolio thiết kế
  -> dùng cho registration Photoshop - Cơ bản

Bằng sư phạm / bảng điểm
  -> dùng cho registration Toán - Lớp 5
```

---

## 7. Luồng UI gia sư đăng ký môn dạy

### 7.1. Màn 1 — Chọn loại chương trình

```text
Bạn muốn đăng ký dạy theo nhóm nào?

[Học thuật / Theo cấp học]
[Kỹ năng / Chứng chỉ / Nghề nghiệp]
```

---

### 7.2. Nếu chọn Học thuật / Theo cấp học

```text
Bước 1: Chọn cấp học
- Tiểu học
- THCS
- THPT
- Đại học / Cao đẳng

Bước 2: Chọn nhóm môn
- Khoa học tự nhiên
- Khoa học xã hội
- Ngôn ngữ
- Tin học
- Ôn thi

Bước 3: Chọn môn học
- Toán
- Vật lý
- Hóa học
- Sinh học
...

Bước 4: Chọn lớp / trình độ
- Lớp 10
- Lớp 11
- Lớp 12
- Ôn thi THPT Quốc gia

Bước 5: Nhập thông tin dạy
- số năm kinh nghiệm
- học phí dự kiến
- mô tả năng lực

Bước 6: Upload minh chứng

Bước 7: Gửi duyệt
```

---

### 7.3. Nếu chọn Kỹ năng / Chứng chỉ / Nghề nghiệp

```text
Bước 1: Chọn lĩnh vực
- Ngoại ngữ
- CNTT & Công nghệ
- Thiết kế đồ họa
- Kỹ năng mềm
- Âm nhạc

Bước 2: Chọn nhóm môn / category con nếu có
- Backend
- Frontend
- DevOps
- English
- Japanese

Bước 3: Chọn môn học
- Spring Boot
- ReactJS
- TOEIC
- IELTS
- Photoshop

Bước 4: Chọn trình độ / mục tiêu
- Beginner
- Intermediate
- Advanced
- TOEIC 500+
- Interview Preparation
- Project Mentoring

Bước 5: Nhập thông tin dạy

Bước 6: Upload minh chứng

Bước 7: Gửi duyệt
```

---

## 8. Admin / Staff duyệt đăng ký dạy

Admin/Staff xem danh sách:

```text
GET /admin/tutor-subject-registrations?status=PENDING
```

Chi tiết cần hiển thị:
- Tutor info,
- ProgramType,
- EducationLevel nếu có,
- Category,
- Subject,
- Level,
- Experience Years,
- Tuition Range,
- Certificates / Evidence,
- Description.

### Approve

```text
POST /admin/tutor-subject-registrations/{id}/approve
```

Khi approve:

```text
status = APPROVED
approvedAt = now
reviewedBy = currentAdmin
```

### Reject

```text
POST /admin/tutor-subject-registrations/{id}/reject
```

Khi reject:

```text
status = REJECTED
rejectReason = required
reviewedBy = currentAdmin
```

---

## 9. Gia sư tạo lớp liên quan trực tiếp đến đăng ký môn

Khi Tutor tạo lớp, hệ thống chỉ load registration đã duyệt:

```sql
SELECT *
FROM tutor_subject_registration
WHERE tutor_profile_id = :currentTutorProfileId
  AND status = 'APPROVED';
```

UI hiển thị dạng:

```text
Chọn môn/trình độ đã được duyệt:

[Toán - Lớp 5]
[Vật lý - Lớp 10]
[TOEIC - TOEIC 500+]
[Photoshop - Cơ bản]
```

Tutor chọn một registration rồi mới được tạo lớp.

---

## 10. ClassRoom

ClassRoom phải gắn với `TutorSubjectRegistration`.

```text
ClassRoom
- id
- tutorSubjectRegistrationId
- name
- description
- price
- maxStudents
- learningMode
- meetingLink
- status
- startDate
- endDate
- createdAt
- updatedAt
```

Enum:

```text
ClassStatus
- DRAFT
- PENDING_APPROVAL
- ACTIVE
- REJECTED
- CLOSED
- CANCELLED
```

Enum:

```text
LearningMode
- ONLINE
- OFFLINE
- HYBRID
```

### Rule tạo lớp

Backend phải kiểm tra:

```text
currentTutor owns TutorSubjectRegistration
AND TutorSubjectRegistration.status = APPROVED
```

Nếu không:

```text
403 FORBIDDEN
```

hoặc:

```text
409 INVALID_REGISTRATION_STATUS
```

Không tin frontend.

---

## 11. ClassChapter — lộ trình bắt buộc

Sau khi tạo lớp, Tutor phải nhập lộ trình học.

```text
ClassChapter
- id
- classRoomId
- title
- description
- orderIndex
- expectedSessions
```

Quan hệ:

```text
ClassRoom 1 ---- 1..* ClassChapter
```

Rule:

```text
ClassRoom muốn chuyển ACTIVE thì phải có ít nhất 1 ClassChapter.
```

Ví dụ Toán lớp 5:

```text
ClassRoom: Toán lớp 5 nền tảng

ClassChapter:
1. Số tự nhiên
2. Phân số
3. Số thập phân
4. Hình học
5. Ôn tập cuối khóa
```

Ví dụ TOEIC 500+:

```text
ClassRoom: TOEIC 500+ cho người mất gốc

ClassChapter:
1. Kiểm tra đầu vào
2. Từ vựng TOEIC nền tảng
3. Ngữ pháp trọng tâm
4. Listening Part 1-4
5. Reading Part 5-7
6. Thi thử và sửa đề
```

---

## 12. Quan hệ class diagram chốt

```text
ProgramType 1 -------- 0..* Category
EducationLevel 0..1 -- 0..* Category
Category 1 ----------- 0..* Subject
Subject 1 ------------ 0..* Level

TutorProfile 1 ------- 0..* TutorSubjectRegistration
Subject 1 ------------ 0..* TutorSubjectRegistration
Level 1 -------------- 0..* TutorSubjectRegistration
TutorSubjectRegistration 1 -- 0..* Certificate
TutorSubjectRegistration 1 -- 0..* ClassRoom

ClassRoom 1 ---------- 1..* ClassChapter
ClassRoom 1 ---------- 0..* Schedule
ClassRoom 1 ---------- 0..* Enrollment
ClassRoom 1 ---------- 0..* Session
ClassRoom 1 ---------- 0..* Assignment
ClassRoom 1 ---------- 0..* Document
ClassRoom 1 ---------- 0..* Review
```

---

## 13. Quan hệ nên bỏ / không ưu tiên

Không nên dùng:

```text
TutorProfile ---- Subject
TutorProfile ---- Level
ClassRoom ---- Subject
Certificate ---- TutorProfile
```

Thay bằng:

```text
TutorProfile ---- TutorSubjectRegistration ---- Subject
TutorProfile ---- TutorSubjectRegistration ---- Level
TutorSubjectRegistration ---- Certificate
TutorSubjectRegistration ---- ClassRoom
```

---

## 14. API gợi ý cho Learning Service

### Catalog

```text
GET /program-types
GET /education-levels
GET /categories?programTypeId=&educationLevelId=
GET /subjects?categoryId=
GET /levels?subjectId=
```

### Tutor đăng ký môn dạy

```text
GET  /tutor/subject-registrations
POST /tutor/subject-registrations
PUT  /tutor/subject-registrations/{id}
POST /tutor/subject-registrations/{id}/submit
DELETE /tutor/subject-registrations/{id}
```

Rule:
- chỉ sửa được khi status là `DRAFT` hoặc `REJECTED`,
- không sửa trực tiếp khi `PENDING` hoặc `APPROVED`,
- nếu muốn đổi môn đã approved thì tạo registration mới hoặc request update riêng.

### Admin duyệt

```text
GET  /admin/tutor-subject-registrations
GET  /admin/tutor-subject-registrations/{id}
POST /admin/tutor-subject-registrations/{id}/approve
POST /admin/tutor-subject-registrations/{id}/reject
```

### Tutor tạo lớp

```text
GET  /tutor/approved-teaching-registrations
POST /tutor/classes
PUT  /tutor/classes/{id}
POST /tutor/classes/{id}/submit
```

Request tạo lớp:

```json
{
  "tutorSubjectRegistrationId": "uuid",
  "name": "TOEIC 500+ cho người mất gốc",
  "description": "Lớp nền tảng dành cho người mới bắt đầu.",
  "price": 1500000,
  "maxStudents": 10,
  "learningMode": "ONLINE",
  "meetingLink": "https://zoom.us/...",
  "startDate": "2026-09-01",
  "endDate": "2026-11-01",
  "chapters": [
    {
      "title": "Kiểm tra đầu vào",
      "description": "Đánh giá trình độ ban đầu.",
      "orderIndex": 1,
      "expectedSessions": 1
    },
    {
      "title": "Từ vựng TOEIC nền tảng",
      "description": "Học từ vựng thường gặp.",
      "orderIndex": 2,
      "expectedSessions": 3
    }
  ]
}
```

---

## 15. Database table gợi ý

```text
program_type
education_level
category
subject
level
tutor_subject_registration
certificate
class_room
class_chapter
```

### tutor_subject_registration

```text
id
tutor_profile_id
program_type_id
education_level_id nullable
category_id
subject_id
level_id
experience_years
tuition_min
tuition_max
description
status
reject_reason
submitted_at
approved_at
reviewed_by
created_at
updated_at
```

Recommended unique constraint:

```text
UNIQUE(tutor_profile_id, subject_id, level_id)
```

Hoặc nếu cần cho phép đăng ký lại sau khi bị reject:

```text
UNIQUE(tutor_profile_id, subject_id, level_id, status)
```

Tùy business rule.

### class_room

```text
id
tutor_subject_registration_id
name
description
price
max_students
learning_mode
meeting_link
status
start_date
end_date
created_at
updated_at
```

### class_chapter

```text
id
class_room_id
title
description
order_index
expected_sessions
```

---

## 16. Validation bắt buộc

### TutorSubjectRegistration

- `programTypeId` bắt buộc.
- Nếu `programType = ACADEMIC` thì `educationLevelId` bắt buộc.
- Nếu `programType = SKILL` thì `educationLevelId` phải null.
- `categoryId`, `subjectId`, `levelId` bắt buộc.
- Subject phải thuộc Category đã chọn.
- Level phải thuộc Subject đã chọn.
- Tutor không được tạo duplicate registration cùng Subject + Level đang active.
- Phải có ít nhất một Certificate/Evidence trước khi submit nếu business yêu cầu.
- `tuitionMin <= tuitionMax`.

### ClassRoom

- `tutorSubjectRegistrationId` bắt buộc.
- Registration phải thuộc current tutor.
- Registration phải `APPROVED`.
- `name`, `description`, `price`, `maxStudents`, `learningMode` bắt buộc.
- Nếu `learningMode = ONLINE` hoặc `HYBRID` thì `meetingLink` nên bắt buộc hoặc cho nhập trước khi active.
- Phải có ít nhất một `ClassChapter` trước khi active.
- Không cho tạo lớp từ registration `PENDING`, `REJECTED`, `SUSPENDED`.

---

## 17. Flow kiểm tra đúng sai

### Case TOEIC 500+

```text
TutorProfile
  ↓
TutorSubjectRegistration
  ↓
Subject: TOEIC
  ↓
Level: TOEIC 500+
  ↓
Certificate: TOEIC score
  ↓
status APPROVED
  ↓
ClassRoom: TOEIC 500+ cho người mất gốc
  ↓
ClassChapter
  ↓
Schedule
  ↓
Enrollment
```

Nếu flow này chạy được thì thiết kế đúng.

### Case Toán lớp 5

```text
TutorProfile
  ↓
TutorSubjectRegistration
  ↓
Subject: Toán
  ↓
Level: Lớp 5
  ↓
Certificate: bằng cấp / bảng điểm / chứng chỉ
  ↓
status APPROVED
  ↓
ClassRoom: Toán lớp 5 nền tảng
  ↓
ClassChapter: 5 chương học
  ↓
Schedule: thứ 2, 4, 6
```

---

## 18. Prompt mẫu giao cho AI Coding Assistant

```text
Đọc file:
- EDUCONNECT_TUTOR_SUBJECT_CLASS_FLOW.md
- code hiện tại trong learning-service
- entity Subject, Level, ClassRoom, Certificate hiện có

Chỉ thực hiện task: refactor luồng gia sư đăng ký môn dạy liên quan đến tạo lớp.

Yêu cầu:
1. Giữ kiến trúc Service-Based Architecture.
2. Không tạo service mới.
3. Không tự đổi toàn bộ package structure.
4. Thêm/sửa các entity:
   - ProgramType
   - EducationLevel
   - Category
   - Subject
   - Level
   - TutorSubjectRegistration
   - Certificate
   - ClassRoom
   - ClassChapter
5. ClassRoom phải tạo từ TutorSubjectRegistration đã APPROVED.
6. Certificate phải gắn với TutorSubjectRegistration.
7. Không để TutorProfile nối trực tiếp Subject/Level để làm quyền dạy.
8. Không để ClassRoom chọn Subject tự do.
9. Thêm validation, exception, repository, service, controller, DTO.
10. Sau khi sửa phải build/test.
11. Báo cáo file thay đổi, database changes, APIs changed, remaining issues.

Không implement payment, contract, blockchain trong task này.
```

---

## 19. Kết luận chốt

Câu cần nhớ:

```text
TutorSubjectRegistration là cầu nối giữa gia sư, môn học, trình độ và chứng chỉ.
ClassRoom phải được tạo từ TutorSubjectRegistration đã APPROVED.
ClassChapter là lộ trình bắt buộc của ClassRoom.
```

Đây là thiết kế đúng cho luồng:

```text
Gia sư đăng ký dạy
  ↓
Admin duyệt quyền dạy
  ↓
Gia sư tạo lớp dựa trên quyền dạy đã duyệt
```

---

## 20. Trạng thái triển khai catalog chuẩn

Nguồn dữ liệu chuẩn cho mọi tính năng mới là:

```text
program_types
education_levels
catalog_categories
catalog_subjects
catalog_levels
tutor_subject_registrations
tutor_subject_registration_levels
registration_evidence
```

Các bảng `subjects`, `subject_categories`, `subject_groups`, `subject_requests`,
`tutor_subjects` và `teaching_levels` thuộc catalog V1. Chúng chỉ được giữ tạm để
tương thích dữ liệu/chức năng cũ, không được dùng để phát triển luồng đăng ký dạy
hoặc tạo lớp mới.

Quy ước quản trị:

- Chỉ `ADMIN` được sửa catalog; `STAFF` chỉ duyệt nghiệp vụ được phân công.
- Xóa category, subject hoặc level là soft-delete (`active = false`).
- Dữ liệu inactive không xuất hiện trong bộ chọn mới nhưng lịch sử vẫn được giữ.
- Không cho tạo lớp mới từ subject/category/level đã inactive.
- `ACADEMIC` bắt buộc có `EducationLevel`; `SKILL` bắt buộc không có `EducationLevel`.
- Mọi level của registration phải thuộc đúng subject của registration.
- Một tutor không được có hai registration active trùng subject + level.

Đề xuất môn mới được lưu ngay trong `TutorSubjectRegistration`. Danh sách level
đề xuất là value object có cấu trúc trong
`tutor_subject_registration_proposed_levels`; đây không phải bằng cấp/chứng chỉ
của gia sư. Bằng cấp, bảng điểm, chứng chỉ và portfolio vẫn phải lưu ở
`registration_evidence`.
