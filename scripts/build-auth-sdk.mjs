import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir("public/vendor", { recursive: true });
await build({
  stdin: {
    contents: "export { createClient } from '@supabase/supabase-js';",
    resolveDir: process.cwd(),
    sourcefile: "supabase-browser-entry.js",
    loader: "js",
  },
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  outfile: "public/vendor/supabase-sdk.js",
  minify: true,
  sourcemap: false,
  legalComments: "none",
});
