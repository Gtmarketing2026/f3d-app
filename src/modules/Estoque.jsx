import { useState, useEffect } from "react";

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
const btn = (cor) => ({
  padding: "9px 18px", borderRadius: 9, border: "none", background: cor,
  color: cor === C.heat ? "#1a0d05" : C.ink, fontWeight: 700, fontSize: 13, cursor: "pointer",
});

function salvar(key, val) {
  try { localStorage.setItem("app3d:estoque:" + key, JSON.stringify(val)); } catch (e) {}
}
function carregar(key, def) {
  try {
    const raw = localStorage.getItem("app3d:estoque:" + key);
    return raw ? JSON.parse(raw) : def;
  } catch (e) { return def; }
}

// ── FILAMENTOS ──────────────────────────────────────────────────
const TIPOS_FILAMENTO = ["PLA", "PETG", "ABS", "TPU", "ASA", "Nylon", "Resina", "Outro"];

function FilamentoModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item || { tipo: "PLA", cor: "", pesoTotalG: 1000, pesoRestanteG: 1000, precoKg: 120, alerta: 200 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28, width: 360 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>{item ? "Editar filamento" : "Novo filamento"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Tipo</div>
            <select value={form.tipo} onChange={e => set("tipo", e.target.value)} style={{ ...field }}>
              {TIPOS_FILAMENTO.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Cor</div>
            <input style={field} value={form.cor} onChange={e => set("cor", e.target.value)} placeholder="Ex: Branco, Preto, Vermelho" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Peso total (g)</div>
              <input style={field} type="number" value={form.pesoTotalG} onChange={e => set("pesoTotalG", +e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Restante (g)</div>
              <input style={field} type="number" value={form.pesoRestanteG} onChange={e => set("pesoRestanteG", +e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Preço/kg (R$)</div>
              <input style={field} type="number" value={form.precoKg} onChange={e => set("precoKg", +e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Alerta (g)</div>
              <input style={field} type="number" value={form.alerta} onChange={e => set("alerta", +e.target.value)} />
            </div>
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

function PctBar({ pct }) {
  const cor = pct < 20 ? C.red : pct < 40 ? C.amber : C.green;
  return (
    <div style={{ height: 5, borderRadius: 3, background: C.line, marginTop: 8 }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", borderRadius: 3, background: cor, transition: "width .3s" }} />
    </div>
  );
}

function SecaoFilamentos() {
  const [lista, setLista] = useState(() => carregar("filamentos", []));
  const [modal, setModal] = useState(null); // null | "novo" | item

  const salvarLista = (nova) => { setLista(nova); salvar("filamentos", nova); };
  const onSave = (item) => {
    salvarLista(lista.some(f => f.id === item.id) ? lista.map(f => f.id === item.id ? item : f) : [...lista, item]);
    setModal(null);
  };
  const excluir = (id) => salvarLista(lista.filter(f => f.id !== id));

  const valorTotal = lista.reduce((s, f) => s + (f.pesoRestanteG / 1000) * f.precoKg, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Filamentos · {lista.length} carretel(is)</div>
          <div style={{ fontSize: 12, color: C.mute }}>Valor em estoque: <span style={{ color: C.cyan }}>{brl(valorTotal)}</span></div>
        </div>
        <button onClick={() => setModal("novo")} style={btn(C.heat)}>+ Adicionar</button>
      </div>

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
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setModal(f)} style={{ background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 15 }}>✏</button>
                  <button onClick={() => excluir(f.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 15 }}>✕</button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: C.ink, marginTop: 8 }}>
                {f.pesoRestanteG}g de {f.pesoTotalG}g <span style={{ color: C.mute }}>({pct}%)</span>
              </div>
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
function ProdutoModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item || { nome: "", qtd: 0, minimo: 2, observacao: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28, width: 360 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>{item ? "Editar produto" : "Novo produto"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Nome do produto</div>
            <input style={field} value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Vaso geométrico P" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Qtd em estoque</div>
              <input style={field} type="number" min="0" value={form.qtd} onChange={e => set("qtd", +e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Mínimo desejado</div>
              <input style={field} type="number" min="0" value={form.minimo} onChange={e => set("minimo", +e.target.value)} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Observação</div>
            <input style={field} value={form.observacao} onChange={e => set("observacao", e.target.value)} placeholder="Opcional" />
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

function SecaoProdutos() {
  const [lista, setLista] = useState(() => carregar("produtos", []));
  const [modal, setModal] = useState(null);

  const salvarLista = (nova) => { setLista(nova); salvar("produtos", nova); };
  const onSave = (item) => {
    salvarLista(lista.some(p => p.id === item.id) ? lista.map(p => p.id === item.id ? item : p) : [...lista, item]);
    setModal(null);
  };
  const ajustarQtd = (id, delta) => {
    const nova = lista.map(p => p.id === id ? { ...p, qtd: Math.max(0, p.qtd + delta) } : p);
    salvarLista(nova);
  };
  const excluir = (id) => salvarLista(lista.filter(p => p.id !== id));

  const totalPecas = lista.reduce((s, p) => s + p.qtd, 0);
  const alertas = lista.filter(p => p.qtd < p.minimo).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Produtos acabados · {totalPecas} peça(s)</div>
          {alertas > 0 && <div style={{ fontSize: 12, color: C.red }}>⚠ {alertas} produto(s) abaixo do mínimo</div>}
        </div>
        <button onClick={() => setModal("novo")} style={btn(C.heat)}>+ Adicionar</button>
      </div>

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
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setModal(p)} style={{ background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 15 }}>✏</button>
                <button onClick={() => excluir(p.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 15 }}>✕</button>
              </div>
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

function InsumoModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item || { nome: "", qtd: 0, unidade: "un", minimo: 10, observacao: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28, width: 360 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>{item ? "Editar insumo" : "Novo insumo"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Nome</div>
            <input style={field} value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Insertos M3, Tinta spray, Embalagem" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Quantidade</div>
              <input style={field} type="number" min="0" value={form.qtd} onChange={e => set("qtd", +e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Unidade</div>
              <select value={form.unidade} onChange={e => set("unidade", e.target.value)} style={field}>
                {UNIDADES.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Alerta de mínimo</div>
            <input style={field} type="number" min="0" value={form.minimo} onChange={e => set("minimo", +e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.mute, marginBottom: 5 }}>Observação</div>
            <input style={field} value={form.observacao} onChange={e => set("observacao", e.target.value)} placeholder="Opcional" />
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

function SecaoInsumos() {
  const [lista, setLista] = useState(() => carregar("insumos", []));
  const [modal, setModal] = useState(null);

  const salvarLista = (nova) => { setLista(nova); salvar("insumos", nova); };
  const onSave = (item) => {
    salvarLista(lista.some(i => i.id === item.id) ? lista.map(i => i.id === item.id ? item : i) : [...lista, item]);
    setModal(null);
  };
  const ajustarQtd = (id, delta) => {
    salvarLista(lista.map(i => i.id === id ? { ...i, qtd: Math.max(0, i.qtd + delta) } : i));
  };
  const excluir = (id) => salvarLista(lista.filter(i => i.id !== id));

  const alertas = lista.filter(i => i.qtd <= i.minimo).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Insumos · {lista.length} item(ns)</div>
          {alertas > 0 && <div style={{ fontSize: 12, color: C.red }}>⚠ {alertas} item(ns) com estoque baixo</div>}
        </div>
        <button onClick={() => setModal("novo")} style={btn(C.heat)}>+ Adicionar</button>
      </div>

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
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setModal(i)} style={{ background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 15 }}>✏</button>
                <button onClick={() => excluir(i.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 15 }}>✕</button>
              </div>
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
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.3 }}>Controle de Estoque</h1>
        <p style={{ color: C.mute, fontSize: 14, margin: "0 0 28px" }}>Filamentos, produtos prontos e insumos com alertas de reposição.</p>

        {/* abas */}
        <div style={{ display: "flex", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 11, padding: 4, gap: 4, marginBottom: 28, width: "fit-content" }}>
          {ABAS.map(a => {
            const on = aba === a.id;
            return (
              <button key={a.id} onClick={() => setAba(a.id)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: on ? 700 : 500, color: on ? "#1a0d05" : C.mute, background: on ? C.heat : "transparent", transition: "all .15s" }}>
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
