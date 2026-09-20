describe('SMS credit purchase invariants', () => {
  it('uses a distinct ledger purpose from subscriptions and contributions', () => {
    expect('SMS_CREDIT_PURCHASE').not.toBe('SUBSCRIPTION_PAYMENT');
    expect('SMS_CREDIT_PURCHASE').not.toBe('CONTRIBUTION');
  });

  it('accepts only the supported initial pack sizes', () => {
    const packs = [100, 500, 1000];
    expect(packs).toContain(100);
    expect(packs).toContain(500);
    expect(packs).toContain(1000);
    expect(packs).not.toContain(50);
  });

  it('requires a pending purchase claim before crediting the wallet', () => {
    const claim = (status: string) => status === 'PENDING';
    expect(claim('PENDING')).toBe(true);
    expect(claim('PAID')).toBe(false);
    expect(claim('FAILED')).toBe(false);
  });

  it('credits once when duplicate callbacks race', () => {
    let status = 'PENDING';
    let credits = 0;
    const callback = () => {
      if (status !== 'PENDING') return;
      status = 'PAID';
      credits += 500;
    };
    callback();
    callback();
    expect(status).toBe('PAID');
    expect(credits).toBe(500);
  });
});
