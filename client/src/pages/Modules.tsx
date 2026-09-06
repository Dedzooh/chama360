import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { CHAMA_BLUEPRINTS, CHAMA_CORE_MODULES, PLATFORM_NAME, PLATFORM_TAGLINE } from "../config/platform";
import { ArrowRight, CheckCircle2, Shield } from "lucide-react";

export const Modules = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <section className="panel p-8 fade-up">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="label">Platform foundation</p>
              <h1 className="text-4xl font-bold mt-2">{PLATFORM_NAME} modules</h1>
              <p className="text-(--muted) mt-3 text-lg">
                {PLATFORM_TAGLINE}. Built to support chamas, welfare groups, SACCOs, and other community groups from the same application.
              </p>
            </div>

            <div className="badge-row">
              <span className="badge">Multi-tenant ready</span>
              <span className="badge hot">APK-friendly</span>
              <span className="badge">Core modules defined</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[
              "One organization per tenant",
              "Role-based access control",
              "Isolated records and reporting",
            ].map((item) => (
              <div key={item} className="p-4 rounded-2xl border border-(--border) bg-white/60">
                <p className="font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 text-(--primary)" />
                  {item}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="label">Chama types</p>
              <h2 className="text-2xl font-bold mt-2">Same app, different chama models</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {CHAMA_BLUEPRINTS.map((org) => (
              <div key={org.kind} className="panel p-5 lively-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-(--muted)">{org.kind}</p>
                    <h3 className="text-xl font-semibold mt-2">{org.title}</h3>
                  </div>
                  <span className="chip">{org.highlight}</span>
                </div>
                <p className="text-sm text-(--muted) mt-3">{org.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="label">Core modules</p>
              <h2 className="text-2xl font-bold mt-2">What each Chama contains</h2>
            </div>
            <Link to="/dashboard" className="btn btn-outline">
              Back to dashboard
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {CHAMA_CORE_MODULES.map((module) => (
              <article
                key={module.key}
                id={module.key}
                className="panel p-6 rounded-3xl border border-(--border)"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="max-w-3xl">
                    <p className="label">{module.iconLabel}</p>
                    <h3 className="text-2xl font-semibold mt-2">{module.title}</h3>
                    <p className="text-(--muted) mt-2">{module.description}</p>
                  </div>
                  {module.outputs?.length ? (
                    <div className="badge-row">
                      {module.outputs.map((output) => (
                        <span key={output} className="badge hot">
                          {output}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-5">
                  {module.fields.map((field) => (
                    <div key={field.label} className="p-4 rounded-2xl border border-(--border) bg-white/70">
                      <p className="font-medium flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-(--primary)" />
                        <span>{field.label}</span>
                      </p>
                      {field.description ? <p className="text-xs text-(--muted) mt-2">{field.description}</p> : null}
                      {field.required ? <p className="text-[10px] uppercase tracking-[0.2em] text-(--accent) mt-2">Required</p> : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel p-8 rounded-3xl border border-(--border)">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <p className="label">Type rules</p>
              <h2 className="text-2xl font-bold mt-2">Chama type sets identity, modules set capability</h2>
              <p className="text-(--muted) mt-2 max-w-2xl">
                Savings, welfare, investment, and Merry-Go-Round groups all use the same core module structure, but each chama can enable only the parts it needs.
              </p>
            </div>

            <Link to="/chamas/create" className="btn btn-primary">
              Create workspace
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
};

