import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ROUTES } from '../config/routes';
import {
  createCustomModuleKey,
  getDefaultEnabledModules,
  getModuleLabel,
  getWizardRouteAfter,
  isCustomModuleKey,
  MODULE_DETAILS,
  MODULE_DEPENDENCIES,
  MODULE_REQUIRED_PLAN,
  MODULE_KEYS,
  ChamaType,
  toggleModuleWithDependencies,
} from '../config/chamaBlueprint';
import { useWizardContext } from '../components/wizard/WizardLayout';
import { WizardStepFrame } from '../components/wizard/WizardStepFrame';
import { Badge, Button, Card, Chip, TextField } from '../design-system';

export const EnableModulesStep = () => {
  const { draft, updateDraft } = useWizardContext();
  const [customFeatureName, setCustomFeatureName] = useState('');
  const [customFeatureError, setCustomFeatureError] = useState('');
  const selectedType = draft.chamaType as ChamaType;
  const recommendedModules = useMemo(() => getDefaultEnabledModules(selectedType), [selectedType]);
  const customFeatures = Object.keys(draft.enabledModules).filter((key) => isCustomModuleKey(key) && draft.enabledModules[key]);

  const addCustomFeature = () => {
    const key = createCustomModuleKey(customFeatureName);
    if (!key) {
      setCustomFeatureError('Enter a feature name first.');
      return;
    }

    if (draft.enabledModules[key]) {
      setCustomFeatureError('That feature is already enabled.');
      return;
    }

    updateDraft({ enabledModules: { ...draft.enabledModules, [key]: true } });
    setCustomFeatureName('');
    setCustomFeatureError('');
  };

  const removeCustomFeature = (key: string) => {
    const nextModules = { ...draft.enabledModules };
    delete nextModules[key];
    updateDraft({ enabledModules: nextModules });
  };

  return (
    <WizardStepFrame
      title="Enable modules"
      subtitle="Choose the features this Chama needs. Start with the recommended setup, then add custom capabilities."
      backTo={ROUTES.createChama.details}
      nextTo={getWizardRouteAfter('enable_modules', draft.enabledModules)}
      primaryLabel="Next"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULE_KEYS.map((moduleKey) => {
          const enabled = Boolean(draft.enabledModules[moduleKey]);
          const recommended = Boolean(recommendedModules[moduleKey]);
          const detail = MODULE_DETAILS[moduleKey];

          return (
            <button
              key={moduleKey}
              type="button"
              onClick={() => updateDraft({ enabledModules: toggleModuleWithDependencies(draft.enabledModules, moduleKey) })}
              className={`flex h-full flex-col rounded-[var(--ds-radius-xl)] border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-card)] ${
                enabled
                  ? 'border-[rgba(15,132,95,0.32)] bg-[rgba(15,132,95,0.08)]'
                  : 'border-[var(--ds-border)] bg-[var(--ds-surface-3)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-bold text-[var(--ds-secondary)]">{detail.label}</p>
                <div className="flex flex-wrap justify-end gap-2">
                  {MODULE_REQUIRED_PLAN[moduleKey] ? <Badge tone="accent">{MODULE_REQUIRED_PLAN[moduleKey]} plan</Badge> : <Badge tone="neutral">Core</Badge>}
                  <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'On' : 'Off'}</Badge>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--ds-text-muted)]">{detail.description}</p>
              {MODULE_DEPENDENCIES[moduleKey]?.length ? <p className="mt-3 text-xs font-semibold text-[var(--ds-text-secondary)]">Requires {MODULE_DEPENDENCIES[moduleKey]!.map(getModuleLabel).join(' and ')} · enabled automatically</p> : null}
              {recommended ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ds-primary-strong)]">Recommended for this type</p> : null}
            </button>
          );
        })}
      </div>

      <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-black">Plan access is confirmed before payment</p>
        <p className="mt-1 leading-6">You can include paid modules in the setup. The Chama is saved first, then CHAMA360 shows the minimum plan required to unlock them for the whole organization.</p>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <TextField
            label="Custom feature"
            placeholder="e.g. Burial committee, school fees support, asset register"
            value={customFeatureName}
            onChange={(event) => {
              setCustomFeatureName(event.target.value);
              setCustomFeatureError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustomFeature();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addCustomFeature} startIcon={<Plus className="h-4 w-4" />}>
            Add feature
          </Button>
        </div>

        {customFeatureError ? <p className="text-sm font-medium text-rose-700">{customFeatureError}</p> : null}

        {customFeatures.length ? (
          <div className="flex flex-wrap gap-2">
            {customFeatures.map((featureKey) => (
              <Chip key={featureKey} active className="gap-2 pr-2">
                {getModuleLabel(featureKey)}
                <button type="button" onClick={() => removeCustomFeature(featureKey)} className="rounded-full p-0.5 hover:bg-[rgba(15,132,95,0.1)]" aria-label={`Remove ${getModuleLabel(featureKey)}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--ds-text-muted)]">Add any feature that is specific to your group's constitution or way of working.</p>
        )}
      </Card>
    </WizardStepFrame>
  );
};
