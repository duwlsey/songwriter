import {readFile, writeFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
let html = await read('index.html');
const css = await read('style.css');
html = html.replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + css + '\n</style>');
html = html.replace('<script defer src="config.js"></script>', '');
const javascript = (await Promise.all(['music.js', 'video.js', 'app.js'].map(read))).join('\n');
html = html.replace(/<script defer src="(?:music|video|app)\.js(?:\?[^"]*)?"><\/script>\r?\n/g, '');
html = html.replace('</body>', () => '<script>\n' + javascript.replace(/<\/script/gi, '<\\/script') + '\n</script>\n</body>');
await writeFile(new URL('apps-script/Index.html', root), html);
const testPage = html.replace('<head>', '<head>\n<script>window.COMPOSER_CONFIG = {offlineTest:true};</script>')
  .replace('<title>나도 작곡가</title>', '<title>나도 작곡가 - 저장 테스트</title>');
await writeFile(new URL('저장 테스트.html', root), testPage);

