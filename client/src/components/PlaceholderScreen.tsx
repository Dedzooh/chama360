import { Layout } from "./Layout";

type PlaceholderScreenProps = {
  title: string;
  subtitle: string;
  items: string[];
};

export const PlaceholderScreen = ({ title, subtitle, items }: PlaceholderScreenProps) => {
  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div className="fade-up">
          <p className="label">APK Screen</p>
          <h1 className="text-3xl font-bold mt-2">{title}</h1>
          <p className="text-(--muted) mt-2 max-w-2xl">{subtitle}</p>
        </div>

        <div className="panel p-6 rounded-3xl">
          <h2 className="text-lg font-semibold mb-4">Core sections</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((item) => (
              <div key={item} className="p-4 rounded-2xl border border-(--border) bg-white/70">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};
