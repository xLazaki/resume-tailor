// รูป QR PromptPay ของออร์เดอร์
import { getOrder } from '../../../../../lib/orders';
import { fetchQr } from '../../../../../lib/omise';

export const runtime = 'nodejs';

const mockQr = (amount) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
<rect width="240" height="240" fill="#fff" stroke="#ccc"/>
<g fill="#222">${Array.from({ length: 64 }, (_, i) => {
  const x = (i % 8) * 24 + 24, y = Math.floor(i / 8) * 24 + 24;
  return (i * 7 + (i >> 2)) % 3 ? '' : `<rect x="${x}" y="${y}" width="20" height="20"/>`;
}).join('')}</g>
<rect x="40" y="96" width="160" height="48" fill="#fff" stroke="#999"/>
<text x="120" y="117" font-size="14" text-anchor="middle" font-family="sans-serif">QR จำลอง</text>
<text x="120" y="135" font-size="12" text-anchor="middle" font-family="sans-serif">${amount} บาท</text>
</svg>`;

export async function GET(req, { params }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return new Response('not found', { status: 404 });

  if (order.mode !== 'omise') {
    return new Response(mockQr(order.amount), { headers: { 'content-type': 'image/svg+xml' } });
  }
  try {
    const { body, type } = await fetchQr(order.qrDownloadUri);
    return new Response(body, { headers: { 'content-type': type, 'cache-control': 'private, max-age=900' } });
  } catch (err) {
    console.error(err);
    return new Response('QR error', { status: 502 });
  }
}
