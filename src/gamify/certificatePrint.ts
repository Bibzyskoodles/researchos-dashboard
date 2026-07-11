import { Certificate } from './GamifyContext';

// Renders the Data Integrity Certificate as a standalone printable page.
// Opened in a new window so the client can print / save as PDF and send
// alongside the cleaned dataset.

export function openCertificatePrint(cert: Certificate) {
  const d = new Date(cert.issuedAt);
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const verifyUrl = `https://fieldscore.app/verify/${cert.id}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Data Integrity Certificate · ${cert.id}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #E8EDF5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  .cert { width: 1000px; background: white; border: 1px solid #D6DEEB; box-shadow: 0 12px 48px rgba(8,13,26,.15); position: relative; overflow: hidden; }
  .inner { border: 2px solid #0A1230; margin: 14px; padding: 48px 56px 40px; position: relative; }
  .inner::before { content: ''; position: absolute; inset: 4px; border: 1px solid #C7D2E8; pointer-events: none; }
  .band { position: absolute; top: 0; left: 0; right: 0; height: 7px; background: linear-gradient(90deg, #0A1230 0%, #2463EB 60%, #60A5FA 100%); }
  .brand { font-family: Inter, Arial, sans-serif; font-weight: 800; letter-spacing: 4px; font-size: 15px; color: #0A1230; text-align: center; }
  .brand .dot { color: #2463EB; }
  .kicker { font-family: Inter, Arial, sans-serif; font-size: 9px; letter-spacing: 3.5px; color: #6B7280; text-align: center; margin-top: 5px; text-transform: uppercase; }
  h1 { text-align: center; font-size: 34px; font-weight: 400; color: #0A1230; margin: 34px 0 6px; letter-spacing: 1px; }
  .sub { text-align: center; font-family: Inter, Arial, sans-serif; font-size: 11.5px; color: #6B7280; margin-bottom: 30px; }
  .body-line { text-align: center; font-size: 15px; color: #374151; line-height: 1.9; max-width: 720px; margin: 0 auto; }
  .body-line strong { color: #0A1230; }
  .stats { display: flex; justify-content: center; gap: 0; margin: 32px auto 30px; max-width: 760px; border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; }
  .stat { flex: 1; text-align: center; padding: 16px 8px; border-right: 1px solid #E2E8F0; }
  .stat:last-child { border-right: none; }
  .stat .v { font-family: Inter, Arial, sans-serif; font-size: 24px; font-weight: 800; color: #0A1230; }
  .stat .v.green { color: #059669; }
  .stat .l { font-family: Inter, Arial, sans-serif; font-size: 8.5px; letter-spacing: 1.6px; color: #9CA3AF; text-transform: uppercase; margin-top: 4px; }
  .footer { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 34px; }
  .sig { font-family: Inter, Arial, sans-serif; font-size: 10px; color: #6B7280; }
  .sig .name { font-size: 13px; color: #0A1230; font-weight: 700; border-top: 1px solid #0A1230; padding-top: 6px; margin-bottom: 3px; min-width: 200px; }
  .seal { width: 92px; height: 92px; border-radius: 50%; border: 2px solid #2463EB; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #2463EB; font-family: Inter, Arial, sans-serif; position: relative; }
  .seal::before { content: ''; position: absolute; inset: 5px; border: 1px dashed #93C5FD; border-radius: 50%; }
  .seal .check { font-size: 26px; font-weight: 800; }
  .seal .txt { font-size: 6.5px; letter-spacing: 1.4px; text-transform: uppercase; margin-top: 2px; text-align: center; line-height: 1.5; }
  .verify { font-family: Inter, Arial, sans-serif; font-size: 9.5px; color: #9CA3AF; text-align: right; }
  .verify .id { font-family: 'Courier New', monospace; font-size: 12px; color: #0A1230; font-weight: 700; letter-spacing: 1px; margin-bottom: 3px; }
  .actions { text-align: center; margin-top: 20px; font-family: Inter, Arial, sans-serif; }
  .actions button { background: #2463EB; color: white; border: none; border-radius: 8px; padding: 11px 26px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: Inter, Arial, sans-serif; }
  @media print { body { background: white; padding: 0; } .actions { display: none; } .cert { box-shadow: none; border: none; } }
</style></head>
<body>
<div>
  <div class="cert">
    <div class="band"></div>
    <div class="inner">
      <div class="brand">FIELDSC<span class="dot">◉</span>RE</div>
      <div class="kicker">Verify · Analyze · Decide</div>
      <h1>Data Integrity Certificate</h1>
      <div class="sub">This dataset has passed FieldScore's multi-engine quality verification process</div>
      <div class="body-line">
        This certifies that the dataset for <strong>${escapeHtml(cert.projectName)}</strong>,
        collected and processed by <strong>${escapeHtml(cert.orgName)}</strong>,
        was screened, verified and cleaned through FieldScore ResearchOS.
        Every submission was evaluated for authenticity, consistency and completeness.
      </div>
      <div class="stats">
        <div class="stat"><div class="v">${cert.sampleSize.toLocaleString()}</div><div class="l">Submissions screened</div></div>
        <div class="stat"><div class="v green">${cert.passRate}%</div><div class="l">Pass rate</div></div>
        <div class="stat"><div class="v">${cert.flagsResolved.toLocaleString()}</div><div class="l">Flags resolved</div></div>
        <div class="stat"><div class="v">${cert.rejectionRate}%</div><div class="l">Rejected & removed</div></div>
        <div class="stat"><div class="v">${cert.enumerators}</div><div class="l">Field enumerators</div></div>
      </div>
      <div class="footer">
        <div class="sig">
          <div class="name">${escapeHtml(cert.issuedBy)}</div>
          <div>Authorised verifier · ${escapeHtml(cert.orgName)}</div>
          <div style="margin-top:4px">Issued ${dateStr}</div>
        </div>
        <div class="seal">
          <div class="check">✓</div>
          <div class="txt">FieldScore<br>Verified</div>
        </div>
        <div class="verify">
          <div class="id">${cert.id}</div>
          <div>Verify authenticity at</div>
          <div>${verifyUrl}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
