import { createHash } from 'node:crypto';

const hash = value => createHash('sha256')
  .update(typeof value === 'string' ? value : JSON.stringify(value))
  .digest('hex');

export function candidateScopeKey(query) {
  return `${query.groundedSubject.id}:${query.groundedLevel.id}:${query.teachingMode}`;
}

export function candidatePseudonym(id, snapshotVersion) {
  return `T-${hash(`${snapshotVersion}|${id}`).slice(0, 12)}`;
}

export function normalizeCandidate(candidate, snapshotVersion) {
  const capabilities = (candidate.subjects || []).map(capability => ({
    subjectId: capability.subjectId,
    levelIds: (capability.levels || []).map(level => level.levelId).sort((a, b) => a - b),
    experienceYears: capability.experienceYears ?? null,
    tuitionMin: capability.tuitionMin ?? null,
    tuitionMax: capability.tuitionMax ?? null,
    descriptionHash: hash(capability.description || '')
  })).sort((a, b) => a.subjectId - b.subjectId);
  return {
    pseudonymousTutorId: candidatePseudonym(candidate.tutorId ?? candidate.tutorProfileId, snapshotVersion),
    approved: candidate.approvedOrVerified ?? null,
    teachingModes: [...(candidate.teachingModes || [])].sort(),
    capabilities,
    availability: (candidate.availability || []).map(slot => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime
    })).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    averageRating: candidate.averageRating ?? null,
    reviewCount: candidate.reviewCount ?? null
  };
}

export function canonicalCandidateSnapshot(scopes) {
  return [...scopes.entries()]
    .map(([scope, candidates]) => ({ scope, candidates }))
    .sort((left, right) => left.scope.localeCompare(right.scope));
}
