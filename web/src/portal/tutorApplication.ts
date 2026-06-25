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
  originalFileName: string;
  fileType: string;
  fileSize: number;
  category?: 'image' | 'video' | 'audio' | 'file';
  verificationStatus?: ReviewStatus;
  adminNote?: string;
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
  { id: 'primary', name: 'Tiểu học (Primary)' },
  { id: 'secondary', name: 'THCS (Secondary)' },
  { id: 'high_school', name: 'THPT (High School)' },
  { id: 'university', name: 'Đại học (University)' },
  { id: 'language', name: 'Ngoại ngữ (Language)' },
  { id: 'it_skills', name: 'CNTT & Công nghệ (IT Skills)' },
  { id: 'soft_skills', name: 'Kỹ năng mềm (Soft Skills)' }
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
    id: `grade_${from + index}`, name: `Grade ${from + index}`
  }));

export const LEVELS_BY_GROUP: Record<string, CatalogOption[]> = {
  primary: grades(1, 5),
  secondary: [
    ...grades(6, 9),
    { id: 'high_school_entrance_exam_preparation', name: 'High School Entrance Exam Preparation' }
  ],
  high_school: [
    ...grades(10, 12),
    { id: 'national_high_school_exam_preparation', name: 'National High School Exam Preparation' }
  ],
  university: [
    { id: 'year_1', name: 'Year 1' },
    { id: 'year_2', name: 'Year 2' },
    { id: 'year_3', name: 'Year 3' },
    { id: 'year_4_plus', name: 'Year 4+' },
    { id: 'thesis_support', name: 'Thesis Support' },
    { id: 'graduation_exam_preparation', name: 'Graduation Exam Preparation' }
  ],
  language: [
    { id: 'beginner', name: 'Beginner' },
    { id: 'elementary', name: 'Elementary' },
    { id: 'intermediate', name: 'Intermediate' },
    { id: 'upper_intermediate', name: 'Upper Intermediate' },
    { id: 'advanced', name: 'Advanced' }
  ],
  it_skills: [
    { id: 'beginner', name: 'Beginner' },
    { id: 'intermediate', name: 'Intermediate' },
    { id: 'advanced', name: 'Advanced' },
    { id: 'interview_preparation', name: 'Interview Preparation' },
    { id: 'project_mentoring', name: 'Project Mentoring' }
  ],
  soft_skills: [
    { id: 'basic', name: 'Basic' },
    { id: 'advanced', name: 'Advanced' },
    { id: 'one_on_one_coaching', name: 'One-on-One Coaching' }
  ]
};

export const newClientId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

export const createSubject = (): TutorTeachingSubject => ({
  clientId: newClientId(), levelGroupId: '', subjectId: '', teachingLevelIds: [],
  yearsOfExperience: 0, minPrice: 0, maxPrice: 0, priceUnit: 'per_hour',
  durationDays: null, sessionsPerPeriod: 1, minutesPerSession: 60, evidences: []
});
