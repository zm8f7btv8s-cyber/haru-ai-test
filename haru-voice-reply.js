(()=>{'use strict';
const $=id=>document.getElementById(id), synth=window.speechSynthesis;
const KEY='haru.voice.reply.settings.v2';const toggle=$('haruVoiceEnabled'),rate=$('haruVoiceRate');
let settings={enabled:true,rate:1};try{settings={...settings,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{}
toggle.checked=settings.enabled!==false;rate.value=String(settings.rate||1);
function save(){settings.enabled=toggle.checked;settings.rate=Number(rate.value);try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{}}
toggle.onchange=()=>{save();if(!toggle.checked)stop()};rate.onchange=save;
let voicePending=false,deadline=0,seen=new Set(),utterance=null;
const supported=!!(synth&&window.SpeechSynthesisUtterance);
function stop(){if(supported)synth.cancel();utterance=null;document.querySelectorAll('.haru-stop').forEach(b=>b.disabled=true)}
function clean(t){return String(t||'').replace(/(20\d\d)-(\d\d)-(\d\d)/g,(_,y,m,d)=>`${Number(m)}월 ${Number(d)}일`).replace(/([01]\d|2[0-3]):([0-5]\d)/g,(_,h,m)=>`${Number(h)}시 ${Number(m)?Number(m)+'분':''}`).replace(/[•·]/g,' ').replace(/\s+/g,' ').trim().slice(0,1500)}
function speak(t){if(!supported)return;stop();const u=new SpeechSynthesisUtterance(clean(t));utterance=u;u.lang='ko-KR';u.rate=settings.rate;const voices=synth.getVoices();u.voice=voices.find(v=>v.lang.toLowerCase()==='ko-kr')||voices.find(v=>v.lang.startsWith('ko'))||null;u.onend=u.onerror=()=>{if(utterance===u)utterance=null;document.querySelectorAll('.haru-stop').forEach(b=>b.disabled=true)};synth.speak(u);document.querySelectorAll('.haru-stop').forEach(b=>b.disabled=false)}
window.addEventListener('haru:voice-question-ready',()=>{voicePending=true;deadline=Date.now()+45000;seen=new Set([...document.querySelectorAll('#messages .bubble:not(.mine):not(.ai-pending)')].map(x=>x.textContent.trim()));if(supported)try{synth.cancel()}catch{}});
function decorate(){const bubbles=[...document.querySelectorAll('#messages .bubble:not(.mine):not(.ai-pending)')];for(const b of bubbles){if(b.dataset.haruVoice)return;const text=b.firstChild?.textContent?.trim()||'';if(!text)continue;b.dataset.haruVoice='1';const row=document.createElement('div');row.className='haru-voice-actions';const replay=document.createElement('button');replay.type='button';replay.textContent='🔊 다시 듣기';replay.onclick=()=>speak(text);const halt=document.createElement('button');halt.type='button';halt.className='haru-stop';halt.textContent='■ 중지';halt.disabled=true;halt.onclick=stop;row.append(replay,halt);b.append(row)}
if(voicePending&&Date.now()<deadline){const fresh=bubbles.findLast(b=>!seen.has(b.firstChild?.textContent?.trim()||''));if(fresh){const text=fresh.firstChild?.textContent?.trim()||'';if(text&&!/서버 연결에 실패|AI 서버 연결에 실패|오류/.test(text)){voicePending=false;if(settings.enabled)speak(text)}else if(text)voicePending=false}}
}
const root=$('messages');new MutationObserver(()=>queueMicrotask(decorate)).observe(root,{childList:true,subtree:true});decorate();
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',stop);
if(!supported){toggle.disabled=true;toggle.checked=false;toggle.closest('.haru-voice-settings').insertAdjacentHTML('beforeend','<p class="hint">이 브라우저에서는 음성 읽기를 지원하지 않아요.</p>')}
})();
