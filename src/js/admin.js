/**
 * admin.html: edit the marks-vs-rank table used by the rank predictor.
 *
 * The site has no backend, so nothing here changes the live site directly.
 * The admin downloads the JSON and replaces public/data/rank-predictor.json,
 * then redeploys. "Preview on this device" stores a draft in localStorage
 * that only this browser's predictor uses.
 */
import { loadRankData, normalisePoints, predictRank, validateExam, PREVIEW_KEY } from './rank-data.js';

const $ = (sel) => document.querySelector(sel);
const fmt = new Intl.NumberFormat('en-IN');
const settings = $('[data-settings]');
const rowsEl = $('[data-rows]');
const errorsEl = $('[data-errors]');
const statusEl = $('[data-status]');
const testIn = $('#a-test');
const testOut = $('[data-test-out]');

let data = null;
const examKey = () => settings.elements.exam.value;

function status(msg) {
  statusEl.textContent = msg;
  statusEl.hidden = !msg;
}

/* ------------------------------------------------------------ table */
function addRow(marks = '', rank = '') {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="number" step="1" aria-label="Marks" data-col="m" /></td>
    <td><input type="number" step="1" min="1" aria-label="All-India Rank" data-col="r" /></td>
    <td><button class="icon-btn" type="button" aria-label="Remove row">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button></td>`;
  tr.querySelector('[data-col="m"]').value = marks;
  tr.querySelector('[data-col="r"]').value = rank;
  tr.querySelector('button').addEventListener('click', () => {
    tr.remove();
    sync();
  });
  rowsEl.append(tr);
  return tr;
}

function readExam() {
  const f = settings.elements;
  const points = [...rowsEl.rows]
    .map((tr) => [tr.querySelector('[data-col="m"]').value, tr.querySelector('[data-col="r"]').value])
    .filter(([m, r]) => m !== '' && r !== '')
    .map(([m, r]) => [Number(m), Number(r)]);
  return {
    ...data.exams[examKey()],
    session: f.session.value.trim(),
    minMarks: Number(f.minMarks.value),
    maxMarks: Number(f.maxMarks.value),
    rangePercent: Number(f.rangePercent.value) || 0,
    points: normalisePoints(points),
  };
}

function render() {
  const exam = data.exams[examKey()];
  const f = settings.elements;
  f.session.value = exam.session ?? '';
  f.minMarks.value = exam.minMarks ?? 0;
  f.maxMarks.value = exam.maxMarks ?? 720;
  f.rangePercent.value = exam.rangePercent ?? 0;
  f.updated.value = data.updated ?? '';
  rowsEl.innerHTML = '';
  normalisePoints(exam.points ?? []).forEach(([m, r]) => addRow(m, r));
  sync();
}

/** Re-validate and update the test result after every edit. */
function sync() {
  const exam = readExam();
  const errors = validateExam(exam);
  errorsEl.innerHTML = '';
  errors.forEach((e) => {
    const li = document.createElement('li');
    li.textContent = e;
    errorsEl.append(li);
  });
  const marks = testIn.value === '' ? NaN : Number(testIn.value);
  if (Number.isNaN(marks)) testOut.textContent = 'Enter marks to see the predicted rank';
  else {
    const p = predictRank(exam, marks);
    testOut.textContent = p
      ? `Rank ${fmt.format(p.rank)}  (shown as ${fmt.format(p.low)} – ${fmt.format(p.high)})`
      : 'No prediction: marks are outside the table.';
  }
  return errors;
}

function buildJson() {
  data.exams[examKey()] = readExam();
  data.updated = settings.elements.updated.value || new Date().toISOString().slice(0, 10);
  const { isPreview, note, ...clean } = data;
  return clean;
}

function guard() {
  const errors = sync();
  if (errors.length) {
    status('Fix the problems listed under the table first.');
    errorsEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  return true;
}

/* ---------------------------------------------------------- actions */
settings.addEventListener('input', sync);
rowsEl.addEventListener('input', sync);
testIn.addEventListener('input', sync);
settings.elements.exam.addEventListener('change', render);

$('[data-add]').addEventListener('click', () => addRow().querySelector('input').focus());

$('[data-download]').addEventListener('click', () => {
  if (!guard()) return;
  const blob = new Blob([JSON.stringify(buildJson(), null, 2) + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rank-predictor.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  status('Downloaded. Replace public/data/rank-predictor.json with this file and redeploy.');
});

$('[data-preview]').addEventListener('click', () => {
  if (!guard()) return;
  try {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(buildJson()));
    status('Preview saved. Open the home page in this browser to try it. Other visitors still see the published data.');
  } catch {
    status('Could not save the preview: browser storage is blocked.');
  }
});

$('[data-clear-preview]').addEventListener('click', () => {
  try {
    localStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* ignore */
  }
  status('Preview cleared. This browser now uses the published data again.');
});

$('[data-reset]').addEventListener('click', async () => {
  data = await loadRankData({ allowPreview: false });
  render();
  status('Loaded the currently published data.');
});

$('[data-import]').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed?.exams?.neet?.points) throw new Error('missing exams.neet.points');
    data = parsed;
    render();
    status(`Imported ${file.name}.`);
  } catch (err) {
    status(`That file is not valid rank data (${err.message}).`);
  }
});

/* ------------------------------------------------------------- boot */
loadRankData()
  .then((d) => {
    data = d;
    render();
    status(d.isPreview ? 'Showing your saved preview draft (not yet published).' : '');
  })
  .catch((err) => status(`Could not load rank data: ${err.message}`));
