import { readFile } from 'node:fs/promises';
import { bootstrapMeanCI, mean, mrrAtK, ndcgAtK, precisionAtK, recallAtK, weightedCohenKappa } from './p4-metrics.mjs';

const runPath = process.env.P4_RUN_PATH;
const labelPath = process.env.P4_LABELS_PATH;
const annotationPackagePath = process.env.P4_ANNOTATION_PACKAGE_PATH;
if (!runPath) throw new Error('P4_RUN_PATH is required');
const run = JSON.parse(await readFile(runPath, 'utf8'));

if (!labelPath) {
  console.log(JSON.stringify({ status: 'WAITING_FOR_HUMAN_LABELS', reason: 'P4_LABELS_PATH was not provided', relevanceMetrics: null }));
  process.exit(0);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(field); field = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [rawHeader, ...data] = rows;
  const header = rawHeader.map(name => name.replace(/^\uFEFF/, ''));
  return data.map(values => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ''])));
}

const labelPaths = labelPath.split(';').map(value => value.trim()).filter(Boolean);
const labels = (await Promise.all(labelPaths.map(path => readFile(path, 'utf8')))).flatMap(parseCsv);
const required = ['queryId', 'pseudonymousTutorId', 'label', 'evidence', 'annotatorId', 'note'];
if (!labels.length || required.some(column => !(column in labels[0]))) throw new Error('Label file is empty or missing required columns');
for (const row of labels) {
  if (!['0', '1', '2'].includes(String(row.label))) throw new Error(`Invalid label for ${row.queryId}`);
  if (!row.evidence.trim()) throw new Error(`Missing evidence for ${row.queryId}/${row.pseudonymousTutorId}`);
}

const groups = Map.groupBy(labels, row => `${row.queryId}|${row.pseudonymousTutorId}`);
const humanAnnotatorIds = [...new Set(labels.filter(row => row.annotatorId !== 'ADJUDICATED').map(row => row.annotatorId))].sort();
if (humanAnnotatorIds.length !== 2) throw new Error('Exactly two independent human annotator IDs are required');
for (const [key, rows] of groups) {
  const annotatorIds = rows.map(row => row.annotatorId);
  if (new Set(annotatorIds).size !== annotatorIds.length) throw new Error(`${key} contains a duplicate annotator row`);
  const humans = new Set(rows.filter(row => row.annotatorId !== 'ADJUDICATED').map(row => row.annotatorId));
  const adjudicated = rows.filter(row => row.annotatorId === 'ADJUDICATED');
  if (humans.size < 2 || adjudicated.length !== 1) throw new Error(`${key} requires >=2 independent annotators and exactly one ADJUDICATED row`);
}

const agreementPairs = [...groups.entries()].map(([key, rows]) => ({
  key,
  left: Number(rows.find(row => row.annotatorId === humanAnnotatorIds[0]).label),
  right: Number(rows.find(row => row.annotatorId === humanAnnotatorIds[1]).label)
}));
const agreement = {
  method: 'quadratic-weighted-Cohen-kappa',
  annotatorIds: humanAnnotatorIds,
  pairCount: agreementPairs.length,
  kappa: weightedCohenKappa(agreementPairs.map(pair => pair.left), agreementPairs.map(pair => pair.right)),
  disagreementCount: agreementPairs.filter(pair => pair.left !== pair.right).length,
  disagreementPairs: agreementPairs.filter(pair => pair.left !== pair.right).map(pair => pair.key)
};

if (annotationPackagePath) {
  const annotationPackage = JSON.parse(await readFile(annotationPackagePath, 'utf8'));
  if (annotationPackage.runtimeApiVerification === 'PENDING_RUNTIME_API_VERIFICATION') {
    throw new Error('Annotation package is pending runtime API verification');
  }
  if (run.manifest?.datasetVersion !== annotationPackage.datasetVersion) {
    throw new Error('Run dataset version does not match annotation package');
  }
  if (run.manifest?.candidateSnapshotHash !== annotationPackage.candidateSnapshotHash) {
    throw new Error('Run candidate snapshot does not match annotation package');
  }
  const expected = new Map(annotationPackage.pairs.map(pair => [
    `${pair.queryId}|${pair.pseudonymousTutorId}`,
    pair.hardViolations?.join('|') || 'NONE'
  ]));
  for (const [key, expectedHardViolation] of expected) {
    if (!groups.has(key)) throw new Error(`Missing labels for ${key}`);
    for (const row of groups.get(key)) {
      if (row.datasetVersion !== annotationPackage.datasetVersion) throw new Error(`Dataset version mismatch for ${key}`);
      if (row.snapshotVersion !== annotationPackage.snapshotVersion) throw new Error(`Snapshot version mismatch for ${key}`);
      if (row.hardViolation !== expectedHardViolation) throw new Error(`Hard-violation marker mismatch for ${key}`);
      if (expectedHardViolation !== 'NONE' && row.label !== '0') throw new Error(`HARD-violating pair ${key} must have label 0`);
    }
  }
  for (const key of groups.keys()) if (!expected.has(key)) throw new Error(`Unexpected query-tutor pair ${key}`);
}

const finalLabels = {};
for (const row of labels.filter(row => row.annotatorId === 'ADJUDICATED')) {
  finalLabels[row.queryId] ||= {};
  finalLabels[row.queryId][row.pseudonymousTutorId] = Number(row.label);
}

const baselines = ['B0', 'B1', 'B2', 'B3', 'B4'];
const metricNames = ['p5', 'p10', 'r5', 'r10', 'n5', 'n10', 'mrr10'];
const labeledCases = run.cases.filter(item => finalLabels[item.queryId]);
const output = {};
const perQuery = {};
for (const baseline of baselines) {
  const queryMetrics = labeledCases.map(item => {
    const ranking = item.rankings[baseline];
    const truth = finalLabels[item.queryId];
    return {
      queryId: item.queryId,
      p5: precisionAtK(ranking, truth, 5), p10: precisionAtK(ranking, truth, 10),
      r5: recallAtK(ranking, truth, 5), r10: recallAtK(ranking, truth, 10),
      n5: ndcgAtK(ranking, truth, 5), n10: ndcgAtK(ranking, truth, 10), mrr10: mrrAtK(ranking, truth, 10)
    };
  });
  perQuery[baseline] = queryMetrics;
  output[baseline] = Object.fromEntries(metricNames.map(metric => {
    const values = queryMetrics.map(item => item[metric]).filter(Number.isFinite);
    return [metric, { mean: mean(values), ci95: bootstrapMeanCI(values), sampleSize: values.length }];
  }));
}

const pairedDifferencesB4 = Object.fromEntries(baselines.filter(name => name !== 'B4').map(baseline => [baseline,
  Object.fromEntries(metricNames.map(metric => {
    const differences = perQuery.B4.map((item, index) => {
      const reference = perQuery[baseline][index];
      return Number.isFinite(item[metric]) && Number.isFinite(reference[metric]) ? item[metric] - reference[metric] : null;
    }).filter(Number.isFinite);
    return [metric, { meanDifference: mean(differences), ci95: bootstrapMeanCI(differences), sampleSize: differences.length }];
  }))
]));

const strata = Object.fromEntries(Object.entries(Object.groupBy(labeledCases, item => item.stratum || 'UNSPECIFIED')).map(([name, cases]) => {
  const metrics = cases.map(item => {
    const ranking = item.rankings.B4;
    const truth = finalLabels[item.queryId];
    return {
      p5: precisionAtK(ranking, truth, 5), r5: recallAtK(ranking, truth, 5),
      n5: ndcgAtK(ranking, truth, 5), n10: ndcgAtK(ranking, truth, 10), mrr10: mrrAtK(ranking, truth, 10)
    };
  });
  return [name, {
    queryCount: cases.length,
    metrics: Object.fromEntries(['p5', 'r5', 'n5', 'n10', 'mrr10'].map(metric => [metric, mean(metrics.map(item => item[metric]))]))
  }];
}));

const candidateCounts = Object.fromEntries(baselines.map(baseline => [baseline, {
  fewerThan5: labeledCases.filter(item => item.rankings[baseline].length < 5).length,
  fewerThan10: labeledCases.filter(item => item.rankings[baseline].length < 10).length,
  empty: labeledCases.filter(item => item.rankings[baseline].length === 0).length
}]));
console.log(JSON.stringify({
  status: 'VERIFIED_INDEPENDENT_LABELS', relevantThreshold: 1,
  gradedGain: '2^relevance-1', labeledQueries: Object.keys(finalLabels).length,
  precisionDenominator: 'fixed K; unfilled ranks are non-relevant',
  agreement, candidateCounts, metrics: output, pairedDifferencesB4, strata
}));
