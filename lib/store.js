// ที่เก็บข้อมูล (ออร์เดอร์, ตัวนับ rate limit)
// - ตั้งค่า UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → ใช้ Upstash Redis (ต้องใช้ตอนขึ้นเว็บจริง)
// - ไม่ได้ตั้งค่า → เก็บในหน่วยความจำ (ใช้ทดสอบบนเครื่องเท่านั้น ข้อมูลหายเมื่อปิดโปรแกรม)

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(URL_ && TOKEN);

async function redis(command) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  const data = await res.json();
  if (data.error) throw new Error('Redis: ' + data.error);
  return data.result;
}

// ---- หน่วยความจำ (สำหรับทดสอบ) ----
const mem = globalThis.__rtStore || (globalThis.__rtStore = new Map());
function memGet(key) {
  const item = mem.get(key);
  if (!item) return null;
  if (item.exp && item.exp < Date.now()) {
    mem.delete(key);
    return null;
  }
  return item.value;
}
const memSet = (key, value, ttl) =>
  mem.set(key, { value, exp: ttl ? Date.now() + ttl * 1000 : 0 });

if (!useRedis && process.env.NODE_ENV === 'production' && !globalThis.__rtWarned) {
  globalThis.__rtWarned = true;
  console.warn('[store] ไม่ได้ตั้งค่า Upstash Redis กำลังเก็บข้อมูลในหน่วยความจำ ซึ่งใช้บนเว็บจริงไม่ได้');
}

export async function getJSON(key) {
  const raw = useRedis ? await redis(['GET', key]) : memGet(key);
  return raw ? JSON.parse(raw) : null;
}

export async function setJSON(key, value, ttlSec) {
  const raw = JSON.stringify(value);
  if (useRedis) return redis(ttlSec ? ['SET', key, raw, 'EX', String(ttlSec)] : ['SET', key, raw]);
  memSet(key, raw, ttlSec);
}

export async function del(key) {
  if (useRedis) return redis(['DEL', key]);
  mem.delete(key);
}

// ตั้งค่าเฉพาะเมื่อยังไม่มี key นี้ (ใช้เป็นตัวล็อก) คืนค่า true ถ้าตั้งสำเร็จ
export async function setIfAbsent(key, value, ttlSec) {
  if (useRedis) return (await redis(['SET', key, String(value), 'NX', 'EX', String(ttlSec)])) === 'OK';
  if (memGet(key) !== null) return false;
  memSet(key, String(value), ttlSec);
  return true;
}

// เพิ่มตัวนับทีละ 1 และตั้งเวลาหมดอายุตอนสร้างครั้งแรก คืนค่าตัวนับใหม่
export async function incr(key, ttlSec) {
  if (useRedis) {
    const n = await redis(['INCR', key]);
    if (n === 1) await redis(['EXPIRE', key, String(ttlSec)]);
    return n;
  }
  const n = Number(memGet(key) || 0) + 1;
  const item = mem.get(key);
  mem.set(key, { value: String(n), exp: item?.exp || Date.now() + ttlSec * 1000 });
  return n;
}
