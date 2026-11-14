import http from 'node:http';
import {readFile, writeFile, rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const songFile = new URL('../.test-song.json', import.meta.url);
const temporaryFile = new URL('../.test-song.json.tmp', import.meta.url);
const token = randomUUID();
let writes = Promise.resolve();
async function testRequest(request){
  let size = 0;
  const chunks = [];
  for await (const chunk of request){
    size += chunk.length;
    if(size > 12 * 1024 * 1024)throw Error('테스트 작품은 12 MB까지 저장할 수 있어요.');
    chunks.push(chunk);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(data.action === 'student' && String(data.word || '').trim() === '연습' && data.code === '3101'){
    await writes;
    let saved = null;
    try{saved = JSON.parse(await readFile(songFile, 'utf8'));}
    catch(error){if(error.code !== 'ENOENT')throw error;}
    return {token, word:'연습', code:'3101', song:saved};
  }
  if(data.action === 'save' && data.token === token && Array.isArray(data.song?.bars) && data.song.bars.length === 8){
    const write = writes.then(async ()=>{
      await writeFile(temporaryFile, JSON.stringify(data.song));
      await rename(temporaryFile, songFile);
    });
    writes = write.catch(()=>{});
    await write;
    return {updated:Date.now()};
  }
  throw Error('로컬 테스트 코드는 연습 / 3101이에요. 서버를 다시 시작했다면 다시 접속해 주세요.');
}
const files = {'/':'index.html','/index.html':'index.html','/config.js':'config.js','/style.css':'style.css','/music.js':'music.js','/video.js':'video.js','/app.js':'app.js'};
const contentTypes = {html:'text/html',js:'text/javascript',css:'text/css'};
http.createServer(async (request, response) => {
  const pathname = new URL(request.url,'http://localhost').pathname;
  if(pathname === '/test-api' && request.method === 'POST'){
    if(request.headers.origin && request.headers.origin !== 'http://'+request.headers.host){
      response.writeHead(403).end();return;
    }
    response.setHeader('Content-Type','application/json; charset=utf-8');
    try{response.end(JSON.stringify({ok:true,data:await testRequest(request)}));}
    catch(error){response.end(JSON.stringify({ok:false,error:error.message}));}
    return;
  }
  const file = Object.hasOwn(files,pathname) && files[pathname];
  if (!file) {response.writeHead(404).end();return;}
  const contents = await readFile(new URL('../'+file,import.meta.url));
  response.writeHead(200,{'Content-Type':contentTypes[file.split('.').pop()]+'; charset=utf-8'}).end(contents);
}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173/'));

