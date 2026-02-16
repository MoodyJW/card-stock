-- Enable pg_net if not already enabled
create extension if not exists pg_net with schema extensions;

-- Create a function to call the Edge Function via the internal Kong gateway
create or replace function public.handle_new_invite()
returns trigger as $$
begin
  perform
    net.http_post(
      url := 'http://kong:8000/functions/v1/send-invite',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'invites',
        'record', row_to_json(new),
        'schema', 'public',
        'old_record', null
      )
    );
  return new;
end;
$$ language plpgsql security definer;

-- Create the trigger
create trigger on_invite_created
  after insert on public.invites
  for each row execute procedure public.handle_new_invite();
