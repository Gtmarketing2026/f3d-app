import { useState, useEffect } from "react";
import { MODULOS, ORDEM_MODULOS } from "./lib/modulos";
import { useLicenca, LicencaProvider } from "./lib/LicencaContext";
import { ConfigProvider, useConfig } from "./lib/ConfigContext";
import { supabase } from "./lib/supabase";
import Calculadora from "./modules/Calculadora";
import Catalogo from "./modules/Catalogo";
import Orcamentos from "./modules/Orcamentos";
import Financeiro from "./modules/Financeiro";
import Estoque from "./modules/Estoque";
import Planos from "./modules/Planos";
import Login from "./modules/Login";
import Vitrine from "./modules/Vitrine";
import Configuracoes from "./modules/Configuracoes";

const C = {
  bg: "#0e1014", barra: "#15171e", line: "#2e3342", ink: "#eef1f6",
  mute: "#878fa3", heat: "#ff6a2b", heatDim: "#ff6a2b22", cyan: "#37d6c5",
};

const COMPONENTES = {
  calculadora: Calculadora,
  catalogo: Catalogo,
  orcamentos: Orcamentos,
  financeiro: Financeiro,
  estoque: Estoque,
};

const ATIVO_DEFAULT = "configuracoes";

function AppInner() {
  const { licenca, tem } = useLicenca();
  const { config } = useConfig();
  const primeiro = ORDEM_MODULOS.find((id) => tem(id)) || "planos";
  const [ativo, setAtivo] = useState(primeiro);

  const corAtiva = config.cor_primaria || C.heat;
  const corAtivaDim = corAtiva + "22";

  const Conteudo = ativo === "planos" ? Planos : ativo === "configuracoes" ? Configuracoes : COMPONENTES[ativo];
  const podeVer = ativo === "planos" || ativo === "configuracoes" || tem(ativo);

  const sair = async () => { await supabase.auth.signOut(); };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <nav style={{ width: 220, background: C.barra, borderRight: `1px solid ${C.line}`, padding: "20px 14px", flexShrink: 0, position: "sticky", top: 0, height: "100vh", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
        {/* Logo / nome da empresa */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 6px 22px" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: config.logo_base64 ? "transparent" : `linear-gradient(135deg, ${corAtiva}, ${corAtiva}99)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, overflow: "hidden", flexShrink: 0 }}>
            {config.logo_base64
              ? <img src={config.logo_base64} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : "◳"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, letterSpacing: -0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {config.nome_empresa || "F3D"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {ORDEM_MODULOS.map((id) => {
            const m = MODULOS[id];
            const comprado = tem(id);
            const on = ativo === id;
            return (
              <button key={id} onClick={() => setAtivo(id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left",
                  background: on ? corAtivaDim : "transparent",
                  color: on ? corAtiva : comprado ? C.ink : C.mute,
                  fontSize: 13.5, fontWeight: on ? 700 : 500, opacity: comprado ? 1 : 0.55 }}>
                <span style={{ fontSize: 16 }}>{m.icone}</span>
                <span style={{ flex: 1 }}>{m.nome}</span>
                {!comprado && <span style={{ fontSize: 10, color: C.mute, border: `1px solid ${C.line}`, borderRadius: 5, padding: "1px 5px" }}>🔒</span>}
              </button>
            );
          })}
        </div>

        {/* Configurações */}
        <button onClick={() => setAtivo("configuracoes")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9,
            border: `1px solid ${ativo === "configuracoes" ? corAtiva : C.line}`, cursor: "pointer", textAlign: "left",
            background: ativo === "configuracoes" ? corAtivaDim : "transparent",
            color: ativo === "configuracoes" ? corAtiva : C.ink, fontSize: 13.5, fontWeight: 600, marginTop: 8 }}>
          <span style={{ fontSize: 16 }}>⚙️</span>
          <span>Configurações</span>
        </button>

        {/* Planos */}
        <button onClick={() => setAtivo("planos")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: `1px solid ${ativo === "planos" ? corAtiva : C.line}`, cursor: "pointer", textAlign: "left",
            background: ativo === "planos" ? corAtivaDim : "transparent", color: ativo === "planos" ? corAtiva : C.ink, fontSize: 13.5, fontWeight: 600, marginTop: 6 }}>
          <span style={{ fontSize: 16 }}>💎</span>
          <span>Planos</span>
        </button>

        <div style={{ fontSize: 11, color: C.mute, padding: "10px 6px 4px" }}>
          Plano: <strong style={{ color: C.cyan }}>{licenca.plano === "completo" ? "Completo" : licenca.plano === "nenhum" ? "Sem plano" : "Personalizado"}</strong>
        </div>
        <button onClick={sair}
          style={{ marginTop: 6, padding: "8px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.mute, fontSize: 12.5, cursor: "pointer", textAlign: "left" }}>
          Sair
        </button>
      </nav>
      <main style={{ flex: 1, minWidth: 0 }}>
        {podeVer ? <Conteudo /> : <BloqueioUpsell id={ativo} onPlanos={() => setAtivo("planos")} />}
      </main>
    </div>
  );
}

function BloqueioUpsell({ id, onPlanos }) {
  const m = MODULOS[id];
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>{m.icone}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#eef1f6", marginBottom: 8 }}>Módulo {m.nome} bloqueado</div>
        <p style={{ fontSize: 14, color: "#878fa3", lineHeight: 1.6, marginBottom: 22 }}>{m.descricao}</p>
        <button onClick={onPlanos}
          style={{ padding: "12px 24px", borderRadius: 11, border: "none", background: "#ff6a2b", color: "#1a0d05", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}>
          Desbloquear este módulo
        </button>
      </div>
    </div>
  );
}

export default function App() {
  // Rota pública da vitrine: ?vitrine=USER_ID
  const params = new URLSearchParams(window.location.search);
  const vitrineId = params.get("vitrine");
  if (vitrineId) return <Vitrine userId={vitrineId} />;

  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "#0e1014", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #ff6a2b, #ff9b5e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>◳</div>
      </div>
    );
  }

  if (!session) return <Login />;

  return (
    <LicencaProvider>
      <ConfigProvider>
        <AppInner />
      </ConfigProvider>
    </LicencaProvider>
  );
}
