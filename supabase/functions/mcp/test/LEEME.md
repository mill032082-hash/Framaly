# Pruebas del servidor MCP

No necesitan Deno ni red: la base de datos y los proveedores de IA son simulados.

```bash
cd supabase/functions/mcp
npx --yes -p typescript tsc --target es2022 --module es2022 --outDir /tmp/mcpt --skipLibCheck lib.ts && cp /tmp/mcpt/lib.js /tmp/mcpt/lib.mjs
cp test/lib.test.mjs /tmp/mcpt/t.mjs && node /tmp/mcpt/t.mjs                     # piezas puras (mp3, esquemas, OpenAPI)
mkdir -p /tmp/mcpe2e && cp test/fake-supabase.mjs test/empty.mjs test/e2e.mjs /tmp/mcpe2e/
npx --yes esbuild index.ts --bundle --format=esm --platform=node --outfile=/tmp/mcpe2e/bundle.mjs \
  --alias:jsr:@supabase/supabase-js@2=/tmp/mcpe2e/fake-supabase.mjs \
  --alias:jsr:@supabase/functions-js/edge-runtime.d.ts=/tmp/mcpe2e/empty.mjs
node /tmp/mcpe2e/e2e.mjs                                                          # servidor completo: autenticación, MCP, REST, topes
```
