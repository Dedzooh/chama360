jest.mock('../config/environment', () => ({
  config: { server: { webUrl: 'https://chamaz360.co.ke/' } },
}));

import { createPublicHashUrl } from '../utils/publicWebUrl';

describe('createPublicHashUrl', () => {
  it('creates a production hash-router invitation URL', () => {
    expect(createPublicHashUrl('/org-invite/invite-token')).toBe(
      'https://chamaz360.co.ke/#/org-invite/invite-token',
    );
  });

  it('normalizes paths without a leading slash', () => {
    expect(createPublicHashUrl('join/chama-token')).toBe(
      'https://chamaz360.co.ke/#/join/chama-token',
    );
  });
});
