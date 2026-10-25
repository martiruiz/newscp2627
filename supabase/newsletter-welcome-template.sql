-- Newsletter welcome email editable in Admin → Newsletter (Spanish and English), stored with the other email templates.
-- Body: paragraphs separated by a blank line; the first one is the big headline; {{name}} = first name (left out if
-- there's none); a line like [Button text](https://…) becomes a button. Safe to re-run (doesn't overwrite edits).
insert into public.email_templates (key, locale, subject, body, enabled, required, description) values
('newsletter_welcome', 'es', 'Bienvenido a la newsletter de SCP',
'Hola {{name}}, ya estás dentro.

Gracias por apuntarte. Cada lunes recibirás lo último en marketing digital deportivo, con ejemplos reales de los posts deportivos que están funcionando ahora mismo y por qué funcionan.

Mientras llega el lunes, explora miles de posts de clubes, ligas y marcas, filtrados por deporte, formato y competición, en la Biblioteca de contenido.

[Abrir la Biblioteca](https://martiruiz.github.io/newscp2627/content-library.html)', true, false, 'Newsletter: welcome email after signing up'),
('newsletter_welcome', 'en', 'Welcome to the SCP newsletter',
'Hi {{name}}, you''re in.

Thanks for joining. Every Monday you''ll get the latest in sports digital marketing, with real examples of the sports posts that are working right now and why they work.

While you wait for Monday, browse thousands of posts from clubs, leagues and brands, filtered by sport, format and competition, in the Content Library.

[Open the Content Library](https://martiruiz.github.io/newscp2627/content-library.html)', true, false, 'Newsletter: welcome email after signing up')
on conflict (key, locale) do nothing;
