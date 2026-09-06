import { useRef } from 'react';
import { ROUTES } from '../config/routes';
import { useWizardContext } from '../components/wizard/WizardLayout';
import { WizardStepFrame } from '../components/wizard/WizardStepFrame';
import { Badge, Button, Card, TextField } from '../design-system';

export const ChamaDetailsStep = () => {
  const { draft, updateDraft } = useWizardContext();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const validName = draft.name.trim().length >= 3;
  const validShortCode = !draft.shortCode.trim() || draft.shortCode.trim().length >= 3;

  const readFileAsDataUrl = (file: File, onDone: (value: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onDone(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <WizardStepFrame
      title="Chama details"
      subtitle="Capture the identity, branding, and contact details for this Chama."
      backTo={ROUTES.createChama.type}
      nextTo={ROUTES.createChama.modules}
      primaryLabel="Next"
      nextDisabled={!validName || !validShortCode}
      nextHint={!validName ? 'Enter a Chama name with at least 3 characters to continue.' : !validShortCode ? 'Use at least 3 characters for the short code, or leave it blank.' : undefined}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <Card className="space-y-4 p-5">
          <div className="aspect-[4/3] overflow-hidden rounded-[var(--ds-radius-lg)] border border-dashed border-[var(--ds-border)] bg-[var(--ds-surface-2)]">
            {draft.coverImageUrl ? (
              <img src={draft.coverImageUrl} alt="Cover preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--ds-text-muted)]">
                Upload a cover image to brand the workspace header.
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--ds-secondary)]">Cover image</p>
              <p className="text-sm text-[var(--ds-text-muted)]">Wide image for the chama header and workspace intro.</p>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                readFileAsDataUrl(file, (coverImageUrl) => updateDraft({ coverImageUrl, metadata: { ...(draft.metadata ?? {}), coverImageName: file.name } }));
              }}
            />
            <Button variant="outline" onClick={() => coverInputRef.current?.click()}>
              Choose cover
            </Button>
          </div>
          <TextField label="Cover URL" placeholder="https://..." value={draft.coverImageUrl ?? ''} onChange={(event) => updateDraft({ coverImageUrl: event.target.value })} />
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)]">
              {draft.logoUrl ? <img src={draft.logoUrl} alt="Logo preview" className="h-full w-full object-cover" /> : <Badge tone="neutral">Logo</Badge>}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[var(--ds-secondary)]">Logo</p>
              <p className="text-sm text-[var(--ds-text-muted)]">Square logo used across the workspace.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                readFileAsDataUrl(file, (logoUrl) => updateDraft({ logoUrl, metadata: { ...(draft.metadata ?? {}), logoFileName: file.name } }));
              }}
            />
            <Button variant="outline" onClick={() => logoInputRef.current?.click()}>
              Upload logo
            </Button>
          </div>
          <TextField label="Logo URL" placeholder="https://..." value={draft.logoUrl ?? ''} onChange={(event) => updateDraft({ logoUrl: event.target.value })} />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Chama name" placeholder="For example: Wealth Builders Chama" value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
        <TextField label="Short code (optional)" placeholder="For example: WBC" value={draft.shortCode} onChange={(event) => updateDraft({ shortCode: event.target.value })} />
        <label className="md:col-span-2 block">
          <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Description</span>
          <textarea
            className="min-h-28 w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3 text-sm outline-none transition focus:border-[var(--ds-primary)] focus:ring-4 focus:ring-[var(--ds-ring)]"
            rows={4}
            value={draft.description}
            onChange={(event) => updateDraft({ description: event.target.value })}
          />
        </label>
        <TextField label="County" value={draft.county} onChange={(event) => updateDraft({ county: event.target.value })} />
        <TextField label="Town" value={draft.town} onChange={(event) => updateDraft({ town: event.target.value })} />
        <div className="md:col-span-2">
          <TextField label="Phone" value={draft.phone} onChange={(event) => updateDraft({ phone: event.target.value })} />
        </div>
      </div>
    </WizardStepFrame>
  );
};
