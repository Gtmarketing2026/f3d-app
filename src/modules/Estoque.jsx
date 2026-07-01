import { useState, useRef } from "react";

const C = {
  bg: "#13151a", panel: "#1b1e26", panel2: "#222631", line: "#2e3342",
  ink: "#eef1f6", mute: "#878fa3", heat: "#ff6a2b", heatDim: "#ff6a2b22",
  cyan: "#37d6c5", green: "#7bd88f", red: "#ff5d6c", amber: "#f4c14b",
};

const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const uid = () => Math.random().toString(36).slice(2, 9);

const field = {
  width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8,
  color: C.ink, padding: "9px 12px", fontSize: 13.5, outline: "none", boxSizing: "border-box",
};
const btn = (cor, outline) => ({
  padding: "8px 14px", borderRadius: 8,
  border: outline ? `1px solid ${cor}` : "none",
  background: outline ? "transparent" : cor,
  color: outline ? cor : (cor === C.heat ? "#1a0d05" : C.ink),
  fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
});

function salvar(key, val) {
  try { localStorage.setItem("app3d:estoque:" + key, JSON.stringify(val)); } catch (e) {}
}
function carregar(key, def) {
  try { const raw = localStorage.getItem("app3d:estoque:" + key); return raw ? JSON.parse(raw) : def; } catch { return def; }
}

// ── CSV helpers ─────────────────────────────────────────────────
function toCSV(campos, rows) {
  const esc = (v) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [campos.join(","), ...rows.map(r => campos.map(c => esc(r[c])).join(","))].join("\n");
}
function parseCSVRows(text, campos) {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
  const splitLine = (line) => {
    const out = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else { if (ch === '"') q = true; else if (ch === sep) { out.push(cur); cur = ""; } else cur += ch; }
    }
    out.push(cur); return out;
  };
  const head = splitLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = splitLine(line);
    const obj = { id: uid() };
    campos.forEach(c => { const i = head.indexOf(c.toLowerCase()); obj[c] = i >= 0 ? vals[i] ?? "" : ""; });
    return obj;
  }).filter(r => Object.values(r).some(v => v && v !== r.id));
}

function baixarCSV(nome, texto) {
  const blob = new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; a.click();
}

// ── Leitura de arquivo ─────────────────────────────────────────
function lerArquivo(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsText(file, "utf-8");
  });
}

// Extração simples de texto de PDF (usa pdf.js via CDN se disponível, senão retorna erro legível)
async function extrairTextoPDF(file) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = async (e) => {
      try {
        if (!window.pdfjsLib) {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          document.head.appendChild(script);
          await new Promise(ok => { script.onload = ok; });
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        const pdf = await window.pdfjsLib.getDocument({ data: e.target.result }).promise;
        let texto = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          texto += content.items.map(it => it.str).join(" ") + "\n";
        }
        res(texto);
      } catch { res(null); }
    };
    r.readAsArrayBuffer(file);
  });
}

// ── Barra de progresso ─────────────────────────────────────────
function PctBar({ pct }) {
  const cor = pct < 20 ? C.red : pct < 40 ? C.amber : C.green;
  return (
    <div style={{ height: 5, borderRadius: 3, background: C.line, marginTop: 8 }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", borderRadius: 3, background: cor }} />
    </div>
  );
}

// ── Botões de ação de item ─────────────────────────────────────
function AcoesItem({ onEdit, onDuplicar, onExcluir }) {
  return (
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      <button onClick={onEdit} title="Editar" style={{ background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 15, padding: "2px 4px" }}>✏</button>
      <button onClick={onDuplicar} title="Duplicar" style={{ background: "none", border: "none", color: C.cyan, cursor: "pointer", fontSize: 15, padding: "2px 4px" }}>⧉</button>
      <button onClick={onExcluir} title="Excluir" style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 15, padding: "2px 4px" }}>✕</button>
    </div>
  );
}

// ── Barra de importar/exportar ────────────────────────────────
function BarraImportExport({ onImportCSV, onImportPDF, onExportCSV, importando }) {
  const refCSV = useRef(); const refPDF = useRef();
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input ref={refCSV} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) onImportCSV(e.target.files[0]); e.target.value = ""; }} />
      <input ref={refPDF} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) onImportPDF(e.target.files[0]); e.target.value = ""; }} />
      <button onClick={() => refCSV.current.click()} style={btn(C.cyan, true)} disabled={importando}>
        {importando ? "Importando..." : "⬆ Importar CSV"}
      </button>
      <button onClick={() => refPDF.current.click()} style={btn(C.amber, true)} disabled={importando}>
        ⬆ Importar PDF
      </button>
      <button onClick={onExportCSV} style={btn(C.green, true)}>
        ⬇ Exportar CSV
      </button>
    </div>
  );
}

// ── FILAMENTOS ──────────────────────────────────────────────────
const TIPOS_FILAMENTO = ["PLA", "PETG", "ABS", "TPU", "ASA", "Nylon", "Resina", "Outro"];
const CAMPOS_FIL = ["tipo", "cor", "pesoTotalG", "pesoRestanteG", "precoKg", "alerta"];

function FilamentoModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item || { tipo: "PLA", cor: "", pesoTotalG: 1000, pesoRestanteG: 1000, precoKg: 120, alerta: 200 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28, width: 360, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>{item?.id ? "Editar filamento" : "Novo filamento"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Tipo</div>
            <select value={form.tipo} onChange={e => set("tipo", e.target.value)} style={field}>
              {TIPOS_FILAMENTO.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Cor</div>
            <input style={field} value={form.cor} onChange={e => set("cor", e.target.value)} placeholder="Ex: Branco, Preto" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Peso total (g)</div>
              <input style={field} type="number" value={form.pesoTotalG} onChange={e => set("pesoTotalG", +e.target.value)} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Restante (g)</div>
              <input style={field} type="number" value={form.pesoRestanteG} onChange={e => set("pesoRestanteG", +e.target.value)} /></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Preço/kg (R$)</div>
              <input style={field} type="number" value={form.precoKg} onChange={e => set("precoKg", +e.target.value)} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Alerta (g)</div>
              <input style={field} type="number" value={form.alerta} onChange={e => set("alerta", +e.target.value)} /></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btn(C.line), flex: 1, color: C.mute }}>Cancelar</button>
          <button onClick={() => onSave({ ...form, id: form.id || uid() })} style={{ ...btn(C.heat), flex: 1 }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function SecaoFilamentos() {
  const [lista, setLista] = useState(() => carregar("filamentos", []));
  const [modal, setModal] = useState(null);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState("");

  const salvarLista = (nova) => { setLista(nova); salvar("filamentos", nova); };
  const onSave = (item) => {
    salvarLista(lista.some(f => f.id === item.id) ? lista.map(f => f.id === item.id ? item : f) : [...lista, item]);
    setModal(null);
  };
  const duplicar = (item) => {
    const copia = { ...item, id: uid(), cor: item.cor + " (cópia)" };
    salvarLista([...lista, copia]);
  };
  const excluir = (id) => salvarLista(lista.filter(f => f.id !== id));

  const exportarCSV = () => baixarCSV("filamentos.csv", toCSV(CAMPOS_FIL, lista));

  const importarCSV = async (file) => {
    setImportando(true);
    try {
      const text = await lerArquivo(file);
      const rows = parseCSVRows(text, CAMPOS_FIL).map(r => ({
        ...r, pesoTotalG: +r.pesoTotalG || 1000, pesoRestanteG: +r.pesoRestanteG || 1000,
        precoKg: +r.precoKg || 120, alerta: +r.alerta || 200,
      }));
      if (rows.length === 0) { setMsg("Nenhum dado encontrado no CSV."); return; }
      salvarLista([...lista, ...rows]);
      setMsg(`${rows.length} filamento(s) importado(s)!`);
    } catch { setMsg("Erro ao ler arquivo."); }
    finally { setImportando(false); setTimeout(() => setMsg(""), 3000); }
  };

  const importarPDF = async (file) => {
    setImportando(true);
    setMsg("Lendo PDF...");
    const texto = await extrairTextoPDF(file);
    setImportando(false);
    if (!texto) { setMsg("Não foi possível extrair dados do PDF. Use CSV para importação."); setTimeout(() => setMsg(""), 4000); return; }
    // Tenta identificar linhas com tipo de filamento
    const linhas = texto.split("\n").filter(l => TIPOS_FILAMENTO.some(t => l.toUpperCase().includes(t)));
    if (linhas.length === 0) { setMsg("PDF lido mas sem dados reconhecíveis. Recomendamos usar CSV."); setTimeout(() => setMsg(""), 4000); return; }
    setMsg(`${linhas.length} linha(s) encontrada(s) no PDF. Revise e edite manualmente.`);
    setTimeout(() => setMsg(""), 5000);
  };

  const valorTotal = lista.reduce((s, f) => s + (f.pesoRestanteG / 1000) * f.precoKg, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Filamentos · {lista.length} carretel(is)</div>
          <div style={{ fontSize: 12, color: C.mute }}>Valor em estoque: <span style={{ color: C.cyan }}>{brl(valorTotal)}</span></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <BarraImportExport onImportCSV={importarCSV} onImportPDF={importarPDF} onExportCSV={exportarCSV} importando={importando} />
          <button onClick={() => setModal("novo")} style={btn(C.heat)}>+ Adicionar</button>
        </div>
      </div>
      {msg && <div style={{ background: "#37d6c518", border: `1px solid ${C.cyan}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, color: C.cyan, marginBottom: 12 }}>{msg}</div>}
      {lista.length === 0 && <div style={{ textAlign: "center", color: C.mute, padding: 32 }}>Nenhum filamento cadastrado.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {lista.map(f => {
          const pct = Math.round((f.pesoRestanteG / f.pesoTotalG) * 100);
          const baixo = f.pesoRestanteG <= f.alerta;
          return (
            <div key={f.id} style={{ background: C.panel2, border: `1px solid ${baixo ? C.red : C.line}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{f.tipo} <span style={{ color: C.mute, fontWeight: 400 }}>{f.cor}</span></div>
                  {baixo && <div style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>⚠ Estoque baixo</div>}
                </div>
                <AcoesItem onEdit={() => setModal(f)} onDuplicar={() => duplicar(f)} onExcluir={() => excluir(f.id)} />
              </div>
              <div style={{ fontSize: 13, color: C.ink, marginTop: 8 }}>{f.pesoRestanteG}g de {f.pesoTotalG}g <span style={{ color: C.mute }}>({pct}%)</span></div>
              <PctBar pct={pct} />
              <div style={{ fontSize: 12, color: C.mute, marginTop: 6 }}>{brl(f.precoKg)}/kg · {brl((f.pesoRestanteG / 1000) * f.precoKg)} restante</div>
            </div>
          );
        })}
      </div>
      {modal && <FilamentoModal item={modal === "novo" ? null : modal} onSave={onSave} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── PRODUTOS ACABADOS ───────────────────────────────────────────
const CAMPOS_PROD = ["nome", "qtd", "minimo", "observacao"];

function ProdutoModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item || { nome: "", qtd: 0, minimo: 2, observacao: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28, width: 360 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>{item?.id ? "Editar produto" : "Novo produto"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Nome do produto</div>
            <input style={field} value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Vaso geométrico P" /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Qtd em estoque</div>
              <input style={field} type="number" min="0" value={form.qtd} onChange={e => set("qtd", +e.target.value)} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Mínimo desejado</div>
              <input style={field} type="number" min="0" value={form.minimo} onChange={e => set("minimo", +e.target.value)} /></div>
          </div>
          <div><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Observação</div>
            <input style={field} value={form.observacao} onChange={e => set("observacao", e.target.value)} placeholder="Opcional" /></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btn(C.line), flex: 1, color: C.mute }}>Cancelar</button>
          <button onClick={() => onSave({ ...form, id: form.id || uid() })} style={{ ...btn(C.heat), flex: 1 }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function SecaoProdutos() {
  const [lista, setLista] = useState(() => carregar("produtos", []));
  const [modal, setModal] = useState(null);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState("");

  const salvarLista = (nova) => { setLista(nova); salvar("produtos", nova); };
  const onSave = (item) => {
    salvarLista(lista.some(p => p.id === item.id) ? lista.map(p => p.id === item.id ? item : p) : [...lista, item]);
    setModal(null);
  };
  const duplicar = (item) => salvarLista([...lista, { ...item, id: uid(), nome: item.nome + " (cópia)" }]);
  const ajustarQtd = (id, delta) => salvarLista(lista.map(p => p.id === id ? { ...p, qtd: Math.max(0, p.qtd + delta) } : p));
  const excluir = (id) => salvarLista(lista.filter(p => p.id !== id));

  const exportarCSV = () => baixarCSV("produtos.csv", toCSV(CAMPOS_PROD, lista));
  const importarCSV = async (file) => {
    setImportando(true);
    try {
      const text = await lerArquivo(file);
      const rows = parseCSVRows(text, CAMPOS_PROD).map(r => ({ ...r, qtd: +r.qtd || 0, minimo: +r.minimo || 0 }));
      if (!rows.length) { setMsg("Nenhum dado encontrado."); return; }
      salvarLista([...lista, ...rows]);
      setMsg(`${rows.length} produto(s) importado(s)!`);
    } catch { setMsg("Erro ao ler arquivo."); }
    finally { setImportando(false); setTimeout(() => setMsg(""), 3000); }
  };
  const importarPDF = async (file) => {
    setImportando(true); setMsg("Lendo PDF...");
    const texto = await extrairTextoPDF(file);
    setImportando(false);
    if (!texto) { setMsg("Não foi possível extrair dados do PDF. Use CSV."); setTimeout(() => setMsg(""), 4000); return; }
    const linhas = texto.split("\n").filter(l => l.trim().length > 3);
    setMsg(`PDF lido (${linhas.length} linhas). Dados extraídos como texto — use CSV para importação estruturada.`);
    setTimeout(() => setMsg(""), 5000);
  };

  const totalPecas = lista.reduce((s, p) => s + p.qtd, 0);
  const alertas = lista.filter(p => p.qtd < p.minimo).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Produtos acabados · {totalPecas} peça(s)</div>
          {alertas > 0 && <div style={{ fontSize: 12, color: C.red }}>⚠ {alertas} abaixo do mínimo</div>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <BarraImportExport onImportCSV={importarCSV} onImportPDF={importarPDF} onExportCSV={exportarCSV} importando={importando} />
          <button onClick={() => setModal("novo")} style={btn(C.heat)}>+ Adicionar</button>
        </div>
      </div>
      {msg && <div style={{ background: "#37d6c518", border: `1px solid ${C.cyan}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, color: C.cyan, marginBottom: 12 }}>{msg}</div>}
      {lista.length === 0 && <div style={{ textAlign: "center", color: C.mute, padding: 32 }}>Nenhum produto cadastrado.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map(p => {
          const baixo = p.qtd < p.minimo;
          return (
            <div key={p.id} style={{ background: C.panel2, border: `1px solid ${baixo ? C.red : C.line}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.nome}</div>
                {p.observacao && <div style={{ fontSize: 12, color: C.mute }}>{p.observacao}</div>}
                {baixo && <div style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>⚠ Abaixo do mínimo ({p.minimo})</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => ajustarQtd(p.id, -1)} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontSize: 18, cursor: "pointer" }}>−</button>
                <span style={{ fontSize: 20, fontWeight: 800, minWidth: 30, textAlign: "center", color: baixo ? C.red : C.ink }}>{p.qtd}</span>
                <button onClick={() => ajustarQtd(p.id, 1)} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontSize: 18, cursor: "pointer" }}>+</button>
              </div>
              <AcoesItem onEdit={() => setModal(p)} onDuplicar={() => duplicar(p)} onExcluir={() => excluir(p.id)} />
            </div>
          );
        })}
      </div>
      {modal && <ProdutoModal item={modal === "novo" ? null : modal} onSave={onSave} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── INSUMOS ─────────────────────────────────────────────────────
const UNIDADES = ["un", "g", "kg", "ml", "L", "m", "cm", "pct"];
const CAMPOS_INS = ["nome", "qtd", "unidade", "minimo", "observacao"];

function InsumoModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item || { nome: "", qtd: 0, unidade: "un", minimo: 10, observacao: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28, width: 360 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>{item?.id ? "Editar insumo" : "Novo insumo"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Nome</div>
            <input style={field} value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Insertos M3, Tinta spray" /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Quantidade</div>
              <input style={field} type="number" min="0" value={form.qtd} onChange={e => set("qtd", +e.target.value)} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Unidade</div>
              <select value={form.unidade} onChange={e => set("unidade", e.target.value)} style={field}>
                {UNIDADES.map(u => <option key={u}>{u}</option>)}
              </select></div>
          </div>
          <div><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Alerta de mínimo</div>
            <input style={field} type="number" min="0" value={form.minimo} onChange={e => set("minimo", +e.target.value)} /></div>
          <div><div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Observação</div>
            <input style={field} value={form.observacao} onChange={e => set("observacao", e.target.value)} placeholder="Opcional" /></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btn(C.line), flex: 1, color: C.mute }}>Cancelar</button>
          <button onClick={() => onSave({ ...form, id: form.id || uid() })} style={{ ...btn(C.heat), flex: 1 }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function SecaoInsumos() {
  const [lista, setLista] = useState(() => carregar("insumos", []));
  const [modal, setModal] = useState(null);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState("");

  const salvarLista = (nova) => { setLista(nova); salvar("insumos", nova); };
  const onSave = (item) => {
    salvarLista(lista.some(i => i.id === item.id) ? lista.map(i => i.id === item.id ? item : i) : [...lista, item]);
    setModal(null);
  };
  const duplicar = (item) => salvarLista([...lista, { ...item, id: uid(), nome: item.nome + " (cópia)" }]);
  const ajustarQtd = (id, delta) => salvarLista(lista.map(i => i.id === id ? { ...i, qtd: Math.max(0, i.qtd + delta) } : i));
  const excluir = (id) => salvarLista(lista.filter(i => i.id !== id));

  const exportarCSV = () => baixarCSV("insumos.csv", toCSV(CAMPOS_INS, lista));
  const importarCSV = async (file) => {
    setImportando(true);
    try {
      const text = await lerArquivo(file);
      const rows = parseCSVRows(text, CAMPOS_INS).map(r => ({ ...r, qtd: +r.qtd || 0, minimo: +r.minimo || 0, unidade: r.unidade || "un" }));
      if (!rows.length) { setMsg("Nenhum dado encontrado."); return; }
      salvarLista([...lista, ...rows]);
      setMsg(`${rows.length} insumo(s) importado(s)!`);
    } catch { setMsg("Erro ao ler arquivo."); }
    finally { setImportando(false); setTimeout(() => setMsg(""), 3000); }
  };
  const importarPDF = async (file) => {
    setImportando(true); setMsg("Lendo PDF...");
    const texto = await extrairTextoPDF(file);
    setImportando(false);
    if (!texto) { setMsg("Não foi possível extrair dados do PDF. Use CSV."); setTimeout(() => setMsg(""), 4000); return; }
    setMsg("PDF lido. Para importação estruturada use CSV com colunas: nome, qtd, unidade, minimo, observacao.");
    setTimeout(() => setMsg(""), 6000);
  };

  const alertas = lista.filter(i => i.qtd <= i.minimo).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Insumos · {lista.length} item(ns)</div>
          {alertas > 0 && <div style={{ fontSize: 12, color: C.red }}>⚠ {alertas} com estoque baixo</div>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <BarraImportExport onImportCSV={importarCSV} onImportPDF={importarPDF} onExportCSV={exportarCSV} importando={importando} />
          <button onClick={() => setModal("novo")} style={btn(C.heat)}>+ Adicionar</button>
        </div>
      </div>
      {msg && <div style={{ background: "#37d6c518", border: `1px solid ${C.cyan}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, color: C.cyan, marginBottom: 12 }}>{msg}</div>}
      {lista.length === 0 && <div style={{ textAlign: "center", color: C.mute, padding: 32 }}>Nenhum insumo cadastrado.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map(i => {
          const baixo = i.qtd <= i.minimo;
          return (
            <div key={i.id} style={{ background: C.panel2, border: `1px solid ${baixo ? C.red : C.line}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{i.nome}</div>
                {i.observacao && <div style={{ fontSize: 12, color: C.mute }}>{i.observacao}</div>}
                {baixo && <div style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>⚠ Estoque baixo (mín: {i.minimo} {i.unidade})</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => ajustarQtd(i.id, -1)} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontSize: 18, cursor: "pointer" }}>−</button>
                <span style={{ fontSize: 18, fontWeight: 800, minWidth: 50, textAlign: "center", color: baixo ? C.red : C.ink }}>{i.qtd} {i.unidade}</span>
                <button onClick={() => ajustarQtd(i.id, 1)} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontSize: 18, cursor: "pointer" }}>+</button>
              </div>
              <AcoesItem onEdit={() => setModal(i)} onDuplicar={() => duplicar(i)} onExcluir={() => excluir(i.id)} />
            </div>
          );
        })}
      </div>
      {modal && <InsumoModal item={modal === "novo" ? null : modal} onSave={onSave} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── PÁGINA PRINCIPAL ────────────────────────────────────────────
const ABAS = [
  { id: "filamentos", label: "🧵 Filamentos" },
  { id: "produtos", label: "📦 Produtos acabados" },
  { id: "insumos", label: "🔩 Insumos" },
];

export default function Estoque() {
  const [aba, setAba] = useState("filamentos");
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", padding: "32px 20px 60px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.3 }}>Controle de Estoque</h1>
        <p style={{ color: C.mute, fontSize: 14, margin: "0 0 28px" }}>Filamentos, produtos prontos e insumos com alertas de reposição.</p>
        <div style={{ display: "flex", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 11, padding: 4, gap: 4, marginBottom: 28, width: "fit-content" }}>
          {ABAS.map(a => {
            const on = aba === a.id;
            return (
              <button key={a.id} onClick={() => setAba(a.id)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: on ? 700 : 500, color: on ? "#1a0d05" : C.mute, background: on ? C.heat : "transparent" }}>
                {a.label}
              </button>
            );
          })}
        </div>
        {aba === "filamentos" && <SecaoFilamentos />}
        {aba === "produtos" && <SecaoProdutos />}
        {aba === "insumos" && <SecaoInsumos />}
      </div>
    </div>
  );
}
