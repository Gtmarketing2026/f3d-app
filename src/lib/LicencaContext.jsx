import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "./supabase";

const LicencaContext = createContext(null);

export function LicencaProvider({ children }) {
  const [licenca, setLicenca] = useState({ modulos: [], plano: "nenhum" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLicenca() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("licencas")
        .select("modulos, plano")
        .eq("user_id", user.id)
        .single();
      if (data) setLicenca(data);
      setLoading(false);
    }
    fetchLicenca();

    // Polling leve: recarrega a licença a cada 10s para refletir pagamento confirmado
    const interval = setInterval(fetchLicenca, 10000);
    return () => clearInterval(interval);
  }, []);

  const tem = useCallback((id) => !!licenca?.modulos?.includes(id), [licenca]);

  return (
    <LicencaContext.Provider value={{ licenca, tem, loading }}>
      {children}
    </LicencaContext.Provider>
  );
}

export function useLicenca() {
  const ctx = useContext(LicencaContext);
  if (!ctx) return { licenca: { modulos: [] }, atualizar: () => {}, tem: () => true, loading: false };
  return ctx;
}
