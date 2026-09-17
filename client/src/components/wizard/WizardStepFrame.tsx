import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Card } from '../../design-system';

interface WizardStepFrameProps {
  title: string;
  subtitle: string;
  backTo?: string;
  nextTo?: string;
  primaryLabel: string;
  nextDisabled?: boolean;
  nextHint?: string;
  children: ReactNode;
}

export const WizardStepFrame = ({ title, subtitle, backTo, nextTo, primaryLabel, nextDisabled = false, nextHint, children }: WizardStepFrameProps) => {
  return (
    <section className="chama360-wizard-step-frame" aria-labelledby={`wizard-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)] px-4 py-3">
        <h3 id={`wizard-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="font-black text-[var(--ds-secondary)]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--ds-text-muted)]">{subtitle}</p>
      </div>

      <div className="chama360-wizard-body">{children}</div>

      <Card className="chama360-wizard-actions overflow-hidden p-4">
        <div className="flex flex-wrap gap-3">
          {backTo ? (
            <Link to={backTo} className="flex-1 min-w-[8rem]">
              <Button variant="outline" className="w-full" startIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
            </Link>
          ) : null}
          {nextTo ? (
            <Link to={nextDisabled ? '#' : nextTo} aria-disabled={nextDisabled} onClick={(event) => { if (nextDisabled) event.preventDefault(); }} className="flex-1 min-w-[8rem]">
              <Button disabled={nextDisabled} className="w-full" startIcon={<ArrowRight className="h-4 w-4" />}>
                {primaryLabel}
              </Button>
            </Link>
          ) : null}
          {nextDisabled && nextHint ? <p className="w-full text-sm font-semibold text-amber-700" role="status">{nextHint}</p> : null}
        </div>
      </Card>
    </section>
  );
};
