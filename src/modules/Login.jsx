import { useState } from "react";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#0e1014", panel: "#15171e", line: "#2e3342", ink: "#eef1f6",
  mute: "#878fa3", heat: "#ff6a2b", heatDim: "#ff6a2b22", cyan: "#37d6c5",
};

export default function Login() {
  const [aba, setAba] = useState("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setErro(""); setMsg("");
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    setCarregando(false);
  };

  const cadastrar = async (e) => {
    e.preventDefault();
    setErro(""); setMsg("");
    setCarregando(true);
    const { error } = await supabase.auth.signUp({ email, password: senha });
    if (error) setErro(error.message);
    else setMsg("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
    setCarregando(false);
  };

  const inputStyle = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: `1px solid ${C.line}`, background: "#1b1e26",
    color: C.ink, fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  const btnStyle = (ativo) => ({
    flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
    cursor: "pointer", fontWeight: 700, fontSize: 13.5,
    background: ativo ? C.heat : "transparent",
    color: ativo ? "#1a0d05" : C.mute,
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, justifyContent: "center" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${C.heat}, #ff9b5e)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>◳</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, letterSpacing: -0.3 }}>F3D</div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28 }}>
          <div style={{ display: "flex", gap: 6, background: "#0e1014", borderRadius: 10, padding: 4, marginBottom: 24 }}>
            <button style={btnStyle(aba === "entrar")} onClick={() => { setAba("entrar"); setErro(""); setMsg(""); }}>Entrar</button>
            <button style={btnStyle(aba === "cadastrar")} onClick={() => { setAba("cadastrar"); setErro(""); setMsg(""); }}>Criar conta</button>
          </div>

          <form onSubmit={aba === "entrar" ? entrar : cadastrar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, color: C.mute, display: "block", marginBottom: 6 }}>E-mail</label>
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: C.mute, display: "block", marginBottom: 6 }}>Senha</label>
              <input style={inputStyle} type="password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="••••••••" minLength={6} />
            </div>

            {erro && <div style={{ fontSize: 13, color: "#ff6b6b", background: "#ff6b6b18", border: "1px solid #ff6b6b33", borderRadius: 8, padding: "10px 14px" }}>{erro}</div>}
            {msg && <div style={{ fontSize: 13, color: C.cyan, background: "#37d6c518", border: `1px solid ${C.cyan}33`, borderRadius: 8, padding: "10px 14px" }}>{msg}</div>}

            <button type="submit" disabled={carregando}
              style={{ marginTop: 4, padding: "12px 0", borderRadius: 11, border: "none", background: carregando ? C.line : C.heat, color: carregando ? C.mute : "#1a0d05", fontWeight: 700, fontSize: 15, cursor: carregando ? "not-allowed" : "pointer" }}>
              {carregando ? "Aguarde..." : aba === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
