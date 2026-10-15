'use client';

// กล่องยืนยันว่าไม่ใช่บอท (Cloudflare Turnstile)
// แสดงเฉพาะเมื่อตั้งค่า NEXT_PUBLIC_TURNSTILE_SITE_KEY
import { useEffect, useRef } from 'react';

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!window.__tsLoading) {
    window.__tsLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return window.__tsLoading;
}

export default function Turnstile({ onToken }) {
  const box = useRef(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let widgetId;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !box.current) return;
      widgetId = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    });
    return () => {
      cancelled = true;
      if (widgetId !== undefined) window.turnstile?.remove(widgetId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} style={{ margin: '4px 0 12px' }} />;
}
