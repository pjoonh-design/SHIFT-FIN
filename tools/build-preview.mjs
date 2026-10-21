// claude.ai 미리보기용 한 파일 버전을 만든다 (GitHub Pages 배포에는 필요 없음).
// 사용: ESBUILD=/path/to/esbuild node tools/build-preview.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'preview');
mkdirSync(out, { recursive: true });

const html = readFileSync(join(root, 'index.html'), 'utf8');
const body = html.split('<!--APP_START-->')[1].split('<!--APP_END-->')[0];
const css = readFileSync(join(root, 'assets/css/app.css'), 'utf8');
const esbuild = process.env.ESBUILD || 'esbuild';
const js = execFileSync(esbuild, [join(root, 'assets/js/app.js'), '--bundle', '--format=iife', '--target=es2020', '--charset=utf8'], { encoding: 'utf8' });

const page = `<title>SHIFT-FIN</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
<style>
${css}
</style>
${body}
<script>
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
writeFileSync(join(out, 'index.html'), page);
console.log(`dist/preview/index.html ${(page.length / 1024).toFixed(1)} KB`);
