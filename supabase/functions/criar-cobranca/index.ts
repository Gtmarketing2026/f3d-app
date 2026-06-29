import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_URL = "https://sandbox.asaas.com/api/v3";
const ASAAS_KEY = Deno.env.get("ASAAS_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { plano, modulos, cpf, tipo, valor } = await req.json();
    // tipo: "unico" | "mensal" | "atualizacao"
    // valor: vem do frontend (preço correto por tipo)

    const { data: licenca } = await supabase.from("licencas").select("asaas_customer_id").eq("user_id", user.id).single();
    let customerId = licenca?.asaas_customer_id;

    const nome = (user.email ?? "").split("@")[0];
    if (!customerId) {
      const custRes = await fetch(`${ASAAS_URL}/customers`, {
        method: "POST",
        headers: { "access_token": ASAAS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ name: nome, email: user.email, cpfCnpj: cpf }),
      });
      const cust = await custRes.json();
      customerId = cust.id;
      await supabase.from("licencas").update({ asaas_customer_id: customerId }).eq("user_id", user.id);
    } else {
      await fetch(`${ASAAS_URL}/customers/${customerId}`, {
        method: "PUT",
        headers: { "access_token": ASAAS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ name: nome, cpfCnpj: cpf }),
      });
    }

    const externalReference = `${user.id}:${plano}:${modulos.join(",")}:${tipo}`;
    const hoje = new Date().toISOString().split("T")[0];

    let paymentUrl: string;

    if (tipo === "unico") {
      // Cobrança avulsa (não recorrente)
      const pagRes = await fetch(`${ASAAS_URL}/payments`, {
        method: "POST",
        headers: { "access_token": ASAAS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          value: valor,
          dueDate: hoje,
          description: `F3D – ${modulos.join(", ")} (pagamento único)`,
          externalReference,
        }),
      });
      const pag = await pagRes.json();
      if (pag.errors) throw new Error(pag.errors[0]?.description ?? "Erro no Asaas");
      paymentUrl = pag.invoiceUrl ?? `https://sandbox.asaas.com/i/${pag.id}`;

    } else {
      // Assinatura mensal (catalogo, ou atualizações opcionais)
      const descricao = tipo === "atualizacao"
        ? `F3D – ${modulos.join(", ")} atualizações contínuas`
        : `F3D – ${modulos.join(", ")} mensal`;

      const subRes = await fetch(`${ASAAS_URL}/subscriptions`, {
        method: "POST",
        headers: { "access_token": ASAAS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          value: valor,
          nextDueDate: hoje,
          cycle: "MONTHLY",
          description: descricao,
          externalReference,
        }),
      });
      const sub = await subRes.json();
      if (sub.errors) throw new Error(sub.errors[0]?.description ?? "Erro no Asaas");

      const cobrRes = await fetch(`${ASAAS_URL}/subscriptions/${sub.id}/payments`, {
        headers: { "access_token": ASAAS_KEY },
      });
      const cobr = await cobrRes.json();
      paymentUrl = cobr.data?.[0]?.invoiceUrl ?? `https://sandbox.asaas.com/i/${sub.id}`;
    }

    return new Response(JSON.stringify({ paymentUrl }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
