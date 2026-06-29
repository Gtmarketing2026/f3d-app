import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN")!;

const EVENTOS_PAGAMENTO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

serve(async (req) => {
  try {
    // Valida token do Asaas
    const token = req.headers.get("asaas-access-token") ?? "";
    if (token !== WEBHOOK_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();

    if (!EVENTOS_PAGAMENTO.has(body.event)) {
      return new Response("OK");
    }

    const payment = body.payment;
    // externalReference pode estar no pagamento ou na assinatura
    const externalRef: string = payment?.externalReference ?? "";
    if (!externalRef) return new Response("OK");

    // Formato: userId:plano:mod1,mod2,...
    const parts = externalRef.split(":");
    const userId = parts[0];
    const plano = parts[1];
    const modulos = parts[2] ? parts[2].split(",") : [];

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    await supabase
      .from("licencas")
      .update({ modulos, plano, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    return new Response("OK");
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Error", { status: 500 });
  }
});
