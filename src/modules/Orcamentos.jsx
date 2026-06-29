import React, { useState, useMemo, useEffect } from "react";

const C = {
  bg: "#13151a", panel: "#1b1e26", panel2: "#222631", line: "#2e3342",
  ink: "#eef1f6", mute: "#878fa3", heat: "#ff6a2b", heatDim: "#ff6a2b22",
  cyan: "#37d6c5", green: "#7bd88f", red: "#ff5d6c", amber: "#f4c14b",
};

const brl = (n) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const addDias = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const fmtData = (d) => (d ? d.split("-").reverse().join("/") : "");

const field = {
  width: "100%", background: C.bg, border: `1px solid ${C.line}`,
  borderRadius: 8, color: C.ink, padding: "10px 12px", fontSize: 15,
  fontVariantNumeric: "tabular-nums", outline: "none", boxSizing: "border-box",
};
const label = { display: "block", fontSize: 12, letterSpacing: 0.3, color: C.mute, marginBottom: 6 };

const MOTIVOS = ["Preço alto", "Prazo longo", "Desistiu", "Comprou de concorrente", "Sem resposta", "Outro"];

export default function Orcamentos() {
  const [catalogo, setCatalogo] = useState([]);
  const [orcamentos, setOrcamentos] = useState([]);
  const [vendas, setVendas] = useState([]);

  // formulário
  const [cliente, setCliente] = useState("");
  const [contato, setContato] = useState("");
  const [validade, setValidade] = useState(addDias(7));
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState([]);
  const [filtro, setFiltro] = useState("todos"); // todos | pendente | ganho | perdido
  const [docOrc, setDocOrc] = useState(null); // orçamento aberto no documento

  useEffect(() => {
    (async () => {
      try { const c = await window.storage.get("catalogo"); if (c?.value) setCatalogo(JSON.parse(c.value)); } catch (e) {}
      try { const o = await window.storage.get("orcamentos"); if (o?.value) setOrcamentos(JSON.parse(o.value)); } catch (e) {}
      try { const v = await window.storage.get("vendas"); if (v?.value) setVendas(JSON.parse(v.value)); } catch (e) {}
    })();
  }, []);

  const persistOrc = async (lista) => {
    setOrcamentos(lista);
    try { await window.storage.set("orcamentos", JSON.stringify(lista)); } catch (e) {}
  };
  const persistVendas = async (lista) => {
    setVendas(lista);
    try { await window.storage.set("vendas", JSON.stringify(lista)); } catch (e) {}
  };

  const addItem = () => {
    const base = catalogo[0];
    setItens((p) => [...p, {
      id: Date.now(),
      nome: base ? base.nome : "",
      preco: base ? base.preco : 0,
      custo: base ? base.custo : 0,
      qtd: 1,
      perso: false,
    }]);
  };
  const addItemPerso = () => setItens((p) => [...p, {
    id: Date.now(), nome: "", preco: 0, custo: 0, qtd: 1, perso: true,
  }]);
  const updItem = (id, patch) => setItens((p) => p.map((i) => i.id === id ? { ...i, ...patch } : i));
  const delItem = (id) => setItens((p) => p.filter((i) => i.id !== id));

  const escolherItem = (id, nome) => {
    const p = catalogo.find((x) => x.nome === nome);
    updItem(id, { nome, preco: p ? p.preco : 0, custo: p ? p.custo : 0 });
  };

  const totalForm = itens.reduce((s, i) => s + (parseFloat(i.preco) || 0) * (parseInt(i.qtd) || 0), 0);

  const criarOrcamento = () => {
    if (!cliente.trim() || itens.length === 0) return;
    const o = {
      id: Date.now(),
      numero: "ORC-" + String(orcamentos.length + 1).padStart(4, "0"),
      cliente: cliente.trim(),
      contato: contato.trim(),
      validade,
      obs: obs.trim(),
      itens: itens.map((i) => ({
        nome: i.nome, preco: parseFloat(i.preco) || 0,
        custo: parseFloat(i.custo) || 0, qtd: parseInt(i.qtd) || 1,
        perso: !!i.perso,
      })),
      total: totalForm,
      status: "pendente",
      motivo: null,
      criadoEm: hoje(),
    };
    persistOrc([o, ...orcamentos]);
    setCliente(""); setContato(""); setValidade(addDias(7)); setObs(""); setItens([]);
  };

  const marcarGanho = (o) => {
    // registra venda no financeiro
    const novasVendas = o.itens.map((it, idx) => ({
      id: Date.now() + idx,
      produto: it.nome,
      canal: "Orçamento",
      qtd: it.qtd,
      valor: it.preco * it.qtd,
      custo: it.custo * it.qtd,
      lucro: (it.preco - it.custo) * it.qtd,
      data: hoje(),
    }));
    persistVendas([...novasVendas, ...vendas]);
    persistOrc(orcamentos.map((x) => x.id === o.id ? { ...x, status: "ganho", motivo: null } : x));
  };
  const marcarPerdido = (o, motivo) =>
    persistOrc(orcamentos.map((x) => x.id === o.id ? { ...x, status: "perdido", motivo } : x));
  const reabrir = (o) =>
    persistOrc(orcamentos.map((x) => x.id === o.id ? { ...x, status: "pendente", motivo: null } : x));
  const delOrc = (id) => persistOrc(orcamentos.filter((x) => x.id !== id));

  // ── indicadores ───────────────────────────────────────────────
  const kpi = useMemo(() => {
    const ganhos = orcamentos.filter((o) => o.status === "ganho");
    const perdidos = orcamentos.filter((o) => o.status === "perdido");
    const pendentes = orcamentos.filter((o) => o.status === "pendente");
    const decididos = ganhos.length + perdidos.length;
    return {
      conversao: decididos ? (ganhos.length / decididos) * 100 : 0,
      emAberto: pendentes.reduce((s, o) => s + o.total, 0),
      ganhoValor: ganhos.reduce((s, o) => s + o.total, 0),
      nGanhos: ganhos.length, nPerdidos: perdidos.length, nPendentes: pendentes.length,
    };
  }, [orcamentos]);

  const lista = orcamentos.filter((o) => filtro === "todos" || o.status === filtro);

  const STATUS = {
    pendente: { txt: "Pendente", cor: C.amber },
    ganho: { txt: "Ganho", cor: C.green },
    perdido: { txt: "Perdido", cor: C.red },
  };

  const panel = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 22 };
  const heading = { fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: C.heat, margin: "0 0 18px", fontWeight: 700 };

  // ── documento do cliente (impressão) ──────────────────────────
  const gerarDoc = (o) => setDocOrc(o);
  const imprimir = () => window.print();

  if (docOrc) {
    const o = docOrc;
    return (
      <div style={{ minHeight: "100vh", background: "#f4f4f6", padding: "24px 16px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <style>{`@media print { .noprint { display: none !important; } body { background: #fff; } }`}</style>
        <div className="noprint" style={{ maxWidth: 720, margin: "0 auto 16px", display: "flex", gap: 10 }}>
          <button onClick={() => setDocOrc(null)} style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 14 }}>← Voltar</button>
          <button onClick={imprimir} style={{ padding: "10px 16px", borderRadius: 9, border: "none", background: C.heat, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Imprimir / Salvar PDF</button>
        </div>

        <div style={{ maxWidth: 720, margin: "0 auto", background: "#fff", padding: "48px 52px", borderRadius: 8, color: "#1a1a1f", boxShadow: "0 4px 24px #0002" }}>
          {/* cabeçalho */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #ff6a2b", paddingBottom: 18, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Sua Marca 3D</div>
              <div style={{ fontSize: 12.5, color: "#666", marginTop: 2 }}>Impressão 3D sob demanda</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#ff6a2b" }}>ORÇAMENTO</div>
              <div style={{ fontSize: 13, color: "#666" }}>{o.numero}</div>
            </div>
          </div>

          {/* cliente + datas */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 26, fontSize: 13.5 }}>
            <div>
              <div style={{ color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Para</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{o.cliente}</div>
              {o.contato && <div style={{ color: "#555" }}>{o.contato}</div>}
            </div>
            <div style={{ textAlign: "right", color: "#555" }}>
              <div>Emitido: {fmtData(o.criadoEm)}</div>
              <div>Válido até: <strong>{fmtData(o.validade)}</strong></div>
            </div>
          </div>

          {/* itens */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1a1a1f", textAlign: "left" }}>
                <th style={{ padding: "8px 0" }}>Item</th>
                <th style={{ padding: "8px 0", textAlign: "center", width: 60 }}>Qtd</th>
                <th style={{ padding: "8px 0", textAlign: "right", width: 110 }}>Unitário</th>
                <th style={{ padding: "8px 0", textAlign: "right", width: 110 }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {o.itens.map((it, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "11px 0" }}>{it.nome}</td>
                  <td style={{ padding: "11px 0", textAlign: "center" }}>{it.qtd}</td>
                  <td style={{ padding: "11px 0", textAlign: "right" }}>{brl(it.preco)}</td>
                  <td style={{ padding: "11px 0", textAlign: "right", fontWeight: 600 }}>{brl(it.preco * it.qtd)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* total */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "#fff4ee", borderRadius: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: "#ff6a2b" }}>{brl(o.total)}</span>
              </div>
            </div>
          </div>

          {o.obs && (
            <div style={{ marginTop: 26, padding: 14, background: "#f7f7f9", borderRadius: 8, fontSize: 13, color: "#444" }}>
              <strong style={{ display: "block", marginBottom: 4 }}>Observações</strong>
              {o.obs}
            </div>
          )}

          <div style={{ marginTop: 34, paddingTop: 16, borderTop: "1px solid #eee", fontSize: 11.5, color: "#999", textAlign: "center" }}>
            Este orçamento é válido até {fmtData(o.validade)}. Valores sujeitos a alteração após esta data.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", padding: "32px 20px 60px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, letterSpacing: -0.3 }}>Orçamentos</h1>
          <p style={{ margin: "4px 0 0", color: C.mute, fontSize: 14 }}>Gere propostas, acompanhe ganhos e perdidos.</p>
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {[
            { t: "Taxa de conversão", v: `${kpi.conversao.toFixed(0)}%`, c: C.cyan, s: `${kpi.nGanhos} ganhos · ${kpi.nPerdidos} perdidos` },
            { t: "Em aberto", v: brl(kpi.emAberto), c: C.amber, s: `${kpi.nPendentes} pendentes` },
            { t: "Fechado (ganho)", v: brl(kpi.ganhoValor), c: C.green, s: "vira venda no financeiro" },
          ].map((k, i) => (
            <div key={i} style={{ ...panel, padding: "16px 18px", flex: 1, minWidth: 170 }}>
              <span style={{ fontSize: 12, color: C.mute }}>{k.t}</span>
              <div style={{ fontSize: 25, fontWeight: 800, color: k.c, letterSpacing: -0.6, fontVariantNumeric: "tabular-nums", margin: "4px 0 0" }}>{k.v}</div>
              <span style={{ fontSize: 12, color: C.mute }}>{k.s}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 16, alignItems: "start" }}>
          {/* criar orçamento */}
          <div style={panel}>
            <h2 style={heading}>Novo orçamento</h2>
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={label}>Cliente</span>
              <input placeholder="Nome do cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} style={field} />
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ display: "block", marginBottom: 14, flex: 1.3 }}>
                <span style={label}>Contato (opcional)</span>
                <input placeholder="WhatsApp / e-mail" value={contato} onChange={(e) => setContato(e.target.value)} style={field} />
              </label>
              <label style={{ display: "block", marginBottom: 14, flex: 1 }}>
                <span style={label}>Válido até</span>
                <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} style={field} />
              </label>
            </div>

            {/* itens */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0 10px" }}>
              <span style={label}>Itens</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={addItem} style={{ background: C.heatDim, border: `1px solid ${C.heat}`, color: C.heat, borderRadius: 7, padding: "4px 10px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>+ Do catálogo</button>
                <button onClick={addItemPerso} style={{ background: "transparent", border: `1px solid ${C.cyan}`, color: C.cyan, borderRadius: 7, padding: "4px 10px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>+ Personalizado</button>
              </div>
            </div>
            {itens.length === 0 && (
              <p style={{ fontSize: 12.5, color: C.mute, margin: "0 0 12px", lineHeight: 1.5 }}>
                {catalogo.length > 0
                  ? "Adicione itens do catálogo, ou um item personalizado fora dele (peça exclusiva)."
                  : "Adicione um item personalizado e defina nome e preço na hora."}
              </p>
            )}
            {itens.map((it) => (
              <div key={it.id} style={{ background: C.bg, border: `1px solid ${it.perso ? C.cyan + "66" : C.line}`, borderRadius: 9, padding: 10, marginBottom: 8 }}>
                {it.perso && (
                  <div style={{ fontSize: 11, color: C.cyan, fontWeight: 600, marginBottom: 6 }}>● Personalizado (fora do catálogo)</div>
                )}
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {it.perso || catalogo.length === 0 ? (
                    <input placeholder={it.perso ? "Descreva a peça exclusiva" : "Item"} value={it.nome} onChange={(e) => updItem(it.id, { nome: e.target.value })} style={{ ...field, flex: 1 }} />
                  ) : (
                    <select value={it.nome} onChange={(e) => escolherItem(it.id, e.target.value)} style={{ ...field, flex: 1 }}>
                      {catalogo.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                    </select>
                  )}
                  <button onClick={() => delItem(it.id)} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.mute, borderRadius: 7, width: 36, cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <label style={{ flex: 1 }}>
                    <span style={{ ...label, fontSize: 11 }}>Qtd</span>
                    <input type="number" value={it.qtd} onChange={(e) => updItem(it.id, { qtd: e.target.value })} style={field} />
                  </label>
                  <label style={{ flex: 1.4 }}>
                    <span style={{ ...label, fontSize: 11 }}>Preço unit.</span>
                    <input type="number" step="0.01" value={it.preco} onChange={(e) => updItem(it.id, { preco: e.target.value })} style={field} />
                  </label>
                  <label style={{ flex: 1.4 }}>
                    <span style={{ ...label, fontSize: 11 }}>Subtotal</span>
                    <div style={{ ...field, color: C.cyan, fontWeight: 600 }}>{brl((parseFloat(it.preco) || 0) * (parseInt(it.qtd) || 0))}</div>
                  </label>
                </div>
              </div>
            ))}

            <label style={{ display: "block", margin: "8px 0 16px" }}>
              <span style={label}>Observações (opcional)</span>
              <input placeholder="Prazo de entrega, condições…" value={obs} onChange={(e) => setObs(e.target.value)} style={field} />
            </label>

            {itens.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: C.heatDim, borderRadius: 9, marginBottom: 14 }}>
                <span style={{ fontSize: 13.5, color: C.mute }}>Total do orçamento</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: C.heat, fontVariantNumeric: "tabular-nums" }}>{brl(totalForm)}</span>
              </div>
            )}

            <button onClick={criarOrcamento} disabled={!cliente.trim() || itens.length === 0}
              style={{ width: "100%", padding: 13, borderRadius: 11, border: "none", fontSize: 14.5, fontWeight: 700,
                cursor: cliente.trim() && itens.length ? "pointer" : "not-allowed",
                background: cliente.trim() && itens.length ? C.heat : C.line,
                color: cliente.trim() && itens.length ? "#1a0d05" : C.mute }}>
              Criar orçamento
            </button>
          </div>

          {/* lista de orçamentos */}
          <div style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ ...heading, margin: 0 }}>Acompanhamento</h2>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {[["todos", "Todos"], ["pendente", "Pendentes"], ["ganho", "Ganhos"], ["perdido", "Perdidos"]].map(([id, txt]) => {
                const on = filtro === id;
                return (
                  <button key={id} onClick={() => setFiltro(id)}
                    style={{ padding: "6px 12px", fontSize: 12.5, borderRadius: 7, cursor: "pointer",
                      fontWeight: on ? 600 : 400, color: on ? C.heat : C.mute,
                      background: on ? C.heatDim : "transparent", border: `1px solid ${on ? C.heat : C.line}` }}>
                    {txt}
                  </button>
                );
              })}
            </div>

            {lista.length === 0 ? (
              <p style={{ fontSize: 13.5, color: C.mute, margin: 0 }}>Nenhum orçamento {filtro !== "todos" ? `${filtro}` : "ainda"}.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 9, maxHeight: 620, overflowY: "auto" }}>
                {lista.map((o) => {
                  const st = STATUS[o.status];
                  return (
                    <div key={o.id} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{o.cliente}</div>
                          <span style={{ fontSize: 11.5, color: C.mute }}>{o.numero} · válido {fmtData(o.validade)}</span>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.heat, fontVariantNumeric: "tabular-nums" }}>{brl(o.total)}</div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: st.cor }}>● {st.txt}{o.motivo ? ` · ${o.motivo}` : ""}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => gerarDoc(o)} style={btnMini(C.cyan)}>Documento</button>
                        {o.status === "pendente" ? (
                          <>
                            <button onClick={() => marcarGanho(o)} style={btnMini(C.green)}>Ganho</button>
                            <PerdaBtn onPick={(m) => marcarPerdido(o, m)} />
                          </>
                        ) : (
                          <button onClick={() => reabrir(o)} style={btnMini(C.mute)}>Reabrir</button>
                        )}
                        <button onClick={() => delOrc(o.id)} style={{ ...btnMini(C.mute), marginLeft: "auto" }}>Excluir</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function btnMini(cor) {
  return {
    padding: "5px 11px", fontSize: 12.5, borderRadius: 7, cursor: "pointer",
    fontWeight: 600, color: cor, background: "transparent",
    border: `1px solid ${cor}55`,
  };
}

function PerdaBtn({ onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={btnMini("#ff5d6c")}>Perdido ▾</button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#222631", border: "1px solid #2e3342", borderRadius: 9, padding: 6, zIndex: 10, minWidth: 180, boxShadow: "0 6px 20px #0006" }}>
          {MOTIVOS.map((m) => (
            <button key={m} onClick={() => { onPick(m); setOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", fontSize: 12.5, color: "#eef1f6", background: "transparent", border: "none", borderRadius: 6, cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#2e3342"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
