-- Take Your Pills: database setup.
-- Paste this whole file into Supabase → SQL Editor → New query, and click Run.

create extension if not exists pgcrypto;

-- One row of settings for Gloria's household.
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  gloria_name text not null default 'Gloria',
  caregiver_name text not null default 'Bonnie',
  caregiver_phone text not null default '',
  timezone text not null default 'America/New_York',
  device_code text  -- the setup code Gloria's phone uses; set from Bonnie's page
);
insert into settings (id) values (1) on conflict do nothing;

-- People allowed to use Bonnie's page (their Supabase login email).
create table if not exists caregivers (
  email text primary key
);

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  strength text not null default '',
  amount text not null default '',
  times text[] not null default '{}',          -- 'HH:MM' in Gloria's local time
  as_needed boolean not null default false,
  max_per_day int,
  purpose text not null default '',
  instructions text not null default '',
  appearance text not null default '',
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dose_log (
  id uuid primary key,                           -- made on the phone, so retries don't double up
  taken_at timestamptz not null,
  local_date text not null,                      -- 'YYYY-MM-DD' on Gloria's phone
  medication_id uuid references medications(id) on delete set null,
  name text not null,
  amount text not null default '',
  prescribed boolean not null default false,
  scheduled_for text,                            -- which 'HH:MM' dose this was, if any
  warnings jsonb not null default '[]',          -- warnings she saw and chose to go ahead anyway
  created_at timestamptz not null default now()
);
create index if not exists dose_log_taken_at on dose_log (taken_at);

create table if not exists push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists reminders_sent (
  local_date text not null,
  time text not null,
  kind text not null,                            -- 'due' or 'nudge'
  sent_at timestamptz not null default now(),
  primary key (local_date, time, kind)
);

-- Medical appointments. Date and time are wall-clock, in Gloria's time zone.
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  date text not null,                            -- 'YYYY-MM-DD'
  time text not null,                            -- 'HH:MM'
  doctor text not null default '',               -- who she is seeing
  purpose text not null default '',              -- what it's for
  place text not null default '',
  details text not null default '',              -- e.g. "Bring your medicine list"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_date on appointments (date);

-- Voice notes Gloria records after an appointment. The audio itself is in the
-- private "audio-notes" storage bucket.
create table if not exists audio_notes (
  id uuid primary key,                           -- made on the phone, so retries don't double up
  appointment_id uuid not null references appointments(id) on delete cascade,
  path text not null,
  mime text not null default '',
  duration_s numeric,
  created_at timestamptz not null default now()
);
create index if not exists audio_notes_appointment on audio_notes (appointment_id);
alter table audio_notes add column if not exists added_by text not null default 'gloria';  -- 'gloria' or 'caregiver'
alter table audio_notes add column if not exists label text not null default '';           -- file name, for uploads

insert into storage.buckets (id, name, public, file_size_limit)
values ('audio-notes', 'audio-notes', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- ---------------------------------------------------------------- security
alter table settings enable row level security;
alter table caregivers enable row level security;
alter table medications enable row level security;
alter table dose_log enable row level security;
alter table push_subscriptions enable row level security;
alter table reminders_sent enable row level security;
alter table appointments enable row level security;
alter table audio_notes enable row level security;

create or replace function is_caregiver() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from caregivers where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists caregivers_all on settings;
create policy caregivers_all on settings for all to authenticated using (is_caregiver()) with check (is_caregiver());
drop policy if exists caregivers_all on medications;
create policy caregivers_all on medications for all to authenticated using (is_caregiver()) with check (is_caregiver());
drop policy if exists caregivers_all on dose_log;
create policy caregivers_all on dose_log for all to authenticated using (is_caregiver()) with check (is_caregiver());
drop policy if exists caregivers_all on appointments;
create policy caregivers_all on appointments for all to authenticated using (is_caregiver()) with check (is_caregiver());
drop policy if exists caregivers_all on audio_notes;
create policy caregivers_all on audio_notes for all to authenticated using (is_caregiver()) with check (is_caregiver());

-- Caregivers can play and delete voice notes. Gloria's phone goes through the gloria-notes function.
drop policy if exists audio_notes_caregivers_read on storage.objects;
create policy audio_notes_caregivers_read on storage.objects for select to authenticated
  using (bucket_id = 'audio-notes' and public.is_caregiver());
drop policy if exists audio_notes_caregivers_upload on storage.objects;
create policy audio_notes_caregivers_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'audio-notes' and public.is_caregiver());
drop policy if exists audio_notes_caregivers_delete on storage.objects;
create policy audio_notes_caregivers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'audio-notes' and public.is_caregiver());
-- caregivers, push_subscriptions and reminders_sent have no policies: only the functions below and
-- the reminder sender (service role) can touch them.

-- ---------------------------------------------------------------- Gloria's phone
-- Her phone has no login. It holds a long random setup code instead, and can only
-- do these three things with it.

create or replace function gloria_code_ok(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from settings
    where device_code is not null and length(device_code) >= 10 and device_code = upper(coalesce(p_code, ''))
  );
$$;

create or replace function gloria_data(p_code text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not gloria_code_ok(p_code) then
    return null;
  end if;
  return json_build_object(
    'settings', (select json_build_object(
        'gloria_name', gloria_name, 'caregiver_name', caregiver_name,
        'caregiver_phone', caregiver_phone, 'timezone', timezone)
      from settings where id = 1),
    'medications', coalesce((select json_agg(m order by m.sort, m.name) from medications m where m.active), '[]'::json),
    'log', coalesce((select json_agg(l order by l.taken_at) from dose_log l
                     where l.taken_at > now() - interval '2 days'), '[]'::json),
    'appointments', coalesce((select json_agg(json_build_object(
        'id', a.id, 'date', a.date, 'time', a.time, 'doctor', a.doctor, 'purpose', a.purpose,
        'place', a.place, 'details', a.details,
        'audio', coalesce((select json_agg(json_build_object('id', n.id, 'created_at', n.created_at, 'duration_s', n.duration_s,
                                                     'added_by', n.added_by)
                                    order by n.created_at) from audio_notes n where n.appointment_id = a.id), '[]'::json)
      ) order by a.date, a.time) from appointments a), '[]'::json)
  );
end;
$$;

-- Her pill history, 60 days at a time, newest first. p_before is a 'YYYY-MM-DD' day (not included).
create or replace function gloria_history(p_code text, p_before text, p_days int default 60) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_from text;
begin
  if not gloria_code_ok(p_code) then
    return null;
  end if;
  v_from := to_char(p_before::date - greatest(1, least(p_days, 366)), 'YYYY-MM-DD');
  return json_build_object(
    'from', v_from,
    'entries', coalesce((select json_agg(l order by l.taken_at desc) from dose_log l
                         where l.local_date < p_before and l.local_date >= v_from), '[]'::json),
    'more', exists (select 1 from dose_log where local_date < v_from)
  );
end;
$$;

create or replace function gloria_log(p_code text, p_entries jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not gloria_code_ok(p_code) then
    raise exception 'invalid setup code';
  end if;
  insert into dose_log (id, taken_at, local_date, medication_id, name, amount, prescribed, scheduled_for, warnings)
  select (e ->> 'id')::uuid,
         (e ->> 'taken_at')::timestamptz,
         e ->> 'local_date',
         (select id from medications where id::text = e ->> 'medication_id'),
         left(coalesce(e ->> 'name', '?'), 200),
         left(coalesce(e ->> 'amount', ''), 200),
         coalesce((e ->> 'prescribed')::boolean, false),
         e ->> 'scheduled_for',
         coalesce(e -> 'warnings', '[]'::jsonb)
  from jsonb_array_elements(p_entries) e
  on conflict (id) do nothing;
end;
$$;

create or replace function gloria_subscribe(p_code text, p_subscription jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not gloria_code_ok(p_code) then
    raise exception 'invalid setup code';
  end if;
  insert into push_subscriptions (endpoint, subscription)
  values (p_subscription ->> 'endpoint', p_subscription)
  on conflict (endpoint) do update set subscription = excluded.subscription;
end;
$$;

revoke execute on function gloria_data(text), gloria_log(text, jsonb), gloria_subscribe(text, jsonb), gloria_code_ok(text),
  gloria_history(text, text, int) from public;
grant execute on function gloria_data(text), gloria_log(text, jsonb), gloria_subscribe(text, jsonb),
  gloria_history(text, text, int) to anon, authenticated;
