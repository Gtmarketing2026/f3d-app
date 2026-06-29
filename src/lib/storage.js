// Camada de armazenamento do app.
//
// No ambiente de artifacts da Claude.ai, os módulos usavam `window.storage`,
// uma API key-value assíncrona. Aqui reimplementamos a MESMA API por cima do
// localStorage, e instalamos em `window.storage` (ver instalarStorage abaixo),
// para que os módulos funcionem sem nenhuma alteração no código deles.
//
// >>> PONTO DE EVOLUÇÃO PARA O SAAS <<<
// Quando for multiusuário/multi-tenant, troque o corpo destes métodos por
// chamadas à sua API/banco (ex.: fetch para um backend, ou Supabase/Firebase),
// mantendo a assinatura get/set/delete/list. Os módulos não precisam saber
// de onde os dados vêm. Idealmente, prefixe as chaves por tenant: `${tenantId}:${key}`.

const PREFIXO = "app3d:";

export const storage = {
  async get(key) {
    try {
      const raw = localStorage.getItem(PREFIXO + key);
      return raw === null ? null : { key, value: raw };
    } catch (e) {
      return null;
    }
  },

  async set(key, value) {
    try {
      localStorage.setItem(PREFIXO + key, String(value));
      return { key, value };
    } catch (e) {
      // localStorage pode estourar cota (ex.: muitas imagens base64).
      console.error("Falha ao salvar:", key, e);
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
        if (k && k.startsWith(PREFIXO + prefix)) {
          keys.push(k.slice(PREFIXO.length));
        }
      }
    } catch (e) {}
    return { keys, prefix };
  },
};

// Instala a API em window.storage para compatibilidade com os módulos,
// que chamam window.storage.get / window.storage.set diretamente.
export function instalarStorage() {
  if (typeof window !== "undefined" && !window.storage) {
    window.storage = storage;
  }
}
