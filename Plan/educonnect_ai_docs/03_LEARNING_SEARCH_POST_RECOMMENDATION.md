# EDUCONNECT — LEARNING, SEARCH, POSTS & AI RECOMMENDATION

## 1. Mục tiêu Learning Service

Learning Service quản lý toàn bộ lifecycle:
- danh mục môn học,
- thông tin dạy của Tutor,
- lịch rảnh,
- bài đăng nhu cầu học,
- bài đăng mở lớp,
- search/filter,
- recommendation,
- classroom,
- enrollment,
- session,
- attendance,
- assignment/submission,
- review.

## 2. Master data: Subject / Level / Grade

Admin quản lý dữ liệu để Tutor/Student chọn, không nhập tự do toàn bộ.

Ví dụ:

```text
Subject
- Mathematics
- English
- Physics

EducationLevel
- Primary
- Secondary
- High School
- University

Grade
- Grade 10
- Grade 11
- Grade 12
```

Quan hệ có thể là:

```text
Subject
  *
  |
  * SubjectGrade
  |
  *
Grade
```

Tutor đăng ký dạy theo tổ hợp:
```text
English + Grade 10
English + Grade 11
English + Grade 12
```

## 3. TutorTeachingProfile

Thuộc Learning Service.

```text
TutorTeachingProfile
- id
- tutorId
- bioForTeaching
- hourlyRate
- teachingMode
- location
- status
- createdAt
- updatedAt
```

Nên có entity mapping:
```text
TutorSubjectGrade
- id
- tutorId
- subjectId
- gradeId
- approved/status nếu cần
```

## 4. TutorAvailability

Khác Session.

```text
TutorAvailability
- id
- tutorId
- dayOfWeek
- startTime
- endTime
- status
```

Ý nghĩa:
> Tutor rảnh thứ 2 từ 19:00–21:00.

Nếu slot đang ràng buộc bởi class/session active thì update gây conflict phải trả 409.

## 5. Hai loại "bài đăng" chính

Để search rõ ràng, nên phân biệt hai intent.

### A. LearningPost — Student đăng nhu cầu tìm Tutor/lớp

Ví dụ:
> Cần gia sư Tiếng Anh lớp 11, học online tối thứ 3/5, ngân sách 150k–200k/buổi.

```text
LearningPost
- id
- studentId
- subjectId
- gradeId
- title
- description
- budgetMin
- budgetMax
- learningMode
- location
- expectedStartDate
- status
- createdAt
- updatedAt
```

Có thể có:
```text
LearningPostTimeSlot
- learningPostId
- dayOfWeek
- startTime
- endTime
```

Status:
```text
DRAFT
OPEN
MATCHING
MATCHED
CLOSED
CANCELLED
```

### B. ClassPost — Tutor đăng lớp dự kiến/mở tuyển

Tutor chọn môn đã được phép dạy.

```text
ClassPost
- id
- tutorId
- subjectId
- gradeId
- title
- description
- pricePerSession
- teachingMode
- location
- maxStudents
- expectedStartDate
- recruitmentDeadline
- status
- createdAt
- updatedAt
```

Status:
```text
DRAFT
OPEN
FULL
CLOSED
CANCELLED
CONVERTED_TO_CLASSROOM
```

**ClassPost chưa nhất thiết là Classroom.**

ClassPost = bài tuyển học viên.  
Classroom = lớp thật đã được hình thành để vận hành học.

## 6. Student tìm lớp học như thế nào?

Flow V1:

```text
Student mở Search
  ↓
Filter:
- keyword
- subject
- grade
- tutor
- price range
- teaching mode
- location
- day/time
- rating
  ↓
Search ClassPost OPEN
  ↓
Sort
  ↓
Xem chi tiết
  ↓
Send JoinRequest
```

Nếu Classroom đã tồn tại và đang cho phép join:
```text
Search Classroom -> JoinRequest
```

## 7. Tutor tìm nhu cầu học như thế nào?

```text
Tutor
  ↓
Search LearningPost
  ↓
Filter theo môn/cấp lớp/lịch/budget/mode
  ↓
Xem nhu cầu phù hợp
  ↓
Send Offer / Contact / Accept request
```

Có thể dùng:
```text
TutorOffer
- id
- learningPostId
- tutorId
- proposedPrice
- message
- status
```

## 8. Search V1 — làm trước AI

Không gọi search thường là AI.

V1 nên dùng:
- PostgreSQL query,
- specification / criteria,
- pagination,
- sorting,
- indexed columns,
- full-text search khi cần.

Ví dụ endpoint:

```text
GET /class-posts/search
?keyword=english
&subjectId=...
&gradeId=...
&minPrice=...
&maxPrice=...
&mode=ONLINE
&page=0
&size=20
&sort=createdAt,desc
```

Spring có thể dùng:
- `JpaSpecificationExecutor`
- Criteria API
- QueryDSL nếu project đã chọn.

Không cần Elasticsearch ở phase đầu.

## 9. Recommendation V1

Recommendation khác Search.

### Step 1 — hard filtering

Loại tutor/class không hợp lệ:
- tutor chưa verified,
- sai subject,
- sai grade,
- time không overlap,
- mode không phù hợp,
- vượt budget,
- inactive/full.

### Step 2 — content-based scoring

Ví dụ score:

```text
score =
subjectScore * w1
+ gradeScore * w2
+ budgetScore * w3
+ availabilityScore * w4
+ modeScore * w5
+ locationScore * w6
+ ratingScore * w7
+ experienceScore * w8
```

Weight cấu hình được.

## 10. Interaction tracking — chuẩn bị cho AI tốt hơn

Sau khi V1 ổn, track:

```text
RecommendationInteraction
- id
- studentId
- tutorId/classPostId
- learningPostId
- eventType
- value
- createdAt
```

Event:
```text
IMPRESSION
VIEW
CLICK
SAVE
CONTACT
JOIN_REQUEST
ACCEPT
REJECT
ENROLL
COMPLETE_CLASS
REVIEW
```

## 11. Collaborative + Hybrid — làm sau

Chỉ implement Collaborative Filtering khi có đủ interaction history.

Hybrid:

```text
finalScore =
contentWeight * contentScore
+ collaborativeWeight * collaborativeScore
```

Không gọi hệ thống là "AI Hybrid Recommendation" nếu mới chỉ filter SQL + weighted rule.

## 12. Từ post sang Classroom

### Trường hợp Tutor đã mở ClassPost
```text
ClassPost
  ↓ đủ điều kiện / có học viên
Create Classroom
  ↓
ClassPost = CONVERTED_TO_CLASSROOM
```

### Trường hợp Student tìm Tutor qua LearningPost
```text
LearningPost
  ↓ Tutor accepted / hai bên thống nhất
Create Contract draft
  ↓
Create Classroom
```

Thứ tự chính xác giữa Contract và Classroom có thể phụ thuộc business flow, nhưng phải có idempotency và trạng thái rõ ràng.

## 13. Classroom không nên tự xóa chỉ vì chưa có học viên

Nếu chưa có thành viên:
- có thể giữ ở `DRAFT` hoặc `RECRUITING`,
- tutor được phép cancel/delete nếu chưa phát sinh contract/enrollment/payment,
- khi đã có ràng buộc tài chính/hợp đồng thì không hard delete.

Ưu tiên status thay vì xóa dữ liệu nghiệp vụ.
