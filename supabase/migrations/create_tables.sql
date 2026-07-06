-- vendas
create table if not exists vendas (
  id bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  produto text default '',
  canal text default '',
  cliente text default '',
  qtd integer default 1,
  valor numeric(12,2) default 0,
  custo numeric(12,2) default 0,
  lucro numeric(12,2) default 0,
  data text default '',
  pagamento text default 'pix',
  parcelas integer default 1,
  status text default 'pago',
  primary key (id, user_id)
);
alter table vendas enable row level security;
create policy "vendas_own" on vendas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- despesas (usa coluna "descricao" pq "desc" é reservado em SQL)
create table if not exists despesas (
  id bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  descricao text default '',
  categoria text default 'outros',
  valor numeric(12,2) default 0,
  data text default '',
  primary key (id, user_id)
);
alter table despesas enable row level security;
create policy "despesas_own" on despesas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- orcamentos (id é text porque ids de vitrine são "vitrine-123")
create table if not exists orcamentos (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  numero text default '',
  cliente text default '',
  contato text default '',
  validade text default '',
  obs text default '',
  itens jsonb default '[]',
  total numeric(12,2) default 0,
  status text default 'pendente',
  motivo text default null,
  criado_em text default '',
  origem text default 'manual',
  vitrine_id bigint default null,
  primary key (id, user_id)
);
alter table orcamentos enable row level security;
create policy "orcamentos_own" on orcamentos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- habilitar realtime
alter publication supabase_realtime add table vendas;
alter publication supabase_realtime add table despesas;
alter publication supabase_realtime add table orcamentos;
alter publication supabase_realtime add table catalogo;
