/**
 * "Failed to fetch" on Connect & Sync.
 *
 * That message is the native fetch() failure, not an error the server sent —
 * the browser discarded the response before any code saw it. The cause was
 * `credentials: "include"` on a cross-origin request: it obliges the server to
 * answer with Access-Control-Allow-Credentials and a non-wildcard origin, and
 * this backend deliberately authenticates by Bearer header rather than by
 * cookie (see CLAUDE.md — cookies would give away the CSRF immunity header
 * auth provides). So a perfectly good response was rejected by the browser,
 * and the screen blamed the network.
 *
 * The hand-rolled fetch also skipped everything the api instance does: auth
 * header injection and the refresh-token retry among them.
 */

export {};

const fs = require('fs');
const path = require('path');

const pages = ['InsightsPage.tsx', 'InsightProjectPage.tsx'];
// Comments are stripped first: this file's own fix carries an explanation
// quoting the offending line, and a naive grep matches the explanation.
const sources: Record<string, string> = {};
for (const p of pages) {
  sources[p] = fs.readFileSync(path.join(__dirname, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line: string) => !line.trim().startsWith('//'))
    .join('\n');
}

describe('the insights pages talk to the backend the way everything else does', () => {
  it.each(pages)('%s sends no cookie credentials', (page) => {
    // The single line that produced "Failed to fetch".
    expect(sources[page]).not.toContain('credentials: "include"');
    expect(sources[page]).not.toContain("credentials: 'include'");
  });

  it.each(pages)('%s does not hand-roll the auth header', (page) => {
    // Reading the token straight out of localStorage duplicates a concern the
    // api instance owns, and silently loses the refresh-token retry with it.
    expect(sources[page]).not.toContain('localStorage.getItem("fs_token")');
  });

  it.each(pages)('%s goes through the api instance for ai-upload', (page) => {
    expect(sources[page]).toMatch(/api\.post\(\s*`\/api\/projects\/[^`]*ai-upload`/);
    expect(sources[page]).not.toMatch(/await fetch\(`\$\{API_BASE_URL\}[^`]*ai-upload/);
  });
});

describe('a failure still reaches the user', () => {
  it('surfaces the connect error rather than swallowing it', () => {
    // Moving to axios changes failures from a non-ok response into a thrown
    // error. If the catch had been dropped the button would spin forever.
    expect(sources['InsightsPage.tsx']).toContain('setConnectError');
    const handler = sources['InsightsPage.tsx'].slice(
      sources['InsightsPage.tsx'].indexOf('const handleConnect'),
      sources['InsightsPage.tsx'].indexOf('const handleConnect') + 1800,
    );
    expect(handler).toContain('catch');
    expect(handler).toContain('finally');
  });
});
