'use client';

import { useEffect, useRef, useState } from 'react';
import CvTemplate from '../components/CvTemplate';
import ThemePicker from '../components/ThemePicker';
import Turnstile, { TURNSTILE_SITE_KEY } from '../components/Turnstile';

const PRICE = Number(process.env.NEXT_PUBLIC_PRICE_THB || 79);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setUrlOrder(id) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('order', id);
  else url.searchParams.delete('order');
  window.history.replaceState(null, '', url);
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

function scoreColor(score) {
  if (score >= 75) return '#0f6e56';
  if (score >= 50) return '#854f0b';
  return '#993c1d';
}

export default function Home() {
  const [cv, setCv] = useState('');
  const [job, setJob] = useState('');
  const [lang, setLang] = useState('th');
  const [step, setStep] = useState('input'); // input | analyzed | done
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [result, setResult] = useState(null);
  const [have, setHave] = useState({}); // { keyword: { on: bool, detail: string } }
  const [extra, setExtra] = useState('');
  const [order, setOrder] = useState(null);
  const [tsToken, setTsToken] = useState('');
  const [tsKey, setTsKey] = useState(0);
  const generating = useRef(false);
  const [look, setLook] = useState({ theme: 'modern', accent: '#0f6e56', photo: '' });

  // จำธีม/สี/รูปที่เลือกไว้ต่อออร์เดอร์ (เก็บในเบราว์เซอร์นี้เท่านั้น)
  const lookKey = order?.id ? `rt-look-${order.id}` : '';
  useEffect(() => {
    if (!lookKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(lookKey) || 'null');
      if (saved) setLook((l) => ({ ...l, ...saved }));
    } catch {}
  }, [lookKey]);
  function changeLook(next) {
    setLook(next);
    if (!lookKey) return;
    try {
      localStorage.setItem(lookKey, JSON.stringify(next));
    } catch {
      try {
        localStorage.setItem(lookKey, JSON.stringify({ ...next, photo: '' })); // รูปใหญ่เกินที่เก็บ
      } catch {}
    }
  }

  // เปิดลิงก์ ?order=... → โหลดออร์เดอร์เดิม (กลับมาดู CV หรือรอจ่ายเงินต่อ)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('order');
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/order/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        handleOrder(data);
      } catch (err) {
        setUrlOrder(null);
        setError(err.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ระหว่างรอจ่ายเงิน: ตรวจสถานะทุก 3 วินาที
  useEffect(() => {
    if (step !== 'paying' || !order?.id) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/order/${order.id}`);
        const data = await res.json();
        if (res.ok && data.status !== 'pending') handleOrder(data);
      } catch {}
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, order?.id]);

  function handleOrder(data) {
    setOrder(data);
    if (data.status === 'done') {
      setResult(data.result);
      setStep('done');
    } else if (data.status === 'paid') {
      runGenerate(data.id);
    } else if (data.status === 'pending') {
      setStep('paying');
    } else {
      setStep('paying');
      setError(
        data.status === 'expired'
          ? 'QR หมดอายุแล้ว กรุณากด "สร้าง QR ใหม่"'
          : data.error || 'การชำระเงินไม่สำเร็จ'
      );
    }
  }

  async function runGenerate(id) {
    if (generating.current) return;
    generating.current = true;
    setError('');
    setStep('generating');
    try {
      for (let i = 0; i < 60; i++) {
        const res = await fetch(`/api/order/${id}/generate`, { method: 'POST' });
        const data = await res.json();
        if (res.status === 202) {
          await sleep(3000); // กำลังสร้างอยู่ (เช่น เปิดสองแท็บ) รอแล้วถามใหม่
          continue;
        }
        if (!res.ok) throw new Error(data.error);
        setOrder(data);
        setResult(data.result);
        setStep('done');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      throw new Error('ใช้เวลานานเกินไป กรุณากดลองใหม่');
    } catch (err) {
      setError(err.message);
    } finally {
      generating.current = false;
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setBusy('upload');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/extract', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCv(data.text);
      if (data.warning) {
        setError('ข้อความภาษาไทยจากไฟล์ PDF นี้อาจเพี้ยน กรุณาตรวจในช่องด้านล่าง หรืออัปโหลดเป็นไฟล์ Word แทน');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
      e.target.value = '';
    }
  }

  async function analyze() {
    setError('');
    if (cv.trim().length < 100) return setError('กรุณาใส่ข้อมูล CV อย่างน้อย 100 ตัวอักษร');
    if (job.trim().length < 50) return setError('กรุณาวางประกาศงานอย่างน้อย 50 ตัวอักษร');
    if (TURNSTILE_SITE_KEY && !tsToken) return setError('กรุณายืนยันว่าไม่ใช่บอทก่อน');
    setBusy('analyze');
    try {
      setAnalysis(await postJSON('/api/analyze', { cv, job, lang, turnstileToken: tsToken }));
      setHave({});
      setExtra('');
      setStep('analyzed');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
      setTsToken('');
      setTsKey((k) => k + 1); // token ใช้ได้ครั้งเดียว ขอใหม่ทุกครั้ง
    }
  }

  async function startPayment() {
    setError('');
    setBusy('order');
    try {
      const additions = Object.entries(have)
        .filter(([, v]) => v.on)
        .map(([keyword, v]) => ({ keyword, detail: v.detail || '' }));
      const data = await postJSON('/api/order', { cv, job, lang, additions, extra });
      setOrder(data);
      setUrlOrder(data.id);
      setStep('paying');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function testPay() {
    setError('');
    setBusy('testpay');
    try {
      handleOrder(await postJSON(`/api/order/${order.id}/test-pay`, {}));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  function reset() {
    setUrlOrder(null);
    setOrder(null);
    setStep('input');
    setAnalysis(null);
    setResult(null);
    setError('');
  }

  // รองรับทั้งรูปแบบใหม่ ({keyword, question}) และแบบเก่า (ข้อความ)
  const missing = (analysis?.missing_keywords || []).map((m) =>
    typeof m === 'string' ? { keyword: m, question: '' } : m
  );
  const checkedCount = Object.values(have).filter((v) => v.on).length;

  if (step === 'done' && result) {
    return (
      <main className="wrap">
        <div className="no-print">
          <div className="hero">
            <h1>CV ใหม่ของคุณพร้อมแล้ว</h1>
            <p>ตรวจข้อมูลให้ถูกต้อง แล้วกด “ดาวน์โหลด PDF” แล้วเลือก “บันทึกเป็น PDF”</p>
          </div>
          {order?.id && (
            <div className="card saved">
              <strong>เก็บลิงก์หน้านี้ไว้</strong>
              <div className="hint">กลับมาดูและดาวน์โหลด CV นี้ได้อีกภายใน 7 วัน หลังจากนั้นข้อมูลจะถูกลบอัตโนมัติ</div>
              <button
                className="btn ghost"
                style={{ marginTop: 10 }}
                onClick={() => navigator.clipboard?.writeText(window.location.href)}
              >
                คัดลอกลิงก์
              </button>
            </div>
          )}
          {Array.isArray(result.highlights) && result.highlights.length > 0 && (
            <div className="card">
              <strong>ตัวอย่างที่ปรับ</strong>
              {result.highlights.map((h, i) => (
                <div className="hl" key={i}>
                  <div className="hl-before"><span>เดิม</span>{h.before}</div>
                  <div className="hl-after"><span>ใหม่</span>{h.after}</div>
                  {h.why && <div className="hint">{h.why}</div>}
                </div>
              ))}
            </div>
          )}
          {Array.isArray(result.changes) && result.changes.length > 0 && (
            <div className="card">
              <strong>สิ่งที่ปรับ</strong>
              <ul>
                {result.changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <ThemePicker value={look} onChange={changeLook} onError={setError} />
          {error && <div className="error">{error}</div>}
          <div className="actions" style={{ marginBottom: 20 }}>
            <button className="btn" onClick={() => window.print()}>
              ดาวน์โหลด PDF
            </button>
            <button className="btn ghost" onClick={reset}>
              ปรับกับงานอื่น
            </button>
          </div>
        </div>
        <CvTemplate data={result} theme={look.theme} accent={look.accent} photo={look.photo} />
      </main>
    );
  }

  if (step === 'paying' && order) {
    const ended = order.status === 'expired' || order.status === 'failed';
    const until = order.expiresAt
      ? new Date(order.expiresAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : '';
    return (
      <main className="wrap">
        <div className="hero">
          <h1>สแกนจ่าย {order.amount} บาท</h1>
          <p>สแกน QR ด้วยแอปธนาคารใดก็ได้ ระบบจะเริ่มปรับ CV ให้ทันทีเมื่อจ่ายสำเร็จ</p>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="card pay">
          {!ended && (
            <>
              <img className="qr" src={`/api/order/${order.id}/qr`} alt="QR PromptPay" width={240} height={240} />
              <div className="pay-status">
                <span className="dot" /> กำลังรอการชำระเงิน…
              </div>
              {until && <div className="hint">QR ใช้ได้ถึงเวลา {until} น.</div>}
              <div className="hint" style={{ marginTop: 6 }}>
                บนมือถือ: กดค้างที่ QR เพื่อบันทึกรูป แล้วเปิดแอปธนาคารเพื่อสแกนจากรูป
              </div>
            </>
          )}
          <div className="actions" style={{ justifyContent: 'center', marginTop: 16 }}>
            {ended && cv && (
              <button className="btn" onClick={startPayment} disabled={!!busy}>
                สร้าง QR ใหม่
              </button>
            )}
            <button className="btn ghost" onClick={() => { setUrlOrder(null); setStep(analysis ? 'analyzed' : 'input'); setError(''); }}>
              ย้อนกลับ
            </button>
          </div>
          {order.testPay && !ended && (
            <div className="testpay">
              <div className="hint">โหมดทดสอบ: ยังไม่มีการเก็บเงินจริง</div>
              <button className="btn ghost" onClick={testPay} disabled={!!busy}>
                {busy === 'testpay' ? 'กำลังจำลอง…' : 'จำลองว่าจ่ายแล้ว'}
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (step === 'generating') {
    return (
      <main className="wrap">
        <div className="hero">
          <h1>{error ? 'ปรับ CV ไม่สำเร็จ' : 'ชำระเงินสำเร็จ กำลังปรับ CV…'}</h1>
          <p>{error ? 'คุณชำระเงินแล้ว กดลองใหม่ได้โดยไม่เสียเงินเพิ่ม' : 'AI กำลังเขียน CV ใหม่ให้ตรงกับงาน ใช้เวลาประมาณ 20–60 วินาที อย่าเพิ่งปิดหน้านี้'}</p>
        </div>
        {error ? (
          <>
            <div className="error">{error}</div>
            <button className="btn" onClick={() => runGenerate(order.id)}>ลองใหม่</button>
          </>
        ) : (
          <div className="card pay"><div className="spinner" /></div>
        )}
      </main>
    );
  }

  return (
    <main className="wrap">
      <div className="hero">
        <h1>CV ของคุณตรงกับงานแค่ไหน?</h1>
        <p>ตรวจฟรีภายใน 1 นาที แล้วให้ AI ปรับ CV ให้ตรงตำแหน่งที่สมัคร รองรับภาษาไทยและอังกฤษ</p>
      </div>

      {error && step !== 'analyzed' && <div className="error">{error}</div>}

      {step === 'input' && (
        <div className="card">
          <div className="field">
            <label>
              1. CV ของคุณ <span className="hint">อัปโหลดไฟล์ หรือวางข้อความ</span>
            </label>
            <input
              className="upload"
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={onFile}
              disabled={!!busy}
            />
            <textarea
              value={cv}
              onChange={(e) => setCv(e.target.value)}
              placeholder={busy === 'upload' ? 'กำลังอ่านไฟล์…' : 'ชื่อ, ประสบการณ์ทำงาน, การศึกษา, ทักษะ…'}
            />
          </div>

          <div className="field">
            <label>
              2. ประกาศงานที่จะสมัคร <span className="hint">คัดลอกจาก JobsDB, JobThai, LinkedIn ฯลฯ</span>
            </label>
            <textarea
              value={job}
              onChange={(e) => setJob(e.target.value)}
              placeholder="หน้าที่ความรับผิดชอบ, คุณสมบัติที่ต้องการ…"
            />
          </div>

          <div className="field">
            <label>3. ภาษาของ CV</label>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="th">ภาษาไทย</option>
              <option value="en">English</option>
            </select>
          </div>

          <Turnstile key={tsKey} onToken={setTsToken} />
          <button className="btn" onClick={analyze} disabled={!!busy}>
            {busy === 'analyze' ? 'กำลังวิเคราะห์…' : 'ตรวจ CV ฟรี'}
          </button>
          <p className="note">เราใช้ข้อมูลของคุณเพื่อวิเคราะห์ CV เท่านั้น และไม่เก็บไฟล์ไว้</p>
        </div>
      )}

      {step === 'analyzed' && analysis && (
        <div className="card">
          <div className="score">
            <div className="score-num" style={{ color: scoreColor(analysis.score) }}>
              {analysis.score}
              <small>/100</small>
            </div>
            <div>
              <strong>ความตรงกับงาน</strong>
              <div className="hint">{analysis.summary}</div>
            </div>
          </div>

          {analysis.matched_keywords?.length > 0 && (
            <>
              <strong>มีแล้ว</strong>
              <div className="tags">
                {analysis.matched_keywords.map((k) => (
                  <span className="tag ok" key={k}>{k}</span>
                ))}
              </div>
            </>
          )}

          {missing.length > 0 && (
            <div className="gaps">
              <strong>ยังขาด: คุณมีทักษะไหนจริงบ้าง?</strong>
              <p className="hint" style={{ margin: '2px 0 10px' }}>
                ติ๊กเฉพาะทักษะที่มีจริง แล้วเล่าสั้น ๆ ว่าใช้ทำอะไร AI จะใส่ลงใน CV ให้ ยิ่งให้รายละเอียด CV ยิ่งดี
              </p>
              {missing.map(({ keyword, question }) => {
                const v = have[keyword] || { on: false, detail: '' };
                const set = (patch) => setHave({ ...have, [keyword]: { ...v, ...patch } });
                return (
                  <div className={'gap' + (v.on ? ' on' : '')} key={keyword}>
                    <label className="gap-head">
                      <input type="checkbox" checked={v.on} onChange={(e) => set({ on: e.target.checked })} />
                      <span className="tag miss">{keyword}</span>
                      <span className="hint">{v.on ? 'มีทักษะนี้' : 'ไม่มี / ข้าม'}</span>
                    </label>
                    {v.on && (
                      <input
                        className="gap-detail"
                        type="text"
                        value={v.detail}
                        maxLength={400}
                        onChange={(e) => set({ detail: e.target.value })}
                        placeholder={question || 'ใช้ทำอะไร ที่ไหน ได้ผลอย่างไร'}
                      />
                    )}
                  </div>
                );
              })}
              <label style={{ marginTop: 14 }}>
                อยากเพิ่มอะไรอีกไหม? <span className="hint">ผลงาน ตัวเลข ใบรับรอง ที่ไม่ได้เขียนไว้ใน CV</span>
              </label>
              <textarea
                className="small"
                value={extra}
                maxLength={2000}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="เช่น แคมเปญวันแม่ปี 2567 ทำยอดขายได้ 1.2 ล้านบาท, ได้ใบรับรอง Google Ads"
              />
            </div>
          )}

          {analysis.suggestions?.length > 0 && (
            <>
              <strong>คำแนะนำ</strong>
              <ul>
                {analysis.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}

          <div className="paywall">
            <h3>ให้ AI ปรับ CV ให้ตรงงานนี้</h3>
            <p style={{ margin: '0 0 12px' }}>
              เขียนใหม่จาก CV และทักษะที่คุณยืนยันด้านบน ไม่แต่งเติม พร้อมไฟล์ PDF สวยพร้อมส่ง
              {checkedCount > 0 && ` (เพิ่มทักษะ ${checkedCount} อย่าง)`}
            </p>
            <div className="actions">
              <button className="btn" onClick={startPayment} disabled={!!busy}>
                {busy === 'order' ? 'กำลังสร้าง QR…' : `จ่าย ${PRICE} บาท (PromptPay)`}
              </button>
              <button className="btn ghost" onClick={reset} disabled={!!busy}>
                แก้ข้อมูล
              </button>
            </div>
            {error && (
              <div className="error" style={{ marginTop: 12, marginBottom: 0 }}>
                {error}
              </div>
            )}
            <p className="note">ชำระผ่าน QR PromptPay ด้วยแอปธนาคารใดก็ได้</p>
          </div>
        </div>
      )}
    </main>
  );
}
