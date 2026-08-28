import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

export default function Captcha({ onCaptchaReady }) {
  const [svg, setSvg] = useState('');
  const onReadyRef = useRef(onCaptchaReady);
  onReadyRef.current = onCaptchaReady;

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/captcha');
      setSvg(res.data.svg);
      onReadyRef.current(res.data.captchaId);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
      <div dangerouslySetInnerHTML={{ __html: svg }} style={{ cursor: 'pointer', border: '1px solid var(--accent)', borderRadius: '4px' }} onClick={refresh} />
      <button type="button" className="btn btn-neon-outline btn-sm" onClick={refresh}><i className="fas fa-sync-alt"></i></button>
    </div>
  );
}
