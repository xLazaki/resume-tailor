// เรียก Claude API
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

export const isMock = () => process.env.MOCK_AI === '1';
export const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

async function call(payload) {
  if (!hasKey()) {
    throw new Error('ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY (หรือตั้ง MOCK_AI=1 เพื่อทดลอง)');
  }

  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, ...payload }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`AI error ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json();
}

const textOf = (data) =>
  (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

// structured outputs ไม่รองรับ minimum/maximum/minLength ฯลฯ และทุก object ต้องมี additionalProperties: false
const UNSUPPORTED = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'minItems', 'maxItems'];
function toStrictSchema(node) {
  if (Array.isArray(node)) return node.map(toStrictSchema);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (UNSUPPORTED.includes(k)) continue;
    out[k] = k === 'properties'
      ? Object.fromEntries(Object.entries(v).map(([p, s]) => [p, toStrictSchema(s)]))
      : toStrictSchema(v);
  }
  if (out.type === 'object') out.additionalProperties = false;
  return out;
}

// ขอผลลัพธ์เป็นข้อมูลตาม schema
// ใช้ structured outputs (output_config.format) บังคับให้ AI ตอบเป็น JSON ตามโครงสร้างที่กำหนด
// (โมเดลรุ่นใหม่ไม่รองรับการบังคับเรียก tool ด้วย tool_choice แล้ว)
export async function askJSON({ system, user, schema, maxTokens = 16000 }) {
  const data = await call({
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: toStrictSchema(schema) } },
  });

  if (data.stop_reason === 'refusal') {
    throw new Error('AI ปฏิเสธการตอบคำขอนี้');
  }

  const text = textOf(data);
  if (data.stop_reason !== 'max_tokens') {
    try {
      return JSON.parse(text);
    } catch {}
  }

  // สำรอง: ลองหา JSON ในข้อความ
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }

  console.error('[AI] คำตอบที่อ่านไม่ได้:', JSON.stringify(data).slice(0, 2000));
  const reason =
    data.stop_reason === 'max_tokens'
      ? 'คำตอบยาวเกินกำหนด (max_tokens)'
      : `stop_reason=${data.stop_reason}`;
  throw new Error(`AI ตอบกลับไม่อยู่ในรูปแบบที่กำหนด (${reason}) ดูรายละเอียดในหน้าต่าง Terminal`);
}

// ให้ Claude อ่านไฟล์ PDF โดยตรง ใช้เมื่อตัวอ่าน PDF ปกติอ่านภาษาไทยเพี้ยน
export async function readPdfWithClaude(buffer) {
  const data = await call({
    max_tokens: 6000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
          },
          {
            type: 'text',
            text:
              'Transcribe all text in this CV exactly as written, in its original language. ' +
              'Keep the reading order and put each section, job and bullet point on its own line. ' +
              'Output only the transcribed text, with no comments.',
          },
        ],
      },
    ],
  });
  return textOf(data);
}
