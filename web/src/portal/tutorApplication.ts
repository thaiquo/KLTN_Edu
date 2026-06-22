export type ReviewStatus = "pending" | "approved" | "rejected";
export type ApplicationStatus = "none" | ReviewStatus;
export type PriceUnit = "per_hour" | "per_session" | "per_30_days" | "per_course";

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
  category?: "image" | "video" | "audio" | "file";
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
  updatedAt?: string;
}

export const LEVEL_GROUPS = [
  { id: "primary", name: "Primary" },
  { id: "secondary", name: "Secondary" },
  { id: "high_school", name: "High School" },
  { id: "university", name: "University" },
  { id: "language", name: "Language" },
  { id: "it_skills", name: "IT / Skills" }
];

export const SUBJECTS_BY_GROUP: Record<string, { id: string; name: string }[]> = {
  primary: [
    { id: "mathematics", name: "Mathematics" }, { id: "vietnamese", name: "Vietnamese" },
    { id: "english", name: "English" }, { id: "science", name: "Science" }
  ],
  secondary: [
    { id: "mathematics", name: "Mathematics" }, { id: "physics", name: "Physics" },
    { id: "chemistry", name: "Chemistry" }, { id: "biology", name: "Biology" },
    { id: "literature", name: "Literature" }, { id: "english", name: "English" }
  ],
  high_school: [
    { id: "mathematics", name: "Mathematics" }, { id: "physics", name: "Physics" },
    { id: "chemistry", name: "Chemistry" }, { id: "biology", name: "Biology" },
    { id: "literature", name: "Literature" }, { id: "english", name: "English" }
  ],
  university: [
    { id: "calculus", name: "Calculus" }, { id: "economics", name: "Economics" },
    { id: "accounting", name: "Accounting" }, { id: "computer_science", name: "Computer Science" }
  ],
  language: [
    { id: "ielts", name: "IELTS" }, { id: "toeic", name: "TOEIC" },
    { id: "english_communication", name: "English Communication" },
    { id: "japanese", name: "Japanese" }, { id: "korean", name: "Korean" }
  ],
  it_skills: [
    { id: "java", name: "Java" }, { id: "web_frontend", name: "Web Frontend" },
    { id: "backend", name: "Backend" }, { id: "database", name: "Database" },
    { id: "computer_science", name: "Computer Science" }
  ]
};

const grades = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => ({
    id: `grade_${from + index}`, name: `Grade ${from + index}`
  }));

export const LEVELS_BY_GROUP: Record<string, { id: string; name: string }[]> = {
  primary: grades(1, 5),
  secondary: grades(6, 9),
  high_school: grades(10, 12),
  university: [
    { id: "foundation", name: "Foundation" }, { id: "undergraduate", name: "Undergraduate" },
    { id: "postgraduate", name: "Postgraduate" }
  ],
  language: [
    { id: "beginner", name: "Beginner" }, { id: "intermediate", name: "Intermediate" },
    { id: "advanced", name: "Advanced" }, { id: "ielts_5_plus", name: "IELTS 5.0+" },
    { id: "ielts_6_5_plus", name: "IELTS 6.5+" }
  ],
  it_skills: [
    { id: "beginner", name: "Beginner" }, { id: "intermediate", name: "Intermediate" },
    { id: "advanced", name: "Advanced" }
  ]
};

export const newClientId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

export const createSubject = (): TutorTeachingSubject => ({
  clientId: newClientId(), levelGroupId: "", subjectId: "", teachingLevelIds: [],
  yearsOfExperience: 0, minPrice: 0, maxPrice: 0, priceUnit: "per_hour",
  durationDays: null, sessionsPerPeriod: 1, minutesPerSession: 60, evidences: []
});
