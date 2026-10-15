// Omise แจ้งเมื่อมีการจ่ายเงิน (ตั้ง URL นี้ใน Omise Dashboard → Webhooks)
// ไม่เชื่อข้อมูลที่ส่งมาโดยตรง: ดึง charge จาก Omise ใหม่อีกครั้งเพื่อยืนยัน
import { getCharge } from '../../../../lib/omise';
import { getOrder, refreshPayment } from '../../../../lib/orders';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const event = await req.json();
    const chargeId = event?.data?.object === 'charge' ? event.data.id : null;
    if (event?.key !== 'charge.complete' || !chargeId) return Response.json({ ok: true });

    const charge = await getCharge(chargeId);
    const order = await getOrder(charge.metadata?.order_id);
    if (order && order.chargeId === charge.id) await refreshPayment(order);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[webhook]', err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
