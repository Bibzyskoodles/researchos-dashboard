/**
 * The export that did nothing, and the error message that sent us to the wrong repo.
 *
 * Ada generated a nine-question survey. "Export → JSON" did nothing. "Export →
 * ODK" did nothing. "Deploy to KoboToolbox" said:
 *
 *     Cannot read properties of undefined (reading 'replace')
 *
 * One cause. /questionnaire/generate returned { sections, model } and nothing
 * else — no title. GeneratedQuestionnaire.title is typed as required, but it is
 * assigned from `res.data`, so TypeScript never checks it and `undefined`
 * flowed through happily until something called a string method on it. Every
 * export names its download after the title. So every export threw.
 *
 * The server is fixed (test_questionnaire_export.py). This is the other half:
 * a questionnaire that reaches this panel without a title — one saved before
 * today, or hand-edited — must still export.
 *
 * The second half of the damage was the error handling. `catch { setError(...) }`
 * caught without binding and blamed the server every time, including for the
 * JSON export, which makes no network call at all. The one thing it could never
 * be was a server problem, and that is the only thing it ever said.
 */

import { describeExportError, questionnaireTitle, safeFileStem } from './ExportPanel';
import type { GeneratedQuestionnaire } from './types';

// What the server actually sent, before today. Cast because this shape is
// precisely what the type system was promised and did not get.
const UNTITLED = { sections: [] } as unknown as GeneratedQuestionnaire;

describe('a questionnaire with no title still exports', () => {
  it('does not throw on the exact payload the server used to return', () => {
    // The reported crash, reduced to one line.
    expect(() => safeFileStem(UNTITLED)).not.toThrow();
    expect(() => questionnaireTitle(UNTITLED)).not.toThrow();
  });

  it('names it something a person would recognise', () => {
    expect(questionnaireTitle(UNTITLED)).toBe('Research Questionnaire');
  });

  it('keeps a real title when there is one', () => {
    const q = { title: 'FieldScore Benchmark Survey 2026' } as GeneratedQuestionnaire;
    expect(questionnaireTitle(q)).toBe('FieldScore Benchmark Survey 2026');
    expect(safeFileStem(q)).toBe('FieldScore_Benchmark_Survey_2026');
  });

  it('survives every shape a missing title actually takes', () => {
    const bad = [undefined, null, '', '   ', 42, {}, []];
    for (const title of bad) {
      const q = { title } as unknown as GeneratedQuestionnaire;
      expect(() => safeFileStem(q)).not.toThrow();
      expect(safeFileStem(q).length).toBeGreaterThan(0);
    }
  });

  it('never produces a filename that is only an extension', () => {
    // "…/" and "###" reduce to nothing once non-alphanumerics are stripped.
    // A stem of "" makes the download ".json", which browsers refuse to save —
    // the click would appear to do nothing, which is the original symptom
    // arriving by a different route.
    for (const title of ['###', '   ...   ', '///', '—']) {
      const q = { title } as GeneratedQuestionnaire;
      expect(safeFileStem(q)).not.toBe('');
      expect(safeFileStem(q)).toBe('questionnaire');
    }
  });

  it('does not leave leading or trailing underscores on the filename', () => {
    const q = { title: '  FieldScore 2026!  ' } as GeneratedQuestionnaire;
    expect(safeFileStem(q)).toBe('FieldScore_2026');
  });
});

describe('the error message points at the thing that broke', () => {
  it('does not blame the server for a fault in the browser', () => {
    // This is the regression that matters most. The JSON export never touches
    // the network; telling someone their export endpoint is missing sends them
    // to the backend to look for a bug that is in front of them.
    const msg = describeExportError(new TypeError("Cannot read properties of undefined"), 'json');
    expect(msg).toContain('browser');
    expect(msg).toContain('Nothing was sent to the server');
    expect(msg).not.toMatch(/endpoint/i);
  });

  it('repeats the browser error rather than swallowing it', () => {
    const msg = describeExportError(new TypeError("reading 'replace'"), 'json');
    expect(msg).toContain("reading 'replace'");
  });

  it('reports a server failure as a server failure, with its status', () => {
    const msg = describeExportError({ response: { status: 500, data: {} } }, 'odk');
    expect(msg).toContain('500');
    expect(msg).toContain('server');
  });

  it('names an expired session instead of calling it a server error', () => {
    for (const status of [401, 403]) {
      const msg = describeExportError({ response: { status, data: {} } }, 'docx');
      expect(msg.toLowerCase()).toContain('sign in');
    }
  });

  it('says which format failed, whatever the cause', () => {
    const cases: unknown[] = [
      new TypeError('boom'),
      { response: { status: 500, data: {} } },
      { message: 'Network Error' },
      {},
    ];
    for (const e of cases) {
      expect(describeExportError(e, 'odk')).toContain('ODK');
    }
  });

  it('always produces something, never an empty message', () => {
    // An empty error string renders as a blank red box, which reads as a
    // glitch rather than a report.
    for (const e of [null, undefined, 0, '', {}]) {
      expect(describeExportError(e, 'json').trim().length).toBeGreaterThan(0);
    }
  });
});

describe('the panel no longer builds Kobo assets in the browser', () => {
  const fs = require('fs');
  const path = require('path');
  const raw: string = fs.readFileSync(path.join(__dirname, 'ExportPanel.tsx'), 'utf8');

  // Assert on code, not prose. These checks are "this pattern is gone", and a
  // comment explaining why it is gone contains the pattern verbatim — so
  // searching the raw file fails the moment the fix is documented, which is
  // precisely backwards. Strip comments first.
  const src: string = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');

  it('sends the questionnaire and lets the server convert it', () => {
    // The browser's own copy of the question-type mapping knew only ODK's
    // names, so a FieldScore gps/image/audio question matched nothing and
    // deployed as a plain text box — a form that collected none of the evidence
    // the platform exists to verify, with no error anywhere.
    expect(src).toContain('orgSettingsApi.publishToKobo(');
    expect(src).not.toContain('questionnaireToKoboContent');
  });

  it('no longer calls .replace directly on the title', () => {
    expect(src).not.toContain('questionnaire.title.replace');
  });

  it('binds the caught error instead of discarding it', () => {
    expect(src).toContain('describeExportError(e, format)');
    expect(src).not.toMatch(/}\s*catch\s*{\s*\n\s*setError\(`Export failed/);
  });
});

/**
 * The saved questionnaire that never came back.
 *
 * WorkspacePhase has always POSTed to /api/projects/<id>/questionnaire, and the
 * backend has always served the matching GET. Nothing ever called it. So the
 * designer opened at the consultation every time — you could design a
 * questionnaire, save it, walk to Collect and back, and be asked to describe
 * your study from scratch while the saved copy sat on the server untouched.
 *
 * Losing work you were explicitly told was saved is worse than never offering
 * to save it.
 */
describe('a saved questionnaire is reopened, not re-asked for', () => {
  const fs = require('fs');
  const path = require('path');
  const src: string = fs.readFileSync(path.join(__dirname, 'QuestionnairePage.tsx'), 'utf8');

  it('asks the server for the project"s saved questionnaire', () => {
    expect(src).toContain('/questionnaire`)');
    expect(src).toContain('api.get(');
  });

  it('opens straight into the workspace when one exists', () => {
    expect(src).toContain("phase: 'workspace'");
  });

  it('backfills a saved questionnaire that predates the title fix', () => {
    // This is the case that matters most: everything saved before today has no
    // title, so reopening one without backfilling would reproduce the exact
    // export crash the server fix just closed.
    expect(src).toContain('backfillMissingFields(saved)');
  });

  it('does not treat "no saved questionnaire" as an error', () => {
    // A new project has none. Showing a failure banner there would make a
    // working project look broken.
    expect(src).toContain('.catch(() => {})');
  });
});

describe('a failed save says why', () => {
  const fs = require('fs');
  const path = require('path');
  const src: string = fs.readFileSync(path.join(__dirname, 'WorkspacePhase.tsx'), 'utf8');

  it('reads the server"s explanation instead of discarding it', () => {
    expect(src).toContain('err?.response?.data?.error');
    expect(src).not.toMatch(/}\s*catch\s*{\s*\n\s*setSaveState\('error'\)/);
  });

  it('does not clear the failure after a few seconds', () => {
    // The old handler reset to 'idle' on a timer, so a failed save ended up
    // looking identical to a successful one while the work was still unstored.
    const handler = src.slice(src.indexOf('const handleSave'), src.indexOf('return (', src.indexOf('const handleSave')));
    expect(handler).not.toMatch(/catch[\s\S]*setTimeout\(\(\) => setSaveState\('idle'\)/);
  });
});
