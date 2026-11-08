/* FRAMALY — configuración de nube (opcional).
   Si rellenas estos dos valores, TODOS los dispositivos que abran la app ya vienen conectados
   a tu Supabase: solo tendrán que iniciar sesión.
   Son datos PÚBLICOS (Supabase → Project Settings → API): "Project URL" y la clave "anon public".
   NUNCA pongas aquí la clave "service_role". La seguridad la da el SQL de supabase/schema.sql. */
window.FRAMALY_CLOUD = {
  url: '',      // ej: https://abcdefghijk.supabase.co
  anonKey: '',  // ej: eyJhbGciOi... (clave anon public)
};
