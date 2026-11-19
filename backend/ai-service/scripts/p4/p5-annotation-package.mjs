import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankingQueries, DATASET_VERSION, SNAPSHOT_VERSION } from './dataset-v1.mjs';
import { candidateScopeKey, canonicalCandidateSnapshot } from './candidate-snapshot.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(process.env.P5_ANNOTATION_OUTPUT_DIR || here);
const manifest = JSON.parse(await import('node:fs/promises').then(({ readFile }) =>
  readFile(new URL('./reproducibility-manifest-v1.json', import.meta.url), 'utf8')));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const pseudonym = id => `T-${hash(`${SNAPSHOT_VERSION}|${id}`).slice(0, 12)}`;

const sql = String.raw`
WITH public_profiles AS (
  SELECT DISTINCT tp.id AS tutor_profile_id, tp.user_id
  FROM tutor_profiles tp
  JOIN users u ON u.id = tp.user_id AND u.email_verified = true
  JOIN tutors t ON t.user_id = u.id
  JOIN tutor_applications app ON app.user_id = u.id AND app.status = 'APPROVED'
  WHERE tp.active = true
), capabilities AS (
  SELECT reg.tutor_profile_id,
         jsonb_agg(jsonb_build_object(
           'registrationId', reg.id,
           'subjectId', reg.subject_id,
           'subjectName', subject.name,
           'experienceYears', reg.experience_years,
           'tuitionMin', reg.tuition_min,
           'tuitionMax', reg.tuition_max,
           'description', reg.description,
           'levels', COALESCE((
             SELECT jsonb_agg(jsonb_build_object('levelId', level.id, 'levelName', level.name)
                              ORDER BY level.order_index, level.name)
             FROM tutor_subject_registration_levels link
             JOIN catalog_levels level ON level.id = link.level_id
             WHERE link.registration_id = reg.id
           ), '[]'::jsonb)
         ) ORDER BY reg.created_at, reg.id) AS capabilities
  FROM tutor_subject_registrations reg
  JOIN catalog_subjects subject ON subject.id = reg.subject_id
  WHERE reg.status = 'APPROVED' AND reg.tutor_profile_id IS NOT NULL
  GROUP BY reg.tutor_profile_id
), modes AS (
  SELECT auth.tutor_profile_id,
         jsonb_agg(mode.teaching_mode ORDER BY mode.teaching_mode) AS teaching_modes
  FROM tutor_authorization_states auth
  JOIN tutor_authorization_teaching_modes mode ON mode.user_id = auth.user_id
  GROUP BY auth.tutor_profile_id
), availability AS (
  SELECT reg.tutor_profile_id,
         jsonb_agg(DISTINCT jsonb_build_object(
           'dayOfWeek', slot.day_of_week, 'startTime', slot.start_time, 'endTime', slot.end_time
         )) AS slots
  FROM tutor_subject_registrations reg
  JOIN tutor_availabilities slot ON lower(slot.tutor_email) = lower(reg.tutor_email)
  WHERE reg.status = 'APPROVED' AND reg.tutor_profile_id IS NOT NULL
  GROUP BY reg.tutor_profile_id
), ratings AS (
  SELECT profile.id AS tutor_profile_id, AVG(review.rating)::double precision AS average_rating,
         COUNT(review.id)::bigint AS review_count
  FROM tutor_profiles profile
  LEFT JOIN tutor_reviews review ON review.tutor_id = profile.user_id
  GROUP BY profile.id
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'tutorProfileId', profile.tutor_profile_id,
  'teachingModes', COALESCE(modes.teaching_modes, '[]'::jsonb),
  'capabilities', COALESCE(capabilities.capabilities, '[]'::jsonb),
  'availability', COALESCE(availability.slots, '[]'::jsonb),
  'averageRating', COALESCE(ratings.average_rating, 0),
  'reviewCount', COALESCE(ratings.review_count, 0)
) ORDER BY profile.tutor_profile_id), '[]'::jsonb)
FROM public_profiles profile
LEFT JOIN capabilities ON capabilities.tutor_profile_id = profile.tutor_profile_id
LEFT JOIN modes ON modes.tutor_profile_id = profile.tutor_profile_id
LEFT JOIN availability ON availability.tutor_profile_id = profile.tutor_profile_id
LEFT JOIN ratings ON ratings.tutor_profile_id = profile.tutor_profile_id;
`;

function loadProfiles() {
  const output = execFileSync('docker', [
    'exec', 'kltn-postgres', 'psql', '-U', 'postgres', '-d', 'kltn_db', '-Atc', sql
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(output.trim());
}

function sanitizeEvidence(value) {
  if (!value) return null;
  return String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '[REDACTED_URL]')
    .replace(/(?:\+?84|0)(?:[ .-]?\d){8,10}/g, '[REDACTED_PHONE]')
    .trim() || null;
}

function scheduleMatches(requested, available) {
  return requested.every(wanted => available.some(slot =>
    Number(slot.dayOfWeek) === Number(wanted.dayOfWeek)
      && (!wanted.startTime || !wanted.endTime
        || (slot.startTime <= wanted.startTime && slot.endTime >= wanted.endTime))));
}

function budgetMatches(query, capability) {
  if (capability.tuitionMin == null || capability.tuitionMax == null) return false;
  return (query.budgetMax == null || Number(capability.tuitionMin) <= Number(query.budgetMax))
    && (query.budgetMin == null || Number(capability.tuitionMax) >= Number(query.budgetMin));
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows) {
  const columns = [
    'datasetVersion', 'snapshotVersion', 'queryId', 'studentRequest', 'subject', 'level', 'teachingMode',
    'learningGoal', 'weakTopics', 'scheduleConstraint', 'budgetConstraint', 'pseudonymousTutorId',
    'tutorSubject', 'approvedLevels', 'experienceYears', 'tuitionRange', 'tutorTeachingModes', 'availability',
    'professionalEvidence', 'hardViolation', 'label', 'evidence', 'annotatorId', 'note'
  ];
  return `\uFEFF${columns.join(',')}\n${rows.map(row => columns.map(column => csvCell(row[column])).join(',')).join('\n')}\n`;
}

const profiles = loadProfiles();
const scopes = new Map();
for (const query of rankingQueries) {
  const scope = candidateScopeKey(query);
  if (scopes.has(scope)) continue;
  const candidates = profiles.filter(profile => profile.teachingModes.includes(query.teachingMode)
    && profile.capabilities.some(capability => Number(capability.subjectId) === Number(query.groundedSubject.id)
      && capability.levels.some(level => Number(level.levelId) === Number(query.groundedLevel.id))));
  scopes.set(scope, candidates);
}

const candidateSnapshot = canonicalCandidateSnapshot(new Map([...scopes.entries()].map(([scope, candidates]) => [
  scope,
  candidates.map(candidate => ({
    pseudonymousTutorId: pseudonym(candidate.tutorProfileId),
    approved: true,
    teachingModes: [...candidate.teachingModes].sort(),
    capabilities: candidate.capabilities
      .filter(capability => Number(capability.subjectId) === Number(scope.split(':')[0])
        && capability.levels.some(level => Number(level.levelId) === Number(scope.split(':')[1])))
      .map(capability => ({
        subjectId: Number(capability.subjectId),
        levelIds: capability.levels.map(level => Number(level.levelId)).sort((a, b) => a - b),
        experienceYears: capability.experienceYears ?? null,
        tuitionMin: capability.tuitionMin == null ? null : Number(capability.tuitionMin),
        tuitionMax: capability.tuitionMax == null ? null : Number(capability.tuitionMax),
        descriptionHash: hash(capability.description || '')
      })).sort((a, b) => a.subjectId - b.subjectId),
    availability: candidate.availability.map(slot => ({
      dayOfWeek: Number(slot.dayOfWeek), startTime: slot.startTime, endTime: slot.endTime
    })).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    averageRating: Number(candidate.averageRating || 0),
    reviewCount: Number(candidate.reviewCount || 0)
  })).sort((a, b) => a.pseudonymousTutorId.localeCompare(b.pseudonymousTutorId))
])));

const candidateSnapshotHash = hash(candidateSnapshot);
const frozenSnapshotMatched = candidateSnapshotHash === manifest.candidateSnapshotHash;
const runtimeVerifiedHash = process.env.P5_RUNTIME_VERIFIED_CANDIDATE_HASH || null;
const runtimeApiVerified = frozenSnapshotMatched || runtimeVerifiedHash === candidateSnapshotHash;
const annotationSnapshotVersion = frozenSnapshotMatched ? SNAPSHOT_VERSION : 'p5-db-evidence-2026-11-13';

const tutors = new Map();
const pairs = [];
for (const query of rankingQueries) {
  const scope = candidateScopeKey(query);
  for (const profile of scopes.get(scope)) {
    const capability = profile.capabilities.find(item => Number(item.subjectId) === Number(query.groundedSubject.id)
      && item.levels.some(level => Number(level.levelId) === Number(query.groundedLevel.id)));
    const tutorId = pseudonym(profile.tutorProfileId);
    const hardViolations = [];
    if (query.scheduleMode === 'HARD' && query.preferredSchedules.length
      && !scheduleMatches(query.preferredSchedules, profile.availability)) hardViolations.push('SCHEDULE');
    if (query.budgetMode === 'HARD' && (query.budgetMin != null || query.budgetMax != null)
      && !budgetMatches(query, capability)) hardViolations.push('BUDGET');
    const tutorEvidence = {
      teachingModes: [...profile.teachingModes].sort(),
      subject: { id: Number(capability.subjectId), name: capability.subjectName },
      approvedLevels: capability.levels.map(level => ({ id: Number(level.levelId), name: level.levelName })),
      experienceYears: capability.experienceYears ?? null,
      tuitionMin: capability.tuitionMin == null ? null : Number(capability.tuitionMin),
      tuitionMax: capability.tuitionMax == null ? null : Number(capability.tuitionMax),
      professionalEvidence: sanitizeEvidence(capability.description),
      availability: profile.availability.map(slot => ({
        dayOfWeek: Number(slot.dayOfWeek), startTime: slot.startTime, endTime: slot.endTime
      })).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
      averageRating: Number(profile.averageRating || 0),
      reviewCount: Number(profile.reviewCount || 0)
    };
    const tutor = tutors.get(tutorId) || {
      pseudonymousTutorId: tutorId,
      teachingModes: tutorEvidence.teachingModes,
      availability: tutorEvidence.availability,
      averageRating: tutorEvidence.averageRating,
      reviewCount: tutorEvidence.reviewCount,
      capabilities: []
    };
    const capabilityKey = `${tutorEvidence.subject.id}|${tutorEvidence.approvedLevels.map(level => level.id).join(':')}`;
    if (!tutor.capabilities.some(item => item.capabilityKey === capabilityKey)) {
      tutor.capabilities.push({
        capabilityKey,
        subject: tutorEvidence.subject,
        approvedLevels: tutorEvidence.approvedLevels,
        experienceYears: tutorEvidence.experienceYears,
        tuitionMin: tutorEvidence.tuitionMin,
        tuitionMax: tutorEvidence.tuitionMax,
        professionalEvidence: tutorEvidence.professionalEvidence
      });
    }
    tutors.set(tutorId, tutor);
    pairs.push({ queryId: query.queryId, pseudonymousTutorId: tutorId, hardViolations, tutorEvidence });
  }
}

const packageData = {
  packageVersion: 'p5-annotation-package-v2',
  datasetVersion: DATASET_VERSION,
  snapshotVersion: annotationSnapshotVersion,
  pseudonymNamespace: SNAPSHOT_VERSION,
  datasetHash: manifest.datasetHash,
  candidateSnapshotHash,
  previousP4CandidateSnapshotHash: manifest.candidateSnapshotHash,
  previousP4SnapshotMatched: frozenSnapshotMatched,
  runtimeApiVerification: runtimeApiVerified
    ? frozenSnapshotMatched ? 'VERIFIED_AGAINST_P4_SNAPSHOT' : 'VERIFIED_AGAINST_P5_RUNTIME_API'
    : 'PENDING_RUNTIME_API_VERIFICATION',
  provenance: 'Read-only PostgreSQL export; no business data was modified',
  blindedFields: ['matchPercentage', 'structuredScore', 'semanticSimilarity', 'semanticBoost', 'B0-B4 ranks', 'matchingReasons'],
  queries: rankingQueries.map(query => ({
    queryId: query.queryId,
    request: query.naturalLanguageRequest,
    subject: query.groundedSubject,
    level: query.groundedLevel,
    teachingMode: query.teachingMode,
    scheduleMode: query.scheduleMode,
    budgetMode: query.budgetMode,
    preferredSchedules: query.preferredSchedules,
    budgetMin: query.budgetMin,
    budgetMax: query.budgetMax,
    learningGoal: query.learningGoal,
    weakTopics: query.weakTopics,
    tutorPreferences: query.tutorPreferences,
    expectedEmpty: query.expectedEmpty
  })),
  tutors: [...tutors.values()].sort((a, b) => a.pseudonymousTutorId.localeCompare(b.pseudonymousTutorId)),
  pairs: pairs.sort((a, b) => a.queryId.localeCompare(b.queryId)
    || a.pseudonymousTutorId.localeCompare(b.pseudonymousTutorId))
};

const queryById = new Map(packageData.queries.map(query => [query.queryId, query]));
const baseRows = packageData.pairs.map(pair => {
  const query = queryById.get(pair.queryId);
  const tutor = pair.tutorEvidence;
  return {
  datasetVersion: DATASET_VERSION,
  snapshotVersion: annotationSnapshotVersion,
  queryId: pair.queryId,
  studentRequest: query.request,
  subject: `${query.subject.id} - ${query.subject.name}`,
  level: `${query.level.id} - ${query.level.name}`,
  teachingMode: query.teachingMode,
  learningGoal: query.learningGoal || '',
  weakTopics: query.weakTopics.join(' | '),
  scheduleConstraint: `${query.scheduleMode}: ${query.preferredSchedules.map(slot => `${slot.dayOfWeek} ${slot.startTime}-${slot.endTime}`).join(' | ') || 'NONE'}`,
  budgetConstraint: `${query.budgetMode}: ${query.budgetMin ?? 'NONE'}-${query.budgetMax ?? 'NONE'}`,
  pseudonymousTutorId: pair.pseudonymousTutorId,
  tutorSubject: `${tutor.subject.id} - ${tutor.subject.name}`,
  approvedLevels: tutor.approvedLevels.map(level => `${level.id} - ${level.name}`).join(' | '),
  experienceYears: tutor.experienceYears ?? '',
  tuitionRange: `${tutor.tuitionMin ?? 'NONE'}-${tutor.tuitionMax ?? 'NONE'}`,
  tutorTeachingModes: tutor.teachingModes.join(' | '),
  availability: tutor.availability.map(slot => `${slot.dayOfWeek} ${slot.startTime}-${slot.endTime}`).join(' | '),
  professionalEvidence: tutor.professionalEvidence || '',
  hardViolation: pair.hardViolations.join('|') || 'NONE',
  label: '', evidence: '', annotatorId: '', note: ''
  };
});

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'annotation-package-v2.json'), `${JSON.stringify(packageData, null, 2)}\n`, 'utf8');
for (const annotatorId of ['ANNOTATOR_A', 'ANNOTATOR_B', 'ADJUDICATED']) {
  const filename = annotatorId === 'ANNOTATOR_A' ? 'annotation-labels-a-v2.csv'
    : annotatorId === 'ANNOTATOR_B' ? 'annotation-labels-b-v2.csv' : 'annotation-labels-adjudicated-v2.csv';
  await writeFile(resolve(outputDir, filename), csv(baseRows.map(row => ({ ...row, annotatorId }))), 'utf8');
}

console.log(JSON.stringify({
  status: runtimeApiVerified ? 'READY_FOR_HUMAN_ANNOTATION' : 'PENDING_RUNTIME_API_VERIFICATION',
  datasetVersion: DATASET_VERSION, snapshotVersion: annotationSnapshotVersion,
  candidateSnapshotHash, queryCount: packageData.queries.length, tutorCount: packageData.tutors.length,
  pairCount: packageData.pairs.length, hardViolationPairCount: packageData.pairs.filter(pair => pair.hardViolations.length).length,
  outputDir
}));
