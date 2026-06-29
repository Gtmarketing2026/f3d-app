# Forja 3D — App de gestão para impressão 3D

App de precificação, catálogo, orçamentos e financeiro para negócios de impressão 3D.
Pensado para ser vendido **completo** ou **por módulos isolados**.

## Rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm run build    # build de produção em /dist
```

## Arquitetura

```
src/
  App.jsx                  Shell: navegação lateral, respeita a licença
  main.jsx                 Entry: instala storage + provider de licença
  lib/
    storage.js             Camada key-value (hoje localStorage)  ← TROCAR por API no SaaS
    modulos.js             Manifesto dos módulos + preços + licença
    LicencaContext.jsx     Contexto que diz quais módulos o cliente comprou
  modules/
    Calculadora.jsx        Precificação (peça, lote, marketplace, imposto)
    Catalogo.jsx           Catálogo (gestão) + Vitrine (cliente) + atacado por faixas
    Orcamentos.jsx         Propostas em PDF, ganhos/perdidos, vira venda
    Financeiro.jsx         Vendas, despesas, fluxo de caixa
    Planos.jsx             Liga/desliga módulos (vira checkout no SaaS)
```

### Como os módulos se conectam

Tudo passa pela camada de storage, por chaves compartilhadas:

- **catalogo** → produtos (escrito por Calculadora e Catálogo; lido por todos)
- **orcamentos** → propostas (escrito por Catálogo/Vitrine e Orçamentos)
- **vendas** → vendas realizadas (escrito por Orçamentos e Financeiro)
- **despesas** → gastos (Financeiro)

### Venda completa vs. isolada

`lib/modulos.js` define cada módulo como produto vendável (preço, integrações).
`lib/LicencaContext.jsx` expõe `tem(id)` para saber se o cliente comprou um módulo.
Cada módulo **degrada com elegância** se um módulo integrado não foi comprado:
ex.: Financeiro sem Catálogo aceita produto digitado à mão; Orçamentos sem
Catálogo permite itens personalizados.

A tela **Planos** liga/desliga módulos via licença local. No SaaS, troque por
checkout (Stripe/Asaas/Mercado Pago) e carregue os módulos ativos do backend.

## Roteiro para virar SaaS de verdade

1. **Storage → backend.** Trocar `lib/storage.js` por chamadas à sua API.
   Manter a assinatura `get/set/delete/list`. Prefixar chaves por tenant.
2. **Autenticação e multi-tenancy.** Cada conta isolada; `tenant_id` em tudo.
3. **Billing real.** `Planos.jsx` vira checkout; licença vem do gateway.
4. **Vitrine com URL própria.** Hoje a vitrine é uma aba; no SaaS precisa ser
   uma página pública por loja (`/loja/:slug`) sem acesso ao painel de gestão.
5. **Imagens em storage de arquivos.** Hoje vão como base64 no localStorage
   (estoura cota rápido). Trocar por upload para S3/Cloudinary, guardar URL.
6. **Validações de negócio.** Ex.: alertar quando preço de atacado ≥ varejo.

## Observações do protótipo

- Dados ficam no localStorage do navegador (somem se limpar o navegador).
- A licença padrão libera tudo, para você testar o app completo. Use a tela
  Planos para simular a compra de módulos isolados.
