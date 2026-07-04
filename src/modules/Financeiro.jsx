import React, { useState, useMemo, useEffect } from "react";

// ── Design tokens (mesma identidade da calculadora) ────────────
const C = {
  bg: "#13151a",
  panel: "#1b1e26",
  panel2: "#222631",
  line: "#2e3342",
  ink: "#eef1f6",
  mute: "#878fa3",
  heat: "#ff6a2b",
  heatDim: "#ff6a2b22",
  cyan: "#37d6c5",
  green: "#7bd88f",
  red: "#ff5d6c",
  amber: "#f4c14b",
};

const brl = (n) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);

const CATEGORIAS = [
  { id: "filamento", nome: "Filamento", cor: "#ff6a2b" },
  { id: "energia", nome: "Energia", cor: "#f4c14b" },
  { id: "equipamento", nome: "Equipamento", cor: "#9b8cff" },
  { id: "embalagem", nome: "Embalagem", cor: "#5fb0ff" },
  { id: "assinatura", nome: "Assinaturas", cor: "#37d6c5" },
  { id: "outros", nome: "Outros", cor: "#878fa3" },
];

const field = {
  width: "100%",
  background: C.bg,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  color: C.ink,
  padding: "10px 12px",
  fontSize: 15,
  fontVariantNumeric: "tabular-nums",
  outline: "none",
  boxSizing: "border-box",
};

const label = {
  display: "block",
  fontSize: 12,
  letterSpacing: 0.3,
  color: C.mute,
  marginBottom: 6,
};

function KPI({ titulo, valor, cor, sub }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding: "16px 18px",
        flex: 1,
        minWidth: 150,
      }}
    >
      <span style={{ fontSize: 12, color: C.mute, letterSpacing: 0.3 }}>{titulo}</span>
      <div
        style={{
          fontSize: 25,
          fontWeight: 800,
          color: cor || C.ink,
          letterSpacing: -0.6,
          fontVariantNumeric: "tabular-nums",
          margin: "4px 0 0",
        }}
      >
        {valor}
      </div>
      {sub && <span style={{ fontSize: 12, color: C.mute }}>{sub}</span>}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────
const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const mesLabel = (ym) => {
  const [y, m] = ym.split("-");
  return `${MESES_PT[parseInt(m) - 1]}/${y.slice(2)}`;
};

export default function Financeiro() {
  const [catalogo, setCatalogo] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [aba, setAba] = useState("venda"); // venda | despesa | dashboard
  const [verLancamentos, setVerLancamentos] = useState(null); // null | "vendas" | "despesas" | "todos"
  const [mes, setMes] = useState(mesAtual());

  // formulário de venda
  const [vProduto, setVProduto] = useState("");
  const [vQtd, setVQtd] = useState(1);
  const [vValor, setVValor] = useState("");
  const [vData, setVData] = useState(hoje());
  const [vCliente, setVCliente] = useState("");
  const [vPagamento, setVPagamento] = useState("pix"); // pix | dinheiro | cartao
  const [vParcelas, setVParcelas] = useState(1);
  const [vStatus, setVStatus] = useState("pago"); // pago | parcial | pendente

  // formulário de despesa
  const [dDesc, setDDesc] = useState("");
  const [dCat, setDCat] = useState("filamento");
  const [dValor, setDValor] = useState("");
  const [dData, setDData] = useState(hoje());

  // carrega catálogo + lançamentos persistidos
  useEffect(() => {
    (async () => {
      try {
        const c = await window.storage.get("catalogo");
        if (c && c.value) setCatalogo(JSON.parse(c.value));
      } catch (e) {}
      try {
        const v = await window.storage.get("vendas");
        if (v && v.value) setVendas(JSON.parse(v.value));
      } catch (e) {}
      try {
        const d = await window.storage.get("despesas");
        if (d && d.value) setDespesas(JSON.parse(d.value));
      } catch (e) {}
    })();
  }, []);

  const persistVendas = async (lista) => {
    setVendas(lista);
    try { await window.storage.set("vendas", JSON.stringify(lista)); } catch (e) {}
  };
  const persistDespesas = async (lista) => {
    setDespesas(lista);
    try { await window.storage.set("despesas", JSON.stringify(lista)); } catch (e) {}
  };

  // ao escolher produto do catálogo, sugere o preço já precificado
  const escolherProduto = (nome) => {
    setVProduto(nome);
    const p = catalogo.find((x) => x.nome === nome);
    if (p) setVValor(String(p.preco.toFixed(2)));
  };

  const registrarVenda = () => {
    const valor = parseFloat(vValor) || 0;
    const qtd = parseInt(vQtd) || 1;
    if (!vProduto || valor <= 0) return;
    const prod = catalogo.find((x) => x.nome === vProduto);
    const custoUnit = prod ? prod.custo : 0;
    const v = {
      id: Date.now(),
      produto: vProduto,
      canal: prod ? prod.canal : "—",
      cliente: vCliente.trim(),
      qtd,
      valor: valor * qtd,
      custo: custoUnit * qtd,
      lucro: (valor - custoUnit) * qtd,
      data: vData,
      pagamento: vPagamento,
      parcelas: vPagamento === "cartao" ? (parseInt(vParcelas) || 1) : 1,
      status: vStatus,
    };
    persistVendas([v, ...vendas]);
    setVProduto(""); setVQtd(1); setVValor(""); setVData(hoje());
    setVCliente(""); setVPagamento("pix"); setVParcelas(1); setVStatus("pago");
  };

  const registrarDespesa = () => {
    const valor = parseFloat(dValor) || 0;
    if (!dDesc.trim() || valor <= 0) return;
    const d = {
      id: Date.now(),
      desc: dDesc.trim(),
      categoria: dCat,
      valor,
      data: dData,
    };
    persistDespesas([d, ...despesas]);
    setDDesc(""); setDValor(""); setDData(hoje());
  };

  const delVenda = (id) => persistVendas(vendas.filter((v) => v.id !== id));
  const delDespesa = (id) => persistDespesas(despesas.filter((d) => d.id !== id));

  // ── cálculos do período ───────────────────────────────────────
  const dados = useMemo(() => {
    const vMes = vendas.filter((v) => v.data.startsWith(mes));
    const dMes = despesas.filter((d) => d.data.startsWith(mes));
    const receita = vMes.reduce((s, v) => s + v.valor, 0);
    const custoVendas = vMes.reduce((s, v) => s + v.custo, 0);
    const despesaTotal = dMes.reduce((s, d) => s + d.valor, 0);
    const lucroBruto = receita - custoVendas;
    const resultado = receita - custoVendas - despesaTotal; // caixa do período
    const nVendas = vMes.reduce((s, v) => s + v.qtd, 0);
    const ticket = vMes.length ? receita / vMes.length : 0;

    // série diária entradas vs saídas
    const diasNoMes = new Date(
      parseInt(mes.slice(0, 4)),
      parseInt(mes.slice(5, 7)),
      0
    ).getDate();
    const entradas = Array(diasNoMes).fill(0);
    const saidas = Array(diasNoMes).fill(0);
    vMes.forEach((v) => {
      const d = parseInt(v.data.slice(8, 10)) - 1;
      if (d >= 0 && d < diasNoMes) entradas[d] += v.valor;
    });
    dMes.forEach((x) => {
      const d = parseInt(x.data.slice(8, 10)) - 1;
      if (d >= 0 && d < diasNoMes) saidas[d] += x.valor;
    });

    // despesas por categoria
    const porCat = CATEGORIAS.map((c) => ({
      ...c,
      total: dMes.filter((d) => d.categoria === c.id).reduce((s, d) => s + d.valor, 0),
    })).filter((c) => c.total > 0);

    return {
      vMes, dMes, receita, custoVendas, despesaTotal, lucroBruto, resultado,
      nVendas, ticket, entradas, saidas, diasNoMes, porCat,
    };
  }, [vendas, despesas, mes]);

  const maxBarra = Math.max(
    1,
    ...dados.entradas,
    ...dados.saidas
  );

  // ── histórico mensal para o dashboard ────────────────────────
  const historico = useMemo(() => {
    const meses = new Set([
      ...vendas.map((v) => v.data.slice(0, 7)),
      ...despesas.map((d) => d.data.slice(0, 7)),
    ]);
    return [...meses].sort().map((ym) => {
      const vMes = vendas.filter((v) => v.data.startsWith(ym));
      const dMes = despesas.filter((d) => d.data.startsWith(ym));
      const receita = vMes.reduce((s, v) => s + v.valor, 0);
      const custoVendas = vMes.reduce((s, v) => s + v.custo, 0);
      const despTotal = dMes.reduce((s, d) => s + d.valor, 0);
      const resultado = receita - custoVendas - despTotal;
      return { ym, receita, despesas: custoVendas + despTotal, resultado };
    });
  }, [vendas, despesas]);

  const panel = {
    background: C.panel,
    border: `1px solid ${C.line}`,
    borderRadius: 14,
    padding: 22,
  };
  const heading = {
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: C.heat,
    margin: "0 0 18px",
    fontWeight: 700,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.ink,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "32px 20px 60px",
      }}
    >
      {/* ── MODAL LANÇAMENTOS ──────────────────────────────────── */}
      {verLancamentos && (() => {
        const filtro = verLancamentos;
        const itens = [
          ...(filtro !== "despesas" ? dados.vMes.map((v) => ({ ...v, tipo: "venda" })) : []),
          ...(filtro !== "vendas"   ? dados.dMes.map((d) => ({ ...d, tipo: "despesa" })) : []),
        ].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
        const totalV = filtro !== "despesas" ? dados.vMes.reduce((s,v)=>s+v.valor,0) : 0;
        const totalD = filtro !== "vendas"   ? dados.dMes.reduce((s,d)=>s+d.valor,0) : 0;
        const titulo = filtro === "vendas" ? "Vendas" : filtro === "despesas" ? "Despesas" : "Lançamentos";
        return (
          <div onClick={() => setVerLancamentos(null)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
            display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto",
          }}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16,
              width: "100%", maxWidth: 680, padding: 28,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.ink }}>{titulo} detalhados</div>
                  <div style={{ fontSize: 13, color: C.mute, marginTop: 2 }}>{mesLabel(mes)} · {itens.length} lançamento{itens.length !== 1 ? "s" : ""}</div>
                </div>
                <button onClick={() => setVerLancamentos(null)} style={{ background: "none", border: "none", color: C.mute, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
              </div>

              {/* totalizadores */}
              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                {filtro !== "despesas" && <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: C.mute, marginBottom: 3 }}>Total receita</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.green, fontVariantNumeric: "tabular-nums" }}>{brl(totalV)}</div>
                </div>}
                {filtro !== "vendas" && <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: C.mute, marginBottom: 3 }}>Total despesas</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.red, fontVariantNumeric: "tabular-nums" }}>{brl(totalD)}</div>
                </div>}
                {filtro === "todos" && <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: C.mute, marginBottom: 3 }}>Resultado</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: totalV - totalD >= 0 ? C.cyan : C.red, fontVariantNumeric: "tabular-nums" }}>{brl(totalV - totalD)}</div>
                </div>}
              </div>

              {/* lista */}
              {itens.length === 0 ? (
                <p style={{ color: C.mute, fontSize: 13.5, textAlign: "center", padding: "24px 0" }}>Nenhum lançamento neste mês.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 440, overflowY: "auto" }}>
                  {itens.map((x) => (
                    <div key={x.tipo + x.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 14px" }}>
                      <div style={{ width: 6, height: 32, borderRadius: 3, background: x.tipo === "venda" ? C.green : C.red, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {x.tipo === "venda" ? `${x.produto}${x.qtd > 1 ? ` ×${x.qtd}` : ""}` : x.desc}
                        </div>
                        <div style={{ fontSize: 11.5, color: C.mute, marginTop: 2, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <span>{x.data.split("-").reverse().join("/")}</span>
                          <span>·</span>
                          <span>{x.tipo === "venda" ? x.canal : (CATEGORIAS.find((c) => c.id === x.categoria)?.nome || "—")}</span>
                          {x.tipo === "venda" && x.cliente && <><span>·</span><span>{x.cliente}</span></>}
                          {x.tipo === "venda" && x.pagamento && <><span>·</span><span style={{ color: x.pagamento === "pix" ? C.cyan : x.pagamento === "dinheiro" ? C.green : C.amber }}>{x.pagamento === "cartao" ? `Cartão${x.parcelas > 1 ? ` ${x.parcelas}x` : ""}` : x.pagamento === "pix" ? "PIX" : "Dinheiro"}</span></>}
                          {x.tipo === "venda" && x.status && x.status !== "pago" && <><span>·</span><span style={{ color: x.status === "parcial" ? C.amber : C.red, fontWeight: 700 }}>{x.status === "parcial" ? "Parcialmente pago" : "Pendente"}</span></>}
                          {x.tipo === "venda" && x.custo > 0 && <><span>·</span><span>Custo {brl(x.custo)} · Lucro {brl(x.lucro)}</span></>}
                        </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: x.tipo === "venda" ? C.green : C.red, flexShrink: 0 }}>
                        {x.tipo === "venda" ? "+" : "−"}{brl(x.valor)}
                      </span>
                      <button onClick={() => { x.tipo === "venda" ? delVenda(x.id) : delDespesa(x.id); }}
                        style={{ background: "transparent", border: "none", color: C.mute, cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }} title="Remover">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, letterSpacing: -0.3 }}>
              Financeiro
            </h1>
            <p style={{ margin: "4px 0 0", color: C.mute, fontSize: 14 }}>
              Vendas, despesas e fluxo de caixa.
            </p>
          </div>
          {aba !== "dashboard" && (
            <label>
              <span style={{ ...label, marginBottom: 4 }}>Mês de referência</span>
              <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...field, width: "auto" }} />
            </label>
          )}
        </div>

        {/* abas principais */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["dashboard","📊 Dashboard geral"], ["mes","📅 Mês atual"]].map(([id, txt]) => {
            const on = (id === "dashboard") === (aba === "dashboard");
            const active = id === "dashboard" ? aba === "dashboard" : aba !== "dashboard";
            return (
              <button key={id}
                onClick={() => { if (id === "dashboard") setAba("dashboard"); else if (aba === "dashboard") setAba("venda"); }}
                style={{
                  padding: "9px 18px", borderRadius: 9, cursor: "pointer", fontSize: 13.5, fontWeight: active ? 700 : 500,
                  color: active ? C.heat : C.mute,
                  background: active ? C.heatDim : "transparent",
                  border: `1px solid ${active ? C.heat : C.line}`,
                }}>
                {txt}
              </button>
            );
          })}
        </div>

        {/* ── DASHBOARD GERAL ─────────────────────────────────────── */}
        {aba === "dashboard" && (
          <div>
            {historico.length === 0 ? (
              <div style={{ ...panel, textAlign: "center", padding: 48 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                <p style={{ color: C.mute, fontSize: 14 }}>Nenhum lançamento ainda. Registre vendas e despesas para ver o histórico.</p>
              </div>
            ) : (() => {
              const maxVal = Math.max(1, ...historico.map((h) => Math.max(h.receita, h.despesas)));
              const totalReceita = historico.reduce((s, h) => s + h.receita, 0);
              const totalDesp = historico.reduce((s, h) => s + h.despesas, 0);
              const totalResult = historico.reduce((s, h) => s + h.resultado, 0);
              const melhor = historico.reduce((a, b) => b.resultado > a.resultado ? b : a, historico[0]);
              return (
                <>
                  {/* KPIs totais */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                    <KPI titulo="Receita total" valor={brl(totalReceita)} cor={C.green} sub={`${historico.length} mes${historico.length > 1 ? "es" : ""}`} />
                    <KPI titulo="Despesas totais" valor={brl(totalDesp)} cor={C.red} sub="custo + gastos" />
                    <KPI titulo="Resultado acumulado" valor={brl(totalResult)} cor={totalResult >= 0 ? C.cyan : C.red} sub="todos os meses" />
                    <KPI titulo="Melhor mês" valor={mesLabel(melhor.ym)} cor={C.heat} sub={brl(melhor.resultado)} />
                  </div>

                  {/* Gráfico mês a mês */}
                  <div style={{ ...panel, marginBottom: 16 }}>
                    <h2 style={heading}>Vendas × Despesas por mês</h2>
                    <div style={{ overflowX: "auto" }}>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, minWidth: historico.length * 72, height: 180, paddingBottom: 0 }}>
                        {historico.map((h) => (
                          <div key={h.ym} style={{ flex: 1, minWidth: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
                            <div style={{ width: "100%", display: "flex", gap: 3, alignItems: "flex-end", height: 150 }}>
                              {/* barra receita */}
                              <div title={`Receita: ${brl(h.receita)}`} style={{
                                flex: 1, background: C.green, borderRadius: "4px 4px 0 0",
                                height: `${(h.receita / maxVal) * 100}%`, minHeight: h.receita > 0 ? 4 : 0,
                              }} />
                              {/* barra despesas */}
                              <div title={`Despesas: ${brl(h.despesas)}`} style={{
                                flex: 1, background: C.red, borderRadius: "4px 4px 0 0",
                                height: `${(h.despesas / maxVal) * 100}%`, minHeight: h.despesas > 0 ? 4 : 0,
                              }} />
                            </div>
                            {/* resultado abaixo */}
                            <div style={{ fontSize: 10.5, color: h.resultado >= 0 ? C.cyan : C.red, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              {h.resultado >= 0 ? "+" : ""}{brl(h.resultado).replace("R$ ","R$")}
                            </div>
                            <div style={{ fontSize: 11, color: C.mute, whiteSpace: "nowrap" }}>{mesLabel(h.ym)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
                      <span style={{ fontSize: 12, color: C.mute, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: C.green, borderRadius: 2 }} /> Receita
                      </span>
                      <span style={{ fontSize: 12, color: C.mute, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: C.red, borderRadius: 2 }} /> Despesas
                      </span>
                      <span style={{ fontSize: 12, color: C.mute, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: C.cyan, borderRadius: 2 }} /> Resultado
                      </span>
                    </div>
                  </div>

                  {/* Tabela resumo */}
                  <div style={panel}>
                    <h2 style={heading}>Resumo mensal</h2>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                        <thead>
                          <tr style={{ textAlign: "left", color: C.mute, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            <th style={{ padding: "0 12px 10px 0" }}>Mês</th>
                            <th style={{ padding: "0 12px 10px", textAlign: "right" }}>Receita</th>
                            <th style={{ padding: "0 12px 10px", textAlign: "right" }}>Despesas</th>
                            <th style={{ padding: "0 0 10px", textAlign: "right" }}>Resultado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...historico].reverse().map((h) => (
                            <tr key={h.ym} style={{ borderTop: `1px solid ${C.line}` }}>
                              <td style={{ padding: "10px 12px 10px 0", color: C.ink, fontWeight: 600 }}>
                                <button onClick={() => { setMes(h.ym); setAba("venda"); }}
                                  style={{ background: "none", border: "none", color: C.heat, cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }}>
                                  {mesLabel(h.ym)}
                                </button>
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: C.green, fontVariantNumeric: "tabular-nums" }}>{brl(h.receita)}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: C.red, fontVariantNumeric: "tabular-nums" }}>{brl(h.despesas)}</td>
                              <td style={{ padding: "10px 0", textAlign: "right", color: h.resultado >= 0 ? C.cyan : C.red, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                {h.resultado >= 0 ? "+" : ""}{brl(h.resultado)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: `2px solid ${C.line}` }}>
                            <td style={{ padding: "10px 12px 0 0", color: C.mute, fontSize: 12 }}>TOTAL</td>
                            <td style={{ padding: "10px 12px 0", textAlign: "right", color: C.green, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{brl(totalReceita)}</td>
                            <td style={{ padding: "10px 12px 0", textAlign: "right", color: C.red, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{brl(totalDesp)}</td>
                            <td style={{ padding: "10px 0 0", textAlign: "right", color: totalResult >= 0 ? C.cyan : C.red, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                              {totalResult >= 0 ? "+" : ""}{brl(totalResult)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ── VISÃO MENSAL ─────────────────────────────────────────── */}
        {aba !== "dashboard" && (
          <>
        {/* KPIs */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <KPI titulo="Receita" valor={brl(dados.receita)} cor={C.green} sub={`${dados.nVendas} itens vendidos`} />
          <KPI titulo="Despesas" valor={brl(dados.despesaTotal + dados.custoVendas)} cor={C.red} sub="custo + gastos" />
          <KPI titulo="Resultado do mês" valor={brl(dados.resultado)} cor={dados.resultado >= 0 ? C.cyan : C.red} sub="entradas − saídas" />
          <KPI titulo="Ticket médio" valor={brl(dados.ticket)} sub="por venda" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>
          {/* coluna esquerda: lançar */}
          <div style={panel}>
            {/* botões de lançamentos detalhados */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setVerLancamentos("vendas")}
                style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.green, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <span>↗</span> {dados.vMes.length} venda{dados.vMes.length !== 1 ? "s" : ""}
              </button>
              <button onClick={() => setVerLancamentos("despesas")}
                style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.red, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <span>↙</span> {dados.dMes.length} despesa{dados.dMes.length !== 1 ? "s" : ""}
              </button>
              <button onClick={() => setVerLancamentos("todos")}
                style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.mute, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                todos
              </button>
            </div>

            {/* abas */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {[["venda", "Nova venda"], ["despesa", "Nova despesa"]].map(([id, txt]) => {
                const on = aba === id;
                return (
                  <button
                    key={id}
                    onClick={() => setAba(id)}
                    style={{
                      flex: 1,
                      padding: "9px",
                      borderRadius: 9,
                      cursor: "pointer",
                      fontSize: 13.5,
                      fontWeight: on ? 700 : 500,
                      color: on ? (id === "venda" ? "#0c1410" : "#1a0d05") : C.mute,
                      background: on ? (id === "venda" ? C.green : C.heat) : "transparent",
                      border: `1px solid ${on ? "transparent" : C.line}`,
                    }}
                  >
                    {txt}
                  </button>
                );
              })}
            </div>

            {aba === "venda" ? (
              <div>
                <label style={{ display: "block", marginBottom: 14 }}>
                  <span style={label}>Produto</span>
                  {catalogo.length > 0 ? (
                    <select value={vProduto} onChange={(e) => escolherProduto(e.target.value)} style={field}>
                      <option value="">Selecione do catálogo…</option>
                      {catalogo.map((p) => (
                        <option key={p.id} value={p.nome}>{p.nome} · {p.canal}</option>
                      ))}
                    </select>
                  ) : (
                    <input placeholder="Nome do produto" value={vProduto} onChange={(e) => setVProduto(e.target.value)} style={field} />
                  )}
                </label>
                {catalogo.length === 0 && (
                  <p style={{ fontSize: 12.5, color: C.mute, margin: "-6px 0 14px", lineHeight: 1.5 }}>
                    Precifique produtos na calculadora para selecioná-los aqui com preço e custo já preenchidos.
                  </p>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <label style={{ display: "block", marginBottom: 14, flex: 1 }}>
                    <span style={label}>Quantidade</span>
                    <input type="number" value={vQtd} onChange={(e) => setVQtd(e.target.value)} style={field} />
                  </label>
                  <label style={{ display: "block", marginBottom: 14, flex: 1 }}>
                    <span style={label}>Valor unitário</span>
                    <input type="number" step="0.01" placeholder="R$" value={vValor} onChange={(e) => setVValor(e.target.value)} style={field} />
                  </label>
                </div>
                <label style={{ display: "block", marginBottom: 14 }}>
                  <span style={label}>Cliente (opcional)</span>
                  <input placeholder="Nome do cliente" value={vCliente} onChange={(e) => setVCliente(e.target.value)} style={field} />
                </label>

                {/* forma de pagamento */}
                <div style={{ marginBottom: 14 }}>
                  <span style={label}>Forma de pagamento</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[["pix","PIX"],["dinheiro","Dinheiro"],["cartao","Cartão"]].map(([id, txt]) => {
                      const on = vPagamento === id;
                      return (
                        <button key={id} onClick={() => { setVPagamento(id); if (id !== "cartao") setVParcelas(1); }}
                          style={{ flex: 1, padding: "9px 6px", borderRadius: 9, border: `1px solid ${on ? C.cyan : C.line}`,
                            background: on ? "#37d6c522" : "transparent", color: on ? C.cyan : C.mute,
                            fontWeight: on ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
                          {txt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* parcelas — só para cartão */}
                {vPagamento === "cartao" && (
                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={label}>Parcelas</span>
                    <select value={vParcelas} onChange={(e) => setVParcelas(e.target.value)} style={field}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                        <option key={n} value={n}>{n}x {n > 1 ? `de ${brl((parseFloat(vValor) * (parseInt(vQtd)||1)) / n)}` : "(à vista)"}</option>
                      ))}
                    </select>
                  </label>
                )}

                {/* status de pagamento */}
                <div style={{ marginBottom: 16 }}>
                  <span style={label}>Status</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[["pago", C.green, "Pago"],["parcial", C.amber, "Parcialmente pago"],["pendente", C.red, "Pendente"]].map(([id, cor, txt]) => {
                      const on = vStatus === id;
                      return (
                        <button key={id} onClick={() => setVStatus(id)}
                          style={{ flex: 1, padding: "9px 4px", borderRadius: 9, border: `1px solid ${on ? cor : C.line}`,
                            background: on ? `${cor}22` : "transparent", color: on ? cor : C.mute,
                            fontWeight: on ? 700 : 500, fontSize: 12, cursor: "pointer" }}>
                          {txt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label style={{ display: "block", marginBottom: 16 }}>
                  <span style={label}>Data</span>
                  <input type="date" value={vData} onChange={(e) => setVData(e.target.value)} style={field} />
                </label>
                <button onClick={registrarVenda} disabled={!vProduto || !(parseFloat(vValor) > 0)}
                  style={{ width: "100%", padding: 13, borderRadius: 11, border: "none", fontSize: 14.5, fontWeight: 700,
                    cursor: vProduto && parseFloat(vValor) > 0 ? "pointer" : "not-allowed",
                    background: vProduto && parseFloat(vValor) > 0 ? C.green : C.line,
                    color: vProduto && parseFloat(vValor) > 0 ? "#0c1410" : C.mute }}>
                  Registrar venda
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: "block", marginBottom: 14 }}>
                  <span style={label}>Descrição</span>
                  <input placeholder="Ex.: Bobina PLA preto 1kg" value={dDesc} onChange={(e) => setDDesc(e.target.value)} style={field} />
                </label>
                <label style={{ display: "block", marginBottom: 14 }}>
                  <span style={label}>Categoria</span>
                  <select value={dCat} onChange={(e) => setDCat(e.target.value)} style={field}>
                    {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <label style={{ display: "block", marginBottom: 16, flex: 1 }}>
                    <span style={label}>Valor</span>
                    <input type="number" step="0.01" placeholder="R$" value={dValor} onChange={(e) => setDValor(e.target.value)} style={field} />
                  </label>
                  <label style={{ display: "block", marginBottom: 16, flex: 1 }}>
                    <span style={label}>Data</span>
                    <input type="date" value={dData} onChange={(e) => setDData(e.target.value)} style={field} />
                  </label>
                </div>
                <button onClick={registrarDespesa} disabled={!dDesc.trim() || !(parseFloat(dValor) > 0)}
                  style={{ width: "100%", padding: 13, borderRadius: 11, border: "none", fontSize: 14.5, fontWeight: 700,
                    cursor: dDesc.trim() && parseFloat(dValor) > 0 ? "pointer" : "not-allowed",
                    background: dDesc.trim() && parseFloat(dValor) > 0 ? C.heat : C.line,
                    color: dDesc.trim() && parseFloat(dValor) > 0 ? "#1a0d05" : C.mute }}>
                  Registrar despesa
                </button>
              </div>
            )}

            {/* despesas por categoria */}
            {dados.porCat.length > 0 && (
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.line}` }}>
                <span style={{ ...label, marginBottom: 12 }}>Despesas por categoria</span>
                {dados.porCat.map((c) => {
                  const pct = (c.total / (dados.despesaTotal || 1)) * 100;
                  return (
                    <div key={c.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                        <span style={{ color: C.ink }}>{c.nome}</span>
                        <span style={{ color: C.mute, fontVariantNumeric: "tabular-nums" }}>{brl(c.total)}</span>
                      </div>
                      <div style={{ height: 6, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: c.cor, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* coluna direita: fluxo + lançamentos */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* gráfico entradas x saídas */}
            <div style={panel}>
              <h2 style={heading}>Fluxo de caixa diário</h2>
              {dados.receita === 0 && dados.despesaTotal === 0 ? (
                <p style={{ fontSize: 13.5, color: C.mute, margin: 0, lineHeight: 1.6 }}>
                  Sem lançamentos neste mês. Registre uma venda ou despesa para ver o fluxo.
                </p>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 130 }}>
                    {dados.entradas.map((e, i) => {
                      const s = dados.saidas[i];
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 1, height: "100%" }} title={`Dia ${i + 1}\nEntrada ${brl(e)}\nSaída ${brl(s)}`}>
                          <div style={{ height: `${(e / maxBarra) * 100}%`, background: C.green, borderRadius: "2px 2px 0 0", minHeight: e > 0 ? 2 : 0 }} />
                          <div style={{ height: `${(s / maxBarra) * 100}%`, background: C.red, borderRadius: "0 0 2px 2px", minHeight: s > 0 ? 2 : 0 }} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.mute, marginTop: 6 }}>
                    <span>dia 1</span><span>dia {dados.diasNoMes}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                    <span style={{ fontSize: 12, color: C.mute, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, background: C.green, borderRadius: 2 }} /> Entradas {brl(dados.receita)}
                    </span>
                    <span style={{ fontSize: 12, color: C.mute, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, background: C.red, borderRadius: 2 }} /> Saídas {brl(dados.despesaTotal)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* lançamentos recentes */}
            <div style={panel}>
              <h2 style={heading}>Lançamentos do mês</h2>
              {dados.vMes.length === 0 && dados.dMes.length === 0 ? (
                <p style={{ fontSize: 13.5, color: C.mute, margin: 0 }}>Nada lançado ainda neste mês.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 360, overflowY: "auto" }}>
                  {[...dados.vMes.map((v) => ({ ...v, tipo: "venda" })),
                    ...dados.dMes.map((d) => ({ ...d, tipo: "despesa" }))]
                    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
                    .map((x) => (
                      <div key={x.tipo + x.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 12px" }}>
                        <div style={{ width: 6, height: 28, borderRadius: 3, background: x.tipo === "venda" ? C.green : C.red, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {x.tipo === "venda" ? `${x.produto}${x.qtd > 1 ? ` ×${x.qtd}` : ""}` : x.desc}
                            {x.tipo === "venda" && x.status && x.status !== "pago" && (
                              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: x.status === "parcial" ? C.amber : C.red, border: `1px solid`, borderRadius: 5, padding: "1px 6px" }}>
                                {x.status === "parcial" ? "Parcial" : "Pendente"}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 11.5, color: C.mute }}>
                            {x.data.split("-").reverse().join("/")} · {x.tipo === "venda" ? x.canal : (CATEGORIAS.find((c) => c.id === x.categoria)?.nome || "—")}
                            {x.tipo === "venda" && x.pagamento && ` · ${x.pagamento === "cartao" ? `Cartão${x.parcelas > 1 ? ` ${x.parcelas}x` : ""}` : x.pagamento === "pix" ? "PIX" : "Dinheiro"}`}
                            {x.tipo === "venda" && x.cliente && ` · ${x.cliente}`}
                          </span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: x.tipo === "venda" ? C.green : C.red }}>
                          {x.tipo === "venda" ? "+" : "−"}{brl(x.valor)}
                        </span>
                        <button onClick={() => x.tipo === "venda" ? delVenda(x.id) : delDespesa(x.id)}
                          style={{ background: "transparent", border: "none", color: C.mute, cursor: "pointer", fontSize: 16, lineHeight: 1 }} title="Remover">
                          ×
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
