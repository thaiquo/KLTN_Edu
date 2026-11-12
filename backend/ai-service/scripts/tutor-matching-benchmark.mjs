import { createHash } from 'node:crypto';

const gateway = process.env.BENCHMARK_GATEWAY_URL || 'http://localhost:8080';
const qdrant = process.env.BENCHMARK_QDRANT_URL || 'http://localhost:6333';
const studentEmail = process.env.BENCHMARK_STUDENT_EMAIL;
const studentPassword = process.env.BENCHMARK_STUDENT_PASSWORD;
const staffEmail = process.env.BENCHMARK_STAFF_EMAIL;
const staffPassword = process.env.BENCHMARK_STAFF_PASSWORD;

if (![studentEmail, studentPassword, staffEmail, staffPassword].every(Boolean)) {
  throw new Error('Benchmark credentials must be provided through BENCHMARK_* environment variables.');
}

const scopes = [
  [1, 138, 'ONLINE'], [1, 138, 'OFFLINE'],
  [5, 9, 'ONLINE'], [5, 9, 'OFFLINE'],
  [54, 242, 'ONLINE'], [54, 242, 'OFFLINE'],
  [93, 414, 'ONLINE'], [93, 414, 'OFFLINE'],
  [8, 636, 'ONLINE'], [8, 636, 'OFFLINE']
];

async function json(url, options = {}) {
  const started = performance.now();
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${url}: ${response.status} ${text}`);
  return { body: text ? JSON.parse(text) : null, latencyMs: performance.now() - started };
}

async function login(email, password) {
  return (await json(`${gateway}/api/auth/mobile/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })).body.accessToken;
}

async function post(path, body, token) {
  return json(`${gateway}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
}

async function qdrantSnapshot() {
  const points = [];
  let offset;
  do {
    const request = { limit: 100, with_payload: true, with_vector: false };
    if (offset !== undefined) request.offset = offset;
    const page = (await json(`${qdrant}/collections/tutor_capabilities_v1/points/scroll`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request)
    })).body.result;
    points.push(...page.points);
    offset = page.next_page_offset;
  } while (offset !== null && offset !== undefined);
  const canonical = points
    .map(point => `${point.id}|${point.payload?.documentHash || ''}`)
    .sort()
    .join('\n');
  return { count: points.length, hash: createHash('sha256').update(canonical).digest('hex') };
}

function ids(items = []) {
  return items.map(item => Number(item.tutorId ?? item.tutorProfileId ?? item.id)).filter(Number.isFinite);
}

function topKOverlap(left, right, k = 5) {
  const a = new Set(left.slice(0, k));
  const b = new Set(right.slice(0, k));
  if (a.size === 0 && b.size === 0) return 1;
  return [...a].filter(value => b.has(value)).length / new Set([...a, ...b]).size;
}

function meanRankDisplacement(left, right, k = 5) {
  const candidates = [...new Set([...left.slice(0, k), ...right.slice(0, k)])];
  if (!candidates.length) return 0;
  return candidates.reduce((sum, id) => {
    const l = left.indexOf(id);
    const r = right.indexOf(id);
    return sum + Math.abs((l < 0 ? k : l) - (r < 0 ? k : r));
  }, 0) / candidates.length;
}

function rankCorrelation(left, right) {
  const common = left.filter(id => right.includes(id));
  if (common.length < 2) return common.length === left.length && common.length === right.length ? 1 : null;
  const sumSquared = common.reduce((sum, id) => {
    const difference = left.indexOf(id) - right.indexOf(id);
    return sum + difference * difference;
  }, 0);
  return 1 - (6 * sumSquared) / (common.length * (common.length * common.length - 1));
}

function withoutSpecialtyScore(result) {
  const criteria = result?.scoreBreakdown?.criteria || [];
  const retained = criteria.filter(item => item.criterion !== 'specialty');
  const retainedWeight = retained.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  if (!retainedWeight) return 0;
  const retainedContribution = retained.reduce((sum, item) => sum + Number(item.contribution || 0), 0);
  return retainedContribution * 100 / retainedWeight;
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(ratio * ordered.length) - 1];
}

function topicFor(subjectName, description) {
  const normalized = `${subjectName || ''} ${description || ''}`.toLowerCase();
  if (normalized.includes('toán')) return ['hình học', 'tư duy không gian'];
  if (normalized.includes('toeic')) return ['luyện nghe đọc', 'phản xạ làm bài'];
  if (normalized.includes('anh') || normalized.includes('ielts')) return ['giao tiếp', 'phản xạ hội thoại'];
  if (normalized.includes('java') || normalized.includes('lập trình')) return ['thiết kế phần mềm', 'xây dựng ứng dụng'];
  if (normalized.includes('lý')) return ['cơ học', 'bài toán chuyển động'];
  if (normalized.includes('hóa')) return ['phản ứng hóa học', 'bài toán chất'];
  const words = normalized.match(/[\p{L}\p{N}]+/gu) || [];
  const exact = [...new Set(words.filter(word => word.length >= 5))].slice(0, 2).join(' ');
  return [exact || 'kiến thức chuyên sâu', exact || 'giải thích dễ hiểu'];
}

function moneyBounds(result) {
  const capability = result?.matchedSubject;
  const min = Number(capability?.tuitionMin ?? result?.startingTuition ?? 200000);
  const max = Number(capability?.tuitionMax ?? min + 50000);
  return { min, max };
}

function scheduleFrom(result, conflict = false) {
  const slot = result?.availability?.[0];
  if (!slot) return [{ dayOfWeek: conflict ? 8 : 2, startTime: '19:00', endTime: '21:00' }];
  if (conflict) {
    return [{ dayOfWeek: slot.dayOfWeek === 8 ? 2 : 8, startTime: '05:00', endTime: '06:00' }];
  }
  return [{ dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime }];
}

function manualUrl(query, includeSoftFilters) {
  const params = new URLSearchParams({
    subjectId: String(query.subjectId), levelId: String(query.levelId), teachingMode: query.teachingMode,
    page: '0', size: '50'
  });
  if (includeSoftFilters && query.preferredSchedules?.length === 1) {
    const slot = query.preferredSchedules[0];
    params.set('dayOfWeek', slot.dayOfWeek);
    params.set('startTime', slot.startTime);
    params.set('endTime', slot.endTime);
  }
  if (includeSoftFilters && query.budgetMin != null) params.set('minPrice', query.budgetMin);
  if (includeSoftFilters && query.budgetMax != null) params.set('maxPrice', query.budgetMax);
  return `${gateway}/api/tutors/search-v2?${params}`;
}

const studentToken = await login(studentEmail, studentPassword);
const staffToken = await login(staffEmail, staffPassword);
const snapshotBefore = await qdrantSnapshot();
const cases = [];
const scopeSummaries = [];

for (const [subjectId, levelId, teachingMode] of scopes) {
  const scopeQuery = { subjectId, levelId, teachingMode, preferredSchedules: [], weakTopics: [], tutorPreferences: [] };
  const scopeManual = await json(manualUrl(scopeQuery, false));
  const scopeEligibleIds = ids(scopeManual.body.content);
  const probe = await post('/api/ai/matching/tutors', scopeQuery, studentToken);
  const seed = probe.body.results[0];
  if (!seed) {
    scopeSummaries.push({ subjectId, levelId, teachingMode, skipped: 'NO_ELIGIBLE_CANDIDATE' });
    continue;
  }
  const subjectName = seed.matchedSubject?.subjectName;
  const levelName = seed.matchedSubject?.levelName;
  const [exactTopic, paraphraseTopic] = topicFor(subjectName, seed.matchedSubject?.description);
  const budget = moneyBounds(seed);
  const variants = [
    { id: 'bare', schedules: [], budget: null, topic: null },
    { id: 'exact-topic', schedules: [], budget: null, topic: exactTopic },
    { id: 'paraphrase-topic', schedules: [], budget: null, topic: paraphraseTopic },
    { id: 'compatible', schedules: scheduleFrom(seed, false), budget, topic: exactTopic },
    { id: 'conflict', schedules: scheduleFrom(seed, true), budget: { min: 50000, max: 100000 }, topic: exactTopic }
  ];

  for (const variant of variants) {
    const query = {
      subjectId, levelId, teachingMode,
      budgetMin: variant.budget?.min ?? null,
      budgetMax: variant.budget?.max ?? null,
      preferredSchedules: variant.schedules,
      learningGoal: null,
      weakTopics: variant.topic ? [variant.topic] : [],
      tutorPreferences: variant.topic ? ['giảng dễ hiểu'] : []
    };
    const manual = await json(manualUrl(query, true));
    const hybrid = await post('/api/ai/matching/tutors', query, studentToken);
    const b1 = hybrid.body.results
      .map(result => ({
        id: result.tutorId, score: withoutSpecialtyScore(result),
        rating: Number(result.averageRating || 0), reviews: Number(result.reviewCount || 0)
      }))
      .sort((a, b) => b.score - a.score || b.rating - a.rating || b.reviews - a.reviews || a.id - b.id)
      .map(item => item.id);
    const b2 = hybrid.body.results
      .map(result => ({
        id: result.tutorId, score: Number(result.scoreBreakdown.rawScore),
        rating: Number(result.averageRating || 0), reviews: Number(result.reviewCount || 0)
      }))
      .sort((a, b) => b.score - a.score || b.rating - a.rating || b.reviews - a.reviews || a.id - b.id)
      .map(item => item.id);
    let semantic = { body: { status: 'NO_CONTEXT', candidates: [], qdrantHitCount: 0 }, latencyMs: 0 };
    if (variant.topic) {
      semantic = await post('/api/ai/semantic/search', {
        subjectId, subjectName, levelId, levelName, teachingMode,
        learningGoal: null,
        weakTopics: [variant.topic], tutorPreferences: ['giảng dễ hiểu'], topK: 10
      }, staffToken);
    }
    const b0 = ids(manual.body.content);
    const b3 = ids(semantic.body.candidates);
    const b4 = ids(hybrid.body.results);
    const hardViolations = b4.filter(id => !scopeEligibleIds.includes(id));
    cases.push({
      caseId: `S${subjectId}-L${levelId}-${teachingMode}-${variant.id}`,
      stratum: variant.id,
      scope: { subjectId, subjectName, levelId, levelName, teachingMode },
      syntheticTopic: variant.topic,
      counts: { manualFiltered: b0.length, hardEligible: scopeEligibleIds.length, hybrid: b4.length, semanticHits: semantic.body.qdrantHitCount || 0 },
      rankings: { B0: b0.slice(0, 10), B1: b1.slice(0, 10), B2: b2.slice(0, 10), B3: b3.slice(0, 10), B4: b4.slice(0, 10) },
      semanticStatus: hybrid.body.results[0]?.scoreBreakdown?.semantic?.status || semantic.body.status,
      semanticUsed: hybrid.body.results.some(result => result.scoreBreakdown?.semantic?.used),
      top1ChangedByLexical: b1[0] !== b2[0],
      top1ChangedByBoost: b2[0] !== b4[0],
      rankOrderChangedByBoost: JSON.stringify(b2) !== JSON.stringify(b4),
      top5OverlapB2B4: topKOverlap(b2, b4),
      meanRankDisplacementB2B4: meanRankDisplacement(b2, b4),
      hardViolations,
      latencyMs: { manual: manual.latencyMs, hybrid: hybrid.latencyMs, semantic: semantic.latencyMs },
      explanationsConsistent: hybrid.body.results.every(result =>
        Array.isArray(result.matchingReasons) && Array.isArray(result.mismatchReasons))
    });
  }
  scopeSummaries.push({ subjectId, subjectName, levelId, levelName, teachingMode, eligible: scopeEligibleIds.length });
}

const snapshotAfter = await qdrantSnapshot();
const semanticCases = cases.filter(item => item.stratum !== 'bare');
const paraphrasePairs = scopeSummaries.filter(item => !item.skipped).map(scope => {
  const prefix = `S${scope.subjectId}-L${scope.levelId}-${scope.teachingMode}`;
  const exact = cases.find(item => item.caseId === `${prefix}-exact-topic`);
  const paraphrase = cases.find(item => item.caseId === `${prefix}-paraphrase-topic`);
  return {
    overlap: topKOverlap(exact?.rankings.B4 || [], paraphrase?.rankings.B4 || []),
    top1Same: exact?.rankings.B4?.[0] === paraphrase?.rankings.B4?.[0],
    orderSame: JSON.stringify(exact?.rankings.B4 || []) === JSON.stringify(paraphrase?.rankings.B4 || []),
    rankCorrelation: rankCorrelation(exact?.rankings.B4 || [], paraphrase?.rankings.B4 || [])
  };
});

const summary = {
  manifest: {
    branch: process.env.BENCHMARK_BRANCH || null,
    head: process.env.BENCHMARK_HEAD || null,
    embeddingModel: 'gemini-embedding-2', vectorDimensions: 768,
    qdrantCollection: 'tutor_capabilities_v1', maxSemanticRankBoost: 3,
    queryCount: cases.length, scopeCount: scopeSummaries.filter(item => !item.skipped).length,
    syntheticQueries: true, relevanceLabels: 'RULE_DERIVED_HARD_ELIGIBILITY_ONLY'
  },
  dataSnapshot: { before: snapshotBefore, after: snapshotAfter, unchanged: JSON.stringify(snapshotBefore) === JSON.stringify(snapshotAfter) },
  scopes: scopeSummaries,
  metrics: {
    hardConstraintViolationRate: cases.length ? cases.flatMap(item => item.hardViolations).length / cases.reduce((sum, item) => sum + item.rankings.B4.length, 0) : null,
    emptyResultRate: cases.filter(item => item.rankings.B4.length === 0).length / Math.max(cases.length, 1),
    semanticUtilizationRate: semanticCases.filter(item => item.semanticUsed).length / Math.max(semanticCases.length, 1),
    top1RankChangeRateB1toB2: semanticCases.filter(item => item.top1ChangedByLexical).length / Math.max(semanticCases.length, 1),
    top1RankChangeRateB2toB4: semanticCases.filter(item => item.top1ChangedByBoost).length / Math.max(semanticCases.length, 1),
    rankOrderChangeRateB2toB4: semanticCases.filter(item => item.rankOrderChangedByBoost).length / Math.max(semanticCases.length, 1),
    meanRankDisplacementB2B4: semanticCases.reduce((sum, item) => sum + item.meanRankDisplacementB2B4, 0) / Math.max(semanticCases.length, 1),
    top1AgreementRateB3B4: semanticCases.filter(item => item.rankings.B3[0] === item.rankings.B4[0]).length / Math.max(semanticCases.length, 1),
    meanTop5OverlapB2B4: semanticCases.reduce((sum, item) => sum + item.top5OverlapB2B4, 0) / Math.max(semanticCases.length, 1),
    meanParaphraseTop5Overlap: paraphrasePairs.reduce((sum, item) => sum + item.overlap, 0) / Math.max(paraphrasePairs.length, 1),
    paraphraseTop1AgreementRate: paraphrasePairs.filter(item => item.top1Same).length / Math.max(paraphrasePairs.length, 1),
    paraphraseFullOrderAgreementRate: paraphrasePairs.filter(item => item.orderSame).length / Math.max(paraphrasePairs.length, 1),
    meanParaphraseRankCorrelation: paraphrasePairs
      .filter(item => item.rankCorrelation != null)
      .reduce((sum, item, _, values) => sum + item.rankCorrelation / Math.max(values.length, 1), 0),
    fallbackCounts: Object.fromEntries(Object.entries(Object.groupBy(cases, item => item.semanticStatus))
      .map(([status, items]) => [status, items.length])),
    hybridLatencyP50Ms: percentile(cases.map(item => item.latencyMs.hybrid), 0.5),
    hybridLatencyP95Ms: percentile(cases.map(item => item.latencyMs.hybrid), 0.95),
    semanticLatencyP50Ms: percentile(semanticCases.map(item => item.latencyMs.semantic), 0.5),
    semanticLatencyP95Ms: percentile(semanticCases.map(item => item.latencyMs.semantic), 0.95),
    explanationStructureRate: cases.filter(item => item.explanationsConsistent).length / Math.max(cases.length, 1)
  },
  strata: Object.fromEntries(Object.entries(Object.groupBy(cases, item => item.stratum)).map(([name, items]) => [name, {
    count: items.length,
    meanManualFilteredCandidates: items.reduce((sum, item) => sum + item.counts.manualFiltered, 0) / items.length,
    meanHybridCandidates: items.reduce((sum, item) => sum + item.counts.hybrid, 0) / items.length,
    top1ChangedByBoost: items.filter(item => item.top1ChangedByBoost).length
  }])),
  evidenceCases: cases.filter(item => item.top1ChangedByBoost || item.stratum === 'conflict'),
  ...(process.env.BENCHMARK_DETAIL === 'true' ? { cases } : {})
};

console.log(JSON.stringify(summary));
