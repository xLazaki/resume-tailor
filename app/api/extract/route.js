// รับไฟล์ CV (PDF / Word / TXT) แล้วแปลงเป็นข้อความ
import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import { hasKey, isMock, readPdfWithClaude } from '../../../lib/claude';
import { allow, clientIp, LIMITS } from '../../../lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_SIZE = 5 * 1024 * 1024;

// ทำความสะอาดข้อความ: ลบตัวอักษรเสีย และรวม "ํ" + "า" กลับเป็น "ำ"
function clean(text) {
  return text
    .replace(/[\x00\uFFFD\uF700-\uF71A]/g, '')
    .replace(/\u0E4D\u0E32/g, '\u0E33')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// PDF ภาษาไทยหลายไฟล์ (โดยเฉพาะที่ export จาก Word) อ่านออกมาแล้วสระ/วรรณยุกต์เพี้ยน
// ตรวจหาความผิดปกติ ถ้าเพี้ยนเกินเกณฑ์จะให้ Claude อ่านไฟล์แทน
const THAI = /[\u0E01-\u0E4F]/g;
const SIGNS = [
  /[\x00\uFFFD\uF700-\uF71A]/g,                        // ตัวอักษรที่อ่านไม่ได้
  /[\u0E01-\u0E4F][$%&,!#*0-9][\u0E01-\u0E4F]/g,        // สัญลักษณ์แทรกกลางคำไทย เช่น ท%า ส,ง
  /(^|\s)[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/gm,         // สระบน/ล่าง หรือวรรณยุกต์ ที่ไม่มีพยัญชนะนำ
  /[\u0E48-\u0E4B]{2,}/g,                               // วรรณยุกต์ซ้อนกัน
];

export function looksGarbled(text) {
  const thai = (text.match(THAI) || []).length;
  if (thai < 20) return text.includes('\x00') || text.includes('\uFFFD');
  const bad = SIGNS.reduce((n, re) => n + (text.match(re) || []).length, 0);
  return bad / thai > 0.005;
}

async function readPdf(buf, ip) {
  let text = '';
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const result = await extractText(pdf, { mergePages: true });
    text = Array.isArray(result.text) ? result.text.join('\n') : result.text;
  } catch (err) {
    console.error('unpdf failed', err);
  }

  if (!looksGarbled(text) && clean(text).length >= 50) return { text, via: 'pdf' };

  // อ่านไม่ได้หรือภาษาไทยเพี้ยน → ให้ Claude อ่านไฟล์ (มีค่าใช้จ่ายเล็กน้อย)
  if (hasKey() && !isMock() && (await allow('pdfai', ip, LIMITS.pdfAiPerIp))) {
    return { text: await readPdfWithClaude(buf), via: 'claude' };
  }
  return { text, via: 'pdf', warning: true };
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return Response.json({ error: 'ไม่พบไฟล์' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'ไฟล์ใหญ่เกิน 5MB' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    let text = '';
    let via = 'file';
    let warning = false;

    if (name.endsWith('.pdf')) {
      ({ text, via, warning = false } = await readPdf(buf, clientIp(req)));
    } else if (name.endsWith('.docx')) {
      text = (await mammoth.extractRawText({ buffer: buf })).value;
    } else if (name.endsWith('.txt')) {
      text = buf.toString('utf8');
    } else {
      return Response.json({ error: 'รองรับเฉพาะไฟล์ PDF, DOCX หรือ TXT' }, { status: 400 });
    }

    text = clean(text);
    if (text.length < 50) {
      return Response.json(
        { error: 'อ่านข้อความจากไฟล์ไม่ได้ (อาจเป็นไฟล์สแกนหรือรูปภาพ) ลองพิมพ์หรือวางข้อความแทน' },
        { status: 400 }
      );
    }
    return Response.json({ text: text.slice(0, 20000), via, warning });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'อ่านไฟล์ไม่สำเร็จ: ' + err.message }, { status: 500 });
  }
}
