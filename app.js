const app=document.querySelector('#app'), dlg=document.querySelector('#dialog');
const params=new URLSearchParams(location.search);
const config=window.COMPOSER_CONFIG||{};
let session=null,song=null,step=1,savedStep=1,dirty=false,measure=0,noteId='',undo=[];
let savedContent='';
let teacherTab='codes',classWord='',classes=[],rows=[],loadedAt='',sceneIndex=0,layer='',busy=false;
const stepNames=['이야기','가락과 리듬','노랫말','뮤직비디오'];
const stageTitles=['어떤 이야기를 담고 싶나요?','가락과 리듬을 만들어 봅시다','노랫말을 만들어 봅시다','뮤직비디오를 만들어 봅시다'];
const button=(label,action,attrs='')=>'<button type="button" data-do="'+action+'" '+attrs+'>'+label+'</button>';
const option=(label,value,active)=>'<option value="'+esc(value)+'" '+(String(value)===String(active)?'selected':'')+'>'+esc(label)+'</option>';
const modeLabel=document.querySelector('#mode');
function notify(message){const el=document.querySelector('#status');el.textContent=message;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.textContent='',4800);}
function showDialog(html,close=true){
  dlg.innerHTML=(close?'<div class="row" style="justify-content:flex-end">'+button('닫기','close')+'</div>':'')+html;
  if(!dlg.open)dlg.showModal();
}
function renderVideo(){
  const target=document.querySelector('#stage-content');
  if(!song.video){
    target.innerHTML='<form id="video-setup" class="card"><div class="cols"><div><label>한 장면의 길이<select id="group-size" name="group"><option value="1">1마디</option><option value="2" selected>2마디</option><option value="4">4마디</option></select></label><p id="group-info">제목 장면 + 노래 장면 4개</p><label>화면에 표시할 내용<select name="show" id="show-mode"><option value="both">노랫말 + 악보</option><option value="lyrics">노랫말</option><option value="score">악보</option></select></label><label class="row"><input name="follow" type="checkbox" checked> 연주를 빨간색으로 따라가기</label><label class="row"><input name="transparent" type="checkbox" checked> 배경 투명하게</label></div><div><canvas id="setup-preview" class="stage"></canvas><label>사진 미리 올리기 (선택)<input type="file" name="assets" accept="image/*,.zip" multiple></label></div></div><button class="primary">편집 시작</button></form>';
    previewSetup();return;
  }
  const video=song.video, scene=video.scenes[sceneIndex];
  const protectedLayers=sceneLayers(video,sceneIndex);
  const selected=scene.items.find(i=>i.id===layer)||protectedLayers.find(([key])=>key===layer)?.[1];
  const label={title:'노래 제목',artist:'활동명',score:video.show==='both'?'악보와 노랫말':'악보',lyrics:'노랫말'};
  const items=[...protectedLayers.map(([key])=>[key,label[key]]),...scene.items.map(item=>[item.id,item.type==='image'?'사진':'글씨'])];
  target.innerHTML='<div class="video-editor"><div class="scene-list">'+video.scenes.map((_,i)=>button(i===0?'제목 · 4초':(i-1)*video.group+1+'–'+i*video.group+'마디','scene','data-index="'+i+'" class="'+(i===sceneIndex?'on':'')+'"')).join('')+'</div><div class="studio"><div class="video-workspace"><canvas id="video-canvas" class="stage" tabindex="0" aria-label="장면 편집 화면"></canvas><div class="video-transport row">'+button('장면 재생','video-part','class="primary"')+button('전체 재생','video-all')+button('멈춤','stop')+'</div><label>사진 올리기<input type="file" data-assets accept="image/*,.zip" multiple></label><div class="row">'+video.assets.map(asset=>button('<img class="asset" alt="'+esc(asset.name)+'" src="'+esc(asset.src)+'">','insert-asset','data-asset="'+asset.id+'" title="'+esc(asset.name)+'"')).join('')+'</div>'+'</div><aside class="video-inspector"><h2>장면 설정</h2><label>장면 배경<input type="color" id="scene-color" value="'+esc(scene.background)+'"></label><div class="row">'+button('+ 글씨 넣기','new-text')+'</div><label>편집할 요소<select id="layer-select">'+option('요소 선택','',layer)+items.map(([id,title])=>option(title,id,layer)).join('')+'</select></label>'+
  (selected?'<div class="layer-actions">'+(['score','lyrics'].includes(layer)?button(scene.overrides[layer]?'🔓 이 장면만':'🔒 모든 장면','toggle-lock'):'')+
  (selected.id?button('뒤로','layer-back')+button('앞으로','layer-front')+button('삭제','layer-remove','class="danger"'):'')+'</div>'+
  '<div class="layer-align"><span>화면 기준 위치</span><div role="group" aria-label="화면 기준 위치">'+
  [['왼쪽',0],['가운데',.5],['오른쪽',1]].map(([name,position])=>button(name,'align-layer','data-position="'+position+'"')).join('')+'</div></div>'+
  (selected.type==='image'?button(['맞춤: 원래 크기','맞춤: 비율 유지','맞춤: 화면 채우기'][selected.fit||0],'fit','class="fit-action"')+'<label>가운데 자르기<input type="range" data-layer="crop" min="0" max=".8" step=".01" value="'+(selected.crop||0)+'"></label>':
  (selected.id?'<label>내용<input data-layer="text" maxlength="150" value="'+esc(selected.text)+'"></label><label>글씨 배경색<input type="color" data-layer="background" value="'+esc(selected.background||'#fff5cc')+'"></label><label>배경 불투명도<input type="range" min="0" max="1" step=".05" data-layer="opacity" value="'+(selected.opacity??(selected.type==='text'?0:1))+'"></label>':'')+
  (layer==='score'?'':'<label>상자 안 글씨 정렬<select data-layer="textAlign">'+[['왼쪽','left'],['가운데','center'],['오른쪽','right']].map(([name,value])=>option(name,value,selected.textAlign||'center')).join('')+'</select></label>')+
  '<label>글씨체<select data-layer="font">'+VIDEO_FONTS.map(([name,font])=>option(name,font,selected.font)).join('')+'</select></label><label>크기<input type="range" data-layer="size" min="12" max="140" value="'+selected.size+'"></label><label>색<input type="color" data-layer="color" value="'+esc(selected.color)+'"></label>'+
  (['score','lyrics'].includes(layer)?'<label class="row"><input type="checkbox" data-layer="transparent" '+(selected.transparent?'checked':'')+'> 배경 투명</label><label>배경색<input type="color" data-layer="background" value="'+esc(selected.background)+'"></label><label class="row"><input type="checkbox" data-layer="follow" '+(selected.follow?'checked':'')+'> 연주 따라가기</label><label>따라가기 색<input type="color" data-layer="followColor" value="'+esc(selected.followColor)+'"></label>':'')):'')+
  button('영상 설정','video-settings','class="video-settings"')+'</aside></div></div>';
  repaint();
  const canvas=document.querySelector('#video-canvas'), project=song;
  prepareImages(project).then(()=>{if(canvas.isConnected&&!playback)repaint();});
}
function previewSetup(){
  const form=document.querySelector('#video-setup');
  if(!form)return;
  const data=new FormData(form), group=+data.get('group');
  document.querySelector('#group-info').textContent='제목 장면 + 노래 장면 '+(8/group)+'개';
  drawVideo(document.querySelector('#setup-preview'),{...song,video:createVideo(group,data.get('show'),data.has('follow'),data.has('transparent'))},1);
}
function videoSettings(){
  const v=song.video, style=v.shared[v.show==='lyrics'?'lyrics':'score'];
  showDialog('<h2>영상 설정</h2><form id="video-settings"><label>한 장면의 길이<select name="group">'+[1,2,4].map(n=>option(n+'마디',n,v.group)).join('')+'</select></label>'+
    '<label>화면에 표시할 내용<select name="show">'+[['both','노랫말 + 악보'],['lyrics','노랫말'],['score','악보']].map(([key,name])=>option(name,key,v.show)).join('')+'</select></label>'+
    '<label class="row"><input type="checkbox" name="follow" '+(style.follow?'checked':'')+'> 연주 따라가기</label>'+
    '<label class="row"><input type="checkbox" name="transparent" '+(style.transparent?'checked':'')+'> 배경 투명하게</label><button class="primary">적용하기</button></form>');
}
function applyVideoSettings(data){
  stopPlayback();
  const v=song.video, group=+data.get('group'), oldGroup=v.group;
  if(group!==oldGroup){
    const old=v.scenes;
    v.scenes=[old[0],...Array.from({length:8/group},(_,i)=>{
      const first=Math.floor(i*group/oldGroup)+1;
      const end=Math.ceil((i+1)*group/oldGroup)+1;
      const scene=structuredClone(old[first]);
      const ids=new Set(scene.items.map(item=>item.id));
      for(const source of old.slice(first+1,end)){
        for(const item of source.items){
          if(!ids.has(item.id)){scene.items.push(structuredClone(item));ids.add(item.id);}
        }
        for(const [key,style] of Object.entries(source.overrides))scene.overrides[key]??=structuredClone(style);
      }
      return scene;
    })];
    if(sceneIndex)sceneIndex=1+Math.floor((sceneIndex-1)*oldGroup/group);
  }
  v.group=group;v.show=data.get('show');
  for(const style of [...Object.values(v.shared),...v.scenes.flatMap(scene=>Object.values(scene.overrides))]){
    style.follow=data.has('follow');style.transparent=data.has('transparent');
  }
  layer='';dlg.close();setDirty();renderVideo();
}
function activeLayer(){
  const video=song.video, scene=video.scenes[sceneIndex];
  return scene.items.find(item=>item.id===layer)||sceneLayers(video,sceneIndex).find(([key])=>key===layer)?.[1];
}
function repaint(){
  const canvas=document.querySelector('#video-canvas');
  if(!canvas)return;
  drawVideo(canvas,song,sceneIndex,-1,layer);
  for(const asset of song.video.assets){
    const image=cachedImage(asset.src);
    if(!image.image&&canvas.dataset.waiting!=='yes'){
      canvas.dataset.waiting='yes';
      prepareImages(song).then(()=>{if(canvas.isConnected)drawVideo(canvas,song,sceneIndex,-1,layer);});
      break;
    }
  }
}
function insertAsset(asset){
  const w=Math.min(.65,.65*asset.ratio*H/W), h=w/asset.ratio*W/H;
  const item={id:uid(),type:'image',asset:asset.id,fit:0,original:box(.5-w/2,.5-h/2,w,h),...box(.5-w/2,.5-h/2,w,h)};
  song.video.scenes[sceneIndex].items.push(item);layer=item.id;setDirty();renderVideo();
}
function appendAssets(items){
  if(song.video.assets.length+items.length>24)throw Error('사진은 작품당 24장까지 넣을 수 있어요.');
  song.video.assets.push(...items);setDirty();
}
function lyricLimit(text){
  let count=0;
  return [...text].filter(c=>!/[\p{Script=Hangul}]/u.test(c)||++count<=4).join('');
}
function teacherForm(form,event){
  const data=Object.fromEntries(new FormData(form));
  const action=event.submitter?.value;
  if(form.id==='teacher-login')return work(async()=>{
    session={...await api(action||'login',data),role:'teacher'};classWord='';teacherTab='codes';dlg.close();await refreshTeacher();
  });
  if(form.id==='new-class')return work(async()=>{
    if(action==='check'){await api('checkWord',data);notify('사용할 수 있는 학급 단어예요.');return;}
    classWord=await api('createClass',data);await refreshTeacher();
  });
  if(form.id==='batch'||form.id==='single')return work(async()=>{
    await api(form.id==='batch'?'batch':'addCode',{...data,word:classWord});await refreshTeacher();
  });
}
document.addEventListener('submit',event=>{
  const form=event.target;
  event.preventDefault();
  const data=new FormData(form);
  if(form.id==='student')return work(async()=>{
    const {token,word,code,song:project}=await api('student',Object.fromEntries(data));
    begin({role:'student',token,word,code},project);
  });
  if(form.id==='video-setup')return work(async()=>{
    const video=createVideo(+data.get('group'),data.get('show'),data.has('follow'),data.has('transparent'));
    video.assets=await assetsFromFiles([...form.elements.assets.files]);
    song.video=video;sceneIndex=0;layer='';setDirty();renderVideo();
  });
  if(form.id==='video-settings')return applyVideoSettings(data);
  teacherForm(form,event);
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.dataset.song){
    const key=el.dataset.song;
    song[key]=['voice','bpm','drums'].includes(key)?+el.value:el.value;
    if(key==='bpm')updateTempo();
    setDirty();
  }
  if(el.dataset.lyric&&!event.isComposing){
    const note=song.bars.flat().find(n=>n.id===el.dataset.lyric);
    el.value=lyricLimit(el.value);note.lyric=el.value;el.title=el.value;setDirty();
  }
  if(el.id==='scene-color'){song.video.scenes[sceneIndex].background=el.value;setDirty();repaint();}
  if(el.dataset.layer){
    const item=activeLayer();
    item[el.dataset.layer]=el.type==='checkbox'?el.checked:el.type==='range'?+el.value:el.value;
    setDirty();repaint();
    if(el.dataset.layer==='font')prepareImages(song).then(()=>{if(!playback)repaint();});
  }
});
document.addEventListener('compositionend',event=>{
  if(event.target.dataset.lyric)event.target.dispatchEvent(new Event('input',{bubbles:true}));
});
document.addEventListener('focusout',event=>{
  if(event.target.dataset.lyric){
    const field=event.target;
    const width=lyricFieldWidth(field.value);
    const box=field.parentNode;
    box.setAttribute('x',+box.getAttribute('x')+(+box.getAttribute('width')-width)/2);
    box.setAttribute('width',width);
  }
});
function updateTempo(){
  const [preset,,label]=closestTempo(song.bpm);
  document.querySelector('#bpm-label').textContent=song.bpm+' BPM';
  document.querySelector('#tempo-mark').textContent=label+' ♩ = '+song.bpm;
  document.querySelector('[data-tempo]').value=preset;
  document.querySelector('[data-song=bpm]').value=song.bpm;
}
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.dataset.tempo!==undefined){song.bpm=+el.value;updateTempo();setDirty();}
  if(el.id==='check-all')document.querySelectorAll('.check-code').forEach(box=>box.checked=el.checked);
  if(el.id==='code-mode')codeFields();
  if(el.id==='class-select'){classWord=el.value;work(refreshTeacher);}
  if(el.id==='layer-select'){layer=el.value;renderVideo();}
  if(el.closest('#video-setup'))previewSetup();
  if(el.dataset.assets!==undefined)work(async()=>{appendAssets(await assetsFromFiles([...el.files]));renderVideo();});
});
const actions={
  'teacher-login':teacherLogin,demo:()=>begin({role:'demo'},exampleSong()),close:()=>dlg.close(),
  go:el=>jump(+el.dataset.go),save:()=>work(save),
  'add-note':el=>addNote(+el.dataset.len,el.dataset.rest==='1'),
  'pitch-up':()=>changePitch(1),'pitch-down':()=>changePitch(-1),
  'delete-note':()=>{remember();song.bars[measure]=song.bars[measure].filter(n=>n.id!==noteId);noteId='';setDirty();renderMusic();},
  undo:()=>{if(undo.length){song.bars=undo.pop();noteId='';setDirty();renderMusic();}},
  'play-part':()=>work(()=>playScore(song,measure,1)),'play-all':()=>work(()=>playScore(song,0,8)),stop:stopPlayback,
  refresh:()=>work(refreshTeacher),
  codes:()=>{teacherTab='codes';renderTeacher();},works:()=>{teacherTab='works';renderTeacher();},
  'random-word':()=>work(async()=>{
    const input=document.querySelector('#new-word');
    const excluded=new Set(recommendedWords);
    const current=input.value.trim().toLowerCase();
    excluded.delete(current);
    excluded.add(current);
    const word=await api('randomWord',{excluded:[...excluded]});
    recommendedWords.add(word);
    input.value=word;
  }),
  'delete-code':el=>deleteCodes([el.dataset.code]),
  'delete-many':()=>deleteCodes([...document.querySelectorAll('.check-code:checked')].map(el=>el.value)),
  inspect:el=>work(async()=>{const project=await api('teacherSong',{word:classWord,code:el.dataset.code});if(!project){notify('저장된 작품이 없어요.');return;}inspectSong(project,project.step);}),
  'inspect-step':el=>{stopPlayback();inspectSong(dlg.inspectSong,+el.dataset.index);},
  'inspect-play':()=>work(()=>playScore(dlg.inspectSong,0,8)),
  'inspect-play-video':()=>work(()=>playVideo(document.querySelector('#inspect-canvas'),dlg.inspectSong,0,true)),
  'teacher-export':el=>work(async()=>exportChoice(await api('teacherSong',{word:classWord,code:el.dataset.code}),[['pdf','악보 저장하기 (PDF)'],['mp3','음원 저장하기 (MP3)'],['mp4','뮤직비디오 저장하기 (MP4)']])),
  exports:()=>exportChoice({...song,step},[['pdf','악보 내보내기 (PDF)'],['mp3','음원 내보내기 (MP3)'],...(step===4?[['mp4','뮤직비디오 내보내기 (MP4)']]:[])]),
  'export-pdf':()=>runExport('pdf','악보',exportPdf),'export-mp3':()=>runExport('mp3','음원',exportMp3),'export-mp4':()=>runExport('mp4','뮤직비디오',exportMp4),
  scene:el=>{stopPlayback();sceneIndex=+el.dataset.index;layer='';renderVideo();},
  'video-part':()=>work(()=>playVideo(document.querySelector('#video-canvas'),song,sceneIndex,false,repaint)),
  'video-settings':videoSettings,
  'video-all':()=>work(()=>playVideo(document.querySelector('#video-canvas'),song,sceneIndex,true,repaint)),
  'insert-asset':el=>insertAsset(song.video.assets.find(a=>a.id===el.dataset.asset)),
  'new-text':addText,
  'toggle-lock':()=>{const scene=song.video.scenes[sceneIndex];if(scene.overrides[layer])delete scene.overrides[layer];else scene.overrides[layer]=structuredClone(song.video.shared[layer]);setDirty();renderVideo();},
  'layer-back':()=>moveLayer(-1),'layer-front':()=>moveLayer(1),
  'layer-remove':()=>{const scene=song.video.scenes[sceneIndex];scene.items=scene.items.filter(i=>i.id!==layer);layer='';setDirty();renderVideo();},
  'align-layer':el=>{
    const item=activeLayer();
    item.x=Math.max(0,1-item.w)*Number(el.dataset.position);
    setDirty();repaint();
  },
  fit:()=>{
    const item=activeLayer(), asset=song.video.assets.find(a=>a.id===item.asset);
    item.fit=(item.fit+1)%3;
    if(item.fit===0)Object.assign(item,item.original);
    if(item.fit===1){const w=Math.min(1,asset.ratio*H/W),h=w/asset.ratio*W/H;Object.assign(item,box((1-w)/2,(1-h)/2,w,h));}
    if(item.fit===2)Object.assign(item,box(0,0,1,1));
    item.crop=0;setDirty();renderVideo();
  }
};
function addText(){
  const item={...overlay(.25,.20,.5,.15,45),id:uid(),type:'text',opacity:0,text:'글을 입력하세요'};
  song.video.scenes[sceneIndex].items.push(item);layer=item.id;setDirty();renderVideo();
}
function moveLayer(delta){
  const items=song.video.scenes[sceneIndex].items, index=items.findIndex(item=>item.id===layer), next=index+delta;
  if(index<0||next<0||next>=items.length)return;
  [items[index],items[next]]=[items[next],items[index]];setDirty();repaint();
}
function deleteCodes(codes){
  if(!codes.length){notify('삭제할 접속코드를 선택해 주세요.');return;}
  if(!confirm(codes.length+'개 접속코드와 저장된 작품을 삭제할까요?'))return;
  work(async()=>{await api('deleteCodes',{word:classWord,codes});await refreshTeacher();});
}
function runExport(kind,label,fn){
  const project=dlg.exportSong;
  if(!exportReady(project,kind)){notify('아직 완성된 '+label+'이 없어요.');return;}
  dlg.close();stopPlayback();
  if(kind==='mp4')return work(async()=>{
    showDialog('<h2>뮤직비디오 파일을 만드는 중이에요</h2><div class="export-progress"><progress max="100" value="0" aria-label="뮤직비디오 내보내기 진행률"></progress><output>0%</output></div><p>파일이 만들어질 때까지 이 화면을 열어 두세요.</p>',false);
    try{
      await fn(project,percent=>{
        const progress=dlg.querySelector('progress');
        if(!progress)return;
        progress.value=percent;
        dlg.querySelector('output').textContent=percent+'%';
      });
      showDialog('<h2>뮤직비디오를 내보냈어요</h2><p>브라우저의 다운로드 목록에서 MP4 파일을 확인하세요.</p>');
    }catch(error){
      showDialog('<h2>뮤직비디오를 내보내지 못했어요</h2><p>'+esc(error.message)+'</p>');
    }
  });
  return work(async()=>{notify(label+' 파일을 만드는 중이에요.');await fn(project);notify(label+' 파일을 내보냈어요.');});
}
document.addEventListener('click',event=>{
  const el=event.target.closest('[data-do]');
  if(el){actions[el.dataset.do]?.(el);return;}
  if(!session||session.role==='teacher'||dlg.open||event.target.closest('[data-lyric]'))return;
  const bar=event.target.closest('#stage-content [data-measure]');
  if(bar&&[2,3].includes(step)){
    const note=event.target.closest('[data-note]');
    editNote(step===2?note?.dataset.note||'':'',+bar.dataset.measure);
  }
});
dlg.addEventListener('close',stopPlayback);
dlg.addEventListener('cancel',event=>{if(busy&&dlg.querySelector('.export-progress'))event.preventDefault();});
let drag=null;
document.addEventListener('pointerdown',event=>{
  const node=event.target.closest('#stage-content .event');
  if(step===2&&node&&event.button===0){
    const note=song.bars[+node.dataset.bar].find(n=>n.id===node.dataset.note);
    if(note&&!note.rest){
      const svg=node.closest('svg');
      drag={type:'note',node,note,bar:+node.dataset.bar,y:event.clientY,p:note.p,last:note.p,scale:svg.getBoundingClientRect().width/svg.viewBox.baseVal.width,id:event.pointerId};
    }
  }
  if(event.target.id==='video-canvas'){
    const canvas=event.target, rect=canvas.getBoundingClientRect(), x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
    const candidates=[...sceneLayers(song.video,sceneIndex).map(([key,value])=>[key,value]).reverse(),...song.video.scenes[sceneIndex].items.slice().reverse().map(item=>[item.id,item])];
    const current=activeLayer();
    const handle=current&&Math.abs(x-current.x-current.w)<.025&&Math.abs(y-current.y-current.h)<.035;
    const hit=handle?[layer,current]:candidates.find(([,v])=>x>=v.x&&y>=v.y&&x<=v.x+v.w&&y<=v.y+v.h);
    if(hit){
      layer=hit[0];drag={type:'canvas',canvas,rect,x,y,item:hit[1],original:{...hit[1]},resize:handle,id:event.pointerId};
      canvas.setPointerCapture(event.pointerId);repaint();
    }else{layer='';renderVideo();}
  }
});
document.addEventListener('pointermove',event=>{
  if(!drag||drag.id!==event.pointerId)return;
  if(drag.type==='note'){
    const offset=Math.round((event.clientY-drag.y)/(5*drag.scale));
    const pitch=offset===0?drag.p:drag.p>HIGH_PITCH&&offset<0?drag.p:clampPitch(drag.p-offset);
    if(pitch!==drag.last){
      drag.last=pitch;audition(song,pitch);
      drag.node.style.transform='translateY('+((drag.p-pitch)*5)+'px)';
    }
  }else{
    const {rect,original,item,resize}=drag;
    const dx=(event.clientX-rect.left)/rect.width-drag.x,dy=(event.clientY-rect.top)/rect.height-drag.y;
    if(resize){item.w=Math.max(.05,Math.min(1-original.x,original.w+dx));item.h=Math.max(.05,Math.min(1-original.y,original.h+dy));}
    else{item.x=Math.max(0,Math.min(1-item.w,original.x+dx));item.y=Math.max(0,Math.min(1-item.h,original.y+dy));}
    if(Math.abs(dx)+Math.abs(dy)>.002)setDirty();
    repaint();
  }
});
function endDrag(event){
  if(!drag||drag.id!==event.pointerId)return;
  const prev=drag;drag=null;
  if(prev.type==='canvas'){renderVideo();return;}
  if(prev.last!==prev.p){
    remember();prev.note.p=prev.last;prev.note.lyric='';setDirty();editNote(prev.note.id,prev.bar);
  }
}
document.addEventListener('pointerup',endDrag);
document.addEventListener('pointercancel',endDrag);
document.addEventListener('contextmenu',event=>{
  const node=event.target.closest('#stage-content .event');
  if(step!==2||!node)return;
  event.preventDefault();editNote(node.dataset.note,+node.dataset.bar);
});
document.addEventListener('keydown',event=>{
  const node=event.target.closest('#stage-content .event');
  if(!node||step!==2||event.target.matches('input'))return;
  if(['Enter',' ','ArrowUp','ArrowDown','Delete'].includes(event.key)){
    event.preventDefault();measure=+node.dataset.bar;noteId=node.dataset.note;
    if(event.key==='Delete')actions['delete-note']();
    else if(event.key.startsWith('Arrow'))changePitch(event.key==='ArrowUp'?1:-1);
    else renderMusic();
    document.querySelector('[data-note="'+noteId+'"]')?.focus();
  }
});
document.querySelector('#home').addEventListener('click',()=>{
  if(dirty&&session?.role==='student'&&!confirm('저장하지 않은 변경이 있어요. 첫 화면으로 갈까요?'))return;
  session=null;dirty=false;render();
});
window.addEventListener('beforeunload',event=>{if(dirty&&session?.role==='student'){event.preventDefault();event.returnValue='';}});
if(params.has('demo'))begin({role:'demo'},exampleSong());else {
  landing();
  if(window.google?.script?.url)google.script.url.getLocation(location=>{
    if(location.parameter.mode==='teacher')teacherLogin();
  });
}
async function api(action,data={}){
  const request={action,...data,token:session?.token||''};
  let result;
  if(window.google?.script?.run){
    result=await new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).request(request));
  }else if(config.offlineTest){
    return offlineTestRequest(request);
  }else if(['127.0.0.1','localhost'].includes(location.hostname)){
    const response=await fetch('/test-api',{method:'POST',body:JSON.stringify(request)});
    result=await response.json();
  }else if(config.webApp){
    result=await requestClassroomServer(request);
  }else throw Error('학급 저장 서버가 아직 연결되지 않았어요. 둘러보기는 바로 사용할 수 있어요.');
  if(!result.ok)throw Error(result.error);
  return result.data;
}
let classroomBridge;
function connectClassroomServer(){
  if(classroomBridge)return classroomBridge;
  classroomBridge=new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');
    const url=new URL(config.webApp);
    url.searchParams.set('bridge','1');
    frame.setAttribute('aria-hidden','true');
    frame.tabIndex=-1;
    frame.style.cssText='position:fixed;left:-10000px;top:0;width:320px;height:200px;border:0';
    frame.title='학급 저장 서버 연결';
    frame.src=url.href;
    const timer=setTimeout(()=>{
      window.removeEventListener('message',ready);
      frame.remove();
      classroomBridge=null;
      reject(Error('학급 서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.'));
    },15000);
    function ready(event){
      if(event.data?.type!=='composer-ready'||!/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin))return;
      const outer=frame.contentWindow;
      let sender=event.source;
      while(sender&&sender!==outer&&sender!==window&&sender!==sender.parent)sender=sender.parent;
      if(sender!==outer)return;
      clearTimeout(timer);
      window.removeEventListener('message',ready);
      resolve({source:event.source,origin:event.origin});
    }
    window.addEventListener('message',ready);
    document.body.append(frame);
  });
  return classroomBridge;
}
async function requestClassroomServer(request){
  const {source,origin}=await connectClassroomServer();
  return new Promise((resolve,reject)=>{
    const id=uid();
    const timer=setTimeout(()=>{
      window.removeEventListener('message',receive);
      reject(Error('서버 응답이 늦어지고 있어요. 다시 시도해 주세요.'));
    },60000);
    function receive(event){
      if(event.source!==source||event.origin!==origin||event.data?.type!=='composer-response'||event.data.id!==id)return;
      clearTimeout(timer);
      window.removeEventListener('message',receive);
      resolve(event.data.result);
    }
    window.addEventListener('message',receive);
    source.postMessage({type:'composer-request',id,request},origin);
  });
}
function offlineTestRequest(request){
  const key='nado-composer-test-3101';
  if(session?.role==='teacher'&&session.preview)return previewTeacherRequest(request,key);
  if(request.action==='student'&&request.word.trim()==='연습'&&request.code==='3101'){
    return {token:key,word:'연습',code:'3101',song:JSON.parse(localStorage.getItem(key)||'null')};
  }
  if(request.action==='save'&&request.token===key){
    try{localStorage.setItem(key,JSON.stringify(request.song));}
    catch{throw Error('브라우저에 저장할 수 없어요. 사진을 줄이거나 일반 창에서 이 파일을 열어 주세요.');}
    return {updated:Date.now()};
  }
  throw Error('이 파일의 학생 테스트 코드는 연습 / 3101이에요.');
}
const PREVIEW_WORDS = '별 달 숲 꽃 봄 눈 꿈 빛 솔 콩 잎 새 산 강 들 풀 돌 흙 물 해 밤 낮 비 땅 귤 배 감 밤톨 구름 바람 하늘 노을 햇살 바다 파도 연못 나무 모래 별빛 이슬 풀잎 여울 달빛 물결 새싹 은하 단풍 여름 가을 겨울 들꽃 토끼 다람쥐 나비 참새 고래 오리 기러기 제비 까치 독수리 부엉이 펭귄 비둘기 갈매기 학 수달 물개 하마 코끼리 사자 호랑이 기린 얼룩말 여우 늑대 곰 판다 코알라 캥거루 사슴 노루 고양이 강아지 햄스터 고슴도치 거북이 개구리 도마뱀 금붕어 잉어 상어 문어 오징어 해파리 불가사리 꽃게 새우 조개 소라 달팽이 장미 튤립 백합 국화 해바라기 민들레 봉숭아 진달래 개나리 목련 수국 라일락 매화 벚꽃 연꽃 제비꽃 코스모스 유채꽃 무궁화 소나무 대나무 버드나무 은행나무 자작나무 벚나무 도토리 솔방울 잣 밤송이 억새 갈대 잔디 고사리 버섯 이끼 포도 사과 유자 자두 수박 참외 복숭아 딸기 체리 블루베리 바나나 야자 감자 당근 고구마 우산 피리 노래 리듬 소리 마루 하루 보리 햇빛 반딧불 눈송이 무지개 초승달 보름달 샘물 폭포 시냇물 바닷가 산책 오솔길 소풍 바구니 모자 연필 종이 색연필 크레파스 종이배 비행기 풍선 비눗방울 팽이 썰매 자전거 악기 기타 북 장구 꽹과리 피아노 바이올린 실로폰 종소리 메아리 별자리 오로라 은하수 샛별 아침 저녁'.split(' ');
let previewClasses;
const recommendedWords=new Set();
function openTeacherPreview(){
  return work(async()=>{
    const project=exampleSong();
    const finished={...project,step:4,video:createVideo(2,'both',true,true)};
    previewClasses=new Map([['연습',new Map([
      ['3101',null],['3102',{...project,step:2}],['3103',{...project,step:3}],['3104',finished],['3105',null]
    ])]]);
    session={role:'teacher',preview:true,email:'교사 화면 예시'};
    teacherTab='codes';classWord='연습';dlg.close();
    await refreshTeacher();
  });
}
function previewTeacherRequest(r,studentKey){
  const word=String(r.word||'').trim().toLowerCase();
  if(r.action==='randomWord'){
    const excluded=new Set(r.excluded);
    const available=PREVIEW_WORDS.filter(name=>!previewClasses.has(name));
    if(!available.length)throw Error('추천 단어를 모두 사용했어요. 직접 입력해 주세요.');
    const fresh=available.filter(name=>!excluded.has(name));
    const choices=fresh.length?fresh:available.filter(name=>name!==r.excluded.at(-1));
    const pool=choices.length?choices:available;
    return pool[Math.floor(Math.random()*pool.length)];
  }
  if(r.action==='createClass'||r.action==='checkWord'){
    if(!/^[가-힣a-z]{1,12}$/.test(word))throw Error('한글 또는 영어 1~12글자로 입력해 주세요.');
    if(previewClasses.has(word))throw Error('이미 사용 중인 학급 단어예요.');
    if(r.action==='createClass')previewClasses.set(word,new Map());
    return word;
  }
  const group=previewClasses.get(word);
  if(r.action==='teacherList'||r.action==='teacherSong'){
    const saved=word==='연습'?JSON.parse(localStorage.getItem(studentKey)||'null'):null;
    const project=code=>word==='연습'&&code==='3101'?saved:group.get(code);
    if(r.action==='teacherSong')return group?.has(r.code)?project(r.code):null;
    return {classes:[...previewClasses.keys()],word:group?word:'',rows:group?[...group.keys()].sort().map(code=>({code,step:project(code)?.step||0,updated:0})):[]};
  }
  if(!group)throw Error('학급을 선택해 주세요.');
  if(r.action==='deleteCodes'){r.codes.forEach(code=>group.delete(code));return;}
  const direct=r.mode==='direct';
  let codes=[r.code];
  if(r.action==='batch'){
    const format=direct?/^\d{4}$/:/^\d{1,2}$/;
    const start=Number(r.start),end=Number(r.end),prefix=direct?'':r.grade+r.room;
    if(!format.test(r.start)||!format.test(r.end)||(!direct&&(!/^[1-6][1-9]$/.test(prefix)||start<1))||end<start||end-start>=200)throw Error('처음과 끝 번호를 확인해 주세요.');
    codes=Array.from({length:end-start+1},(_,i)=>prefix+String(start+i).padStart(direct?4:2,'0'));
  }
  if(codes.some(code=>!/^\d{4}$/.test(code)||group.has(code)))throw Error('4자리 숫자와 이미 발급한 번호를 확인해 주세요.');
  codes.forEach(code=>group.set(code,null));
}
async function work(fn){
  if(busy)return;
  busy=true;
  try{await fn();}catch(error){notify(error.message||String(error));}finally{busy=false;}
}
function landing(){
  modeLabel.textContent='';
  app.innerHTML='<div class="landing"><section class="hero"><h1 aria-label="나도 작곡가"><span class="hero-title-lead">나도</span> 작곡가</h1><p>오늘의 이야기를 여덟 마디 노래로 만들어요.</p><div class="hero-score">'+scoreMarkup(exampleSong(),{first:0,count:4})+'</div></section><section class="card"><h2>학생으로 시작</h2><form id="student"><label>학급 단어<input name="word" required maxlength="12" placeholder="예: 구름"></label><label>4자리 숫자<input name="code" required inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="예: 3101"></label><button class="primary">시작하기 · 이어 하기</button></form><hr><div class="row">'+button('교사 로그인','teacher-login')+button('둘러보기','demo')+'</div></section></div>';
}
function teacherLogin(){
  if(config.offlineTest)return openTeacherPreview();
  showDialog('<h2>교사 로그인</h2><form id="teacher-login"><label>이메일<input name="email" type="email" autocomplete="username" required></label><label>비밀번호<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><div class="row"><button name="action" value="login" class="primary">로그인</button><button name="action" value="signup">회원가입</button></div></form>');
}
function begin(next,nextSong){
  session=next;song=nextSong||freshSong();step=song.step;
  savedStep=Math.max(step,song.video?4:1,song.unlockedStep??(nextSong&&stepReady()?Math.min(4,step+1):1));
  dirty=false;
  savedContent=projectContent(song);
  measure=Math.max(0,song.bars.findIndex(bar=>filled(bar)<8));noteId='';undo=[];
  sceneIndex=0;layer='';render();
}
function projectContent({step,unlockedStep,...content}){return JSON.stringify(content);}
function setDirty(){
  dirty=projectContent(song)!==savedContent;
  const status=document.querySelector('#saved-state');
  if(status)status.textContent=dirty?'저장하지 않은 변경이 있어요':'';
  refreshNav();
}
function stepReady(){
  if(step===1)return Boolean(song.artist.trim()&&song.title.trim()&&song.description.trim());
  if(step===2)return complete(song);
  return true;
}
function canMove(n){return n>=1&&n<=4&&(n<=step||session.role==='demo'||(!dirty&&n<=savedStep));}
function refreshNav(){
  document.querySelectorAll('[data-go]').forEach(el=>el.disabled=!canMove(+el.dataset.go));
}
function render(){
  stopPlayback();
  if(!session){landing();return;}
  if(session.role==='teacher'){renderTeacher();return;}
  modeLabel.textContent=session.role==='demo'?'둘러보기':session.word+' '+session.code;
  app.innerHTML='<nav class="steps" aria-label="작곡 단계">'+stepNames.map((name,i)=>button((i+1)+'. '+name,'go','data-go="'+(i+1)+'" class="'+(step===i+1?'on':'')+'"')).join('')+'</nav><h1 class="stage-title">'+stageTitles[step-1]+'</h1><section id="stage-content"></section>'+
  '<footer class="bar row spread"><div class="row">'+button('이전','go','data-go="'+(step-1)+'"')+button('다음','go','data-go="'+(step+1)+'"')+'<span id="saved-state" class="muted">'+(session.role==='demo'?'둘러보기':dirty?'저장하지 않은 변경이 있어요':'')+'</span></div><div class="row">'+(session.role==='demo'?'':button('저장하기','save','class="primary"')+(step>=3?button('내보내기','exports'):''))+'</div></footer>';
  if(step===1)renderStory();
  if(step===2||step===3)renderMusic();
  if(step===4)renderVideo();
  refreshNav();
}
async function save(){
  if(session.role==='demo')return;
  const snapshot=structuredClone(song);
  snapshot.step=step;
  snapshot.unlockedStep=Math.max(savedStep,stepReady()?Math.min(4,step+1):step);
  await api('save',{song:snapshot});
  savedStep=snapshot.unlockedStep;
  song.step=snapshot.step;
  song.unlockedStep=snapshot.unlockedStep;
  savedContent=projectContent(snapshot);
  dirty=projectContent(song)!==savedContent;
  const status=document.querySelector('#saved-state');
  if(status)status.textContent=dirty?'저장하지 않은 변경이 있어요':'저장했어요';
  refreshNav();notify('저장했어요');
}
function renderStory(){
  document.querySelector('#stage-content').innerHTML='<div class="card cols"><div><label>활동명<input data-song="artist" maxlength="40" placeholder="작곡가 이름을 지어요" value="'+esc(song.artist)+'"></label><label>노래 제목<input data-song="title" maxlength="70" value="'+esc(song.title)+'"></label><label>노래 설명<textarea data-song="description" maxlength="800" rows="4">'+esc(song.description)+'</textarea></label></div><aside><h3>어떤 소리가 어울릴까요?</h3><p><strong>분위기</strong><br>밝게, 신나게, 잔잔하게</p><p><strong>가락</strong><br>높은 음과 낮은 음이 번갈아 나와요.</p><p><strong>리듬</strong><br>같은 리듬을 반복하거나 점점 빠르게 연주해요.</p></aside></div>';
}
function musicControls(value){
  return '<div class="music-settings row"><label>악기<select data-song="voice">'+INSTRUMENTS.map((name,i)=>option(name,i,value.voice)).join('')+'</select></label>'+
  '<label>반주<select data-song="drums">'+DRUMS.map(([name],i)=>option(name,i,value.drums??0)).join('')+'</select></label>'+
  '<label>빠르기<select data-tempo>'+TEMPOS.map(([b,n,h])=>option(n+' · '+h,b,closestTempo(value.bpm)[0])).join('')+'</select></label><label><span id="bpm-label">'+value.bpm+' BPM</span><input aria-label="빠르기 BPM" data-song="bpm" type="range" min="40" max="220" value="'+value.bpm+'"></label></div>';
}
function renderMusic(){
  stopPlayback();
  const target=document.querySelector('#stage-content');
  const n=song.bars[measure].find(n=>n.id===noteId), remaining=8-filled(song.bars[measure]);
  const palette=rest=>'<div class="rhythm-row"><h3>'+(rest?'쉼표':'음표')+'</h3><div class="palette">'+VALUES.map(([len,name,note,pause])=>button('<strong class="music-glyph" aria-hidden="true">'+(rest?pause:note)+'</strong><span>'+name+(rest?'쉼표':'음표')+'</span><small>'+beatLabel(len)+'</small>','add-note','data-len="'+len+'" data-rest="'+(+rest)+'" '+(len>remaining?'disabled':''))).join('')+'</div></div>';
  target.innerHTML='<div class="card music-sheet"><div class="music-toolbar"><div class="row transport">'+button('▶ 전체 재생','play-all','class="primary"')+button('이 마디 재생','play-part')+button('■ 멈춤','stop')+'</div>'+musicControls(song)+'</div>'+(step===3?'<label>노래 제목<input data-song="title" maxlength="70" value="'+esc(song.title)+'"></label><p>음표 아래에 노랫말을 써요. 단어를 띄우려면 새 단어의 첫 글자 앞에 공백을 넣어요. Tab으로 다음 칸에 갈 수 있어요.</p>':'')+
  '<div class="muted" id="tempo-mark">'+closestTempo(song.bpm)[2]+' ♩ = '+song.bpm+'</div><div class="score-scroll">'+scoreMarkup(song,{active:measure,lyrics:step===3,inputs:step===3,selected:noteId})+'</div>'+
  (step===2?'<div class="edit-strip row spread"><div class="row"><strong>'+ (measure+1)+'마디</strong><span class="beat-status">'+(remaining?beatLabel(remaining)+' 남음':'네 박을 채웠어요')+'</span></div><div class="row">'+
  (n?'<strong class="pitch-chip">'+(n.rest?'쉼표':pitchName(n.p))+'</strong>'+button('↑ 올리기','pitch-up',n.rest||n.p>=HIGH_PITCH?'disabled':'')+button('↓ 내리기','pitch-down',n.rest||n.p<=LOW_PITCH?'disabled':'')+button('삭제','delete-note','class="danger"'):'')+
  button('↶ 실행 취소','undo',undo.length?'':'disabled')+'</div></div>':'')+'</div>'+
  (step===2?'<div class="rhythm-tray">'+palette(false)+palette(true)+'</div>':'');
}
function remember(){undo.push(structuredClone(song.bars));if(undo.length>40)undo.shift();}
function editNote(id,index){measure=index;noteId=id;renderMusic();}
function changePitch(delta){
  const n=song.bars[measure].find(note=>note.id===noteId);
  if(!n||n.rest)return;
  if(delta>0&&n.p>=HIGH_PITCH)return;
  const pitch=clampPitch(n.p+delta);
  if(pitch===n.p)return;
  remember();n.p=pitch;n.lyric='';setDirty();renderMusic();audition(song,pitch);
}
function addNote(len,rest){
  const bar=song.bars[measure];
  if(filled(bar)+len>8)return;
  remember();
  const n={id:uid(),p:2,len,rest,lyric:''};bar.push(n);noteId=n.id;
  if(!rest)audition(song,n.p);
  if(filled(bar)===8&&measure<7&&filled(song.bars[measure+1])<8){measure++;noteId='';}
  setDirty();renderMusic();
}
function jump(n){
  if(!canMove(n))return;
  step=n;
  render();
}
function exportChoice(project,formats){
  dlg.exportSong=project;
  showDialog('<h2>내보내기</h2><div class="row">'+formats.map(([kind,label])=>button(label,'export-'+kind)).join('')+'</div>');
}
function exportReady(project,kind){
  if(kind==='mp4')return Boolean(project?.video&&project.step>=4&&complete(project));
  return Boolean(project&&project.step>=3&&complete(project));
}
function renderTeacher(){
  modeLabel.textContent=session.email;
  app.innerHTML='<h1>교사 작업실</h1><div class="row spread teacher-toolbar"><div class="row">'+
  button('학생 접속코드 관리','codes','class="'+(teacherTab==='codes'?'on':'')+'"')+button('학생 산출물 관리','works','class="'+(teacherTab==='works'?'on':'')+'"')+'</div>'+button('불러오기','refresh','class="primary"')+'</div>'+
  '<div class="card"><div class="row spread"><label>학급<select id="class-select">'+option('학급 선택','',classWord)+classes.map(word=>option(word,word,classWord)).join('')+'</select></label><span class="muted">'+(loadedAt?'불러온 시각 '+esc(loadedAt):'')+'</span></div>'+
  (teacherTab==='codes'?'<form id="new-class"><div class="row teacher-form-row"><label>새 학급 단어<input id="new-word" name="word" maxlength="12" required></label>'+button('랜덤 생성','random-word')+'<button name="action" value="check">중복 검사</button><button name="action" value="create" class="primary">학급 만들기</button></div></form>':'')+'</div>'+
  (classWord?'<div class="card">'+(teacherTab==='codes'?'<form id="batch"><h3>접속코드 일괄 생성</h3><div class="row teacher-form-row"><label>생성 방식<select id="code-mode" name="mode"><option value="school">학년·반·번호</option><option value="direct">4자리 직접 입력</option></select></label><div class="row" id="code-fields"></div><button class="primary">일괄 생성</button></div></form>':'')+
  '<div class="table teacher-roster"><table><thead>'+(teacherTab==='codes'?'<tr><th colspan="5" class="teacher-row-action">'+button('선택 일괄 삭제','delete-many','class="danger" '+(rows.length?'':'disabled'))+'</th></tr>':'')+'<tr>'+(teacherTab==='codes'?'<th><input id="check-all" type="checkbox" aria-label="모두 선택"></th>':'')+'<th>4자리 숫자</th><th>저장 단계</th><th>마지막 저장</th><th></th></tr></thead><tbody>'+rows.map(row=>'<tr>'+
  (teacherTab==='codes'?'<td><input class="check-code" type="checkbox" value="'+row.code+'" aria-label="'+row.code+' 선택"></td>':'')+'<td>'+row.code+'</td><td>'+(row.step?row.step+'단계 · '+stepNames[row.step-1]:'미시작')+'</td><td>'+(row.updated?new Date(row.updated).toLocaleString('ko-KR'):'—')+'</td><td class="teacher-row-action"><div class="row">'+
  (teacherTab==='codes'?button('삭제','delete-code','data-code="'+row.code+'" class="danger"'):button('화면 열어보기','inspect','data-code="'+row.code+'"')+button('내보내기','teacher-export','data-code="'+row.code+'"'))+'</div></td></tr>').join('')+'</tbody></table></div>'+(rows.length?'':'<p>발급된 접속코드가 없어요.</p>')+(teacherTab==='codes'?'<form id="single"><div class="row teacher-form-row"><input aria-label="추가할 4자리 숫자" name="code" required pattern="[0-9]{4}" maxlength="4" inputmode="numeric" placeholder="예: 3105"><button>개별 생성</button></div></form>':'')+'</div>':'<p>학급을 선택하면 접속코드와 저장된 작품을 볼 수 있어요.</p>');
  if(document.querySelector('#code-mode'))codeFields();
}
function codeFields(){
  const direct=document.querySelector('#code-mode').value==='direct';
  document.querySelector('#code-fields').innerHTML=(direct?'':'<label>학년<input name="grade" type="number" min="1" max="6" value="3" required></label><label>반<input name="room" type="number" min="1" max="9" value="1" required></label>')+
    '<label>처음 번호<input name="start" inputmode="numeric" pattern="'+(direct?'[0-9]{4}':'[0-9]{1,2}')+'" size="7" required></label><label>끝 번호<input name="end" inputmode="numeric" pattern="'+(direct?'[0-9]{4}':'[0-9]{1,2}')+'" size="7" required></label>';
}
async function refreshTeacher(){
  const data=await api('teacherList',{word:classWord});
  classes=data.classes;classWord=data.word;rows=data.rows;loadedAt=new Date().toLocaleTimeString('ko-KR');renderTeacher();
}
function inspectSong(project,n){
  dlg.inspectSong=project;
  const tabs='<nav class="steps">'+stepNames.map((name,i)=>button((i+1)+'. '+name,'inspect-step','data-index="'+(i+1)+'" class="'+(i+1===n?'on':'')+'"')).join('')+'</nav>';
  let contents='';
  if(n===1)contents='<h2>'+esc(project.title||'제목 없음')+'</h2><p>'+esc(project.artist)+'</p><p>'+esc(project.description)+'</p>';
  if(n===2||n===3)contents='<h2>'+esc(project.title||'제목 없음')+'</h2><p>'+esc(INSTRUMENTS[project.voice])+' · '+project.bpm+' BPM</p><div class="score-scroll">'+scoreMarkup(project,{lyrics:n===3})+'</div><div class="row">'+button('전체 재생','inspect-play')+button('멈춤','stop')+'</div>';
  if(n===4)contents=project.video?'<canvas id="inspect-canvas" class="stage"></canvas><div class="row">'+button('전체 재생','inspect-play-video')+button('멈춤','stop')+'</div>':'<p>저장된 뮤직비디오가 없어요.</p>';
  showDialog('<p class="muted">저장된 학생 화면 · 읽기 전용</p>'+tabs+contents);
  if(n===4&&project.video)prepareImages(project).then(()=>{const canvas=document.querySelector('#inspect-canvas');if(canvas)drawVideo(canvas,project,0);});
}

