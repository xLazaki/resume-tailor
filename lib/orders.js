// ออร์เดอร์: สร้าง → รอจ่าย → จ่ายแล้ว → สร้าง CV → เสร็จ
import { randomUUID } from 'crypto';
import { getJSON, setJSON, setIfAbsent, del } from './store';
import { createPromptPayCharge, getCharge, isOmiseTestKey, markAsPaid } from './omise';
import { askJSON, isMock } from './claude';
import { tailorPrompt, tailorSchema, tailorMessage } from './prompts';
import { mockTailored } from './mock';

export const PRICE_THB = Number(process.env.NEXT_PUBLIC_PRICE_THB || 79);
const KEEP_DAYS = 7; // ลบข้อมูลอัตโนมัติหลัง 7 วัน (PDPA)
const TTL = KEEP_DAYS * 24 * 3600;

export const paymentMode = () => (process.env.PAYMENT_MODE === 'omise' ? 'omise' : 'mock');
export const canTestPay = () => paymentMode() === 'mock' || isOmiseTestKey();

const key = (id) => `order:${id}`;
const validId = (id) => /^[0-9a-f-]{36}$/.test(String(id || ''));

export async function getOrder(id) {
  return validId(id) ? getJSON(key(id)) : null;
}
export const saveOrder = (order) => setJSON(key(order.id), order, TTL);

export async function createOrder(input) {
  const order = {
    id: randomUUID(),
    status: 'pending', // pending | paid | done | expired | failed
    amount: PRICE_THB,
    mode: paymentMode(),
    createdAt: new Date().toISOString(),
    input, // { cv, job, lang, additions, extra }
  };

  if (order.mode === 'omise') {
    const c = await createPromptPayCharge({ amountThb: PRICE_THB, orderId: order.id });
    Object.assign(order, c);
  } else {
    order.expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }
  await saveOrder(order);
  return order;
}

// ตรวจกับ Omise ว่าจ่ายแล้วหรือยัง (ไม่เชื่อข้อมูลจากฝั่งผู้ใช้)
export async function refreshPayment(order) {
  if (order.status !== 'pending' || order.mode !== 'omise' || !order.chargeId) return order;
  const charge = await getCharge(order.chargeId);
  const next =
    charge.status === 'successful' ? 'paid'
    : charge.status === 'expired' ? 'expired'
    : charge.status === 'failed' ? 'failed'
    : 'pending';
  if (next !== order.status) {
    order.status = next;
    if (next === 'paid') order.paidAt = new Date().toISOString();
    if (next === 'failed') order.error = charge.failure_message || 'การชำระเงินไม่สำเร็จ';
    await saveOrder(order);
  }
  return order;
}

// จำลองการจ่ายเงิน (โหมด mock หรือ Omise test key เท่านั้น)
export async function testPay(order) {
  if (!canTestPay()) throw new Error('ใช้ได้เฉพาะโหมดทดสอบ');
  if (order.mode === 'omise') {
    await markAsPaid(order.chargeId);
    return refreshPayment(order);
  }
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  await saveOrder(order);
  return order;
}

// สร้าง CV ให้ออร์เดอร์ที่จ่ายแล้ว (ทำครั้งเดียว ถ้าพลาดเรียกใหม่ได้โดยไม่ต้องจ่ายซ้ำ)
export async function generate(order) {
  if (order.status === 'done') return { order };
  if (order.status !== 'paid') return { order, notPaid: true };

  const gotLock = await setIfAbsent(`lock:${order.id}`, 1, 180);
  if (!gotLock) return { order, busy: true };

  try {
    const { cv, job, lang, additions, extra } = order.input;
    let result;
    if (isMock()) {
      await new Promise((r) => setTimeout(r, 1200));
      result = mockTailored;
    } else {
      result = await askJSON({
        system: tailorPrompt(lang),
        user: tailorMessage(cv, job, additions, extra),
        schema: tailorSchema,
        maxTokens: 10000,
      });
      delete result.plan;
    }
    order.status = 'done';
    order.result = result;
    order.doneAt = new Date().toISOString();
    delete order.input; // ไม่เก็บ CV ต้นฉบับไว้นานเกินจำเป็น
    await saveOrder(order);
    return { order };
  } finally {
    await del(`lock:${order.id}`);
  }
}

// ข้อมูลที่ส่งให้หน้าเว็บ (ไม่ส่ง CV ต้นฉบับกลับไป)
export function publicOrder(order) {
  return {
    id: order.id,
    status: order.status,
    amount: order.amount,
    mode: order.mode,
    expiresAt: order.expiresAt,
    testPay: canTestPay(),
    error: order.error,
    result: order.status === 'done' ? order.result : undefined,
  };
}
