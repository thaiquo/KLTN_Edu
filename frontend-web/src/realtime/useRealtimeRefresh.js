import { useEffect, useRef } from 'react';

export function useRealtimeRefresh(eventTypes, refresh) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const typesKey = [...eventTypes].sort().join('|');

  useEffect(() => {
    let timer;
    const types = new Set(typesKey.split('|'));
    const handler = (event) => {
      if (!types.has(event.detail?.type)) return;
      clearTimeout(timer);
      timer = setTimeout(() => refreshRef.current(event.detail), 120);
    };
    window.addEventListener('realtime:event', handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('realtime:event', handler);
    };
  }, [typesKey]);
}
