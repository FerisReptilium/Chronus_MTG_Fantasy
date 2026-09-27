-- CHRONUS PORTAL v3 - execute in Supabase SQL Editor on a clean project
create extension if not exists pgcrypto;

drop table if exists public.characters cascade;
drop table if exists public.campaign_members cascade;
drop table if exists public.campaigns cascade;

create table public.campaigns(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 120),
 invite_code text not null unique,
 created_at timestamptz not null default now()
);
create table public.campaign_members(
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in('mestre','jogador')),
 created_at timestamptz not null default now(),
 unique(campaign_id,user_id)
);
create table public.characters(
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 character_name text not null default '',
 sheet_data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(campaign_id,user_id)
);
create index campaign_members_campaign_idx on public.campaign_members(campaign_id);
create index campaign_members_user_idx on public.campaign_members(user_id);
create index characters_campaign_idx on public.characters(campaign_id);
create index characters_user_idx on public.characters(user_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create trigger characters_touch before update on public.characters for each row execute function public.touch_updated_at();

create or replace function public.is_campaign_owner(p uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from campaigns where id=p and owner_id=auth.uid())$$;
create or replace function public.is_campaign_member(p uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from campaign_members where campaign_id=p and user_id=auth.uid())$$;

create or replace function public.create_campaign(p_name text) returns public.campaigns language plpgsql security definer set search_path=public as $$
declare c public.campaigns; code text;
begin
 if auth.uid() is null then raise exception 'Não autenticado'; end if;
 loop
  code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  exit when not exists(select 1 from campaigns where invite_code=code);
 end loop;
 insert into campaigns(owner_id,name,invite_code) values(auth.uid(),trim(p_name),code) returning * into c;
 insert into campaign_members(campaign_id,user_id,role) values(c.id,auth.uid(),'mestre');
 return c;
end$$;

create or replace function public.join_campaign(p_invite_code text) returns public.campaign_members language plpgsql security definer set search_path=public as $$
declare c public.campaigns;m public.campaign_members; n int;
begin
 if auth.uid() is null then raise exception 'Não autenticado'; end if;
 select * into c from campaigns where invite_code=upper(trim(p_invite_code)) for update;
 if not found then raise exception 'Código de convite inválido'; end if;
 if exists(select 1 from campaign_members where campaign_id=c.id and user_id=auth.uid()) then select * into m from campaign_members where campaign_id=c.id and user_id=auth.uid();return m;end if;
 select count(*) into n from campaign_members where campaign_id=c.id and role='jogador';
 if n>=10 then raise exception 'Esta campanha já possui 10 jogadores'; end if;
 insert into campaign_members(campaign_id,user_id,role) values(c.id,auth.uid(),'jogador') returning * into m;return m;
end$$;

grant execute on function public.create_campaign(text) to authenticated;
grant execute on function public.join_campaign(text) to authenticated;

grant select,insert,update,delete on public.campaigns to authenticated;
grant select,insert,update,delete on public.campaign_members to authenticated;
grant select,insert,update,delete on public.characters to authenticated;

alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.characters enable row level security;
create policy campaigns_select on public.campaigns for select to authenticated using(owner_id=auth.uid() or public.is_campaign_member(id));
create policy campaigns_insert on public.campaigns for insert to authenticated with check(owner_id=auth.uid());
create policy campaigns_update on public.campaigns for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy campaigns_delete on public.campaigns for delete to authenticated using(owner_id=auth.uid());
create policy members_select on public.campaign_members for select to authenticated using(user_id=auth.uid() or public.is_campaign_owner(campaign_id));
create policy members_insert on public.campaign_members for insert to authenticated with check(user_id=auth.uid() or public.is_campaign_owner(campaign_id));
create policy members_delete on public.campaign_members for delete to authenticated using(public.is_campaign_owner(campaign_id) or user_id=auth.uid());
create policy chars_select on public.characters for select to authenticated using(user_id=auth.uid() or public.is_campaign_owner(campaign_id));
create policy chars_insert on public.characters for insert to authenticated with check(user_id=auth.uid() and public.is_campaign_member(campaign_id));
create policy chars_update on public.characters for update to authenticated using(user_id=auth.uid() or public.is_campaign_owner(campaign_id)) with check(user_id=auth.uid() or public.is_campaign_owner(campaign_id));
create policy chars_delete on public.characters for delete to authenticated using(user_id=auth.uid() or public.is_campaign_owner(campaign_id));

insert into storage.buckets(id,name,public) values('character-art','character-art',false) on conflict(id) do update set public=false;
create policy art_insert on storage.objects for insert to authenticated with check(bucket_id='character-art' and split_part(name,'/',1)=auth.uid()::text);
create policy art_update on storage.objects for update to authenticated using(bucket_id='character-art' and split_part(name,'/',1)=auth.uid()::text);
create policy art_delete on storage.objects for delete to authenticated using(bucket_id='character-art' and split_part(name,'/',1)=auth.uid()::text);
create policy art_select on storage.objects for select to authenticated using(bucket_id='character-art' and (split_part(name,'/',1)=auth.uid()::text or exists(select 1 from campaigns c where c.id=(split_part(name,'/',2))::uuid and c.owner_id=auth.uid())));
