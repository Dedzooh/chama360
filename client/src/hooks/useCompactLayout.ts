import { useEffect, useState } from 'react';

const COMPACT_LAYOUT_QUERY = '(max-width: 767px)';

const getInitialValue = () => typeof window !== 'undefined' && window.matchMedia(COMPACT_LAYOUT_QUERY).matches;

/** Selects one responsive composition instead of rendering duplicate page trees. */
export const useCompactLayout = () => {
  const [compact, setCompact] = useState(getInitialValue);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const update = (event?: MediaQueryListEvent) => setCompact(event ? event.matches : media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return compact;
};
