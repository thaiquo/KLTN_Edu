# AI context — Quy tắc nghiệp vụ hiện tại

> Tài liệu cũ từng được suy ra từ NestJS legacy đã được thay thế. AI/agent phải dùng [../BUSINESS_RULES.md](../BUSINESS_RULES.md) và [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) làm nguồn hiện tại.

## Actor/role

- Guest, Student, Tutor, Staff, Admin.
- Browser dùng JWT cookie và `activeRole`.
- Tutor chỉ có full teaching authority khi hồ sơ/application đã `APPROVED`.

## Domain owner

- Account: identity, role, Student/Tutor profile và Tutor application.
- Learning: catalog, availability, classroom, enrollment, session, attendance, homework.
- Contract: agreement, signature/artifact, payment, escrow, settlement, dispute/evidence và blockchain projection.
- Notification: persistent notification và chat.
- AI: mới là skeleton, không có quyền đọc trực tiếp DB domain khác.

## Quy tắc tài chính cần bảo toàn

- Một Student có một agreement/escrow riêng.
- `BOTH_PRESENT`: 85% Tutor, 15% Platform.
- `STUDENT_ABSENT_TUTOR_PRESENT`: 45% Tutor, 10% Platform, hoàn 45% Student.
- `TUTOR_ABSENT`: hoàn 100% Student.
- Chỉ confirmed smart-contract event chứng minh payout/refund.
- Dispute hợp lệ giữ đúng settlement; V1 chỉ dispute `BOTH_PRESENT`.

## Quy tắc dữ liệu cho AI tương lai

- Không dùng CCCD/KYC, contract document, dispute evidence hoặc private chat làm dữ liệu model/vector nếu chưa có thiết kế privacy và consent rõ ràng.
- AI không duyệt Tutor, không xác nhận attendance, không quyết định settlement/dispute và không bypass hard filter/authorization.
- Search hiện tại là deterministic, không được gắn nhãn AI.
