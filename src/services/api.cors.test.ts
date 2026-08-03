/**
 * The dashboard's half of the CORS contract with the API.
 *
 * On 2 August the backend removed `supports_credentials=True` from its CORS
 * configuration — correctly, because it sets no cookie and reads none; auth is
 * a Bearer token on the Authorization header. But this file kept creating its
 * axios instance with `withCredentials: true`, under a comment claiming it sent
 * httpOnly cookies that do not exist.
 *
 * Asking for credentialed CORS makes the browser *require* an
 * `Access-Control-Allow-Credentials: true` header before it will hand a
 * response body to JavaScript. The backend deliberately does not send one, so
 * the browser discarded every response the server answered correctly. Sign-in
 * and sign-up were both dead for a day.
 *
 * Nothing caught it. The build passed, the server was healthy, curl worked, and
 * a plain fetch() from the deployed login page worked — because none of those
 * enforce the credentials rule. Only a real browser running this axios instance
 * did, and the only symptom was a generic "Login failed" that read like a
 * rejected password.
 *
 * The contract's other half lives in fieldscore-backend's
 * `test_cors_contract.py`, which pins `supports_credentials` off there. Neither
 * repo can see the other, so each pins its own side and explains the whole
 * invariant. If someone genuinely needs cookie auth one day, both sides have to
 * change together — and these two tests are what force that conversation.
 */

import api, { API_BASE_URL } from './api';

describe('CORS contract with the FieldScore API', () => {
  it('does not request credentialed CORS', () => {
    // Falsy rather than strictly `false`: axios leaves this undefined by
    // default, and undefined is the correct, intended state. What must never
    // happen is it being truthy.
    expect(api.defaults.withCredentials).toBeFalsy();
  });

  it('sends the session token as an Authorization header, not a cookie', () => {
    // The positive half of the same invariant. Dropping withCredentials is only
    // safe because auth travels in a header — if this stopped being true, the
    // test above would be guarding nothing and sessions would silently break.
    localStorage.setItem('fs_token', 'test-token-value');

    const handler = (api.interceptors.request as any).handlers.find(
      (h: any) => h && typeof h.fulfilled === 'function',
    );
    expect(handler).toBeDefined();

    const config = handler.fulfilled({ headers: {} as Record<string, string> });
    expect(config.headers.Authorization).toBe('Bearer test-token-value');

    localStorage.removeItem('fs_token');
  });

  it('talks to an absolute https origin, so CORS actually applies', () => {
    // A relative or http base would mean these rules are not in play at all,
    // and this contract would be silently testing nothing.
    expect(API_BASE_URL).toMatch(/^https:\/\//);
  });
});
