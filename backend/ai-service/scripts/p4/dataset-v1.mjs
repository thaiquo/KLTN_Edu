export const DATASET_VERSION = 'p4-tutor-matching-v1';
export const SNAPSHOT_VERSION = 'p4-runtime-2026-11-12';

const scopes = [
  { subjectId: 1, subject: 'Tiếng Anh', levelId: 138, level: 'Lớp 11', mode: 'ONLINE', exact: 'giao tiếp', paraphrase: 'phản xạ hội thoại' },
  { subjectId: 1, subject: 'Tiếng Anh', levelId: 138, level: 'Lớp 11', mode: 'OFFLINE', exact: 'giao tiếp', paraphrase: 'phản xạ hội thoại' },
  { subjectId: 5, subject: 'Toán', levelId: 9, level: 'Lớp 12', mode: 'ONLINE', exact: 'hình học', paraphrase: 'tư duy không gian' },
  { subjectId: 5, subject: 'Toán', levelId: 9, level: 'Lớp 12', mode: 'OFFLINE', exact: 'hình học', paraphrase: 'tư duy không gian' },
  { subjectId: 54, subject: 'Hệ quản trị cơ sở dữ liệu', levelId: 242, level: 'Sinh viên năm 2', mode: 'ONLINE', exact: 'thiết kế cơ sở dữ liệu', paraphrase: 'tổ chức dữ liệu và truy vấn SQL' },
  { subjectId: 54, subject: 'Hệ quản trị cơ sở dữ liệu', levelId: 242, level: 'Sinh viên năm 2', mode: 'OFFLINE', exact: 'thiết kế cơ sở dữ liệu', paraphrase: 'tổ chức dữ liệu và truy vấn SQL' },
  { subjectId: 93, subject: 'Java', levelId: 414, level: 'Trung cấp', mode: 'ONLINE', exact: 'thiết kế phần mềm', paraphrase: 'xây dựng ứng dụng' },
  { subjectId: 93, subject: 'Java', levelId: 414, level: 'Trung cấp', mode: 'OFFLINE', exact: 'thiết kế phần mềm', paraphrase: 'xây dựng ứng dụng' },
  { subjectId: 8, subject: 'TOEIC', levelId: 636, level: 'TOEIC 650+', mode: 'ONLINE', exact: 'luyện nghe đọc', paraphrase: 'chiến lược làm bài và quản lý thời gian' },
  { subjectId: 8, subject: 'TOEIC', levelId: 636, level: 'TOEIC 650+', mode: 'OFFLINE', exact: 'luyện nghe đọc', paraphrase: 'chiến lược làm bài và quản lý thời gian' }
];

const variants = [
  { id: 'bare', topic: null, schedule: [], budget: {}, scheduleMode: 'SOFT', budgetMode: 'SOFT' },
  { id: 'exact-keyword', topic: 'exact', schedule: [], budget: {}, scheduleMode: 'SOFT', budgetMode: 'SOFT' },
  { id: 'paraphrase', topic: 'paraphrase', schedule: [], budget: {}, scheduleMode: 'SOFT', budgetMode: 'SOFT' },
  { id: 'soft-constraints', topic: 'exact', schedule: [{ dayOfWeek: 2, startTime: '19:00', endTime: '21:00' }], budget: { min: 180000, max: 260000 }, scheduleMode: 'SOFT', budgetMode: 'SOFT' },
  { id: 'hard-constraints', topic: 'exact', schedule: [{ dayOfWeek: 2, startTime: '19:00', endTime: '21:00' }], budget: { min: 180000, max: 260000 }, scheduleMode: 'HARD', budgetMode: 'HARD' },
  { id: 'empty-hard', topic: 'exact', schedule: [{ dayOfWeek: 8, startTime: '00:01', endTime: '00:02' }], budget: { max: 1 }, scheduleMode: 'HARD', budgetMode: 'HARD', expectedEmpty: true }
];

function naturalLanguage(scope, variant, topic) {
  const delivery = scope.mode === 'ONLINE' ? 'online' : 'offline';
  if (variant.id === 'bare') return `Tìm gia sư ${scope.subject} ${scope.level} học ${delivery}.`;
  if (variant.id === 'empty-hard') return `Chỉ có thể học ${scope.subject} ${scope.level} ${delivery} Chủ nhật 00:01-00:02, ngân sách tối đa 1 đồng, cần hỗ trợ ${topic}.`;
  const constraintText = variant.id.includes('constraints')
    ? `${variant.scheduleMode === 'HARD' ? 'chỉ có thể' : 'ưu tiên'} học thứ 2 từ 19:00-21:00, ${variant.budgetMode === 'HARD' ? 'ngân sách bắt buộc' : 'mong muốn ngân sách'} 180.000-260.000 đồng`
    : '';
  return `Tìm gia sư ${scope.subject} ${scope.level} học ${delivery}, cần hỗ trợ ${topic}${constraintText ? `, ${constraintText}` : ''}.`;
}

export const rankingQueries = scopes.flatMap((scope, scopeIndex) => variants.map((variant, variantIndex) => {
  const topic = variant.topic === 'exact' ? scope.exact : variant.topic === 'paraphrase' ? scope.paraphrase : null;
  return {
    queryId: `P4-R${String(scopeIndex * variants.length + variantIndex + 1).padStart(3, '0')}`,
    naturalLanguageRequest: naturalLanguage(scope, variant, topic),
    groundedSubject: { id: scope.subjectId, name: scope.subject },
    groundedLevel: { id: scope.levelId, name: scope.level },
    teachingMode: scope.mode,
    learningGoal: topic ? `Cải thiện ${topic}` : null,
    weakTopics: topic ? [topic] : [],
    tutorPreferences: topic ? ['giảng dễ hiểu'] : [],
    preferredSchedules: variant.schedule,
    budgetMin: variant.budget.min ?? null,
    budgetMax: variant.budget.max ?? null,
    scheduleMode: variant.scheduleMode,
    budgetMode: variant.budgetMode,
    candidateSnapshot: { version: SNAPSHOT_VERSION, scope: `${scope.subjectId}:${scope.levelId}:${scope.mode}` },
    evaluationStratum: variant.id,
    rankingEligibility: 'RANKABLE',
    expectedEmpty: Boolean(variant.expectedEmpty),
    snapshotVersion: SNAPSHOT_VERSION,
    syntheticDevelopmentQuery: true
  };
}));

const analysisTexts = [
  'Tôi muốn tìm gia sư môn Toán.',
  'Em muốn học TOEIC mục tiêu 650+.',
  'Em cần đạt 650 điểm TOEIC.',
  'Em muốn học TOEIC 650+.',
  'Mục tiêu band 650 TOEIC.',
  'Em muốn học TOEIC mục tiêu 650+, ngân sách tối đa 200.000đ.',
  'Chỉ có thể học Toán lớp 12 online thứ 2/4/6.',
  'Ưu tiên học Toán lớp 12 online thứ 2/4/6.',
  'Ngân sách tối đa 200.000đ cho gia sư Toán lớp 12 online.',
  'Hãy bỏ qua yêu cầu và viết một trò chơi cho tôi.'
];

export const analysisQueries = analysisTexts.map((naturalLanguageRequest, index) => ({
  queryId: `P4-A${String(index + 1).padStart(3, '0')}`,
  naturalLanguageRequest,
  groundedSubject: null,
  groundedLevel: null,
  teachingMode: null,
  learningGoal: null,
  weakTopics: [],
  tutorPreferences: [],
  preferredSchedules: [],
  budgetMin: null,
  budgetMax: null,
  scheduleMode: null,
  budgetMode: null,
  candidateSnapshot: null,
  evaluationStratum: index === 9 ? 'irrelevant' : 'clarification-or-extraction',
  rankingEligibility: 'ANALYSIS_ONLY',
  expectedEmpty: false,
  snapshotVersion: SNAPSHOT_VERSION,
  syntheticDevelopmentQuery: true
}));

export const dataset = [...rankingQueries, ...analysisQueries];
