/* FRAMALY — conexión con la base de datos (la pone el dueño de la plataforma, UNA sola vez).
   Las personas que usen la app NO ven ni configuran nada: solo inician sesión.
   Supabase → Project Settings → API:
     url     = "Project URL"
     anonKey = clave "anon public"   (es pública por diseño; NUNCA pongas la "service_role")
   Si los dejas vacíos, la app funciona sin cuentas y guarda todo solo en el dispositivo. */
window.FRAMALY_CLOUD = {
  url: 'https://gscnmmphitmzdwxvmwzr.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzY25tbXBoaXRtemR3eHZtd3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMDM1NzUsImV4cCI6MjEwNTg3OTU3NX0.fiWh6o4Fg0fZqK2sIscpYmuL3qZcY65LSHvvWL5xaYQ',
  google: false, // pon true solo si activaste Google en Supabase → Authentication → Providers
};
