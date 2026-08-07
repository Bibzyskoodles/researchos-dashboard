/**
 * The import modal must not understate what the platform can do.
 *
 * "Connect a data source" is where somebody looks to answer the only question
 * that matters before buying: can you take my data? It listed four sources and
 * disabled three — while ODK Central and CSV/Excel were both fully built and
 * working on the Integrations page, backend routes and all.
 *
 * That is the mirror of the overclaiming problem on the certificate, and it is
 * the more expensive one: overclaiming loses trust when someone checks, and
 * underclaiming loses the deal before anyone checks.
 *
 * This test pins the labels to reality so the two drift apart loudly rather
 * than quietly.
 */

export {};

const fs = require('fs');
const path = require('path');

const src: string = fs.readFileSync(
  path.join(__dirname, 'ProjectsPage.tsx'), 'utf8');

// The PLATFORMS literal, which is what the modal renders from.
const platformsBlock: string = src.slice(
  src.indexOf('const PLATFORMS = ['),
  src.indexOf('] as const;', src.indexOf('const PLATFORMS = [')),
);

const apiSrc: string = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'api.ts'), 'utf8');

function entry(id: string): string {
  const line = platformsBlock.split('\n').find(l => l.includes(`id: '${id}'`));
  if (!line) throw new Error(`no PLATFORMS entry for ${id}`);
  return line;
}

describe('every source it offers is one that works', () => {
  it('does not call ODK "coming soon" while shipping an ODK client', () => {
    // odkImport/odkPing/odkSaveConfig exist in api.ts and odk_routes.py exists
    // in the backend. A platform is real once its routes exist.
    expect(apiSrc).toContain('odkImport');
    expect(entry('odk')).not.toMatch(/Coming soon/i);
    expect(entry('odk')).toContain("goto: '/integrations'");
  });

  it('does not call CSV upload "coming soon" while shipping the upload', () => {
    expect(apiSrc).toContain('uploadSubmissions');
    expect(entry('csv')).not.toMatch(/Coming soon/i);
    expect(entry('csv')).toContain("goto: '/integrations'");
  });

  it('does not call SurveyCTO "coming soon" while shipping a SurveyCTO client', () => {
    // This test used to assert the opposite, and was right to: surveycto had no
    // *_routes.py, so it must not have acquired a destination leading somewhere
    // it could not be set up. surveycto_routes.py exists now and the
    // Integrations page has the card, so the claim flips with the backend
    // rather than ahead of it — which is the whole point of pinning it here.
    expect(apiSrc).toContain('surveyctoImport');
    expect(entry('surveycto')).not.toMatch(/Coming soon|Not connected/i);
    expect(entry('surveycto')).toContain("goto: '/integrations'");
  });

  it('still says so plainly for anything that genuinely is not built', () => {
    // Honesty runs both ways. A source with no backend must not acquire a
    // destination that leads somewhere it cannot be set up — so any entry
    // without a goto must also say it is not available, and vice versa.
    const lines = platformsBlock.split('\n').filter(l => l.includes("id: '"));
    for (const line of lines) {
      const hasDestination = !line.includes("goto: ''");
      const claimsUnavailable = /Coming soon|Not connected/i.test(line);
      expect(hasDestination && claimsUnavailable).toBe(false);
    }
  });
});

describe('a source that leads nowhere is not clickable', () => {
  it('disables entries with neither an inline flow nor a destination', () => {
    expect(src).toContain('disabled={!p.live && !p.goto}');
  });

  it('routes the ones that are set up elsewhere', () => {
    expect(src).toContain('if (p.goto) navigate(p.goto);');
  });

  it('distinguishes "set up elsewhere" from "not built" in the badge', () => {
    // One SOON badge across both would put a working integration and an
    // absent one in the same visual bucket, which is how this drifted.
    expect(src).toContain('SET UP');
    expect(src).toContain('SOON');
  });
});
