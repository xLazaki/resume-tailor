// ตรวจและทำความสะอาดข้อมูลที่ผู้ใช้ส่งมา
export async function readInput(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return { error: 'ข้อมูลไม่ถูกต้อง' };
  }
  const cv = String(body.cv || '').trim().slice(0, 20000);
  const job = String(body.job || '').trim().slice(0, 10000);
  const lang = body.lang === 'en' ? 'en' : 'th';

  // ทักษะที่ผู้ใช้ยืนยันว่ามีจริง และข้อมูลเพิ่มเติม
  const additions = (Array.isArray(body.additions) ? body.additions : [])
    .slice(0, 15)
    .map((a) => ({
      keyword: String(a?.keyword || '').trim().slice(0, 80),
      detail: String(a?.detail || '').trim().slice(0, 400),
    }))
    .filter((a) => a.keyword);
  const extra = String(body.extra || '').trim().slice(0, 2000);

  if (cv.length < 100) return { error: 'ข้อมูล CV สั้นเกินไป (อย่างน้อย 100 ตัวอักษร)' };
  if (job.length < 50) return { error: 'ประกาศงานสั้นเกินไป (อย่างน้อย 50 ตัวอักษร)' };
  return { cv, job, lang, additions, extra, body };
}
