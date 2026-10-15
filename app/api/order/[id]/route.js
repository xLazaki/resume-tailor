// ดูสถานะออร์เดอร์ (หน้าเว็บเรียกทุก 3 วินาทีระหว่างรอจ่ายเงิน)
import { getOrder, publicOrder, refreshPayment } from '../../../../lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { id } = await params;
  let order = await getOrder(id);
  if (!order) return Response.json({ error: 'ไม่พบรายการนี้ หรือหมดอายุแล้ว' }, { status: 404 });
  try {
    order = await refreshPayment(order);
  } catch (err) {
    console.error('[order] ตรวจสถานะกับ Omise ไม่สำเร็จ', err);
  }
  return Response.json(publicOrder(order));
}
