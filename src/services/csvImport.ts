// Shared CSV/Excel → submissions import logic. Originally lived only in
// IntegrationsPage's CsvUploadCard; extracted so Ada's chat attachment
// handler (AdaDock) can parse and map a spreadsheet the same way instead
// of re-implementing (and inevitably drifting from) the same logic.
import * as XLSX from "xlsx";

// CSV/Excel formula-injection guard for any export built from data that
// ultimately traces back to submission payloads (free-text fields like a
// reverse-geocoded GPS address, an override reason typed by field staff,
// or in principle any enumerator-supplied string). A cell value starting
// with =, +, -, or @ is interpreted as a formula by Excel/Sheets when the
// file is reopened — prefixing a leading apostrophe is the standard
// mitigation (OWASP's recommended fix for this class of bug), forcing the
// cell to be read as literal text instead of executed.
export function sanitizeCsvCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const splitLine = (line: string) => {
    const cells: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cells.push(cur.trim());
    return cells;
  };
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(l => {
    const vals = splitLine(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
  return { headers, rows };
}

export const FIELD_MAP: { key: string; label: string; hints: string[] }[] = [
  { key: 'enumerator_id', label: 'Enumerator ID', hints: ['enumerator', 'interviewer', 'agent', 'collector', 'field_agent'] },
  { key: 'respondent_id', label: 'Respondent ID', hints: ['respondent', 'household', 'hh_id', 'case_id', 'subject'] },
  { key: 'gps_lat',       label: 'GPS Latitude',  hints: ['lat', 'latitude', 'gps_lat', '_gps_latitude'] },
  { key: 'gps_lon',       label: 'GPS Longitude', hints: ['lon', 'lng', 'longitude', 'gps_lon', '_gps_longitude'] },
  { key: 'submitted_at',  label: 'Submission Date', hints: ['date', 'submitted', 'start', 'end', 'timestamp', 'submission_time'] },
  { key: 'overall_score', label: 'Trust Score (0-100)', hints: ['score', 'trust', 'quality', 'overall_score'] },
  { key: 'verdict',       label: 'Verdict (PASS/FLAG/REJECT)', hints: ['verdict', 'status', 'result', 'outcome'] },
  { key: 'duration',      label: 'Duration (minutes)', hints: ['duration', 'interview_duration', 'minutes', 'elapsed'] },
  { key: 'location',      label: 'Location / Address', hints: ['location', 'address', 'lga', 'state', 'region', 'area'] },
];

export function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  FIELD_MAP.forEach(f => {
    const match = headers.find(h =>
      f.hints.some(hint => h.toLowerCase().replace(/[\s-]/g, '_').includes(hint))
    );
    if (match) mapping[f.key] = match;
  });
  return mapping;
}

/** Reads a .csv/.tsv/.txt/.xlsx/.xls File into headers + row objects. */
export function loadSpreadsheetFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        let h: string[], r: Record<string, string>[];
        if (isExcel) {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (!json.length) { reject(new Error('Excel sheet appears to be empty.')); return; }
          h = (json[0] as any[]).map(String);
          r = json.slice(1).map(row =>
            Object.fromEntries(h.map((k, i) => [k, String((row as any[])[i] ?? '')]))
          );
        } else {
          const parsed = parseCsv(e.target?.result as string);
          h = parsed.headers; r = parsed.rows;
        }
        if (!h.length) { reject(new Error('Could not read column headers from the file.')); return; }
        resolve({ headers: h, rows: r });
      } catch (err: any) {
        reject(new Error('Failed to parse file: ' + (err?.message || 'unknown error')));
      }
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  });
}

/** Builds the /api/submissions/upload payload from parsed rows + a column mapping. */
export function buildSubmissionsPayload(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  projectId: string
): Record<string, any>[] {
  return rows.map(row => {
    const s: Record<string, any> = { _raw: row, project_id: projectId };
    FIELD_MAP.forEach(f => {
      if (mapping[f.key] && row[mapping[f.key]] !== undefined) {
        if (f.key === 'gps_lat' || f.key === 'gps_lon') {
          if (!s.gps) s.gps = {};
          if (f.key === 'gps_lat') s.gps.lat = parseFloat(row[mapping[f.key]]) || null;
          if (f.key === 'gps_lon') s.gps.lon = parseFloat(row[mapping[f.key]]) || null;
        } else if (f.key === 'overall_score') {
          s.overall_score = parseFloat(row[mapping[f.key]]) || null;
        } else {
          s[f.key] = row[mapping[f.key]];
        }
      }
    });
    return s;
  });
}

export function isSpreadsheetFile(file: File): boolean {
  return /\.(csv|tsv|txt|xlsx|xls)$/i.test(file.name);
}
