import type { ReactNode } from 'react';
import { Crown, LockKeyhole } from 'lucide-react';
import type { PremiumFeature } from '../../config/subscriptions';
import { FEATURE_COPY, FEATURE_PLAN } from '../../config/subscriptions';
import { useSubscriptionStore } from '../../store/subscriptionStore';

export const PremiumRoute = ({ feature, children }: { feature: PremiumFeature; children: ReactNode }) => {
  const canUse = useSubscriptionStore((state) => state.canUse);
  const showUpgrade = useSubscriptionStore((state) => state.showUpgrade);
  if (canUse(feature)) return <>{children}</>;
  const copy = FEATURE_COPY[feature];
  return (
    <section className="premium-lock-card">
      <span className="premium-lock-icon"><LockKeyhole /></span>
      <span className="premium-plan-badge"><Crown /> {FEATURE_PLAN[feature]} feature</span>
      <h1>{copy.title}</h1>
      <p>{copy.description}</p>
      <button type="button" onClick={() => showUpgrade(feature)}>View upgrade options</button>
      <small>Your information is safe. You will review the plan and price before any payment step.</small>
    </section>
  );
};
