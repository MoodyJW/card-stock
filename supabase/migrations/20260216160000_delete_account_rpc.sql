-- Create a function to safely delete a user account and their data
-- This function checks if the user is the sole owner of any organization before deletion.

create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  owned_org_count int;
  org_record record;
begin
  current_user_id := auth.uid();

  -- 1. Check if user is the sole owner of any organization
  for org_record in 
    select o.id, o.name
    from organizations o
    join memberships m on m.organization_id = o.id
    where m.user_id = current_user_id
    and m.role = 'owner'
    and o.deleted_at is null
  loop
    -- Count total owners for this organization (lock rows to prevent race)
    select count(*) into owned_org_count
    from (
      select 1 from memberships
      where organization_id = org_record.id
      and role = 'owner'
      for update
    ) locked_owners;

    if owned_org_count = 1 then
      raise exception 'Cannot delete account: You are the sole owner of "%". Please transfer ownership or delete the store first.', org_record.name;
    end if;
  end loop;

  -- 2. Clean up user data

  -- Revoke pending invites sent by this user
  update invites set revoked_at = now()
    where invited_by = current_user_id
    and accepted_at is null
    and revoked_at is null;

  -- Nullify FK references in tables that don't cascade on user delete
  update inventory set created_by = null where created_by = current_user_id;
  update inventory set updated_by = null where updated_by = current_user_id;
  update transactions set sold_by = null where sold_by = current_user_id;
  update inventory_images set created_by = null where created_by = current_user_id;
  update invites set invited_by = null where invited_by = current_user_id;
  update memberships set invited_by = null where invited_by = current_user_id;

  -- Remove from all organizations (memberships)
  -- NOTE: this may trigger audit_log inserts referencing the user
  delete from memberships where user_id = current_user_id;

  -- Delete public profile
  delete from profiles where user_id = current_user_id;

  -- Nullify audit_log LAST since membership deletion triggers may have created new rows
  update audit_log set changed_by = null where changed_by = current_user_id;

  -- 3. Delete the auth user (SECURITY DEFINER gives us access to auth schema)
  delete from auth.users where id = current_user_id;
end;
$$;

-- Allow authenticated users to call this function
grant execute on function delete_account() to authenticated;
