const VIDEO_FONTS=[
  ['기본 고딕','Noto Sans KR'],['단정한 명조','Noto Serif KR'],['부드러운 고딕','Gowun Dodum'],
  ['고운 바탕','Gowun Batang'],['손글씨','Gaegu'],['붓글씨','Nanum Brush Script'],
  ['둥근 고딕','Jua'],['굵은 제목','Black Han Sans'],['기본 명조','serif'],['고정폭','monospace']
];
const canvasFont=(font,size)=>'500 '+size+'px '+(['serif','monospace'].includes(font)?font:'"'+font+'", "Noto Sans KR", sans-serif');
const W=1280,H=720;
const box=(x,y,w,h)=>({x,y,w,h});
function overlay(x,y,w,h,size){
  return {...box(x,y,w,h),color:'#171717',background:'#ffffff',transparent:true,font:VIDEO_FONTS[0][1],size,follow:true,followColor:'#d51c38'};
}
function createVideo(group,show,follow,transparent){
  const shared={lyrics:overlay(.08,.76,.84,.17,54),score:overlay(.07,.49,.86,.25,32)};
  for(const o of Object.values(shared)){o.follow=follow;o.transparent=transparent;}
  return {group,show,shared,assets:[],scenes:Array.from({length:1+8/group},()=>({background:'#ffffff',items:[],overrides:{}})),
    title:overlay(.08,.29,.84,.22,82),artist:overlay(.49,.52,.41,.14,47)};
}
const imageCache=new Map();
function cachedImage(src){
  if(!imageCache.has(src)){
    const entry={image:null};
    entry.ready=loadImage(src).then(image=>entry.image=image).catch(()=>null);
    imageCache.set(src,entry);
  }
  return imageCache.get(src);
}
function sceneLayers(video,index){
  const scene=video.scenes[index];
  if(index===0)return [['title',video.title,true],['artist',video.artist,true]];
  const key=video.show==='lyrics'?'lyrics':'score';
  return [[key,scene.overrides[key]||video.shared[key],true]];
}
function drawVideo(canvas,song,index,elapsed=-1,selected=''){
  if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
  const ctx=canvas.getContext('2d'), video=song.video;
  const scene=video.scenes[index];
  ctx.clearRect(0,0,W,H);ctx.fillStyle=scene.background;ctx.fillRect(0,0,W,H);
  for(const item of scene.items){
    if(item.type==='image'){
      const asset=video.assets.find(a=>a.id===item.asset), img=asset&&cachedImage(asset.src).image;
      if(!img)continue;
      const crop=item.crop||0;
      const sw=img.width*(1-crop),sh=img.height*(1-crop);
      ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,item.x*W,item.y*H,item.w*W,item.h*H);
    }else{
      const itemStyle={...item,background:item.background||(item.type==='text'?'#ffffff':'#fff5cc'),
        opacity:item.opacity??(item.type==='text'?0:1)};
      paintText(ctx,itemStyle,item.text);
    }
  }
  const first=(index-1)*video.group, track=index>0?timeline(song,first,video.group):null;
  for(const [key,o] of sceneLayers(video,index)){
    if(key==='score')paintStaff(ctx,song,o,track,first,elapsed);
    else if(key==='lyrics'){
      const events=track.events.filter(e=>!e.note.rest&&e.note.lyric?.trim());
      paintText(ctx,o,events.map((e,i)=>({
        text:(i>0&&events[i-1].bar!==e.bar?'   ':'')+e.note.lyric,
        active:o.follow&&elapsed>=e.time
      })));
    }else paintText(ctx,o,key==='title'?song.title:song.artist);
  }
  const object=scene.items.find(item=>item.id===selected)||sceneLayers(video,index).find(([key])=>key===selected)?.[1];
  if(object){
    ctx.strokeStyle='#157a57';ctx.lineWidth=3;ctx.setLineDash([8,5]);ctx.strokeRect(object.x*W,object.y*H,object.w*W,object.h*H);
    ctx.setLineDash([]);ctx.fillStyle='#157a57';ctx.fillRect((object.x+object.w)*W-10,(object.y+object.h)*H-10,20,20);
  }
}
function paintText(ctx,o,value){
  const x=o.x*W,y=o.y*H,w=o.w*W,h=o.h*H;
  const opacity=o.opacity??(o.transparent?0:1);
  if(opacity>0){ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=o.background;ctx.fillRect(x,y,w,h);ctx.restore();}
  const tokens=typeof value==='string'?[{text:value}]:value;
  ctx.font=canvasFont(o.font,Math.min(o.size,h*.78));
  ctx.textAlign='left';ctx.textBaseline='middle';
  const widths=tokens.map(t=>ctx.measureText(t.text).width);
  const total=widths.reduce((sum,a)=>sum+a,0);
  if(!total)return;
  const scale=Math.min(1,w*.94/total);
  const slack=w-total*scale;
  const inset=o.textAlign==='left'?w*.03:o.textAlign==='right'?slack-w*.03:slack/2;
  ctx.save();ctx.translate(x+inset,y+h/2);ctx.scale(scale,1);
  let offset=0;
  tokens.forEach((t,i)=>{ctx.fillStyle=t.active?o.followColor:o.color;ctx.fillText(t.text,offset,0);offset+=widths[i];});
  ctx.restore();ctx.textBaseline='alphabetic';
}
function paintStaff(ctx,song,o,track,first,elapsed){
  const x=o.x*W,y=o.y*H,w=o.w*W,h=o.h*H;
  if(!o.transparent){ctx.fillStyle=o.background;ctx.fillRect(x,y,w,h);}
  const withLyrics=song.video.show==='both';
  const bw=w/song.video.group;
  const lh=Math.min(h/(withLyrics?15:13),o.size/2,bw/24), top=y+h*.23;
  ctx.strokeStyle=o.color;ctx.fillStyle=o.color;ctx.lineWidth=1.7;
  const line=(a,b,c,d)=>{ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke();};
  for(let i=0;i<5;i++)line(x+6,top+i*lh,x+w-6,top+i*lh);
  for(let i=1;i<=song.video.group;i++)line(x+i*bw-6,top,x+i*bw-6,top+4*lh);
  ctx.textAlign='left';ctx.font=(lh*4.5)+'px serif';ctx.fillText('𝄞',x+7,top+4*lh);
  const layouts=song.bars.slice(first,first+song.video.group).map((bar,i)=>{
    const lead=i===0?lh*2.9:4;
    const positions=notePositions(bar,bw,lead,lh*2.5);
    return new Map(bar.map((note,j)=>[note.id,positions[j]]));
  });
  for(const e of track.events){
    const n=e.note, offset=e.bar-first;
    const nx=x+offset*bw+layouts[offset].get(n.id);
    const ny=top+(8-n.p)*lh*.5;
    ctx.fillStyle=ctx.strokeStyle=o.follow&&elapsed>=e.time?o.followColor:o.color;
    if(n.rest){
      if(n.len>=4)ctx.fillRect(nx-.65*lh,top+(restGlyphY(n.len)-40)*lh/10,1.3*lh,.5*lh);
      else{
        const symbol=VALUES.find(v=>v[0]===n.len)[3].replace('·','');
        ctx.font=(lh*3.2)+'px "Noto Music", serif';ctx.textAlign='center';ctx.fillText(symbol,nx,top+(restTextY-40)*lh/10);ctx.textAlign='left';
      }
      if(n.len===3||n.len===6){ctx.beginPath();ctx.arc(nx+lh,top+1.7*lh,lh*.15,0,Math.PI*2);ctx.fill();}
      continue;
    }
    for(const p of ledgerPitches(n.p)){
      const ledgerY=top+(8-p)*lh*.5;
      line(nx-lh,ledgerY,nx+lh,ledgerY);
    }
    ctx.beginPath();ctx.ellipse(nx,ny,lh*.65,lh*.42,-.2,0,Math.PI*2);n.len>=4?ctx.stroke():ctx.fill();
    if(n.len!==8)line(nx+lh*.6,ny,nx+lh*.6,ny-lh*2.7);
    if(n.len===1){ctx.beginPath();ctx.moveTo(nx+lh*.6,ny-lh*2.7);ctx.quadraticCurveTo(nx+lh*1.7,ny-lh*2.1,nx+lh*1.4,ny-lh*1.1);ctx.stroke();}
    if(n.len===3||n.len===6){ctx.beginPath();ctx.arc(nx+lh,ny-2,lh*.15,0,Math.PI*2);ctx.fill();}
    if(withLyrics&&n.lyric){
      ctx.textAlign='center';ctx.font=canvasFont(o.font,Math.min(lh*1.65,h*.19));
      ctx.fillText(n.lyric.trim(),nx,top+lh*10.6);
      ctx.textAlign='left';
    }
  }
}
async function prepareImages(song){
  const video=song.video;
  const styles=[video.title,video.artist,...Object.values(video.shared),...video.scenes.flatMap(s=>[...s.items,...Object.values(s.overrides)])];
  const sample=[song.title,song.artist,...song.bars.flat().map(n=>n.lyric),...styles.map(o=>o.text)].join('');
  await Promise.all([...new Set(styles.map(o=>o.font).filter(Boolean))].map(font=>document.fonts.load(canvasFont(font,40),sample).catch(()=>[])));
  await Promise.all(song.video.assets.map(asset=>cachedImage(asset.src).ready));
}
function sceneTime(song,elapsed){
  if(elapsed<4)return [0,elapsed];
  const unit=30/song.bpm, length=song.video.group*8*unit;
  const offset=elapsed-4;
  if(offset>=8*8*unit)return [song.video.scenes.length-1,length];
  return [1+Math.floor(offset/length),offset%length];
}
async function playVideo(canvas,song,index,full,done){
  await prepareImages(song);
  if(full)return playTrack(song,timeline(song),{lead:4,draw:t=>drawVideo(canvas,song,...sceneTime(song,t)),done});
  if(index===0)return playTrack(song,{events:[],duration:4},{draw:()=>drawVideo(canvas,song,0),done});
  const track=timeline(song,(index-1)*song.video.group,song.video.group);
  return playTrack(song,track,{draw:t=>drawVideo(canvas,song,index,t),done});
}
async function exportMp4(song,onProgress=()=>{}){
  const mime=['video/mp4;codecs=avc1.42001f,mp4a.40.2','video/mp4'].find(type=>window.MediaRecorder?.isTypeSupported(type));
  if(!mime)throw Error('이 브라우저에서는 MP4 녹화를 지원하지 않아요. MP4 녹화를 지원하는 브라우저에서 다시 시도해 주세요.');
  const ctx=await getAudio();
  await prepareImages(song);
  const canvas=document.createElement('canvas'), dest=ctx.createMediaStreamDestination();
  drawVideo(canvas,song,0);
  const stream=canvas.captureStream(0);
  const videoTrack=stream.getVideoTracks()[0];
  for(const track of dest.stream.getAudioTracks())stream.addTrack(track);
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3500000});
  const chunks=[], track=timeline(song);
  const length=4+track.duration;
  let frame,nodes,previousPercent=-1;
  try{
    let failRecording;
    const result=new Promise((resolve,reject)=>{
      failRecording=reject;
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onerror=()=>reject(Error('영상 녹화가 중단됐어요. 다시 시도해 주세요.'));
      recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/mp4'}));
    });
    recorder.start(500);
    const start=ctx.currentTime+.03;
    nodes=scheduleSong(ctx,dest,song,track,start+4);
    function render(){
      try{
        const elapsed=ctx.currentTime-start;
        drawVideo(canvas,song,...sceneTime(song,Math.max(0,elapsed)));
        videoTrack.requestFrame();
        const percent=Math.max(0,Math.min(99,Math.floor(100*elapsed/length)));
        if(percent!==previousPercent){previousPercent=percent;onProgress(percent);}
        if(elapsed>=length)recorder.stop();
        else frame=requestAnimationFrame(render);
      }catch(error){failRecording(error);}
    }
    render();
    const blob=await result;
    if(!blob.size)throw Error('영상 파일이 비어 있어요. 다시 시도해 주세요.');
    download(blob,fileName(song,'뮤직비디오','mp4'));
    onProgress(100);
  }finally{
    cancelAnimationFrame(frame);
    stream.getTracks().forEach(track=>track.stop());
    nodes?.forEach(node=>{try{node.stop();}catch{}});
  }
}
async function imageAsset(blob,name){
  if(blob.size>15*1024*1024)throw Error('사진은 한 장당 15 MB까지 올릴 수 있어요.');
  const url=URL.createObjectURL(blob);
  try{
    const image=await loadImage(url), canvas=document.createElement('canvas');
    const factor=Math.min(1,1200/Math.max(image.width,image.height));
    canvas.width=Math.max(1,Math.round(image.width*factor));canvas.height=Math.max(1,Math.round(image.height*factor));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return {id:uid(),name,src:canvas.toDataURL('image/webp',.80),ratio:canvas.width/canvas.height};
  }finally{URL.revokeObjectURL(url);}
}
async function assetsFromFiles(files){
  const result=[];
  for(const file of files){
    if(/\.zip$/i.test(file.name)){
      if(!window.JSZip)throw Error('ZIP 도구를 불러오지 못했어요.');
      if(file.size>25*1024*1024)throw Error('ZIP은 25 MB까지 올릴 수 있어요.');
      const archive=await JSZip.loadAsync(file);
      for(const entry of Object.values(archive.files).filter(e=>!e.dir&&/\.(png|jpe?g|webp|gif|bmp)$/i.test(e.name)).slice(0,24-result.length)){
        result.push(await imageAsset(await entry.async('blob'),entry.name.split('/').pop()));
      }
    }else result.push(await imageAsset(file,file.name));
    if(result.length>=24)break;
  }
  return result;
}
