/* ============================================================
   FEROCIA PLAYER PORTAL — Need help?
   Hitos 3 y 4 (14 de octubre) — pantalla 10 del diseño aprobado,
   opción B (§43): el mensaje queda guardado y la administradora lo ve
   en el panel, en Player claims → Help messages. No sale ningún correo
   solo (nada se envía automáticamente); ella contesta por correo.

   Funciona también ANTES de tener la ficha unida (por ejemplo, si
   está en revisión y tiene una pregunta).
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { sb } = P;
  const $ = (id) => document.getElementById(id);
  const MAX = 1000;

  const msg = $('hp-msg');
  const contar = () => { $('hp-count').textContent = `${msg.value.length} / ${MAX}`; };
  msg.addEventListener('input', contar);

  function error(texto) { $('hp-error').textContent = texto || ''; $('hp-error').hidden = !texto; }
  function elegirTema(valor) {
    document.querySelectorAll('input[name="hp-topic"]').forEach((r) => { r.checked = r.value === valor; });
  }

  P.alEntrar('help', () => {
    const correo = ((P.sesion() || {}).user || {}).email || (P.estado() || {}).email || '';
    $('hp-reply').textContent = correo ? `We'll reply to ${correo}` : '';
    error('');
    /* Siempre se vuelve al formulario (no al "Message sent" de antes). */
    $('hp-sent').hidden = true;
    $('hp-form').hidden = false;
    /* "Request a change" (Edit profile) llega con el tema ya elegido. */
    if (P.temaAyuda) {
      elegirTema(P.temaAyuda);
      if (!msg.value) msg.value = 'Please change my ';
      P.temaAyuda = null;
      contar();
    }
  });

  let enviando = false;
  $('hp-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enviando) return;
    error('');
    const tema = (document.querySelector('input[name="hp-topic"]:checked') || {}).value || '';
    const texto = msg.value.trim();
    if (!tema) { error("Choose what it's about."); document.querySelector('input[name="hp-topic"]').focus(); return; }
    if (!texto) { msg.setAttribute('aria-invalid', 'true'); error('Write your message.'); msg.focus(); return; }
    msg.removeAttribute('aria-invalid');
    enviando = true;
    const b = $('hp-send');
    b.disabled = true;
    b.setAttribute('aria-busy', 'true');
    try {
      const { error: err } = await sb.rpc('portal_pedir_ayuda', { p_topic: tema, p_message: texto.slice(0, MAX) });
      if (err) throw err;
      const correo = ((P.sesion() || {}).user || {}).email || '';
      $('hp-sent-lead').textContent = `Thanks! The FEROCIA team will reply to ${correo || 'your email'}, usually within one business day.`;
      $('hp-form').hidden = true;
      $('hp-sent').hidden = false;
      $('hp-sent-t').focus();
      msg.value = '';
      elegirTema('');
      contar();
    } catch (e) {
      console.warn('[portal] ayuda:', e);
      error(P.errorTexto(e, {
        too_many: "You've sent several messages in the last hour. We'll get back to you soon.",
        invalid_message: 'Your message is empty or too long (1,000 characters at most).',
      }));
    } finally {
      enviando = false;
      b.disabled = false;
      b.setAttribute('aria-busy', 'false');
    }
  });

  $('hp-again').addEventListener('click', () => {
    $('hp-sent').hidden = true;
    $('hp-form').hidden = false;
    msg.focus();
  });
})();
