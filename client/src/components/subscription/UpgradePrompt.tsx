import { Check, Crown, X } from 'lucide-react';
import { FEATURE_COPY, FEATURE_PLAN, PLAN_RANK, SUBSCRIPTION_PLANS } from '../../config/subscriptions';
import { useSubscriptionStore } from '../../store/subscriptionStore';

export const UpgradePrompt = () => {
  const feature = useSubscriptionStore((state) => state.promptFeature);
  const close = useSubscriptionStore((state) => state.closeUpgrade);
  const requestPlan = useSubscriptionStore((state) => state.requestPlan);
  if (!feature) return null;
  const required = FEATURE_PLAN[feature];
  const copy = FEATURE_COPY[feature];
  const plans = SUBSCRIPTION_PLANS.filter((plan) => plan.id !== 'FREE' && PLAN_RANK[plan.id] >= PLAN_RANK[required]).slice(0, 2);
  return (
    <div className="upgrade-overlay" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
      <div className="upgrade-dialog">
        <button type="button" className="upgrade-close" onClick={close} aria-label="Close upgrade prompt"><X /></button>
        <span className="upgrade-crown"><Crown /></span>
        <p className="upgrade-eyebrow">Unlock more with CHAMAZ360</p>
        <h2 id="upgrade-title">Upgrade to use {copy.title}</h2>
        <p className="upgrade-description">{copy.description}</p>
        <div className="upgrade-options">
          {plans.map((plan) => (
            <article key={plan.id} className={plan.popular ? 'is-popular' : ''}>
              {plan.popular ? <span>Most popular</span> : null}
              <h3>{plan.name}</h3>
              <strong>KES {plan.monthlyPrice.toLocaleString()}<small>/month</small></strong>
              <ul>{plan.features.slice(1).map((item) => <li key={item}><Check /> {item}</li>)}</ul>
              <button type="button" onClick={() => void requestPlan(plan.id)}>Choose {plan.name}</button>
            </article>
          ))}
        </div>
        <small className="upgrade-note">No charge is made from this screen. Your payment details and confirmation will be requested securely in the checkout step.</small>
      </div>
    </div>
  );
};
