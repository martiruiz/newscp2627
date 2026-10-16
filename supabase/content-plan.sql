-- "Org" / Planner is now called "Content Plan". Renames the plan shown on the website and in Admin → Plans & AI
-- (only if it still has the old default name). Data, prices and permissions don't change. Safe to re-run.
update public.plans set name = 'Library + Content Plan', updated_at = now()
where key = 'library_planner' and name = 'Library + Planner';
