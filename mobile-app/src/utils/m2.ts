import type { AiRequirement, Clarification, GroundedRequirement, TutorFilters } from '../api/m2';

export const emptyTutorFilters: TutorFilters = {
  keyword: '', programTypeId: '', educationLevelId: '', categoryId: '', subjectId: '', levelId: '',
  teachingMode: '', provinceCode: '', communeCode: '', minPrice: '', maxPrice: '', minRating: '', minExperience: '',
};

export const tutorSortOptions = [
  { value: 'name,asc', label: 'Tên A-Z' }, { value: 'rating,desc', label: 'Đánh giá cao' },
  { value: 'reviewCount,desc', label: 'Nhiều đánh giá' }, { value: 'price,asc', label: 'Mức nhận dạy thấp' },
  { value: 'experience,desc', label: 'Kinh nghiệm nhiều' },
];

export function updateTutorFilter(current: TutorFilters, name: keyof TutorFilters, value: string): TutorFilters {
  const next = { ...current, [name]: value };
  if (name === 'programTypeId') Object.assign(next, { educationLevelId: '', categoryId: '', subjectId: '', levelId: '' });
  if (name === 'educationLevelId') Object.assign(next, { categoryId: '', subjectId: '', levelId: '' });
  if (name === 'categoryId') Object.assign(next, { subjectId: '', levelId: '' });
  if (name === 'subjectId') next.levelId = '';
  if (name === 'provinceCode') next.communeCode = '';
  if (name === 'teachingMode' && value === 'ONLINE') Object.assign(next, { provinceCode: '', communeCode: '' });
  return next;
}

export function tutorSearchPath(filters: TutorFilters, page: number, sort: string): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
  params.set('page', String(page)); params.set('size', '9'); params.set('sort', sort);
  return `/api/tutors/search-v2?${params.toString()}`;
}

export function patchAiRequirement(requirement: AiRequirement, clarification: Clarification, option: { name?: string; value?: string; code?: string }): AiRequirement {
  const name = option.name || option.value || '';
  if (clarification.field === 'SUBJECT') return { ...requirement, subjectHint: name };
  if (clarification.field === 'LEVEL') return { ...requirement, levelHint: name };
  if (clarification.field === 'TEACHING_MODE') return { ...requirement, teachingMode: (option.code || option.value || name) as AiRequirement['teachingMode'] };
  if (clarification.field === 'LOCATION') return { ...requirement, locationHint: name };
  return requirement;
}

export function buildTutorMatchPayload(requirement: GroundedRequirement, optional: { learningGoal?: string; weakTopics?: string; tutorPreferences?: string } = {}) {
  const target = requirement.budget?.target ?? null;
  const list = (value?: string) => value?.split(/[,;\n]/).map(item => item.trim()).filter(Boolean).slice(0, 12) || [];
  return {
    subjectId: requirement.subject?.id, levelId: requirement.level?.id, teachingMode: requirement.teachingMode,
    budgetMin: requirement.budget?.min ?? target, budgetMax: requirement.budget?.max ?? target,
    provinceCode: requirement.teachingMode === 'OFFLINE' ? requirement.location?.provinceCode || null : null,
    communeCode: requirement.teachingMode === 'OFFLINE' ? requirement.location?.communeCode || null : null,
    preferredSchedules: (requirement.preferredSchedules || []).filter(slot => slot.dayOfWeek)
      .map(slot => ({
        dayOfWeek: Number(slot.dayOfWeek),
        startTime: slot.startTime || null,
        endTime: slot.endTime || null,
        timeOfDayHint: slot.timeOfDayHint || null,
      })),
    learningGoal: requirement.learningGoal || optional.learningGoal?.trim() || null,
    weakTopics: requirement.weakTopics?.length ? requirement.weakTopics : list(optional.weakTopics),
    tutorPreferences: requirement.tutorPreferences?.length ? requirement.tutorPreferences : list(optional.tutorPreferences),
  };
}
