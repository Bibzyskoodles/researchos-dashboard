/**
 * Ada proposes the verification setup; a human clicks; the server re-derives.
 *
 * The derivation rules themselves are tested on the server, where they live
 * (fieldscore-backend/test_ada_project_config.py). What is testable here is the
 * shape of the interaction, and the two decisions that shape it
 * (docs/ada_project_configuration_spec.md):
 *
 *   1. The card appears automatically, so it must take "not now" for an answer.
 *   2. One click applies all of it — which raises the bar on the card rather
 *      than lowering it. Every line has to carry its evidence.
 *
 * Plus the rule that makes the confirmation mean anything: Apply sends no
 * settings. If the browser posted what it displayed, a caller could edit the
 * payload and the click would be protecting nothing.
 */

// No imports, so without this the file is a global script under
// --isolatedModules: jest runs it happily and the production build fails.
// Exactly the gap CLAUDE.md warns about — the test runner is not the build gate.
export {};

const fs = require('fs');
const path = require('path');

const read = (file: string): string =>
  fs.readFileSync(path.join(__dirname, file), 'utf8');

// Assert on code, not prose — a comment explaining why a pattern is gone
// contains the pattern verbatim.
const code = (file: string): string =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line: string) => !line.trim().startsWith('//'))
    .join('\n');

describe('the click is what applies it', () => {
  const card = code('AdaConfigProposal.tsx');

  it('sends no settings — the server re-derives them', () => {
    // projectsApi.applyConfigProposal takes the project id and nothing else.
    // The moment this card starts posting what it rendered, the confirmation
    // step stops protecting anything: the card is a client-side object.
    expect(card).toContain('applyConfigProposal(projectId)');
    expect(card).not.toMatch(/applyConfigProposal\(projectId,\s*\{/);
    expect(card).not.toContain('proposal.settings.map(s => s.value)');
  });

  it('nothing is applied before the click', () => {
    const beforeApply = card.slice(0, card.indexOf('const apply'));
    expect(beforeApply).not.toContain('applyConfigProposal');
  });

  it('says nothing was changed when applying fails', () => {
    // The worst outcome here is a user who believes their project is
    // configured when it is not — they would then trust scores produced
    // without the context they thought they had set.
    expect(card).toContain('Nothing has been changed');
  });

  it('reads the server"s explanation rather than discarding it', () => {
    expect(card).toContain('err?.response?.data?.error');
  });
});

describe('offered automatically means it must take no for an answer', () => {
  const card = code('AdaConfigProposal.tsx');
  const workspace = code('WorkspacePhase.tsx');

  it('records the dismissal so it stops asking', () => {
    expect(card).toContain('declineConfigProposal(projectId)');
  });

  it('closes even if recording the dismissal fails', () => {
    // Reopening a card the user just dismissed, because a bookkeeping call
    // failed, is the more annoying of the two failures.
    expect(card).toMatch(/declineConfigProposal\(projectId\)\s*\.catch\(\(\) => \{\}\)/);
    expect(card).toContain('onDismissed()');
  });

  it('does not show a proposal the user already handled', () => {
    expect(workspace).toContain('already_handled');
  });

  it('does not show an empty proposal', () => {
    expect(workspace).toMatch(/settings\?\.length \|\| p\.asks\?\.length/);
  });

  it('a failed proposal fetch never reports as a failed save', () => {
    // The save is what the user asked for and it succeeded. A suggestion that
    // could not be fetched is not their problem.
    const saveHandler = workspace.slice(
      workspace.indexOf('const handleSave'),
      workspace.indexOf('return ('),
    );
    expect(saveHandler).toContain('configProposal');
    expect(saveHandler).toMatch(/\.catch\(\(\) => \{\}\)/);
  });

  it('is only offered once the questionnaire is saved', () => {
    // The apply route re-derives from the STORED questionnaire. Offering
    // before a save would propose settings for something the server has never
    // seen, and Apply would fail on a card that looked ready.
    const saveHandler = workspace.slice(
      workspace.indexOf('const handleSave'),
      workspace.indexOf('return ('),
    );
    expect(saveHandler.indexOf("setSaveState('saved')"))
      .toBeLessThan(saveHandler.indexOf('configProposal(projectId)'));
  });
});

describe('one click applies everything, so every line is checkable', () => {
  const card = code('AdaConfigProposal.tsx');

  it('renders the evidence for each setting, not just the value', () => {
    expect(card).toContain('{s.evidence}');
    expect(card).toContain('{s.display}');
  });

  it('renders the asks Ada will not decide herself', () => {
    // The zone and the speaker count. If these render as settings, or not at
    // all, the card is either fabricating a geofence or hiding the fact that
    // location could be verified.
    expect(card).toContain('proposal.asks.map');
    expect(card).toContain('{a.detail}');
  });

  it('renders the scope notes', () => {
    expect(card).toContain('proposal.notes.map');
  });

  it('tells the user the settings are reversible', () => {
    expect(card).toContain('Settings');
  });
});

describe('the questionnaire carries the study it belongs to', () => {
  const page = code('QuestionnairePage.tsx');
  const types = read('types.ts');

  it('saves the consultation alongside the questionnaire', () => {
    // Without it a saved questionnaire cannot say what it is for or how long
    // the interview should take — which is exactly what research_purpose and
    // the duration bounds are derived from.
    expect(types).toContain('consultation?: ConsultationState');
    expect(page).toContain('questionnaire.consultation = consultation');
  });

  it('restores it when the questionnaire is reopened', () => {
    expect(page).toContain('saved.consultation');
  });
});
