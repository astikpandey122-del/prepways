/**
 * Home page NEET rank predictor: details -> mobile OTP -> predicted rank.
 * Loaded on demand by main.js when a [data-predictor] element exists.
 */
import { loadRankData, predictRank } from './rank-data.js';
import { OTP_DEMO, sendOtp, verifyOtp } from './otp.js';

const RESEND_SECONDS = 30;
const fmt = new Intl.NumberFormat('en-IN');

export function initPredictor(root) {
  const $ = (sel) => root.querySelector(sel);
  const details = $('[data-step="details"]');
  const otpForm = $('[data-step="otp"]');
  const result = $('[data-step="result"]');
  const steps = [...root.querySelectorAll('.predictor__steps li')];
  const examSelect = details.elements.exam;
  const marksInput = details.elements.marks;
  const formError = $('[data-form-error]');

  let data = null;
  let entry = null; // details of the current request
  let verifiedPhone = null; // skip OTP when re-checking with the same number
  let timer = 0;

  /* ---------------------------------------------------------- data */
  loadRankData()
    .then((d) => {
      data = d;
      const updated = d.updated ? new Date(d.updated) : null;
      if (updated && !Number.isNaN(+updated)) {
        $('[data-updated]').textContent = updated.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      if (d.isPreview) $('[data-preview-badge]').hidden = false;
      syncMarksRange();
    })
    .catch((err) => {
      console.warn('[PrepWays] rank data failed to load', err);
      formError.textContent = 'The rank predictor is unavailable right now. Please try again later.';
    });

  function examData() {
    return data?.exams?.[examSelect.value];
  }

  function syncMarksRange() {
    const exam = examData();
    if (!exam) return;
    marksInput.min = exam.minMarks;
    marksInput.max = exam.maxMarks;
    marksInput.placeholder = `${exam.minMarks} – ${exam.maxMarks}`;
    $('[data-marks-hint]').textContent = `Out of ${exam.maxMarks}`;
  }
  examSelect.addEventListener('change', syncMarksRange);

  /* ------------------------------------------------------ helpers */
  function show(step) {
    [details, otpForm, result].forEach((el) => (el.hidden = el.dataset.step !== step));
    const index = ['details', 'otp', 'result'].indexOf(step);
    steps.forEach((li, i) => {
      li.classList.toggle('is-active', i === index);
      li.classList.toggle('is-done', i < index);
      if (i === index) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
  }

  function message(input) {
    const v = input.validity;
    if (input.type === 'checkbox') return input.checked ? '' : 'Please accept the Terms and Privacy Policy to continue.';
    if (v.valueMissing) return input.dataset.requiredMsg || 'This field is required.';
    if (v.badInput || v.rangeUnderflow || v.rangeOverflow || v.stepMismatch)
      return `Enter whole marks between ${input.min} and ${input.max}.`;
    if (v.patternMismatch) return input.dataset.patternMsg || 'Please check this value.';
    if (v.tooShort) return `Please enter at least ${input.minLength} characters.`;
    return '';
  }

  function check(input) {
    const msg = message(input);
    input.setAttribute('aria-invalid', String(Boolean(msg)));
    const err = document.getElementById(input.getAttribute('aria-describedby')?.split(' ')[0]);
    if (err) err.textContent = msg;
    return !msg;
  }

  function busy(button, on, label) {
    button.disabled = on;
    button.setAttribute('aria-busy', String(on));
    if (label) button.querySelector('span').textContent = label;
  }

  function maskPhone(p) {
    return `+91 ${p.slice(0, 2)}••••••${p.slice(-2)}`;
  }

  /* ------------------------------------------------ step 1: details */
  const fields = [...details.querySelectorAll('input, select')];
  fields.forEach((input) => {
    input.addEventListener(input.type === 'checkbox' ? 'change' : 'blur', () => check(input));
    input.addEventListener('input', () => input.getAttribute('aria-invalid') === 'true' && check(input));
  });
  details.elements.phone.addEventListener('input', (e) => {
    // keep digits only, drop a pasted +91 / leading 0
    const digits = e.target.value.replace(/\D/g, '');
    e.target.value = digits.length > 10 ? digits.replace(/^(91|0)/, '').slice(0, 10) : digits;
  });

  details.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';
    const results = fields.map(check);
    const bad = fields.find((_, i) => !results[i]);
    if (bad) {
      bad.focus();
      return;
    }
    if (!data) {
      formError.textContent = 'The rank predictor is still loading. Please try again in a moment.';
      return;
    }
    const f = details.elements;
    entry = {
      name: f.name.value.trim(),
      state: f.state.value,
      exam: f.exam.value,
      marks: Number(f.marks.value),
      phone: f.phone.value,
    };
    if (entry.phone === verifiedPhone) {
      showResult();
      return;
    }
    const button = details.querySelector('[type="submit"]');
    busy(button, true, 'Sending code…');
    try {
      await requestCode();
      show('otp');
      otpForm.elements.code.focus();
    } catch (err) {
      formError.textContent = err.message;
    } finally {
      busy(button, false, 'Get OTP');
    }
  });

  /* ---------------------------------------------------- step 2: OTP */
  const codeInput = otpForm.elements.code;
  const codeError = $('#rp-code-err');
  const resend = $('[data-resend]');
  const demoBox = $('[data-demo]');

  async function requestCode() {
    const { demoCode } = await sendOtp(entry.phone);
    $('[data-phone]').textContent = maskPhone(entry.phone);
    codeInput.value = '';
    codeInput.removeAttribute('aria-invalid');
    codeError.textContent = '';
    demoBox.hidden = !OTP_DEMO;
    if (OTP_DEMO) demoBox.querySelector('b').textContent = demoCode;
    startTimer();
  }

  function startTimer() {
    clearInterval(timer);
    let left = RESEND_SECONDS;
    resend.disabled = true;
    const tick = () => {
      resend.textContent = left > 0 ? `Resend code in ${left}s` : 'Resend code';
      if (left-- <= 0) {
        clearInterval(timer);
        resend.disabled = false;
      }
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
    if (codeInput.value.length === 6) otpForm.requestSubmit();
  });

  resend.addEventListener('click', async () => {
    resend.disabled = true;
    try {
      await requestCode();
      codeInput.focus();
    } catch (err) {
      codeError.textContent = err.message;
      resend.disabled = false;
    }
  });

  $('[data-change-number]').addEventListener('click', () => {
    clearInterval(timer);
    show('details');
    details.elements.phone.focus();
  });

  let verifying = false;
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (verifying) return;
    if (!/^\d{6}$/.test(codeInput.value)) {
      codeInput.setAttribute('aria-invalid', 'true');
      codeError.textContent = 'Enter the 6-digit code.';
      codeInput.focus();
      return;
    }
    verifying = true;
    const button = otpForm.querySelector('[type="submit"]');
    busy(button, true, 'Verifying…');
    try {
      const { phone, ...rest } = entry;
      await verifyOtp(phone, codeInput.value, rest);
      verifiedPhone = phone;
      clearInterval(timer);
      showResult();
    } catch (err) {
      codeInput.setAttribute('aria-invalid', 'true');
      codeError.textContent = err.message;
      codeInput.select();
    } finally {
      verifying = false;
      busy(button, false, 'Verify & see rank');
    }
  });

  /* ------------------------------------------------- step 3: result */
  function showResult() {
    const exam = examData();
    const p = predictRank(exam, entry.marks);
    $('[data-result-name]').textContent = entry.name.split(' ')[0];
    $('[data-result-exam]').textContent = exam.session || exam.label;
    $('[data-result-marks]').textContent = `${entry.marks} / ${exam.maxMarks}`;
    $('[data-result-state]').textContent = entry.state;
    if (p) {
      $('[data-result-rank]').textContent = fmt.format(p.rank);
      $('[data-result-range]').textContent =
        p.low === p.high ? '' : `Likely range: ${fmt.format(p.low)} – ${fmt.format(p.high)}`;
    } else {
      $('[data-result-rank]').textContent = '—';
      $('[data-result-range]').textContent = 'We don’t have rank data for this score yet. Talk with a mentor for a manual estimate.';
    }
    show('result');
    result.focus();
  }

  $('[data-again]').addEventListener('click', () => {
    show('details');
    marksInput.select();
  });

  show('details');
}
