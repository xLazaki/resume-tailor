// Cloudflare Turnstile กันบอท (ใช้ฟรี)
// ถ้าไม่ได้ตั้งค่า TURNSTILE_SECRET_KEY ระบบจะข้ามการตรวจนี้
export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  const form = new URLSearchParams({ secret, response: String(token) });
  if (ip && ip !== 'local') form.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('[turnstile]', err);
    return false;
  }
}
