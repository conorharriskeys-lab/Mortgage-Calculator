import { useState } from "react";

const fmt = (n) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
const fmtD = (n) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const COLORS = ["#b5892a", "#4a9aba", "#7a6abf", "#4ab57a"];

function calcMortgage({ price, downPct, rate, amort, freq }) {
  const freqMap = { monthly: 12, biweekly: 26, weekly: 52 };
  const down = price * (downPct / 100);
  const principal = price - down;
  const n = amort * freqMap[freq];
  const r = rate / 100 / freqMap[freq];
  const payment = r === 0 ? principal / n : principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPaid = payment * n;
  const totalInterest = totalPaid - principal;
  return { down, principal, payment, totalPaid, totalInterest, n };
}

function Slider({ label, value, min, max, step, onChange, display, color }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: "1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
        <span style={{ color: "#666", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{label}</span>
        <span style={{ color: color || "#e8d5b0", fontSize: "0.92rem", fontWeight: "700", fontFamily: "'Playfair Display', serif" }}>{display}</span>
      </div>
      <div style={{ position: "relative", height: "3px", background: "#222", borderRadius: "2px" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: color || "#b5892a", borderRadius: "2px" }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", width: "100%", opacity: 0, cursor: "pointer", height: "18px", margin: 0 }} />
        <div style={{ position: "absolute", top: "50%", left: `${pct}%`, transform: "translate(-50%, -50%)", width: "13px", height: "13px", background: color || "#e8d5b0", borderRadius: "50%", border: "2px solid #1a1a1a", pointerEvents: "none" }} />
      </div>
    </div>
  );
}

const defaultScenario = (i) => ({
  id: Date.now() + i,
  name: `Scenario ${i + 1}`,
  price: 650000,
  downPct: 20,
  rate: 5.25,
  amort: 25,
  freq: "monthly",
});

export default function App() {
  const [scenarios, setScenarios] = useState([defaultScenario(0)]);
  const [activeTab, setActiveTab] = useState(0);
  const [view, setView] = useState("builder");
  const [reportStatus, setReportStatus] = useState(null);

  const update = (idx, field, val) => {
    setScenarios(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const addScenario = () => {
    if (scenarios.length >= 4) return;
    const ns = defaultScenario(scenarios.length);
    setScenarios(prev => [...prev, ns]);
    setActiveTab(scenarios.length);
  };

  const removeScenario = (idx) => {
    if (scenarios.length === 1) return;
    setScenarios(prev => prev.filter((_, i) => i !== idx));
    setActiveTab(Math.max(0, activeTab - 1));
  };

  const results = scenarios.map(s => ({ ...s, ...calcMortgage(s) }));

  const generateReport = async () => {
    setReportStatus("generating");
    const freqLabel = { monthly: "Monthly", biweekly: "Bi-Weekly", weekly: "Weekly" };
    const scenarioData = results.map((r, i) => ({
      name: r.name,
      price: fmt(r.price),
      downPayment: `${r.downPct}% (${fmt(r.down)})`,
      interestRate: `${r.rate.toFixed(2)}%`,
      amortization: `${r.amort} years`,
      frequency: freqLabel[r.freq],
      paymentAmount: fmtD(r.payment),
      principal: fmt(r.principal),
      totalInterest: fmt(r.totalInterest),
      totalCost: fmt(r.totalPaid + r.down),
      interestPercent: `${((r.totalInterest / r.totalPaid) * 100).toFixed(1)}%`,
      cmhcRequired: r.downPct < 20,
    }));

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a professional mortgage advisor. Write a concise comparison report for these mortgage scenarios. Include: a brief Executive Summary (2-3 sentences), Key Comparisons (specific numbers, what differs), a Recommendation (which is best and why), and Cautions (CMHC if applicable, risk factors). Be direct and professional. Write in flowing prose paragraphs. Use section headers exactly as: "Executive Summary", "Key Comparisons", "Recommendation", "Cautions". No bullet points, no markdown formatting.

Scenarios:
${JSON.stringify(scenarioData, null, 2)}`
          }]
        })
      });
      const data = await resp.json();
      const text = data.content?.map(c => c.text || "").join("\n") || "Report generation failed.";
      setReportStatus({ text });
    } catch (e) {
      setReportStatus({ text: "Error generating report. Please try again." });
    }
  };

  const s = scenarios[activeTab] || scenarios[0];
  const r = results[activeTab] || results[0];
  const color = COLORS[activeTab];

  const maxPayment = Math.max(...results.map(r => r.payment));
  const maxInterest = Math.max(...results.map(r => r.totalInterest));

  return (
    <div style={{ minHeight: "100vh", background: "#111", color: "#ccc", fontFamily: "'DM Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; } body { margin: 0; background: #111; }
        .tab { background: none; border: none; color: #444; padding: 0.5rem 1rem; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 0.73rem; letter-spacing: 0.06em; text-transform: uppercase; border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap; }
        .tab.active { color: var(--tc); border-bottom-color: var(--tc); }
        .tab:hover:not(.active) { color: #888; }
        .pill { background: none; border: 1px solid #2a2a2a; color: #555; padding: 0.32rem 0.75rem; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 0.67rem; letter-spacing: 0.08em; text-transform: uppercase; transition: all 0.2s; border-radius: 2px; }
        .pill.active { color: var(--tc); border-color: var(--tc); background: var(--tb); }
        .pill:hover:not(.active) { border-color: #444; color: #777; }
        .view-btn { background: none; border: 1px solid #222; color: #555; padding: 0.38rem 1.1rem; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; transition: all 0.2s; }
        .view-btn.active { background: #1e1e1e; border-color: #3a3a3a; color: #ccc; }
        .view-btn:hover:not(.active) { border-color: #333; color: #888; }
        .add-btn { background: none; border: 1px dashed #2e2e2e; color: #444; padding: 0.42rem 0.9rem; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 0.7rem; letter-spacing: 0.08em; transition: all 0.2s; }
        .add-btn:hover { border-color: #555; color: #777; }
        .rm-btn { background: none; border: none; color: #2e2e2e; cursor: pointer; font-size: 0.72rem; padding: 0 0.25rem; transition: color 0.2s; line-height: 1; margin-left: -4px; }
        .rm-btn:hover { color: #c05040; }
        .gen-btn { background: linear-gradient(135deg, #1a1508, #1e1a0a); border: 1px solid #b5892a; color: #e8d5b0; padding: 0.65rem 1.8rem; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; transition: all 0.2s; }
        .gen-btn:hover:not(:disabled) { background: linear-gradient(135deg, #221b0a, #26200d); }
        .gen-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        @keyframes pulse { 0%,100%{opacity:0.25} 50%{opacity:1} }
      `}</style>

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ color: "#b5892a", fontSize: "0.63rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.4rem" }}>Real Estate</div>
            <h1 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 900, color: "#f5f0e8", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
              Mortgage <span style={{ color: "#b5892a" }}>Calculator</span>
            </h1>
          </div>
          <div style={{ display: "flex" }}>
            <button className={`view-btn${view === "builder" ? " active" : ""}`} style={{ borderRight: "none" }} onClick={() => setView("builder")}>Builder</button>
            <button className={`view-btn${view === "compare" ? " active" : ""}`} onClick={() => setView("compare")}>
              Compare{scenarios.length > 1 ? ` (${scenarios.length})` : ""}
            </button>
          </div>
        </div>

        {/* BUILDER VIEW */}
        {view === "builder" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1.5rem", borderBottom: "1px solid #1a1a1a", paddingBottom: "0" }}>
              {scenarios.map((sc, i) => (
                <div key={sc.id} style={{ display: "flex", alignItems: "center" }}>
                  <button className={`tab${activeTab === i ? " active" : ""}`} style={{ "--tc": COLORS[i] }} onClick={() => setActiveTab(i)}>{sc.name}</button>
                  {scenarios.length > 1 && <button className="rm-btn" onClick={() => removeScenario(i)}>✕</button>}
                </div>
              ))}
              {scenarios.length < 4 && <button className="add-btn" onClick={addScenario}>+ Add Scenario</button>}
            </div>

            <div style={{ marginBottom: "1.4rem" }}>
              <input value={s.name} onChange={e => update(activeTab, "name", e.target.value)}
                style={{ background: "none", border: "none", borderBottom: `1px solid ${color}`, color: color, fontSize: "0.88rem", fontFamily: "'Playfair Display', serif", fontWeight: 700, padding: "0.2rem 0", outline: "none", width: "200px", letterSpacing: "0.02em" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.4rem" }}>
              <div style={{ background: "#161616", border: `1px solid ${color}20`, borderRadius: "4px", padding: "1.5rem" }}>
                <Slider label="Home Price" value={s.price} min={100000} max={2000000} step={5000} onChange={v => update(activeTab, "price", v)} display={fmt(s.price)} color={color} />
                <Slider label="Down Payment" value={s.downPct} min={5} max={50} step={0.5} onChange={v => update(activeTab, "downPct", v)} display={`${s.downPct}% · ${fmt(r.down)}`} color={color} />
                <Slider label="Interest Rate" value={s.rate} min={0.5} max={12} step={0.05} onChange={v => update(activeTab, "rate", v)} display={`${s.rate.toFixed(2)}%`} color={color} />
                <Slider label="Amortization" value={s.amort} min={5} max={30} step={1} onChange={v => update(activeTab, "amort", v)} display={`${s.amort} yrs`} color={color} />
                <div style={{ marginTop: "1.3rem" }}>
                  <div style={{ color: "#555", fontSize: "0.67rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.55rem" }}>Payment Frequency</div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {["monthly", "biweekly", "weekly"].map(f => (
                      <button key={f} className={`pill${s.freq === f ? " active" : ""}`} style={{ "--tc": color, "--tb": `${color}18` }} onClick={() => update(activeTab, "freq", f)}>
                        {f === "biweekly" ? "Bi-wkly" : f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                <div style={{ background: "#161616", border: `1px solid ${color}40`, borderRadius: "4px", padding: "1.4rem", textAlign: "center" }}>
                  <div style={{ color: color, fontSize: "0.63rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.45rem" }}>
                    Payment / {s.freq === "monthly" ? "mo" : s.freq === "biweekly" ? "2wk" : "wk"}
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.7rem, 3.5vw, 2.3rem)", fontWeight: 900, color: color, letterSpacing: "-0.02em" }}>{fmtD(r.payment)}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                  {[
                    { label: "Principal", value: fmt(r.principal) },
                    { label: "Down Payment", value: fmt(r.down) },
                    { label: "Total Interest", value: fmt(r.totalInterest) },
                    { label: "Total Cost", value: fmt(r.totalPaid + r.down) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: "#161616", border: "1px solid #1e1e1e", borderRadius: "4px", padding: "0.85rem" }}>
                      <div style={{ color: "#3e3e3e", fontSize: "0.63rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.25rem" }}>{label}</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", color: "#b0a890", fontSize: "0.9rem", fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#161616", border: "1px solid #1e1e1e", borderRadius: "4px", padding: "0.9rem" }}>
                  <div style={{ display: "flex", height: "5px", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${100 - ((r.totalInterest / r.totalPaid) * 100)}%`, background: color, transition: "width 0.3s" }} />
                    <div style={{ flex: 1, background: "#222" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem" }}>
                    <span style={{ color: color, fontSize: "0.63rem" }}>Principal {(100 - (r.totalInterest / r.totalPaid) * 100).toFixed(1)}%</span>
                    <span style={{ color: "#444", fontSize: "0.63rem" }}>Interest {((r.totalInterest / r.totalPaid) * 100).toFixed(1)}%</span>
                  </div>
                </div>
                {s.downPct < 20 && (
                  <div style={{ background: "rgba(180,60,20,0.05)", border: "1px solid rgba(180,60,20,0.18)", borderRadius: "4px", padding: "0.65rem 0.85rem", color: "#a05a4a", fontSize: "0.67rem", lineHeight: 1.5 }}>
                    ⚠ CMHC mortgage insurance required (down &lt; 20%)
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* COMPARE VIEW */}
        {view === "compare" && (
          <div>
            {scenarios.length === 1 ? (
              <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#333" }}>
                <div style={{ fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.9rem" }}>Add more scenarios to compare</div>
                <button className="add-btn" onClick={() => { addScenario(); setView("builder"); }}>+ Add Scenario</button>
              </div>
            ) : (
              <>
                {/* Bar charts */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem", marginBottom: "1.2rem" }}>
                  {[
                    { title: "Payment Amount", fn: r => r.payment, fmt: fmtD, max: maxPayment, suffix: r => `/${r.freq === "monthly" ? "mo" : r.freq === "biweekly" ? "2wk" : "wk"}` },
                    { title: "Total Interest Paid", fn: r => r.totalInterest, fmt: fmt, max: maxInterest, suffix: () => "" },
                  ].map(({ title, fn, fmt: f, max, suffix }) => (
                    <div key={title} style={{ background: "#161616", border: "1px solid #1e1e1e", borderRadius: "4px", padding: "1.4rem" }}>
                      <div style={{ color: "#444", fontSize: "0.67rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1.2rem" }}>{title}</div>
                      {results.map((r, i) => (
                        <div key={r.id} style={{ marginBottom: "0.85rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                            <span style={{ color: COLORS[i], fontSize: "0.72rem", fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{r.name}</span>
                            <span style={{ color: "#a09080", fontSize: "0.78rem", fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{f(fn(r))}<span style={{ color: "#444", fontSize: "0.62rem", fontFamily: "'DM Mono', monospace" }}>{suffix(r)}</span></span>
                          </div>
                          <div style={{ height: "5px", background: "#1a1a1a", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(fn(r) / max) * 100}%`, background: COLORS[i], borderRadius: "3px", transition: "width 0.4s" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Comparison table */}
                <div style={{ background: "#161616", border: "1px solid #1e1e1e", borderRadius: "4px", overflowX: "auto", marginBottom: "1.2rem" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.73rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #222" }}>
                        <th style={{ padding: "0.85rem 1.2rem", textAlign: "left", color: "#333", fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.63rem" }}>Metric</th>
                        {results.map((r, i) => (
                          <th key={r.id} style={{ padding: "0.85rem 1rem", textAlign: "right", color: COLORS[i], fontWeight: 700, fontFamily: "'Playfair Display', serif", fontSize: "0.82rem" }}>{r.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Home Price", fn: r => fmt(r.price) },
                        { label: "Down Payment", fn: r => `${r.downPct}% · ${fmt(r.down)}` },
                        { label: "Interest Rate", fn: r => `${r.rate.toFixed(2)}%` },
                        { label: "Amortization", fn: r => `${r.amort} yrs` },
                        { label: "Payment", fn: r => fmtD(r.payment), hl: true },
                        { label: "Principal", fn: r => fmt(r.principal) },
                        { label: "Total Interest", fn: r => fmt(r.totalInterest) },
                        { label: "Total Cost", fn: r => fmt(r.totalPaid + r.down), hl: true },
                      ].map(({ label, fn, hl }) => (
                        <tr key={label} style={{ borderBottom: "1px solid #191919", background: hl ? "#1a1a1a" : "none" }}>
                          <td style={{ padding: "0.65rem 1.2rem", color: "#444", textTransform: "uppercase", fontSize: "0.63rem", letterSpacing: "0.06em" }}>{label}</td>
                          {results.map((r, ci) => (
                            <td key={r.id} style={{ padding: "0.65rem 1rem", textAlign: "right", color: hl ? COLORS[ci] : "#888070", fontFamily: hl ? "'Playfair Display', serif" : "'DM Mono', monospace", fontWeight: hl ? 700 : 400, fontSize: hl ? "0.83rem" : "0.7rem" }}>{fn(r)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* AI Report */}
                <div style={{ background: "#161616", border: "1px solid #1e1e1e", borderRadius: "4px", padding: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div>
                      <div style={{ color: "#555", fontSize: "0.67rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>AI Analysis Report</div>
                      <div style={{ color: "#2e2e20", fontSize: "0.62rem", marginTop: "0.2rem" }}>Powered by Claude</div>
                    </div>
                    <button className="gen-btn" onClick={generateReport} disabled={reportStatus === "generating"}>
                      {reportStatus === "generating" ? "Analyzing..." : reportStatus?.text ? "Regenerate" : "Generate Report"}
                    </button>
                  </div>

                  {reportStatus === "generating" && (
                    <div style={{ color: "#444", fontSize: "0.75rem", padding: "0.8rem 0", display: "flex", alignItems: "center", gap: "0.7rem" }}>
                      <span style={{ display: "inline-block", width: "7px", height: "7px", background: "#b5892a", borderRadius: "50%", animation: "pulse 1.2s ease-in-out infinite" }} />
                      Analyzing your scenarios...
                    </div>
                  )}

                  {reportStatus?.text && (
                    <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "1.1rem" }}>
                      {reportStatus.text.split("\n\n").filter(p => p.trim()).map((para, i) => {
                        const headers = ["Executive Summary", "Key Comparisons", "Recommendation", "Cautions"];
                        const isHeader = headers.some(h => para.trim().startsWith(h));
                        return (
                          <p key={i} style={{
                            margin: "0 0 0.85rem 0",
                            color: isHeader ? "#b5892a" : "#706860",
                            fontSize: isHeader ? "0.65rem" : "0.76rem",
                            letterSpacing: isHeader ? "0.15em" : "0.02em",
                            textTransform: isHeader ? "uppercase" : "none",
                            lineHeight: isHeader ? 1.4 : 1.75,
                            fontWeight: isHeader ? 600 : 400,
                          }}>{para.trim()}</p>
                        );
                      })}
                    </div>
                  )}

                  {!reportStatus && (
                    <div style={{ color: "#282828", fontSize: "0.73rem", letterSpacing: "0.04em", lineHeight: 1.6 }}>
                      Generate an AI-powered analysis comparing your scenarios — includes a recommendation and key insights.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ marginTop: "1.4rem", color: "#252525", fontSize: "0.6rem", letterSpacing: "0.05em", textAlign: "center" }}>
          For illustrative purposes only. Consult a licensed mortgage professional for personalized advice.
        </div>
      </div>
    </div>
  );
}
