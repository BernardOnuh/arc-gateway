/** Scoped styles (class prefix arcw-) so the widget looks the same on any page. */
export const widgetCss = `
.arcw{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#0f172a;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;max-width:420px;box-sizing:border-box;font-size:14px;line-height:1.4}
.arcw *{box-sizing:border-box}
.arcw h2{font-size:16px;font-weight:600;margin:0 0 12px}
.arcw-row{display:flex;gap:8px;margin-bottom:10px}
.arcw-field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;margin-bottom:10px}
.arcw-row .arcw-field{margin-bottom:0}
.arcw label{font-size:12px;font-weight:500;color:#475569}
.arcw input,.arcw select{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit;color:inherit;background:#fff}
.arcw input:focus,.arcw select:focus{outline:2px solid #d9e8ff;border-color:#2f6bff}
.arcw input[readonly]{background:#f8fafc;color:#475569}
.arcw-btn{width:100%;border:0;border-radius:8px;padding:10px;font:inherit;font-weight:600;color:#fff;background:#1f55e6;cursor:pointer}
.arcw-btn:hover{background:#1a45b8}
.arcw-btn:disabled{opacity:.6;cursor:default}
.arcw-link{background:none;border:0;padding:0;font:inherit;color:#1f55e6;cursor:pointer;text-decoration:underline}
.arcw-summary{border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:10px}
.arcw-summary dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0}
.arcw-summary dt{color:#64748b}
.arcw-summary dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.arcw-error{color:#b91c1c;font-size:13px;margin:0 0 10px}
.arcw-note{color:#64748b;font-size:12px;margin:8px 0 0}
.arcw-steps{list-style:none;margin:0 0 10px;padding:0}
.arcw-steps li{display:flex;align-items:center;gap:8px;padding:4px 0;color:#94a3b8}
.arcw-steps li[data-state=done]{color:#15803d}
.arcw-steps li[data-state=active]{color:#0f172a;font-weight:600}
.arcw-steps li[data-state=failed]{color:#b91c1c;font-weight:600}
.arcw-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}
.arcw-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}
`;
