// สร้างออร์เดอร์ + QR PromptPay
import { readInput } from '../../../lib/input';
import { createOrder, publicOrder } from '../../../lib/orders';
import { allow, clientIp, LIMITS } from '../../../lib/ratelimit';

export const runtime = 'nodejs';

export async function POST(req) {
  const input = await readInput(req);
  if (input.error) return Response.json({ error: input.error }, { status: 400 });

  if (!(await allow('order', clientIp(req), LIMITS.ordersPerIp))) {
    return Response.json({ error: 'สร้างรายการชำระเงินเกินจำนวนที่กำหนดในวันนี้ กรุณาลองใหม่พรุ่งนี้' }, { status: 429 });
  }

  try {
    const { cv, job, lang, additions, extra } = input;
    const order = await createOrder({ cv, job, lang, additions, extra });
    return Response.json(publicOrder(order));
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'สร้างรายการชำระเงินไม่สำเร็จ: ' + err.message }, { status: 500 });
  }
}
