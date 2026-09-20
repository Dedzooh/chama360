type LoanApplicationFormProps = {
  children: React.ReactNode;
};

export const LoanApplicationForm = ({ children }: LoanApplicationFormProps) => (
  <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5">
    <h3 className="text-lg font-black text-[var(--ds-secondary)]">Apply for loan</h3>
    <div className="mt-4">{children}</div>
  </div>
);