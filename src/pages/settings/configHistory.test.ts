/**
 * "Who changed this, and when?"
 *
 * The data integrity certificate attests to submissions scored under a
 * particular configuration, and that configuration can be changed afterwards.
 * Until 4 August nothing recorded who did it. Then something did — but only for
 * Ada's proposals, which is arguably worse: a record holding a fraction of the
 * changes reads as complete, and answers "nobody" confidently.
 *
 * The server sends entries already reduced to what actually moved. What is
 * testable here is the rendering, and the rendering has one job beyond looking
 * tidy: never present a value in a way that misleads. "not set" and "null" are
 * different claims, and a truncated description must not read as the whole one.
 */

import { fieldLabel, formatWhen, readableValue, sourceLabel } from './ConfigHistory';

describe('values are shown as a person would read them', () => {
  it('says "not set" rather than printing an absence', () => {
    // "null" and "undefined" on screen read as data, and someone reading a
    // history to answer a client's question should not have to interpret them.
    for (const empty of [null, undefined, '']) {
      expect(readableValue(empty)).toBe('not set');
    }
  });

  it('never renders an object as [object Object]', () => {
    expect(readableValue({ lat: 6.44, lon: 3.47 })).not.toContain('object');
    expect(readableValue([{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }])).toBe('2 points');
    expect(readableValue([{ lat: 1, lon: 2 }])).toBe('1 point');
  });

  it('reads booleans as on and off', () => {
    expect(readableValue(true)).toBe('on');
    expect(readableValue(false)).toBe('off');
  });

  it('keeps short values exactly as they are', () => {
    expect(readableValue(30)).toBe('30');
    expect(readableValue('Kusenla Road')).toBe('Kusenla Road');
  });

  it('marks a truncated description as truncated', () => {
    // An image description runs to a paragraph. Cutting it without an ellipsis
    // would present a fragment as though it were the whole setting.
    const long = 'The photograph should show an outdoor urban roadway with at least one permanent structure and visible sky';
    const out = readableValue(long);
    expect(out.length).toBeLessThan(long.length);
    expect(out.endsWith('…')).toBe(true);
  });

  it('does not truncate something that fits', () => {
    const short = 'A clinic exterior';
    expect(readableValue(short)).toBe(short);
  });

  it('distinguishes zero from unset', () => {
    // zone_reject_km = 0 means "reject at any distance outside the zone" —
    // a real, deliberate setting. Rendering it as "not set" would describe the
    // strictest possible configuration as an absent one.
    expect(readableValue(0)).toBe('0');
    expect(readableValue(0)).not.toBe('not set');
  });
});

describe('settings are named the way the interface names them', () => {
  it('translates storage keys into the words on screen', () => {
    expect(fieldLabel('image_context')).toBe('What the photo should show');
    expect(fieldLabel('zone_reject_km')).toBe('Reject beyond');
    expect(fieldLabel('pass_threshold')).toBe('Pass threshold');
  });

  it('degrades readably for a key nobody has labelled yet', () => {
    // A new setting must not surface as a raw identifier with underscores.
    expect(fieldLabel('some_new_setting')).toBe('some new setting');
    expect(fieldLabel('some_new_setting')).not.toContain('_');
  });
});

describe('the source of a change is stated plainly', () => {
  it('distinguishes a person from an accepted proposal', () => {
    expect(sourceLabel('settings')).toBe('Changed in Settings');
    expect(sourceLabel('ada_proposal')).toContain('accepted');
    expect(sourceLabel('ada_proposal_declined')).toContain('declined');
  });

  it('never implies Ada made a change on her own', () => {
    // Ada proposes; a human accepts. The history must not read as though the
    // AI changed the scoring policy by itself — that is the claim AI_SECURITY.md
    // exists to make impossible, and the record should not undermine it.
    expect(sourceLabel('ada_proposal')).toMatch(/accepted/);
    expect(sourceLabel('ada_proposal')).not.toMatch(/^Ada changed/);
  });

  it('degrades readably for an unknown source', () => {
    expect(sourceLabel('some_future_source')).toBe('some future source');
  });
});

describe('times are readable, and bad ones do not become fake ones', () => {
  it('formats a real timestamp', () => {
    const out = formatWhen('2026-08-04T18:30:00Z');
    expect(out).toMatch(/2026/);
    expect(out).not.toContain('Invalid');
  });

  it('shows an unparseable timestamp rather than inventing one', () => {
    // "Invalid Date" or a silently substituted "now" would both be worse than
    // showing what was actually stored.
    expect(formatWhen('not a date')).toBe('not a date');
    expect(formatWhen('')).toBe('unknown time');
  });
});

describe('the panel reads, it never writes', () => {
  const fs = require('fs');
  const path = require('path');
  const src: string = fs.readFileSync(path.join(__dirname, 'ConfigHistory.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line: string) => !line.trim().startsWith('//'))
    .join('\n');

  it('makes no write calls', () => {
    expect(src).not.toContain('api.post');
    expect(src).not.toContain('api.put');
    expect(src).not.toContain('api.delete');
  });

  it('surfaces a load failure rather than showing an empty history', () => {
    // An empty list and a failed request look identical on screen, and one of
    // them is a claim that nothing has ever changed.
    expect(src).toContain("err?.response?.data?.error");
    expect(src).toContain('entries !== null && entries.length === 0');
  });
});
