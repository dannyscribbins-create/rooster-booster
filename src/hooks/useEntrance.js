import { useState, useEffect } from 'react';

// ─── Animation Hook ───────────────────────────────────────────────────────────
export default function useEntrance(delay = 0, screenKey = '') {
  const [visible, setVisible] = useState(() =>
    screenKey ? !!sessionStorage.getItem(`rb_seen_${screenKey}`) : false
  );
  useEffect(() => {
    if (visible) return;
    const t = setTimeout(() => {
      setVisible(true);
      if (screenKey) sessionStorage.setItem(`rb_seen_${screenKey}`, '1');
    }, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return visible;
}
