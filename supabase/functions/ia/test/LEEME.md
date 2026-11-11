# Prueba de la función «ia» (rutas de video)

```bash
cd supabase/functions/ia
npx --yes esbuild index.ts --bundle --format=esm --platform=node --outfile=/tmp/iae2e/bundle.mjs --alias:jsr:@supabase/supabase-js@2=./test/fake-supabase.mjs --alias:jsr:@supabase/functions-js/edge-runtime.d.ts=./test/empty.mjs
node test/e2e-video.mjs /tmp/iae2e/bundle.mjs
```
Usa un Supabase y unos proveedores simulados: no gasta créditos.
