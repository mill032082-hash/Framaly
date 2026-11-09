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

## Modo externo (ChatGPT) y auditoría
```bash
node /tmp/mcpe2e/e2e-modes.mjs      # 44 comprobaciones: modos external / no_openai / all, subida, anti-duplicados, auditoría
FX_DIR=/tmp/fx node /tmp/mcpe2e/make-fixture.mjs   # crea un proyecto real con archivos reales (para exportarlo en un navegador)
```
Los archivos de ejemplo (`a.png`, `voz1.wav`…) se generan con Python (ver la sesión) y se leen desde `FX_DIR`.

## Transferencia de imágenes ChatGPT → FRAMALY
```bash
node /tmp/mcpe2e/e2e-chatgpt-image.mjs   # 20 comprobaciones: image{download_url,file_id}, images[], openaiFileIdRefs, errores reales, list_media, image_media_id
```

## Ver imágenes de la biblioteca (framaly_get_media)
```bash
node /tmp/mcpe2e/e2e-get-media.mjs   # imagen como contenido MCP, URL firmada, otra cuenta denegada, id inválido, sin archivo, >4 MB
```
