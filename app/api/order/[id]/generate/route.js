// สร้าง CV ใหม่ให้ออร์เดอร์ที่จ่ายเงินแล้ว
import { generate, getOrder, publicOrder, refreshPayment } from '../../../../../lib/orders';

export const runtime = 'nodejs';
export const maxDuration = 120; // Vercel: ให้เวลา AI เขียน CV ได้นานพอ

export async function POST(req, { params }) {
  const { id } = await params;
  let order = await getOrder(id);
  if (!order) return Response.json({ error: 'ไม่พบรายการนี้ หรือหมดอายุแล้ว' }, { status: 404 });

  try {
    order = await refreshPayment(order);
    const r = await generate(order);
    if (r.notPaid) return Response.json({ error: 'ยังไม่ได้ชำระเงิน' }, { status: 402 });
    if (r.busy) return Response.json(publicOrder(r.order), { status: 202 });
    return Response.json(publicOrder(r.order));
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: 'ปรับ CV ไม่สำเร็จ: ' + err.message + ' (ชำระเงินแล้ว กดลองใหม่ได้โดยไม่เสียเงินเพิ่ม)' },
      { status: 500 }
    );
  }
}
