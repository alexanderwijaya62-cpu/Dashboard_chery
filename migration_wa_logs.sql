-- Table for WhatsApp message logs (Kirimdev webhook)
create table if not exists wa_logs (
  id          bigserial primary key,
  created_at  timestamptz default now(),
  event       text,
  sender      text,
  message_type text,
  text        text,
  raw_body    jsonb,
  status      text default 'received'
);

-- Quick filter by sender/time
create index if not exists idx_wa_logs_sender on wa_logs (sender, created_at desc);
create index if not exists idx_wa_logs_created on wa_logs (created_at desc);

-- RLS: only service role can access
alter table wa_logs enable row level security;
