import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#13151a", panel: "#1b1e26", panel2: "#222631", line: "#2e3342",
  ink: "#eef1f6", mute: "#878fa3", heat: "#ff6a2b", heatDim: "#ff6a2b22",
  cyan: "#37d6c5", green: "#7bd88f", red: "#ff5d6c", amber: "#f4c14b",
};

const brl = (n) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const addDias = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const fmtData = (d) => (d ? d.split("-").reverse().join("/") : "");

const field = {
  width: "100%", background: C.bg, border: `1px solid ${C.line}`,
  borderRadius: 8, color: C.ink, padding: "10px 12px", fontSize: 14,
  fontVariantNumeric: "tabular-nums", outline: "none", boxSizing: "border-box",
};
const label = { display: "block", fontSize: 12, letterSpacing: 0.3, color: C.mute, marginBottom: 6 };
const panel = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 22 };
const heading = { fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: C.heat, margin: "0 0 18px", fontWeight: 700 };

// ── Canais de venda com taxas ──────────────────────────────────
// taxa: % sobre o preço de venda; taxaFixa: R$ por pedido/venda
export const CANAIS_VENDA = [
  { id: "vitrine",       nome: "Venda Direta / Vitrine", taxa: 0,     taxaFixa: 0    },
  { id: "instagram",    nome: "Instagram / WhatsApp",   taxa: 0,     taxaFixa: 0    },
  { id: "tiktok",       nome: "TikTok Shop",            taxa: 0.06,  taxaFixa: 4    },
  { id: "elo7",          nome: "Elo7",                  taxa: 0.14,  taxaFixa: 0    },
  { id: "shopee",        nome: "Shopee",                taxa: 0.20,  taxaFixa: 4    },
  { id: "mercadolivre", nome: "Mercado Livre",          taxa: 0.16,  taxaFixa: 6    },
  { id: "americanas",   nome: "Americanas / B2W",       taxa: 0.16,  taxaFixa: 0    },
  { id: "magalu",       nome: "Magalu",                 taxa: 0.16,  taxaFixa: 0    },
  { id: "amazon",       nome: "Amazon",                 taxa: 0.15,  taxaFixa: 0    },
  { id: "etsy",         nome: "Etsy",                   taxa: 0.065, taxaFixa: 1.50 },
];

// precoLista: quanto cobrar no canal para receber o mesmo que na venda direta
// Fórmula: precoLista × (1 - taxa%) − taxaFixa = precoBase
// → precoLista = (precoBase + taxaFixa) / (1 - taxa%)
const precoParaCanal = (precoBase, custo, taxa, taxaFixa = 0) => {
  if (!precoBase) return null;
  const lista = taxa < 1 ? (precoBase + taxaFixa) / (1 - taxa) : precoBase;
  const liquido = lista * (1 - taxa) - taxaFixa; // ≈ precoBase
  const lucro = liquido - custo;
  const margem = liquido > 0 ? (lucro / liquido) * 100 : 0;
  return { lista, liquido, lucro, margem };
};

// ── Categorias e subcategorias ─────────────────────────────────
export const CATS = {
  "Chaveiros": ["Romântico", "Copa do Mundo", "Beleza & Estética", "Profissões", "Nomes & Letras", "Anime & Games", "Religiosos", "Datas Comemorativas", "Humor", "Infantil", "Personalizado"],
  "Quadros & Placas": ["Decorativo", "Família", "Frases & Motivacional", "Religioso", "Empresarial", "Mapa & Localização", "Personalizado"],
  "Utensílios": ["Cozinha", "Banheiro", "Escritório", "Jardim & Plantas", "Sala de Estar"],
  "Decoração": ["Vasos", "Luminárias", "Esculturas", "Miniaturas", "Temático (Natal, Páscoa…)", "Personalizado"],
  "Organização": ["Suporte de Celular", "Organizador de Gaveta", "Porta-Temperos", "Suporte de Cabos", "Caixas & Porta-Objetos"],
  "Brinquedos & Games": ["Miniaturas de RPG", "Peças de Tabuleiro", "Fidget & Anti-Estresse", "Educativos", "Infantil"],
  "Moda & Acessórios": ["Brincos", "Pulseiras", "Broches & Pins", "Tiaras & Presilhas", "Bolsas & Carteiras"],
  "Pets": ["Tags de Identificação", "Coleiras & Acessórios", "Comedouros & Bebedouros", "Brinquedos para Pet"],
  "Peças Técnicas": ["Suporte & Fixação", "Adaptador", "Reposição & Conserto", "Ferramentas"],
  "Personalizado": ["Sob Encomenda", "Corporativo", "Brinde", "Lembrança"],
};

// CSV helpers ---------------------------------------------------
function toCSV(rows) {
  const head = ["nome", "canal", "categoria", "subcategoria", "descricao", "custo", "precoVarejo", "faixas", "imagem"];
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const faixasStr = (p) => (p.faixas || []).map((f) => `${f.qtd}:${f.preco}`).join("|");
  const lines = [head.join(",")];
  rows.forEach((p) => lines.push(head.map((h) => esc(h === "faixas" ? faixasStr(p) : p[h])).join(",")));
  return lines.join("\n");
}
function parseCSV(text) {
  const rows = [];
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return rows;
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
  const split = (line) => {
    const out = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else {
        if (ch === '"') q = true;
        else if (ch === sep) { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const head = split(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name) => head.indexOf(name);
  const num = (v) => {
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };
  for (let i = 1; i < lines.length; i++) {
    const c = split(lines[i]);
    const nome = (c[idx("nome")] || "").trim();
    if (!nome) continue;
    const varejo = idx("precovarejo") >= 0 ? num(c[idx("precovarejo")]) : num(c[idx("preco")]);
    const custo = num(c[idx("custo")]);
    // faixas: "10:18|50:15|100:12"  ou legado precoatacado/qtdatacado
    let faixas = [];
    if (idx("faixas") >= 0 && c[idx("faixas")]) {
      faixas = String(c[idx("faixas")]).split("|").map((par, j) => {
        const [q, pr] = par.split(":");
        return { id: Date.now() + i * 10 + j, qtd: parseInt(q) || 0, preco: num(pr) };
      }).filter((f) => f.qtd > 0 && f.preco > 0);
    } else if (idx("precoatacado") >= 0 && num(c[idx("precoatacado")]) > 0) {
      faixas = [{ id: Date.now() + i, qtd: parseInt(c[idx("qtdatacado")]) || 0, preco: num(c[idx("precoatacado")]) }]
        .filter((f) => f.qtd > 0);
    }
    rows.push({
      id: Date.now() + i,
      nome,
      canal: (c[idx("canal")] || "Venda direta").trim(),
      descricao: (c[idx("descricao")] || "").trim(),
      imagem: (c[idx("imagem")] || "").trim(),
      custo,
      precoVarejo: varejo,
      faixas,
      preco: varejo,
      lucro: varejo - custo,
    });
  }
  return rows;
}
function baixar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Catalogo() {
  const [produtos, setProdutos] = useState([]);
  const [orcamentos, setOrcamentos] = useState([]);
  const [vista, setVista] = useState("gestao"); // gestao | vitrine
  const [docPedido, setDocPedido] = useState(null);

  // gestão: busca/filtros
  const [busca, setBusca] = useState("");
  const [fCanal, setFCanal] = useState("todos");
  const [fPreco, setFPreco] = useState("todos");
  // canal para cálculo de preços (independente do filtro de produto)
  const [canalPreco, setCanalPreco] = useState("direto"); // "direto" | id do canal
  const [modal, setModal] = useState(null); // produto sendo criado/editado no modal

  // vitrine: carrinho do cliente
  const [carrinho, setCarrinho] = useState({}); // {nome: qtd}
  const [nomeCliente, setNomeCliente] = useState("");
  const [contatoCliente, setContatoCliente] = useState("");
  const [userId, setUserId] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [whatsapp, setWhatsapp] = useState(() => localStorage.getItem("app3d:whatsapp") || "");

  useEffect(() => {
    let channel;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: cat } = await supabase.from("catalogo").select("produtos").eq("user_id", user.id).single();
        if (cat?.produtos) setProdutos(cat.produtos);
        channel = supabase.channel("cat-" + user.id)
          .on("postgres_changes", { event: "*", schema: "public", table: "catalogo", filter: `user_id=eq.${user.id}` },
            async () => {
              const { data } = await supabase.from("catalogo").select("produtos").eq("user_id", user.id).single();
              if (data?.produtos) setProdutos(data.produtos);
            })
          .subscribe();
      }
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const salvarWhatsapp = (val) => {
    const num = val.replace(/\D/g, "");
    setWhatsapp(num);
    localStorage.setItem("app3d:whatsapp", num);
  };

  const linkVitrine = `${window.location.origin}?vitrine=${userId}${whatsapp ? `&wa=${whatsapp}` : ""}`;
  const copiarLink = () => {
    navigator.clipboard.writeText(linkVitrine);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  };

  // vitrine: pedido personalizado (fora do catálogo)
  const [persoModal, setPersoModal] = useState(false);
  const [perso, setPerso] = useState({ titulo: "", descricao: "", qtd: 1, ref: "" });

  useEffect(() => {
    // migração única de localStorage → já carregado pelo useEffect do supabase acima
    // mas migramos produtos antigos do localStorage se o supabase vier vazio
    (async () => {
      // aguarda um tick para userId estar disponível via supabase.auth
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: existing } = await supabase.from("catalogo").select("produtos").eq("user_id", user.id).single();
        if (!existing?.produtos?.length) {
          try {
            const lsKey = Object.keys(localStorage).find(k => k.includes("catalogo"));
            const raw = lsKey ? localStorage.getItem(lsKey) : null;
            if (raw) {
              const arr = JSON.parse(raw).map((p) => {
                const base = { descricao: "", imagem: "", ...p, precoVarejo: p.precoVarejo ?? p.preco ?? 0 };
                if (!base.faixas) {
                  base.faixas = (p.precoAtacado > 0 && p.qtdAtacado > 0)
                    ? [{ id: 1, qtd: p.qtdAtacado, preco: p.precoAtacado }] : [];
                }
                delete base.precoAtacado; delete base.qtdAtacado;
                return base;
              });
              if (arr.length) {
                await supabase.from("catalogo").upsert({ user_id: user.id, produtos: arr });
                setProdutos(arr);
              }
            }
          } catch (e) {}
        }
      }, 500);
    })();
  }, []);

  // preço efetivo conforme quantidade (melhor faixa de atacado atingida)
  const faixasOrdenadas = (p) =>
    (p.faixas || []).filter((f) => f.qtd > 0 && f.preco > 0).sort((a, b) => a.qtd - b.qtd);
  const faixaAplicavel = (p, qtd) => {
    const fs = faixasOrdenadas(p);
    let aplicavel = null;
    for (const f of fs) if (qtd >= f.qtd) aplicavel = f;
    return aplicavel; // a de maior qtd cujo mínimo foi atingido
  };
  const precoEfetivo = (p, qtd) => {
    const f = faixaAplicavel(p, qtd);
    return f ? f.preco : (p.precoVarejo ?? p.preco ?? 0);
  };
  const temAtacado = (p) => faixasOrdenadas(p).length > 0;
  const proximaFaixa = (p, qtd) => {
    const fs = faixasOrdenadas(p);
    for (const f of fs) if (qtd < f.qtd) return f; // primeira ainda não atingida
    return null;
  };

  const persist = async (lista) => {
    setProdutos(lista);
    if (userId) await supabase.from("catalogo").upsert({ user_id: userId, produtos: lista });
  };
  const persistOrc = async (lista) => {
    setOrcamentos(lista);
    if (lista.length > 0 && userId) {
      await supabase.from("orcamentos").upsert(lista.map(o => ({ ...o, user_id: userId })));
    }
  };

  const canais = useMemo(() => {
    // canais padrão (CANAIS_VENDA) + quaisquer canais customizados já cadastrados
    const nomesPadrao = CANAIS_VENDA.map(c => c.nome);
    const customizados = Array.from(new Set(produtos.map(p => p.canal).filter(Boolean))).filter(n => !nomesPadrao.includes(n));
    return ["todos", ...nomesPadrao, ...customizados];
  }, [produtos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      const preco = p.precoVarejo ?? p.preco ?? 0;
      if (q && !(`${p.nome} ${p.descricao || ""}`.toLowerCase().includes(q))) return false;
      if (fCanal !== "todos" && p.canal !== fCanal) return false;
      if (fPreco === "ate50" && preco > 50) return false;
      if (fPreco === "50a150" && (preco < 50 || preco > 150)) return false;
      if (fPreco === "mais150" && preco < 150) return false;
      return true;
    });
  }, [produtos, busca, fCanal, fPreco]);

  // ── import / export ───────────────────────────────────────────
  const exportarCSV = () => baixar("catalogo.csv", "\uFEFF" + toCSV(filtrados), "text/csv;charset=utf-8");

  const baixarModeloCSV = () => {
    const linhas = [
      "nome,canal,descricao,custo,precoVarejo,faixas,imagem",
      "Suporte para celular,Venda direta,Suporte articulado PLA,8.50,29.90,,",
      "Vaso decorativo M,Instagram,Vaso 15cm PLA branco,12.00,45.00,10:38|50:30,",
      "Organizador de gaveta,Mercado Livre,Kit 4 divisorias,18.00,59.90,,",
    ];
    baixar("modelo-catalogo.csv", "\uFEFF" + linhas.join("\n"), "text/csv;charset=utf-8");
  };

  const importarCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const novos = parseCSV(String(reader.result));
      // mescla por nome (atualiza existentes, adiciona novos)
      const mapa = new Map(produtos.map((p) => [p.nome.toLowerCase(), p]));
      novos.forEach((n) => mapa.set(n.nome.toLowerCase(), { ...mapa.get(n.nome.toLowerCase()), ...n }));
      persist(Array.from(mapa.values()));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportarPDF = () => window.print();

  // ── criar / editar via modal ──────────────────────────────────
  const novoProduto = () => setModal({
    id: null, nome: "", canal: CANAIS_VENDA[0].nome, categoria: "", subcategoria: "", descricao: "", imagem: "",
    custo: "", precoVarejo: "", faixas: [], pesoG: "", tempoH: "",
  });
  const editar = (p) => setModal({
    ...p,
    custo: p.custo ?? "", precoVarejo: p.precoVarejo ?? p.preco ?? "",
    faixas: (p.faixas || []).map((f) => ({ ...f })),
    categoria: p.categoria || "", subcategoria: p.subcategoria || "",
    pesoG: p.pesoG ?? "", tempoH: p.tempoH ?? "",
  });
  const addFaixa = () => setModal((m) => ({
    ...m, faixas: [...(m.faixas || []), { id: Date.now(), qtd: "", preco: "" }],
  }));
  const updFaixa = (id, k, v) => setModal((m) => ({
    ...m, faixas: m.faixas.map((f) => f.id === id ? { ...f, [k]: v } : f),
  }));
  const delFaixa = (id) => setModal((m) => ({ ...m, faixas: m.faixas.filter((f) => f.id !== id) }));

  const salvarModal = () => {
    if (!modal.nome.trim()) return;
    const custo = parseFloat(modal.custo) || 0;
    const precoVarejo = parseFloat(modal.precoVarejo) || 0;
    const faixas = (modal.faixas || [])
      .map((f) => ({ id: f.id, qtd: parseInt(f.qtd) || 0, preco: parseFloat(f.preco) || 0 }))
      .filter((f) => f.qtd > 0 && f.preco > 0)
      .sort((a, b) => a.qtd - b.qtd);
    const item = {
      id: modal.id || Date.now(),
      nome: modal.nome.trim(),
      canal: modal.canal.trim() || "Venda direta",
      categoria: modal.categoria || "",
      subcategoria: modal.subcategoria || "",
      descricao: modal.descricao.trim(),
      imagem: modal.imagem.trim(),
      custo, precoVarejo, faixas,
      pesoG: parseFloat(modal.pesoG) || 0,
      tempoH: parseFloat(modal.tempoH) || 0,
      preco: precoVarejo,           // compat
      lucro: precoVarejo - custo,   // compat
    };
    const lista = modal.id
      ? produtos.map((p) => p.id === modal.id ? item : p)
      : [item, ...produtos];
    persist(lista);
    setModal(null);
  };
  const excluir = (id) => persist(produtos.filter((p) => p.id !== id));

  const subirImagem = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setModal((m) => ({ ...m, imagem: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  // ── vitrine: pedido vira orçamento ────────────────────────────
  const setQtd = (nome, q) => setCarrinho((c) => {
    const n = Math.max(0, q);
    const novo = { ...c };
    if (n === 0) delete novo[nome]; else novo[nome] = n;
    return novo;
  });
  const itensCarrinho = Object.entries(carrinho).map(([nome, qtd]) => {
    const p = produtos.find((x) => x.nome === nome);
    if (!p) return null;
    const preco = precoEfetivo(p, qtd);
    const atacadoAtivo = !!faixaAplicavel(p, qtd);
    return { nome, qtd, preco, custo: p.custo, atacadoAtivo, produto: p };
  }).filter(Boolean);
  const totalCarrinho = itensCarrinho.reduce((s, i) => s + i.preco * i.qtd, 0);

  const enviarPedido = () => {
    if (!nomeCliente.trim() || itensCarrinho.length === 0) return;
    const o = {
      id: Date.now(),
      numero: "ORC-" + String(orcamentos.length + 1).padStart(4, "0"),
      cliente: nomeCliente.trim(),
      contato: contatoCliente.trim(),
      validade: addDias(7),
      obs: "Pedido montado pelo cliente na vitrine.",
      itens: itensCarrinho.map((i) => ({ nome: i.nome, preco: i.preco, custo: i.custo, qtd: i.qtd })),
      total: totalCarrinho,
      status: "pendente",
      motivo: null,
      criadoEm: hoje(),
    };
    persistOrc([o, ...orcamentos]);
    setDocPedido(o);
    setCarrinho({}); setNomeCliente(""); setContatoCliente("");
  };

  const enviarPersonalizado = () => {
    if (!nomeCliente.trim() || !perso.titulo.trim()) return;
    const o = {
      id: Date.now(),
      numero: "ORC-" + String(orcamentos.length + 1).padStart(4, "0"),
      cliente: nomeCliente.trim(),
      contato: contatoCliente.trim(),
      validade: addDias(7),
      obs: "Pedido personalizado pela vitrine." + (perso.ref ? ` Referência: ${perso.ref}` : ""),
      itens: [{
        nome: perso.titulo.trim(),
        descricao: perso.descricao.trim(),
        preco: 0, custo: 0,
        qtd: parseInt(perso.qtd) || 1,
        personalizado: true,
        aCotar: true,
      }],
      total: 0,
      status: "pendente",
      personalizado: true,
      motivo: null,
      criadoEm: hoje(),
    };
    persistOrc([o, ...orcamentos]);
    setDocPedido(o);
    setPersoModal(false);
    setPerso({ titulo: "", descricao: "", qtd: 1, ref: "" });
    setNomeCliente(""); setContatoCliente("");
  };

  // ── documento de confirmação do pedido ────────────────────────
  if (docPedido) {
    const o = docPedido;
    return (
      <div style={{ minHeight: "100vh", background: "#f4f4f6", padding: "24px 16px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <style>{`@media print { .noprint { display: none !important; } body { background: #fff; } }`}</style>
        <div className="noprint" style={{ maxWidth: 640, margin: "0 auto 16px", display: "flex", gap: 10 }}>
          <button onClick={() => setDocPedido(null)} style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 14 }}>← Voltar à vitrine</button>
          <button onClick={() => window.print()} style={{ padding: "10px 16px", borderRadius: 9, border: "none", background: C.heat, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Imprimir / Salvar PDF</button>
        </div>
        <div style={{ maxWidth: 640, margin: "0 auto", background: "#fff", padding: "44px 48px", borderRadius: 8, color: "#1a1a1f", boxShadow: "0 4px 24px #0002" }}>
          <div style={{ textAlign: "center", borderBottom: "3px solid #ff6a2b", paddingBottom: 18, marginBottom: 22 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>✓</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{o.personalizado ? "Solicitação enviada!" : "Pedido enviado!"}</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
              {o.personalizado
                ? `Sua solicitação ${o.numero} foi enviada. O vendedor vai cotar e te retornar com o preço.`
                : `Seu pedido foi registrado como ${o.numero} e enviado para análise.`}
            </div>
          </div>
          <div style={{ fontSize: 13.5, marginBottom: 18 }}>
            <strong>{o.cliente}</strong>{o.contato ? ` · ${o.contato}` : ""}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead><tr style={{ borderBottom: "2px solid #1a1a1f", textAlign: "left" }}>
              <th style={{ padding: "8px 0" }}>Item</th>
              <th style={{ padding: "8px 0", textAlign: "center", width: 50 }}>Qtd</th>
              <th style={{ padding: "8px 0", textAlign: "right", width: 100 }}>Subtotal</th>
            </tr></thead>
            <tbody>
              {o.itens.map((it, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px 0" }}>
                    {it.nome}
                    {it.descricao && <div style={{ fontSize: 11.5, color: "#888" }}>{it.descricao}</div>}
                  </td>
                  <td style={{ padding: "10px 0", textAlign: "center" }}>{it.qtd}</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600 }}>
                    {it.aCotar ? <span style={{ color: "#ff6a2b" }}>a cotar</span> : brl(it.preco * it.qtd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", minWidth: 220, padding: "12px 14px", background: "#fff4ee", borderRadius: 8 }}>
              <span style={{ fontWeight: 700 }}>{o.personalizado ? "Total" : "Total estimado"}</span>
              <span style={{ fontWeight: 800, fontSize: 17, color: "#ff6a2b" }}>{o.personalizado ? "a cotar" : brl(o.total)}</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#888", textAlign: "center", marginTop: 24 }}>
            Este é um pedido de orçamento. Os valores serão confirmados pelo vendedor antes do pagamento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", padding: "32px 20px 60px" }}>
      <style>{`@media print { .noprint { display:none !important; } .printable, .printable * { visibility: visible; } }`}</style>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* header + toggle de visão */}
        <div className="noprint" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, letterSpacing: -0.3 }}>Catálogo</h1>
            <p style={{ margin: "4px 0 0", color: C.mute, fontSize: 14 }}>
              {vista === "gestao" ? "Gestão interna · custos, margens e arquivos." : "Vitrine do cliente · monte um pedido."}
            </p>
          </div>
          <div style={{ display: "flex", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 4 }}>
            {[["gestao", "Gestão"], ["vitrine", "Vitrine do cliente"]].map(([id, txt]) => {
              const on = vista === id;
              return (
                <button key={id} onClick={() => setVista(id)}
                  style={{ padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13.5,
                    fontWeight: on ? 700 : 500, color: on ? "#1a0d05" : C.mute, background: on ? C.heat : "transparent" }}>
                  {txt}
                </button>
              );
            })}
          </div>
        </div>

        {vista === "gestao" ? (
          <>
            {/* barra de ferramentas */}
            <div className="noprint" style={{ ...panel, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <span style={label}>Buscar</span>
                <input placeholder="Nome ou descrição…" value={busca} onChange={(e) => setBusca(e.target.value)} style={field} />
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <span style={label}>Canal</span>
                <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} style={field}>
                  {canais.map((c) => <option key={c} value={c}>{c === "todos" ? "Todos" : c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <span style={label}>Faixa de preço</span>
                <select value={fPreco} onChange={(e) => setFPreco(e.target.value)} style={field}>
                  <option value="todos">Todas</option>
                  <option value="ate50">Até R$ 50</option>
                  <option value="50a150">R$ 50–150</option>
                  <option value="mais150">Acima de R$ 150</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <span style={label}>Ver preços para</span>
                <select value={canalPreco} onChange={(e) => setCanalPreco(e.target.value)}
                  style={{ ...field, color: canalPreco !== "direto" ? C.heat : C.ink, fontWeight: canalPreco !== "direto" ? 700 : 400 }}>
                  <option value="direto">Venda Direta (base)</option>
                  {CANAIS_VENDA.filter(c => c.taxa > 0 || c.taxaFixa > 0).map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={novoProduto} style={{ ...btnTool(C.heat), background: C.heat, color: "#1a0d05", border: "none" }}>+ Novo produto</button>
                <label style={{ ...btnTool(C.cyan), cursor: "pointer" }}>
                  Importar CSV
                  <input type="file" accept=".csv,text/csv" onChange={importarCSV} style={{ display: "none" }} />
                </label>
                <button onClick={baixarModeloCSV} style={btnTool(C.mute)} title="Baixa um CSV de exemplo com as colunas corretas">Modelo CSV</button>
                <button onClick={exportarCSV} style={btnTool(C.green)}>Exportar CSV</button>
                <button onClick={exportarPDF} style={btnTool(C.heat)}>Exportar PDF</button>
              </div>
              {/* WhatsApp + compartilhar vitrine */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none" }}>📱</span>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => salvarWhatsapp(e.target.value)}
                    placeholder="WhatsApp p/ pedidos (ex: 5521999990000)"
                    style={{ ...field, width: 300, paddingLeft: 30, fontSize: 13 }}
                  />
                </div>
                <button onClick={copiarLink} style={btnTool(linkCopiado ? C.green : C.cyan)}>
                  {linkCopiado ? "✓ Link copiado!" : "🔗 Compartilhar vitrine"}
                </button>
              </div>
            </div>

            {/* tabela gestão */}
            <div className="printable" style={panel}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                <h2 style={{ ...heading, margin: 0 }}>{filtrados.length} de {produtos.length} produtos</h2>
              </div>
              {filtrados.length === 0 ? (
                <p style={{ fontSize: 13.5, color: C.mute, margin: 0 }}>
                  {produtos.length === 0 ? "Catálogo vazio. Importe um CSV ou precifique produtos na calculadora." : "Nenhum produto com esses filtros."}
                </p>
              ) : (() => {
                  // canal selecionado para cálculo de preços
                  const canalInfo = canalPreco !== "direto"
                    ? CANAIS_VENDA.find(c => c.id === canalPreco)
                    : null;
                  const taxa = canalInfo?.taxa ?? 0;
                  const taxaFixa = canalInfo?.taxaFixa ?? 0;
                  const temTaxa = taxa > 0 || taxaFixa > 0;
                  const taxaLabel = canalInfo ? (() => {
                    const pct = taxa > 0 ? `${(taxa * 100).toFixed(1)}%` : "";
                    const fix = taxaFixa > 0 ? `+R$${taxaFixa.toFixed(2).replace(".", ",")}` : "";
                    return [pct, fix].filter(Boolean).join(" ");
                  })() : "";
                  return (
                    <div style={{ overflowX: "auto" }}>
                      {canalInfo && (
                        <div style={{ marginBottom: 10, padding: "8px 14px", background: C.heatDim, borderRadius: 8, fontSize: 12.5, color: C.heat, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                          <span>Tabela para</span>
                          <strong>{canalInfo.nome}</strong>
                          <span style={{ fontWeight: 400, color: C.mute }}>· taxa {taxaLabel} · você recebe o mesmo líquido da venda direta</span>
                        </div>
                      )}
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 720 }}>
                        <thead>
                          <tr style={{ textAlign: "left", color: C.mute, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            <th style={{ padding: "0 8px 10px 0" }}>Produto</th>
                            <th style={{ padding: "0 8px 10px" }}>Canal cadastrado</th>
                            <th style={{ padding: "0 8px 10px", textAlign: "right" }}>Custo</th>
                            <th style={{ padding: "0 8px 10px", textAlign: "right" }}>
                              {canalInfo ? `Varejo · ${canalInfo.nome}` : "Varejo"}
                            </th>
                            <th style={{ padding: "0 8px 10px", textAlign: "right" }}>
                              {canalInfo ? "Atacado (lista)" : "Atacado"}
                            </th>
                            <th style={{ padding: "0 8px 10px", textAlign: "right" }}>Lucro Líq.</th>
                            <th style={{ padding: "0 8px 10px", textAlign: "right" }}>Margem</th>
                            <th className="noprint" style={{ padding: "0 0 10px", width: 80 }} />
                          </tr>
                        </thead>
                        <tbody>
                          {filtrados.map((p) => {
                            const varejo = p.precoVarejo ?? p.preco ?? 0;
                            const fsOrdenadas = faixasOrdenadas(p);
                            const precoAtacado = fsOrdenadas.length > 0 ? fsOrdenadas[0].preco : 0;
                            const cv = precoParaCanal(varejo, p.custo, taxa, taxaFixa);
                            const ca = precoAtacado > 0 ? precoParaCanal(precoAtacado, p.custo, taxa, taxaFixa) : null;
                            const corV = cv ? (cv.margem >= 40 ? C.green : cv.margem >= 20 ? C.amber : C.red) : C.mute;
                            const corA = ca ? (ca.margem >= 40 ? C.green : ca.margem >= 20 ? C.amber : C.red) : null;
                            return (
                              <tr key={p.id} style={{ borderTop: `1px solid ${C.line}` }}>
                                <td style={{ padding: "11px 8px 11px 0", fontWeight: 600 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    {p.imagem ? (
                                      <img src={p.imagem} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                                    ) : (
                                      <div style={{ width: 34, height: 34, borderRadius: 6, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.line, flexShrink: 0 }}>◳</div>
                                    )}
                                    <div>
                                      {p.nome}
                                      {p.descricao && <div style={{ fontSize: 11.5, color: C.mute, fontWeight: 400 }}>{p.descricao}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: "11px 8px", color: C.mute, fontSize: 12.5 }}>{p.canal}</td>
                                <td style={{ padding: "11px 8px", textAlign: "right", color: C.mute, fontVariantNumeric: "tabular-nums" }}>{brl(p.custo)}</td>
                                <td style={{ padding: "11px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                  <span style={{ color: C.heat, fontWeight: 700 }}>{cv ? brl(cv.lista) : "—"}</span>
                                  {temTaxa && cv && <div style={{ fontSize: 10.5, color: C.mute }}>direto {brl(varejo)}</div>}
                                </td>
                                <td style={{ padding: "11px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                  {temAtacado(p) ? (
                                    ca ? (
                                      <>
                                        <span style={{ color: C.cyan, fontWeight: 700 }}>{brl(ca.lista)}</span>
                                        {temTaxa && <div style={{ fontSize: 10.5, color: C.mute }}>direto {brl(precoAtacado)} · {fsOrdenadas.length} faixa{fsOrdenadas.length > 1 ? "s" : ""}</div>}
                                      </>
                                    ) : <span style={{ color: C.line }}>—</span>
                                  ) : <span style={{ color: C.line }}>—</span>}
                                </td>
                                <td style={{ padding: "11px 8px", textAlign: "right", color: corV, fontVariantNumeric: "tabular-nums" }}>
                                  {cv ? brl(cv.lucro) : "—"}
                                </td>
                                <td style={{ padding: "11px 8px", textAlign: "right", color: corV, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                  {cv ? `${cv.margem.toFixed(0)}%` : "—"}
                                </td>
                                <td className="noprint" style={{ padding: "11px 0", textAlign: "right" }}>
                                  <button onClick={() => editar(p)} style={{ ...btnMini(C.mute), marginRight: 4 }}>editar</button>
                                  <button onClick={() => excluir(p.id)} style={btnMini(C.mute)}>×</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              }
            </div>
          </>
        ) : (
          /* ── VITRINE DO CLIENTE ── */
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
            <div>
              {/* busca na vitrine */}
              <div style={{ ...panel, marginBottom: 16 }}>
                <input placeholder="Buscar produtos…" value={busca} onChange={(e) => setBusca(e.target.value)} style={field} />
              </div>
              {/* grade de produtos */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                {/* card de pedido personalizado */}
                <button onClick={() => setPersoModal(true)}
                  style={{ ...panel, padding: 16, display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", cursor: "pointer", border: `1px dashed ${C.heat}`, background: C.heatDim }}>
                  <div style={{ height: 110, width: "100%", borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", color: C.heat, fontSize: 34 }}>＋</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.heat, marginBottom: 2 }}>Pedido personalizado</div>
                  <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.4 }}>Não achou o que queria? Descreva sua peça exclusiva e peça um orçamento.</div>
                </button>
                {filtrados.length === 0 && (
                  <p style={{ fontSize: 13.5, color: C.mute, gridColumn: "1/-1" }}>Nenhum produto no catálogo — você ainda pode pedir um personalizado acima.</p>
                )}
                {filtrados.map((p) => {
                  const q = carrinho[p.nome] || 0;
                  const varejo = p.precoVarejo ?? p.preco ?? 0;
                  const fAtiva = faixaAplicavel(p, q);
                  const precoMostra = fAtiva ? fAtiva.preco : varejo;
                  const prox = proximaFaixa(p, q);
                  return (
                    <div key={p.id} style={{ ...panel, padding: 16, display: "flex", flexDirection: "column" }}>
                      {p.imagem ? (
                        <img src={p.imagem} alt={p.nome} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 8, marginBottom: 12 }} />
                      ) : (
                        <div style={{ height: 110, background: C.bg, borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", color: C.line, fontSize: 32 }}>◳</div>
                      )}
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{p.nome}</div>
                      {p.descricao && <div style={{ fontSize: 12, color: C.mute, marginBottom: 8, lineHeight: 1.4 }}>{p.descricao}</div>}
                      <div style={{ margin: "auto 0 12px" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: fAtiva ? C.cyan : C.heat }}>
                          {brl(precoMostra)}
                          <span style={{ fontSize: 11.5, color: C.mute, fontWeight: 500 }}> /un</span>
                        </div>
                        {temAtacado(p) && (
                          <div style={{ fontSize: 11.5, color: fAtiva ? C.cyan : C.mute, marginTop: 2, lineHeight: 1.4 }}>
                            {fAtiva && <span>✓ atacado ({fAtiva.qtd}+)<br /></span>}
                            {prox && <span>{brl(prox.preco)}/un a partir de {prox.qtd}</span>}
                          </div>
                        )}
                      </div>
                      {q === 0 ? (
                        <button onClick={() => setQtd(p.nome, 1)} style={{ width: "100%", padding: "9px", borderRadius: 9, border: "none", background: C.heat, color: "#1a0d05", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                          Adicionar
                        </button>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.bg, borderRadius: 9, padding: 4 }}>
                          <button onClick={() => setQtd(p.nome, q - 1)} style={qtyBtn}>−</button>
                          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{q}</span>
                          <button onClick={() => setQtd(p.nome, q + 1)} style={qtyBtn}>+</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* carrinho */}
            <div style={{ ...panel, position: "sticky", top: 20 }}>
              <h2 style={heading}>Seu pedido</h2>
              {itensCarrinho.length === 0 ? (
                <p style={{ fontSize: 13.5, color: C.mute, margin: 0 }}>Adicione produtos para montar seu pedido.</p>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {itensCarrinho.map((i) => (
                      <div key={i.nome} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                        <span style={{ color: C.ink }}>
                          {i.qtd}× {i.nome}
                          {i.atacadoAtivo && <span style={{ color: C.cyan, fontSize: 11, marginLeft: 6 }}>atacado</span>}
                        </span>
                        <span style={{ color: C.mute, fontVariantNumeric: "tabular-nums" }}>{brl(i.preco * i.qtd)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${C.line}`, marginBottom: 14 }}>
                    <span style={{ fontWeight: 700 }}>Total</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: C.heat, fontVariantNumeric: "tabular-nums" }}>{brl(totalCarrinho)}</span>
                  </div>
                  <label style={{ display: "block", marginBottom: 10 }}>
                    <span style={label}>Seu nome</span>
                    <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} style={field} placeholder="Nome completo" />
                  </label>
                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={label}>Contato</span>
                    <input value={contatoCliente} onChange={(e) => setContatoCliente(e.target.value)} style={field} placeholder="WhatsApp / e-mail" />
                  </label>
                  <button onClick={enviarPedido} disabled={!nomeCliente.trim()}
                    style={{ width: "100%", padding: 13, borderRadius: 11, border: "none", fontSize: 14.5, fontWeight: 700,
                      cursor: nomeCliente.trim() ? "pointer" : "not-allowed",
                      background: nomeCliente.trim() ? C.green : C.line,
                      color: nomeCliente.trim() ? "#0c1410" : C.mute }}>
                    Enviar pedido
                  </button>
                  <p style={{ fontSize: 11.5, color: C.mute, margin: "10px 0 0", lineHeight: 1.5, textAlign: "center" }}>
                    O pedido vira um orçamento para o vendedor confirmar.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* modal pedido personalizado (vitrine) */}
      {persoModal && (
        <div onClick={() => setPersoModal(false)} style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ ...heading, margin: 0 }}>Pedido personalizado</h2>
              <button onClick={() => setPersoModal(false)} style={{ background: "transparent", border: "none", color: C.mute, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 12.5, color: C.mute, margin: "0 0 18px", lineHeight: 1.5 }}>
              Descreva a peça que você precisa. O vendedor vai analisar e te enviar um orçamento com o preço.
            </p>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={label}>O que você precisa</span>
              <input value={perso.titulo} onChange={(e) => setPerso({ ...perso, titulo: e.target.value })} style={field} placeholder="Ex.: Troféu personalizado com logo" />
            </label>
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={label}>Detalhes</span>
              <textarea value={perso.descricao} onChange={(e) => setPerso({ ...perso, descricao: e.target.value })}
                style={{ ...field, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
                placeholder="Tamanho, cor, material, prazo, qualquer detalhe que ajude a cotar…" />
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ display: "block", marginBottom: 14, width: 100 }}>
                <span style={label}>Quantidade</span>
                <input type="number" value={perso.qtd} onChange={(e) => setPerso({ ...perso, qtd: e.target.value })} style={field} />
              </label>
              <label style={{ display: "block", marginBottom: 14, flex: 1 }}>
                <span style={label}>Link de referência (opcional)</span>
                <input value={perso.ref} onChange={(e) => setPerso({ ...perso, ref: e.target.value })} style={field} placeholder="Foto, modelo, exemplo…" />
              </label>
            </div>

            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16, marginTop: 2 }}>
              <label style={{ display: "block", marginBottom: 10 }}>
                <span style={label}>Seu nome</span>
                <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} style={field} placeholder="Nome completo" />
              </label>
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={label}>Contato</span>
                <input value={contatoCliente} onChange={(e) => setContatoCliente(e.target.value)} style={field} placeholder="WhatsApp / e-mail" />
              </label>
            </div>

            <button onClick={enviarPersonalizado} disabled={!perso.titulo.trim() || !nomeCliente.trim()}
              style={{ width: "100%", padding: 13, borderRadius: 11, border: "none", fontSize: 14.5, fontWeight: 700,
                cursor: perso.titulo.trim() && nomeCliente.trim() ? "pointer" : "not-allowed",
                background: perso.titulo.trim() && nomeCliente.trim() ? C.heat : C.line,
                color: perso.titulo.trim() && nomeCliente.trim() ? "#1a0d05" : C.mute }}>
              Enviar pedido de orçamento
            </button>
            <p style={{ fontSize: 11.5, color: C.mute, margin: "10px 0 0", textAlign: "center" }}>
              Sem compromisso — você recebe o preço antes de decidir.
            </p>
          </div>
        </div>
      )}

      {/* modal criar/editar produto */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ ...heading, margin: 0 }}>{modal.id ? "Editar produto" : "Novo produto"}</h2>
              <button onClick={() => setModal(null)} style={{ background: "transparent", border: "none", color: C.mute, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={label}>Nome</span>
              <input value={modal.nome} onChange={(e) => setModal({ ...modal, nome: e.target.value })} style={field} placeholder="Ex.: Vaso geométrico médio" />
            </label>
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={label}>Descrição</span>
              <input value={modal.descricao} onChange={(e) => setModal({ ...modal, descricao: e.target.value })} style={field} placeholder="Aparece na vitrine do cliente" />
            </label>

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <label style={{ display: "block", flex: 1 }}>
                <span style={label}>Gramatura (g)</span>
                <input type="number" step="1" min="0" value={modal.pesoG} onChange={(e) => setModal({ ...modal, pesoG: e.target.value })} style={field} placeholder="Ex.: 45" />
              </label>
              <label style={{ display: "block", flex: 1 }}>
                <span style={label}>Tempo de impressão (h)</span>
                <input type="number" step="0.5" min="0" value={modal.tempoH} onChange={(e) => setModal({ ...modal, tempoH: e.target.value })} style={field} placeholder="Ex.: 4.5" />
              </label>
            </div>

            {/* imagem */}
            <div style={{ marginBottom: 14 }}>
              <span style={label}>Imagem</span>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {modal.imagem ? (
                  <img src={modal.imagem} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 8, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.line, fontSize: 24 }}>◳</div>
                )}
                <div style={{ flex: 1 }}>
                  <input value={modal.imagem?.startsWith("data:") ? "" : modal.imagem} onChange={(e) => setModal({ ...modal, imagem: e.target.value })} style={{ ...field, marginBottom: 6 }} placeholder="Cole uma URL…" />
                  <label style={{ ...btnMini(C.cyan), display: "inline-block", cursor: "pointer" }}>
                    Enviar arquivo
                    <input type="file" accept="image/*" onChange={subirImagem} style={{ display: "none" }} />
                  </label>
                  {modal.imagem && <button onClick={() => setModal({ ...modal, imagem: "" })} style={{ ...btnMini(C.mute), marginLeft: 6 }}>remover</button>}
                </div>
              </div>
            </div>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={label}>Canal de venda</span>
              <select value={CANAIS_VENDA.find(c => c.nome === modal.canal)?.id || "vitrine"} onChange={(e) => {
                const c = CANAIS_VENDA.find(x => x.id === e.target.value);
                setModal({ ...modal, canal: c ? c.nome : e.target.value });
              }} style={field}>
                {CANAIS_VENDA.map(c => <option key={c.id} value={c.id}>{c.nome}{c.taxa > 0 ? ` (taxa ${(c.taxa * 100).toFixed(1)}%)` : ""}</option>)}
              </select>
            </label>

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <label style={{ display: "block", flex: 1 }}>
                <span style={label}>Categoria</span>
                <input
                  list="cats-list"
                  value={modal.categoria}
                  onChange={(e) => setModal({ ...modal, categoria: e.target.value, subcategoria: "" })}
                  style={field}
                  placeholder="Selecione ou crie…"
                />
                <datalist id="cats-list">
                  {Object.keys(CATS).map((c) => <option key={c} value={c} />)}
                </datalist>
              </label>
              <label style={{ display: "block", flex: 1 }}>
                <span style={label}>Subcategoria</span>
                <input
                  list="subcats-list"
                  value={modal.subcategoria}
                  onChange={(e) => setModal({ ...modal, subcategoria: e.target.value })}
                  style={field}
                  placeholder="Selecione ou crie…"
                />
                <datalist id="subcats-list">
                  {[...new Set(CATS[modal.categoria] || Object.values(CATS).flat())].map((s) => <option key={s} value={s} />)}
                </datalist>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ display: "block", marginBottom: 14, flex: 1 }}>
                <span style={label}>Custo</span>
                <input type="number" step="0.01" value={modal.custo} onChange={(e) => setModal({ ...modal, custo: e.target.value })} style={field} placeholder="R$" />
              </label>
              <label style={{ display: "block", marginBottom: 14, flex: 1 }}>
                <span style={label}>Preço varejo</span>
                <input type="number" step="0.01" value={modal.precoVarejo} onChange={(e) => setModal({ ...modal, precoVarejo: e.target.value })} style={field} placeholder="R$" />
              </label>
            </div>

            <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ ...label, margin: 0 }}>Faixas de atacado (opcional)</span>
                <button onClick={addFaixa} style={btnMini(C.heat)}>+ Faixa</button>
              </div>
              {(!modal.faixas || modal.faixas.length === 0) ? (
                <p style={{ fontSize: 11.5, color: C.mute, margin: 0, lineHeight: 1.5 }}>
                  Adicione degraus de preço por quantidade. Ex.: 10un a R$ 18, 50un a R$ 15, 100un a R$ 12.
                </p>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, fontSize: 11, color: C.mute, marginBottom: 4, padding: "0 2px" }}>
                    <span style={{ flex: 1 }}>A partir de (un)</span>
                    <span style={{ flex: 1 }}>Preço /un</span>
                    <span style={{ width: 32 }} />
                  </div>
                  {modal.faixas.map((f) => (
                    <div key={f.id} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                      <input type="number" value={f.qtd} onChange={(e) => updFaixa(f.id, "qtd", e.target.value)} style={{ ...field, flex: 1 }} placeholder="10" />
                      <input type="number" step="0.01" value={f.preco} onChange={(e) => updFaixa(f.id, "preco", e.target.value)} style={{ ...field, flex: 1 }} placeholder="R$" />
                      <button onClick={() => delFaixa(f.id)} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.mute, borderRadius: 7, width: 32, cursor: "pointer", fontSize: 15 }}>×</button>
                    </div>
                  ))}
                  <p style={{ fontSize: 11.5, color: C.mute, margin: "6px 0 0", lineHeight: 1.5 }}>
                    Na vitrine, vale a faixa de maior quantidade que o cliente atingir.
                  </p>
                </>
              )}
            </div>

            {/* preços por canal calculados automaticamente */}
            {(parseFloat(modal.precoVarejo) > 0 || (modal.faixas || []).some(f => parseFloat(f.preco) > 0)) && (() => {
              const custo = parseFloat(modal.custo) || 0;
              const varejo = parseFloat(modal.precoVarejo) || 0;
              const faixasValidas = (modal.faixas || []).filter(f => parseFloat(f.preco) > 0 && parseInt(f.qtd) > 0).sort((a, b) => a.qtd - b.qtd);
              const atacadoBase = faixasValidas.length > 0 ? parseFloat(faixasValidas[0].preco) : null;
              return (
                <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
                  <span style={{ ...label, margin: "0 0 4px", fontSize: 11, letterSpacing: 1 }}>PREÇOS POR CANAL (automático)</span>
                  <p style={{ margin: "0 0 10px", fontSize: 11, color: C.mute, lineHeight: 1.5 }}>
                    Valor que deve ser cobrado em cada canal para você receber o mesmo líquido da venda direta{varejo > 0 ? ` (${brl(varejo)})` : ""}.
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ color: C.mute, fontSize: 11, borderBottom: `1px solid ${C.line}` }}>
                          <th style={{ textAlign: "left", padding: "0 8px 6px 0", fontWeight: 500 }}>Canal</th>
                          <th style={{ textAlign: "right", padding: "0 8px 6px", fontWeight: 500 }}>Taxa</th>
                          {varejo > 0 && <th style={{ textAlign: "right", padding: "0 8px 6px", fontWeight: 500 }}>Preço Varejo</th>}
                          {atacadoBase && <th style={{ textAlign: "right", padding: "0 8px 6px", fontWeight: 500 }}>Preço Atacado</th>}
                          <th style={{ textAlign: "right", padding: "0 0 6px", fontWeight: 500 }}>Margem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CANAIS_VENDA.map(c => {
                          const cv = varejo > 0 ? precoParaCanal(varejo, custo, c.taxa, c.taxaFixa) : null;
                          const ca = atacadoBase ? precoParaCanal(atacadoBase, custo, c.taxa, c.taxaFixa) : null;
                          const cor = cv ? (cv.margem >= 40 ? C.green : cv.margem >= 20 ? C.amber : C.red) : C.mute;
                          const isDireto = c.taxa === 0 && c.taxaFixa === 0;
                          const taxaLabel = (() => {
                            if (c.taxa === 0 && c.taxaFixa === 0) return "—";
                            const pct = c.taxa > 0 ? `${(c.taxa * 100).toFixed(1)}%` : "";
                            const fix = c.taxaFixa > 0 ? `+R$${c.taxaFixa.toFixed(2).replace(".", ",")}` : "";
                            return [pct, fix].filter(Boolean).join(" ");
                          })();
                          return (
                            <tr key={c.id} style={{ borderTop: `1px solid ${C.line}`, background: isDireto ? "#37d6c508" : "transparent" }}>
                              <td style={{ padding: "8px 8px 8px 0", color: isDireto ? C.cyan : C.ink, fontWeight: isDireto ? 700 : 400, fontSize: 12 }}>
                                {c.nome}{isDireto && <span style={{ marginLeft: 6, fontSize: 10, color: C.mute, fontWeight: 400 }}>base</span>}
                              </td>
                              <td style={{ padding: "8px", textAlign: "right", color: C.mute, whiteSpace: "nowrap" }}>
                                {taxaLabel}
                              </td>
                              {cv && (
                                <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                  <span style={{ color: isDireto ? C.ink : C.heat, fontWeight: 700 }}>{brl(cv.lista)}</span>
                                  {c.taxa > 0 && <div style={{ fontSize: 10, color: C.mute }}>líq. {brl(cv.liquido)}</div>}
                                </td>
                              )}
                              {ca && (
                                <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                  <span style={{ color: isDireto ? C.ink : C.cyan, fontWeight: 700 }}>{brl(ca.lista)}</span>
                                  {c.taxa > 0 && <div style={{ fontSize: 10, color: C.mute }}>líq. {brl(ca.liquido)}</div>}
                                </td>
                              )}
                              <td style={{ padding: "8px 0 8px 8px", textAlign: "right", color: cor, fontWeight: 700 }}>
                                {cv ? `${cv.margem.toFixed(0)}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            <button onClick={salvarModal} disabled={!modal.nome.trim()}
              style={{ width: "100%", padding: 13, borderRadius: 11, border: "none", fontSize: 14.5, fontWeight: 700,
                cursor: modal.nome.trim() ? "pointer" : "not-allowed",
                background: modal.nome.trim() ? C.heat : C.line,
                color: modal.nome.trim() ? "#1a0d05" : C.mute }}>
              {modal.id ? "Salvar alterações" : "Adicionar ao catálogo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function btnTool(cor) {
  return { padding: "10px 14px", borderRadius: 9, border: `1px solid ${cor}`, background: "transparent", color: cor, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
}
function btnMini(cor) {
  return { padding: "4px 9px", fontSize: 12, borderRadius: 6, cursor: "pointer", fontWeight: 600, color: cor, background: "transparent", border: `1px solid ${cor}55` };
}
const qtyBtn = { width: 30, height: 30, borderRadius: 7, border: "none", background: "#2e3342", color: "#eef1f6", fontSize: 17, cursor: "pointer", lineHeight: 1 };
