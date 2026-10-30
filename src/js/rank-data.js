/**
 * Rank predictor data + maths, shared by the home page predictor and admin.html.
 *
 * The admin publishes a marks-vs-rank table as /data/rank-predictor.json.
 * Each exam has "points": [[marks, rank], ...]. A score between two points
 * is linearly interpolated, so the table only needs a handful of anchors.
 */

export const DATA_URL = '/data/rank-predictor.json';
// admin.html can save a draft here to preview it on the admin's own device only
export const PREVIEW_KEY = 'prepways-rank-preview';

export async function loadRankData({ allowPreview = true } = {}) {
  if (allowPreview) {
    try {
      const draft = localStorage.getItem(PREVIEW_KEY);
      if (draft) return { ...JSON.parse(draft), isPreview: true };
    } catch {
      /* ignore broken or blocked storage, fall back to the published file */
    }
  }
  const res = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Rank data request failed (${res.status})`);
  return res.json();
}

/** Sort anchors by marks (high → low) and drop invalid rows. */
export function normalisePoints(points) {
  return points
    .map(([m, r]) => [Number(m), Number(r)])
    .filter(([m, r]) => Number.isFinite(m) && Number.isFinite(r) && r >= 1)
    .sort((a, b) => b[0] - a[0]);
}

/** Problems that would make predictions wrong. Empty array = table is OK. */
export function validateExam(exam) {
  const errors = [];
  const pts = normalisePoints(exam.points ?? []);
  if (pts.length < 2) errors.push('Add at least two rows.');
  const min = Number(exam.minMarks);
  const max = Number(exam.maxMarks);
  if (!(max > min)) errors.push('Maximum marks must be greater than minimum marks.');
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] === pts[i - 1][0]) errors.push(`Marks ${pts[i][0]} appears more than once.`);
    else if (pts[i][1] < pts[i - 1][1])
      errors.push(`Rank must get larger as marks go down (check ${pts[i - 1][0]} and ${pts[i][0]} marks).`);
  }
  if (pts.length && (pts[0][0] < max || pts.at(-1)[0] > min))
    errors.push(`Rows should cover the full ${min}–${max} marks range.`);
  return errors;
}

/** Returns { rank, low, high } or null if marks are outside the table. */
export function predictRank(exam, marks) {
  const pts = normalisePoints(exam.points ?? []);
  if (pts.length < 2 || !Number.isFinite(marks)) return null;
  if (marks > pts[0][0] || marks < pts.at(-1)[0]) return null;

  let rank = pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [m1, r1] = pts[i];
    const [m2, r2] = pts[i + 1];
    if (marks <= m1 && marks >= m2) {
      const k = m1 === m2 ? 0 : (m1 - marks) / (m1 - m2);
      rank = r1 + (r2 - r1) * k;
      break;
    }
  }
  rank = Math.max(1, Math.round(rank));
  const spread = Math.max(0, Number(exam.rangePercent) || 0) / 100;
  return {
    rank,
    low: Math.max(1, Math.round(rank * (1 - spread))),
    high: Math.round(rank * (1 + spread)),
  };
}
