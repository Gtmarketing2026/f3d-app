import { supabase } from "./supabase";

const PREFIXO = "app3d:";

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Salva catálogo no Supabase (upsert por user_id)
async function salvarCatalogoSupabase(userId, produtos) {
  await supabase.from("catalogo").upsert(
    { user_id: userId, produtos, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
}

// Carrega catálogo do Supabase
async function carregarCatalogoSupabase(userId) {
  const { data } = await supabase.from("catalogo").select("produtos").eq("user_id", userId).single();
  return data?.produtos ?? null;
}

export const storage = {
  async get(key) {
    try {
      const userId = await getUserId();
      if (userId && key === "catalogo") {
        const produtos = await carregarCatalogoSupabase(userId);
        if (produtos !== null) return { key, value: JSON.stringify(produtos) };
      }
      const raw = localStorage.getItem(PREFIXO + key);
      return raw === null ? null : { key, value: raw };
    } catch (e) {
      return null;
    }
  },

  async set(key, value) {
    try {
      const userId = await getUserId();
      if (userId && key === "catalogo") {
        const produtos = JSON.parse(value);
        await salvarCatalogoSupabase(userId, produtos);
      }
      localStorage.setItem(PREFIXO + key, String(value));
      return { key, value };
    } catch (e) {
      return null;
    }
  },

  async delete(key) {
    try {
      localStorage.removeItem(PREFIXO + key);
      return { key, deleted: true };
    } catch (e) {
      return null;
    }
  },

  async list(prefix = "") {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIXO + prefix)) keys.push(k.slice(PREFIXO.length));
      }
    } catch (e) {}
    return { keys, prefix };
  },
};

export function instalarStorage() {
  if (typeof window !== "undefined" && !window.storage) {
    window.storage = storage;
  }
}
