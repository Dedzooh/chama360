type RecordContributionModalProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
};

export const RecordContributionModal = ({ open, title, children }: RecordContributionModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="w-full max-w-lg rounded-[var(--ds-radius-xl)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-[var(--ds-shadow-card)]">
        <h3 className="text-lg font-black text-[var(--ds-secondary)]">{title}</h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};