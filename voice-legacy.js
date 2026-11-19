(()=>{'use strict';
const $=id=>document.getElementById(id);
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const homeMic=$('mic'),homeSend=$('sendAsk'),chatMic=$('chatMic'),chatDone=$('chatVoiceDone');
const homeStatus=$('speechStatus'),chatStatus=$('chatSpeechStatus'),prompt=$('voicePrompt');
const SILENCE_MS=2000;
let session=null,timer=null,audio=null,lastVoice='',lastCombined='';
let voiceSubmit=null;
function tone(kind){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=audio||new AC();audio.resume().catch(()=>{});(kind==='start'?[880,1175]:[1175,784]).forEach((hz,i)=>{const t=audio.currentTime+.01+i*.16,o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.15);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.16)})}catch{}}
function listening(){return !!session?.active}
function ui(message=''){
 const active=listening(),home=active&&session.target==='home',chat=active&&session.target==='chat';
 homeMic.textContent=home?'✕ 취소':'🎙 말하기';homeMic.setAttribute('aria-pressed',String(home));
 homeSend.textContent=home?'✓ 완료':'➤ 전송';homeSend.type=home?'button':'submit';
 chatMic.setAttribute('aria-pressed',String(chat));chatMic.setAttribute('aria-label',chat?'음성 입력 취소':'음성으로 질문하기');
 chatMic.innerHTML=chat?'<span aria-hidden="true" style="font-size:22px;line-height:1">✕</span>':MIC_ICON;
 if(chatDone)chatDone.hidden=!chat;
 if(prompt)prompt.textContent=active?'듣고 있어요…':'편하게 말씀해 주세요';
 if(homeStatus)homeStatus.textContent=home?message:(!active&&session?.target==='home'?message:'');
 if(chatStatus)chatStatus.textContent=chat?message:(!active&&session?.target==='chat'?message:'');
}
const MIC_ICON=chatMic.innerHTML;
function clearTimer(){clearTimeout(timer);timer=null}
function compose(s){if(session!==s)return;const value=[s.base,s.final,s.cycleFinal,s.interim].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();s.field.value=value;lastCombined=value;lastVoice=[s.final,s.cycleFinal,s.interim].filter(Boolean).join(' ').trim();s.field.dispatchEvent(new Event('input',{bubbles:true}));}
function schedule(s){clearTimer();if(!s.active||!s.heard)return;timer=setTimeout(()=>{if(session===s&&s.active)finish()},SILENCE_MS)}
function stopRecognizer(s,abort){clearTimer();clearTimeout(s.restart);const r=s.recognition;s.recognition=null;if(!r)return;r.onstart=r.onresult=r.onerror=r.onend=null;try{abort?r.abort():r.stop()}catch{}}
function begin(target){if(listening())return;const field=$(target==='chat'?'chatText':'askText');const current=field.value.trim();const base=lastVoice&&current===lastCombined?current.slice(0,current.length-lastVoice.length).trim():current;const s={target,field,base,final:'',cycleFinal:'',interim:'',active:true,heard:false,recognition:null,restart:null,failures:0,error:''};session=s;
 if(!SR){s.active=false;ui('이 브라우저는 음성 인식을 지원하지 않아요. 키보드 마이크를 이용해 주세요.');return}
 tone('start');ui('음성 인식 중 · 2초간 말이 없으면 종료해요');cycle(s)}
function cycle(s){if(session!==s||!s.active)return;const r=new SR();s.recognition=r;s.error='';s.cycleFinal='';s.interim='';r.lang='ko-KR';r.interimResults=true;r.continuous=true;
 r.onresult=e=>{if(session!==s||s.recognition!==r||!s.active)return;let f='',i='';for(let n=0;n<e.results.length;n++){const v=e.results[n][0]?.transcript||'';if(e.results[n].isFinal)f+=v+' ';else i+=v+' '}s.cycleFinal=f.trim();s.interim=i.trim();if(f||i){s.heard=true;compose(s);schedule(s)}};
 r.onerror=e=>{s.error=e.error||'unknown'};
 r.onend=()=>{if(session!==s||s.recognition!==r||!s.active)return;{const fragment=s.cycleFinal||s.interim;if(fragment&&!(s.final===fragment||s.final.endsWith(' '+fragment)))s.final=[s.final,fragment].filter(Boolean).join(' ').trim();}s.cycleFinal='';s.interim='';s.recognition=null;compose(s);
 if(['not-allowed','service-not-allowed','audio-capture','network'].includes(s.error)){s.active=false;clearTimer();ui('음성 인식이 중단됐어요. 권한이나 연결을 확인해 주세요.');tone('end');return}
 if(s.failures++<2){s.restart=setTimeout(()=>cycle(s),350)}else{s.active=false;clearTimer();tone('end');ui('음성 인식이 종료됐어요. 다시 말하려면 마이크를 눌러 주세요.')}};
 try{r.start()}catch{s.active=false;clearTimer();ui('마이크를 시작하지 못했어요. 다시 눌러 주세요.')}}
function finish(){const s=session;if(!listening())return;clearTimer();s.active=false;clearTimeout(s.restart);tone('end');const r=s.recognition;
 const done=()=>{if(session!==s||s.finished)return;s.finished=true;{const fragment=s.cycleFinal||s.interim;if(fragment&&!(s.final===fragment||s.final.endsWith(' '+fragment)))s.final=[s.final,fragment].filter(Boolean).join(' ').trim();}s.cycleFinal='';s.interim='';compose(s);s.recognition=null;ui('인식 완료 · 하루에게 질문을 보내고 있어요…');if(s.field.value.trim()){voiceSubmit={target:s.target,text:s.field.value.trim(),at:Date.now()};const form=$(s.target==='chat'?'chatForm':'ask');if(form?.requestSubmit)form.requestSubmit();else form?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}else ui('인식된 내용이 없어요. 다시 말씀해 주세요.')};
 if(r){r.onresult=e=>{let f='',i='';for(let n=0;n<e.results.length;n++){const v=e.results[n][0]?.transcript||'';if(e.results[n].isFinal)f+=v+' ';else i+=v+' '}s.cycleFinal=f.trim();s.interim=i.trim();compose(s)};r.onend=done;try{r.stop()}catch{stopRecognizer(s,true);done()};ui('음성 인식을 마무리하고 있어요…')}else done();}
function cancel(){const s=session;if(!listening())return;stopRecognizer(s,true);s.active=false;session=null;s.field.value=s.base;lastVoice='';lastCombined='';s.field.dispatchEvent(new Event('input',{bubbles:true}));tone('end');ui('음성 입력을 취소했어요.');(s.target==='chat'?chatStatus:homeStatus).textContent='음성 입력을 취소했어요.';s.field.focus()}
homeMic.addEventListener('click',()=>listening()?cancel():begin('home'));
chatMic?.addEventListener('click',()=>listening()?cancel():begin('chat'));
chatDone?.addEventListener('click',finish);
homeSend.addEventListener('click',e=>{if(listening()&&session.target==='home'){e.preventDefault();finish()}});
for(const input of [$('askText'),$('chatText')])input?.addEventListener('input',()=>{if(!listening()&&input.value!==lastCombined){lastVoice='';lastCombined=''}});
window.HaruLegacyVoice={consumeVoiceSubmit:(target,text)=>{const v=voiceSubmit;voiceSubmit=null;return !!v&&v.target===target&&v.text===text&&Date.now()-v.at<5000},open:()=>begin('home'),complete:finish,isListening:listening,reset:()=>{if(listening())stopRecognizer(session,true);session=null;voiceSubmit=null;lastVoice='';lastCombined='';ui()},silenceMs:SILENCE_MS,wasVoiceInput:(value)=>!!lastVoice&&String(value||'').includes(lastVoice)};ui();
})();
