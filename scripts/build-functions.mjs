// Bundles each Supabase function with the pure rules it imports from src/domain into one file
// (functions-dist/<name>/index.js), ready to deploy (ADR-018). `jsr:` and `npm:` imports stay
// as they are; Supabase's Deno runtime loads them.
import { build } from 'esbuild';

for (const name of ['reminders-cron', 'reminders-test']) {
  await build({
    entryPoints: [`supabase/functions/${name}/index.ts`],
    outfile: `functions-dist/${name}/index.js`,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    external: ['jsr:*', 'npm:*'],
    logLevel: 'warning',
  });
  console.log(`built functions-dist/${name}/index.js`);
}
