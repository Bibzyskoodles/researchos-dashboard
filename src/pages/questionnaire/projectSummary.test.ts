/**
 * The screen that would have caught 3 August.
 *
 * The questionnaire lives on one screen and the settings on another, and
 * whether a check will actually *run* depends on both. An image check with no
 * description does nothing useful; a zone rule does nothing at all without a
 * zone. Nowhere in the platform said so, and a whole evening went into a
 * setting that had silently failed to save.
 *
 * So the thing worth testing here is not that the summary renders — it is that
 * it renders the *gaps*, leads with them, and never claims a check is running
 * when the server said it is not. Every judgement is made in
 * fieldscore-backend/project_summary.py; this component renders and does not
 * decide, which is the property most of these assertions are about.
 */

export {};

const fs = require('fs');
const path = require('path');

const raw: string = fs.readFileSync(path.join(__dirname, 'ProjectSummary.tsx'), 'utf8');
const src: string = raw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line: string) => !line.trim().startsWith('//'))
  .join('\n');

describe('it renders the server"s judgement, it does not form its own', () => {
  it('reads will_run rather than working it out', () => {
    // The moment this component decides for itself whether a check runs, it can
    // disagree with the engine — which is exactly how the dashboard came to
    // show a flat 15 for a submission the engine had scored 94.
    expect(src).toContain('c.will_run');
    expect(src).not.toContain('image_context');
    expect(src).not.toContain('zone_shape');
    expect(src).not.toMatch(/if\s*\(.*questionnaire\.sections/);
  });

  it('shows the server"s own wording for each check', () => {
    expect(src).toContain('{c.detail}');
  });

  it('takes the gap count from the server too', () => {
    expect(src).toContain('c.fix');
  });
});

describe('gaps come first', () => {
  it('separates checks that will not run from those that will', () => {
    expect(src).toMatch(/gaps\s*=\s*s\.checks\.filter\(c => !c\.will_run && c\.fix\)/);
    expect(src).toMatch(/running\s*=\s*s\.checks\.filter\(c => c\.will_run\)/);
  });

  it('renders the gap block above the running block', () => {
    // A summary that opens with what is working, while something is quietly
    // not, is the screen that would not have caught 3 August.
    expect(src.indexOf('gaps.map')).toBeGreaterThan(-1);
    expect(src.indexOf('running.map')).toBeGreaterThan(-1);
    expect(src.indexOf('gaps.map')).toBeLessThan(src.indexOf('running.map'));
  });

  it('shows the fix next to each gap', () => {
    expect(src).toContain('{c.fix}');
  });

  it('does not nag about evidence the questionnaire never collects', () => {
    // A text-only questionnaire has no photo description to be missing. Those
    // checks come back with no `fix`, and belong in a quiet footnote rather
    // than in the amber block.
    expect(src).toMatch(/!c\.will_run && !c\.fix/);
    expect(raw).toContain('Not applicable to this questionnaire');
  });
});

describe('it says nothing rather than something wrong', () => {
  it('renders nothing at all until the server answers', () => {
    expect(src).toMatch(/if \(!projectId \|\| \(!data && !error\)\) return null/);
  });

  it('renders nothing when there is no questionnaire yet', () => {
    expect(src).toContain('if (!s.has_questionnaire) return null');
  });

  it('surfaces a load failure rather than showing a blank panel', () => {
    // A summary that silently fails to load reads as "nothing to report",
    // which is the more dangerous of the two.
    expect(src).toContain("err?.response?.data?.error");
    expect(src).toContain('if (error)');
  });

  it('does not claim readiness on its own initiative', () => {
    expect(src).toContain('s.ready');
    expect(src).not.toMatch(/gaps\.length === 0 \?\s*'Ready/);
  });
});

describe('it refreshes when the thing it describes changes', () => {
  const workspace: string = fs
    .readFileSync(path.join(__dirname, 'WorkspacePhase.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line: string) => !line.trim().startsWith('//'))
    .join('\n');

  it('refetches after a save', () => {
    // The summary reports what the server has. A save changes what the server
    // has, so a stale summary is a summary that is wrong.
    expect(workspace).toContain('setSummaryNonce');
    const saveHandler = workspace.slice(
      workspace.indexOf('const handleSave'),
      workspace.indexOf('return ('),
    );
    expect(saveHandler).toContain('setSummaryNonce');
  });

  it('refetches after Ada"s proposal is applied', () => {
    expect(workspace).toMatch(/onApplied=\{\(\) => \{[\s\S]*setSummaryNonce/);
  });

  it('sits below the proposal card', () => {
    // The proposal is an offer; the summary is what is true now. Putting the
    // offer second would read as though it had already been applied.
    expect(workspace.indexOf('<ProjectSummary')).toBeGreaterThan(-1);
    expect(workspace.indexOf('<ProjectSummary'))
      .toBeLessThan(workspace.indexOf('<AdaConfigProposal'));
  });
});
