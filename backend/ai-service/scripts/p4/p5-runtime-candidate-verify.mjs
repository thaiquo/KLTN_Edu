import { createHash } from 'node:crypto';
import { rankingQueries, SNAPSHOT_VERSION } from './dataset-v1.mjs';
import { candidateScopeKey, canonicalCandidateSnapshot, normalizeCandidate } from './candidate-snapshot.mjs';

const gateway = process.env.BENCHMARK_GATEWAY_URL || 'http://localhost:8080';
const timeoutMs = Number(process.env.P5_HTTP_TIMEOUT_MS || 15000);
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

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

const scopes = new Map();
for (const query of rankingQueries) {
  const scope = candidateScopeKey(query);
  if (scopes.has(scope)) continue;
  const params = new URLSearchParams({
    subjectId: query.groundedSubject.id, levelId: query.groundedLevel.id,
    teachingMode: query.teachingMode, page: 0, size: 50, sort: 'fullName,asc'
  });
  const response = await getJson(`${gateway}/api/tutors/search-v2?${params}`);
  scopes.set(scope, (response.content || []).map(candidate => normalizeCandidate(candidate, SNAPSHOT_VERSION))
    .sort((a, b) => a.pseudonymousTutorId.localeCompare(b.pseudonymousTutorId)));
}

const snapshot = canonicalCandidateSnapshot(scopes);
console.log(JSON.stringify({
  status: 'RUNTIME_API_VERIFIED',
  candidateSnapshotHash: hash(snapshot),
  tutorCount: new Set(snapshot.flatMap(item => item.candidates.map(candidate => candidate.pseudonymousTutorId))).size,
  scopeCounts: Object.fromEntries(snapshot.map(item => [item.scope, item.candidates.length]))
}));
