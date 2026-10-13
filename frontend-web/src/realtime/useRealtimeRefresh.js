import { useEffect, useRef } from 'react';

export function useRealtimeRefresh(eventTypes, refresh) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const typesKey = [...eventTypes].sort().join('|');

  useEffect(() => {
    let timer;
    const types = new Set(typesKey.split('|'));
    const handler = (event) => {
      const detail = event?.detail;
      if (!detail) return;

      const directType = detail.type || detail.notificationType || detail.eventType || detail.notification?.type;
      const refType = detail.referenceType;

      const isDispute =
        refType === 'DISPUTE' ||
        (typeof directType === 'string' && (directType.startsWith('DISPUTE_') || directType.includes('DISPUTE')));

      const isTermination =
        refType === 'TERMINATION' ||
        (typeof directType === 'string' && (directType.startsWith('TERMINATION_') || directType.includes('TERMINATION')));

      const isClass =
        refType === 'CLASS' ||
        (typeof directType === 'string' && (directType.startsWith('CLASS_') || directType.includes('CLASS')));

      const matches =
        Boolean(directType && types.has(directType)) ||
        (isDispute && (
          types.has('DISPUTE_MUTATED') ||
          types.has('DISPUTE_OPENED') ||
          types.has('DISPUTE_UPDATED') ||
          types.has('DISPUTE_RESOLVED')
        )) ||
        (isTermination && (
          types.has('TERMINATION_MUTATED') ||
          types.has('TERMINATION_UPDATED') ||
          types.has('TERMINATION_COMPLETED')
        )) ||
        (isClass && (
          types.has('CLASS_MUTATED') ||
          types.has('CLASS_REVIEWED')
        ));

      if (!matches) return;
      clearTimeout(timer);
      timer = setTimeout(() => refreshRef.current(detail), 120);
    };

    window.addEventListener('realtime:event', handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('realtime:event', handler);
    };
  }, [typesKey]);
}
