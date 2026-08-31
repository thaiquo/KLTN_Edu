# EduConnect

## 1. Project Goal

EduConnect là nền tảng kết nối gia sư và học viên, hướng đến hỗ trợ tìm kiếm, gợi ý ghép nối bằng AI, quản lý quá trình học tập, và quản lý hợp đồng điện tử có hỗ trợ Blockchain/Smart Contract.

Theo target KLTN, AI hỗ trợ gợi ý/xếp hạng mức độ phù hợp giữa học viên và gia sư. Blockchain hỗ trợ kiểm chứng tính toàn vẹn hợp đồng, ký quỹ bằng USDC/ERC-20 trong môi trường thử nghiệm, settlement, release, refund, và dispute nếu implementation hỗ trợ.

## 2. Platforms

- Web: target là nền tảng chính cho Guest, Student, Tutor, Staff, Admin. Current source đã có React/Vite frontend với nhiều màn hình auth, tutor, class, staff/admin, portal, và một số Web3 UI.
- Mobile: target có Mobile. Current source là Expo/React Native app với auth/home cơ bản; chưa feature-equivalent với Web.

## 3. Actors

- Guest: người dùng chưa đăng nhập, có thể đăng ký và tra cứu thông tin công khai.
- Student: học viên tìm kiếm gia sư/lớp, gửi yêu cầu tham gia, quản lý thông tin cá nhân, hợp đồng, tin nhắn, bài tập, và thanh toán.
- Tutor: gia sư quản lý hồ sơ, lịch rảnh, lớp học, yêu cầu tham gia, buổi học, bài tập, hợp đồng, tin nhắn, và thu nhập.
- Staff: nhân viên vận hành, kiểm duyệt nội dung, xử lý vi phạm/khiếu nại, giám sát lớp học, hỗ trợ người dùng.
- Admin: quản trị hệ thống, quản lý người dùng, danh mục, Blockchain, thanh toán, và báo cáo thống kê.

## 4. Core Business Flow

Target business flow:

Guest -> Register/Login -> Student/Tutor -> Search/Connection -> Request -> Agreement -> Contract -> Learning Process -> Payment/Income -> Completion -> Rating/Complaint.

AI Matching là supporting capability cho tìm kiếm, gợi ý và xếp hạng. Blockchain hỗ trợ contract integrity, escrow, settlement, release, refund, và dispute. Flow trên là target business flow, không có nghĩa toàn bộ đã implemented trong source hiện tại.

## 5. Main Domains

- Account: user, role, active role, authentication, OTP, student/tutor profile, tutor application, staff/admin user operations.
- Learning: subject/catalog, tutor subject/expertise, availability, class, schedule/chapter, join/enrollment request.
- Contract: contract agreement, acceptance/signing target, contract lifecycle, escrow payment, settlement, dispute.
- Payment: Student payment/escrow and Admin payment administration are distinct target capabilities.
- Blockchain: Solidity Smart Contract, ERC-20 escrow, Web3j backend integration, MetaMask/ethers.js web integration target.
- Notification: target service exists conceptually; current source is a service shell.
- AI Matching: target hybrid recommendation; current source has no ai-service implementation.

## 6. Technology Overview

- Spring Boot: backend services.
- React/Vite: frontend Web.
- React Native/Expo: Mobile.
- PostgreSQL: current relational database.
- RabbitMQ: current async messaging between Account and Learning in part.
- Amazon S3: current account-service storage for avatar and tutor documents.
- Docker/Docker Compose: current local infrastructure for PostgreSQL and RabbitMQ.
- Ethereum/Sepolia: target test network; current evidence is mainly Anvil/local.
- Solidity: Smart Contract implementation.
- Web3j: contract-service blockchain integration.
- ethers.js and MetaMask: Web wallet integration, currently with known ABI mismatch.
- Foundry: Smart Contract build/test/deploy tooling.
- Qdrant/Spring AI: target/planned for AI Matching; not currently implemented.

## 7. Target vs Current Implementation

- `TARGET` means the business/design baseline from KLTN Chương 1, Chương 2, and Chương 3.1-3.3.
- `CURRENT` means the implementation proven by source code, configuration, migrations, and tests in this repository.

Read `docs/BUSINESS_RULES.md` for target business rules. Read `docs/IMPLEMENTATION_STATUS.md` for current implementation status and known conflicts.
