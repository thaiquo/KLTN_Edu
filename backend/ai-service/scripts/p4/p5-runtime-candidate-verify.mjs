import { createHash } from 'node:crypto';
import { rankingQueries, SNAPSHOT_VERSION } from './dataset-v1.mjs';

const gateway = process.env.BENCHMARK_GATEWAY_URL || 'http://localhost:8080';
const timeoutMs = Number(process.env.P5_HTTP_TIMEOUT_MS || 15000);
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const pseudonym = id => `T-${hash(`${SNAPSHOT_VERSION}|${id}`).slice(0, 12)}`;

async function getJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`GET ${url}: HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function safeCandidate(candidate) {
  const capabilities = (candidate.subjects || []).map(capability => ({
    subjectId: capability.subjectId,
    levelIds: (capability.levels || []).map(level => level.levelId).sort((a, b) => a - b),
    experienceYears: capability.experienceYears ?? null,
    tuitionMin: capability.tuitionMin ?? null,
    tuitionMax: capability.tuitionMax ?? null,
    descriptionHash: hash(capability.description || '')
  })).sort((a, b) => a.subjectId - b.subjectId);
  return {
    pseudonymousTutorId: pseudonym(candidate.tutorId ?? candidate.tutorProfileId),
    approved: candidate.approvedOrVerified ?? null,
    teachingModes: [...(candidate.teachingModes || [])].sort(),
    capabilities,
    availability: (candidate.availability || []).map(slot => ({
      dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime
    })).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    averageRating: candidate.averageRating ?? null,
    reviewCount: candidate.reviewCount ?? null
  };
}

const scopes = new Map();
for (const query of rankingQueries) {
  const scope = `${query.groundedSubject.id}:${query.groundedLevel.id}:${query.teachingMode}`;
  if (scopes.has(scope)) continue;
  const params = new URLSearchParams({
    subjectId: query.groundedSubject.id, levelId: query.groundedLevel.id,
    teachingMode: query.teachingMode, page: 0, size: 50, sort: 'fullName,asc'
  });
  const response = await getJson(`${gateway}/api/tutors/search-v2?${params}`);
  scopes.set(scope, (response.content || []).map(safeCandidate)
    .sort((a, b) => a.pseudonymousTutorId.localeCompare(b.pseudonymousTutorId)));
}

const snapshot = [...scopes.entries()].map(([scope, candidates]) => ({ scope, candidates }))
  .sort((a, b) => a.scope.localeCompare(b.scope));
console.log(JSON.stringify({
  status: 'RUNTIME_API_VERIFIED',
  candidateSnapshotHash: hash(snapshot),
  tutorCount: new Set(snapshot.flatMap(item => item.candidates.map(candidate => candidate.pseudonymousTutorId))).size,
  scopeCounts: Object.fromEntries(snapshot.map(item => [item.scope, item.candidates.length]))
}));
