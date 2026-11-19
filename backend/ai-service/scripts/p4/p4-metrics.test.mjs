import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapMeanCI, jaccardAtK, mrrAtK, ndcgAtK, precisionAtK, recallAtK, weightedCohenKappa } from './p4-metrics.mjs';

const labels = { A: 2, B: 1, C: 0, D: 2 };

test('computes precision and recall with explicit relevance threshold', () => {
  assert.equal(precisionAtK(['A', 'C', 'B'], labels, 2), 0.5);
  assert.equal(recallAtK(['A', 'C', 'B'], labels, 2), 1 / 3);
});
test('computes graded NDCG against the ideal ordering', () => {
  assert.equal(ndcgAtK(['A', 'D', 'B'], labels, 3), 1);
  assert.ok(ndcgAtK(['C', 'B', 'A'], labels, 3) < 1);
});

test('computes reciprocal rank and zero when no relevant item is returned', () => {
  assert.equal(mrrAtK(['C', 'B', 'A'], labels, 3), 0.5);
  assert.equal(mrrAtK(['C'], labels, 1), 0);
});

test('computes deterministic overlap and bootstrap interval', () => {
  assert.equal(jaccardAtK(['A', 'B'], ['B', 'C'], 2), 1 / 3);
  assert.deepEqual(bootstrapMeanCI([1, 2, 3], { samples: 100, seed: 7 }), bootstrapMeanCI([1, 2, 3], { samples: 100, seed: 7 }));
});

test('computes quadratic weighted Cohen kappa for ordinal labels', () => {
  assert.equal(weightedCohenKappa([0, 1, 2], [0, 1, 2]), 1);
  assert.ok(Math.abs(weightedCohenKappa([0, 1, 2], [2, 1, 0]) + 1) < 1e-12);
});
