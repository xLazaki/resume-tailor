// เชื่อมต่อ Omise (PromptPay)
// เอกสาร: https://docs.omise.co/promptpay
const API = process.env.OMISE_API_BASE || 'https://api.omise.co';

const secret = () => process.env.OMISE_SECRET_KEY || '';
export const isOmiseTestKey = () => secret().startsWith('skey_test_');

function auth() {
  if (!secret()) throw new Error('ยังไม่ได้ตั้งค่า OMISE_SECRET_KEY');
  return 'Basic ' + Buffer.from(secret() + ':').toString('base64');
}

async function omise(path, { method = 'GET', form } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: auth(),
      ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: form ? new URLSearchParams(form) : undefined,
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok || data.object === 'error') {
    throw new Error(`Omise ${data.code || res.status}: ${data.message || 'error'}`);
  }
  return data;
}

// สร้าง charge แบบ PromptPay (amount เป็นบาท)
export async function createPromptPayCharge({ amountThb, orderId, expiresInMin = 15 }) {
  const expiresAt = new Date(Date.now() + expiresInMin * 60 * 1000).toISOString();
  const charge = await omise('/charges', {
    method: 'POST',
    form: {
      amount: String(Math.round(amountThb * 100)),
      currency: 'THB',
      'source[type]': 'promptpay',
      'metadata[order_id]': orderId,
      expires_at: expiresAt,
    },
  });
  return {
    chargeId: charge.id,
    qrDownloadUri: charge.source?.scannable_code?.image?.download_uri || '',
    expiresAt: charge.expires_at || expiresAt,
  };
}

export const getCharge = (id) => omise(`/charges/${encodeURIComponent(id)}`);

// ใช้ได้เฉพาะ test key: จำลองว่าลูกค้าจ่ายแล้ว
export const markAsPaid = (id) =>
  omise(`/charges/${encodeURIComponent(id)}/mark_as_paid`, { method: 'POST' });

// ดึงรูป QR (SVG) จาก Omise
export async function fetchQr(downloadUri) {
  const res = await fetch(downloadUri, { headers: { Authorization: auth() }, cache: 'no-store' });
  if (!res.ok) throw new Error('ดึง QR ไม่สำเร็จ: ' + res.status);
  return { body: await res.arrayBuffer(), type: res.headers.get('content-type') || 'image/svg+xml' };
}
