const TEMPOS = [[60,'아다지오','아주 느리게'],[84,'안단테','느리게'],[108,'모데라토','보통으로'],[132,'알레그로','빠르게'],[168,'프레스토','아주 빠르게']];
const INSTRUMENTS = ['피아노','플루트','마림바','기타','오르간','클라리넷','종','현악기'];
const DRUMS = [
  ['반주 없음'],
  ['팝 · 킥과 스네어',[0,4],[2,6],[0,1,2,3,4,5,6,7],1],
  ['펑크 · 엇박 킥',[0,3,5],[2,6],[1,3,5,7],1.18],
  ['행진 · 작은북',[0,4],[1,2,3,5,6,7],[2,6],1.35],
  ['전자 · 댄스',[0,2,4,6],[2,6],[1,3,5,7],.83],
  ['잔잔 · 브러시',[0,4],[2,6],[0,2,4,6],.72]
];
const VALUES = [[1,'8분','♪','𝄾'],[2,'4분','♩','𝄽'],[3,'점4분','♩·','𝄽·'],[4,'2분','𝅗𝅥','𝄼'],[6,'점2분','𝅗𝅥·','𝄼·'],[8,'온','𝅝','𝄻']];
const PITCHES = [60,62,64,65,67,69,71,72,74,76,77,79,81];
const NAMES = ['도','레','미','파','솔','라','시','높은 도','높은 레','높은 미','높은 파','높은 솔','높은 라'];
const LOW_PITCH = -7, HIGH_PITCH = 14;
const diatonic = p => ((p%7)+7)%7;
const pitchName = p => NAMES[p] || ((p<0?'낮은 ':'더 높은 ')+NAMES[diatonic(p)]);
const midiPitch = p => PITCHES[diatonic(p)]+12*Math.floor(p/7);
const clampPitch = p => Math.max(LOW_PITCH,Math.min(HIGH_PITCH,p));
const beatLabel = ticks => ['','반 박','한 박','한 박 반','두 박','두 박 반','세 박','세 박 반','네 박'][ticks];
const ledgerPitches = p => p<=0?Array.from({length:1+Math.floor(-p/2)},(_,i)=>-2*i):Array.from({length:Math.max(0,Math.floor((p-10)/2))},(_,i)=>12+2*i);
const restGlyphY = len => len===8?60:55;
const restTextY = 78;
const SCORE_ROW = 148, LYRIC_BASELINE = 146;
const SCORE_WIDTH = 1480;
const lyricFieldWidth = text => Math.min(76,Math.max(24,(text||'').trim().length*17+4));
function notePositions(bar,width,lead,minGap=25){
  const space=width-lead-38;
  const extra=bar.map(n=>Math.min(4,(n.lyric||'').trim().length));
  const gaps=bar.slice(1).map((_,i)=>Math.max(minGap,(extra[i]+extra[i+1])*minGap*.46+4));
  const total=gaps.reduce((sum,gap)=>sum+gap,0);
  const fit=Math.min(1,space/Math.max(total,1));
  let remaining=total*fit;
  let tick=0, previous=-Infinity;
  return bar.map((note,i)=>{
    const gap=(gaps[i-1]||0)*fit;
    remaining-=gap;
    const latest=lead+19+space-remaining;
    const ideal=lead+19+tick*space/8;
    tick+=note.len;
    previous=Math.max(previous+gap,Math.min(latest,ideal));
    return note.rest&&note.len===8?(width+lead)/2:previous;
  });
}
const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filled = notes => notes.reduce((sum,n)=>sum+n.len,0);
const complete = song => song.bars.every(bar=>filled(bar)===8);
const closestTempo = bpm => TEMPOS.reduce((a,b)=>Math.abs(a[0]-bpm)<=Math.abs(b[0]-bpm)?a:b);
const freshSong = () => ({step:1,artist:'',title:'',description:'',bpm:108,voice:0,bars:Array.from({length:8},()=>[]),video:null});
function exampleSong(){
  const song = freshSong();
  Object.assign(song,{artist:'솔바람',title:'작은 새의 아침',description:'밝고 가볍게, 높은 음과 낮은 음이 번갈아 나와요.'});
  const lyrics = ['파란새가','지저귀며','노래해요','푸른하늘','햇살따라','날아가요','함께불러','우리노래'];
  const pitches = [[2,4,5,4],[2,1,0,2],[4,5,7,5],[4,2,1,0],[2,4,5,7],[7,5,4,2],[1,2,4,1],[2,1,0,0]];
  const spaces = [[2],[],[],[2],[2],[],[2],[2]];
  song.bars=pitches.map((bar,i)=>bar.map((p,j)=>({id:uid(),p,len:2,rest:false,lyric:(spaces[i].includes(j)?' ':'')+lyrics[i][j]})));
  return song;
}
function scoreMarkup(song,{active=-1,lyrics=false,inputs=false,selected='',first=0,count=8,measuresPerLine=4}={}){
  const bars=song.bars.slice(first,first+count);
  const columns=Math.min(count,measuresPerLine), barW=(SCORE_WIDTH-24)/4, width=24+columns*barW, rowH=lyrics?184:SCORE_ROW;
  const blocks=bars.map((bar,i)=>{
    const mi=first+i, x=12+i%columns*barW, y=Math.floor(i/columns)*rowH;
    const lead=scoreLead(mi,i%columns);
    const positions=notePositions(bar,barW,lead);
    const events=bar.map((n,j)=>{
      const nx=positions[j];
      const lyricWidth=lyricFieldWidth(n.lyric);
      const ny=90-n.p*5, dotted=n.len===3||n.len===6;
      const open=n.len>=4, stem=n.len!==8, up=n.p<6;
      const sy=up?ny-30:ny+30, sx=up?nx+5.7:nx-5.7;
      const ledger=ledgerPitches(n.p).map(p=>90-p*5);
      const rest=VALUES.find(v=>v[0]===n.len)?.[3];
      const symbol=n.rest?(n.len>=4?'<rect x="'+(nx-7)+'" y="'+restGlyphY(n.len)+'" width="14" height="5" fill="currentColor"/>' : '<text x="'+nx+'" y="'+restTextY+'" text-anchor="middle" font-size="32" font-family="Noto Music, Segoe UI Symbol, serif" fill="currentColor">'+rest.replace('·','')+'</text>'):
        ledger.map(ly=>'<line x1="'+(nx-11)+'" x2="'+(nx+11)+'" y1="'+ly+'" y2="'+ly+'"/>').join('')+
        '<ellipse cx="'+nx+'" cy="'+ny+'" rx="7" ry="4.8" transform="rotate(-15 '+nx+' '+ny+')" fill="'+(open?'white':'currentColor')+'" stroke="currentColor" stroke-width="1.6"/>'+
        (stem?'<line x1="'+sx+'" x2="'+sx+'" y1="'+ny+'" y2="'+sy+'" stroke-width="1.5"/>':'')+
        (n.len===1?'<path d="M '+sx+' '+sy+' q 11 '+(up?6:-6)+' 8 '+(up?16:-16)+'" fill="none" stroke-width="2"/>':'');
      const center=n.rest?60:ny;
      return '<g class="event '+(selected===n.id?'selected':'')+'" data-note="'+n.id+'" data-bar="'+mi+'" '+(lyrics?'':'tabindex="0" role="button"')+' aria-label="'+(n.rest?'쉼표':pitchName(n.p))+'"><rect class="hit" x="'+(nx-12)+'" y="'+(center-19)+'" width="24" height="38" fill="transparent"/><rect class="note-outline" x="'+(nx-11)+'" y="'+(center-11)+'" width="22" height="22" rx="5" fill="none"/>'+symbol+(dotted?'<circle cx="'+(nx+11)+'" cy="'+(n.rest?57:ny-(n.p%2===0?4:0))+'" r="1.8" fill="currentColor"/>':'')+
      (lyrics&&!n.rest?(inputs?'<foreignObject x="'+(nx-lyricWidth/2)+'" y="136" width="'+lyricWidth+'" height="36"><input class="lyric" aria-label="'+(mi+1)+'마디 노랫말" data-lyric="'+n.id+'" value="'+esc(n.lyric)+'" title="'+esc(n.lyric)+'"></foreignObject>':'<text x="'+nx+'" y="'+LYRIC_BASELINE+'" text-anchor="middle" font-size="17" fill="currentColor">'+esc(n.lyric.trim())+'</text>'):'')+'</g>';
    }).join('');
    return '<g class="measure '+(active===mi?'on':'')+'" data-measure="'+mi+'" transform="translate('+x+' '+y+')"><rect class="measure-bg" y="5" width="'+barW+'" height="'+(rowH-9)+'" fill="transparent"/>'+
      '<text x="9" y="23" fill="currentColor" font-size="13">'+(mi+1)+'</text>'+
      [40,50,60,70,80].map(ly=>'<line x1="'+(i%columns===0?8:0)+'" x2="'+barW+'" y1="'+ly+'" y2="'+ly+'" stroke="currentColor" stroke-width=".85"/>').join('')+
      '<line x1="'+barW+'" x2="'+barW+'" y1="40" y2="80" stroke="currentColor"/>'+
      (mi===7?'<line x1="'+(barW-4)+'" x2="'+(barW-4)+'" y1="40" y2="80" stroke="currentColor" stroke-width=".9"/>':'')+
      (i%columns===0?'<text class="music-glyph" x="12" y="79" font-family="Noto Music, Segoe UI Symbol, serif" font-size="45" fill="currentColor">𝄞</text>':'')+
      (mi===0?'<text x="59" y="59" font-size="23" font-family="serif" font-weight="bold" fill="currentColor">4</text><text x="59" y="79" font-size="23" font-family="serif" font-weight="bold" fill="currentColor">4</text>':'')+events+'</g>';
  });
  return '<svg class="score" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+(Math.ceil(count/columns)*rowH)+'" aria-label="4분의 4박자 오선 악보">'+blocks.join('')+'</svg>';
}
function scoreLead(measure,column){return measure===0?76:column===0?48:11;}
const VOICES=[
  {a:[1,.35,.18,.09],attack:.008,decay:4},
  {a:[1,.1,.03],attack:.06,decay:.4},
  {a:[1,0,.36],attack:.004,decay:9},
  {a:[1,.48,.24,.12,.07],attack:.006,decay:5},
  {a:[1,.5,.23,0,.12],attack:.028,decay:.08},
  {a:[1,0,.44,0,.22,0,.09],attack:.036,decay:.6},
  {a:[1,.03,0,.36,0,.2],attack:.004,decay:3},
  {a:[1,.61,.37,.25,.14,.09],attack:.14,decay:.24}
];
function sound(ctx,dest,voice,pitch,start,duration){
  const setting=VOICES[voice]||VOICES[0], osc=ctx.createOscillator(), gain=ctx.createGain();
  osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(setting.a.length+1),new Float32Array([0,...setting.a])));
  osc.frequency.value=440*2**((midiPitch(pitch)-69)/12);
  const peak=Math.min(setting.attack,duration/3);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(.25,start+peak);
  gain.gain.exponentialRampToValueAtTime(Math.max(.001,.25*Math.exp(-setting.decay*duration)),start+duration);
  gain.gain.exponentialRampToValueAtTime(.0001,start+duration+.07);
  osc.connect(gain).connect(dest);
  osc.start(start);
  osc.stop(start+duration+.075);
  return osc;
}
let audioContext, playback;
async function getAudio(){
  audioContext??=new (window.AudioContext||window.webkitAudioContext)();
  if(audioContext.state==='suspended')await audioContext.resume();
  return audioContext;
}
async function audition(song,pitch){
  try{const ctx=await getAudio();sound(ctx,ctx.destination,song.voice,pitch,ctx.currentTime,.18);}catch{}
}
function timeline(song,first=0,count=8){
  const events=[], unit=30/song.bpm;
  for(let bar=first;bar<first+count;bar++){
    let time=(bar-first)*8*unit;
    for(const note of song.bars[bar]){
      const duration=note.len*unit;
      events.push({note,bar,time,duration});
      time+=duration;
    }
  }
  return {events,unit,first,count,duration:count*8*unit};
}
function scheduleSong(ctx,dest,song,track,start){
  const nodes=track.events.filter(e=>!e.note.rest).map(e=>sound(ctx,dest,song.voice,e.note.p,start+e.time,e.duration*.92));
  const beat=DRUMS[song.drums];
  if(!beat?.[1])return nodes;
  const [,kick,snare,hat,tone]=beat;
  const length=Math.ceil(ctx.sampleRate*.16), noise=ctx.createBuffer(1,length,ctx.sampleRate);
  const samples=noise.getChannelData(0);
  for(let i=0;i<length;i++)samples[i]=Math.random()*2-1;
  const hit=(kind,time)=>{
    const gain=ctx.createGain(), duration=Math.min(kind===2?.045:.15,track.unit*.88);
    const node=kind===0?ctx.createOscillator():ctx.createBufferSource();
    if(kind===0){
      node.frequency.setValueAtTime(125*tone,time);
      node.frequency.exponentialRampToValueAtTime(44*tone,time+duration);
      node.connect(gain);
    }else{
      node.buffer=noise;
      const filter=ctx.createBiquadFilter();
      filter.type='highpass';filter.frequency.value=(kind===1?1250:6800)*tone;
      node.connect(filter).connect(gain);
    }
    gain.gain.setValueAtTime([.18,.09,.042][kind],time);
    gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    gain.connect(dest);node.start(time);node.stop(time+duration);nodes.push(node);
  };
  for(let i=0;i<track.count;i++){
    const last=track.first+i===7;
    const patterns=last?[[0,4,6],[2,5,6],[0,2,4,6]]:[kick,snare,hat];
    patterns.forEach((ticks,kind)=>ticks.forEach(tick=>hit(kind,start+(8*i+tick)*track.unit)));
  }
  return nodes;
}
function stopPlayback(){
  if(!playback)return;
  const prev=playback;playback=null;
  cancelAnimationFrame(prev.frame);
  for(const osc of prev.nodes)try{osc.stop();}catch{}
  document.querySelectorAll('.play,.played').forEach(el=>el.classList.remove('play','played'));
  prev.done?.();
}
async function playTrack(song,track,{lead=0,tail=0,draw,done}={}){
  stopPlayback();
  const ctx=await getAudio();
  const start=ctx.currentTime+.055;
  const job={nodes:scheduleSong(ctx,ctx.destination,song,track,start+lead),done};
  playback=job;
  function frame(){
    if(playback!==job)return;
    const elapsed=Math.max(0,ctx.currentTime-start);
    if(elapsed>=lead+track.duration+tail){stopPlayback();return;}
    draw?.(elapsed);
    job.frame=requestAnimationFrame(frame);
  }
  frame();
}
function playScore(song,first,count){
  const track=timeline(song,first,count);
  return playTrack(song,track,{draw(t){
    const bar=first+Math.floor(t/(track.unit*8));
    document.querySelectorAll('[data-measure]').forEach(el=>el.classList.toggle('play',+el.dataset.measure===bar));
    for(const e of track.events){
      const el=document.querySelector('[data-note="'+e.note.id+'"]');
      el?.classList.toggle('play',t>=e.time&&t<e.time+e.duration);
      el?.classList.toggle('played',t>=e.time+e.duration&&bar===e.bar);
    }
  }});
}
function fileName(song,type,ext){
  return (type+' - '+(song.artist||'작곡가')+' - '+(song.title||'제목 없음')).replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_')+'.'+ext;
}
function download(blob,name){
  const url=URL.createObjectURL(blob), anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function exportMp3(song){
  if(!window.lamejs)throw Error('MP3 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
  const rate=44100, track=timeline(song), ctx=new OfflineAudioContext(1,Math.ceil((track.duration+.1)*rate),rate);
  scheduleSong(ctx,ctx.destination,song,track,0);
  const audio=(await ctx.startRendering()).getChannelData(0);
  const encoder=new lamejs.Mp3Encoder(1,rate,128), chunks=[];
  for(let i=0;i<audio.length;i+=1152){
    const block=Int16Array.from(audio.subarray(i,i+1152),v=>Math.max(-1,Math.min(1,v))*32767);
    const encoded=encoder.encodeBuffer(block);
    if(encoded.length)chunks.push(Uint8Array.from(encoded));
  }
  chunks.push(Uint8Array.from(encoder.flush()));
  download(new Blob(chunks,{type:'audio/mpeg'}),fileName(song,'음원','mp3'));
}
async function exportPdf(song){
  await document.fonts.ready;
  const canvas=document.createElement('canvas');
  canvas.width=1684;canvas.height=1190;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,1684,1190);
  ctx.fillStyle='#111';ctx.textAlign='center';ctx.font='bold 60px "Noto Sans KR", sans-serif';ctx.fillText(song.title,842,142,1450);
  ctx.textAlign='right';ctx.font='30px "Noto Sans KR",sans-serif';ctx.fillText(song.artist,1584,288,1050);
  ctx.textAlign='left';ctx.fillText(closestTempo(song.bpm)[2]+'  ♩ = '+song.bpm,100,288);
  const svg=scoreMarkup(song,{lyrics:false}).replace('aria-label="4분의 4박자 오선 악보"','width="'+SCORE_WIDTH+'" height="'+(2*SCORE_ROW)+'" color="#111"').replace(/<line (?![^>]*stroke=")/g,'<line stroke="currentColor" ').replace(/<rect class="(?:measure-bg|hit|note-outline)"[^>]+\/>/g,'');
  const image=await loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
  const scale=1540/SCORE_WIDTH, barWidth=(SCORE_WIDTH-24)/4;
  for(let row=0;row<2;row++){
    const top=330+row*390;
    ctx.drawImage(image,0,row*SCORE_ROW,SCORE_WIDTH,SCORE_ROW,72,top,SCORE_WIDTH*scale,SCORE_ROW*scale);
    ctx.textAlign='center';
    for(let col=0;col<4;col++){
      const lead=scoreLead(row*4+col,col);
      const bar=song.bars[row*4+col], positions=notePositions(bar,barWidth,lead);
      for(const [index,n] of bar.entries()){
        const x=12+barWidth*col+positions[index];
        if(n.rest||!n.lyric)continue;
        ctx.font='23px "Noto Sans KR",sans-serif';
        ctx.fillText(n.lyric.trim(),72+x*scale,top+LYRIC_BASELINE*scale);
      }
    }
  }
  const jpg=new Uint8Array(await (await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.96))).arrayBuffer());
  const encoder=new TextEncoder(), parts=[], offsets=[0];let length=0;
  const add=data=>{const bytes=typeof data==='string'?encoder.encode(data):data;parts.push(bytes);length+=bytes.byteLength;};
  const object=(id,parts)=>{offsets[id]=length;add(id+' 0 obj\n');parts.forEach(add);add('\nendobj\n');};
  add('%PDF-1.4\n');
  object(1,['<< /Type /Catalog /Pages 2 0 R >>']);
  object(2,['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
  object(3,['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Score 4 0 R >> >> /Contents 5 0 R >>']);
  object(4,['<< /Type /XObject /Subtype /Image /Width 1684 /Height 1190 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n',jpg,'\nendstream']);
  const stream='q 842 0 0 595 0 0 cm /Score Do Q\n';
  object(5,['<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream']);
  const xref=length;
  add('xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
  download(new Blob(parts,{type:'application/pdf'}),fileName(song,'악보','pdf'));
}
function loadImage(src){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(Error('이미지를 열 수 없어요.'));
    image.src=src;
  });
}
