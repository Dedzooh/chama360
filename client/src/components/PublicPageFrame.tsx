import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { BrandLockup } from './BrandLogo';

interface PublicPageFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  navigation?: ReactNode;
  width?: 'narrow' | 'wide';
}

export const PublicPageFrame = ({
  eyebrow,
  title,
  description,
  children,
  navigation,
  width = 'wide',
}: PublicPageFrameProps) => (
  <main className="public-page-frame">
    <div className={width === 'narrow' ? 'public-page-container public-page-container-narrow' : 'public-page-container'}>
      <header className="public-page-hero">
        <div className="public-page-brand-row">
          <Link to={ROUTES.auth.splash} aria-label="CHAMA360 home"><BrandLockup label="CHAMA360" /></Link>
          <Link className="public-page-back" to={ROUTES.auth.splash}><ArrowLeft aria-hidden="true" /> Home</Link>
        </div>
        <p className="public-page-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="public-page-description">{description}</p>
      </header>
      {navigation ? <div className="public-page-navigation">{navigation}</div> : null}
      <div className="public-page-content">{children}</div>
    </div>
  </main>
);
