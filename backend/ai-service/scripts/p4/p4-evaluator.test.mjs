import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('refuses scientific relevance metrics when independent labels are absent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'educonnect-p4-'));
  try {
    const runPath = join(directory, 'run.json');
    await writeFile(runPath, JSON.stringify({ cases: [] }), 'utf8');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./p4-evaluator.mjs', import.meta.url))], {
      encoding: 'utf8',
      env: { ...process.env, P4_RUN_PATH: runPath }
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'WAITING_FOR_HUMAN_LABELS');
    assert.equal(output.relevanceMetrics, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('refuses labels from a package that has not passed runtime API verification', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'educonnect-p5-'));
  try {
    const runPath = join(directory, 'run.json');
    const packagePath = join(directory, 'package.json');
    const labelsPath = join(directory, 'labels.csv');
    await writeFile(runPath, JSON.stringify({ cases: [] }), 'utf8');
    await writeFile(packagePath, JSON.stringify({
      datasetVersion: 'v1', snapshotVersion: 's1', runtimeApiVerification: 'PENDING_RUNTIME_API_VERIFICATION', pairs: []
    }), 'utf8');
    await writeFile(labelsPath, [
      'datasetVersion,snapshotVersion,queryId,pseudonymousTutorId,hardViolation,label,evidence,annotatorId,note',
      'v1,s1,Q1,T1,NONE,1,profile evidence,ANNOTATOR_A,',
      'v1,s1,Q1,T1,NONE,1,profile evidence,ANNOTATOR_B,',
      'v1,s1,Q1,T1,NONE,1,adjudicated evidence,ADJUDICATED,'
    ].join('\n'), 'utf8');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./p4-evaluator.mjs', import.meta.url))], {
      encoding: 'utf8',
      env: {
        ...process.env, P4_RUN_PATH: runPath, P4_LABELS_PATH: labelsPath,
        P4_ANNOTATION_PACKAGE_PATH: packagePath
      }
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /pending runtime API verification/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('accepts UTF-8 BOM annotation CSV after provenance validation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'educonnect-p5-bom-'));
  try {
    const runPath = join(directory, 'run.json');
    const packagePath = join(directory, 'package.json');
    const labelsPath = join(directory, 'labels.csv');
    await writeFile(runPath, JSON.stringify({
      manifest: { datasetVersion: 'v1', candidateSnapshotHash: 'hash-1' },
      cases: [{ queryId: 'Q1', rankings: { B0: ['T1'], B1: ['T1'], B2: ['T1'], B3: ['T1'], B4: ['T1'] } }]
    }), 'utf8');
    await writeFile(packagePath, JSON.stringify({
      datasetVersion: 'v1', snapshotVersion: 's1', candidateSnapshotHash: 'hash-1',
      runtimeApiVerification: 'VERIFIED_AGAINST_P5_RUNTIME_API',
      pairs: [{ queryId: 'Q1', pseudonymousTutorId: 'T1', hardViolations: [] }]
    }), 'utf8');
    await writeFile(labelsPath, `\uFEFFdatasetVersion,snapshotVersion,queryId,pseudonymousTutorId,hardViolation,label,evidence,annotatorId,note\n${[
      'v1,s1,Q1,T1,NONE,2,independent evidence,ANNOTATOR_A,',
      'v1,s1,Q1,T1,NONE,2,independent evidence,ANNOTATOR_B,',
      'v1,s1,Q1,T1,NONE,2,adjudicated evidence,ADJUDICATED,'
    ].join('\n')}\n`, 'utf8');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./p4-evaluator.mjs', import.meta.url))], {
      encoding: 'utf8',
      env: {
        ...process.env, P4_RUN_PATH: runPath, P4_LABELS_PATH: labelsPath,
        P4_ANNOTATION_PACKAGE_PATH: packagePath
      }
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'VERIFIED_INDEPENDENT_LABELS');
    assert.equal(output.agreement.kappa, 1);
    assert.equal(output.metrics.B4.n5.mean, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects nonzero labels for HARD-violating pairs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'educonnect-p5-hard-'));
  try {
    const runPath = join(directory, 'run.json');
    const packagePath = join(directory, 'package.json');
    const labelsPath = join(directory, 'labels.csv');
    await writeFile(runPath, JSON.stringify({
      manifest: { datasetVersion: 'v1', candidateSnapshotHash: 'hash-1' }, cases: []
    }), 'utf8');
    await writeFile(packagePath, JSON.stringify({
      datasetVersion: 'v1', snapshotVersion: 's1', candidateSnapshotHash: 'hash-1',
      runtimeApiVerification: 'VERIFIED_AGAINST_P5_RUNTIME_API',
      pairs: [{ queryId: 'Q1', pseudonymousTutorId: 'T1', hardViolations: ['SCHEDULE'] }]
    }), 'utf8');
    await writeFile(labelsPath, [
      'datasetVersion,snapshotVersion,queryId,pseudonymousTutorId,hardViolation,label,evidence,annotatorId,note',
      'v1,s1,Q1,T1,SCHEDULE,1,violates schedule,ANNOTATOR_A,',
      'v1,s1,Q1,T1,SCHEDULE,1,violates schedule,ANNOTATOR_B,',
      'v1,s1,Q1,T1,SCHEDULE,1,violates schedule,ADJUDICATED,'
    ].join('\n'), 'utf8');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./p4-evaluator.mjs', import.meta.url))], {
      encoding: 'utf8',
      env: {
        ...process.env, P4_RUN_PATH: runPath, P4_LABELS_PATH: labelsPath,
        P4_ANNOTATION_PACKAGE_PATH: packagePath
      }
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must have label 0/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('accepts one automated label per pair without fabricating human agreement', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'educonnect-p5-auto-'));
  try {
    const runPath = join(directory, 'run.json');
    const packagePath = join(directory, 'package.json');
    const labelsPath = join(directory, 'labels.csv');
    const rankings = { B0: ['T1'], B1: ['T1'], B2: ['T1'], B3: ['T1'], B4: ['T1'] };
    const noRelevantRankings = { B0: ['T2'], B1: ['T2'], B2: ['T2'], B3: ['T2'], B4: ['T2'] };
    await writeFile(runPath, JSON.stringify({
      manifest: { datasetVersion: 'v1', candidateSnapshotHash: 'hash-1' },
      cases: [{ queryId: 'Q1', rankings }, { queryId: 'Q2', rankings: noRelevantRankings }]
    }), 'utf8');
    await writeFile(packagePath, JSON.stringify({
      datasetVersion: 'v1', snapshotVersion: 's1', candidateSnapshotHash: 'hash-1',
      runtimeApiVerification: 'VERIFIED_AGAINST_P5_RUNTIME_API',
      pairs: [
        { queryId: 'Q1', pseudonymousTutorId: 'T1', hardViolations: [] },
        { queryId: 'Q2', pseudonymousTutorId: 'T2', hardViolations: [] }
      ]
    }), 'utf8');
    await writeFile(labelsPath, [
      'datasetVersion,snapshotVersion,queryId,pseudonymousTutorId,hardViolation,label,evidence,annotatorId,note',
      'v1,s1,Q1,T1,NONE,2,automated evidence,LLM_JUDGE_TEST,not independently confirmed',
      'v1,s1,Q2,T2,NONE,0,automated evidence,LLM_JUDGE_TEST,not independently confirmed'
    ].join('\n'), 'utf8');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./p4-evaluator.mjs', import.meta.url))], {
      encoding: 'utf8',
      env: {
        ...process.env, P4_RUN_PATH: runPath, P4_LABELS_PATH: labelsPath,
        P4_ANNOTATION_PACKAGE_PATH: packagePath, P4_LABEL_MODE: 'AUTOMATED_SINGLE'
      }
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'VERIFIED_AUTOMATED_LABELS');
    assert.equal(output.agreement.status, 'NOT_APPLICABLE');
    assert.equal(output.metrics.B4.n5.mean, 1);
    assert.equal(output.noRelevantLabelQueryCount, 1);
    assert.equal(output.pairedOutcomesB4.B0.n5.sampleSize, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('automated label mode still rejects a candidate snapshot mismatch', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'educonnect-p5-auto-snapshot-'));
  try {
    const runPath = join(directory, 'run.json');
    const packagePath = join(directory, 'package.json');
    const labelsPath = join(directory, 'labels.csv');
    await writeFile(runPath, JSON.stringify({
      manifest: { datasetVersion: 'v1', candidateSnapshotHash: 'wrong-hash' },
      cases: []
    }), 'utf8');
    await writeFile(packagePath, JSON.stringify({
      datasetVersion: 'v1', snapshotVersion: 's1', candidateSnapshotHash: 'hash-1',
      runtimeApiVerification: 'VERIFIED_AGAINST_P5_RUNTIME_API',
      pairs: []
    }), 'utf8');
    await writeFile(labelsPath, [
      'datasetVersion,snapshotVersion,queryId,pseudonymousTutorId,hardViolation,label,evidence,annotatorId,note',
      'v1,s1,Q1,T1,NONE,1,automated evidence,LLM_JUDGE_TEST,not independently confirmed'
    ].join('\n'), 'utf8');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./p4-evaluator.mjs', import.meta.url))], {
      encoding: 'utf8',
      env: {
        ...process.env, P4_RUN_PATH: runPath, P4_LABELS_PATH: labelsPath,
        P4_ANNOTATION_PACKAGE_PATH: packagePath, P4_LABEL_MODE: 'AUTOMATED_SINGLE'
      }
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /candidate snapshot/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
