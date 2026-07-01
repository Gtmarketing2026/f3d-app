import React, { useState, useMemo, useEffect } from "react";

// v2
// ── Design tokens ──────────────────────────────────────────────
// Subject: 3D printing pricing. Visual language pulls from the extrusion
// process itself — layer lines, molten filament heat, machine precision.
// Palette: graphite machine body, heat-orange filament, cool readout cyan.
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
};

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
};

const brl = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Presets de marketplace — no SaaS, cada cliente edita/cria os seus.
// Valores médios de referência (comissões variam por categoria/plano).
const PRESETS = [
  { id: "custom", nome: "Personalizado", comissao: null, taxaFixa: null },
  { id: "ml", nome: "Mercado Livre", comissao: 16, taxaFixa: 6 },
  { id: "shopee", nome: "Shopee", comissao: 20, taxaFixa: 4 },
  { id: "tiktok", nome: "TikTok Shop", comissao: 6, taxaFixa: 4 },
  { id: "elo7", nome: "Elo7", comissao: 14, taxaFixa: 0 },
  { id: "amazon", nome: "Amazon", comissao: 15, taxaFixa: 0 },
  { id: "etsy", nome: "Etsy", comissao: 6.5, taxaFixa: 1.5 },
];

function NumInput({ label, suffix, value, onChange, step = "1", tooltip }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, letterSpacing: 0.3, color: C.mute, marginBottom: 6 }}>
        {label}
        {tooltip && (
          <span title={tooltip} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: "50%", border: `1px solid ${C.mute}`, fontSize: 10, cursor: "help", flexShrink: 0, userSelect: "none" }}>?</span>
        )}
      </span>
      <div style={{ position: "relative" }}>
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            onChange(isNaN(v) ? "" : v);
          }}
          style={field}
        />
        {suffix && (
          <span
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              color: C.mute,
              pointerEvents: "none",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function Row({ label, value, accent }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "9px 0",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <span style={{ fontSize: 13.5, color: C.mute }}>{label}</span>
      <span
        style={{
          fontSize: 15,
          fontVariantNumeric: "tabular-nums",
          color: accent ? C.cyan : C.ink,
          fontWeight: accent ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function Calculadora() {
  // entradas da impressão
  const [pesoG, setPesoG] = useState(45);
  const [tempoHoras, setTempoHoras] = useState(4);
  const [tempoMinutos, setTempoMinutos] = useState(30);
  const tempoH = tempoHoras + tempoMinutos / 60;
  const [precoKg, setPrecoKg] = useState(120);
  const [posProcHoras, setPosProcHoras] = useState(0);
  const [posProcMinutos, setPosProcMinutos] = useState(30);
  const posProcH = posProcHoras + posProcMinutos / 60;
  const [qtd, setQtd] = useState(1);
  const [nomeProduto, setNomeProduto] = useState("");

  // catálogo (persiste entre sessões)
  const [catalogo, setCatalogo] = useState([]);
  const [salvo, setSalvo] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("catalogo");
        if (r && r.value) setCatalogo(JSON.parse(r.value));
      } catch (e) {
        /* catálogo vazio na primeira vez */
      }
    })();
  }, []);

  // custos extras opcionais (por peça)
  const [extras, setExtras] = useState([]);

  // referência de mercado (informada pelo usuário)
  const [mktMin, setMktMin] = useState("");
  const [mktMax, setMktMax] = useState("");

  // marketplace
  const [modoMkt, setModoMkt] = useState(false);
  const [presetId, setPresetId] = useState("custom");
  const [comissao, setComissao] = useState(20);
  const [taxaFixa, setTaxaFixa] = useState(0);
  const [imposto, setImposto] = useState(0);

  // imposto opcional de nota (venda direta, fora do marketplace)
  const [usarImposto, setUsarImposto] = useState(false);
  const [impostoNF, setImpostoNF] = useState(0);
  const [freteEmbutido, setFreteEmbutido] = useState(0);

  const selectPreset = (id) => {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p && p.comissao !== null) {
      setComissao(p.comissao);
      setTaxaFixa(p.taxaFixa);
    }
  };

  // configurações de custo — carrega padrão salvo pelo usuário
  const padrao = (() => { try { return JSON.parse(localStorage.getItem("app3d:padrao_custos") || "{}"); } catch { return {}; } })();
  const [potenciaW, setPotenciaW] = useState(padrao.potenciaW ?? 250);
  const [tarifaKwh, setTarifaKwh] = useState(padrao.tarifaKwh ?? 0.95);
  const [custoMaquina, setCustoMaquina] = useState(padrao.custoMaquina ?? 2500);
  const [vidaUtilH, setVidaUtilH] = useState(padrao.vidaUtilH ?? 5000);
  const [manutHora, setManutHora] = useState(padrao.manutHora ?? 1.5);
  const [maoObraHora, setMaoObraHora] = useState(padrao.maoObraHora ?? 25);
  const [taxaFalha, setTaxaFalha] = useState(padrao.taxaFalha ?? 8);
  const [margem, setMargem] = useState(padrao.margem ?? 60);
  const [padraoCustosSalvo, setPadraoCustosSalvo] = useState(false);

  const salvarPadraoCustos = () => {
    const dados = { potenciaW, tarifaKwh, custoMaquina, vidaUtilH, manutHora, maoObraHora, taxaFalha, margem };
    localStorage.setItem("app3d:padrao_custos", JSON.stringify(dados));
    setPadraoCustosSalvo(true);
    setTimeout(() => setPadraoCustosSalvo(false), 2000);
  };

  const calc = useMemo(() => {
    const f = (x) => (x === "" || x === null || x === undefined) ? 0 : Number(x);
    const n = Math.max(1, parseInt(qtd) || 1);

    // custos por peça
    const material = (f(pesoG) / 1000) * f(precoKg);
    const energia = (f(potenciaW) / 1000) * f(tempoH) * f(tarifaKwh);
    const deprec = (f(custoMaquina) / f(vidaUtilH || 1)) * f(tempoH);
    const manut = f(manutHora) * f(tempoH);
    const maoObra = f(maoObraHora) * f(posProcH);
    const extrasTotal = extras.reduce((s, e) => s + f(e.valor), 0);

    const custoBasePeca =
      material + energia + deprec + manut + maoObra + extrasTotal;
    const comFalhaPeca = custoBasePeca * (1 + f(taxaFalha) / 100);
    const precoComMargem = comFalhaPeca * (1 + f(margem) / 100);

    // Imposto de nota (venda direta): incide sobre o preço de venda,
    // então sobe o preço pra preservar o lucro depois do imposto.
    const pctNF = usarImposto ? f(impostoNF) / 100 : 0;
    const finalPeca =
      pctNF > 0 && pctNF < 0.99 ? precoComMargem / (1 - pctNF) : precoComMargem;
    const impostoNFValor = finalPeca - precoComMargem;
    const lucroPeca = precoComMargem - comFalhaPeca;

    // ── modo marketplace ──────────────────────────────────────
    // Comissão e imposto incidem sobre o PREÇO DE VENDA, então
    // calculamos de trás pra frente: o preço precisa cobrir
    // (custo + lucro desejado + frete + taxa fixa) e ainda sobrar
    // depois que o marketplace tira a sua fatia percentual.
    const pctVar = (f(comissao) + f(imposto)) / 100; // % sobre venda
    const alvoLiquido = finalPeca + f(freteEmbutido); // o que quero embolsar
    let precoMkt = 0;
    if (pctVar < 0.99) {
      precoMkt = (alvoLiquido + f(taxaFixa)) / (1 - pctVar);
    }
    const taxaMktTotal = precoMkt - alvoLiquido; // tudo que o mkt+imposto levam
    const margemMktReal =
      comFalhaPeca > 0 ? (lucroPeca / precoMkt) * 100 : 0;

    // ── referência de mercado ─────────────────────────────────
    const precoEfetivo = modoMkt ? precoMkt : finalPeca;
    const min = f(mktMin);
    const max = f(mktMax);
    const temRef = min > 0 && max > 0 && max >= min;
    let posicao = null; // 0..1 dentro da faixa
    let veredito = null; // "baixo" | "competitivo" | "alto"
    let sugeridoMercado = null;
    if (temRef) {
      const meio = (min + max) / 2;
      sugeridoMercado = meio;
      posicao = Math.max(0, Math.min(1, (precoEfetivo - min) / (max - min)));
      if (precoEfetivo < min) veredito = "baixo";
      else if (precoEfetivo > max) veredito = "alto";
      else veredito = "competitivo";
    }

    return {
      n,
      material, energia, deprec, manut, maoObra, extrasTotal,
      custoBasePeca, comFalhaPeca, finalPeca, lucroPeca,
      custoBaseTotal: custoBasePeca * n,
      comFalhaTotal: comFalhaPeca * n,
      finalTotal: finalPeca * n,
      lucroTotal: lucroPeca * n,
      precoMkt, taxaMktTotal, margemMktReal,
      precoMktTotal: precoMkt * n,
      taxaMktTotalLote: taxaMktTotal * n,
      // mercado
      precoEfetivo, temRef, posicao, veredito, sugeridoMercado, min, max,
      // imposto de nota (venda direta)
      impostoNFValor, precoComMargem,
    };
  }, [pesoG, tempoHoras, tempoMinutos, precoKg, posProcHoras, posProcMinutos, qtd, extras, mktMin, mktMax, potenciaW, tarifaKwh, custoMaquina, vidaUtilH, manutHora, maoObraHora, taxaFalha, margem, modoMkt, comissao, taxaFixa, imposto, freteEmbutido, usarImposto, impostoNF]);

  const addExtra = () =>
    setExtras((p) => [...p, { id: Date.now(), nome: "", valor: "" }]);
  const updExtra = (id, k, v) =>
    setExtras((p) => p.map((e) => (e.id === id ? { ...e, [k]: v } : e)));
  const delExtra = (id) => setExtras((p) => p.filter((e) => e.id !== id));

  const persistir = async (lista) => {
    setCatalogo(lista);
    try {
      await window.storage.set("catalogo", JSON.stringify(lista));
    } catch (e) {
      /* falha ao salvar — mantém em memória */
    }
  };

  const salvarNoCatalogo = () => {
    const nome = nomeProduto.trim();
    if (!nome) return;
    const precoFinal = modoMkt ? calc.precoMkt : calc.finalPeca;
    // receita = todos os parâmetros de entrada, pra reabrir e recalcular
    const receita = {
      pesoG, tempoHoras, tempoMinutos, precoKg, posProcHoras, posProcMinutos, qtd,
      extras, mktMin, mktMax,
      potenciaW, tarifaKwh, custoMaquina, vidaUtilH, manutHora, maoObraHora,
      taxaFalha, margem,
      modoMkt, presetId, comissao, taxaFixa, imposto, freteEmbutido,
      usarImposto, impostoNF,
    };
    const item = {
      id: editandoId || Date.now(),
      nome,
      canal: modoMkt
        ? PRESETS.find((p) => p.id === presetId)?.nome || "Marketplace"
        : "Venda direta",
      pesoG: parseFloat(pesoG) || 0,
      tempoH: parseFloat(tempoH) || 0,
      custo: calc.comFalhaPeca,
      preco: precoFinal,
      lucro: calc.lucroPeca,
      receita,
    };
    const lista = editandoId
      ? catalogo.map((p) => (p.id === editandoId ? item : p))
      : [item, ...catalogo];
    persistir(lista);
    setEditandoId(null);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1800);
  };

  const carregarProduto = (p) => {
    const r = p.receita;
    if (!r) return; // produtos antigos sem receita salva
    setNomeProduto(p.nome);
    setPesoG(r.pesoG);
    setTempoHoras(r.tempoHoras ?? Math.floor(r.tempoH ?? 0));
    setTempoMinutos(r.tempoMinutos ?? Math.round(((r.tempoH ?? 0) % 1) * 60));
    setPrecoKg(r.precoKg);
    setPosProcHoras(r.posProcHoras ?? Math.floor(r.posProcH ?? 0));
    setPosProcMinutos(r.posProcMinutos ?? Math.round(((r.posProcH ?? 0) % 1) * 60));
    setQtd(r.qtd);
    setExtras(r.extras || []); setMktMin(r.mktMin); setMktMax(r.mktMax);
    setPotenciaW(r.potenciaW); setTarifaKwh(r.tarifaKwh);
    setCustoMaquina(r.custoMaquina); setVidaUtilH(r.vidaUtilH);
    setManutHora(r.manutHora); setMaoObraHora(r.maoObraHora);
    setTaxaFalha(r.taxaFalha); setMargem(r.margem);
    setModoMkt(r.modoMkt); setPresetId(r.presetId); setComissao(r.comissao);
    setTaxaFixa(r.taxaFixa); setImposto(r.imposto); setFreteEmbutido(r.freteEmbutido);
    setUsarImposto(r.usarImposto); setImpostoNF(r.impostoNF);
    setEditandoId(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setNomeProduto("");
  };

  const removerDoCatalogo = (id) => {
    if (id === editandoId) setEditandoId(null);
    persistir(catalogo.filter((p) => p.id !== id));
  };

  const panelStyle = {
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
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "32px 20px 60px",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* header */}
        <div style={{ marginBottom: 26 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: `linear-gradient(135deg, ${C.heat}, #ff9b5e)`,
                position: "relative",
              }}
            >
              {/* layer-line motif */}
              <div style={{ position: "absolute", inset: 6, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ height: 1.5, background: "#ffffffaa", borderRadius: 2 }} />
                ))}
              </div>
            </div>
            <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, letterSpacing: -0.3 }}>
              Calculadora de Precificação
            </h1>
          </div>
          <p style={{ margin: 0, color: C.mute, fontSize: 14 }}>
            Informe os dados da peça e veja o preço de venda na hora.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 0.9fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* impressão */}
          <div style={panelStyle}>
            <h2 style={heading}>Dados da peça</h2>
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ display: "block", fontSize: 12, letterSpacing: 0.3, color: C.mute, marginBottom: 6 }}>
                Nome do produto
              </span>
              <input
                placeholder="Ex.: Vaso geométrico médio"
                value={nomeProduto}
                onChange={(e) => setNomeProduto(e.target.value)}
                style={field}
              />
            </label>
            <NumInput label="Peso do filamento" suffix="g" value={pesoG} onChange={setPesoG} />
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ display: "block", fontSize: 12, letterSpacing: 0.3, color: C.mute, marginBottom: 6 }}>
                Tempo de impressão
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input type="number" min="0" step="1" value={tempoHoras} onChange={e => setTempoHoras(Math.max(0, parseInt(e.target.value) || 0))} style={field} />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.mute, pointerEvents: "none" }}>h</span>
                </div>
                <div style={{ position: "relative", flex: 1 }}>
                  <input type="number" min="0" max="59" step="1" value={tempoMinutos} onChange={e => setTempoMinutos(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))} style={field} />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.mute, pointerEvents: "none" }}>min</span>
                </div>
              </div>
            </label>
            <NumInput label="Preço do filamento" suffix="R$/kg" value={precoKg} onChange={setPrecoKg} />
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, letterSpacing: 0.3, color: C.mute, marginBottom: 6 }}>
                Mão de obra pós impressão
                <span title="Tempo gasto após a impressão: retirar suportes, lixar, pintar, montar. Esse tempo é multiplicado pelo valor da mão de obra/h." style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: "50%", border: `1px solid ${C.mute}`, fontSize: 10, cursor: "help", flexShrink: 0, userSelect: "none" }}>?</span>
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input type="number" min="0" step="1" value={posProcHoras} onChange={e => setPosProcHoras(Math.max(0, parseInt(e.target.value) || 0))} style={field} />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.mute, pointerEvents: "none" }}>h</span>
                </div>
                <div style={{ position: "relative", flex: 1 }}>
                  <input type="number" min="0" max="59" step="1" value={posProcMinutos} onChange={e => setPosProcMinutos(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))} style={field} />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.mute, pointerEvents: "none" }}>min</span>
                </div>
              </div>
            </label>
            <NumInput label="Quantidade de peças" suffix="un" value={qtd} onChange={setQtd} />

            {/* custos extras opcionais */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: C.mute, letterSpacing: 0.3 }}>
                  Custos extras (por peça)
                </span>
                <button
                  onClick={addExtra}
                  style={{
                    background: C.heatDim,
                    border: `1px solid ${C.heat}`,
                    color: C.heat,
                    borderRadius: 7,
                    padding: "4px 10px",
                    fontSize: 13,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  + Adicionar
                </button>
              </div>
              {extras.length === 0 && (
                <p style={{ fontSize: 12.5, color: C.mute, margin: "0 0 4px", lineHeight: 1.5 }}>
                  Embalagem, ímãs, parafusos, tinta, insertos — o que entrar na peça.
                </p>
              )}
              {extras.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    placeholder="Item"
                    value={e.nome}
                    onChange={(ev) => updExtra(e.id, "nome", ev.target.value)}
                    style={{ ...field, flex: 1.4 }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="R$"
                    value={e.valor}
                    onChange={(ev) => updExtra(e.id, "valor", ev.target.value)}
                    style={{ ...field, flex: 1 }}
                  />
                  <button
                    onClick={() => delExtra(e.id)}
                    style={{
                      background: "transparent",
                      border: `1px solid ${C.line}`,
                      color: C.mute,
                      borderRadius: 7,
                      width: 38,
                      cursor: "pointer",
                      fontSize: 16,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* referência de mercado */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
              <span style={{ display: "block", fontSize: 12, color: C.mute, letterSpacing: 0.3, marginBottom: 4 }}>
                Referência de mercado
              </span>
              <p style={{ fontSize: 12.5, color: C.mute, margin: "0 0 12px", lineHeight: 1.5 }}>
                Por quanto peças parecidas vendem por aí? Serve de âncora — não é puxado automático.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <NumInput label="Mínimo visto" suffix="R$" value={mktMin} onChange={setMktMin} step="0.01" />
                </div>
                <div style={{ flex: 1 }}>
                  <NumInput label="Máximo visto" suffix="R$" value={mktMax} onChange={setMktMax} step="0.01" />
                </div>
              </div>
            </div>
          </div>

          {/* configs */}
          <div style={panelStyle}>
            <h2 style={heading}>Custos da conta</h2>
            <NumInput label="Potência da impressora" suffix="W" value={potenciaW} onChange={setPotenciaW} />
            <NumInput label="Tarifa de energia" suffix="R$/kWh" value={tarifaKwh} onChange={setTarifaKwh} step="0.01" />
            <NumInput label="Custo da máquina" suffix="R$" value={custoMaquina} onChange={setCustoMaquina} />
            <NumInput label="Vida útil estimada" suffix="h" value={vidaUtilH} onChange={setVidaUtilH} />
            <NumInput label="Manutenção" suffix="R$/h" value={manutHora} onChange={setManutHora} step="0.1" />
            <NumInput label="Mão de obra (R$/h)" suffix="R$/h" value={maoObraHora} onChange={setMaoObraHora} />
            <NumInput label="Taxa de falha" suffix="%" value={taxaFalha} onChange={setTaxaFalha} />
            <NumInput label="Margem de lucro" suffix="%" value={margem} onChange={setMargem} />

            <button onClick={salvarPadraoCustos}
              style={{ width: "100%", padding: "10px 0", borderRadius: 9, border: `1px solid ${padraoCustosSalvo ? C.green : C.line}`, background: padraoCustosSalvo ? "#7bd88f18" : "transparent", color: padraoCustosSalvo ? C.green : C.mute, fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 4, transition: "all .2s" }}>
              {padraoCustosSalvo ? "✓ Padrão salvo!" : "💾 Salvar como meu padrão"}
            </button>
            <div style={{ fontSize: 11, color: C.mute, textAlign: "center", marginTop: 4 }}>
              Esses valores serão carregados automaticamente em novos cálculos.
            </div>

            {/* imposto de nota (venda direta) */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: modoMkt ? "default" : "pointer", opacity: modoMkt ? 0.45 : 1 }}>
                <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>
                  Imposto de nota (venda direta)
                </span>
                <button
                  disabled={modoMkt}
                  onClick={() => setUsarImposto((v) => !v)}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    border: "none",
                    cursor: modoMkt ? "default" : "pointer",
                    background: usarImposto && !modoMkt ? C.heat : C.line,
                    position: "relative",
                    transition: "background .15s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: usarImposto && !modoMkt ? 22 : 2,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left .15s",
                    }}
                  />
                </button>
              </label>
              {modoMkt ? (
                <p style={{ fontSize: 12, color: C.mute, margin: "8px 0 0", lineHeight: 1.5 }}>
                  No marketplace, o imposto fica no campo próprio abaixo.
                </p>
              ) : usarImposto ? (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12.5, color: C.mute, margin: "0 0 12px", lineHeight: 1.5 }}>
                    Alíquota sobre a venda (Simples, MEI etc.). O preço sobe pra cobrir o imposto sem comer seu lucro.
                  </p>
                  <NumInput label="Alíquota" suffix="%" value={impostoNF} onChange={setImpostoNF} step="0.1" />
                </div>
              ) : null}
            </div>

            {/* marketplace toggle */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>
                  Vender em marketplace
                </span>
                <button
                  onClick={() => setModoMkt((v) => !v)}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    background: modoMkt ? C.heat : C.line,
                    position: "relative",
                    transition: "background .15s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: modoMkt ? 22 : 2,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left .15s",
                    }}
                  />
                </button>
              </label>

              {modoMkt && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 12.5, color: C.mute, margin: "0 0 12px", lineHeight: 1.5 }}>
                    A comissão é calculada sobre o preço de venda. O cálculo ajusta o preço pra manter seu lucro.
                  </p>

                  {/* presets */}
                  <span style={{ display: "block", fontSize: 12, color: C.mute, marginBottom: 8 }}>
                    Plataforma
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
                    {PRESETS.map((p) => {
                      const on = presetId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => selectPreset(p.id)}
                          style={{
                            padding: "6px 11px",
                            fontSize: 12.5,
                            borderRadius: 7,
                            cursor: "pointer",
                            fontWeight: on ? 600 : 400,
                            color: on ? C.heat : C.mute,
                            background: on ? C.heatDim : "transparent",
                            border: `1px solid ${on ? C.heat : C.line}`,
                          }}
                        >
                          {p.nome}
                        </button>
                      );
                    })}
                  </div>

                  <NumInput label="Comissão do marketplace" suffix="%" value={comissao} onChange={(v) => { setComissao(v); setPresetId("custom"); }} step="0.1" />
                  <NumInput label="Imposto sobre venda" suffix="%" value={imposto} onChange={setImposto} step="0.1" />
                  <NumInput label="Taxa fixa por venda" suffix="R$" value={taxaFixa} onChange={(v) => { setTaxaFixa(v); setPresetId("custom"); }} step="0.01" />
                  <NumInput label="Frete embutido no preço" suffix="R$" value={freteEmbutido} onChange={setFreteEmbutido} step="0.01" />
                </div>
              )}
            </div>
          </div>

          {/* resultado */}
          <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={panelStyle}>
              <h2 style={heading}>Custo por peça</h2>
              <Row label="Material" value={brl(calc.material)} />
              <Row label="Energia" value={brl(calc.energia)} />
              <Row label="Depreciação" value={brl(calc.deprec)} />
              <Row label="Manutenção" value={brl(calc.manut)} />
              <Row label="Mão de obra" value={brl(calc.maoObra)} />
              {calc.extrasTotal > 0 && (
                <Row label="Extras" value={brl(calc.extrasTotal)} />
              )}
              <Row label="Custo base" value={brl(calc.custoBasePeca)} accent />
              <Row label={`Com falha (+${taxaFalha}%)`} value={brl(calc.comFalhaPeca)} />
            </div>

            <div
              style={{
                ...panelStyle,
                background: `linear-gradient(160deg, ${C.panel2}, ${C.heatDim})`,
                borderColor: C.heat,
              }}
            >
              <span style={{ fontSize: 12, color: C.mute, letterSpacing: 0.3 }}>
                {modoMkt
                  ? `Preço · ${PRESETS.find((p) => p.id === presetId)?.nome || "Marketplace"}`
                  : "Preço por peça"}
              </span>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  color: C.heat,
                  letterSpacing: -1,
                  fontVariantNumeric: "tabular-nums",
                  margin: "4px 0 2px",
                }}
              >
                {brl(modoMkt ? calc.precoMkt : calc.finalPeca)}
              </div>
              <span style={{ fontSize: 13, color: C.cyan }}>
                Lucro: {brl(calc.lucroPeca)} ({(modoMkt ? calc.margemMktReal : parseFloat(margem) || 0).toFixed(0)}%)
              </span>

              {!modoMkt && usarImposto && calc.impostoNFValor > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.mute, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.heat}55` }}>
                  <span>Imposto de nota ({impostoNF}%)</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: C.heat }}>
                    −{brl(calc.impostoNFValor)}
                  </span>
                </div>
              )}

              {modoMkt && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.heat}55` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.mute, marginBottom: 6 }}>
                    <span>Seu preço (venda direta)</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{brl(calc.finalPeca)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.mute }}>
                    <span>Marketplace + impostos levam</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", color: C.heat }}>
                      −{brl(calc.taxaMktTotal)}
                    </span>
                  </div>
                </div>
              )}

              {calc.n > 1 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.heat}55` }}>
                  <span style={{ fontSize: 12, color: C.mute, letterSpacing: 0.3 }}>
                    Total do lote · {calc.n} peças
                  </span>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      color: C.ink,
                      letterSpacing: -0.5,
                      fontVariantNumeric: "tabular-nums",
                      margin: "2px 0",
                    }}
                  >
                    {brl(modoMkt ? calc.precoMktTotal : calc.finalTotal)}
                  </div>
                  <span style={{ fontSize: 12.5, color: C.cyan }}>
                    Lucro total: {brl(calc.lucroTotal)}
                  </span>
                </div>
              )}
            </div>

            {/* importar para catálogo */}
            <button
              onClick={salvarNoCatalogo}
              disabled={!nomeProduto.trim()}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 12,
                border: "none",
                cursor: nomeProduto.trim() ? "pointer" : "not-allowed",
                background: salvo ? "#7bd88f" : nomeProduto.trim() ? C.heat : C.line,
                color: salvo ? "#0c1410" : nomeProduto.trim() ? "#1a0d05" : C.mute,
                fontSize: 14.5,
                fontWeight: 700,
                letterSpacing: 0.2,
                transition: "background .15s",
              }}
            >
              {salvo
                ? editandoId
                  ? "✓ Produto atualizado"
                  : "✓ Adicionado ao catálogo"
                : !nomeProduto.trim()
                ? "Dê um nome ao produto"
                : editandoId
                ? "Salvar alterações"
                : "Importar para catálogo"}
            </button>
            {editandoId && !salvo && (
              <button
                onClick={cancelarEdicao}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "9px",
                  borderRadius: 10,
                  border: `1px solid ${C.line}`,
                  background: "transparent",
                  color: C.mute,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancelar edição · novo produto
              </button>
            )}

            {/* posicionamento de mercado */}
            {calc.temRef && (() => {
              const map = {
                baixo: { cor: C.cyan, txt: "Abaixo do mercado", dica: "Dá pra subir o preço sem perder competitividade." },
                competitivo: { cor: "#7bd88f", txt: "Dentro do mercado", dica: "Preço alinhado com o que vendem por aí." },
                alto: { cor: C.heat, txt: "Acima do mercado", dica: "Justifique com qualidade ou reduza custo/margem." },
              };
              const v = map[calc.veredito];
              return (
                <div style={panelStyle}>
                  <h2 style={heading}>Posição no mercado</h2>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: v.cor }}>{v.txt}</span>
                    <span style={{ fontSize: 12.5, color: C.mute }}>
                      meio da faixa {brl(calc.sugeridoMercado)}
                    </span>
                  </div>

                  {/* barra de faixa */}
                  <div style={{ position: "relative", height: 8, background: C.bg, borderRadius: 4, marginBottom: 8 }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: 4, background: `linear-gradient(90deg, ${C.cyan}55, #7bd88f55, ${C.heat}55)` }} />
                    {/* marcador do seu preço */}
                    <div
                      style={{
                        position: "absolute",
                        top: -3,
                        left: `${calc.posicao * 100}%`,
                        transform: "translateX(-50%)",
                        width: 4,
                        height: 14,
                        borderRadius: 2,
                        background: v.cor,
                        boxShadow: `0 0 0 2px ${C.panel}`,
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: C.mute, fontVariantNumeric: "tabular-nums" }}>
                    <span>{brl(calc.min)}</span>
                    <span style={{ color: v.cor, fontWeight: 600 }}>seu preço {brl(calc.precoEfetivo)}</span>
                    <span>{brl(calc.max)}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: C.mute, margin: "12px 0 0", lineHeight: 1.5 }}>
                    {v.dica}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>

        {/* catálogo */}
        {catalogo.length > 0 && (
          <div style={{ ...panelStyle, marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
              <h2 style={{ ...heading, margin: 0 }}>Catálogo · {catalogo.length} produtos</h2>
              <span style={{ fontSize: 12, color: C.mute }}>toque para editar · salvo automaticamente</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* cabeçalho */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.1fr 0.9fr 0.9fr 0.9fr 32px", gap: 10, padding: "0 4px", fontSize: 11, color: C.mute, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <span>Produto</span>
                <span>Canal</span>
                <span style={{ textAlign: "right" }}>Custo</span>
                <span style={{ textAlign: "right" }}>Preço</span>
                <span style={{ textAlign: "right" }}>Lucro</span>
                <span />
              </div>
              {catalogo.map((p) => (
                <div
                  key={p.id}
                  onClick={() => carregarProduto(p)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.1fr 0.9fr 0.9fr 0.9fr 32px",
                    gap: 10,
                    alignItems: "center",
                    background: p.id === editandoId ? C.heatDim : C.bg,
                    border: `1px solid ${p.id === editandoId ? C.heat : C.line}`,
                    borderRadius: 9,
                    padding: "11px 12px",
                    cursor: p.receita ? "pointer" : "default",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.nome}
                    {p.id === editandoId && (
                      <span style={{ fontSize: 11, color: C.heat, marginLeft: 8, fontWeight: 400 }}>editando</span>
                    )}
                  </span>
                  <span style={{ fontSize: 12.5, color: C.mute }}>{p.canal}</span>
                  <span style={{ fontSize: 13, color: C.mute, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{brl(p.custo)}</span>
                  <span style={{ fontSize: 14, color: C.heat, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{brl(p.preco)}</span>
                  <span style={{ fontSize: 13, color: C.cyan, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{brl(p.lucro)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removerDoCatalogo(p.id); }}
                    style={{ background: "transparent", border: "none", color: C.mute, cursor: "pointer", fontSize: 17, lineHeight: 1 }}
                    title="Remover"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
