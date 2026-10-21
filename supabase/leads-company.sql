-- Contact form: new organisation type "Sports company" (company), after Agency. Run once in Supabase > SQL editor. Safe to run again.
create or replace function public.lead_valid(p_kind text, p_value text)
returns boolean language sql immutable as $$
  select case p_kind
    when 'org_type'  then p_value in ('club', 'agency', 'company', 'league', 'event', 'creator', 'other')
    when 'team_size' then p_value in ('1', '2-5', '6-15', '15+')
    when 'challenge' then p_value in ('ideas', 'ai_time', 'calendar', 'performance', 'multiple_teams', 'exploring')
    else false end;
$$;
