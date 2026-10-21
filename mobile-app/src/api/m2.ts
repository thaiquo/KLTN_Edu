import { api } from './client';
import { tutorSearchPath } from '../utils/m2';
export { emptyTutorFilters, tutorSortOptions, updateTutorFilter, tutorSearchPath, patchAiRequirement, buildTutorMatchPayload } from '../utils/m2';
import type { buildTutorMatchPayload } from '../utils/m2';

export interface CatalogItem { id: number; name: string; code?: string }
export interface LocationItem { code: string; name: string }
export interface TutorLevel { levelId: number; levelName: string }
export interface TutorSubject {
  registrationId?: number; subjectId: number; subjectName: string; categoryName?: string;
  levels?: TutorLevel[]; experienceYears?: number | null; tuitionMin?: number | null;
  tuitionMax?: number | null; description?: string | null;
}
export interface TutorLocation { provinceCode?: string; provinceName?: string; communeCode?: string; communeName?: string; district?: string }
export interface AvailabilitySlot { id?: number; dayOfWeek: number; startTime: string; endTime: string }
export interface TutorProfile {
  tutorId: number; userId: number; fullName: string; avatarUrl?: string | null; bio?: string | null;
  approvedOrVerified?: boolean; location?: TutorLocation | null; teachingModes?: string[];
  subjects?: TutorSubject[]; startingTuition?: number | null; availability?: AvailabilitySlot[];
  averageRating?: number | null; reviewCount?: number | null; publishedClassCount?: number | null;
  matchPercentage?: number; matchedSubject?: TutorSubject & { levelId?: number; levelName?: string };
  matchingReasons?: string[]; mismatchReasons?: string[];
  scoreBreakdown?: { criteria?: Array<{ criterion: string; label: string; contribution: number; weight: number; evidence?: string; policy?: string }> };
}
export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number; last: boolean }
export interface TutorReview { id: number; rating: number; comment?: string; createdAt?: string }

export interface TutorFilters {
  keyword: string; programTypeId: string; educationLevelId: string; categoryId: string;
  subjectId: string; levelId: string; teachingMode: string; provinceCode: string;
  communeCode: string; minPrice: string; maxPrice: string; minRating: string;
  minExperience: string;
}

export const tutorM2 = {
  search: (filters: TutorFilters, page: number, sort: string) => api.request<Page<TutorProfile>>(tutorSearchPath(filters, page, sort), { anonymous: true }),
  detail: (id: number) => api.request<TutorProfile>(`/api/tutors/${id}/detail-v2`, { anonymous: true }),
  reviews: (userId: number, page: number) => api.request<Page<TutorReview>>(`/api/learning/public/tutors/${userId}/reviews?page=${page}&size=4`, { anonymous: true }),
};

export const catalogM2 = {
  programs: () => api.request<CatalogItem[]>('/api/learning/teaching-catalog/program-types', { anonymous: true }),
  education: () => api.request<CatalogItem[]>('/api/learning/teaching-catalog/education-levels', { anonymous: true }),
  categories: (programId: string, educationId: string) => api.request<CatalogItem[]>(`/api/learning/teaching-catalog/categories?programTypeId=${programId}${educationId ? `&educationLevelId=${educationId}` : ''}`, { anonymous: true }),
  subjects: (categoryId: string) => api.request<CatalogItem[]>(`/api/learning/teaching-catalog/subjects?categoryId=${categoryId}`, { anonymous: true }),
  levels: (subjectId: string) => api.request<CatalogItem[]>(`/api/learning/teaching-catalog/levels?subjectId=${subjectId}`, { anonymous: true }),
  provinces: () => api.request<LocationItem[]>('/api/reference/provinces', { anonymous: true }),
  communes: (code: string) => api.request<LocationItem[]>(`/api/reference/provinces/${encodeURIComponent(code)}/communes`, { anonymous: true }),
};

export interface AiRequirement {
  subjectHint?: string; levelHint?: string; teachingMode?: 'ONLINE' | 'OFFLINE' | null;
  budget?: { min?: number | null; max?: number | null; target?: number | null; approximate?: boolean };
  preferredSchedules?: Array<{ dayOfWeek?: number; startTime?: string; endTime?: string; timeOfDayHint?: string }>;
  learningGoal?: string; weakTopics?: string[]; tutorPreferences?: string[]; locationHint?: string;
}
export interface GroundedRequirement extends AiRequirement {
  subject?: CatalogItem | null; level?: CatalogItem | null;
  location?: { provinceCode?: string; provinceName?: string; communeCode?: string; communeName?: string } | null;
}
export interface Clarification {
  field: string; reason: string; blocking: boolean; question?: string;
  options?: Array<{ value?: string; code?: string; id?: number; name: string }>;
  freeTextAllowed?: boolean;
}
export interface GroundingResult { status: string; coreMatchingReady: boolean; requirement: GroundedRequirement; clarifications: Clarification[] }
export interface MatchingResult {
  input: Record<string, unknown>; totalCandidates: number; eligibleCandidates: number;
  relaxedCriteria?: string[]; results: TutorProfile[];
}

export const aiTutorM2 = {
  analyze: (message: string) => api.request<{ status: string; requirement?: AiRequirement }>('/api/ai/matching/analyze', { method: 'POST', body: JSON.stringify({ message }), timeoutMs: 45000 }),
  ground: (requirement: AiRequirement) => api.request<GroundingResult>('/api/ai/matching/ground', { method: 'POST', body: JSON.stringify({ requirement }), timeoutMs: 30000 }),
  match: (payload: ReturnType<typeof buildTutorMatchPayload>) => api.request<MatchingResult>('/api/ai/matching/tutors', { method: 'POST', body: JSON.stringify(payload), timeoutMs: 45000 }),
};
