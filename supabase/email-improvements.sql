-- E-mail improvements (2026-10-26): trial sequence (day 0 welcome, day 2 tips, day 4 "trial ending" that sells),
-- a title and an eyebrow on every billing e-mail, shorter subjects, "why are you leaving?" one-click answers,
-- the next payment attempt on "payment failed", replies to info@. Run once in the Supabase SQL editor.
-- Body syntax (send-emails / _shared/email-render.js): "^ " eyebrow line, "# " title line, paragraphs separated by
-- blank lines, {{variables}}, [Button](url) on its own line, [link](url) inside a paragraph.

-- 1. "Why are you leaving?" answers from the cancellation e-mail (feedback.html records one per link token)
create table if not exists public.cancel_feedback (
  token        uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users (id) on delete cascade,
  reason       text check (reason in ('price', 'unused', 'missing', 'other')),
  created_at   timestamptz not null default now(),
  answered_at  timestamptz
);
alter table public.cancel_feedback enable row level security;

create or replace function public.cancel_feedback_answer(p_token uuid, p_reason text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if p_reason not in ('price', 'unused', 'missing', 'other') then return false; end if;
  update public.cancel_feedback set reason = p_reason, answered_at = now()
  where token = p_token and created_at > now() - interval '60 days';
  return found;
end $$;
revoke execute on function public.cancel_feedback_answer(uuid, text) from public;
grant execute on function public.cancel_feedback_answer(uuid, text) to anon, authenticated;

-- 2. Replies go to the inbox someone reads
update public.billing_settings set value = value || '{"reply_to": "info@sportscontentplaybook.com"}'::jsonb
where key = 'emails' and coalesce(value ->> 'reply_to', '') = '';

-- 3. Templates (new ones and rewritten ones; enabled/required of existing rows are kept)
insert into public.email_templates as t (key, locale, subject, body, enabled, required, description) values

-- day 0 of a trial (sent instead of "subscription confirmed" while the subscription is trialing)
('trial_welcome', 'es', 'Ya estás dentro de SCP: 3 cosas para hoy', $b$^ Tu prueba de 7 días
# Empieza por aquí

Hola {{name}}, tu prueba gratuita de {{plan}} ya está activa. Tres cosas para sacarle partido hoy mismo:

1. Busca tu club o tu liga en la Biblioteca y ordena por los más vistos.
2. Guarda en un tablero los posts que te gustaría adaptar.
3. Abre uno y pulsa «Análisis con IA»: verás por qué funciona y cómo hacer tu versión.

[Abrir la Biblioteca]({{site_url}}/content-library.html)

{{first_charge_note}}
Puedes cancelar cuando quieras desde tu cuenta.$b$, true, false, 'Trial: welcome on day 0 (3 things to do today)'),
('trial_welcome', 'ca', 'Ja ets dins de SCP: 3 coses per fer avui', $b$^ La teva prova de 7 dies
# Comença per aquí

Hola {{name}}, la teva prova gratuïta de {{plan}} ja està activa. Tres coses per treure-li partit avui mateix:

1. Busca el teu club o la teva lliga a la Biblioteca i ordena pels més vistos.
2. Desa en un tauler els posts que t'agradaria adaptar.
3. Obre'n un i prem «Anàlisi amb IA»: veuràs per què funciona i com fer la teva versió.

[Obrir la Biblioteca]({{site_url}}/content-library.html)

{{first_charge_note}}
Pots cancel·lar quan vulguis des del teu compte.$b$, true, false, 'Trial: welcome on day 0 (3 things to do today)'),
('trial_welcome', 'en', 'You''re in: 3 things to do today', $b$^ Your 7-day trial
# Start here

Hi {{name}}, your free trial of {{plan}} is live. Three things to get the most out of it today:

1. Search for your club or league in the Library and sort by most viewed.
2. Save the posts you'd like to adapt to a board.
3. Open one and tap "AI analysis": see why it works and how to make your version.

[Open the Library]({{site_url}}/content-library.html)

{{first_charge_note}}
You can cancel any time from your account.$b$, true, false, 'Trial: welcome on day 0 (3 things to do today)'),

-- day 2 of a trial (billing-cron)
('trial_tips', 'es', 'Tres atajos para encontrar ideas en 2 minutos', $b$^ Día 2 de tu prueba
# Lo que publican los mejores, en 2 minutos

Hola {{name}}, tres atajos para ir más rápido con SCP:

1. Filtra por «Ideas replicables»: formatos que puedes grabar con tus jugadores esta misma semana.
2. Activa «1M+ visualizaciones» para ver solo lo que ha funcionado de verdad.
3. Arrastra los que te gusten al Plan de contenido y tendrás la semana montada.

[Ver los posts más vistos]({{site_url}}/content-library.html)

¿Dudas o ideas? Responde a este correo, lo leemos todo.$b$, true, false, 'Trial: tips on day 2'),
('trial_tips', 'ca', 'Tres dreceres per trobar idees en 2 minuts', $b$^ Dia 2 de la teva prova
# El que publiquen els millors, en 2 minuts

Hola {{name}}, tres dreceres per anar més de pressa amb SCP:

1. Filtra per «Idees replicables»: formats que pots gravar amb els teus jugadors aquesta mateixa setmana.
2. Activa «1M+ visualitzacions» per veure només el que ha funcionat de debò.
3. Arrossega els que t'agradin al Pla de contingut i tindràs la setmana muntada.

[Veure els posts més vistos]({{site_url}}/content-library.html)

Dubtes o idees? Respon aquest correu, ho llegim tot.$b$, true, false, 'Trial: tips on day 2'),
('trial_tips', 'en', 'Three shortcuts to find ideas in 2 minutes', $b$^ Day 2 of your trial
# What the best clubs post, in 2 minutes

Hi {{name}}, three shortcuts to move faster with SCP:

1. Filter by "Replicable ideas": formats you can shoot with your players this week.
2. Turn on "1M+ views" to see only what has really worked.
3. Drag the ones you like into the Content Plan and your week is ready.

[See the most-viewed posts]({{site_url}}/content-library.html)

Questions or ideas? Reply to this e-mail, we read everything.$b$, true, false, 'Trial: tips on day 2'),

-- day 4 (Stripe sends trial_will_end 3 days before the end)
('trial_ending', 'es', 'Tu prueba termina el {{trial_end_day}}', $b$^ Quedan 3 días de prueba
# Tu prueba termina el {{trial_end_day}}

Hola {{name}},

{{usage_line}}

Si continúas, mantienes:
{{plan_includes}}

{{first_charge_note}}
Si quieres continuar, no tienes que hacer nada.

[Gestionar mi membresía]({{account_url}})

¿No quieres continuar? Cancela antes del {{trial_end}} y no te cobraremos nada.$b$, true, true, null),
('trial_ending', 'ca', 'La teva prova acaba el {{trial_end_day}}', $b$^ Queden 3 dies de prova
# La teva prova acaba el {{trial_end_day}}

Hola {{name}},

{{usage_line}}

Si continues, mantens:
{{plan_includes}}

{{first_charge_note}}
Si vols continuar, no cal que facis res.

[Gestionar la membresia]({{account_url}})

No vols continuar? Cancel·la abans del {{trial_end}} i no et cobrarem res.$b$, true, true, null),
('trial_ending', 'en', 'Your trial ends on {{trial_end_day}}', $b$^ 3 days of trial left
# Your trial ends on {{trial_end_day}}

Hi {{name}},

{{usage_line}}

If you continue, you keep:
{{plan_includes}}

{{first_charge_note}}
Nothing to do if you want to keep going.

[Manage my membership]({{account_url}})

Don't want to continue? Cancel before {{trial_end}} and you won't be charged.$b$, true, true, null),

('subscription_confirmed', 'es', 'Ya estás dentro de SCP', $b$^ Membresía activa
# Gracias por unirte

Hola {{name}}, tu membresía ya está activa.

Plan: {{plan}} · {{price}} {{interval}}
{{first_charge_note}}
{{next_charge_line}}

Puedes cambiar o cancelar tu plan cuando quieras desde tu cuenta.

[Abrir mi cuenta]({{account_url}})$b$, true, true, null),
('subscription_confirmed', 'ca', 'Ja ets dins de SCP', $b$^ Membresia activa
# Gràcies per unir-te

Hola {{name}}, la teva membresia ja està activa.

Pla: {{plan}} · {{price}} {{interval}}
{{first_charge_note}}
{{next_charge_line}}

Pots canviar o cancel·lar el pla quan vulguis des del teu compte.

[Obrir el meu compte]({{account_url}})$b$, true, true, null),
('subscription_confirmed', 'en', 'You''re in: welcome to SCP', $b$^ Membership active
# Thanks for joining

Hi {{name}}, your membership is active.

Plan: {{plan}} · {{price}} {{interval}}
{{first_charge_note}}
{{next_charge_line}}

You can change or cancel your plan any time from your account.

[Open my account]({{account_url}})$b$, true, true, null),

('cancellation_confirmed', 'es', 'Hemos cancelado tu membresía de SCP', $b$^ Membresía cancelada
# Hemos cancelado tu membresía

Hola {{name}}, no te haremos ningún cobro más.

Mantienes el acceso completo hasta el {{access_until}}. Tus tableros y planes de contenido se quedan en tu cuenta.

¿Nos dices por qué te vas? Un clic y nos ayudas a mejorar:
[Es caro]({{fb_price}}) · [No lo uso lo suficiente]({{fb_unused}}) · [Me falta algo]({{fb_missing}}) · [Otro motivo]({{fb_other}})

¿Has cambiado de opinión? Puedes reactivarla antes de esa fecha.

[Reactivar la membresía]({{account_url}})$b$, true, true, null),
('cancellation_confirmed', 'ca', 'Hem cancel·lat la teva membresia de SCP', $b$^ Membresia cancel·lada
# Hem cancel·lat la teva membresia

Hola {{name}}, no et farem cap més cobrament.

Mantens l'accés complet fins al {{access_until}}. Els teus taulers i plans de contingut es queden al teu compte.

Ens dius per què marxes? Un clic i ens ajudes a millorar:
[És car]({{fb_price}}) · [No el faig servir prou]({{fb_unused}}) · [Hi trobo a faltar alguna cosa]({{fb_missing}}) · [Un altre motiu]({{fb_other}})

Has canviat d'opinió? Pots reactivar-la abans d'aquesta data.

[Reactivar la membresia]({{account_url}})$b$, true, true, null),
('cancellation_confirmed', 'en', 'Your SCP membership has been cancelled', $b$^ Membership cancelled
# We've cancelled your membership

Hi {{name}}, you won't be charged again.

You keep full access until {{access_until}}. Your saved boards and content plans stay in your account.

Mind telling us why you're leaving? One click helps us improve:
[It's too expensive]({{fb_price}}) · [I don't use it enough]({{fb_unused}}) · [Something's missing]({{fb_missing}}) · [Another reason]({{fb_other}})

Changed your mind? You can reactivate before that date.

[Reactivate my membership]({{account_url}})$b$, true, true, null),

('payment_failed', 'es', 'No hemos podido cobrar tu membresía de SCP', $b$^ Pago pendiente
# No hemos podido cobrar el pago

Hola {{name}}, no hemos podido cobrar {{amount}} de tu membresía. Queda pendiente de pago.

Volveremos a intentarlo automáticamente {{next_attempt}}. Para no perder el acceso, actualiza tu tarjeta.

[Actualizar el método de pago]({{update_payment_url}})

Si tras los reintentos no se puede cobrar, el acceso prémium quedará en pausa. Tu cuenta y el contenido guardado se conservan.$b$, true, true, null),
('payment_failed', 'ca', 'No hem pogut cobrar la teva membresia de SCP', $b$^ Pagament pendent
# No hem pogut cobrar el pagament

Hola {{name}}, no hem pogut cobrar {{amount}} de la teva membresia. Queda pendent de pagament.

Ho tornarem a provar automàticament {{next_attempt}}. Per no perdre l'accés, actualitza la targeta.

[Actualitzar el mètode de pagament]({{update_payment_url}})

Si després dels reintents no es pot cobrar, l'accés prèmium quedarà en pausa. El teu compte i el contingut desat es conserven.$b$, true, true, null),
('payment_failed', 'en', 'We couldn''t take your SCP payment', $b$^ Payment pending
# We couldn't take your payment

Hi {{name}}, we couldn't charge {{amount}} for your membership. It's now pending payment.

We'll try again automatically {{next_attempt}}. To avoid losing access, please update your card.

[Update my payment method]({{update_payment_url}})

If the payment can't be collected after the retries, premium access will be paused. Your account and saved content are kept.$b$, true, true, null),

('payment_action_required', 'es', 'Confirma tu pago de SCP', $b$^ Acción necesaria
# Confirma tu pago

Hola {{name}}, tu banco necesita que confirmes el pago de {{amount}} de tu membresía.

[Confirmar el pago]({{update_payment_url}})$b$, true, true, null),
('payment_action_required', 'ca', 'Confirma el pagament de SCP', $b$^ Cal fer una acció
# Confirma el pagament

Hola {{name}}, el teu banc necessita que confirmis el pagament de {{amount}} de la teva membresia.

[Confirmar el pagament]({{update_payment_url}})$b$, true, true, null),
('payment_action_required', 'en', 'Confirm your SCP payment', $b$^ Action needed
# Confirm your payment

Hi {{name}}, your bank needs you to confirm the payment of {{amount}} for your membership.

[Confirm the payment]({{update_payment_url}})$b$, true, true, null),

('payment_recovered', 'es', 'Pago recibido: tu membresía vuelve a estar activa', $b$^ Todo en orden
# Pago recibido ✓

Hola {{name}}, hemos recibido tu pago de {{amount}}. Tu membresía {{plan}} vuelve a estar activa del todo.

[Abrir SCP]({{site_url}})$b$, true, false, null),
('payment_recovered', 'ca', 'Pagament rebut: la teva membresia torna a estar activa', $b$^ Tot en ordre
# Pagament rebut ✓

Hola {{name}}, hem rebut el teu pagament de {{amount}}. La teva membresia {{plan}} torna a estar activa del tot.

[Obrir SCP]({{site_url}})$b$, true, false, null),
('payment_recovered', 'en', 'Payment received: your membership is active again', $b$^ All set
# Payment received ✓

Hi {{name}}, we've received your payment of {{amount}}. Your {{plan}} membership is fully active again.

[Open SCP]({{site_url}})$b$, true, false, null),

('plan_changed', 'es', 'Tu plan de SCP ha cambiado', $b$^ Cambio de plan
# Tu plan ha cambiado

Hola {{name}}, tu membresía ha pasado de {{from_plan}} a {{plan}} ({{price}} {{interval}}).

Próximo cobro: {{next_charge_amount}} el {{next_charge_date}}.

[Abrir mi cuenta]({{account_url}})$b$, true, false, null),
('plan_changed', 'ca', 'El teu pla de SCP ha canviat', $b$^ Canvi de pla
# El teu pla ha canviat

Hola {{name}}, la teva membresia ha passat de {{from_plan}} a {{plan}} ({{price}} {{interval}}).

Pròxim cobrament: {{next_charge_amount}} el {{next_charge_date}}.

[Obrir el meu compte]({{account_url}})$b$, true, false, null),
('plan_changed', 'en', 'Your SCP plan has changed', $b$^ Plan change
# Your plan has changed

Hi {{name}}, your membership changed from {{from_plan}} to {{plan}} ({{price}} {{interval}}).

Next charge: {{next_charge_amount}} on {{next_charge_date}}.

[Open my account]({{account_url}})$b$, true, false, null),

('card_expiring', 'es', 'Tu tarjeta caduca pronto', $b$^ Método de pago
# Tu tarjeta caduca pronto

Hola {{name}}, la tarjeta que usas para SCP caduca este mes. Actualízala para mantener tu membresía sin interrupciones.

[Actualizar mi tarjeta]({{update_payment_url}})$b$, true, false, null),
('card_expiring', 'ca', 'La teva targeta caduca aviat', $b$^ Mètode de pagament
# La teva targeta caduca aviat

Hola {{name}}, la targeta que fas servir per a SCP caduca aquest mes. Actualitza-la per mantenir la membresia sense interrupcions.

[Actualitzar la targeta]({{update_payment_url}})$b$, true, false, null),
('card_expiring', 'en', 'Your card is about to expire', $b$^ Payment method
# Your card expires soon

Hi {{name}}, the card you use for SCP expires this month. Update it to keep your membership without interruptions.

[Update my card]({{update_payment_url}})$b$, true, false, null),

('billing_details_updated', 'es', 'Hemos actualizado tus datos de facturación', $b$^ Facturación
# Datos de facturación actualizados

Hola {{name}}, se han actualizado tus datos de facturación o el método de pago. Si no has sido tú, responde a este correo.

[Abrir mi cuenta]({{account_url}})$b$, true, false, null),
('billing_details_updated', 'ca', 'Hem actualitzat les teves dades de facturació', $b$^ Facturació
# Dades de facturació actualitzades

Hola {{name}}, s'han actualitzat les teves dades de facturació o el mètode de pagament. Si no has estat tu, respon aquest correu.

[Obrir el meu compte]({{account_url}})$b$, true, false, null),
('billing_details_updated', 'en', 'Your billing details were updated', $b$^ Billing
# Billing details updated

Hi {{name}}, your billing details or payment method were updated. If it wasn't you, reply to this e-mail.

[Open my account]({{account_url}})$b$, true, false, null),

('subscription_reactivated', 'es', 'Tu membresía de SCP sigue activa', $b$^ Buenas noticias
# Tu membresía sigue activa

Hola {{name}}, tu membresía no terminará: se renueva como siempre.

Próximo cobro: {{next_charge_amount}} el {{next_charge_date}}.

[Abrir mi cuenta]({{account_url}})$b$, true, false, null),
('subscription_reactivated', 'ca', 'La teva membresia de SCP continua activa', $b$^ Bones notícies
# La teva membresia continua activa

Hola {{name}}, la teva membresia no s'acabarà: es renova com sempre.

Pròxim cobrament: {{next_charge_amount}} el {{next_charge_date}}.

[Obrir el meu compte]({{account_url}})$b$, true, false, null),
('subscription_reactivated', 'en', 'Your SCP membership is still active', $b$^ Good news
# Your membership is still active

Hi {{name}}, your membership won't end: it renews as usual.

Next charge: {{next_charge_amount}} on {{next_charge_date}}.

[Open my account]({{account_url}})$b$, true, false, null),

('access_ending', 'es', 'Tu acceso a SCP termina el {{access_until}}', $b$^ Últimos días
# Tu acceso termina el {{access_until}}

Hola {{name}}, tu membresía cancelada termina el {{access_until}}. A partir de entonces perderás el acceso a: {{features_lost}}.

El contenido que has guardado se queda en tu cuenta y lo recuperas si te vuelves a suscribir.

[Reactivar la membresía]({{account_url}})$b$, true, false, null),
('access_ending', 'ca', 'El teu accés a SCP acaba el {{access_until}}', $b$^ Darrers dies
# El teu accés acaba el {{access_until}}

Hola {{name}}, la teva membresia cancel·lada acaba el {{access_until}}. A partir d'aleshores perdràs l'accés a: {{features_lost}}.

El contingut que has desat es queda al teu compte i el recuperes si et tornes a subscriure.

[Reactivar la membresia]({{account_url}})$b$, true, false, null),
('access_ending', 'en', 'Your SCP access ends on {{access_until}}', $b$^ Last days
# Your access ends on {{access_until}}

Hi {{name}}, your cancelled membership ends on {{access_until}}. After that you'll lose access to: {{features_lost}}.

Your saved content stays in your account and comes back if you subscribe again.

[Reactivate my membership]({{account_url}})$b$, true, false, null)

on conflict (key, locale) do update set subject = excluded.subject, body = excluded.body, updated_at = now(),
  description = coalesce(t.description, excluded.description);
