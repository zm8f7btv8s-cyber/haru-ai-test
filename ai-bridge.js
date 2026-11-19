(()=>{'use strict';
const ENDPOINT='https://haru-ai.nsunrang.workers.dev/chat';
const KEY='haru.assistant.v2.foundation';
const $=id=>document.getElementById(id);
const originalHome=$('ask').onsubmit;
const originalChat=$('chatForm').onsubmit;
let lastRequest='';
let busy=false;
let pendingWeather=false;let pendingEvent=null;let lastHomeQuestion='';
try{const saved=JSON.parse(sessionStorage.getItem('haru.pending.v3k')||'null');if(saved&&saved.item&&Date.now()-saved.at<3600000)pendingEvent=saved.item}catch{}
function setPending(item){pendingEvent=item;try{if(item)sessionStorage.setItem('haru.pending.v3k',JSON.stringify({item,at:Date.now()}));else sessionStorage.removeItem('haru.pending.v3k')}catch{}}
const queued=[];
const localToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
function localAgenda(text){
 if(!/(오늘|내일|모레)/.test(text)||!/(일정|할\s*일|스케줄)/.test(text)||!/(알려|보여|뭐|몇|있어|브리핑)/.test(text))return null;
 const day=new Date();day.setHours(12,0,0,0);if(/모레/.test(text))day.setDate(day.getDate()+2);else if(/내일/.test(text))day.setDate(day.getDate()+1);
 const date=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
 const store=read();if(!store)return '저장된 일정을 불러오지 못했어. 다시 시도해 줘.';
 const events=(store.events||[]).filter(x=>x.date===date).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 const tasks=(store.tasks||[]).filter(x=>x.date===date&&!x.done);const label=/모레/.test(text)?'모레':/내일/.test(text)?'내일':'오늘';
 return `${label}(${date}) 일정 ${events.length}건${events.length?'\n'+events.map(x=>'• '+(x.time||'종일')+' '+x.title).join('\n'): '\n등록된 일정이 없어.'}\n미완료 할 일 ${tasks.length}건${tasks.length?'\n'+tasks.map(x=>'• '+x.title).join('\n'):''}`;
}

// Existing schedule, task, memo and work commands always use the original
// local confirmation workflow. No AI output is ever automatically saved as an item.
const actionable=/예약|약속|회의|모임|일정|방문|진료|수업|골프|할\s*일|해야\s*할|잊지\s*말|챙겨|준비해|기억해|메모|적어\s*둬|기록해|작성해|정리해|조사해|비교해|계획\s*세워/;
const queryOnly=/(알려|보여|브리핑|몇\s*개|뭐\s*있|있어\?|있나요|어때|언제|무엇|뭐야|설명|추천)/;
const creation=/(등록|추가|저장|예약해|잡아\s*줘|넣어\s*줘|기록해|적어\s*둬|기억해|만들어|해\s*줘|있어|있다|있음|예정|갈\s*거|가야)/;
function isAction(text){
 // '목요일 12시에 화목회 점심 식사 있어' is a statement of a future appointment,
 // not a question. Ask for confirmation rather than silently saving it.
 if(/(?:알려\s*줘|보여\s*줘|브리핑|언제(?:야|지|인가)|몇\s*개|뭐\s*있|있어\s*\?|있나요|어때|설명|추천)/.test(text)&&!/(등록|추가|저장|예약해|잡아\s*줘)/.test(text))return false;
 const dated=/(?:오늘|내일|모레|이번\s*주|다음\s*주|월요일|화요일|수요일|목요일|금요일|토요일|일요일|\d{1,2}월\s*\d{1,2}일|\d{4}-\d{2}-\d{2})/.test(text);
 const event=/(?:약속|예약|모임|회의|식사|점심|저녁|병원|진료|수업|방문|골프|화목회|행사)/.test(text);
 if(dated&&event&&/(?:있어|있다|있음|예정|하기로|잡혔|갈\s*거|가야|만나)/.test(text))return true;
 return actionable.test(text)&&creation.test(text)
}
function read(){const s=window.HaruStore.read();return Array.isArray(s.messages)?s:{...s,messages:[]}}
function append(who,text){window.HaruStore.append(who,text)}
function showChat(){document.querySelector('[data-go="chat"]')?.click(); // fallback: the chat section has no dedicated nav button
if(!document.getElementById('chat').classList.contains('active')){
 document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='chat'));
 document.querySelectorAll('nav button').forEach(x=>x.classList.remove('selected'));
}
render();requestAnimationFrame(()=>{const root=$('messages');root.scrollTop=root.scrollHeight;window.scrollTo(0,document.documentElement.scrollHeight)})}
function showHomeReply(reply){const panel=$('haruHomeReply');if(!panel)return;panel.hidden=false;const body=$('haruHomeReplyText');body.textContent=reply;panel.scrollIntoView({block:'nearest',behavior:'smooth'});}
function render(){window.HaruRenderConversation(read()?.messages||[],$('messages'))}
async function requestAI(message){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);try{
const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message}),signal:controller.signal});
let body;try{body=await r.json()}catch{throw Error('서버 응답 형식을 확인할 수 없어요')}
if(!r.ok)throw Error(r.status===403?'접속 주소가 허용되지 않았어요 (403)':r.status===500?'서버 API 키 설정을 확인해 주세요 (500)':`서버 응답 오류 (${r.status}${body?.status?'/'+body.status:''})`);
if(typeof body?.reply!=='string'||!body.reply.trim())throw Error('AI 응답이 비어 있어요');return body.reply.trim();
}catch(e){if(e.name==='AbortError')throw Error('서버 응답이 지연돼 연결 시간이 초과됐어요');if(e instanceof TypeError)throw Error('서버 연결 실패: 네트워크 또는 CORS 설정을 확인해 주세요');throw e}finally{clearTimeout(timer)}}
const kinds=new Set(['events','tasks','notes','works']);
function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00');return !Number.isNaN(d.valueOf())&&[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')===v}
function extractJSON(raw){let t=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('AI 응답에서 JSON을 찾지 못했어요');return JSON.parse(t.slice(a,b+1))}}
async function interpretAI(text){
 const now=new Date();const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 const prompt=`당신은 한국어 일정/할 일/메모/작업 정보 추출기입니다. 현재 한국 날짜는 ${today}이고 시간대는 Asia/Seoul입니다. 다음 사용자의 요청을 분석하여 JSON 객체 하나만 출력하세요. 마크다운, 설명, 코드펜스 금지. 스키마: {"kind":"events|tasks|notes|works","title":"간결한 한국어 제목","date":"YYYY-MM-DD 또는 빈 문자열","time":"HH:MM 또는 빈 문자열","place":"장소 또는 빈 문자열"}. 약속/예약/모임/회의/일정은 events, 할 일/준비는 tasks, 기억/메모는 notes, 작성/조사/계획은 works. 날짜가 없으면 빈 문자열, 시간이 없으면 빈 문자열. 오늘/내일/모레는 현재 날짜 기준으로 계산. 추측 금지. 제목에서 날짜, 시간, 명령어 어미를 제거하되 의미는 유지. 요청 원문: ${JSON.stringify(text)}`;
 const raw=await requestAI(prompt);const obj=extractJSON(raw);
 if(!obj||!kinds.has(obj.kind)||typeof obj.title!=='string'||!obj.title.trim()||obj.title.length>160)throw Error('AI가 요청 정보를 올바르게 반환하지 않았어요');
 for(const k of ['date','time','place'])if(typeof obj[k]!=='string')throw Error('AI 응답 필드가 올바르지 않아요');
 if(obj.date&&!validDate(obj.date))throw Error('AI 날짜가 올바르지 않아요');
 if(obj.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(obj.time))throw Error('AI 시간이 올바르지 않아요');
 if(obj.place.length>160)throw Error('AI 장소가 너무 길어요');
 return {kind:obj.kind,title:obj.title.trim(),date:obj.date,time:obj.time,place:obj.place.trim(),original:text};
}
// The AI decides meaning from context; local code validates and executes only supported actions.
async function decideIntent(text){
 const history=(read().messages||[]).slice(-10).map(x=>({role:x.who==='user'?'user':'assistant',text:String(x.text||'').slice(0,350)}));
 const context={pendingSchedule:pendingEvent?{title:pendingEvent.title,date:pendingEvent.date,time:pendingEvent.time,place:pendingEvent.place}:null,pendingWeather,history,currentUtterance:text};
 const prompt='당신은 하루 개인비서의 의도 판단기입니다. 아래 대화 문맥을 읽고 사용자의 *현재 발화*가 무엇을 의미하는지 JSON 하나로만 반환하세요. action은 confirm(대기 중인 일정 등록에 동의), cancel(대기 일정 취소), revise(대기 일정의 날짜/시간/제목/장소 수정), create(새 일정/할 일/메모/작업 생성 의도), weather(날씨 질문), chat(일반 질문) 중 하나입니다. 단순한 응/오케이/그렇게 하자 같은 표현도 앞선 질문에 따라 판단하세요. 대기 중인 일정이 없다면 confirm/cancel/revise 금지. 수정과 동의를 동시에 말하면 revise를 우선하세요. 애매하면 chat으로 판단하세요. JSON 스키마: {"action":"confirm|cancel|revise|create|weather|chat","reason":"짧은 근거"}. 현재 날짜 '+localToday()+', 시간대 Asia/Seoul. 맥락: '+JSON.stringify(context);
 const parsed=extractJSON(await requestAI(prompt));
 if(!['confirm','cancel','revise','create','weather','chat'].includes(parsed.action))throw Error('AI 의도 판단 형식 오류');
 if(!pendingEvent&&['confirm','cancel','revise'].includes(parsed.action))return 'chat';
 return parsed.action;
}
async function revisePending(text){
 const prompt='당신은 일정 수정기입니다. 기존 일정과 사용자의 수정 요청을 반영해 JSON만 반환하세요. 기존 정보에서 요청하지 않은 항목은 유지하고 추측하지 마세요. 스키마 {"kind":"events","title":"문자열","date":"YYYY-MM-DD 또는 빈 문자열","time":"HH:MM 또는 빈 문자열","place":"문자열"}. 한국 날짜 '+localToday()+' Asia/Seoul. 기존: '+JSON.stringify(pendingEvent)+' 수정 요청: '+JSON.stringify(text);
 const obj=extractJSON(await requestAI(prompt));if(obj.kind!=='events'||typeof obj.title!=='string'||!obj.title.trim()||typeof obj.place!=='string'||typeof obj.date!=='string'||typeof obj.time!=='string'||(obj.date&&!validDate(obj.date))||(obj.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(obj.time)))throw Error('수정 결과를 검증하지 못했어');
 return {...pendingEvent,title:obj.title.slice(0,160),date:obj.date,time:obj.time,place:obj.place.slice(0,160)};
}
function parseLocalAppointment(text){
 const now=new Date(),day=['일','월','화','수','목','금','토'];let target=null;
 const weekday=text.match(/(?:이번\s*주|다음\s*주)?\s*([월화수목금토일])요일/);
 if(weekday){const w=day.indexOf(weekday[1]);let offset=(w-now.getDay()+7)%7;if(/다음\s*주/.test(text))offset+=offset===0?7:7;target=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset)}
 else if(/모레/.test(text))target=new Date(now.getFullYear(),now.getMonth(),now.getDate()+2);
 else if(/내일/.test(text))target=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
 else if(/오늘/.test(text))target=now;
 const explicit=text.match(/(\d{1,2})월\s*(\d{1,2})일/);
 if(explicit){target=new Date(now.getFullYear(),Number(explicit[1])-1,Number(explicit[2]));if(target<new Date(now.getFullYear(),now.getMonth(),now.getDate()))target.setFullYear(target.getFullYear()+1)}
 if(!target||!/(약속|예약|모임|회의|식사|점심|저녁|진료|병원|화목회|골프|라운딩)/.test(text))return null;
 const pad=n=>String(n).padStart(2,'0');const date=[target.getFullYear(),pad(target.getMonth()+1),pad(target.getDate())].join('-');
 const tm=text.match(/(오전|오후|아침|저녁|낮)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);let time='';if(tm){let h=Number(tm[2]);if(/오후|저녁/.test(tm[1]||'')&&h<12)h+=12;if(/오전|아침/.test(tm[1]||'')&&h===12)h=0;if(h<24)time=pad(h)+':'+pad(Number(tm[3]||0))}
 const golfPlace=text.match(/([가-힣A-Za-z0-9 ]{2,30}\s*(?:CC|cc|골프장))/);
 const pm=text.match(/장소(?:는|가|은)?\s*([^.,\n]+?)(?:\s*(?:이야|야|입니다|이에요|예요|에서야|에서)|[.!?]|$)/);
 let place=pm?pm[1].trim().replace(/에서$/,''):(golfPlace?golfPlace[1].trim():'');
 let title=text.replace(/장소(?:는|가|은)?[^.,\n]+/,'').replace(/(?:이번\s*주|다음\s*주)?\s*[월화수목금토일]요일/g,'').replace(/\d{1,2}월\s*\d{1,2}일/g,'').replace(/오늘|내일|모레/g,'').replace(/(?:오전|오후|아침|저녁|낮)?\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/g,'').replace(/(?:있어|있다|있음|예정이야|예정|등록해\s*줘|추가해\s*줘)[.!?]*$/,'').trim();
 title=title.replace(/\s*(?:에\s*있어|이야|이구나|에\s*있다)\s*$/,'').trim();if(!title)title='새 일정';return {kind:'events',title,date,time,place,original:text}
}
async function handle(form,original,input){const text=input.value.trim();if(!text)return;
 const home=form.id==='ask';
 const say=(answer,voice=false)=>{append('assistant',answer);if(home)showHomeReply(answer);else render();if(voice){const requestId=String(Date.now())+Math.random();window.dispatchEvent(new CustomEvent('haru:question-start',{detail:{requestId,fromVoice:true,text}}));window.dispatchEvent(new CustomEvent('haru:answer-ready',{detail:{requestId,fromVoice:true,text:answer}}))}};

 const fromVoice=!!window.HaruLegacyVoice?.consumeVoiceSubmit?.(form.id==='chatForm'?'chat':'home',text);
 if(busy){queued.push({form,original,input,text});input.value='';const status=$('chatSpeechStatus')||$('speechStatus');if(status)status.textContent='이전 요청 처리 중 · 다음 질문을 대기열에 추가했어.';return;}
 if(text.length>2000){alert('요청은 2,000자 이내로 입력해 줘.');return}
 busy=true;const send=$('sendAsk');const chatButton=$('chatForm').querySelector('button[type=submit]');send.disabled=false;chatButton.disabled=false;
 try{
  // Interpret a short reply against the pending action, not a fixed list of OK words.
  let aiIntent=null;
  if(pendingEvent){
   try{aiIntent=await decideIntent(text)}catch(err){console.warn('Intent decision unavailable',err);aiIntent='chat'}
   if(['confirm','cancel','revise'].includes(aiIntent)){
    append('user',text);input.value='';if(home)window.HaruLegacyVoice?.reset();
    if(aiIntent==='cancel'){setPending(null);say('알겠어. 일정 등록을 취소할게.',fromVoice);return}
    if(aiIntent==='confirm'){const item=pendingEvent;setPending(null);window.HaruShowAIProposal(item);say('좋아. 일정 정보를 확인하고 등록하기를 누르면 저장할게.',fromVoice);return}
    try{setPending(await revisePending(text));say('수정했어. '+(pendingEvent.date||'날짜 미정')+' '+(pendingEvent.time||'시간 미정')+' '+pendingEvent.title+' 일정으로 등록할까?',fromVoice)}catch(err){say('수정 내용을 확실히 이해하지 못했어. 날짜나 시간을 다시 말해 줄래?',fromVoice)}
    return;
   }
  }
  if(pendingWeather&&/^(?:대전|서울|부산|인천|대구|광주|울산|세종|제주|수원|청주|천안|공주|성남|용인|고양|전주|춘천|강릉)(?:시|지역)?[.!\s]*$/.test(text)){
    pendingWeather=false;append('user',text);input.value='';if(home)window.HaruLegacyVoice?.reset();
    say(text.replace(/[.!\s]/g,'')+'의 실시간 날씨를 확인할 수 있는 데이터 연결이 아직 없어. 기온을 추측해 알려주지는 않을게.',fromVoice);return;
  }
  if(/(?:날씨|기온|온도)/.test(text)){
    append('user',text);input.value='';if(home)window.HaruLegacyVoice?.reset();
    const location=text.match(/(대전|서울|부산|인천|대구|광주|울산|세종|제주|수원|청주|천안|공주|성남|용인|고양|전주|춘천|강릉)/);
    if(!location){pendingWeather=true;say('어느 지역 날씨를 알려줄까?',fromVoice)}else{pendingWeather=false;say(location[1]+'의 실시간 날씨 데이터가 아직 연결되지 않았어. 확인되지 않은 기온을 만들어 말하지는 않을게.',fromVoice)}return;
  }
  if(aiIntent===null){try{aiIntent=await decideIntent(text)}catch(err){console.warn('AI intent unavailable, conservative fallback',err);aiIntent=isAction(text)?'create':'chat'}}
  if(aiIntent==='create'){
   lastRequest=text;
   const indicator=$('speechStatus');indicator.textContent='AI가 요청을 분석하는 중…';
   try{const item=await interpretAI(text).catch(()=>parseLocalAppointment(text));if(!item)throw Error("일정 정보를 분석하지 못했어");input.value='';if(input===$('askText'))window.HaruLegacyVoice?.reset();append('user',text);if(fromVoice&&item.kind==='events'){setPending(item);const response=(item.date||'날짜 미정')+' '+(item.time||'시간 미정')+' '+item.title+' 일정이구나. 등록할까?';say(response,true)}else window.HaruShowAIProposal(item);indicator.textContent='일정 내용을 확인했어.'}
   catch(err){indicator.textContent='AI 분석 실패 · 안전한 입력 확인창으로 전환해요 ('+err.message+')';const local=parseLocalAppointment(text);if(local){input.value='';append('user',text);if(fromVoice){setPending(local);say((local.date||'날짜 미정')+' '+(local.time||'시간 미정')+' '+local.title+' 일정이구나. 등록할까?',true)}else window.HaruShowAIProposal(local)}else{original.call(form,{preventDefault(){},currentTarget:form,target:form})}}
   return;
  }
  const requestId=globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random();
  window.dispatchEvent(new CustomEvent('haru:question-start',{detail:{requestId,fromVoice,text}}));
  append('user',text);input.value='';if(input===$('askText')){window.HaruLegacyVoice?.reset();showHomeReply('답변을 준비하고 있어요…')}else{showChat();const pending=document.createElement('div');pending.className='bubble ai-pending';pending.textContent='하루가 답변을 준비하고 있어요…';$('messages').append(pending)}
  try{const reply=localAgenda(text)??await requestAI(pendingEvent?'다음 대화에서 사용자의 마지막 말에 답하세요. 아직 등록 대기 중인 일정이 있으며 실제로 저장하지 않았습니다. 사용자의 발화가 동의인지 불명확하면 다시 물으세요. 저장했다고 주장하지 마세요. 대기 일정: '+JSON.stringify(pendingEvent)+'\n사용자: '+text: text);append('assistant',reply);if(form.id==='ask')showHomeReply(reply);else render();window.dispatchEvent(new CustomEvent('haru:answer-ready',{detail:{requestId,fromVoice,text:reply}}))}catch(err){append('assistant','AI 서버 연결에 실패했어요. '+err.message+' 다시 시도해 주세요.');if(form.id==='ask')showHomeReply('AI 서버 연결에 실패했어요. '+err.message);else render();window.dispatchEvent(new CustomEvent('haru:answer-error',{detail:{requestId}}))}
 }catch(err){try{append('assistant','요청을 처리하지 못했어. '+err.message+' 다시 질문해 줘.');showChat()}catch{}const status=$('chatSpeechStatus')||$('speechStatus');if(status)status.textContent='요청 오류 · 다시 질문할 수 있어.';console.error('Haru request error',err)}finally{busy=false;send.disabled=false;chatButton.disabled=false;const next=queued.shift();if(next){next.input.value=next.text;void handle(next.form,next.original,next.input)}}
}
$('ask').onsubmit=e=>{e.preventDefault();if(window.HaruLegacyVoice?.isListening()){window.HaruLegacyVoice.complete();return}void handle($('ask'),originalHome,$('askText'))};
$('chatForm').onsubmit=e=>{e.preventDefault();if(window.HaruLegacyVoice?.isListening()){window.HaruLegacyVoice.complete();return}void handle($('chatForm'),originalChat,$('chatText'))};
$('aiTest').onclick=async()=>{const b=$('aiTest'),s=$('aiTestStatus');b.disabled=true;s.textContent='서버 응답 확인 중…';try{const r=await requestAI('연결 테스트입니다. 한국어로 짧게 인사해 주세요.');s.textContent='연결 성공 · '+r.slice(0,160)}catch(e){s.textContent='연결 실패 · '+e.message}finally{b.disabled=false}};
})();

// Compact one-confirmation schedule card, with optional editing and a browser-safe external link flow.
(()=>{
 const $=id=>document.getElementById(id);
 const f=$('proposalForm'),fields=$('proposalFields'),summary=$('proposalSummary'),edit=$('proposalEdit');
 const refresh=()=>{const t=f.elements.title.value,d=f.elements.date.value,h=f.elements.time.value,p=f.elements.place.value;
 summary.replaceChildren();
 const title=document.createElement('strong');title.textContent=t||'제목 확인 필요';summary.append(title);
 const detail=document.createElement('div');detail.textContent=[d,h,p].filter(Boolean).join(' · ')||'날짜·시간 미지정';summary.append(detail);
 };
 window.HaruProposalCompact=()=>{fields.hidden=true;edit.textContent='✎ 내용 수정';refresh();};
 edit.addEventListener('click',()=>{fields.hidden=!fields.hidden;edit.textContent=fields.hidden?'✎ 내용 수정':'수정 접기';if(!fields.hidden)f.elements.title.focus()});
 for(const name of ['title','date','time','place'])f.elements[name].addEventListener('input',refresh);
 document.querySelectorAll('a[href^="https://platform.openai.com/"]').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer';a.title='외부 사이트 새 창 열기';});
})();
