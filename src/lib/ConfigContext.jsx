import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./supabase";

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState({ nome_empresa: "", cor_primaria: "#ff6a2b", logo_base64: null });
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let channel;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("configuracoes").select("*").eq("user_id", user.id).single();
      if (data) setConfig(data);

      channel = supabase.channel("cfg-" + user.id)
        .on("postgres_changes", { event: "*", schema: "public", table: "configuracoes", filter: `user_id=eq.${user.id}` },
          async () => {
            const { data: d } = await supabase.from("configuracoes").select("*").eq("user_id", user.id).single();
            if (d) setConfig(d);
          })
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const salvarConfig = async (updates) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const nova = { ...config, ...updates };
    setConfig(nova);
    await supabase.from("configuracoes").upsert({ ...nova, user_id: user.id });
  };

  return (
    <ConfigContext.Provider value={{ config, salvarConfig, userId }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => useContext(ConfigContext);
