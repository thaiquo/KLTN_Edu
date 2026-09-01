export const homeNavLinks = [
  { label: 'Tìm gia sư', href: '/tutors' },
  { label: 'Tìm lớp', href: '/classes' },
  { label: 'Gợi ý phù hợp', href: '#matching' },
  { label: 'An toàn & hợp đồng', href: '#trust' },
];

export const studentNavLinks = [
  { label: 'Tìm gia sư', href: '/tutors', icon: 'search' },
  { label: 'Tìm lớp', href: '/classes', icon: 'book' },
  { label: 'Hợp đồng của tôi', href: '/dashboard?tab=contracts', icon: 'shield' },
  { label: 'Ví của tôi', href: '/dashboard?tab=wallet', icon: 'wallet' },
  { label: 'Lớp học của tôi', href: '/dashboard?tab=courses', icon: 'dashboard' },
  { label: 'Tin nhắn', href: '/dashboard?tab=messages', icon: 'message' },
];

export const pathways = [
  {
    tone: 'student',
    title: 'Dành cho Học viên',
    intro: 'Từ nhu cầu học tập đến người đồng hành phù hợp - chỉ trong vài bước đơn giản.',
    steps: [
      {
        number: '01',
        title: 'Mô tả nhu cầu học',
        description: 'Cho chúng tôi biết môn học, mục tiêu, thời gian và mức học phí phù hợp với bạn.',
      },
      {
        number: '02',
        title: 'Xem gia sư được gợi ý',
        description: 'Hệ thống lọc và hiển thị những gia sư phù hợp nhất theo chuyên môn, lịch rảnh và khu vực.',
      },
      {
        number: '03',
        title: 'Học với hợp đồng rõ ràng',
        description: 'Theo dõi tiến độ và quyền lợi qua hợp đồng điện tử minh bạch, có xác nhận hai bên.',
      },
    ],
  },
  {
    tone: 'tutor',
    title: 'Dành cho Gia sư',
    intro: 'Xây dựng uy tín chuyên môn, nhận lớp đúng thế mạnh và phát triển bền vững.',
    steps: [
      {
        number: '01',
        title: 'Đăng ký & xác minh hồ sơ',
        description: 'Tạo hồ sơ và gửi bằng cấp, chứng chỉ để được kiểm duyệt và hiển thị cho học viên.',
      },
      {
        number: '02',
        title: 'Nhận yêu cầu phù hợp',
        description: 'Xem các lớp học sát với chuyên môn, khu vực và khung giờ bạn có thể dạy.',
      },
      {
        number: '03',
        title: 'Dạy & nhận thù lao đúng hạn',
        description: 'Giảng dạy chuyên nghiệp và nhận thanh toán theo tiến độ cam kết trong hợp đồng.',
      },
    ],
  },
];

export const featuredTutors = [
  {
    name: 'Nguyễn Mai Phương',
    credential: 'ĐH Ngoại Thương - Chuyên Anh văn & IELTS',
    tags: ['IELTS 8.5', 'SAT 1550'],
    rate: '350.000đ',
    rating: '4.9',
    image: 'https://images.unsplash.com/photo-1656225725406-43779c174182?auto=format&fit=crop&w=900&q=82',
    imageAlt: 'Sinh viên đang đọc sách trong thư viện',
  },
  {
    name: 'Lê Minh Anh',
    credential: 'ĐH Bách Khoa - Chuyên Toán & Vật lý',
    tags: ['Toán nâng cao', 'Luyện thi ĐH'],
    rate: '450.000đ',
    rating: '5.0',
    image: 'https://images.unsplash.com/photo-1699502877697-ad87f0af008b?auto=format&fit=crop&w=900&q=82',
    imageAlt: 'Sinh viên nghiên cứu tài liệu',
  },
  {
    name: 'Trần Thu Hà',
    credential: 'RMIT - Kinh tế & Tài chính',
    tags: ['Kế toán', 'Tài chính DN'],
    rate: '500.000đ',
    rating: '4.8',
    image: 'https://images.unsplash.com/photo-1721441932984-93e1bf3a2e9f?auto=format&fit=crop&w=900&q=82',
    imageAlt: 'Gia sư trong không gian thư viện',
  },
];

export const classRequests = [
  {
    subject: 'Toán cao cấp 1',
    icon: 'calculator',
    title: 'Ôn thi học kỳ cho sinh viên kỹ thuật',
    requirement: 'Sinh viên năm 3+, học online hoặc offline tại Hà Nội',
    budget: '3.000.000đ',
    duration: 'Trọn khóa 10 buổi',
  },
  {
    subject: 'Khóa luận CNTT',
    icon: 'code',
    title: 'Tìm mentor đồng hành xây dựng sản phẩm tốt nghiệp',
    requirement: 'Cần hỗ trợ React, Node.js và xây dựng tài liệu bảo vệ',
    budget: '5.000.000đ',
    duration: 'Trong 8 tuần',
  },
  {
    subject: 'IELTS 7.0+',
    icon: 'language',
    title: 'Luyện Speaking & Writing theo mục tiêu cá nhân',
    requirement: 'Lịch học buổi tối, ưu tiên gia sư có kinh nghiệm luyện thi',
    budget: '280.000đ',
    duration: 'Theo buổi',
  },
];

export const trustFeatures = [
  {
    icon: 'contract',
    title: 'Hợp đồng điện tử minh bạch',
    description: 'Lịch học, mức học phí và các điều khoản thay đổi đều được ghi nhận rõ ràng, có chữ ký xác nhận hai bên.',
  },
  {
    icon: 'identity',
    title: 'Xác minh danh tính & hồ sơ',
    description: 'Bằng cấp và chứng chỉ của gia sư được kiểm duyệt trước khi hiển thị để học viên có thêm cơ sở lựa chọn.',
  },
  {
    icon: 'matching',
    title: 'Gợi ý gia sư phù hợp',
    description: 'Hệ thống đề xuất dựa trên chuyên môn, khu vực, mức học phí và lịch rảnh - không chỉ dựa trên rating.',
  },
];

export const footerGroups = [
  {
    title: 'Dịch vụ',
    links: ['Tìm gia sư', 'Đăng lớp học', 'Gợi ý gia sư phù hợp'],
  },
  {
    title: 'Hỗ trợ',
    links: ['Trung tâm trợ giúp', 'An toàn tài khoản', 'Liên hệ hỗ trợ'],
  },
  {
    title: 'Pháp lý',
    links: ['Chính sách riêng tư', 'Hợp đồng điện tử', 'Điều khoản sử dụng'],
  },
];
