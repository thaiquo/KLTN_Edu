import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dataset, rankingQueries, analysisQueries, DATASET_VERSION, SNAPSHOT_VERSION } from './dataset-v1.mjs';
import { jaccardAtK, mean } from './p4-metrics.mjs';
import {
  candidatePseudonym, candidateScopeKey, canonicalCandidateSnapshot, normalizeCandidate
} from './candidate-snapshot.mjs';

const gateway = process.env.BENCHMARK_GATEWAY_URL || 'http://localhost:8080';
const qdrant = process.env.BENCHMARK_QDRANT_URL || 'http://localhost:6333';
const studentEmail = process.env.BENCHMARK_STUDENT_EMAIL;
const studentPassword = process.env.BENCHMARK_STUDENT_PASSWORD;
const staffEmail = process.env.BENCHMARK_STAFF_EMAIL;
const staffPassword = process.env.BENCHMARK_STAFF_PASSWORD;
if (![studentEmail, studentPassword, staffEmail, staffPassword].every(Boolean)) throw new Error('BENCHMARK student/staff credentials are required');

const manifest = JSON.parse(await readFile(new URL('./reproducibility-manifest-v1.json', import.meta.url), 'utf8'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const pseudonym = id => candidatePseudonym(id, SNAPSHOT_VERSION);

async function http(url, options = {}) {
  const started = performance.now();
  const controller = new AbortController();
  const timeoutMs = Number(process.env.P4_HTTP_TIMEOUT_MS || 60000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new Error(`${options.method || 'GET'} ${url}: HTTP ${response.status}`);
    return { body: text ? JSON.parse(text) : null, latencyMs: performance.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

async function login(email, password) {
  return (await http(`${gateway}/api/auth/mobile/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password })
  })).body.accessToken;
}

const post = (path, body, token) => http(`${gateway}${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body)
});

async function qdrantSnapshot() {
  const points = [];
  let offset;
  do {
    const request = { limit: 100, with_payload: true, with_vector: false };
    if (offset !== undefined) request.offset = offset;
    const page = (await http(`${qdrant}/collections/${manifest.qdrant.collection}/points/scroll`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request)
    })).body.result;
    points.push(...page.points);
    offset = page.next_page_offset;
  } while (offset !== null && offset !== undefined);
  const canonical = points.map(point => `${point.id}|${point.payload?.documentHash || ''}`).sort().join('\n');
  return { count: points.length, hash: hash(canonical) };
}

function requestBody(query) {
  return {
    subjectId: query.groundedSubject.id, levelId: query.groundedLevel.id, teachingMode: query.teachingMode,
    budgetMin: query.budgetMin, budgetMax: query.budgetMax, provinceCode: null, communeCode: null,
    preferredSchedules: query.preferredSchedules, learningGoal: query.learningGoal,
    weakTopics: query.weakTopics, tutorPreferences: query.tutorPreferences,
    scheduleConstraintMode: query.scheduleMode, budgetConstraintMode: query.budgetMode
  };
}

function manualUrl(query) {
  const params = new URLSearchParams({
    subjectId: query.groundedSubject.id, levelId: query.groundedLevel.id,
    teachingMode: query.teachingMode, page: 0, size: 50, sort: 'fullName,asc'
  });
  return `${gateway}/api/tutors/search-v2?${params}`;
}

function stableComparator(score) {
  return (left, right) => score(right) - score(left)
    || Number(right.averageRating || 0) - Number(left.averageRating || 0)
    || Number(right.reviewCount || 0) - Number(left.reviewCount || 0)
    || pseudonym(left.tutorId).localeCompare(pseudonym(right.tutorId));
}

function scoreWithoutSpecialty(result) {
  const retained = (result.scoreBreakdown?.criteria || []).filter(item => item.criterion !== 'specialty');
  const weight = retained.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  return weight ? retained.reduce((sum, item) => sum + Number(item.contribution || 0), 0) * 100 / weight : 0;
}

function scheduleMatches(requested, available) {
  return requested.every(wanted => available.some(slot => {
    if (Number(slot.dayOfWeek) !== Number(wanted.dayOfWeek)) return false;
    if (!wanted.startTime || !wanted.endTime) return true;
    return slot.startTime <= wanted.startTime && slot.endTime >= wanted.endTime;
  }));
}

function budgetMatches(query, result) {
  const capability = result.matchedSubject;
  if (capability?.tuitionMin == null || capability?.tuitionMax == null) return false;
  return (query.budgetMax == null || Number(capability.tuitionMin) <= Number(query.budgetMax))
    && (query.budgetMin == null || Number(capability.tuitionMax) >= Number(query.budgetMin));
}

function hardViolations(query, result) {
  const violations = [];
  if (query.scheduleMode === 'HARD' && query.preferredSchedules.length && !scheduleMatches(query.preferredSchedules, result.availability || [])) violations.push('SCHEDULE');
  if (query.budgetMode === 'HARD' && (query.budgetMin != null || query.budgetMax != null) && !budgetMatches(query, result)) violations.push('BUDGET');
  return violations;
}

function percentile(values, ratio) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  return ordered.length ? ordered[Math.max(0, Math.ceil(ratio * ordered.length) - 1)] : null;
}

const studentToken = await login(studentEmail, studentPassword);
const staffToken = await login(staffEmail, staffPassword);
const qdrantBefore = await qdrantSnapshot();
if (qdrantBefore.count !== manifest.qdrant.expectedPointCount || qdrantBefore.hash !== manifest.qdrant.expectedHash) {
  throw new Error(`Qdrant snapshot mismatch: ${qdrantBefore.count}/${qdrantBefore.hash}`);
}

const coreByScope = new Map();
for (const query of rankingQueries) {
  const key = candidateScopeKey(query);
  if (!coreByScope.has(key)) coreByScope.set(key, await http(manualUrl(query)));
}
const candidateSnapshot = canonicalCandidateSnapshot(new Map([...coreByScope.entries()].map(([scope, response]) => [
  scope,
  (response.body.content || []).map(candidate => normalizeCandidate(candidate, SNAPSHOT_VERSION))
    .sort((a, b) => a.pseudonymousTutorId.localeCompare(b.pseudonymousTutorId))
])));
const candidateSnapshotHash = hash(candidateSnapshot);
const expectedCandidateSnapshotHash = process.env.P4_EXPECTED_CANDIDATE_SNAPSHOT_HASH || manifest.candidateSnapshotHash;
if (expectedCandidateSnapshotHash && expectedCandidateSnapshotHash !== candidateSnapshotHash) {
  throw new Error(`Candidate snapshot differs from expected hash: ${candidateSnapshotHash}`);
}

const cases = [];
for (const query of rankingQueries) {
  const key = candidateScopeKey(query);
  const manual = coreByScope.get(key);
  const hybrid = await post('/api/ai/matching/tutors', requestBody(query), studentToken);
  const eligibleRaw = hybrid.body.results || [];
  const eligible = new Set(eligibleRaw.map(item => pseudonym(item.tutorId)));
  const B0 = (manual.body.content || []).map(item => pseudonym(item.tutorId ?? item.tutorProfileId)).filter(id => eligible.has(id));
  const B1 = [...eligibleRaw].sort(stableComparator(scoreWithoutSpecialty)).map(item => pseudonym(item.tutorId));
  const B2 = [...eligibleRaw].sort(stableComparator(item => Number(item.scoreBreakdown?.rawScore || 0))).map(item => pseudonym(item.tutorId));
  let semantic = { body: { status: 'NO_CONTEXT', candidates: [], qdrantHitCount: 0 }, latencyMs: 0 };
  if (query.learningGoal || query.weakTopics.length || query.tutorPreferences.length) {
    semantic = await post('/api/ai/semantic/search', {
      subjectId: query.groundedSubject.id, subjectName: query.groundedSubject.name,
      levelId: query.groundedLevel.id, levelName: query.groundedLevel.name,
      teachingMode: query.teachingMode, learningGoal: query.learningGoal,
      weakTopics: query.weakTopics, tutorPreferences: query.tutorPreferences, topK: 10
    }, staffToken);
  }
  const B3 = (semantic.body.candidates || []).map(item => pseudonym(item.tutorId)).filter(id => eligible.has(id));
  const B4 = eligibleRaw.map(item => pseudonym(item.tutorId));
  const violations = eligibleRaw.flatMap(result => hardViolations(query, result));
  const semanticUsed = eligibleRaw.some(result => result.scoreBreakdown?.semantic?.used);
  const semanticReasonConsistent = eligibleRaw.every(result => {
    const used = result.scoreBreakdown?.semantic?.used === true;
    const mentions = (result.matchingReasons || []).some(reason => /ngữ nghĩa|Qdrant/i.test(reason));
    return used === mentions;
  });
  cases.push({
    queryId: query.queryId, stratum: query.evaluationStratum || query.queryId,
    variant: query.queryId, scope: key, expectedEmpty: Boolean(query.expectedEmpty),
    counts: { core: manual.body.totalElements ?? manual.body.content?.length ?? 0, eligible: eligibleRaw.length, semanticHits: semantic.body.qdrantHitCount || 0 },
    rankings: { B0: B0.slice(0, 10), B1: B1.slice(0, 10), B2: B2.slice(0, 10), B3: B3.slice(0, 10), B4: B4.slice(0, 10) },
    hardViolations: violations,
    semantic: { status: eligibleRaw[0]?.scoreBreakdown?.semantic?.status || semantic.body.status, used: semanticUsed },
    explanations: { arraysPresent: eligibleRaw.every(result => Array.isArray(result.matchingReasons) && Array.isArray(result.mismatchReasons)), semanticReasonConsistent },
    latencyMs: { manual: manual.latencyMs, hybrid: hybrid.latencyMs, semantic: semantic.latencyMs }
  });
}

const analysisCases = {
  status: 'SEPARATE_BOUNDED_PROBE',
  runner: 'p4-analysis-probes.mjs',
  queryCount: analysisQueries.length
};

const qdrantAfter = await qdrantSnapshot();
const qdrantUnchanged = JSON.stringify(qdrantBefore) === JSON.stringify(qdrantAfter);
if (!qdrantUnchanged) throw new Error('Qdrant changed during evaluation; results are not comparable');
const semanticCases = cases.filter(item => item.semantic.status !== 'NO_CONTEXT');
const semanticOpportunityCases = semanticCases.filter(item => item.counts.eligible > 0);
const comparableB1B2 = cases.filter(item => item.rankings.B1.length && item.rankings.B2.length);
const comparableB2B4 = semanticOpportunityCases.filter(item => item.rankings.B2.length && item.rankings.B4.length);
const comparableB3B4 = semanticOpportunityCases.filter(item => item.rankings.B3.length && item.rankings.B4.length);
const paraphrasePairs = [];
for (let index = 0; index < cases.length; index += 6) {
  const exact = cases[index + 1];
  const paraphrase = cases[index + 2];
  paraphrasePairs.push({ top1Same: exact.rankings.B4[0] === paraphrase.rankings.B4[0], overlap: jaccardAtK(exact.rankings.B4, paraphrase.rankings.B4, 5) });
}
const allReturned = cases.reduce((sum, item) => sum + item.rankings.B4.length, 0);
const baselineNames = ['B0', 'B1', 'B2', 'B3', 'B4'];
const baselineEvidence = Object.fromEntries(baselineNames.map(name => [name, {
  meanReturnedCandidates: mean(cases.map(item => item.rankings[name].length)),
  emptyQueries: cases.filter(item => item.rankings[name].length === 0).length,
  top10CoverageAgainstEligible: mean(cases.map(item => item.counts.eligible
    ? item.rankings[name].length / Math.min(10, item.counts.eligible)
    : 1))
}]));
const strata = Object.fromEntries(Object.entries(Object.groupBy(cases, item => item.stratum)).map(([name, items]) => {
  const opportunities = items.filter(item => item.counts.eligible > 0 && item.semantic.status !== 'NO_CONTEXT');
  const comparable = opportunities.filter(item => item.rankings.B2.length && item.rankings.B4.length);
  return [name, {
  queryCount: items.length,
  meanCoreCandidates: mean(items.map(item => item.counts.core)),
  meanEligibleCandidates: mean(items.map(item => item.counts.eligible)),
  emptyResultRate: items.filter(item => item.rankings.B4.length === 0).length / items.length,
  hardViolationCount: items.flatMap(item => item.hardViolations).length,
  semanticUtilizationRate: opportunities.length ? opportunities.filter(item => item.semantic.used).length / opportunities.length : null,
  top1ChangeRateB2B4: comparable.length ? comparable.filter(item => item.rankings.B2[0] !== item.rankings.B4[0]).length / comparable.length : null,
  hybridLatencyP50Ms: percentile(items.map(item => item.latencyMs.hybrid), 0.50),
  hybridLatencyP95Ms: percentile(items.map(item => item.latencyMs.hybrid), 0.95)
  }];
}));
const result = {
  manifest: {
    datasetVersion: DATASET_VERSION, snapshotVersion: SNAPSHOT_VERSION,
    branch: process.env.BENCHMARK_BRANCH || manifest.branch,
    head: process.env.BENCHMARK_HEAD || manifest.head,
    datasetHash: hash(dataset), candidateSnapshotHash,
    queryCount: dataset.length, rankableQueryCount: rankingQueries.length, analysisOnlyQueryCount: analysisQueries.length,
    independentLabels: 'WAITING_FOR_HUMAN_LABELS', developmentSyntheticData: true
  },
  snapshots: { qdrantBefore, qdrantAfter, qdrantUnchanged, pseudonymousTutorCount: new Set(candidateSnapshot.flatMap(scope => scope.candidates.map(item => item.pseudonymousTutorId))).size },
  baselineEvidence,
  functionalMetrics: {
    hardConstraintViolationRate: allReturned ? cases.flatMap(item => item.hardViolations).length / allReturned : null,
    candidateCoverageMean: mean(cases.map(item => item.counts.core ? item.counts.eligible / item.counts.core : 1)),
    emptyResultRate: cases.filter(item => item.rankings.B4.length === 0).length / cases.length,
    expectedEmptySuccessRate: cases.filter(item => item.expectedEmpty && item.rankings.B4.length === 0).length / cases.filter(item => item.expectedEmpty).length,
    semanticOpportunityQueryCount: semanticOpportunityCases.length,
    semanticUtilizationRate: semanticOpportunityCases.filter(item => item.semantic.used).length / semanticOpportunityCases.length,
    top1ChangeRateB1B2: comparableB1B2.filter(item => item.rankings.B1[0] !== item.rankings.B2[0]).length / comparableB1B2.length,
    top1ChangeRateB2B4: comparableB2B4.filter(item => item.rankings.B2[0] !== item.rankings.B4[0]).length / comparableB2B4.length,
    top1AgreementRateB3B4: comparableB3B4.filter(item => item.rankings.B3[0] === item.rankings.B4[0]).length / comparableB3B4.length,
    rankOrderChangeRateB2B4: comparableB2B4.filter(item => JSON.stringify(item.rankings.B2) !== JSON.stringify(item.rankings.B4)).length / comparableB2B4.length,
    meanTop5OverlapB2B4: mean(comparableB2B4.map(item => jaccardAtK(item.rankings.B2, item.rankings.B4, 5))),
    paraphraseTop1AgreementRate: paraphrasePairs.filter(item => item.top1Same).length / paraphrasePairs.length,
    meanParaphraseTop5Overlap: mean(paraphrasePairs.map(item => item.overlap)),
    explanationStructureRate: cases.filter(item => item.counts.eligible > 0 && item.explanations.arraysPresent).length / cases.filter(item => item.counts.eligible > 0).length,
    semanticExplanationConsistencyRate: semanticOpportunityCases.filter(item => item.explanations.semanticReasonConsistent).length / semanticOpportunityCases.length,
    hybridLatencyP50Ms: percentile(cases.map(item => item.latencyMs.hybrid), 0.50),
    hybridLatencyP95Ms: percentile(cases.map(item => item.latencyMs.hybrid), 0.95),
    semanticLatencyP50Ms: percentile(semanticCases.map(item => item.latencyMs.semantic), 0.50),
    semanticLatencyP95Ms: percentile(semanticCases.map(item => item.latencyMs.semantic), 0.95)
  },
  relevanceMetrics: { status: 'WAITING_FOR_HUMAN_LABELS', precisionAt5: null, precisionAt10: null, recallAt5: null, recallAt10: null, ndcgAt5: null, ndcgAt10: null, mrrAt10: null },
  strata,
  failureEvidence: {
    hardViolationQueryIds: cases.filter(item => item.hardViolations.length).map(item => item.queryId),
    expectedEmptyQueryIds: cases.filter(item => item.expectedEmpty && item.rankings.B4.length === 0).map(item => item.queryId),
    unexpectedEmptyQueryIds: cases.filter(item => !item.expectedEmpty && item.rankings.B4.length === 0).map(item => item.queryId),
    semanticContextWithoutUsedBoostQueryIds: semanticCases.filter(item => !item.semantic.used).map(item => item.queryId),
    explanationInconsistencyQueryIds: cases.filter(item => !item.explanations.arraysPresent || !item.explanations.semanticReasonConsistent).map(item => item.queryId)
  },
  analysisCases,
  rankingDigest: hash(cases.map(item => ({ queryId: item.queryId, rankings: item.rankings, counts: item.counts, semantic: item.semantic }))),
  ...(process.env.P4_DETAIL === 'true' ? { cases, annotationPool: candidateSnapshot } : {})
};
console.log(JSON.stringify(result));
