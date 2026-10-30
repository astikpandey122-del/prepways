/**
 * Mobile OTP verification for the rank predictor.
 *
 * Real SMS needs a server (an SMS gateway key must never ship to the browser).
 * Set VITE_OTP_API_URL in a .env file to point at that server; it must provide:
 *
 *   POST {VITE_OTP_API_URL}/otp/send    { phone }                              -> 200 { ok: true }
 *   POST {VITE_OTP_API_URL}/otp/verify  { phone, code, name, state, exam, marks } -> 200 { ok: true }
 *                                                                               or 4xx { ok: false, message }
 *
 * Without it the predictor runs in DEMO mode: the code is generated in the
 * browser and shown on screen. Demo mode verifies nothing and is for testing only.
 */

const API = (import.meta.env.VITE_OTP_API_URL || '').replace(/\/$/, '');
export const OTP_DEMO = !API;

let demo = null; // { phone, code, expires, attempts }

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

/** Sends a code. In demo mode resolves with { demoCode } so the UI can show it. */
export async function sendOtp(phone) {
  if (!OTP_DEMO) {
    await post('/otp/send', { phone });
    return {};
  }
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
  demo = { phone, code, expires: Date.now() + 5 * 60_000, attempts: 0 };
  await new Promise((r) => setTimeout(r, 600)); // feels like a network call
  return { demoCode: code };
}

/** Resolves when the code is right, throws with a user-facing message otherwise. */
export async function verifyOtp(phone, code, details) {
  if (!OTP_DEMO) {
    await post('/otp/verify', { phone, code, ...details });
    return;
  }
  await new Promise((r) => setTimeout(r, 400));
  if (!demo || demo.phone !== phone) throw new Error('Please request a new code.');
  if (Date.now() > demo.expires) throw new Error('This code has expired. Please request a new one.');
  if (++demo.attempts > 5) throw new Error('Too many wrong attempts. Please request a new code.');
  if (code !== demo.code) throw new Error('That code is incorrect. Please check and try again.');
  demo = null;
}
