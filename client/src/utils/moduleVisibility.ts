import {
  type EnabledModules,
  type ModuleKey,
  type Organization,
  isModuleEnabled,
  MODULE_KEYS,
} from "../config/chamaBlueprint";

export const getVisibleModules = (enabledModules: EnabledModules) => {
  return MODULE_KEYS.filter((moduleKey) => isModuleEnabled(enabledModules, moduleKey));
};

export const canAccessModule = (organization: Pick<Organization, "enabledModules">, module: ModuleKey) => {
  return isModuleEnabled(organization.enabledModules, module);
};
