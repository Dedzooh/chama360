import { Link } from 'react-router-dom';

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  items: string[];
  actionLabel?: string;
  actionTo?: string;
}

export const PlaceholderPage = ({ title, subtitle, items, actionLabel, actionTo }: PlaceholderPageProps) => {
  return (
    <div className="space-y-6">
      <section className="hero-card overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="label">Phase 1</p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-(--muted)">{subtitle}</p>
          </div>
          {actionLabel && actionTo ? (
            <Link to={actionTo} className="btn btn-primary self-start whitespace-nowrap">
              {actionLabel}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="dashboard-tile px-4 py-4">
            <p className="font-semibold text-(--secondary)">{item}</p>
          </div>
        ))}
      </section>
    </div>
  );
};
