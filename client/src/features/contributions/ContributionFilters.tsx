type ContributionFiltersProps = {
  active: 'all' | 'paid' | 'pending' | 'reversed';
  onChange: (value: 'all' | 'paid' | 'pending' | 'reversed') => void;
};

export const ContributionFilters = ({ active, onChange }: ContributionFiltersProps) => (
  <div className="flex flex-wrap gap-2">
    {(['all', 'paid', 'pending', 'reversed'] as const).map((filter) => (
      <button
        key={filter}
        type="button"
        onClick={() => onChange(filter)}
        className={`rounded-full border px-3 py-1.5 text-sm font-medium ${active === filter ? 'border-[var(--ds-primary)] bg-[var(--ds-primary)] text-white' : 'border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-secondary)]'}`}
      >
        {filter.charAt(0).toUpperCase() + filter.slice(1)}
      </button>
    ))}
  </div>
);