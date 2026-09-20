type WelfareClaimReviewProps = {
  title: string;
  children: React.ReactNode;
};

export const WelfareClaimReview = ({ title, children }: WelfareClaimReviewProps) => (
  <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5">
    <h3 className="text-lg font-black text-[var(--ds-secondary)]">{title}</h3>
    <div className="mt-4">{children}</div>
  </div>
);