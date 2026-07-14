-- Estoque: filamentos e insumos por usuário
create table if not exists estoque_filamentos (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text default 'PLA',
  cor text default '',
  peso_total_g numeric default 1000,
  peso_restante_g numeric default 1000,
  preco_kg numeric default 120,
  alerta numeric default 200,
  primary key (id, user_id)
);
alter table estoque_filamentos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='estoque_filamentos' and policyname='estoque_fil_own') then
    execute 'create policy "estoque_fil_own" on estoque_filamentos for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;
alter publication supabase_realtime add table estoque_filamentos;

create table if not exists estoque_insumos (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text default '',
  categoria text default 'outro',
  quantidade numeric default 0,
  unidade text default 'un',
  alerta numeric default 5,
  preco_unit numeric default 0,
  primary key (id, user_id)
);
alter table estoque_insumos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='estoque_insumos' and policyname='estoque_ins_own') then
    execute 'create policy "estoque_ins_own" on estoque_insumos for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;
alter publication supabase_realtime add table estoque_insumos;
