import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

export default function useServerTime() {
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const clientBefore = Date.now();
    api.get('/time').then(res => {
      const clientAfter = Date.now();
      const serverTime = res.data.serverTime;
      const clientMid = Math.round((clientBefore + clientAfter) / 2);
      offsetRef.current = serverTime - clientMid;
      setNow(Date.now() + offsetRef.current);
    }).catch(() => {
      offsetRef.current = 0;
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now() + offsetRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return now;
}
