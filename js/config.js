/* FRAMALY — conexión con la base de datos (la pone el dueño de la plataforma, UNA sola vez).
   Las personas que usen la app NO ven ni configuran nada: solo inician sesión.
   Supabase → Project Settings → API:
     url     = "Project URL"
     anonKey = clave "anon public"   (es pública por diseño; NUNCA pongas la "service_role")
   Si los dejas vacíos, la app funciona sin cuentas y guarda todo solo en el dispositivo. */
window.FRAMALY_CLOUD = {
  url: '',
  anonKey: '',
  google: false, // pon true solo si activaste Google en Supabase → Authentication → Providers
};
