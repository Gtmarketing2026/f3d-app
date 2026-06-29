-- 1. Tabela de licenças
create table public.licencas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  modulos text[] default '{}',
  plano text default 'nenhum',
  asaas_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint licencas_user_id_key unique (user_id)
);

-- 2. Segurança: cada usuário só vê a própria licença
alter table public.licencas enable row level security;

create policy "Usuário lê própria licença"
  on public.licencas for select
  using (auth.uid() = user_id);

-- 3. Cria licença vazia automaticamente quando usuário se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.licencas (user_id, modulos, plano)
  values (new.id, '{}', 'nenhum');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Habilita Realtime na tabela (necessário para atualização automática após pagamento)
alter publication supabase_realtime add table public.licencas;
