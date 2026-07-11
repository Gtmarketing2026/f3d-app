import { useState, useRef } from "react";
import { useConfig } from "../lib/ConfigContext";

const C = {
  bg: "#0e1014", card: "#15171e", line: "#2e3342", ink: "#eef1f6",
  mute: "#878fa3", heat: "#ff6a2b", cyan: "#37d6c5", green: "#22c55e",
};

export default function Configuracoes() {
  const { config, salvarConfig } = useConfig();
  const [nome, setNome] = useState(config.nome_empresa || "");
  const [cor, setCor] = useState(config.cor_primaria || "#ff6a2b");
  const [logo, setLogo] = useState(config.logo_base64 || null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const inputRef = useRef(null);

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert("Logo muito grande. Máximo: 500KB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setLogo(ev.target.result);
    reader.readAsDataURL(file);
  };

  const salvar = async () => {
    setSalvando(true);
    await salvarConfig({ nome_empresa: nome.trim(), cor_primaria: cor, logo_base64: logo });
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "36px 28px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ color: C.ink, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Configurações</h1>
        <p style={{ color: C.mute, fontSize: 13.5, marginBottom: 32 }}>Identidade visual do seu negócio</p>

        {/* Logo */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}>Logo</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div onClick={() => inputRef.current?.click()}
              style={{ width: 80, height: 80, borderRadius: 14, border: `2px dashed ${C.line}`, background: "#1a1d27",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}>
              {logo
                ? <img src={logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <span style={{ fontSize: 28, opacity: 0.4 }}>🖼️</span>}
            </div>
            <div>
              <button onClick={() => inputRef.current?.click()}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontSize: 13, cursor: "pointer", marginRight: 10 }}>
                Escolher imagem
              </button>
              {logo && (
                <button onClick={() => setLogo(null)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.mute, fontSize: 13, cursor: "pointer" }}>
                  Remover
                </button>
              )}
              <div style={{ fontSize: 12, color: C.mute, marginTop: 8 }}>PNG, JPG ou SVG. Máximo 500KB.</div>
            </div>
          </div>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogo} />
        </div>

        {/* Nome */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}>Nome da empresa</div>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Forja 3D"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#1a1d27",
              color: C.ink, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Cor primária */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24, marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}>Cor principal</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)}
              style={{ width: 52, height: 52, borderRadius: 10, border: `1px solid ${C.line}`, background: "none", cursor: "pointer", padding: 2 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: cor }}>{cor.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>Aparece na nav e nos destaques</div>
            </div>
            {/* Presets */}
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              {["#ff6a2b", "#6366f1", "#22c55e", "#0ea5e9", "#ec4899", "#f59e0b"].map(c => (
                <div key={c} onClick={() => setCor(c)}
                  style={{ width: 28, height: 28, borderRadius: 7, background: c, cursor: "pointer",
                    border: cor === c ? `2px solid ${C.ink}` : "2px solid transparent" }} />
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}>Preview da nav</div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 10px", background: "#0e1014", borderRadius: 10, width: "fit-content" }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: logo ? "transparent" : `linear-gradient(135deg, ${cor}, ${cor}99)`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, overflow: "hidden" }}>
              {logo ? <img src={logo} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : "◳"}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, letterSpacing: -0.3 }}>
              {nome.trim() || "Minha Empresa"}
            </div>
          </div>
        </div>

        <button onClick={salvar} disabled={salvando}
          style={{ padding: "12px 28px", borderRadius: 11, border: "none", background: salvo ? C.green : cor,
            color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer", transition: "background 0.3s" }}>
          {salvando ? "Salvando..." : salvo ? "✓ Salvo!" : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}
