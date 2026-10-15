// จำกัดจำนวนครั้งที่ใช้งาน (นับรายวันตามเวลาไทย)
import { incr } from './store';

const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);

export const LIMITS = {
  // ตรวจ CV ฟรี ต่อคน (IP) ต่อวัน
  analyzePerIp: num(process.env.FREE_CHECKS_PER_IP_PER_DAY, 5),
  // ตรวจ CV ฟรี รวมทุกคนต่อวัน (เพดานกันค่า AI บานปลาย)
  analyzeTotal: num(process.env.FREE_CHECKS_PER_DAY, 300),
  // ให้ Claude อ่าน PDF ที่ภาษาไทยเพี้ยน ต่อคนต่อวัน
  pdfAiPerIp: num(process.env.PDF_AI_READS_PER_IP_PER_DAY, 10),
  // สร้างออร์เดอร์ (QR) ต่อคนต่อวัน
  ordersPerIp: num(process.env.ORDERS_PER_IP_PER_DAY, 20),
};

export function clientIp(req) {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd && fwd.split(',')[0].trim()) || req.headers.get('x-real-ip') || 'local';
}

const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

// คืนค่า true ถ้ายังไม่เกินโควตา (และนับเพิ่ม 1 ครั้ง)
export async function allow(bucket, id, limit) {
  if (!limit || limit <= 0) return true;
  const n = await incr(`rl:${bucket}:${id}:${today()}`, 26 * 3600);
  return n <= limit;
}
