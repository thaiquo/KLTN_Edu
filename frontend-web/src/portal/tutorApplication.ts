export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ApplicationStatus = 'none' | ReviewStatus | 'withdrawn';
export type PriceUnit = 'per_hour' | 'per_session' | 'per_30_days' | 'per_course';

export interface TutorAvailability {
  _id?: string;
  clientId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface SubjectEvidence {
  _id?: string;
  clientId?: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
  description: string;
  fileKey: string;
  fileUrl?: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  category?: 'image' | 'video' | 'audio' | 'file';
  verificationStatus?: ReviewStatus;
  adminNote?: string;
  uploadFile?: File;
}

export interface TutorTeachingSubject {
  _id?: string;
  clientId?: string;
  levelGroupId: string;
  subjectId: string;
  teachingLevelIds: string[];
  yearsOfExperience: number;
  minPrice: number;
  maxPrice: number;
  priceUnit: PriceUnit;
  durationDays: number | null;
  sessionsPerPeriod: number;
  minutesPerSession: number;
  evidences: SubjectEvidence[];
  bio?: string;
  experience?: string;
  customLevelGroup?: string;
  customSubject?: string;
  customTeachingLevel?: string;
  verificationStatus?: ReviewStatus;
  adminNote?: string;
}

export interface TutorApplication {
  _id?: string;
  userId?: string | { _id: string; fullName: string; email: string; role: string };
  bio: string;
  weeklyAvailability: TutorAvailability[];
  teachingSubjects: TutorTeachingSubject[];
  status: ApplicationStatus;
  adminNote?: string;
  revision?: number;
  submittedAt?: string;
  reviewedAt?: string | null;
  withdrawnAt?: string | null;
  updatedAt?: string;
}

type CatalogOption = { id: string; name: string };

export const LEVEL_GROUPS: CatalogOption[] = [
  { id: 'primary', name: 'Cấp 1 (Tiểu học)' },
  { id: 'secondary', name: 'Cấp 2 (THCS)' },
  { id: 'high_school', name: 'Cấp 3 (THPT)' },
  { id: 'university', name: 'Đại học' },
  { id: 'language', name: 'Ngoại ngữ' },
  { id: 'it_skills', name: 'CNTT & Công nghệ' },
  { id: 'soft_skills', name: 'Kỹ năng mềm' }
];

export const SUBJECTS_BY_GROUP: Record<string, CatalogOption[]> = {
  primary: [
    { id: 'mathematics', name: 'Mathematics' },
    { id: 'vietnamese', name: 'Vietnamese' },
    { id: 'english', name: 'English' },
    { id: 'informatics', name: 'Informatics' },
    { id: 'science', name: 'Science' },
    { id: 'history_geography', name: 'History & Geography' },
    { id: 'music', name: 'Music' },
    { id: 'fine_arts', name: 'Fine Arts' }
  ],
  secondary: [
    { id: 'mathematics', name: 'Mathematics' },
    { id: 'literature', name: 'Literature' },
    { id: 'english', name: 'English' },
    { id: 'physics', name: 'Physics' },
    { id: 'chemistry', name: 'Chemistry' },
    { id: 'biology', name: 'Biology' },
    { id: 'history', name: 'History' },
    { id: 'geography', name: 'Geography' },
    { id: 'civic_education', name: 'Civic Education' },
    { id: 'informatics', name: 'Informatics' },
    { id: 'technology', name: 'Technology' }
  ],
  high_school: [
    { id: 'mathematics', name: 'Mathematics' },
    { id: 'literature', name: 'Literature' },
    { id: 'english', name: 'English' },
    { id: 'physics', name: 'Physics' },
    { id: 'chemistry', name: 'Chemistry' },
    { id: 'biology', name: 'Biology' },
    { id: 'history', name: 'History' },
    { id: 'geography', name: 'Geography' },
    { id: 'economic_law_education', name: 'Economic & Law Education' },
    { id: 'informatics', name: 'Informatics' },
    { id: 'technology', name: 'Technology' }
  ],
  university: [
    { id: 'calculus', name: 'Mathematics — Calculus' },
    { id: 'linear_algebra', name: 'Mathematics — Linear Algebra' },
    { id: 'probability_statistics', name: 'Mathematics — Probability & Statistics' },
    { id: 'discrete_mathematics', name: 'Mathematics — Discrete Mathematics' },
    { id: 'c_cpp', name: 'Computer Science — C/C++' },
    { id: 'java', name: 'Computer Science — Java' },
    { id: 'python', name: 'Computer Science — Python' },
    { id: 'javascript', name: 'Computer Science — JavaScript' },
    { id: 'typescript', name: 'Computer Science — TypeScript' },
    { id: 'data_structures_algorithms', name: 'Computer Science — Data Structures & Algorithms' },
    { id: 'database_systems', name: 'Computer Science — Database Systems' },
    { id: 'operating_systems', name: 'Computer Science — Operating Systems' },
    { id: 'computer_networks', name: 'Computer Science — Computer Networks' },
    { id: 'software_engineering', name: 'Computer Science — Software Engineering' },
    { id: 'web_development', name: 'Computer Science — Web Development' },
    { id: 'mobile_development', name: 'Computer Science — Mobile Development' },
    { id: 'accounting', name: 'Business & Economics — Accounting' },
    { id: 'finance', name: 'Business & Economics — Finance' },
    { id: 'marketing', name: 'Business & Economics — Marketing' },
    { id: 'microeconomics', name: 'Business & Economics — Microeconomics' },
    { id: 'macroeconomics', name: 'Business & Economics — Macroeconomics' },
    { id: 'business_administration', name: 'Business & Economics — Business Administration' }
  ],
  language: [
    { id: 'english_communication', name: 'English — Communication' },
    { id: 'english_grammar', name: 'English — Grammar' },
    { id: 'ielts', name: 'English — IELTS' },
    { id: 'toeic', name: 'English — TOEIC' },
    { id: 'toefl', name: 'English — TOEFL' },
    { id: 'jlpt_n5', name: 'Japanese — JLPT N5' },
    { id: 'jlpt_n4', name: 'Japanese — JLPT N4' },
    { id: 'jlpt_n3', name: 'Japanese — JLPT N3' },
    { id: 'jlpt_n2', name: 'Japanese — JLPT N2' },
    { id: 'jlpt_n1', name: 'Japanese — JLPT N1' },
    { id: 'topik_i', name: 'Korean — TOPIK I' },
    { id: 'topik_ii', name: 'Korean — TOPIK II' },
    { id: 'hsk_1', name: 'Chinese — HSK 1' },
    { id: 'hsk_2', name: 'Chinese — HSK 2' },
    { id: 'hsk_3', name: 'Chinese — HSK 3' },
    { id: 'hsk_4', name: 'Chinese — HSK 4' },
    { id: 'hsk_5', name: 'Chinese — HSK 5' },
    { id: 'hsk_6', name: 'Chinese — HSK 6' },
    { id: 'french_communication', name: 'French — Communication' },
    { id: 'delf_preparation', name: 'French — DELF Preparation' }
  ],
  it_skills: [
    { id: 'html_css', name: 'Frontend — HTML/CSS' },
    { id: 'javascript', name: 'Frontend — JavaScript' },
    { id: 'typescript', name: 'Frontend — TypeScript' },
    { id: 'reactjs', name: 'Frontend — ReactJS' },
    { id: 'nextjs', name: 'Frontend — NextJS' },
    { id: 'angular', name: 'Frontend — Angular' },
    { id: 'vuejs', name: 'Frontend — VueJS' },
    { id: 'nodejs', name: 'Backend — NodeJS' },
    { id: 'expressjs', name: 'Backend — ExpressJS' },
    { id: 'nestjs', name: 'Backend — NestJS' },
    { id: 'spring_boot', name: 'Backend — Spring Boot' },
    { id: 'django', name: 'Backend — Django' },
    { id: 'fastapi', name: 'Backend — FastAPI' },
    { id: 'laravel', name: 'Backend — Laravel' },
    { id: 'asp_net', name: 'Backend — ASP.NET' },
    { id: 'java', name: 'Programming Language — Java' },
    { id: 'python', name: 'Programming Language — Python' },
    { id: 'c_sharp', name: 'Programming Language — C#' },
    { id: 'c_plus_plus', name: 'Programming Language — C++' },
    { id: 'php', name: 'Programming Language — PHP' },
    { id: 'go', name: 'Programming Language — Go' },
    { id: 'mysql', name: 'Database — MySQL' },
    { id: 'postgresql', name: 'Database — PostgreSQL' },
    { id: 'mongodb', name: 'Database — MongoDB' },
    { id: 'redis', name: 'Database — Redis' },
    { id: 'docker', name: 'DevOps & Cloud — Docker' },
    { id: 'kubernetes', name: 'DevOps & Cloud — Kubernetes' },
    { id: 'aws', name: 'DevOps & Cloud — AWS' },
    { id: 'azure', name: 'DevOps & Cloud — Azure' },
    { id: 'ci_cd', name: 'DevOps & Cloud — CI/CD' },
    { id: 'git_github', name: 'Software Engineering — Git/GitHub' },
    { id: 'data_structures_algorithms', name: 'Software Engineering — Data Structures & Algorithms' },
    { id: 'system_design', name: 'Software Engineering — System Design' },
    { id: 'design_patterns', name: 'Software Engineering — Design Patterns' },
    { id: 'figma', name: 'UI/UX — Figma' },
    { id: 'ui_design', name: 'UI/UX — UI Design' },
    { id: 'ux_design', name: 'UI/UX — UX Design' }
  ],
  soft_skills: [
    { id: 'communication_skills', name: 'Communication Skills' },
    { id: 'presentation_skills', name: 'Presentation Skills' },
    { id: 'critical_thinking', name: 'Critical Thinking' },
    { id: 'teamwork', name: 'Teamwork' },
    { id: 'time_management', name: 'Time Management' },
    { id: 'leadership', name: 'Leadership' },
    { id: 'problem_solving', name: 'Problem Solving' },
    { id: 'cv_writing', name: 'CV Writing' },
    { id: 'interview_preparation', name: 'Interview Preparation' },
    { id: 'career_orientation', name: 'Career Orientation' }
  ]
};

const grades = (from: number, to: number): CatalogOption[] =>
  Array.from({ length: to - from + 1 }, (_, index) => ({
    id: `grade_${from + index}`, name: `Lớp ${from + index}`
  }));

export const LEVELS_BY_GROUP: Record<string, CatalogOption[]> = {
  primary: grades(1, 5),
  secondary: [
    ...grades(6, 9),
    { id: 'high_school_entrance_exam_preparation', name: 'Luyện thi vào lớp 10' }
  ],
  high_school: [
    ...grades(10, 12),
    { id: 'national_high_school_exam_preparation', name: 'Luyện thi tốt nghiệp THPT' }
  ],
  university: [
    { id: 'year_1', name: 'Năm nhất' },
    { id: 'year_2', name: 'Năm hai' },
    { id: 'year_3', name: 'Năm ba' },
    { id: 'year_4_plus', name: 'Năm tư trở lên' },
    { id: 'thesis_support', name: 'Hỗ trợ làm luận văn' },
    { id: 'graduation_exam_preparation', name: 'Ôn thi tốt nghiệp' }
  ],
  language: [
    { id: 'beginner', name: 'Cơ bản' },
    { id: 'elementary', name: 'Sơ cấp' },
    { id: 'intermediate', name: 'Trung cấp' },
    { id: 'upper_intermediate', name: 'Trung cấp cao' },
    { id: 'advanced', name: 'Nâng cao' }
  ],
  it_skills: [
    { id: 'beginner', name: 'Cơ bản' },
    { id: 'intermediate', name: 'Trung cấp' },
    { id: 'advanced', name: 'Nâng cao' },
    { id: 'interview_preparation', name: 'Luyện phỏng vấn' },
    { id: 'project_mentoring', name: 'Hướng dẫn dự án' }
  ],
  soft_skills: [
  { id: 'basic', name: 'Cơ bản' },
  { id: 'advanced', name: 'Nâng cao' },
  { id: 'one_on_one_coaching', name: 'Kèm 1-1' }
  ]
};

const SUBJECT_LABELS_VI: Record<string, string> = {
  mathematics: "Toán học", vietnamese: "Tiếng Việt", english: "Tiếng Anh", informatics: "Tin học", science: "Khoa học", history_geography: "Lịch sử và Địa lý", music: "Âm nhạc", fine_arts: "Mỹ thuật",
  literature: "Ngữ văn", physics: "Vật lý", chemistry: "Hóa học", biology: "Sinh học", history: "Lịch sử", geography: "Địa lý", civic_education: "Giáo dục công dân", technology: "Công nghệ", economic_law_education: "Giáo dục kinh tế và pháp luật",
  calculus: "Giải tích", linear_algebra: "Đại số tuyến tính", probability_statistics: "Xác suất và thống kê", discrete_mathematics: "Toán rời rạc", c_cpp: "Lập trình C/C++", java: "Lập trình Java", python: "Lập trình Python", javascript: "Lập trình JavaScript", typescript: "Lập trình TypeScript", data_structures_algorithms: "Cấu trúc dữ liệu và giải thuật", database_systems: "Hệ quản trị cơ sở dữ liệu", operating_systems: "Hệ điều hành", computer_networks: "Mạng máy tính", software_engineering: "Kỹ thuật phần mềm", web_development: "Phát triển web", mobile_development: "Phát triển ứng dụng di động", accounting: "Kế toán", finance: "Tài chính", marketing: "Tiếp thị", microeconomics: "Kinh tế vi mô", macroeconomics: "Kinh tế vĩ mô", business_administration: "Quản trị kinh doanh",
  english_communication: "Giao tiếp tiếng Anh", english_grammar: "Ngữ pháp tiếng Anh", ielts: "IELTS", toeic: "TOEIC", toefl: "TOEFL", jlpt_n5: "JLPT N5", jlpt_n4: "JLPT N4", jlpt_n3: "JLPT N3", jlpt_n2: "JLPT N2", jlpt_n1: "JLPT N1", topik_i: "TOPIK I", topik_ii: "TOPIK II", hsk_1: "HSK 1", hsk_2: "HSK 2", hsk_3: "HSK 3", hsk_4: "HSK 4", hsk_5: "HSK 5", hsk_6: "HSK 6", french_communication: "Giao tiếp tiếng Pháp", delf_preparation: "Luyện thi DELF",
  html_css: "HTML/CSS", reactjs: "ReactJS", nextjs: "NextJS", angular: "Angular", vuejs: "VueJS", nodejs: "NodeJS", expressjs: "ExpressJS", nestjs: "NestJS", spring_boot: "Spring Boot", django: "Django", fastapi: "FastAPI", laravel: "Laravel", asp_net: "ASP.NET", c_sharp: "Lập trình C#", c_plus_plus: "Lập trình C++", php: "Lập trình PHP", go: "Lập trình Go", mysql: "MySQL", postgresql: "PostgreSQL", mongodb: "MongoDB", redis: "Redis", docker: "Docker", kubernetes: "Kubernetes", aws: "AWS", azure: "Azure", ci_cd: "Tự động tích hợp và triển khai (CI/CD)", git_github: "Git/GitHub", system_design: "Thiết kế hệ thống", design_patterns: "Mẫu thiết kế", figma: "Figma", ui_design: "Thiết kế giao diện", ux_design: "Thiết kế trải nghiệm người dùng",
  communication_skills: "Kỹ năng giao tiếp", presentation_skills: "Kỹ năng thuyết trình", critical_thinking: "Tư duy phản biện", teamwork: "Làm việc nhóm", time_management: "Quản lý thời gian", leadership: "Kỹ năng lãnh đạo", problem_solving: "Giải quyết vấn đề", cv_writing: "Viết CV", interview_preparation: "Luyện phỏng vấn", career_orientation: "Định hướng nghề nghiệp"
};

export const subjectLabelVi = (subject: CatalogOption | string) => {
  const id = typeof subject === "string" ? subject : subject.id;
  return SUBJECT_LABELS_VI[id] || (typeof subject === "string" ? subject : subject.name);
};

export const levelLabelVi = (level: string) => {
  for (const levels of Object.values(LEVELS_BY_GROUP)) {
    const match = levels.find(item => item.id === level);
    if (match) return match.name;
  }
  return level;
};

export const levelGroupLabelVi = (group: string) =>
  LEVEL_GROUPS.find(item => item.id === group)?.name || group;

export const newClientId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

export const createSubject = (): TutorTeachingSubject => ({
  clientId: newClientId(), levelGroupId: '', subjectId: '', teachingLevelIds: [],
  yearsOfExperience: 0, minPrice: 0, maxPrice: 0, priceUnit: 'per_hour',
  durationDays: null, sessionsPerPeriod: 1, minutesPerSession: 60, evidences: [], bio: '', experience: ''
});
