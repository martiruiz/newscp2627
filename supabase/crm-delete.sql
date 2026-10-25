-- CRM: delete a lead / client (admins only). Run once in the Supabase SQL editor, after crm.sql.
create or replace function public.admin_delete_lead(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  delete from public.leads where id = p_id;
end $$;
revoke execute on function public.admin_delete_lead(uuid) from public, anon;
grant execute on function public.admin_delete_lead(uuid) to authenticated;
