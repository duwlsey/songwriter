const WORDS_='별 달 숲 꽃 봄 눈 꿈 빛 솔 콩 잎 새 산 강 들 풀 돌 흙 물 해 밤 낮 비 땅 귤 배 감 밤톨 구름 바람 하늘 노을 햇살 바다 파도 연못 나무 모래 별빛 이슬 풀잎 여울 달빛 물결 새싹 은하 단풍 여름 가을 겨울 들꽃 토끼 다람쥐 나비 참새 고래 오리 기러기 제비 까치 독수리 부엉이 펭귄 비둘기 갈매기 학 수달 물개 하마 코끼리 사자 호랑이 기린 얼룩말 여우 늑대 곰 판다 코알라 캥거루 사슴 노루 고양이 강아지 햄스터 고슴도치 거북이 개구리 도마뱀 금붕어 잉어 상어 문어 오징어 해파리 불가사리 꽃게 새우 조개 소라 달팽이 장미 튤립 백합 국화 해바라기 민들레 봉숭아 진달래 개나리 목련 수국 라일락 매화 벚꽃 연꽃 제비꽃 코스모스 유채꽃 무궁화 소나무 대나무 버드나무 은행나무 자작나무 벚나무 도토리 솔방울 잣 밤송이 억새 갈대 잔디 고사리 버섯 이끼 포도 사과 유자 자두 수박 참외 복숭아 딸기 체리 블루베리 바나나 야자 감자 당근 고구마 우산 피리 노래 리듬 소리 마루 하루 보리 햇빛 반딧불 눈송이 무지개 초승달 보름달 샘물 폭포 시냇물 바닷가 산책 오솔길 소풍 바구니 모자 연필 종이 색연필 크레파스 종이배 비행기 풍선 비눗방울 팽이 썰매 자전거 악기 기타 북 장구 꽹과리 피아노 바이올린 실로폰 종소리 메아리 별자리 오로라 은하수 샛별 아침 저녁'.split(' ');
const FIELDS_={word:0,owner:1,code:2,updated:3,step:4,file:5,expires:6,issued:7};
function doGet(e){
  if(e?.parameter?.bridge==='1'){
    return HtmlService.createHtmlOutput(`<!doctype html><script>
    const site='https://duwlsey.github.io';
    if(window.top!==window){
      window.addEventListener('message',event=>{
        const message=event.data;
        if(event.source!==window.top||event.origin!==site||message?.type!=='composer-request')return;
        const reply=result=>event.source.postMessage({type:'composer-response',id:message.id,result},site);
        google.script.run.withSuccessHandler(reply).withFailureHandler(()=>reply({ok:false,error:'학급 서버 요청에 실패했어요.'})).request(message.request);
      });
      window.top.postMessage({type:'composer-ready'},site);
    }
    </script>`).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('나도 작곡가').addMetaTag('viewport','width=device-width, initial-scale=1');
}
function deleteFile_(id){
  const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id),{
    method:'delete',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true
  });
  if(![204,404].includes(response.getResponseCode()))throw Error('작품 파일을 삭제할 수 없어요.');
}
function install_(){
  const p=PropertiesService.getScriptProperties();
  if(!p.getProperty('AUTH_KEY'))throw Error('스크립트 속성에 Firebase 웹 API 키를 AUTH_KEY로 추가하세요.');
  if(!p.getProperty('DB_ID')){
    const db=SpreadsheetApp.create('나도 작곡가 - 학급 및 산출물');
    const sheet=db.getSheets()[0];sheet.setName('projects');
    sheet.appendRow(Object.keys(FIELDS_));
    sheet.getRange('A:C').setNumberFormat('@');
    p.setProperty('DB_ID',db.getId());
  }
  if(!p.getProperty('FOLDER_ID'))p.setProperty('FOLDER_ID',DriveApp.createFolder('나도 작곡가 - 작품').getId());
  if(!p.getProperty('SESSION_SECRET'))p.setProperty('SESSION_SECRET',Utilities.getUuid()+Utilities.getUuid());
  if(!ScriptApp.getProjectTriggers().some(trigger=>trigger.getHandlerFunction()==='purge_')){
    ScriptApp.newTrigger('purge_').timeBased().everyDays(1).create();
  }
}
function locked_(fn){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))throw Error('동시에 저장하는 학생이 많아요. 잠시 뒤 다시 시도해 주세요.');
  try{return fn();}finally{SpreadsheetApp.flush();lock.releaseLock();}
}
function db_(){
  const id=PropertiesService.getScriptProperties().getProperty('DB_ID');
  if(!id)throw Error('교사가 저장 서버를 먼저 설정해야 해요.');
  return SpreadsheetApp.openById(id).getSheetByName('projects');
}
function records_(sheet){
  return sheet.getDataRange().getValues().slice(1).map((v,i)=>({v,row:i+2,word:v[0],owner:v[1],code:String(v[2]),updated:v[3],step:v[4],file:v[5],expires:v[6],issued:issuanceId_(v[7])}));
}
function issuanceId_(value){
  return value instanceof Date?value.toISOString():String(value??'').trim();
}
function word_(input){
  const word=String(input||'').trim().normalize('NFC').toLowerCase();
  if(!/^[가-힣a-z]{1,12}$/.test(word))throw Error('한글 또는 영어 1~12글자로 학급 단어를 입력해 주세요.');
  return word;
}
function code_(input){
  const code=String(input||'');
  if(!/^\d{4}$/.test(code))throw Error('4자리 숫자를 입력해 주세요.');
  return code;
}
function mac_(body){
  const key=PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');
  if(!key)throw Error('저장 서버 설정이 필요해요.');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body,key)).replace(/=+$/,'');
}
function issue_(identity){
  const body=Utilities.base64EncodeWebSafe(JSON.stringify({...identity,exp:Date.now()+8*3600000})).replace(/=+$/,'');
  return body+'.'+mac_(body);
}
function session_(token){
  try{
    const [body,signature,extra]=String(token||'').split('.');
    if(!body||!signature||extra||token.length>2048)throw Error();
    const expected=mac_(body);
    let mismatch=expected.length^signature.length;
    for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^(signature.charCodeAt(i)||0);
    if(mismatch)throw Error();
    const identity=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(body)).getDataAsString());
    if(identity.exp<Date.now())throw Error();
    return identity;
  }catch(error){throw Error('접속이 만료됐어요. 첫 화면에서 다시 접속해 주세요.');}
}
function auth_(action,r){
  const apiKey=PropertiesService.getScriptProperties().getProperty('AUTH_KEY');
  if(!apiKey)throw Error('교사 로그인 설정이 필요해요.');
  const email=String(r.email||'').trim().toLowerCase(),password=String(r.password||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8||password.length>128)throw Error('이메일과 8글자 이상의 비밀번호를 확인해 주세요.');
  const method=action==='signup'?'signUp':'signInWithPassword';
  const response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:'+method+'?key='+encodeURIComponent(apiKey),{
    method:'post',contentType:'application/json',payload:JSON.stringify({email,password,returnSecureToken:true}),muteHttpExceptions:true
  });
  const result=JSON.parse(response.getContentText());
  if(!result.localId)throw Error(result.error?.message==='EMAIL_EXISTS'?'이미 가입된 이메일이에요.':'이메일과 비밀번호를 확인해 주세요.');
  return {email:result.email,token:issue_({role:'teacher',owner:result.localId})};
}
function student_(r){
  const word=word_(r.word),code=code_(r.code),cache=CacheService.getScriptCache();
  const state=locked_(()=>{
    const key='attempt:'+word;
    if(+(cache.get(key)||0)>=25)throw Error('접속 시도가 많아요. 잠시 뒤 다시 시도해 주세요.');
    const row=records_(db_()).find(row=>row.word===word&&row.code===code);
    if(!row){
      cache.put(key,String(+(cache.get(key)||0)+1),120);
      throw Error('학급 단어와 4자리 숫자를 확인해 주세요.');
    }
    return row;
  });
  return {word,code,token:issue_({role:'student',word,code,issued:state.issued}),song:readSong_(state)};
}
function readSong_(row){
  if(!row?.file||+row.expires<=Date.now())return null;
  return JSON.parse(DriveApp.getFileById(row.file).getBlob().getDataAsString('UTF-8'));
}
function addMonths_(now){
  const date=new Date(now),day=date.getUTCDate();
  date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+2);
  const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  date.setUTCDate(Math.min(day,last));
  return +date;
}
function validateSong_(song){
  const text=(value,max)=>typeof value==='string'&&value.length<=max;
  const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
  if(!song||!integer(song.step,1,4)||!text(song.artist,40)||!text(song.title,70)||!text(song.description,800)||
    !integer(song.bpm,40,220)||!integer(song.voice,0,7)||(song.drums!==undefined&&!integer(song.drums,0,5))||!Array.isArray(song.bars)||song.bars.length!==8)
    throw Error('작품 데이터가 올바르지 않아요.');
  const seen=new Set();
  for(const bar of song.bars){
    if(!Array.isArray(bar)||bar.length>8)throw Error('잘못된 마디가 있어요.');
    let length=0;
    for(const n of bar){
      if(!n||typeof n.id!=='string'||!/^[a-zA-Z0-9-]{1,60}$/.test(n.id)||seen.has(n.id)||![1,2,3,4,6,8].includes(n.len)||!integer(n.p,-7,14)||typeof n.rest!=='boolean'||typeof n.lyric!=='string')
        throw Error('잘못된 음표가 있어요.');
      seen.add(n.id);length+=n.len;
    }
    if(length>8)throw Error('한 마디에는 4박까지 넣을 수 있어요.');
  }
  if(song.video){
    const v=song.video;
    if(![1,2,4].includes(v.group)||!['both','lyrics','score'].includes(v.show)||!Array.isArray(v.scenes)||v.scenes.length!==1+8/v.group||
      !Array.isArray(v.assets)||v.assets.length>24||v.assets.some(a=>!a||typeof a.id!=='string'||!/^[a-zA-Z0-9-]{1,60}$/.test(a.id)||!/^data:image\/(webp|png|jpeg);base64,[\w+/=]+$/.test(a.src))||
      v.scenes.some(scene=>!scene||!Array.isArray(scene.items)||!scene.overrides))
      throw Error('잘못된 영상 데이터가 있어요.');
  }
}
function save_(identity,song){
  validateSong_(song);
  const body=JSON.stringify(song);
  if(Utilities.newBlob(body).getBytes().length>12*1024*1024)throw Error('사진이 너무 많아요. 사진 크기를 줄이고 다시 저장해 주세요.');
  return locked_(()=>{
    const sheet=db_(), row=records_(sheet).find(item=>item.word===identity.word&&item.code===identity.code);
    if(!row||row.issued!==issuanceId_(identity.issued))throw Error('접속코드가 삭제되었거나 다시 발급됐어요. 입력한 내용을 복사해 두고, 현재 코드로 다시 접속해 주세요.');
    const now=Date.now(), expires=row.file&&+row.expires>now?+row.expires:addMonths_(now);
    const folder=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
    const file=folder.createFile(Utilities.newBlob(body,'application/json','composition-'+Utilities.getUuid()+'.json'));
    try{
      sheet.getRange(row.row,4,1,4).setValues([[now,song.step,file.getId(),expires]]);
      SpreadsheetApp.flush();
    }catch(error){deleteFile_(file.getId());throw error;}
    if(row.file)try{deleteFile_(row.file);}catch(error){console.error('Previous file cleanup failed');}
    return {updated:now,expires};
  });
}
function range_(r){
  const start=String(r.start||''),end=String(r.end||''), direct=r.mode==='direct';
  const prefix=direct?'':String(r.grade)+String(r.room);
  if(direct){code_(start);code_(end);}
  else if(!/^[1-6][1-9]$/.test(prefix)||!/^\d{1,2}$/.test(start)||!/^\d{1,2}$/.test(end)||+start<1)throw Error('학년, 반, 번호를 확인해 주세요.');
  if(+end<+start||+end-+start>=200)throw Error('처음과 끝 번호를 확인해 주세요. 한 번에 200개까지 만들 수 있어요.');
  return Array.from({length:+end-+start+1},(_,i)=>prefix+String(+start+i).padStart(direct?4:2,'0'));
}
function teacher_(identity,r){
  return locked_(()=>{
    const sheet=db_(), rows=records_(sheet), own=rows.filter(row=>row.owner===identity.owner);
    if(r.action==='randomWord'){
      const used=new Set(rows.map(row=>row.word));
      const available=WORDS_.filter(word=>!used.has(word));
      if(!available.length)throw Error('추천 단어를 모두 사용했어요. 직접 입력해 주세요.');
      const excluded=Array.isArray(r.excluded)?r.excluded.slice(0,202):[];
      const seen=new Set(excluded);
      const fresh=available.filter(word=>!seen.has(word));
      const choices=fresh.length?fresh:available.filter(word=>word!==excluded[excluded.length-1]);
      const pool=choices.length?choices:available;
      return pool[Math.floor(Math.random()*pool.length)];
    }
    if(r.action==='teacherList'){
      const classes=own.filter(row=>!row.code).map(row=>row.word).sort();
      const word=classes.includes(r.word)?r.word:classes[0]||'';
      return {classes,word,rows:own.filter(row=>row.word===word&&row.code).sort((a,b)=>a.code.localeCompare(b.code)).map(row=>({code:row.code,step:+row.expires>Date.now()?row.step:0,updated:+row.expires>Date.now()?row.updated:0}))};
    }
    const word=word_(r.word);
    if(r.action==='createClass'||r.action==='checkWord'){
      if(rows.some(row=>row.word===word))throw Error('이미 사용 중인 학급 단어예요.');
      if(r.action==='createClass')sheet.appendRow([word,identity.owner,'',0,0,'',0,'']);
      return word;
    }
    if(!own.some(row=>row.word===word&&!row.code))throw Error('이 학급을 열 수 없어요.');
    const classRows=own.filter(row=>row.word===word&&row.code);
    if(r.action==='teacherSong')return readSong_(classRows.find(row=>row.code===code_(r.code)));
    if(r.action==='addCode'||r.action==='batch'){
      const codes=r.action==='batch'?range_(r):[code_(r.code)];
      const existing=new Set(classRows.map(row=>row.code));
      if(codes.some(code=>existing.has(code)))throw Error('이미 발급한 번호가 포함되어 있어요.');
      const values=codes.map(code=>[word,identity.owner,code,0,0,'',0,Utilities.getUuid()]);
      const firstRow=sheet.getLastRow()+1;
      sheet.getRange(firstRow,8,values.length,1).setNumberFormat('@');
      sheet.getRange(firstRow,1,values.length,8).setValues(values);
      return codes.length;
    }
    if(r.action==='deleteCodes'){
      if(!Array.isArray(r.codes)||r.codes.length>10000)throw Error('삭제할 번호를 확인해 주세요.');
      const codes=new Set(r.codes.map(code_));
      for(const row of classRows.filter(row=>codes.has(row.code)).reverse()){
        if(row.file)deleteFile_(row.file);
        sheet.deleteRow(row.row);
      }
      return true;
    }
    throw Error('지원하지 않는 요청이에요.');
  });
}
function request(r){
  try{
    if(r.action==='login'||r.action==='signup')return {ok:true,data:auth_(r.action,r)};
    if(r.action==='student')return {ok:true,data:student_(r)};
    const identity=session_(r.token);
    if(r.action==='save'&&identity.role==='student')return {ok:true,data:save_(identity,r.song)};
    if(identity.role==='teacher')return {ok:true,data:teacher_(identity,r)};
    throw Error('이 기능을 사용할 권한이 없어요.');
  }catch(error){return {ok:false,error:error.message||'서버 요청이 실패했어요.'};}
}
function purge_(){
  locked_(()=>{
    const sheet=db_(), now=Date.now(), all=records_(sheet);
    for(const row of all){
      if(!row.file||+row.expires>now)continue;
      deleteFile_(row.file);
      sheet.getRange(row.row,4,1,4).setValues([[0,0,'',0]]);
    }
    const live=new Set(all.filter(row=>row.file&&+row.expires>now).map(row=>row.file));
    const folder=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
    const files=folder.getFiles();
    while(files.hasNext()){
      const file=files.next();
      if(!live.has(file.getId())&&now-+file.getDateCreated()>86400000)deleteFile_(file.getId());
    }
  });
}
