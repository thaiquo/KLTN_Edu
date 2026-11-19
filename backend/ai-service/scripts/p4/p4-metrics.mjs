export function precisionAtK(ranking, labels, k, relevantThreshold = 1) {
  if (!Number.isInteger(k) || k <= 0) throw new Error('k must be positive');
  return ranking.slice(0, k).filter(id => Number(labels[id] ?? 0) >= relevantThreshold).length / k;
}
export function recallAtK(ranking, labels, k, relevantThreshold = 1) {
  const relevant = Object.values(labels).filter(value => Number(value) >= relevantThreshold).length;
  if (!relevant) return null;
  return ranking.slice(0, k).filter(id => Number(labels[id] ?? 0) >= relevantThreshold).length / relevant;
}

export function ndcgAtK(ranking, labels, k) {
  const dcg = ranking.slice(0, k).reduce((sum, id, index) => sum + (2 ** Number(labels[id] ?? 0) - 1) / Math.log2(index + 2), 0);
  const ideal = Object.values(labels).map(Number).sort((a, b) => b - a).slice(0, k)
    .reduce((sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2), 0);
  return ideal === 0 ? null : dcg / ideal;
}

export function mrrAtK(ranking, labels, k, relevantThreshold = 1) {
  const index = ranking.slice(0, k).findIndex(id => Number(labels[id] ?? 0) >= relevantThreshold);
  return index < 0 ? 0 : 1 / (index + 1);
}

export function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

export function percentile(values, ratio) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return null;
  return ordered[Math.max(0, Math.ceil(ratio * ordered.length) - 1)];
}

export function jaccardAtK(left, right, k) {
  const a = new Set(left.slice(0, k));
  const b = new Set(right.slice(0, k));
  const union = new Set([...a, ...b]);
  return union.size ? [...a].filter(value => b.has(value)).length / union.size : 1;
}

export function weightedCohenKappa(left, right, labels = [0, 1, 2]) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || !left.length) return null;
  const index = new Map(labels.map((label, position) => [Number(label), position]));
  if ([...left, ...right].some(value => !index.has(Number(value)))) return null;
  const scale = Math.max(labels.length - 1, 1);
  const weight = (a, b) => ((a - b) / scale) ** 2;
  const leftCounts = Array(labels.length).fill(0);
  const rightCounts = Array(labels.length).fill(0);
  let observedDisagreement = 0;
  for (let position = 0; position < left.length; position++) {
    const a = index.get(Number(left[position]));
    const b = index.get(Number(right[position]));
    leftCounts[a]++;
    rightCounts[b]++;
    observedDisagreement += weight(a, b);
  }
  observedDisagreement /= left.length;
  let expectedDisagreement = 0;
  for (let a = 0; a < labels.length; a++) {
    for (let b = 0; b < labels.length; b++) {
      expectedDisagreement += weight(a, b) * (leftCounts[a] / left.length) * (rightCounts[b] / right.length);
    }
  }
  if (expectedDisagreement === 0) return observedDisagreement === 0 ? 1 : null;
  return 1 - observedDisagreement / expectedDisagreement;
}

export function bootstrapMeanCI(values, { samples = 2000, alpha = 0.05, seed = 20261112 } = {}) {
  const source = values.filter(Number.isFinite);
  if (source.length < 2) return null;
  let state = seed >>> 0;
  const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
  const estimates = Array.from({ length: samples }, () => mean(Array.from({ length: source.length }, () => source[Math.floor(random() * source.length)]))).sort((a, b) => a - b);
  return {
    lower: estimates[Math.floor((alpha / 2) * samples)],
    upper: estimates[Math.min(samples - 1, Math.ceil((1 - alpha / 2) * samples) - 1)],
    samples,
    seed
  };
}
