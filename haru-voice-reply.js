(()=>{'use strict';
const $=id=>document.getElementById(id), synth=window.speechSynthesis;
const KEY='haru.voice.reply.settings.v2',toggle=$('haruVoiceEnabled'),rate=$('haruVoiceRate');
let settings={enabled:true,rate:1};try{settings={...settings,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{}
toggle.checked=settings.enabled!==false;rate.value=String(settings.rate||1);
function save(){settings.enabled=toggle.checked;settings.rate=Number(rate.value);try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{}}
const supported=!!(synth&&window.SpeechSynthesisUtterance);
let activeRequestId=null,utterance=null,playToken=0,retryTimer=null,watchTimer=null,voiceList=[],recognitionFinishing=false;
let audioUnlocked=false,unlockPending=false;
function unlockAudio(){
 if(!supported||audioUnlocked||unlockPending)return;
 unlockPending=true;
 try{
  const warm=new SpeechSynthesisUtterance(' ');
  warm.lang='ko-KR';warm.volume=0;warm.rate=1;
  warm.onstart=()=>{audioUnlocked=true;unlockPending=false};
  warm.onend=()=>{audioUnlocked=true;unlockPending=false};
  warm.onerror=()=>{unlockPending=false};
  synth.speak(warm);
  setTimeout(()=>{unlockPending=false},800);
 }catch{unlockPending=false}
}
document.addEventListener('pointerdown',unlockAudio,{passive:true});
document.addEventListener('touchstart',unlockAudio,{passive:true});

function buttons(active){document.querySelectorAll('.haru-stop').forEach(b=>b.disabled=!active)}
function clearTimers(){clearTimeout(retryTimer);clearInterval(watchTimer);retryTimer=null;watchTimer=null}
function stop(){playToken++;clearTimers();if(supported)synth.cancel();utterance=null;buttons(false)}
function clean(t){return String(t||'').replace(/(20\d\d)-(\d\d)-(\d\d)/g,(_,y,m,d)=>`${Number(m)}월 ${Number(d)}일`).replace(/([01]\d|2[0-3]):([0-5]\d)/g,(_,h,m)=>`${Number(h)}시 ${Number(m)?Number(m)+'분':''}`).replace(/[•·]/g,' ').replace(/\s+/g,' ').trim().slice(0,1500)}
function voices(){const current=synth.getVoices()||[];if(current.length)voiceList=current;return voiceList}
function chooseVoice(){
 const korean=voices().filter(v=>/^ko(?:-|$)/i.test(v.lang||''));
 if(!korean.length)return null;
 // Prefer high-quality on-device Korean voices when the browser exposes them.
 const score=v=>{const name=(v.name||'').toLowerCase();let n=0;
  if(/premium|enhanced|고품질|siri|natural|neural/.test(name))n+=15;
  if(/compact|저품질/.test(name))n-=10;
  if(v.localService)n+=2;
  if(/^ko-kr$/i.test(v.lang))n+=3;
  return n;
 };
 return korean.slice().sort((a,b)=>score(b)-score(a))[0];
}
function naturalSpeech(text){
 let t=clean(text);
 // Spoken Korean is more natural with short pauses and conversational endings.
 t=t.replace(/\s*[·•]\s*/g,', ').replace(/\s*\/\s*/g,', ');
 t=t.replace(/(\d{1,2})시\s+0분/g,'$1시');
 t=t.replace(/([.!?])(?=\S)/g,'$1 ');
 return t;
}
if(supported){voices();if(synth.addEventListener)synth.addEventListener('voiceschanged',voices)}
function speak(text,{automatic=false}={}){
 if(!supported)return false;
 const content=naturalSpeech(text);if(!content)return false;
 stop();const token=playToken;
 const u=new SpeechSynthesisUtterance(content);utterance=u;u.lang='ko-KR';u.rate=Math.max(.8,Math.min(1.12,settings.rate*.96));u.pitch=1;u.volume=1;
 u.voice=chooseVoice();
 let started=false,finished=false;
 function finish(){if(finished||token!==playToken)return;finished=true;clearTimers();if(utterance===u)utterance=null;buttons(false)}
 u.onstart=()=>{if(token!==playToken)return;started=true;clearTimeout(retryTimer);buttons(true)};
 u.onend=finish;u.onerror=e=>{
  if(token!==playToken||finished)return;
  // Never loop on a rejected iOS speech request; replay remains available.
  finish();
};
 try{synth.speak(u);buttons(true)}catch{finish();return false}
 // iOS can leave a newly queued utterance paused. Resume once; never enqueue duplicate speech.
 retryTimer=setTimeout(()=>{if(token!==playToken||finished||started||document.hidden)return;try{if(synth.paused)synth.resume()}catch{}},350);
 // Resume a paused utterance without cancelling or restarting its text.
 watchTimer=setInterval(()=>{if(token!==playToken||finished){clearTimers();return}if(document.hidden){stop();return}try{if(synth.paused)synth.resume()}catch{}},900);
 return true;
}
toggle.onchange=()=>{save();if(!toggle.checked)stop()};rate.onchange=save;
window.addEventListener('haru:question-start',e=>{activeRequestId=e.detail.requestId;recognitionFinishing=!!e.detail.fromVoice;stop()});
window.addEventListener('haru:answer-ready',e=>{const d=e.detail;if(d.requestId!==activeRequestId||!settings.enabled)return;const id=d.requestId;const delay=recognitionFinishing?650:180;recognitionFinishing=false;setTimeout(()=>{if(id===activeRequestId&&!document.hidden)speak(d.text,{automatic:true})},delay)});
window.addEventListener('haru:answer-error',e=>{if(e.detail.requestId===activeRequestId)stop()});
window.addEventListener('haru:save-confirmed',e=>{if(settings.enabled)setTimeout(()=>{if(!document.hidden)speak(e.detail.reply,{automatic:true})},180)});
function decorate(){const bubbles=[...document.querySelectorAll('#messages .bubble:not(.mine):not(.ai-pending)')];for(const b of bubbles){if(b.dataset.haruVoice)return;const text=b.firstChild?.textContent?.trim()||'';if(!text)continue;b.dataset.haruVoice='1';const row=document.createElement('div');row.className='haru-voice-actions';const replay=document.createElement('button');replay.type='button';replay.textContent='🔊 다시 듣기';replay.onclick=()=>speak(text);const halt=document.createElement('button');halt.type='button';halt.className='haru-stop';halt.textContent='■ 중지';halt.disabled=true;halt.onclick=stop;row.append(replay,halt);b.append(row)}}
const root=$('messages');new MutationObserver(()=>queueMicrotask(decorate)).observe(root,{childList:true,subtree:true});decorate();
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',stop);
if(!supported){toggle.disabled=true;toggle.checked=false;toggle.closest('.haru-voice-settings').insertAdjacentHTML('beforeend','<p class="hint">이 브라우저에서는 음성 읽기를 지원하지 않아요.</p>')}
})();
