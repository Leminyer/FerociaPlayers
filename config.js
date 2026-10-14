/* ============================================================
   FEROCIA PLAYER PORTAL — configuración
   La dirección de Supabase y su clave PÚBLICA (publishable): la misma
   que usa ferociasports.com. Es pública a propósito; lo que protege
   los datos son las reglas de la base (RLS), que exigen que cada
   jugador sólo vea lo suyo. Aquí NUNCA va la clave de servicio.
   ============================================================ */

window.FEROCIA_CONFIG = Object.freeze({
  SUPABASE_URL: 'https://yyocceadorckkfbgnbqk.supabase.co',
  SUPABASE_KEY: 'sb_publishable_Lhc3oHL90kL7O0vO3kJQgQ_BqQfc4Il',
});
