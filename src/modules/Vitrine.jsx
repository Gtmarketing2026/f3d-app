import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#0e1014", panel: "#15171e", line: "#2e3342", ink: "#eef1f6",
  mute: "#878fa3", heat: "#ff6a2b", heatDim: "#ff6a2b22", cyan: "#37d6c5", green: "#7bd88f",
};
const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Vitrine({ userId }) {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [carrinho, setCarrinho] = useState({}); // { prodId: qtd }
  const [nomeCliente, setNomeCliente] = useState("");
  const [pedidoEnviado, setPedidoEnviado] = useState(false);

  useEffect(() => {
    async function fetchCatalogo() {
      const { data, error } = await supabase
        .from("catalogo")
        .select("produtos")
        .eq("user_id", userId)
        .single();
      if (error || !data) { setErro("Vitrine não encontrada."); setCarregando(false); return; }
      setProdutos(data.produtos || []);
      setCarregando(false);
    }
    if (userId) fetchCatalogo();
    else { setErro("Link inválido."); setCarregando(false); }
  }, [userId]);

  const setQtd = (id, v) => setCarrinho(c => ({ ...c, [id]: Math.max(0, parseInt(v) || 0) }));

  const itensCarrinho = produtos
    .filter(p => carrinho[p.id] > 0)
    .map(p => {
      const qtd = carrinho[p.id];
      const faixa = (p.faixas || []).slice().sort((a, b) => b.qtd - a.qtd).find(f => qtd >= f.qtd);
      const preco = faixa ? faixa.preco : (p.precoVarejo || 0);
      return { ...p, qtd, preco, subtotal: preco * qtd };
    });

  const total = itensCarrinho.reduce((s, i) => s + i.subtotal, 0);

  const enviarPedido = () => {
    if (!nomeCliente.trim() || itensCarrinho.length === 0) return;
    const linhas = itensCarrinho.map(i => `• ${i.nome} x${i.qtd} = ${brl(i.subtotal)}`).join("\n");
    const msg = `Olá! Sou ${nomeCliente} e gostaria de fazer um pedido:\n\n${linhas}\n\nTotal: ${brl(total)}`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    setPedidoEnviado(true);
  };

  const inputStyle = {
    background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8,
    color: C.ink, padding: "8px 10px", fontSize: 14, outline: "none",
    width: "60px", textAlign: "center", boxSizing: "border-box",
  };

  if (carregando) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.mute }}>
      Carregando vitrine...
    </div>
  );

  if (erro) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.mute }}>
      {erro}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      {/* header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.line}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg, ${C.heat}, #ff9b5e)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>◳</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>F3D · Vitrine</div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 80px" }}>
        {produtos.length === 0 ? (
          <div style={{ textAlign: "center", color: C.mute, marginTop: 60 }}>Nenhum produto disponível ainda.</div>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 24px" }}>Produtos disponíveis</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 40 }}>
              {produtos.map(p => (
                <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
                  {p.imagem && (
                    <img src={p.imagem} alt={p.nome} style={{ width: "100%", height: 160, objectFit: "cover" }} />
                  )}
                  <div style={{ padding: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{p.nome}</div>
                    {p.descricao && <div style={{ fontSize: 12.5, color: C.mute, marginBottom: 10, lineHeight: 1.5 }}>{p.descricao}</div>}
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.heat, marginBottom: 8 }}>{brl(p.precoVarejo)}</div>
                    {(p.faixas || []).length > 0 && (
                      <div style={{ fontSize: 12, color: C.cyan, marginBottom: 10 }}>
                        {p.faixas.map(f => `${f.qtd}+ un → ${brl(f.preco)}`).join(" · ")}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <button onClick={() => setQtd(p.id, (carrinho[p.id] || 0) - 1)} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontSize: 18, cursor: "pointer" }}>−</button>
                      <input type="number" min="0" value={carrinho[p.id] || 0} onChange={e => setQtd(p.id, e.target.value)} style={inputStyle} />
                      <button onClick={() => setQtd(p.id, (carrinho[p.id] || 0) + 1)} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontSize: 18, cursor: "pointer" }}>+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* carrinho */}
            {itensCarrinho.length > 0 && (
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: C.heat, letterSpacing: 1, textTransform: "uppercase", margin: "0 0 16px" }}>Seu pedido</h2>
                {itensCarrinho.map(i => (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14 }}>
                    <span>{i.nome} <span style={{ color: C.mute }}>x{i.qtd}</span></span>
                    <span style={{ color: C.heat, fontWeight: 700 }}>{brl(i.subtotal)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 20px", fontSize: 18, fontWeight: 800 }}>
                  <span>Total</span>
                  <span style={{ color: C.heat }}>{brl(total)}</span>
                </div>

                {pedidoEnviado ? (
                  <div style={{ background: "#7bd88f18", border: `1px solid ${C.green}`, borderRadius: 10, padding: "14px 18px", fontSize: 14, color: C.green }}>
                    ✓ Pedido enviado via WhatsApp! Aguarde o retorno.
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <input
                      placeholder="Seu nome"
                      value={nomeCliente}
                      onChange={e => setNomeCliente(e.target.value)}
                      style={{ flex: 1, minWidth: 180, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, color: C.ink, padding: "12px 14px", fontSize: 14, outline: "none" }}
                    />
                    <button onClick={enviarPedido} disabled={!nomeCliente.trim()}
                      style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: nomeCliente.trim() ? C.heat : C.line, color: nomeCliente.trim() ? "#1a0d05" : C.mute, fontWeight: 700, fontSize: 14, cursor: nomeCliente.trim() ? "pointer" : "not-allowed" }}>
                      Enviar pedido via WhatsApp
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
