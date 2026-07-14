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

const KEY_PROD = "app3d:producao";
const KEY_IMP = "app3d:impressoras";
const KEY_ORC = "app3d:orcamentos";
const KEY_EST = "app3d:estoque_acabados";

const hoje = () => new Date().toISOString().slice(0, 10);
const brl = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const STATUS = [
  { id: "fila",       label: "Na fila",        cor: C.cyan,  icone: "⏳" },
  { id: "imprimindo", label: "Imprimindo",      cor: "#f59e0b", icone: "🖨️" },
  { id: "pos_proc",   label: "Pós-proc.",       cor: "#a78bfa", icone: "🔧" },
  { id: "pronto",     label: "Pronto",          cor: C.green, icone: "✅" },
  { id: "entregue",   label: "Entregue",        cor: C.mute,  icone: "📦" },
];

const statusInfo = (id) => STATUS.find(s => s.id === id) || STATUS[0];

const VAZIO_JOB = {
  id: null, criado_em: hoje(), cliente: "", produto: "", qtd: 1,
  impressora_id: "", tempo_h: 0, preco_unit: 0, status: "fila", obs: "", orcamento_id: null,
};

export default function Producao() {
  const [jobs, setJobs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_PROD)) || []; } catch { return []; }
  });
  const [impressoras, setImpressoras] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_IMP)) || []; } catch { return []; }
  });
  const [orcamentos, setOrcamentos] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_ORC)) || []; } catch { return []; }
  });
  const [catalogo, setCatalogo] = useState(() => {
    try {
      const raw = localStorage.getItem("app3d:catalogo");
      return (raw ? JSON.parse(raw) : []);
    } catch { return []; }
  });

  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [modal, setModal] = useState(null);
  const [modalImpressora, setModalImpressora] = useState(null); // job para atribuir impressora
  const [modalEstoque, setModalEstoque] = useState(null);

  const persistir = (nova) => {
    setJobs(nova);
    localStorage.setItem(KEY_PROD, JSON.stringify(nova));
  };

  // Orçamentos ganhos não ainda na fila de produção
  const orcGanhos = orcamentos.filter(o => o.status === "ganho" && !jobs.find(j => j.orcamento_id === o.id));

  const importarOrcamento = (o) => {
    const novos = o.itens.map(it => ({
      ...VAZIO_JOB,
      id: String(Date.now()) + Math.random(),
      criado_em: hoje(),
      cliente: o.cliente,
      produto: it.nome,
      qtd: it.qtd || 1,
      preco_unit: it.preco || 0,
      status: "fila",
      orcamento_id: o.id,
    }));
    persistir([...jobs, ...novos]);
  };

  const salvarModal = () => {
    if (!modal.produto.trim()) return;
    const job = { ...modal, qtd: parseInt(modal.qtd) || 1, tempo_h: parseFloat(modal.tempo_h) || 0, preco_unit: parseFloat(modal.preco_unit) || 0 };
    if (job.id) {
      persistir(jobs.map(j => j.id === job.id ? job : j));
    } else {
      persistir([...jobs, { ...job, id: String(Date.now()) }]);
    }
    setModal(null);
  };

  const avancarStatus = (id, novoStatus, impressora_id) => {
    persistir(jobs.map(j => j.id === id ? { ...j, status: novoStatus, ...(impressora_id !== undefined ? { impressora_id } : {}) } : j));
  };

  const remover = (id) => persistir(jobs.filter(j => j.id !== id));

  const enviarEstoque = (job) => {
    const atual = (() => { try { return JSON.parse(localStorage.getItem(KEY_EST)) || []; } catch { return []; } })();
    const entrada = {
      id: String(Date.now()),
      produto: job.produto,
      qtd: job.qtd,
      data: hoje(),
      origem: "producao",
      job_id: job.id,
      preco_unit: job.preco_unit,
      cliente: job.cliente,
    };
    localStorage.setItem(KEY_EST, JSON.stringify([...atual, entrada]));
    avancarStatus(job.id, "entregue");
    setModalEstoque(null);
  };

  const jobsFiltrados = filtroStatus === "todos"
    ? jobs
    : jobs.filter(j => j.status === filtroStatus);

  // KPIs
  const hoje2 = hoje();
  const emImpressao = jobs.filter(j => j.status === "imprimindo").length;
  const nFila = jobs.filter(j => j.status === "fila").length;
  const prontos = jobs.filter(j => j.status === "pronto").length;
  const hojeEntregues = jobs.filter(j => j.status === "entregue" && j.criado_em === hoje2).length;

  const nomeImpressora = (id) => {
    const imp = impressoras.find(i => i.id === id);
    return imp ? imp.nome : id ? "Impressora removida" : "Não atribuída";
  };

  const BotaoAvancar = ({ job }) => {
    const idx = STATUS.findIndex(s => s.id === job.status);
    if (idx >= STATUS.length - 1) return null;
    const prox = STATUS[idx + 1];
    if (prox.id === "imprimindo") {
      return (
        <button onClick={() => setModalImpressora(job)}
          style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${prox.cor}66`, background: prox.cor + "22", color: prox.cor, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
          {prox.icone} {prox.label}
        </button>
      );
    }
    if (prox.id === "entregue") {
      return (
        <button onClick={() => setModalEstoque(job)}
          style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.green}66`, background: C.green + "22", color: C.green, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
          📦 Enviar ao estoque
        </button>
      );
    }
    return (
      <button onClick={() => avancarStatus(job.id, prox.id)}
        style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${prox.cor}66`, background: prox.cor + "22", color: prox.cor, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
        {prox.icone} {prox.label}
      </button>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "36px 28px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ color: C.ink, fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>Produção</h1>
            <p style={{ color: C.mute, fontSize: 13.5, margin: 0 }}>Fila de impressão, acompanhamento de jobs e saída para estoque de produtos acabados.</p>
          </div>
          <button onClick={() => setModal({ ...VAZIO_JOB })}
            style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: C.heat, color: "#1a0d05", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>
            + Novo job
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Na fila", valor: nFila, cor: C.cyan },
            { label: "Imprimindo", valor: emImpressao, cor: "#f59e0b" },
            { label: "Prontos p/ entrega", valor: prontos, cor: C.green },
            { label: "Entregues hoje", valor: hojeEntregues, cor: C.mute },
          ].map(k => (
            <div key={k.label} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: C.mute, marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.cor }}>{k.valor}</div>
            </div>
          ))}
        </div>

        {/* Banner orçamentos a importar */}
        {orcGanhos.length > 0 && (
          <div style={{ background: C.heatDim, border: `1px solid ${C.heat}44`, borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.heat, marginBottom: 10 }}>
              🎉 {orcGanhos.length} orçamento{orcGanhos.length > 1 ? "s" : ""} ganho{orcGanhos.length > 1 ? "s" : ""} aguardando produção
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {orcGanhos.map(o => (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 13, color: C.ink }}>
                    <strong>{o.numero}</strong> · {o.cliente} · {o.itens?.length} item{o.itens?.length !== 1 ? "s" : ""}
                    <span style={{ color: C.mute, marginLeft: 8 }}>{brl(o.total)}</span>
                  </div>
                  <button onClick={() => importarOrcamento(o)}
                    style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: C.heat, color: "#1a0d05", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Importar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtro de status */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {[{ id: "todos", label: "Todos", cor: C.ink }, ...STATUS].map(s => (
            <button key={s.id} onClick={() => setFiltroStatus(s.id)}
              style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${filtroStatus === s.id ? s.cor : C.line}`,
                background: filtroStatus === s.id ? s.cor + "22" : "transparent",
                color: filtroStatus === s.id ? s.cor : C.mute, fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>
              {s.icone ? `${s.icone} ` : ""}{s.label}
              {s.id !== "todos" && <span style={{ marginLeft: 6, opacity: 0.7 }}>{jobs.filter(j => j.status === s.id).length}</span>}
            </button>
          ))}
        </div>

        {/* Lista de jobs */}
        {jobsFiltrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.mute }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🖨️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
              {filtroStatus === "todos" ? "Nenhum job na fila" : `Nenhum job com status "${statusInfo(filtroStatus).label}"`}
            </div>
            <div style={{ fontSize: 13.5 }}>Crie um novo job manualmente ou importe um orçamento ganho.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {jobsFiltrados.map(job => {
              const st = statusInfo(job.status);
              const imp = impressoras.find(i => i.id === job.impressora_id);
              return (
                <div key={job.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 13, padding: "14px 18px" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {/* Status badge */}
                    <div style={{ background: st.cor + "22", border: `1px solid ${st.cor}44`, borderRadius: 8, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, color: st.cor, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {st.icone} {st.label}
                    </div>
                    {/* Conteúdo */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                            {job.produto} <span style={{ fontSize: 12.5, fontWeight: 400, color: C.mute }}>×{job.qtd}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: C.mute, marginBottom: 8 }}>
                            {job.cliente && <span style={{ marginRight: 12 }}>👤 {job.cliente}</span>}
                            {job.tempo_h > 0 && <span style={{ marginRight: 12 }}>⏱ {job.tempo_h}h</span>}
                            {job.preco_unit > 0 && <span style={{ marginRight: 12 }}>💰 {brl(job.preco_unit * job.qtd)}</span>}
                            {imp && <span style={{ color: C.cyan }}>🖨️ {imp.nome}</span>}
                            {!imp && job.status === "imprimindo" && <span style={{ color: "#f59e0b" }}>🖨️ {nomeImpressora(job.impressora_id)}</span>}
                          </div>
                          {job.obs && <div style={{ fontSize: 12, color: C.mute, fontStyle: "italic" }}>{job.obs}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                          <BotaoAvancar job={job} />
                          <button onClick={() => setModal({ ...job })}
                            style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.mute, fontSize: 12, cursor: "pointer" }}>
                            ✎
                          </button>
                          <button onClick={() => remover(job.id)}
                            style={{ padding: "5px 8px", borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.mute, fontSize: 14, cursor: "pointer" }}>
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal criar/editar job */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, color: C.ink, fontSize: 17, fontWeight: 800 }}>{modal.id ? "Editar job" : "Novo job de produção"}</h2>
              <button onClick={() => setModal(null)} style={{ background: "transparent", border: "none", color: C.mute, fontSize: 22, cursor: "pointer" }}>×</button>
            </div>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={label}>Produto *</span>
              <input list="prod-list" value={modal.produto} onChange={e => setModal({ ...modal, produto: e.target.value })} style={field} placeholder="Nome do produto ou peça" />
              <datalist id="prod-list">
                {catalogo.map(p => <option key={p.id} value={p.nome} />)}
              </datalist>
            </label>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={label}>Cliente</span>
              <input value={modal.cliente} onChange={e => setModal({ ...modal, cliente: e.target.value })} style={field} placeholder="Nome do cliente (opcional)" />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <label style={{ display: "block" }}>
                <span style={label}>Quantidade</span>
                <input type="number" min="1" value={modal.qtd} onChange={e => setModal({ ...modal, qtd: e.target.value })} style={field} />
              </label>
              <label style={{ display: "block" }}>
                <span style={label}>Tempo est. (h)</span>
                <input type="number" step="0.5" min="0" value={modal.tempo_h} onChange={e => setModal({ ...modal, tempo_h: e.target.value })} style={field} />
              </label>
              <label style={{ display: "block" }}>
                <span style={label}>Preço unit.</span>
                <input type="number" step="0.01" min="0" value={modal.preco_unit} onChange={e => setModal({ ...modal, preco_unit: e.target.value })} style={field} />
              </label>
            </div>

            {impressoras.filter(i => i.ativa).length > 0 && (
              <label style={{ display: "block", marginBottom: 14 }}>
                <span style={label}>Impressora</span>
                <select value={modal.impressora_id} onChange={e => setModal({ ...modal, impressora_id: e.target.value })} style={field}>
                  <option value="">Não atribuída</option>
                  {impressoras.filter(i => i.ativa).map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
              </label>
            )}

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={label}>Status</span>
              <select value={modal.status} onChange={e => setModal({ ...modal, status: e.target.value })} style={field}>
                {STATUS.map(s => <option key={s.id} value={s.id}>{s.icone} {s.label}</option>)}
              </select>
            </label>

            <label style={{ display: "block", marginBottom: 20 }}>
              <span style={label}>Observações</span>
              <input value={modal.obs} onChange={e => setModal({ ...modal, obs: e.target.value })} style={field} placeholder="Cor, material, instrução especial…" />
            </label>

            <button onClick={salvarModal} disabled={!modal.produto.trim()}
              style={{ width: "100%", padding: 13, borderRadius: 11, border: "none", fontWeight: 700, fontSize: 14.5,
                cursor: modal.produto.trim() ? "pointer" : "not-allowed",
                background: modal.produto.trim() ? C.heat : C.line,
                color: modal.produto.trim() ? "#1a0d05" : C.mute }}>
              {modal.id ? "Salvar alterações" : "Criar job"}
            </button>
          </div>
        </div>
      )}

      {/* Modal atribuir impressora */}
      {modalImpressora && (
        <div onClick={() => setModalImpressora(null)} style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 26, maxWidth: 420, width: "100%" }}>
            <h2 style={{ margin: "0 0 16px", color: C.ink, fontSize: 17, fontWeight: 800 }}>Atribuir impressora</h2>
            <div style={{ fontSize: 13.5, color: C.mute, marginBottom: 18 }}>
              Job: <strong style={{ color: C.ink }}>{modalImpressora.produto}</strong> ×{modalImpressora.qtd}
            </div>
            {impressoras.filter(i => i.ativa).length === 0 ? (
              <div style={{ fontSize: 13, color: C.mute, marginBottom: 18 }}>
                Nenhuma impressora ativa cadastrada. Você pode continuar sem atribuir uma.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {impressoras.filter(i => i.ativa).map(imp => (
                  <button key={imp.id}
                    onClick={() => { avancarStatus(modalImpressora.id, "imprimindo", imp.id); setModalImpressora(null); }}
                    style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.line}`, background: C.bg, color: C.ink, textAlign: "left", cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>
                    🖨️ {imp.nome}
                    <span style={{ fontSize: 12, color: C.mute, fontWeight: 400, marginLeft: 8 }}>{imp.marca} {imp.modelo}</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModalImpressora(null)}
                style={{ flex: 1, padding: 11, borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.mute, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={() => { avancarStatus(modalImpressora.id, "imprimindo", ""); setModalImpressora(null); }}
                style={{ flex: 1, padding: 11, borderRadius: 9, border: "none", background: "#f59e0b22", color: "#f59e0b", fontWeight: 700, cursor: "pointer" }}>
                🖨️ Sem impressora específica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal enviar ao estoque */}
      {modalEstoque && (
        <div onClick={() => setModalEstoque(null)} style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 26, maxWidth: 400, width: "100%" }}>
            <h2 style={{ margin: "0 0 10px", color: C.ink, fontSize: 17, fontWeight: 800 }}>📦 Enviar ao estoque</h2>
            <p style={{ fontSize: 13.5, color: C.mute, margin: "0 0 18px", lineHeight: 1.6 }}>
              <strong style={{ color: C.ink }}>{modalEstoque.produto}</strong> ×{modalEstoque.qtd} será registrado no estoque de produtos acabados e o job marcado como entregue.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModalEstoque(null)}
                style={{ flex: 1, padding: 11, borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.mute, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={() => enviarEstoque(modalEstoque)}
                style={{ flex: 1, padding: 11, borderRadius: 9, border: "none", background: C.green, color: "#0c1410", fontWeight: 700, cursor: "pointer" }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
