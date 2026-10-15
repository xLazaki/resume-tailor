// ส่วนฟรี: ให้คะแนนความตรงกับงาน และบอกคีย์เวิร์ดที่ขาด
import { askJSON, isMock } from '../../../lib/claude';
import { analyzePrompt, analyzeSchema, userMessage } from '../../../lib/prompts';
import { mockAnalysis } from '../../../lib/mock';
import { readInput } from '../../../lib/input';
import { allow, clientIp, LIMITS } from '../../../lib/ratelimit';
import { verifyTurnstile } from '../../../lib/turnstile';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  const input = await readInput(req);
  if (input.error) return Response.json({ error: input.error }, { status: 400 });
  const { cv, job, lang, body } = input;
  const ip = clientIp(req);

  // กันบอท และจำกัดจำนวนครั้ง (ตรวจก่อนเรียก AI ทุกครั้ง)
  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return Response.json({ error: 'ยืนยันว่าไม่ใช่บอทไม่สำเร็จ กรุณาลองใหม่' }, { status: 403 });
  }
  if (!(await allow('analyze', ip, LIMITS.analyzePerIp))) {
    return Response.json(
      { error: `ตรวจฟรีได้วันละ ${LIMITS.analyzePerIp} ครั้ง ครบแล้วสำหรับวันนี้ กรุณาลองใหม่พรุ่งนี้` },
      { status: 429 }
    );
  }
  if (!(await allow('analyze', 'all', LIMITS.analyzeTotal))) {
    return Response.json({ error: 'วันนี้มีผู้ใช้งานเต็มแล้ว กรุณาลองใหม่พรุ่งนี้' }, { status: 429 });
  }

  try {
    if (isMock()) {
      await new Promise((r) => setTimeout(r, 800));
      return Response.json(mockAnalysis);
    }
    const result = await askJSON({
      system: analyzePrompt(lang),
      user: userMessage(cv, job),
      schema: analyzeSchema,
      maxTokens: 2000,
    });
    result.score = Math.max(0, Math.min(100, Math.round(Number(result.score) || 0)));
    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'วิเคราะห์ไม่สำเร็จ: ' + err.message }, { status: 500 });
  }
}
