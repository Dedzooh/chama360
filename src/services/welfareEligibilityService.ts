import { BadRequestError, ForbiddenError } from '../middleware/errorHandler';
import { evaluateWelfareEligibility } from './welfareGuardrails';

type EligibilityContext = {
  requireOrganizationStatus: (organizationId: string) => Promise<any>;
  findMember: (organizationId: string, memberId: string) => Promise<any>;
};

export const enforceWelfareEligibility = async (organizationId: string, memberId: string, claimType: string, amountRequested: number, documents: string[], context: EligibilityContext) => {
  const organization = await context.requireOrganizationStatus(organizationId);
  const membership = await context.findMember(organizationId, memberId);
  const ruleSet = ((organization.metadata as Record<string, unknown>)?.welfareRules ?? (organization.metadata as Record<string, unknown>)?.welfare ?? {}) as any;
  const result = evaluateWelfareEligibility({ organization, member: membership, rules: ruleSet, memberId, claimType, amountRequested, documents });
  if (!result.valid) {
    const firstError = result.errors[0];
    if (firstError?.includes('disabled') || firstError?.includes('not linked') || firstError?.includes('not enabled')) throw new ForbiddenError(firstError);
    throw new BadRequestError(firstError || 'Welfare claim is not eligible');
  }
  return { organization, linkedChamaId: organization.chama?.id, ruleSet, selectedCategory: result.selectedCategory };
};
