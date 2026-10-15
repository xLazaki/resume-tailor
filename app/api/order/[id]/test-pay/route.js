// จำลองว่าจ่ายเงินแล้ว (ใช้ได้เฉพาะโหมดทดสอบ: PAYMENT_MODE=mock หรือ Omise test key)
import { canTestPay, getOrder, publicOrder, testPay } from '../../../../../lib/orders';

export const runtime = 'nodejs';

export async function POST(req, { params }) {
  if (!canTestPay()) return Response.json({ error: 'ไม่อนุญาต' }, { status: 403 });
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return Response.json({ error: 'ไม่พบรายการนี้' }, { status: 404 });
  try {
    return Response.json(publicOrder(await testPay(order)));
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
