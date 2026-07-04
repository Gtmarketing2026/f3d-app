import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#0e1014", panel: "#15171e", line: "#2e3342", ink: "#eef1f6",
  mute: "#878fa3", heat: "#ff6a2b", heatDim: "#ff6a2b22", cyan: "#37d6c5", green: "#7bd88f",
};
const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Vitrine({ userId }) {
  const params = new URLSearchParams(window.location.search);
  const waNumber = params.get("wa") || "";

  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [carrinho, setCarrinho] = useState({});
  const [nomeCliente, setNomeCliente] = useState("");
  const [obsCliente, setObsCliente] = useState("");
  const [pedidoEnviado, setPedidoEnviado] = useState(false);
  const [imgAmpliada, setImgAmpliada] = useState(null);
  const [busca, setBusca] = useState("");
  const [catAtiva, setCatAtiva] = useState("todos");
  const [subcatAtiva, setSubcatAtiva] = useState("todos");

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

  // fecha lightbox com Esc
  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") setImgAmpliada(null); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // categorias ordenadas por qtd de produtos (mais populares primeiro)
  const categorias = Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean)));
  const catOrdenadas = [...categorias].sort((a, b) =>
    produtos.filter(p => p.categoria === b).length - produtos.filter(p => p.categoria === a).length
  );
  const catTop3 = catOrdenadas.slice(0, 3);
  const catResto = catOrdenadas.slice(3);

  const subcategorias = catAtiva === "todos" ? [] :
    Array.from(new Set(produtos.filter(p => p.categoria === catAtiva).map(p => p.subcategoria).filter(Boolean)));

  const produtosFiltrados = produtos.filter(p => {
    const termoBusca = busca.toLowerCase();
    const bateCategoria = catAtiva === "todos" || p.categoria === catAtiva;
    const bateSubcat = subcatAtiva === "todos" || !subcatAtiva || p.subcategoria === subcatAtiva;
    const bateBusca = !termoBusca ||
      p.nome?.toLowerCase().includes(termoBusca) ||
      p.descricao?.toLowerCase().includes(termoBusca) ||
      p.categoria?.toLowerCase().includes(termoBusca) ||
      p.subcategoria?.toLowerCase().includes(termoBusca);
    return bateCategoria && bateSubcat && bateBusca;
  });

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

  const enviarPedido = async () => {
    if (!nomeCliente.trim() || itensCarrinho.length === 0) return;
    const linhas = itensCarrinho.map(i => `• ${i.nome} x${i.qtd} = ${brl(i.subtotal)}`).join("\n");
    const obs = obsCliente.trim() ? `\n\nObservação: ${obsCliente.trim()}` : "";
    const msg = `Olá! Sou ${nomeCliente} e gostaria de fazer um pedido:\n\n${linhas}\n\nTotal: ${brl(total)}${obs}`;
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
    // salva pedido no Supabase para aparecer em Orçamentos
    try {
      await supabase.from("pedidos_vitrine").insert({
        user_id: userId,
        cliente: nomeCliente.trim(),
        obs: obsCliente.trim() || null,
        itens: itensCarrinho.map(i => ({ nome: i.nome, qtd: i.qtd, preco: i.preco, subtotal: i.subtotal })),
        total,
      });
    } catch (e) {}
    window.open(url, "_blank");
    setPedidoEnviado(true);
  };

  const refazerPedido = () => {
    setCarrinho({});
    setNomeCliente("");
    setObsCliente("");
    setPedidoEnviado(false);
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

      {/* lightbox */}
      {imgAmpliada && (
        <div
          onClick={() => setImgAmpliada(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 2000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            cursor: "zoom-out",
          }}
        >
          <img
            src={imgAmpliada}
            alt=""
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain", boxShadow: "0 8px 60px rgba(0,0,0,0.7)" }}
          />
          <button
            onClick={() => setImgAmpliada(null)}
            style={{ position: "absolute", top: 20, right: 24, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", fontSize: 26, borderRadius: 8, width: 40, height: 40, cursor: "pointer", lineHeight: 1 }}
          >×</button>
        </div>
      )}

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
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 20px" }}>Produtos disponíveis</h1>

            {/* busca + filtro */}
            <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</span>
                <input
                  type="text"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar produto…"
                  style={{
                    width: "100%", boxSizing: "border-box", background: C.panel,
                    border: `1px solid ${C.line}`, borderRadius: 10, color: C.ink,
                    padding: "11px 14px 11px 40px", fontSize: 14, outline: "none",
                  }}
                />
                {busca && (
                  <button onClick={() => setBusca("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.mute, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
                )}
              </div>

              {/* filtro por categoria: top 3 como botões + restante em select */}
              {catOrdenadas.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {/* botão "Todos" */}
                  <button onClick={() => { setCatAtiva("todos"); setSubcatAtiva("todos"); }} style={{
                    padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: catAtiva === "todos" ? 700 : 500,
                    cursor: "pointer", border: `1px solid ${catAtiva === "todos" ? C.heat : C.line}`,
                    background: catAtiva === "todos" ? C.heatDim : "transparent",
                    color: catAtiva === "todos" ? C.heat : C.mute,
                  }}>Todos</button>

                  {/* top 3 como botões */}
                  {catTop3.map(cat => {
                    const on = catAtiva === cat;
                    return (
                      <button key={cat} onClick={() => { setCatAtiva(cat); setSubcatAtiva("todos"); }} style={{
                        padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: on ? 700 : 500,
                        cursor: "pointer", border: `1px solid ${on ? C.heat : C.line}`,
                        background: on ? C.heatDim : "transparent",
                        color: on ? C.heat : C.mute,
                      }}>{cat}</button>
                    );
                  })}

                  {/* restante em select */}
                  {catResto.length > 0 && (
                    <select
                      value={catResto.includes(catAtiva) ? catAtiva : ""}
                      onChange={e => { if (e.target.value) { setCatAtiva(e.target.value); setSubcatAtiva("todos"); } }}
                      style={{
                        background: catResto.includes(catAtiva) ? C.heatDim : C.panel,
                        border: `1px solid ${catResto.includes(catAtiva) ? C.heat : C.line}`,
                        borderRadius: 20, color: catResto.includes(catAtiva) ? C.heat : C.mute,
                        padding: "7px 14px", fontSize: 13, cursor: "pointer", outline: "none",
                      }}
                    >
                      <option value="">Mais categorias…</option>
                      {catResto.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* subcategoria em select */}
              {subcategorias.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: C.mute, flexShrink: 0 }}>Subcategoria:</span>
                  <select
                    value={subcatAtiva}
                    onChange={e => setSubcatAtiva(e.target.value)}
                    style={{
                      background: subcatAtiva !== "todos" ? "#37d6c522" : C.panel,
                      border: `1px solid ${subcatAtiva !== "todos" ? C.cyan : C.line}`,
                      borderRadius: 20, color: subcatAtiva !== "todos" ? C.cyan : C.mute,
                      padding: "7px 14px", fontSize: 13, cursor: "pointer", outline: "none",
                    }}
                  >
                    <option value="todos">Todas</option>
                    {subcategorias.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                </div>
              )}
            </div>

            {produtosFiltrados.length === 0 && (
              <div style={{ textAlign: "center", color: C.mute, padding: "40px 0", fontSize: 14 }}>
                Nenhum produto encontrado para "<strong>{busca}</strong>".
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 40 }}>
              {produtosFiltrados.map(p => (
                <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
                  {/* imagem quadrada feed */}
                  {p.imagem ? (
                    <div
                      onClick={() => setImgAmpliada(p.imagem)}
                      style={{ width: "100%", paddingBottom: "100%", position: "relative", cursor: "zoom-in", overflow: "hidden" }}
                    >
                      <img
                        src={p.imagem}
                        alt={p.nome}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <div style={{
                        position: "absolute", inset: 0, background: "rgba(0,0,0,0)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "background 0.15s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.25)"}
                        onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0)"}
                      >
                        <span style={{ color: "#fff", fontSize: 22, opacity: 0, transition: "opacity 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => e.currentTarget.style.opacity = 0}
                        >🔍</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ width: "100%", paddingBottom: "100%", position: "relative", background: C.line }}>
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.mute, fontSize: 32 }}>◳</div>
                    </div>
                  )}

                  <div style={{ padding: 14 }}>
                    {(p.categoria || p.subcategoria) && (
                      <div style={{ fontSize: 11, color: C.cyan, marginBottom: 5, display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {p.categoria && <span style={{ background: "#37d6c518", borderRadius: 10, padding: "2px 8px" }}>{p.categoria}</span>}
                        {p.subcategoria && <span style={{ background: "#37d6c510", borderRadius: 10, padding: "2px 8px", opacity: 0.8 }}>{p.subcategoria}</span>}
                      </div>
                    )}
                    <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>{p.nome}</div>
                    {p.descricao && <div style={{ fontSize: 12, color: C.mute, marginBottom: 8, lineHeight: 1.5 }}>{p.descricao}</div>}
                    <div style={{ fontSize: 17, fontWeight: 800, color: C.heat, marginBottom: 6 }}>{brl(p.precoVarejo)}</div>
                    {(p.faixas || []).length > 0 && (
                      <div style={{ fontSize: 11.5, color: C.cyan, marginBottom: 8 }}>
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
                  <div>
                    <div style={{ background: "#7bd88f18", border: `1px solid ${C.green}`, borderRadius: 10, padding: "14px 18px", fontSize: 14, color: C.green, marginBottom: 14 }}>
                      ✓ Pedido enviado via WhatsApp! Aguarde o retorno.
                    </div>
                    <button onClick={refazerPedido}
                      style={{ padding: "11px 22px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                      ↺ Fazer novo pedido
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <input
                      placeholder="Seu nome"
                      value={nomeCliente}
                      onChange={e => setNomeCliente(e.target.value)}
                      style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, color: C.ink, padding: "12px 14px", fontSize: 14, outline: "none" }}
                    />
                    <textarea
                      placeholder="Observações (cor, tamanho, prazo, endereço…)"
                      value={obsCliente}
                      onChange={e => setObsCliente(e.target.value)}
                      rows={3}
                      style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, color: C.ink, padding: "12px 14px", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                    />
                    <button onClick={enviarPedido} disabled={!nomeCliente.trim()}
                      style={{ padding: "13px 24px", borderRadius: 10, border: "none", background: nomeCliente.trim() ? C.heat : C.line, color: nomeCliente.trim() ? "#1a0d05" : C.mute, fontWeight: 700, fontSize: 14, cursor: nomeCliente.trim() ? "pointer" : "not-allowed" }}>
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
