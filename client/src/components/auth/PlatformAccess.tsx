import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import api from '../../config/api';
import { ROUTES } from '../../config/routes';

export const PlatformAccess = () => {
  const location = useLocation();
  const [state, setState] = useState<'loading' | 'allowed' | 'denied' | 'unauthorized'>('loading');

  useEffect(() => {
    let active = true;
    api.get('/platform/subscriptions/access')
      .then(() => { if (active) setState('allowed'); })
      .catch((error) => {
        if (!active) return;
        if (error?.response?.status === 401) { setState('unauthorized'); return; }
        setState('denied');
      });
    return () => { active = false; };
  }, []);

  if (state === 'loading') return <main className="p-8 text-center">Checking platform access...</main>;
  if (state === 'unauthorized') return <Navigate to={ROUTES.auth.login} replace state={{ from: location.pathname }} />;
  if (state === 'denied') {
    return <main className="mx-auto max-w-xl p-8 text-center"><h1 className="text-2xl font-black">403 · Platform access required</h1><p className="mt-3 text-[var(--ds-text-muted)]">This console is separate from Chama administration and is available only to CHAMAZ360 platform administrators.</p><button className="btn btn-primary mt-6" type="button" onClick={() => window.history.back()}>Return</button></main>;
  }
  return <Outlet />;
};