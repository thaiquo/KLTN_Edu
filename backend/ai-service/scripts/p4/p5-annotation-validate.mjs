import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(process.env.P5_ANNOTATION_PACKAGE_PATH || here, process.env.P5_ANNOTATION_PACKAGE_PATH ? '' : 'annotation-package-v2.json');
const annotationPackage = JSON.parse(await readFile(packagePath, 'utf8'));

const forbiddenKeys = new Set([
  'fullName', 'email', 'phone', 'address', 'addressDetail', 'jwt', 'cookie', 'password', 'matchPercentage',
  'structuredScore', 'semanticSimilarity', 'semanticBoost', 'matchingReasons', 'rankings'
]);
const foundForbiddenKeys = [];
function inspect(value, path = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) foundForbiddenKeys.push(`${path}.${key}`);
    inspect(child, `${path}.${key}`);
  }
}
inspect(annotationPackage);

const tutorIds = new Set(annotationPackage.tutors.map(tutor => tutor.pseudonymousTutorId));
const queryIds = new Set(annotationPackage.queries.map(query => query.queryId));
const pairKeys = annotationPackage.pairs.map(pair => `${pair.queryId}|${pair.pseudonymousTutorId}`);
const duplicatePairCount = pairKeys.length - new Set(pairKeys).size;
const unknownTutorPairs = annotationPackage.pairs.filter(pair => !tutorIds.has(pair.pseudonymousTutorId));
const unknownQueryPairs = annotationPackage.pairs.filter(pair => !queryIds.has(pair.queryId));
const missingProfessionalEvidence = annotationPackage.pairs
  .filter(pair => !pair.tutorEvidence?.professionalEvidence)
  .map(pair => `${pair.queryId}|${pair.pseudonymousTutorId}`);
const missingPairEvidence = annotationPackage.pairs.filter(pair => !pair.tutorEvidence
  || !pair.tutorEvidence.subject || !pair.tutorEvidence.approvedLevels?.length
  || pair.tutorEvidence.experienceYears == null || pair.tutorEvidence.tuitionMin == null
  || pair.tutorEvidence.tuitionMax == null || !pair.tutorEvidence.availability?.length);
const rawText = JSON.stringify(annotationPackage);
const piiPatternMatches = [
  ...rawText.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
  ...rawText.matchAll(/(?:https?:\/\/|www\.)\S+/gi)
].map(match => match[0]);

const errors = [];
if (annotationPackage.queries.length !== 60) errors.push(`Expected 60 ranking queries, got ${annotationPackage.queries.length}`);
if (duplicatePairCount) errors.push(`${duplicatePairCount} duplicate query-tutor pairs`);
if (unknownTutorPairs.length) errors.push(`${unknownTutorPairs.length} pairs reference unknown tutors`);
if (unknownQueryPairs.length) errors.push(`${unknownQueryPairs.length} pairs reference unknown queries`);
if (missingPairEvidence.length) errors.push(`${missingPairEvidence.length} pairs are missing required tutor evidence`);
if (missingProfessionalEvidence.length) errors.push(`${missingProfessionalEvidence.length} pairs are missing professional evidence`);
if (foundForbiddenKeys.length) errors.push(`Forbidden fields found: ${foundForbiddenKeys.join(', ')}`);
if (piiPatternMatches.length) errors.push('Email or URL pattern remains in the package');

const status = errors.length ? 'INVALID' : annotationPackage.runtimeApiVerification === 'PENDING_RUNTIME_API_VERIFICATION'
  ? 'STRUCTURALLY_VALID_PENDING_RUNTIME_API_VERIFICATION' : 'READY_FOR_HUMAN_ANNOTATION';
console.log(JSON.stringify({
  status,
  packageVersion: annotationPackage.packageVersion,
  datasetVersion: annotationPackage.datasetVersion,
  snapshotVersion: annotationPackage.snapshotVersion,
  queryCount: annotationPackage.queries.length,
  tutorCount: annotationPackage.tutors.length,
  pairCount: annotationPackage.pairs.length,
  duplicatePairCount,
  unknownTutorPairCount: unknownTutorPairs.length,
  unknownQueryPairCount: unknownQueryPairs.length,
  missingProfessionalEvidenceCount: missingProfessionalEvidence.length,
  missingProfessionalEvidence,
  missingPairEvidenceCount: missingPairEvidence.length,
  forbiddenFieldCount: foundForbiddenKeys.length,
  piiPatternCount: piiPatternMatches.length,
  errors
}));
if (errors.length) process.exitCode = 1;
