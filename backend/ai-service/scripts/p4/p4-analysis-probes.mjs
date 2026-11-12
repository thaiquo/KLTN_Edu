import { analysisQueries } from './dataset-v1.mjs';

const gateway = process.env.BENCHMARK_GATEWAY_URL || 'http://localhost:8080';
const email = process.env.BENCHMARK_STUDENT_EMAIL;
const password = process.env.BENCHMARK_STUDENT_PASSWORD;
if (!email || !password) throw new Error('BENCHMARK student credentials are required');

async function request(path, body, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${gateway}${path}`, {
      method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

const token = (await request('/api/auth/mobile/login', { email, password })).accessToken;
const cases = [];
for (const query of analysisQueries) {
  try {
    const analyzed = await request('/api/ai/matching/analyze', { message: query.naturalLanguageRequest }, token);
    const grounded = analyzed.status === 'INVALID'
      ? null
      : await request('/api/ai/matching/ground', { requirement: analyzed.requirement }, token);
    cases.push({
      queryId: query.queryId,
      analysisStatus: analyzed.status,
      subjectHint: analyzed.requirement?.subjectHint ?? null,
      levelHint: analyzed.requirement?.levelHint ?? null,
      teachingMode: analyzed.requirement?.teachingMode ?? null,
      scheduleMode: analyzed.requirement?.scheduleConstraintMode ?? null,
      budgetMode: analyzed.requirement?.budgetConstraintMode ?? null,
      groundingStatus: grounded?.status ?? null,
      groundedSubject: grounded?.requirement?.subject?.name ?? null,
      groundedLevel: grounded?.requirement?.level?.name ?? null,
      blockingClarifications: (grounded?.clarifications || []).filter(item => item.blocking).map(item => item.field),
      operationalError: null
    });
  } catch (error) {
    cases.push({ queryId: query.queryId, analysisStatus: 'OPERATIONAL_ERROR', operationalError: error.name || 'Error' });
  }
}

console.log(JSON.stringify({
  queryCount: cases.length,
  operationalErrorCount: cases.filter(item => item.analysisStatus === 'OPERATIONAL_ERROR').length,
  cases
}));
