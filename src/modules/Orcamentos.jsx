import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useConfig } from "../lib/ConfigContext";

const C = {
  bg: "#13151a", panel: "#1b1e26", panel2: "#222631", line: "#2e3342",
  ink: "#eef1f6", mute: "#878fa3", heat: "#ff6a2b", heatDim: "#ff6a2b22",
  cyan: "#37d6c5", green: "#7bd88f", red: "#ff5d6c", amber: "#f4c14b",
};

const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

const STATUS = {
  novo:     { txt: "Novo",      cor: C.cyan  },
  pendente: { txt: "Em aberto", cor: C.amber },
  ganho:    { txt: "Vendido",   cor: C.green },
  perdido:  { txt: "Perdido",   cor: C.red   },
};

export default function Orcamentos() {
  const { config } = useConfig();
  const [catalogo, setCatalogo]     = useState([]);
  const [orcamentos, setOrcamentos] = useState([]);
  const [vendas, setVendas]         = useState([]);
  const [userId, setUserId]         = useState("");

  // formulário novo orçamento
  const [cliente,  setCliente]  = useState("");
  const [contato,  setContato]  = useState("");
  const [validade, setValidade] = useState(addDias(7));
  const [obs,      setObs]      = useState("");
  const [itens,    setItens]    = useState([]);

  // filtro
  const [filtro, setFiltro] = useState("todos");

  // doc impressão
  const [docOrc, setDocOrc] = useState(null);

  // modal editar
  const [editando, setEditando] = useState(null); // orçamento sendo editado
  const [eCliente, setECliente] = useState("");
  const [eContato, setEContato] = useState("");
  const [eValidade, setEValidade] = useState("");
  const [eObs, setEObs] = useState("");
  const [eItens, setEItens] = useState([]);

  useEffect(() => {
    let channel;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      // catálogo
      const { data: cat } = await supabase.from("catalogo").select("produtos").eq("user_id", user.id).single();
      if (cat?.produtos) setCatalogo(cat.produtos);
      // orçamentos
      const { data: orcs } = await supabase.from("orcamentos").select("*").eq("user_id", user.id).order("criado_em", { ascending: false });
      if (orcs) setOrcamentos(orcs);
      // pedidos vitrine — merge como orçamentos novos
      const { data: pedidos } = await supabase
        .from("pedidos_vitrine")
        .select("*")
        .eq("user_id", user.id)
        .order("criado_em", { ascending: false });
      if (pedidos && pedidos.length > 0) {
        const idsExistentes = new Set((orcs || []).map((o) => o.vitrine_id));
        const novos = pedidos
          .filter((p) => !idsExistentes.has(p.id))
          .map((p) => ({
            id: `vitrine-${p.id}`,
            vitrine_id: p.id,
            numero: `VIT-${String(p.id).slice(-4).padStart(4, "0")}`,
            cliente: p.cliente || "Cliente vitrine",
            contato: "",
            validade: addDias(7),
            obs: p.obs || "",
            itens: (p.itens || []).map((i) => ({
              nome: i.nome, preco: i.preco || 0, custo: 0, qtd: i.qtd || 1, perso: false,
            })),
            total: p.total || 0,
            status: "novo",
            motivo: null,
            criado_em: p.criado_em?.slice(0, 10) || hoje(),
            origem: "vitrine",
          }));
        if (novos.length > 0) {
          await supabase.from("orcamentos").upsert(novos.map(o => ({ ...o, user_id: user.id })));
          setOrcamentos(prev => [...novos, ...prev]);
        }
      }
      // real-time
      channel = supabase.channel("orc-" + user.id)
        .on("postgres_changes", { event: "*", schema: "public", table: "orcamentos", filter: `user_id=eq.${user.id}` },
          async () => {
            const { data } = await supabase.from("orcamentos").select("*").eq("user_id", user.id).order("criado_em", { ascending: false });
            if (data) setOrcamentos(data);
          })
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const persistOrc = async (lista) => {
    setOrcamentos(lista);
    if (lista.length > 0 && userId) {
      await supabase.from("orcamentos").upsert(lista.map(o => ({ ...o, user_id: userId })));
    }
  };

  // ── formulário novo orçamento ──
  const addItem = () => {
    const base = catalogo[0];
    setItens((p) => [...p, { id: Date.now(), nome: base?.nome || "", preco: base?.preco || 0, custo: base?.custo || 0, qtd: 1, perso: false }]);
  };
  const addItemPerso = () => setItens((p) => [...p, { id: Date.now(), nome: "", preco: 0, custo: 0, qtd: 1, perso: true }]);
  const updItem = (id, patch) => setItens((p) => p.map((i) => i.id === id ? { ...i, ...patch } : i));
  const delItem = (id) => setItens((p) => p.filter((i) => i.id !== id));
  const escolherItem = (id, nome) => {
    const p = catalogo.find((x) => x.nome === nome);
    updItem(id, { nome, preco: p?.preco || 0, custo: p?.custo || 0 });
  };
  const totalForm = itens.reduce((s, i) => s + (parseFloat(i.preco) || 0) * (parseInt(i.qtd) || 0), 0);

  const criarOrcamento = async () => {
    if (!cliente.trim() || itens.length === 0) return;
    const o = {
      id: String(Date.now()),
      numero: "ORC-" + String(orcamentos.length + 1).padStart(4, "0"),
      cliente: cliente.trim(), contato: contato.trim(), validade, obs: obs.trim(),
      itens: itens.map((i) => ({ nome: i.nome, preco: parseFloat(i.preco) || 0, custo: parseFloat(i.custo) || 0, qtd: parseInt(i.qtd) || 1, perso: !!i.perso })),
      total: totalForm, status: "pendente", motivo: null, criado_em: hoje(), origem: "manual",
    };
    setOrcamentos(prev => [o, ...prev]);
    if (userId) await supabase.from("orcamentos").insert({ ...o, user_id: userId });
    setCliente(""); setContato(""); setValidade(addDias(7)); setObs(""); setItens([]);
  };

  // ── ações de status ──
  const marcarGanho = async (o) => {
    const novasVendas = o.itens.map((it, idx) => ({
      id: Date.now() + idx,
      produto: it.nome,
      canal: o.origem === "vitrine" ? "Vitrine" : "Orçamento",
      cliente: o.cliente,
      qtd: it.qtd,
      valor: it.preco * it.qtd,
      custo: it.custo * it.qtd,
      lucro: (it.preco - it.custo) * it.qtd,
      data: hoje(),
      pagamento: "pix",
      parcelas: 1,
      status: "pago",
    }));
    if (userId) {
      await supabase.from("vendas").insert(novasVendas.map(v => ({ ...v, user_id: userId })));
    }
    setVendas(prev => [...novasVendas, ...prev]);
    const updatedOrcs = orcamentos.map((x) => x.id === o.id ? { ...x, status: "ganho" } : x);
    setOrcamentos(updatedOrcs);
    if (userId) {
      await supabase.from("orcamentos").update({ status: "ganho" }).eq("id", o.id).eq("user_id", userId);
    }
  };
  const marcarPerdido = async (o, motivo) => {
    setOrcamentos(prev => prev.map((x) => x.id === o.id ? { ...x, status: "perdido", motivo } : x));
    if (userId) await supabase.from("orcamentos").update({ status: "perdido", motivo }).eq("id", o.id).eq("user_id", userId);
  };
  const marcarPendente = async (o) => {
    setOrcamentos(prev => prev.map((x) => x.id === o.id ? { ...x, status: "pendente", motivo: null } : x));
    if (userId) await supabase.from("orcamentos").update({ status: "pendente", motivo: null }).eq("id", o.id).eq("user_id", userId);
  };

  const delOrc = async (o) => {
    // remove da vitrine se for pedido de vitrine
    if (o.vitrine_id || o.vitrineId) {
      try { await supabase.from("pedidos_vitrine").delete().eq("id", o.vitrine_id || o.vitrineId); } catch (e) {}
    }
    setOrcamentos(prev => prev.filter((x) => x.id !== o.id));
    if (userId) await supabase.from("orcamentos").delete().eq("id", o.id).eq("user_id", userId);
  };

  // ── editar orçamento ──
  const abrirEditar = (o) => {
    setEditando(o);
    setECliente(o.cliente);
    setEContato(o.contato || "");
    setEValidade(o.validade);
    setEObs(o.obs || "");
    setEItens(o.itens.map((i) => ({ ...i, id: i.id || Date.now() + Math.random() })));
  };
  const eTotal = eItens.reduce((s, i) => s + (parseFloat(i.preco) || 0) * (parseInt(i.qtd) || 0), 0);
  const salvarEdicao = async () => {
    const updated = {
      ...editando,
      cliente: eCliente.trim() || editando.cliente,
      contato: eContato.trim(),
      validade: eValidade,
      obs: eObs.trim(),
      itens: eItens.map((i) => ({ ...i, preco: parseFloat(i.preco) || 0, custo: parseFloat(i.custo) || 0, qtd: parseInt(i.qtd) || 1 })),
      total: eTotal,
    };
    setOrcamentos(prev => prev.map((x) => x.id === editando.id ? updated : x));
    if (userId) {
      await supabase.from("orcamentos").update({ ...updated, user_id: userId }).eq("id", editando.id).eq("user_id", userId);
    }
    setEditando(null);
  };

  // ── indicadores ──
  const kpi = useMemo(() => {
    const ganhos = orcamentos.filter((o) => o.status === "ganho");
    const perdidos = orcamentos.filter((o) => o.status === "perdido");
    const pendentes = orcamentos.filter((o) => o.status === "pendente");
    const novos = orcamentos.filter((o) => o.status === "novo");
    const decididos = ganhos.length + perdidos.length;
    return {
      conversao: decididos ? (ganhos.length / decididos) * 100 : 0,
      emAberto: pendentes.reduce((s, o) => s + o.total, 0),
      ganhoValor: ganhos.reduce((s, o) => s + o.total, 0),
      nGanhos: ganhos.length, nPerdidos: perdidos.length,
      nPendentes: pendentes.length, nNovos: novos.length,
    };
  }, [orcamentos]);

  const lista = orcamentos.filter((o) => filtro === "todos" || o.status === filtro);

  const panel = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 22 };
  const heading = { fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: C.heat, margin: "0 0 18px", fontWeight: 700 };

  const gerarDoc = (o) => setDocOrc(o);
  const imprimir = () => window.print();

  const copiarWhatsApp = (o) => {
    const linhas = [
      `*Orçamento ${o.numero}*`,
      `Cliente: ${o.cliente}`,
      ``,
      ...o.itens.map(it => `• ${it.nome} ×${it.qtd} — ${brl(it.preco * it.qtd)}`),
      ``,
      `*Total: ${brl(o.total)}*`,
      `Válido até: ${fmtData(o.validade)}`,
      o.obs ? `\nObs: ${o.obs}` : "",
    ].filter(l => l !== undefined);
    navigator.clipboard.writeText(linhas.join("\n")).catch(() => {});
  };

  // ── documento ──
  if (docOrc) {
    const o = docOrc;
    return (
      <div style={{ minHeight: "100vh", background: "#f4f4f6", padding: "24px 16px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <style>{`@media print { .noprint { display: none !important; } body { background: #fff; } }`}</style>
        <div className="noprint" style={{ maxWidth: 720, margin: "0 auto 16px", display: "flex", gap: 10 }}>
          <button onClick={() => setDocOrc(null)} style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 14 }}>← Voltar</button>
          <button onClick={imprimir} style={{ padding: "10px 16px", borderRadius: 9, border: "none", background: C.heat, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Imprimir / Salvar PDF</button>
          <button onClick={() => copiarWhatsApp(o)} style={{ padding: "10px 16px", borderRadius: 9, border: "none", background: "#25D366", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Copiar p/ WhatsApp</button>
        </div>
        <div style={{ maxWidth: 720, margin: "0 auto", background: "#fff", padding: "48px 52px", borderRadius: 8, color: "#1a1a1f", boxShadow: "0 4px 24px #0002" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${config.cor_primaria || "#ff6a2b"}`, paddingBottom: 18, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {config.logo_base64 && (
                <img src={config.logo_base64} alt="logo" style={{ height: 44, width: 44, objectFit: "contain", borderRadius: 6 }} />
              )}
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>{config.nome_empresa || "F3D"}</div>
                <div style={{ fontSize: 12.5, color: "#666", marginTop: 2 }}>Impressão 3D sob demanda</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#ff6a2b" }}>ORÇAMENTO</div>
              <div style={{ fontSize: 13, color: "#666" }}>{o.numero}</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 26, fontSize: 13.5 }}>
            <div>
              <div style={{ color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Para</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{o.cliente}</div>
              {o.contato && <div style={{ color: "#555" }}>{o.contato}</div>}
            </div>
            <div style={{ textAlign: "right", color: "#555" }}>
              <div>Emitido: {fmtData(o.criado_em || o.criadoEm)}</div>
              <div>Válido até: <strong>{fmtData(o.validade)}</strong></div>
            </div>
          </div>
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
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: `${config.cor_primaria || "#ff6a2b"}18`, borderRadius: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: config.cor_primaria || "#ff6a2b" }}>{brl(o.total)}</span>
              </div>
            </div>
          </div>
          {o.obs && (
            <div style={{ marginTop: 26, padding: 14, background: "#f7f7f9", borderRadius: 8, fontSize: 13, color: "#444" }}>
              <strong style={{ display: "block", marginBottom: 4 }}>Observações</strong>{o.obs}
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

      {/* ── modal editar ── */}
      {editando && (
        <div onClick={() => setEditando(null)} style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ ...heading, margin: 0 }}>Editar orçamento</h2>
              <button onClick={() => setEditando(null)} style={{ background: "transparent", border: "none", color: C.mute, fontSize: 22, cursor: "pointer" }}>×</button>
            </div>
            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={label}>Cliente</span>
              <input value={eCliente} onChange={(e) => setECliente(e.target.value)} style={field} />
            </label>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <label style={{ flex: 1.3 }}>
                <span style={label}>Contato</span>
                <input value={eContato} onChange={(e) => setEContato(e.target.value)} style={field} placeholder="WhatsApp / e-mail" />
              </label>
              <label style={{ flex: 1 }}>
                <span style={label}>Válido até</span>
                <input type="date" value={eValidade} onChange={(e) => setEValidade(e.target.value)} style={field} />
              </label>
            </div>
            <span style={label}>Itens</span>
            {eItens.map((it) => (
              <div key={it.id} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 9, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input value={it.nome} onChange={(e) => setEItens((p) => p.map((i) => i.id === it.id ? { ...i, nome: e.target.value } : i))} style={{ ...field, flex: 1 }} placeholder="Item" />
                  <button onClick={() => setEItens((p) => p.filter((i) => i.id !== it.id))} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.mute, borderRadius: 7, width: 36, cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <label style={{ flex: 1 }}><span style={{ ...label, fontSize: 11 }}>Qtd</span>
                    <input type="number" value={it.qtd} onChange={(e) => setEItens((p) => p.map((i) => i.id === it.id ? { ...i, qtd: e.target.value } : i))} style={field} /></label>
                  <label style={{ flex: 1.4 }}><span style={{ ...label, fontSize: 11 }}>Preço</span>
                    <input type="number" step="0.01" value={it.preco} onChange={(e) => setEItens((p) => p.map((i) => i.id === it.id ? { ...i, preco: e.target.value } : i))} style={field} /></label>
                </div>
              </div>
            ))}
            <button onClick={() => setEItens((p) => [...p, { id: Date.now(), nome: "", preco: 0, custo: 0, qtd: 1 }])}
              style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.mute, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, cursor: "pointer", marginBottom: 12 }}>
              + Adicionar item
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.heatDim, borderRadius: 9, marginBottom: 12 }}>
              <span style={{ color: C.mute, fontSize: 13.5 }}>Total</span>
              <span style={{ fontWeight: 800, color: C.heat }}>{brl(eTotal)}</span>
            </div>
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={label}>Observações</span>
              <input value={eObs} onChange={(e) => setEObs(e.target.value)} style={field} />
            </label>
            <button onClick={salvarEdicao} style={{ width: "100%", padding: 13, borderRadius: 11, border: "none", background: C.heat, color: "#1a0d05", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}>
              Salvar alterações
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, letterSpacing: -0.3 }}>Orçamentos</h1>
          <p style={{ margin: "4px 0 0", color: C.mute, fontSize: 14 }}>Gere propostas, acompanhe ganhos e perdidos.</p>
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {[
            { t: "Novos (vitrine)", v: String(kpi.nNovos), c: C.cyan, s: "aguardando atendimento" },
            { t: "Taxa de conversão", v: `${kpi.conversao.toFixed(0)}%`, c: C.cyan, s: `${kpi.nGanhos} vendidos · ${kpi.nPerdidos} perdidos` },
            { t: "Em aberto", v: brl(kpi.emAberto), c: C.amber, s: `${kpi.nPendentes} em negociação` },
            { t: "Vendas fechadas", v: brl(kpi.ganhoValor), c: C.green, s: "registrado no financeiro" },
          ].map((k, i) => (
            <div key={i} style={{ ...panel, padding: "16px 18px", flex: 1, minWidth: 160 }}>
              <span style={{ fontSize: 12, color: C.mute }}>{k.t}</span>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.c, letterSpacing: -0.6, fontVariantNumeric: "tabular-nums", margin: "4px 0 0" }}>{k.v}</div>
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

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0 10px" }}>
              <span style={label}>Itens</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={addItem} style={{ background: C.heatDim, border: `1px solid ${C.heat}`, color: C.heat, borderRadius: 7, padding: "4px 10px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>+ Do catálogo</button>
                <button onClick={addItemPerso} style={{ background: "transparent", border: `1px solid ${C.cyan}`, color: C.cyan, borderRadius: 7, padding: "4px 10px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>+ Personalizado</button>
              </div>
            </div>
            {itens.length === 0 && (
              <p style={{ fontSize: 12.5, color: C.mute, margin: "0 0 12px", lineHeight: 1.5 }}>
                {catalogo.length > 0 ? "Adicione itens do catálogo, ou um item personalizado." : "Adicione um item personalizado e defina nome e preço."}
              </p>
            )}
            {itens.map((it) => (
              <div key={it.id} style={{ background: C.bg, border: `1px solid ${it.perso ? C.cyan + "66" : C.line}`, borderRadius: 9, padding: 10, marginBottom: 8 }}>
                {it.perso && <div style={{ fontSize: 11, color: C.cyan, fontWeight: 600, marginBottom: 6 }}>● Personalizado</div>}
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {it.perso || catalogo.length === 0 ? (
                    <input placeholder="Descreva o item" value={it.nome} onChange={(e) => updItem(it.id, { nome: e.target.value })} style={{ ...field, flex: 1 }} />
                  ) : (
                    <select value={it.nome} onChange={(e) => escolherItem(it.id, e.target.value)} style={{ ...field, flex: 1 }}>
                      {catalogo.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                    </select>
                  )}
                  <button onClick={() => delItem(it.id)} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.mute, borderRadius: 7, width: 36, cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <label style={{ flex: 1 }}><span style={{ ...label, fontSize: 11 }}>Qtd</span>
                    <input type="number" value={it.qtd} onChange={(e) => updItem(it.id, { qtd: e.target.value })} style={field} /></label>
                  <label style={{ flex: 1.4 }}><span style={{ ...label, fontSize: 11 }}>Preço unit.</span>
                    <input type="number" step="0.01" value={it.preco} onChange={(e) => updItem(it.id, { preco: e.target.value })} style={field} /></label>
                  <label style={{ flex: 1.4 }}><span style={{ ...label, fontSize: 11 }}>Subtotal</span>
                    <div style={{ ...field, color: C.cyan, fontWeight: 600 }}>{brl((parseFloat(it.preco) || 0) * (parseInt(it.qtd) || 0))}</div></label>
                </div>
              </div>
            ))}

            <label style={{ display: "block", margin: "8px 0 16px" }}>
              <span style={label}>Observações (opcional)</span>
              <input placeholder="Prazo, condições…" value={obs} onChange={(e) => setObs(e.target.value)} style={field} />
            </label>
            {itens.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: C.heatDim, borderRadius: 9, marginBottom: 14 }}>
                <span style={{ fontSize: 13.5, color: C.mute }}>Total</span>
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

          {/* lista */}
          <div style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ ...heading, margin: 0 }}>Acompanhamento</h2>
              {kpi.nNovos > 0 && (
                <span style={{ background: C.cyan, color: "#0a1a18", fontSize: 11, fontWeight: 800, borderRadius: 20, padding: "3px 10px" }}>
                  {kpi.nNovos} novo{kpi.nNovos > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {[["todos","Todos"],["novo","Novos"],["pendente","Em aberto"],["ganho","Vendidos"],["perdido","Perdidos"]].map(([id, txt]) => {
                const on = filtro === id;
                const cor = id === "novo" ? C.cyan : id === "pendente" ? C.amber : id === "ganho" ? C.green : id === "perdido" ? C.red : C.heat;
                return (
                  <button key={id} onClick={() => setFiltro(id)}
                    style={{ padding: "6px 12px", fontSize: 12.5, borderRadius: 7, cursor: "pointer",
                      fontWeight: on ? 600 : 400, color: on ? cor : C.mute,
                      background: on ? `${cor}22` : "transparent", border: `1px solid ${on ? cor : C.line}` }}>
                    {txt}
                  </button>
                );
              })}
            </div>

            {lista.length === 0 ? (
              <p style={{ fontSize: 13.5, color: C.mute, margin: 0 }}>Nenhum orçamento {filtro !== "todos" ? `com status "${filtro}"` : "ainda"}.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 9, maxHeight: 620, overflowY: "auto" }}>
                {lista.map((o) => {
                  const st = STATUS[o.status] || STATUS.pendente;
                  return (
                    <div key={o.id} style={{ background: C.bg, border: `1px solid ${o.status === "novo" ? C.cyan + "55" : C.line}`, borderRadius: 10, padding: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}>
                            {o.cliente}
                            {o.origem === "vitrine" && <span style={{ fontSize: 10, background: C.cyan + "33", color: C.cyan, borderRadius: 5, padding: "1px 6px" }}>vitrine</span>}
                          </div>
                          <span style={{ fontSize: 11.5, color: C.mute }}>{o.numero} · {fmtData(o.criado_em || o.criadoEm)}{o.validade ? ` · válido até ${fmtData(o.validade)}` : ""}</span>
                          {o.obs && <div style={{ fontSize: 12, color: C.mute, marginTop: 3, fontStyle: "italic" }}>{o.obs}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.heat, fontVariantNumeric: "tabular-nums" }}>{brl(o.total)}</div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: st.cor }}>● {st.txt}{o.motivo ? ` · ${o.motivo}` : ""}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <button onClick={() => gerarDoc(o)} style={btnMini(C.cyan)}>Documento</button>
                        <button onClick={() => copiarWhatsApp(o)} style={btnMini("#25D366")} title="Copiar mensagem formatada">WhatsApp</button>
                        {(o.status === "novo" || o.status === "pendente") && (
                          <>
                            <button onClick={() => marcarGanho(o)} style={btnMini(C.green)}>✓ Vendido</button>
                            <PerdaBtn onPick={(m) => marcarPerdido(o, m)} />
                            {o.status === "novo" && (
                              <button onClick={() => marcarPendente(o)} style={btnMini(C.amber)}>Em aberto</button>
                            )}
                          </>
                        )}
                        {(o.status === "ganho" || o.status === "perdido") && (
                          <button onClick={() => marcarPendente(o)} style={btnMini(C.mute)}>Reabrir</button>
                        )}
                        <button onClick={() => abrirEditar(o)} style={{ ...btnMini(C.mute), marginLeft: "auto" }}>Editar</button>
                        <button onClick={() => delOrc(o)} style={btnMini(C.red)}>Excluir</button>
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
    fontWeight: 600, color: cor, background: "transparent", border: `1px solid ${cor}55`,
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
