import { mkdir, rm, writeFile } from 'node:fs/promises'

await rm('dist', { recursive: true, force: true })
await mkdir('dist/assets', { recursive: true })
await writeFile(
  'dist/index.html',
  `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="OceanBase 架构原理交互式分析与 OBCP 学习平台" />
    <title>OB Architecture Studio</title>
    <link rel="stylesheet" href="./assets/index.css" />
    <script>
      window.__OB_STUDIO_CONFIG__ = {
        supabaseUrl: ${JSON.stringify(process.env.VITE_SUPABASE_URL ?? '')},
        supabaseAnonKey: ${JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY ?? '')}
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/index.js"></script>
  </body>
</html>
`,
  'utf8',
)
