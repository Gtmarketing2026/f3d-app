import { useState } from "react";
import { MODULOS, ORDEM_MODULOS, PRECO_COMPLETO, somaIsolados } from "../lib/modulos";
import { useLicenca } from "../lib/LicencaContext";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#13151a", panel: "#1b1e26", line: "#2e3342", ink: "#eef1f6",
  mute: "#878fa3", heat: "#ff6a2b", heatDim: "#ff6a2b22", cyan: "#37d6c5", green: "#7bd88f",
};
const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function criarCobranca(plano, modulos, cpf) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-handler`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plano, modulos, cpf }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao criar cobrança");
  }
  return res.json();
}

export default function Planos() {
  const { licenca } = useLicenca();
  const [sel, setSel] = useState(new Set(licenca.modulos));
  const [carregando, setCarregando] = useState(null);
  const [erro, setErro] = useState("");
  const [aguardando, setAguardando] = useState(false);
  const [cpf, setCpf] = useState("");
  const [mostrarCpf, setMostrarCpf] = useState(false);
  const [pendente, setPendente] = useState(null); // { plano, modulos }

  const toggle = (id) => {
    const novo = new Set(sel);
    novo.has(id) ? novo.delete(id) : novo.add(id);
    setSel(novo);
  };

  const comprar = (plano, modulos) => {
    setPendente({ plano, modulos });
    setMostrarCpf(true);
    setErro("");
  };

  const confirmarCompra = async () => {
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length < 11) { setErro("CPF inválido."); return; }
    setErro("");
    setCarregando(pendente.plano);
    try {
      const { paymentUrl } = await criarCobranca(pendente.plano, pendente.modulos, cpfLimpo);
      window.open(paymentUrl, "_blank");
      setAguardando(true);
      setMostrarCpf(false);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(null);
    }
  };

  const totalSel = [...sel].reduce((s, id) => s + (MODULOS[id]?.precoIsolado || 0), 0);
  const temPlano = licenca.plano !== "nenhum";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", padding: "40px 20px 60px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, margin: 0, fontWeight: 800, letterSpacing: -0.4 }}>Planos & Módulos</h1>
        <p style={{ color: C.mute, fontSize: 14, margin: "6px 0 28px" }}>
          Compre o app completo ou apenas os módulos que você precisa. Você pode adicionar os demais depois.
        </p>

        {mostrarCpf && (
          <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28, width: 340 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Informe seu CPF</div>
              <p style={{ fontSize: 13, color: C.mute, marginBottom: 16 }}>Necessário para emitir a cobrança no Asaas.</p>
              <input
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#13151a", color: C.ink, fontSize: 14, boxSizing: "border-box" }}
                placeholder="000.000.000-00"
                value={cpf}
                onChange={e => setCpf(e.target.value)}
                maxLength={14}
              />
              {erro && <div style={{ fontSize: 12, color: "#ff6b6b", marginTop: 8 }}>{erro}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => { setMostrarCpf(false); setErro(""); }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.mute, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
                <button onClick={confirmarCompra} disabled={!!carregando} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: C.heat, color: "#1a0d05", cursor: "pointer", fontWeight: 700 }}>
                  {carregando ? "Aguarde..." : "Continuar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {aguardando && (
          <div style={{ background: "#37d6c518", border: `1px solid ${C.cyan}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 14, color: C.cyan }}>
            ✓ Pagamento aberto em nova aba. Após confirmar, seus módulos serão liberados automaticamente aqui.
            <button onClick={() => setAguardando(false)} style={{ marginLeft: 12, background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 12 }}>fechar</button>
          </div>
        )}

        {erro && (
          <div style={{ background: "#ff6b6b18", border: "1px solid #ff6b6b", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 14, color: "#ff6b6b" }}>
            {erro}
          </div>
        )}

        {/* pacote completo */}
        <div style={{ background: `linear-gradient(160deg, ${C.panel}, ${C.heatDim})`, border: `1px solid ${C.heat}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: C.heat, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Mais vendido</div>
              <div style={{ fontSize: 20, fontWeight: 800, margin: "4px 0" }}>App completo</div>
              <div style={{ fontSize: 13.5, color: C.mute, maxWidth: 440, lineHeight: 1.5 }}>
                Os quatro módulos integrados: precificação alimenta o catálogo, que alimenta orçamentos, que viram vendas no financeiro.
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: C.mute, textDecoration: "line-through" }}>{brl(somaIsolados())}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: C.heat, letterSpacing: -1 }}>{brl(PRECO_COMPLETO)}<span style={{ fontSize: 13, color: C.mute, fontWeight: 500 }}>/mês</span></div>
              {licenca.plano === "completo" ? (
                <div style={{ marginTop: 8, padding: "10px 20px", borderRadius: 10, background: C.green, color: "#0c1410", fontWeight: 700, fontSize: 14, display: "inline-block" }}>✓ Plano atual</div>
              ) : (
                <button onClick={() => comprar("completo", ORDEM_MODULOS)} disabled={!!carregando}
                  style={{ marginTop: 8, padding: "10px 20px", borderRadius: 10, border: "none", background: carregando === "completo" ? C.line : C.heat, color: carregando === "completo" ? C.mute : "#1a0d05", fontWeight: 700, fontSize: 14, cursor: carregando ? "not-allowed" : "pointer" }}>
                  {carregando === "completo" ? "Aguarde..." : "Assinar completo"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* módulos isolados */}
        <div style={{ fontSize: 13, color: C.mute, marginBottom: 12, letterSpacing: 0.3 }}>OU MONTE SEU PRÓPRIO PACOTE</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {ORDEM_MODULOS.map((id) => {
            const m = MODULOS[id];
            const on = sel.has(id);
            const ativo = licenca.modulos?.includes(id);
            return (
              <div key={id} onClick={() => !ativo && toggle(id)}
                style={{ background: C.panel, border: `1px solid ${ativo ? C.green : on ? C.cyan : C.line}`, borderRadius: 14, padding: 18, cursor: ativo ? "default" : "pointer", transition: "border .15s", position: "relative" }}>
                {ativo && <div style={{ position: "absolute", top: 12, right: 12, fontSize: 11, color: C.green, fontWeight: 700 }}>✓ ATIVO</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 24 }}>{m.icone}</span>
                  {!ativo && (
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? C.cyan : C.line}`, background: on ? C.cyan : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c1410", fontSize: 14, fontWeight: 800 }}>
                      {on ? "✓" : ""}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{m.nome}</div>
                <div style={{ fontSize: 12.5, color: C.mute, margin: "6px 0 12px", lineHeight: 1.45, minHeight: 70 }}>{m.descricao}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.heat }}>{brl(m.precoIsolado)}<span style={{ fontSize: 12, color: C.mute, fontWeight: 500 }}>/mês</span></div>
              </div>
            );
          })}
        </div>

        {/* resumo seleção isolada */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 20, padding: 18, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14 }}>
          <div style={{ fontSize: 13.5, color: C.mute }}>
            {sel.size === 0 ? "Selecione ao menos um módulo." : `${sel.size} módulo(s) selecionado(s)`}
            {sel.size >= ORDEM_MODULOS.length && <span style={{ color: C.cyan }}> · vale mais a pena o pacote completo!</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.heat }}>{brl(totalSel)}<span style={{ fontSize: 12, color: C.mute, fontWeight: 500 }}>/mês</span></span>
            <button onClick={() => comprar("isolado", [...sel])} disabled={sel.size === 0 || !!carregando}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14, cursor: sel.size && !carregando ? "pointer" : "not-allowed", background: sel.size ? C.cyan : C.line, color: sel.size ? "#0c1410" : C.mute }}>
              {carregando === "isolado" ? "Aguarde..." : "Assinar seleção"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
