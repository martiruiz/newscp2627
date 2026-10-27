-- The four sample flows for Admin → Newsletter → Automations, created as DRAFTS with editable e-mails (English + Spanish;
-- other languages fall back to English). Nothing runs until a superadmin publishes and activates a flow.
-- No prices, plan names, discounts or testimonials in the copy: {{plan_name}} and {{pricing_url}} come from SCP's settings.
-- Run once after supabase/automations.sql. Safe to run again (skips flows that already exist).

create or replace function pg_temp.mail(p_name text, p_category text, p_en jsonb, p_es jsonb)
returns bigint language sql as $$
  insert into public.automation_emails (name, category, content, fallback_locale)
  values (p_name, p_category, jsonb_build_object('en', p_en, 'es', p_es), 'en') returning id;
$$;
create or replace function pg_temp.v(p_subject text, p_pre text, p_text text, p_label text, p_url text)
returns jsonb language sql as $$
  select jsonb_build_object('subject', p_subject, 'preheader', p_pre, 'blocks', jsonb_build_array(
    jsonb_build_object('type', 'text', 'text', p_text),
    jsonb_build_object('type', 'button', 'label', p_label, 'url', p_url)));
$$;

do $$
declare e0 bigint; e1 bigint; e3a bigint; e3b bigint; e5 bigint; e6 bigint; e7 bigint; r1 bigint; r2 bigint; w1 bigint; w2 bigint; w3 bigint; c1 bigint; c2 bigint;
begin
  -- ---------- Flow 1: 7-day trial activation and conversion ----------
  if not exists (select 1 from public.automation_flows where template_key = 'trial_7d') then
    e0 := pg_temp.mail('Trial · welcome + first action', 'service',
      pg_temp.v('Your trial is on: start with one search', 'Two minutes to find the first idea for {{org_name}}.',
        E'Hi {{first_name|there}},\n\nYour Sports Content Playbook trial has started. The quickest way to see if it\'s useful for you: **search for a club, league or competition close to yours** and open three posts that catch your eye.\n\nEach post shows why it worked and how you could adapt it. Save the ones you like in a folder — you\'ll use them later this week.',
        'Open the Content Library', '{{platform_url}}'),
      pg_temp.v('Tu prueba ha empezado: empieza con una búsqueda', 'Dos minutos para encontrar la primera idea para {{org_name}}.',
        E'Hola {{first_name|}},\n\nTu prueba de Sports Content Playbook ya está activa. La forma más rápida de ver si te sirve: **busca un club, liga o competición parecida a la tuya** y abre tres posts que te llamen la atención.\n\nCada post explica por qué funcionó y cómo adaptarlo. Guarda los que te gusten en una carpeta: los usarás esta semana.',
        'Abrir la biblioteca', '{{platform_url}}'));
    e1 := pg_temp.mail('Trial · day 1 · ideas for your club', 'service',
      pg_temp.v('3 filters that find ideas for {{org_name}}', 'Sport, competition and format: the fastest way to relevant posts.',
        E'Hi {{first_name|there}},\n\nMost people get the best results from the library with three filters:\n\n**Sport and competition** — posts from clubs that play where you play.\n**Format** — reels, carousels or photos, depending on what your team can produce this week.\n**Type of content** — signings, matchday, sponsors, community…\n\nTry one combination and save two ideas you could post this month.',
        'Find ideas for my club', '{{platform_url}}'),
      pg_temp.v('3 filtros para encontrar ideas para {{org_name}}', 'Deporte, competición y formato: el camino más corto a posts relevantes.',
        E'Hola {{first_name|}},\n\nLa mayoría saca más partido a la biblioteca con tres filtros:\n\n**Deporte y competición**: posts de clubes que juegan donde juegas tú.\n**Formato**: reels, carruseles o fotos, según lo que tu equipo pueda producir esta semana.\n**Tipo de contenido**: fichajes, matchday, patrocinadores, comunidad…\n\nPrueba una combinación y guarda dos ideas que podrías publicar este mes.',
        'Buscar ideas para mi club', '{{platform_url}}'));
    e3a := pg_temp.mail('Trial · day 3 · help to get started (no saves yet)', 'service',
      pg_temp.v('A 5-minute routine to get started', 'No ideas saved yet? Here''s the simplest way in.',
        E'Hi {{first_name|there}},\n\nWe noticed you haven\'t saved any ideas yet — totally normal in the first days. Here\'s a 5-minute routine many content teams use:\n\n1. Pick your next match or announcement.\n2. Search for that moment in the library (for example "matchday" or "signing").\n3. Save the two posts you\'d be happy to adapt.\n\nIf something isn\'t clear or you can\'t find what you need, just reply to this e-mail.',
        'Try the 5-minute routine', '{{platform_url}}'),
      pg_temp.v('Una rutina de 5 minutos para empezar', '¿Aún sin ideas guardadas? Esta es la forma más sencilla.',
        E'Hola {{first_name|}},\n\nVemos que aún no has guardado ninguna idea, algo muy normal los primeros días. Esta es una rutina de 5 minutos que usan muchos equipos de contenido:\n\n1. Elige tu próximo partido o anuncio.\n2. Busca ese momento en la biblioteca (por ejemplo, "matchday" o "fichaje").\n3. Guarda los dos posts que adaptarías encantado.\n\nSi algo no está claro o no encuentras lo que buscas, responde a este correo.',
        'Probar la rutina', '{{platform_url}}'));
    e3b := pg_temp.mail('Trial · day 3 · next step (has saved ideas)', 'commercial',
      pg_temp.v('From saved ideas to a week of content', 'You''ve saved ideas. Here''s how to turn them into posts.',
        E'Hi {{first_name|there}},\n\nYou\'ve already saved ideas — good start. The next step is turning them into a plan: give each saved idea a date and a format, and adapt the copy to {{org_name}}.\n\nTeams that plan a full week ahead spend less time deciding what to post and more time making it.',
        'Plan my week', '{{platform_url}}'),
      pg_temp.v('De ideas guardadas a una semana de contenido', 'Ya has guardado ideas. Así las conviertes en posts.',
        E'Hola {{first_name|}},\n\nYa has guardado ideas: buen comienzo. El siguiente paso es convertirlas en un plan: pon fecha y formato a cada idea guardada y adapta el texto a {{org_name}}.\n\nLos equipos que planifican la semana completa dedican menos tiempo a decidir qué publicar y más a producirlo.',
        'Planificar mi semana', '{{platform_url}}'));
    e5 := pg_temp.mail('Trial · day 5 · SCP in your real work', 'commercial',
      pg_temp.v('How a matchday week looks with SCP', 'A practical example you can copy for your next match.',
        E'Hi {{first_name|there}},\n\nA practical example for your next match week:\n\n**Monday** — search the library for build-up posts from your competition and save three.\n**Wednesday** — adapt one to your squad: same structure, your players and your tone.\n**Matchday** — use a saved post as the template for line-up and result.\n\nThe point isn\'t to copy, it\'s to start from something proven instead of a blank page.',
        'Prepare my next match', '{{platform_url}}'),
      pg_temp.v('Así es una semana de partido con SCP', 'Un ejemplo práctico para tu próximo partido.',
        E'Hola {{first_name|}},\n\nUn ejemplo práctico para tu próxima semana de partido:\n\n**Lunes**: busca en la biblioteca posts previos de tu competición y guarda tres.\n**Miércoles**: adapta uno a tu plantilla: misma estructura, tus jugadores y tu tono.\n**Día de partido**: usa un post guardado como plantilla para la alineación y el resultado.\n\nNo se trata de copiar, sino de empezar desde algo que ya ha funcionado en lugar de una página en blanco.',
        'Preparar mi próximo partido', '{{platform_url}}'));
    e6 := pg_temp.mail('Trial · 24 h before the end', 'commercial',
      pg_temp.v('Your trial ends on {{trial_end_date}}', 'Keep your saved ideas and the full library.',
        E'Hi {{first_name|there}},\n\nYour trial ends on **{{trial_end_date}}**. To keep using the library, your saved folders and everything in {{plan_name}}, you don\'t need to do anything if you already added a payment method — otherwise you can choose a plan now.\n\nYou can compare the plans and what each one includes on the pricing page.',
        'See the plans', '{{pricing_url}}'),
      pg_temp.v('Tu prueba termina el {{trial_end_date}}', 'Conserva tus ideas guardadas y toda la biblioteca.',
        E'Hola {{first_name|}},\n\nTu prueba termina el **{{trial_end_date}}**. Para seguir usando la biblioteca, tus carpetas y todo lo que incluye {{plan_name}}, no tienes que hacer nada si ya añadiste un método de pago; si no, puedes elegir un plan ahora.\n\nEn la página de precios puedes comparar los planes y lo que incluye cada uno.',
        'Ver los planes', '{{pricing_url}}'));
    e7 := pg_temp.mail('Trial · ended without subscription', 'commercial',
      pg_temp.v('Your trial has ended — here''s how to continue', 'Your account and saved ideas are still there.',
        E'Hi {{first_name|there}},\n\nYour trial has ended. Your account is still there, and you can continue whenever you want by choosing a plan.\n\nIf SCP wasn\'t what you needed, we\'d really like to know why: just reply with one line.',
        'Choose a plan', '{{pricing_url}}'),
      pg_temp.v('Tu prueba ha terminado: así puedes continuar', 'Tu cuenta y tus ideas guardadas siguen ahí.',
        E'Hola {{first_name|}},\n\nTu prueba ha terminado. Tu cuenta sigue ahí y puedes continuar cuando quieras eligiendo un plan.\n\nSi SCP no era lo que necesitabas, nos gustaría mucho saber por qué: responde con una línea.',
        'Elegir un plan', '{{pricing_url}}'));
    insert into public.automation_flows (name, goal, priority, template_key, replaces, definition) values (
      'Trial: activation and conversion (7 days)', 'Help trial users find value in the first days and become customers.', 10, 'trial_7d',
      array['trial_welcome', 'trial_tips'],
      jsonb_build_object('trigger', jsonb_build_object('type', 'trial_started'), 'entry', jsonb_build_object('mode', 'once'), 'exit', jsonb_build_object('on_paid', true), 'start', 's1',
        'steps', jsonb_build_object(
          's1', jsonb_build_object('type', 'email', 'email_id', e0, 'next', 's2'),
          's2', jsonb_build_object('type', 'wait', 'mode', 'duration', 'amount', 1, 'unit', 'days', 'next', 's3'),
          's3', jsonb_build_object('type', 'email', 'email_id', e1, 'next', 's4'),
          's4', jsonb_build_object('type', 'wait', 'mode', 'duration', 'amount', 2, 'unit', 'days', 'next', 's5'),
          's5', jsonb_build_object('type', 'condition', 'logic', 'and', 'rules', jsonb_build_array(jsonb_build_object('field', 'saved_idea', 'op', 'is', 'value', true)), 'yes', 's6', 'no', 's7', 'next', 's8'),
          's6', jsonb_build_object('type', 'email', 'email_id', e3b),
          's7', jsonb_build_object('type', 'email', 'email_id', e3a),
          's8', jsonb_build_object('type', 'wait', 'mode', 'duration', 'amount', 2, 'unit', 'days', 'next', 's9'),
          's9', jsonb_build_object('type', 'email', 'email_id', e5, 'next', 's10'),
          's10', jsonb_build_object('type', 'wait', 'mode', 'until_event', 'anchor', 'trial_end', 'offset_hours', -24, 'if_past', 'skip_next_email', 'next', 's11'),
          's11', jsonb_build_object('type', 'email', 'email_id', e6, 'next', 's12'),
          's12', jsonb_build_object('type', 'wait', 'mode', 'until_event', 'anchor', 'trial_end', 'offset_hours', 3, 'if_past', 'continue', 'next', 's13'),
          's13', jsonb_build_object('type', 'condition', 'logic', 'and', 'rules', jsonb_build_array(jsonb_build_object('field', 'trial_ended_unpaid', 'op', 'is', 'value', true)), 'yes', 's14'),
          's14', jsonb_build_object('type', 'email', 'email_id', e7))));
  end if;

  -- ---------- Flow 2: signed up but not activated ----------
  if not exists (select 1 from public.automation_flows where template_key = 'no_activation') then
    w1 := pg_temp.mail('No activation · first simple action', 'commercial',
      pg_temp.v('One search is enough to start', 'Find a content idea from a club like yours in two minutes.',
        E'Hi {{first_name|there}},\n\nYou created your Sports Content Playbook account but haven\'t saved an idea yet. The simplest way to start: **search for a club or competition like yours and save one post** you\'d like to adapt.\n\nThat\'s it — it takes two minutes.',
        'Save my first idea', '{{platform_url}}'),
      pg_temp.v('Con una búsqueda basta para empezar', 'Encuentra en dos minutos una idea de un club como el tuyo.',
        E'Hola {{first_name|}},\n\nCreaste tu cuenta en Sports Content Playbook pero aún no has guardado ninguna idea. La forma más sencilla de empezar: **busca un club o una competición como la tuya y guarda un post** que te gustaría adaptar.\n\nNada más: son dos minutos.',
        'Guardar mi primera idea', '{{platform_url}}'));
    w2 := pg_temp.mail('No activation · practical example', 'commercial',
      pg_temp.v('An idea you could post this week', 'A practical example for sports content teams.',
        E'Hi {{first_name|there}},\n\nAn example of how content teams use SCP: before announcing a signing, they search "signing" in the library, filter by their sport and compare how other clubs revealed theirs — teaser, video, carousel.\n\nThey pick the structure that fits their resources and adapt it. You can do the same for your next announcement.',
        'See signing announcements', '{{platform_url}}'),
      pg_temp.v('Una idea que podrías publicar esta semana', 'Un ejemplo práctico para equipos de contenido deportivo.',
        E'Hola {{first_name|}},\n\nUn ejemplo de cómo usan SCP los equipos de contenido: antes de anunciar un fichaje, buscan "fichaje" en la biblioteca, filtran por su deporte y comparan cómo lo anunciaron otros clubes: teaser, vídeo o carrusel.\n\nEligen la estructura que encaja con sus recursos y la adaptan. Puedes hacer lo mismo con tu próximo anuncio.',
        'Ver anuncios de fichajes', '{{platform_url}}'));
    insert into public.automation_flows (name, goal, priority, template_key, definition) values (
      'Signed up, not activated', 'Get new accounts to save their first idea (activation = first saved idea).', 30, 'no_activation',
      jsonb_build_object('trigger', jsonb_build_object('type', 'signup'), 'entry', jsonb_build_object('mode', 'once'), 'exit', jsonb_build_object('on_paid', true), 'start', 'a1',
        'steps', jsonb_build_object(
          'a1', jsonb_build_object('type', 'wait', 'mode', 'duration', 'amount', 24, 'unit', 'hours', 'next', 'a2'),
          'a2', jsonb_build_object('type', 'condition', 'logic', 'and', 'rules', jsonb_build_array(
              jsonb_build_object('field', 'saved_idea', 'op', 'is', 'value', false), jsonb_build_object('field', 'in_trial', 'op', 'is', 'value', false)),
            'yes', 'a3', 'no', 'a4', 'next', 'a5'),
          'a3', jsonb_build_object('type', 'email', 'email_id', w1),
          'a4', jsonb_build_object('type', 'end', 'reason', 'goal met'),
          'a5', jsonb_build_object('type', 'wait', 'mode', 'duration', 'amount', 3, 'unit', 'days', 'next', 'a6'),
          'a6', jsonb_build_object('type', 'condition', 'logic', 'and', 'rules', jsonb_build_array(
              jsonb_build_object('field', 'saved_idea', 'op', 'is', 'value', false), jsonb_build_object('field', 'in_trial', 'op', 'is', 'value', false)),
            'yes', 'a7', 'no', 'a8'),
          'a7', jsonb_build_object('type', 'email', 'email_id', w2),
          'a8', jsonb_build_object('type', 'end', 'reason', 'goal met'))));
  end if;

  -- ---------- Flow 3: win-back after the trial ----------
  if not exists (select 1 from public.automation_flows where template_key = 'trial_winback') then
    r1 := pg_temp.mail('Win-back · day 2 · the value', 'commercial',
      pg_temp.v('What you can still do with SCP', 'Your saved ideas are waiting.',
        E'Hi {{first_name|there}},\n\nA couple of days ago your trial ended. A reminder of what SCP is for: finding proven content ideas from clubs, leagues and brands, understanding why they worked, and adapting them to {{org_name}}.\n\nYour account and saved ideas are still there if you want to pick it up again.',
        'Back to the library', '{{platform_url}}'),
      pg_temp.v('Lo que aún puedes hacer con SCP', 'Tus ideas guardadas te esperan.',
        E'Hola {{first_name|}},\n\nHace un par de días terminó tu prueba. Te recordamos para qué sirve SCP: encontrar ideas de contenido que ya han funcionado en clubes, ligas y marcas, entender por qué funcionaron y adaptarlas a {{org_name}}.\n\nTu cuenta y tus ideas guardadas siguen ahí si quieres retomarlo.',
        'Volver a la biblioteca', '{{platform_url}}'));
    r2 := pg_temp.mail('Win-back · day 5 · common doubts', 'commercial',
      pg_temp.v('"I don''t have time" and other doubts', 'Short answers to the questions we hear most.',
        E'Hi {{first_name|there}},\n\nSome doubts we hear often:\n\n**"I don\'t have time."** SCP is meant to save time: you start from a proven idea instead of a blank page.\n**"My club is small."** The library includes clubs and competitions of every size; filter by yours.\n**"I\'m not sure which plan fits."** The pricing page compares what each plan includes, and you can change plan later.',
        'Compare the plans', '{{pricing_url}}'),
      pg_temp.v('"No tengo tiempo" y otras dudas', 'Respuestas breves a las preguntas que más nos hacen.',
        E'Hola {{first_name|}},\n\nAlgunas dudas que nos llegan a menudo:\n\n**"No tengo tiempo."** SCP está pensado para ahorrarlo: empiezas desde una idea probada en lugar de una página en blanco.\n**"Mi club es pequeño."** La biblioteca incluye clubes y competiciones de todos los tamaños; filtra por la tuya.\n**"No sé qué plan me conviene."** En la página de precios puedes comparar lo que incluye cada plan, y puedes cambiar de plan más adelante.',
        'Comparar los planes', '{{pricing_url}}'));
    c1 := pg_temp.mail('Win-back · day 10 · invitation or feedback', 'commercial',
      pg_temp.v('Should we keep a place for you?', 'Come back, or tell us what was missing.',
        E'Hi {{first_name|there}},\n\nThis is our last e-mail about your trial. If you\'d like to continue, you can choose a plan at any time.\n\nAnd if something was missing for you, reply and tell us what — we read every answer and it helps us decide what to build next.',
        'Continue with SCP', '{{pricing_url}}'),
      pg_temp.v('¿Te guardamos el sitio?', 'Vuelve, o cuéntanos qué te faltó.',
        E'Hola {{first_name|}},\n\nEste es nuestro último correo sobre tu prueba. Si quieres continuar, puedes elegir un plan cuando quieras.\n\nY si te faltó algo, responde y cuéntanos qué: leemos todas las respuestas y nos ayudan a decidir qué construir.',
        'Continuar con SCP', '{{pricing_url}}'));
    insert into public.automation_flows (name, goal, priority, template_key, definition) values (
      'Win-back after the trial', 'Bring back trial users who didn''t subscribe, and learn what was missing.', 40, 'trial_winback',
      jsonb_build_object('trigger', jsonb_build_object('type', 'trial_ended_unpaid', 'hours', 48), 'entry', jsonb_build_object('mode', 'once'), 'exit', jsonb_build_object('on_paid', true), 'start', 'b1',
        'steps', jsonb_build_object(
          'b1', jsonb_build_object('type', 'email', 'email_id', r1, 'next', 'b2'),
          'b2', jsonb_build_object('type', 'wait', 'mode', 'duration', 'amount', 3, 'unit', 'days', 'next', 'b3'),
          'b3', jsonb_build_object('type', 'email', 'email_id', r2, 'next', 'b4'),
          'b4', jsonb_build_object('type', 'wait', 'mode', 'duration', 'amount', 5, 'unit', 'days', 'next', 'b5'),
          'b5', jsonb_build_object('type', 'email', 'email_id', c1))));
  end if;

  -- ---------- Flow 4: welcome for new customers ----------
  if not exists (select 1 from public.automation_flows where template_key = 'paid_welcome') then
    w3 := pg_temp.mail('Customer · welcome and first steps', 'service',
      pg_temp.v('Welcome to {{plan_name}}', 'Your first steps as a member.',
        E'Hi {{first_name|there}},\n\nThank you for joining Sports Content Playbook. Your plan is **{{plan_name}}** — your account page shows everything it includes.\n\nThree first steps:\n\n1. Create a folder for each content pillar (matchday, signings, sponsors…).\n2. Save five ideas for the next two weeks.\n3. Adapt one and publish it.\n\nAny question, just reply to this e-mail.',
        'Go to my account', '{{account_url}}'),
      pg_temp.v('Bienvenido a {{plan_name}}', 'Tus primeros pasos como miembro.',
        E'Hola {{first_name|}},\n\nGracias por unirte a Sports Content Playbook. Tu plan es **{{plan_name}}**: en tu cuenta verás todo lo que incluye.\n\nTres primeros pasos:\n\n1. Crea una carpeta para cada pilar de contenido (matchday, fichajes, patrocinadores…).\n2. Guarda cinco ideas para las próximas dos semanas.\n3. Adapta una y publícala.\n\nCualquier duda, responde a este correo.',
        'Ir a mi cuenta', '{{account_url}}'));
    c2 := pg_temp.mail('Customer · practical use example', 'service',
      pg_temp.v('A simple weekly routine with SCP', 'Fifteen minutes a week, a full content plan.',
        E'Hi {{first_name|there}},\n\nA routine that works for many teams: every Monday, 15 minutes in the library.\n\n**5 minutes** — look at what clubs in your competition posted last week.\n**5 minutes** — save the ideas that fit your next match and announcements.\n**5 minutes** — assign each idea a day and a format.\n\nBy Tuesday, the week is planned.',
        'Start this week''s plan', '{{platform_url}}'),
      pg_temp.v('Una rutina semanal sencilla con SCP', 'Quince minutos a la semana, un plan de contenido completo.',
        E'Hola {{first_name|}},\n\nUna rutina que funciona en muchos equipos: cada lunes, 15 minutos en la biblioteca.\n\n**5 minutos**: mira qué publicaron la semana pasada los clubes de tu competición.\n**5 minutos**: guarda las ideas que encajan con tu próximo partido y anuncios.\n**5 minutos**: asigna a cada idea un día y un formato.\n\nEl martes tienes la semana planificada.',
        'Empezar el plan de esta semana', '{{platform_url}}'));
    insert into public.automation_flows (name, goal, priority, template_key, definition) values (
      'Welcome for new customers', 'Help new customers get value from their plan in the first week.', 20, 'paid_welcome',
      jsonb_build_object('trigger', jsonb_build_object('type', 'paid_started'), 'entry', jsonb_build_object('mode', 'once'), 'exit', jsonb_build_object('on_paid', false), 'start', 'p1',
        'steps', jsonb_build_object(
          'p1', jsonb_build_object('type', 'email', 'email_id', w3, 'next', 'p2'),
          'p2', jsonb_build_object('type', 'wait', 'mode', 'duration', 'amount', 3, 'unit', 'days', 'next', 'p3'),
          'p3', jsonb_build_object('type', 'email', 'email_id', c2))));
  end if;
end $$;
