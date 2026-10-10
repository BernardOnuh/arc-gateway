/**
 * Scoped styles (class prefix arcw-) so the widget looks the same on any
 * page. Colors and radius are CSS variables set on the root, so the
 * appearance props (theme, accentColor, radius) restyle everything.
 */
export const widgetCss = `
.arcw{
  --arcw-bg:#ffffff;--arcw-fg:#1c1f3f;--arcw-muted:#6b7096;--arcw-soft:#f3f4fb;--arcw-line:#e4e6f3;
  --arcw-input:#ffffff;--arcw-ok:#047857;--arcw-ok-bg:#ecfdf5;--arcw-bad:#b91c1c;--arcw-bad-bg:#fef2f2;
  --arcw-shadow:0 1px 2px rgba(28,31,63,.05),0 18px 40px -20px rgba(28,31,63,.28);
  --arcw-r:20px;--arcw-r-in:calc(var(--arcw-r) * .7);--arcw-r-sm:calc(var(--arcw-r) * .5);
  font-family:"Geist Variable",Geist,Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  color:var(--arcw-fg);background:var(--arcw-bg);border:1px solid var(--arcw-line);border-radius:var(--arcw-r);
  box-shadow:var(--arcw-shadow);padding:18px;width:100%;max-width:420px;box-sizing:border-box;font-size:14px;line-height:1.45;
  -webkit-font-smoothing:antialiased;
}
.arcw[data-theme=dark]{
  --arcw-bg:#12162e;--arcw-fg:#eef0ff;--arcw-muted:#9aa1cc;--arcw-soft:#1a1f3d;--arcw-line:#262c52;
  --arcw-input:#0f1328;--arcw-ok:#6ee7b7;--arcw-ok-bg:rgba(6,78,59,.4);--arcw-bad:#fca5a5;--arcw-bad-bg:rgba(127,29,29,.35);
  --arcw-shadow:0 1px 2px rgba(0,0,0,.3),0 24px 48px -24px rgba(0,0,0,.7);
}
@media (prefers-color-scheme:dark){
  .arcw[data-theme=auto]{
    --arcw-bg:#12162e;--arcw-fg:#eef0ff;--arcw-muted:#9aa1cc;--arcw-soft:#1a1f3d;--arcw-line:#262c52;
    --arcw-input:#0f1328;--arcw-ok:#6ee7b7;--arcw-ok-bg:rgba(6,78,59,.4);--arcw-bad:#fca5a5;--arcw-bad-bg:rgba(127,29,29,.35);
    --arcw-shadow:0 1px 2px rgba(0,0,0,.3),0 24px 48px -24px rgba(0,0,0,.7);
  }
}
.arcw *{box-sizing:border-box}
.arcw-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.arcw-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:2px 2px 14px}
.arcw h2{font-size:17px;font-weight:600;letter-spacing:-.01em;margin:0}
.arcw-chip{font-size:11px;font-weight:500;color:var(--arcw-muted);background:var(--arcw-soft);border-radius:999px;padding:3px 9px;white-space:nowrap}
.arcw-panel{background:var(--arcw-soft);border:1px solid transparent;border-radius:var(--arcw-r-in);padding:12px 14px;transition:border-color .15s}
.arcw-panel:focus-within{border-color:color-mix(in srgb,var(--arcw-accent) 45%,transparent)}
.arcw-panel-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:var(--arcw-muted)}
.arcw-panel-top label,.arcw-panel-title{font-size:12px;font-weight:500;color:var(--arcw-muted)}
.arcw-amount-row{display:flex;align-items:center;gap:10px;margin-top:6px}
.arcw-amount{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-size:28px;font-weight:600;letter-spacing:-.02em;color:var(--arcw-fg);padding:2px 0;outline:none;font-variant-numeric:tabular-nums}
.arcw-amount::placeholder{color:var(--arcw-muted);opacity:.55}
.arcw-estimate{flex:1;min-width:0;font-size:28px;font-weight:600;letter-spacing:-.02em;padding:2px 0;color:var(--arcw-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.arcw-select{appearance:none;-webkit-appearance:none;border:1px solid var(--arcw-line);background:var(--arcw-input) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238a8fb3' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;color:var(--arcw-fg);font:inherit;font-weight:600;border-radius:999px;padding:7px 28px 7px 12px;cursor:pointer;max-width:100%}
.arcw-select:focus-visible,.arcw-input:focus-visible,.arcw-btn:focus-visible,.arcw-link:focus-visible{outline:2px solid var(--arcw-accent);outline-offset:2px}
.arcw-select-quiet{border:0;background-color:transparent;padding:0 18px 0 0;font-weight:500;color:var(--arcw-fg);background-position:right 2px center}
.arcw-swap{display:flex;justify-content:center;margin:-8px 0;position:relative;z-index:1}
.arcw-swap span{display:grid;place-items:center;width:34px;height:34px;border-radius:12px;background:var(--arcw-bg);border:4px solid var(--arcw-bg);box-shadow:0 0 0 1px var(--arcw-line);color:var(--arcw-fg)}
.arcw-field{margin-top:12px}
.arcw-field label{display:block;font-size:12px;font-weight:500;color:var(--arcw-muted);margin:0 2px 6px}
.arcw-input{width:100%;border:1px solid var(--arcw-line);border-radius:var(--arcw-r-sm);padding:10px 12px;font:inherit;color:var(--arcw-fg);background:var(--arcw-input)}
.arcw-input[readonly]{background:var(--arcw-soft);color:var(--arcw-muted)}
.arcw-mono{font-family:"Geist Mono Variable",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
.arcw-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:14px;border:0;border-radius:var(--arcw-r-in);padding:13px 16px;font:inherit;font-size:15px;font-weight:600;color:var(--arcw-accent-fg);background:var(--arcw-accent);cursor:pointer;transition:filter .15s,transform .05s}
.arcw-btn:hover{filter:brightness(1.12)}
.arcw-btn:active{transform:translateY(1px)}
.arcw-btn:disabled{opacity:.55;cursor:default;filter:none;transform:none}
.arcw-btn-ghost{background:transparent;color:var(--arcw-fg);border:1px solid var(--arcw-line);margin-top:8px}
.arcw-link{background:none;border:0;padding:0;font:inherit;color:var(--arcw-muted);cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.arcw-link:hover{color:var(--arcw-fg)}
.arcw-spin{width:15px;height:15px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:arcw-spin .7s linear infinite}
@keyframes arcw-spin{to{transform:rotate(360deg)}}
.arcw-error{color:var(--arcw-bad);background:var(--arcw-bad-bg);border-radius:var(--arcw-r-sm);font-size:13px;padding:9px 12px;margin:12px 0 0}
.arcw-note{color:var(--arcw-muted);font-size:12px;margin:10px 0 0;text-align:center}
.arcw-hero{background:var(--arcw-soft);border-radius:var(--arcw-r-in);padding:16px;text-align:center}
.arcw-hero small{display:block;font-size:12px;color:var(--arcw-muted)}
.arcw-hero strong{display:block;font-size:30px;font-weight:600;letter-spacing:-.025em;margin-top:2px;font-variant-numeric:tabular-nums}
.arcw-route{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:var(--arcw-muted)}
.arcw-rows{display:grid;grid-template-columns:auto 1fr;gap:9px 12px;margin:14px 2px 0;font-size:13px}
.arcw-rows dt{color:var(--arcw-muted)}
.arcw-rows dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.arcw-timer{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;font-size:12px;color:var(--arcw-muted)}
.arcw-timer-bar{flex:1;max-width:120px;height:4px;border-radius:999px;background:var(--arcw-line);overflow:hidden}
.arcw-timer-bar i{display:block;height:100%;background:var(--arcw-accent);transition:width 1s linear}
.arcw-progress{height:4px;border-radius:999px;background:var(--arcw-line);overflow:hidden;margin:4px 0 14px}
.arcw-progress i{display:block;height:100%;background:var(--arcw-accent);transition:width .6s ease}
.arcw-progress[data-failed] i{background:var(--arcw-bad)}
.arcw-steps{list-style:none;margin:0;padding:0}
.arcw-steps li{position:relative;display:flex;align-items:center;gap:12px;padding:7px 0;color:var(--arcw-muted)}
.arcw-steps li[data-state=done],.arcw-steps li[data-state=active]{color:var(--arcw-fg)}
.arcw-steps li[data-state=active]{font-weight:600}
.arcw-steps li[data-state=failed]{color:var(--arcw-bad);font-weight:600}
.arcw-dot{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;flex:none;border:2px solid var(--arcw-line);background:var(--arcw-bg)}
.arcw-steps li[data-state=done] .arcw-dot{background:var(--arcw-accent);border-color:var(--arcw-accent);color:var(--arcw-accent-fg)}
.arcw-steps li[data-state=active] .arcw-dot{border-color:var(--arcw-accent);color:var(--arcw-accent)}
.arcw-steps li[data-state=failed] .arcw-dot{background:var(--arcw-bad);border-color:var(--arcw-bad);color:#fff}
.arcw-txs{margin:12px 0 0;padding:10px 12px;border-radius:var(--arcw-r-sm);background:var(--arcw-soft);font-size:12px;display:grid;gap:6px}
.arcw-txs div{display:flex;justify-content:space-between;gap:12px}
.arcw-txs span{color:var(--arcw-muted)}
.arcw-txs a{color:var(--arcw-fg)}
.arcw-done{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--arcw-r-sm);background:var(--arcw-ok-bg);color:var(--arcw-ok);font-weight:600;margin-top:12px}
.arcw-foot{margin-top:14px;text-align:center;font-size:11px;color:var(--arcw-muted);letter-spacing:.01em}
.arcw-foot b{font-weight:600;color:var(--arcw-fg)}
@media (prefers-reduced-motion:reduce){.arcw *{animation:none!important;transition:none!important}}
`;
