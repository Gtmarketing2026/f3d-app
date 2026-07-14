import { useState, useEffect } from "react";

const C = {
  bg: "#0e1014", card: "#15171e", line: "#2e3342", ink: "#eef1f6",
  mute: "#878fa3", heat: "#ff6a2b", heatDim: "#ff6a2b22", cyan: "#37d6c5",
  green: "#22c55e", panel: "#1a1d27",
};

const field = {
  width: "100%", padding: "10px 13px", borderRadius: 9, border: `1px solid ${C.line}`,
  background: C.panel, color: C.ink, fontSize: 14, outline: "none", boxSizing: "border-box",
};
const label = { display: "block", fontSize: 12, color: C.mute, marginBottom: 6, fontWeight: 600, letterSpacing: 0.3 };

const MARCAS = ["Bambu Lab", "Creality", "Elegoo", "Anycubic", "Prusa", "Flashforge", "Artillery", "Sovol", "Outra"];
const MODELOS_SUGERIDOS = {
  "Bambu Lab": ["A1", "A1 Mini", "P1S", "P1P", "X1C", "X1E"],
  "Creality": ["Ender 3", "Ender 3 V2", "Ender 3 S1", "CR-10", "K1", "K1 Max"],
  "Elegoo": ["Saturn 4", "Jupiter SE", "Neptune 4", "Mars 4"],
  "Anycubic": ["Kobra 2", "Photon Mono X", "Vyper"],
  "Prusa": ["MK4", "MK3S+", "Mini+", "XL"],
};

const KEY = "app3d:impressoras";
const hoje = () => new Date().toISOString().slice(0, 10);

function brl(v) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function calcDepreciacao(imp) {
  if (!imp.vida_util_h || !imp.preco_compra) return 0;
  return (parseFloat(imp.preco_compra) || 0) / (parseFloat(imp.vida_util_h) || 1);
}

const VAZIO = {
  id: null, nome: "", marca: "Bambu Lab", modelo: "", potencia_w: 350,
  vida_util_h: 5000, preco_compra: "", data_compra: hoje(), ativa: true, obs: "",
};

export default function Impressoras() {
  const [lista, setLista] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  });
  const [modal, setModal] = useState(null);
  const [confirmaRemover, setConfirmaRemover] = useState(null);

  const jobsLS = (() => {
    try { return JSON.parse(localStorage.getItem("app3d:producao")) || []; } catch { return []; }
  })();

  const horasPorImp = jobsLS.reduce((acc, j) => {
    if (j.impressora_id && j.status === "pronto" || j.status === "entregue") {
      acc[j.impressora_id] = (acc[j.impressora_id] || 0) + (parseFloat(j.tempo_h) || 0);
    }
    return acc;
  }, {});

  const persistir = (nova) => {
    setLista(nova);
    localStorage.setItem(KEY, JSON.stringify(nova));
  };

  const salvarModal = () => {
    const imp = { ...modal, potencia_w: parseFloat(modal.potencia_w) || 0, vida_util_h: parseFloat(modal.vida_util_h) || 0 };
    if (!imp.nome.trim()) return;
    if (imp.id) {
      persistir(lista.map(x => x.id === imp.id ? imp : x));
    } else {
      persistir([...lista, { ...imp, id: String(Date.now()) }]);
    }
    setModal(null);
  };

  const remover = (id) => { persistir(lista.filter(x => x.id !== id)); setConfirmaRemover(null); };

  const ativas = lista.filter(x => x.ativa);
  const inativas = lista.filter(x => !x.ativa);

  const GrupoLista = ({ items, titulo }) => items.length === 0 ? null : (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>{titulo}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map(imp => {
          const horas = horasPorImp[imp.id] || 0;
          const pct = imp.vida_util_h ? Math.min(100, (horas / imp.vida_util_h) * 100) : 0;
          const deprH = calcDepreciacao(imp);
          return (
            <div key={imp.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 13, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>🖨️</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{imp.nome}</span>
                    {!imp.ativa && <span style={{ fontSize: 11, color: C.mute, border: `1px solid ${C.line}`, borderRadius: 5, padding: "1px 6px" }}>inativa</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: C.mute, marginBottom: 10 }}>
                    {imp.marca}{imp.modelo ? ` · ${imp.modelo}` : ""}
                    {imp.data_compra ? ` · compra: ${imp.data_compra.slice(0, 7)}` : ""}
                    {imp.potencia_w ? ` · ${imp.potencia_w}W` : ""}
                  </div>
                  {/* Barra de vida útil */}
                  {imp.vida_util_h > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: C.mute, marginBottom: 4 }}>
                        <span>Vida útil usada</span>
                        <span>{horas.toFixed(0)}h / {imp.vida_util_h}h ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: C.line }}>
                        <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : C.green, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.mute, flexWrap: "wrap" }}>
                    {deprH > 0 && <span>Depreciação: <strong style={{ color: C.ink }}>{brl(deprH)}/h</strong></span>}
                    {imp.preco_compra && <span>Valor pago: <strong style={{ color: C.ink }}>{brl(imp.preco_compra)}</strong></span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setModal({ ...imp })}
                    style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontSize: 12, cursor: "pointer" }}>
                    Editar
                  </button>
                  <button onClick={() => setConfirmaRemover(imp.id)}
                    style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.mute, fontSize: 13, cursor: "pointer" }}>
                    ×
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "36px 28px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 700 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ color: C.ink, fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>Impressoras</h1>
            <p style={{ color: C.mute, fontSize: 13.5, margin: 0 }}>Gerencie seu parque de máquinas e acompanhe o desgaste por impressora.</p>
          </div>
          <button onClick={() => setModal({ ...VAZIO })}
            style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: C.heat, color: "#1a0d05", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>
            + Impressora
          </button>
        </div>

        {/* KPIs */}
        {lista.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
            {[
              { label: "Máquinas ativas", valor: ativas.length, cor: C.green },
              { label: "Horas totais produzidas", valor: Object.values(horasPorImp).reduce((a, b) => a + b, 0).toFixed(0) + "h", cor: C.cyan },
              { label: "Inativas", valor: inativas.length, cor: C.mute },
            ].map(k => (
              <div key={k.label} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: C.mute, marginBottom: 6, fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.cor }}>{k.valor}</div>
              </div>
            ))}
          </div>
        )}

        {lista.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.mute }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🖨️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Nenhuma impressora cadastrada</div>
            <div style={{ fontSize: 13.5 }}>Cadastre suas máquinas para controlar vida útil e custo por hora.</div>
          </div>
        ) : (
          <>
            <GrupoLista items={ativas} titulo="Ativas" />
            <GrupoLista items={inativas} titulo="Inativas" />
          </>
        )}
      </div>

      {/* Modal add/edit */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, color: C.ink, fontSize: 17, fontWeight: 800 }}>{modal.id ? "Editar impressora" : "Nova impressora"}</h2>
              <button onClick={() => setModal(null)} style={{ background: "transparent", border: "none", color: C.mute, fontSize: 22, cursor: "pointer" }}>×</button>
            </div>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={label}>Nome / apelido *</span>
              <input value={modal.nome} onChange={e => setModal({ ...modal, nome: e.target.value })} style={field} placeholder="Ex.: Bambu A1 #1, Ender da Garagem…" />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <label style={{ display: "block" }}>
                <span style={label}>Marca</span>
                <select value={modal.marca} onChange={e => setModal({ ...modal, marca: e.target.value, modelo: "" })} style={field}>
                  {MARCAS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label style={{ display: "block" }}>
                <span style={label}>Modelo</span>
                <input list="modelos-list" value={modal.modelo} onChange={e => setModal({ ...modal, modelo: e.target.value })} style={field} placeholder="Ex.: A1 Mini" />
                <datalist id="modelos-list">
                  {(MODELOS_SUGERIDOS[modal.marca] || []).map(m => <option key={m} value={m} />)}
                </datalist>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <label style={{ display: "block" }}>
                <span style={label}>Potência (W)</span>
                <input type="number" value={modal.potencia_w} onChange={e => setModal({ ...modal, potencia_w: e.target.value })} style={field} placeholder="350" />
              </label>
              <label style={{ display: "block" }}>
                <span style={label}>Vida útil estimada (horas)</span>
                <input type="number" value={modal.vida_util_h} onChange={e => setModal({ ...modal, vida_util_h: e.target.value })} style={field} placeholder="5000" />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <label style={{ display: "block" }}>
                <span style={label}>Valor de compra (R$)</span>
                <input type="number" step="0.01" value={modal.preco_compra} onChange={e => setModal({ ...modal, preco_compra: e.target.value })} style={field} placeholder="1.200,00" />
              </label>
              <label style={{ display: "block" }}>
                <span style={label}>Data de compra</span>
                <input type="date" value={modal.data_compra} onChange={e => setModal({ ...modal, data_compra: e.target.value })} style={field} />
              </label>
            </div>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={label}>Observações</span>
              <input value={modal.obs} onChange={e => setModal({ ...modal, obs: e.target.value })} style={field} placeholder="Bico 0.4mm, filamento PLA/PETG…" />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
              <input type="checkbox" checked={modal.ativa} onChange={e => setModal({ ...modal, ativa: e.target.checked })} />
              <span style={{ fontSize: 13.5, color: C.ink }}>Impressora ativa</span>
            </label>

            {modal.potencia_w > 0 && modal.vida_util_h > 0 && modal.preco_compra > 0 && (
              <div style={{ background: C.bg, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: C.mute }}>
                Depreciação estimada: <strong style={{ color: C.cyan }}>{brl(calcDepreciacao(modal))}/hora</strong>
              </div>
            )}

            <button onClick={salvarModal} disabled={!modal.nome.trim()}
              style={{ width: "100%", padding: 13, borderRadius: 11, border: "none", fontWeight: 700, fontSize: 14.5, cursor: modal.nome.trim() ? "pointer" : "not-allowed",
                background: modal.nome.trim() ? C.heat : C.line, color: modal.nome.trim() ? "#1a0d05" : C.mute }}>
              {modal.id ? "Salvar alterações" : "Cadastrar impressora"}
            </button>
          </div>
        </div>
      )}

      {/* Confirmar remoção */}
      {confirmaRemover && (
        <div onClick={() => setConfirmaRemover(null)} style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 26, maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Remover impressora?</div>
            <div style={{ fontSize: 13, color: C.mute, marginBottom: 20 }}>O histórico de horas dos jobs ainda será mantido.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmaRemover(null)} style={{ flex: 1, padding: 11, borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => remover(confirmaRemover)} style={{ flex: 1, padding: 11, borderRadius: 9, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
