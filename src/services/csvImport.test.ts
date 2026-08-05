// A spreadsheet of photo and audio links must actually be verified.
//
// The importer mapped enumerator, GPS, date, score, verdict, duration and
// location — and nothing for media. A customer uploading a sheet whose rows
// carried image and audio URLs got submissions scored with the image and audio
// engines both reporting "no image field in this submission": the two checks
// the product is best at, skipped in silence, with no error anywhere.
//
// Nothing was broken underneath. media.py has always fetched Google Drive
// share links, KoboToolbox attachments and direct file URLs, and scorer.py's
// _media_urls() falls back to the singular field expressly so "non-Kobo / CSV /
// legacy payloads still work". The row even reaches the backend intact. But it
// arrives under the customer's own column heading — "Photo URL", "recording" —
// and the engines read the configured FIELD_PHOTO / FIELD_AUDIO name, so the
// URL sat in the payload unread.

import { FIELD_MAP, autoMap, buildSubmissionsPayload, splitMediaUrls } from "./csvImport";

const PID = "proj_1";

describe("media URL columns are mappable", () => {
  it("offers a photo and an audio column in the mapping UI", () => {
    // IntegrationsPage and AdaDock both iterate FIELD_MAP, so an entry here is
    // the whole of the UI wiring.
    const keys = FIELD_MAP.map(f => f.key);
    expect(keys).toContain("image_url");
    expect(keys).toContain("audio_url");
  });

  it("auto-detects the headings a real sheet actually uses", () => {
    const m = autoMap(["Respondent ID", "Photo URL", "Audio Recording", "GPS Lat"]);
    expect(m.image_url).toBe("Photo URL");
    expect(m.audio_url).toBe("Audio Recording");
  });

  it("auto-detects the Kobo-style names too", () => {
    const m = autoMap(["store_photo", "interview_audio"]);
    expect(m.image_url).toBe("store_photo");
    expect(m.audio_url).toBe("interview_audio");
  });

  it("auto-detects Afrobarometer-style columns", () => {
    const m = autoMap(["RESPNO", "DATEINTR", "LENGTH", "REGION", "LOCATION.LEVEL.1"]);
    expect(m.respondent_id).toBe("RESPNO");
    expect(m.submitted_at).toBe("DATEINTR");
    expect(m.duration).toBe("LENGTH");
    expect(m.location).toBe("REGION");
  });
});

describe("the mapped URLs reach the payload", () => {
  const rows = [{ "Photo URL": "https://x/a.jpg", "Audio": "https://x/a.mp3" }];
  const mapping = { image_url: "Photo URL", audio_url: "Audio" };

  it("sends them under the plural keys the scorer prefers", () => {
    const [s] = buildSubmissionsPayload(rows, mapping, PID);
    expect(s.image_urls).toEqual(["https://x/a.jpg"]);
    expect(s.audio_urls).toEqual(["https://x/a.mp3"]);
  });

  it("keeps the original row so the answers are still scored", () => {
    const [s] = buildSubmissionsPayload(rows, mapping, PID);
    expect(s._raw).toEqual(rows[0]);
  });

  it("omits the keys entirely when a row has no media", () => {
    // An absent key is "no photo on this submission". An empty array would be
    // a claim that the submission was checked and had none.
    const [s] = buildSubmissionsPayload([{ "Photo URL": "" }], mapping, PID);
    expect(s.image_urls).toBeUndefined();
    expect(s.audio_urls).toBeUndefined();
  });
});

describe("several URLs in one cell", () => {
  it("splits on commas, semicolons and whitespace", () => {
    expect(splitMediaUrls("https://x/1.jpg, https://x/2.jpg;https://x/3.jpg"))
      .toEqual(["https://x/1.jpg", "https://x/2.jpg", "https://x/3.jpg"]);
  });

  it("passes every photo through, not just the first", () => {
    const [s] = buildSubmissionsPayload(
      [{ P: "https://x/1.jpg https://x/2.jpg" }], { image_url: "P" }, PID);
    expect(s.image_urls).toHaveLength(2);
  });

  it("drops anything that is not an http(s) URL", () => {
    // Spreadsheets carry "N/A", "none", stray notes and Windows paths in these
    // columns. Handing those to the fetcher produces a failed download and a
    // scary-looking finding on a submission that simply had no photo.
    expect(splitMediaUrls("N/A")).toEqual([]);
    expect(splitMediaUrls("none")).toEqual([]);
    expect(splitMediaUrls("C:\\photos\\a.jpg")).toEqual([]);
    expect(splitMediaUrls("see attached")).toEqual([]);
  });

  it("keeps a valid URL sitting beside junk", () => {
    expect(splitMediaUrls("N/A, https://x/real.jpg")).toEqual(["https://x/real.jpg"]);
  });

  it("handles an empty or missing cell without throwing", () => {
    expect(splitMediaUrls("")).toEqual([]);
    // @ts-expect-error — testing runtime defence against a missing cell
    expect(splitMediaUrls(undefined)).toEqual([]);
  });
});
