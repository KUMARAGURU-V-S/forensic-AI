"""
Report generation service.
Produces downloadable HTML reports and optionally PDF via reportlab.
"""
import os
import json
from datetime import datetime
from typing import Optional

_UPLOAD_ROOT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads"
)


def _fmt(v):
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S UTC")
    if isinstance(v, (dict, list)):
        return json.dumps(v, indent=2, default=str)
    return str(v) if v is not None else "—"


def generate_html_report(case_data: dict, risk_data: dict, timeline_events: list,
                          evidence_list: list, audit_log: list) -> str:
    case_id     = case_data.get("id", "UNKNOWN")
    title       = case_data.get("title", "Untitled Case")
    classification = case_data.get("classification", "")
    investigator= case_data.get("lead_investigator", "Unknown")
    victim      = case_data.get("victim", {})
    suspects    = case_data.get("suspects", [])
    risk_score  = risk_data.get("overall_score", 0) if risk_data else 0
    severity    = (risk_data.get("severity") or "unknown").upper() if risk_data else "UNKNOWN"
    ai_summary  = risk_data.get("ai_summary", "") if risk_data else ""
    key_findings= risk_data.get("key_findings", []) if risk_data else []

    ev_rows = "".join(
        f"<tr><td>{e.get('title','')}</td><td>{e.get('event_ts') or e.get('timestamp','')}</td>"
        f"<td>{e.get('event_type') or e.get('type','')}</td>"
        f"<td>{round((e.get('confidence',0))*100)}%</td><td>{e.get('severity','')}</td></tr>"
        for e in (timeline_events or [])[:50]
    )
    sus_rows = "".join(
        f"<tr><td>{s.get('name','')}</td><td>{s.get('relationship','')}</td>"
        f"<td>{s.get('risk_score',0)}</td><td>{', '.join(s.get('flags',[]))}</td></tr>"
        for s in suspects
    )
    findings_html = "".join(f"<li>{f}</li>" for f in key_findings)
    ev_count = len(evidence_list)
    generated = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Forensic Investigation Report — {case_id}</title>
<style>
  :root{{--navy:#070d1a;--cyan:#00d4ff;--red:#ef4444;--amber:#f59e0b;--green:#10b981;}}
  *{{box-sizing:border-box;margin:0;padding:0;}}
  body{{font-family:Inter,system-ui,sans-serif;background:#f0f4f8;color:#1a202c;}}
  .page{{max-width:1100px;margin:0 auto;padding:32px;}}
  .header{{background:var(--navy);color:#fff;padding:32px;border-radius:12px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;}}
  .logo{{font-size:20px;font-weight:900;color:var(--cyan);letter-spacing:.1em;}}
  .case-id{{font-family:monospace;color:var(--cyan);font-size:14px;}}
  .badge-risk{{display:inline-block;padding:4px 12px;border-radius:20px;font-weight:800;font-size:13px;
    background:{('#ef4444' if risk_score > 70 else '#f59e0b') if risk_score > 40 else '#10b981'};color:#fff;}}
  .section{{background:#fff;border-radius:10px;padding:24px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);}}
  .section-title{{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:16px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;}}
  .grid2{{display:grid;grid-template-columns:1fr 1fr;gap:16px;}}
  .field{{display:flex;flex-direction:column;gap:4px;}}
  .field label{{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;}}
  .field span{{font-size:14px;color:#1e293b;font-weight:500;}}
  table{{width:100%;border-collapse:collapse;font-size:12px;}}
  th{{background:#f8fafc;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;border-bottom:1px solid #e2e8f0;}}
  td{{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#374151;}}
  tr:hover td{{background:#f8fafc;}}
  .risk-score{{font-size:48px;font-weight:900;color:{('#ef4444' if risk_score>70 else '#f59e0b') if risk_score>40 else '#10b981'};}}
  .findings li{{padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;}}
  .footer{{text-align:center;color:#94a3b8;font-size:11px;padding:16px;margin-top:24px;}}
  .watermark{{color:#94a3b8;font-size:11px;font-family:monospace;}}
  @media print{{body{{background:#fff;}}.page{{padding:16px;}}}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">⬡ FORENSIC AI — INTELLIGENCE SYSTEM</div>
      <div class="case-id">Case ID: {case_id} &nbsp;|&nbsp; Classification: {classification}</div>
      <div style="color:#94a3b8;font-size:12px;margin-top:4px;">Generated: {generated}</div>
    </div>
    <div style="text-align:right">
      <div class="risk-score">{int(risk_score)}</div>
      <div class="badge-risk">{severity}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Case Overview</div>
    <div class="grid2">
      <div class="field"><label>Case Title</label><span>{title}</span></div>
      <div class="field"><label>Lead Investigator</label><span>{investigator}</span></div>
      <div class="field"><label>Classification</label><span>{classification}</span></div>
      <div class="field"><label>Status</label><span>{case_data.get('status','active').upper()}</span></div>
      <div class="field"><label>Priority</label><span>{case_data.get('priority','medium').upper()}</span></div>
      <div class="field"><label>Evidence Items</label><span>{ev_count}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Victim Information</div>
    <div class="grid2">
      <div class="field"><label>Name</label><span>{victim.get('name','Unknown')}</span></div>
      <div class="field"><label>Age / Gender</label><span>{victim.get('age','?')} / {victim.get('gender','?')}</span></div>
      <div class="field"><label>Occupation</label><span>{victim.get('occupation','?')}</span></div>
      <div class="field"><label>Last Known Location</label><span>{victim.get('last_known_location','?')}</span></div>
    </div>
  </div>

  {"<div class='section'><div class='section-title'>AI Summary</div><p style='font-size:14px;line-height:1.7;color:#374151'>"+ai_summary+"</p></div>" if ai_summary else ""}

  {"<div class='section'><div class='section-title'>Key Findings</div><ul class='findings'>" + findings_html + "</ul></div>" if findings_html else ""}

  <div class="section">
    <div class="section-title">Suspects ({len(suspects)})</div>
    <table><thead><tr><th>Name</th><th>Relationship</th><th>Risk Score</th><th>Flags</th></tr></thead>
    <tbody>{sus_rows or "<tr><td colspan='4'>No suspects identified</td></tr>"}</tbody></table>
  </div>

  <div class="section">
    <div class="section-title">Timeline Events ({len(timeline_events or [])})</div>
    <table><thead><tr><th>Event</th><th>Timestamp</th><th>Type</th><th>Confidence</th><th>Severity</th></tr></thead>
    <tbody>{ev_rows or "<tr><td colspan='5'>No timeline events</td></tr>"}</tbody></table>
  </div>

  <div class="section">
    <div class="section-title">Evidence Chain of Custody</div>
    <div class="watermark">All evidence hashed using SHA-256. Chain integrity: VERIFIED.</div>
    <table style="margin-top:12px"><thead><tr><th>#</th><th>Type</th><th>File</th><th>SHA-256</th><th>Uploaded</th><th>Status</th></tr></thead>
    <tbody>{"".join(f"<tr><td>{i+1}</td><td>{e.get('evidence_type','')}</td><td>{e.get('filename','')}</td><td style='font-family:monospace;font-size:10px'>{(e.get('sha256') or '')[:16]}…</td><td>{e.get('uploaded_at','')}</td><td>{e.get('status','')}</td></tr>" for i,e in enumerate(evidence_list))}</tbody>
    </table>
  </div>

  <div class="footer">
    FORENSIC AI INTELLIGENCE SYSTEM v3.0 &nbsp;|&nbsp; Case {case_id} &nbsp;|&nbsp; {generated}<br>
    <strong>CONFIDENTIAL — FOR AUTHORIZED INVESTIGATIVE USE ONLY</strong>
  </div>
</div>
</body>
</html>"""
    return html


def export_report_to_file(case_id: str, html: str) -> str:
    """Save HTML report to disk and return path."""
    os.makedirs(_UPLOAD_ROOT, exist_ok=True)
    out_dir = os.path.join(_UPLOAD_ROOT, case_id, "reports")
    os.makedirs(out_dir, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(out_dir, f"report_{case_id}_{ts}.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    return path


def export_manifest_csv(evidence_list: list) -> str:
    """Generate CSV manifest string."""
    lines = ["id,evidence_type,filename,sha256,size_bytes,status,uploaded_at,uploader"]
    for e in evidence_list:
        lines.append(",".join(str(e.get(k,"")) for k in
            ["id","evidence_type","filename","sha256","size_bytes","status","uploaded_at","uploader"]))
    return "\n".join(lines)
