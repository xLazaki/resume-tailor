'use client';

// เลือกธีม สี และรูปถ่ายของ CV
// รูปถ่ายย่อขนาดและเก็บในเบราว์เซอร์ของผู้ใช้เท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์
import { THEMES, ACCENTS } from './CvTemplate';

function resizeImage(file, max = 480) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('อ่านรูปไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG'));
    };
    img.src = url;
  });
}

export default function ThemePicker({ value, onChange, onError }) {
  const { theme, accent, photo } = value;
  const set = (patch) => onChange({ ...value, ...patch });

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return onError?.('กรุณาเลือกไฟล์รูปภาพ');
    try {
      set({ photo: await resizeImage(file) });
    } catch (err) {
      onError?.(err.message);
    }
  }

  return (
    <div className="card themer">
      <div>
        <strong>เลือกรูปแบบ CV</strong>
        <div className="theme-list" style={{ marginTop: 8 }}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={'theme-btn' + (theme === t.id ? ' on' : '')}
              onClick={() => set({ theme: t.id })}
              aria-pressed={theme === t.id}
            >
              <strong>{t.name}</strong>
              <span>{t.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <strong>สีหลัก</strong>
        <div className="swatches" style={{ marginTop: 8 }}>
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={'swatch' + (accent === a.color ? ' on' : '')}
              style={{ background: a.color }}
              onClick={() => set({ accent: a.color })}
              aria-label={a.name}
              title={a.name}
            />
          ))}
        </div>
      </div>

      <div>
        <strong>รูปถ่าย</strong> <span className="hint">ไม่บังคับ แต่ HR ไทยหลายที่ยังนิยมให้มี</span>
        <div className="photo-row" style={{ marginTop: 8 }}>
          {photo && <img src={photo} alt="รูปถ่ายที่เลือก" />}
          <span className="btn ghost file-btn">
            {photo ? 'เปลี่ยนรูป' : 'เพิ่มรูปถ่าย'}
            <input type="file" accept="image/*" onChange={onPhoto} aria-label="เลือกรูปถ่าย" />
          </span>
          {photo && (
            <button type="button" className="btn ghost" onClick={() => set({ photo: '' })}>
              ลบรูป
            </button>
          )}
        </div>
        <div className="hint" style={{ marginTop: 6 }}>รูปเก็บไว้ในเครื่องของคุณเท่านั้น ไม่ได้อัปโหลดขึ้นระบบ</div>
      </div>
    </div>
  );
}
