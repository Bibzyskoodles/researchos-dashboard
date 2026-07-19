import { certificateApi } from '../services/api';

// Opens the real, backend-rendered certificate (with a genuine QR code, a
// real per-engine breakdown, and a signature that /verify/<cert_id> can
// actually check) in a new tab for viewing/printing.
//
// This used to build an entirely fake certificate client-side — different
// ID scheme than the backend's, a "verify at fieldscore.app/..." link that
// could never resolve against the real /verify/<cert_id> route, and stats
// pulled straight from whatever was in local state at the moment of
// issuance rather than anything the server could stand behind. That's why
// a plain <a href> or window.open(url) can't be used here either: this
// backend authenticates via a Bearer header (no session cookie is ever
// set), which a plain browser navigation has no way to attach — so the
// HTML is fetched through the authenticated api client first, then handed
// to the new tab.
export async function openCertificate(projectId: string): Promise<void> {
  const res = await certificateApi.fetchHtml(projectId);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(res.data);
  w.document.close();
}

export async function downloadCertificatePdf(projectId: string): Promise<void> {
  const res = await certificateApi.fetchPdf(projectId);
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FieldScore_Certificate_${projectId}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}
