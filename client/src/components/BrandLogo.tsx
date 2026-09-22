interface BrandLogoProps {
  className?: string;
  label?: string;
}

const BRAND_LABEL = 'CHAMAZ360';

export const BrandMark = ({ className = '', label = BRAND_LABEL }: BrandLogoProps) => (
  <span className={`brand-mark ${className}`.trim()} role="img" aria-label={label}>
    <img src="/brand-symbol.svg" alt="" aria-hidden="true" />
  </span>
);

export const BrandFullLogo = ({ className = '', label = BRAND_LABEL }: BrandLogoProps) => (
  <span className={`brand-logo-full ${className}`.trim()} aria-label={label}>
    <BrandMark label="" />
    <span className="brand-logo-full-copy">
      <strong>CHAMA<span>360</span></strong>
      <small>Together · Grow · Prosper</small>
    </span>
  </span>
);

export const BrandLockup = ({ className = '', label = BRAND_LABEL }: BrandLogoProps) => (
  <span className={`brand-lockup ${className}`.trim()} aria-label={label}>
    <BrandMark label="" />
    <span className="brand-lockup-copy">
      <strong>CHAMA<span>360</span></strong>
      <small>Together · Grow · Prosper</small>
    </span>
  </span>
);
