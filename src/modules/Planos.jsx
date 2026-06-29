import { useState } from "react";
import { MODULOS, ORDEM_MODULOS } from "../lib/modulos";
import { useLicenca } from "../lib/LicencaContext";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#13151a", panel: "#1b1e26", line: "#2e3342", ink: "#eef1f6",
  mute: "#878fa3", heat: "#ff6a2b", heatDim: "#ff6a2b22", cyan: "#37d6c5",
  green: "#7bd88f", amber: "#f4c14b",
};
const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function criarCobranca(payload) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-handler`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao criar cobrança");
  }
  return res.json();
}

// Descrição de preço formatada por módulo
function PrecoBadge({ m }) {
  if (m.precoMensal) {
    return (
      <div>
        <span style={{ fontSize: 22, fontWeight: 800, color: C.heat }}>{brl(m.precoMensal)}</span>
        <span style={{ fontSize: 12, color: C.mute, fontWeight: 500 }}>/mês</span>
      </div>
    );
  }
  return (
    <div>
      <span style={{ fontSize: 22, fontWeight: 800, color: C.heat }}>{brl(m.precoUnico)}</span>
      <span style={{ fontSize: 12, color: C.mute, fontWeight: 500 }}> único</span>
      {m.precoAtualizacao && (
        <div style={{ fontSize: 12, color: C.amber, marginTop: 2 }}>
          + {brl(m.precoAtualizacao)}/mês atualizações (opcional)
        </div>
      )}
    </div>
  );
}

export default function Planos() {
  const { licenca } = useLicenca();
  const [carregando, setCarregando] = useState(null);
  const [erro, setErro] = useState("");
  const [aguardando, setAguardando] = useState(false);
  const [cpf, setCpf] = useState("");
  const [mostrarCpf, setMostrarCpf] = useState(false);
  const [pendente, setPendente] = useState(null);
  // quais módulos com precoAtualizacao o usuário quer adicionar a assinatura de atualização
  const [comAtualizacao, setComAtualizacao] = useState({});

  const comprar = (modId, tipo) => {
    setPendente({ modId, tipo });
    setMostrarCpf(true);
    setErro("");
  };

  const confirmarCompra = async () => {
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length < 11) { setErro("CPF inválido."); return; }
    setErro("");
    setCarregando(`${pendente.modId}-${pendente.tipo}`);
    try {
      const m = MODULOS[pendente.modId];
      const valor = pendente.tipo === "atualizacao"
        ? m.precoAtualizacao
        : pendente.tipo === "mensal"
          ? m.precoMensal
          : m.precoUnico;

      const { paymentUrl } = await criarCobranca({
        plano: "isolado",
        modulos: [pendente.modId],
        cpf: cpfLimpo,
        tipo: pendente.tipo,  // "unico" | "mensal" | "atualizacao"
        valor,
      });
      window.open(paymentUrl, "_blank");
      setAguardando(true);
      setMostrarCpf(false);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", padding: "40px 20px 60px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, margin: 0, fontWeight: 800, letterSpacing: -0.4 }}>Planos & Módulos</h1>
        <p style={{ color: C.mute, fontSize: 14, margin: "6px 0 32px" }}>
          Compre apenas o que precisar. Módulos únicos são seus para sempre — sem mensalidade obrigatória.
        </p>

        {/* Modal CPF */}
        {mostrarCpf && (
          <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28, width: 340 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Informe seu CPF</div>
              <p style={{ fontSize: 13, color: C.mute, marginBottom: 16 }}>Necessário para emitir a cobrança.</p>
              <input
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: C.bg, color: C.ink, fontSize: 14, boxSizing: "border-box", outline: "none" }}
                placeholder="000.000.000-00"
                value={cpf}
                onChange={e => setCpf(e.target.value)}
                maxLength={14}
              />
              {erro && <div style={{ fontSize: 12, color: "#ff6b6b", marginTop: 8 }}>{erro}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => { setMostrarCpf(false); setErro(""); }}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.mute, cursor: "pointer", fontWeight: 600 }}>
                  Cancelar
                </button>
                <button onClick={confirmarCompra} disabled={!!carregando}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: C.heat, color: "#1a0d05", cursor: "pointer", fontWeight: 700 }}>
                  {carregando ? "Aguarde..." : "Continuar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {aguardando && (
          <div style={{ background: "#37d6c518", border: `1px solid ${C.cyan}`, borderRadius: 12, padding: "14px 18px", marginBottom: 24, fontSize: 14, color: C.cyan }}>
            ✓ Pagamento aberto em nova aba. Após confirmar, seus módulos serão liberados automaticamente.
            <button onClick={() => setAguardando(false)} style={{ marginLeft: 12, background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 12 }}>fechar</button>
          </div>
        )}

        {/* Cards dos módulos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {ORDEM_MODULOS.map((id) => {
            const m = MODULOS[id];
            const ativo = licenca.modulos?.includes(id);
            const chaveUnico = `${id}-unico`;
            const chaveMensal = `${id}-mensal`;
            const chaveAtual = `${id}-atualizacao`;

            return (
              <div key={id} style={{ background: C.panel, border: `1px solid ${ativo ? C.green : C.line}`, borderRadius: 16, padding: 24, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
                {/* ícone + info */}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 28 }}>{m.icone}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{m.nome}</div>
                      {ativo && <div style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>✓ ATIVO</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: C.mute, lineHeight: 1.55 }}>{m.descricao}</div>
                </div>

                {/* preço + botão */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 200 }}>
                  <PrecoBadge m={m} />

                  {ativo ? (
                    <div style={{ padding: "9px 18px", borderRadius: 10, background: "#7bd88f22", color: C.green, fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                      ✓ Módulo ativo
                    </div>
                  ) : (
                    <>
                      {/* módulo de compra única */}
                      {m.precoUnico && (
                        <button
                          onClick={() => comprar(id, "unico")}
                          disabled={!!carregando}
                          style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: carregando === chaveUnico ? C.line : C.heat, color: carregando === chaveUnico ? C.mute : "#1a0d05", fontWeight: 700, fontSize: 13, cursor: carregando ? "not-allowed" : "pointer" }}>
                          {carregando === chaveUnico ? "Aguarde..." : `Comprar por ${brl(m.precoUnico)}`}
                        </button>
                      )}

                      {/* módulo mensalidade obrigatória */}
                      {m.precoMensal && (
                        <button
                          onClick={() => comprar(id, "mensal")}
                          disabled={!!carregando}
                          style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: carregando === chaveMensal ? C.line : C.heat, color: carregando === chaveMensal ? C.mute : "#1a0d05", fontWeight: 700, fontSize: 13, cursor: carregando ? "not-allowed" : "pointer" }}>
                          {carregando === chaveMensal ? "Aguarde..." : `Assinar ${brl(m.precoMensal)}/mês`}
                        </button>
                      )}
                    </>
                  )}

                  {/* opção de assinatura de atualizações (opcional) */}
                  {m.precoAtualizacao && (
                    <div style={{ background: "#f4c14b12", border: `1px solid #f4c14b44`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 4 }}>⚡ Atualizações contínuas</div>
                      <div style={{ fontSize: 12, color: C.mute, marginBottom: 10, lineHeight: 1.4 }}>
                        Receba todas as novas funcionalidades que implementarmos neste módulo.
                      </div>
                      <button
                        onClick={() => comprar(id, "atualizacao")}
                        disabled={!!carregando}
                        style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: `1px solid ${C.amber}`, background: "transparent", color: C.amber, fontWeight: 700, fontSize: 12, cursor: carregando ? "not-allowed" : "pointer" }}>
                        {carregando === chaveAtual ? "Aguarde..." : `+ ${brl(m.precoAtualizacao)}/mês`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 12, color: C.mute, marginTop: 28, textAlign: "center" }}>
          Pagamentos via PIX ou boleto · Processado com segurança pelo Asaas
        </p>
      </div>
    </div>
  );
}
