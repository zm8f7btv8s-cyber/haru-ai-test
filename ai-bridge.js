(()=>{'use strict';
const $=id=>document.getElementById(id);
const ENDPOINT='https://haru-ai.nsunrang.workers.dev/chat';
const SESSION_KEY='haru.ai.pending.v3r';
let busy=false;const queue=[];
let pending=null;
let recentTarget=null;
function rememberTarget(item){if(item?.id)recentTarget={id:String(item.id),at:Date.now()}}
function recentMatch(day){if(!recentTarget||Date.now()-recentTarget.at>15*60*1000)return null;const found=findTarget(recentTarget.id);return found&&(!day||found.item.date===day)?found:null}

try{const x=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(x&&Date.now()-x.at<3600000)pending=x.value}catch{}
function setPending(value){pending=value;try{if(value)sessionStorage.setItem(SESSION_KEY,JSON.stringify({value,at:Date.now()}));else sessionStorage.removeItem(SESSION_KEY)}catch{}}
function snapshot(){return window.HaruStore.read()||{}}
function findTarget(id){const s=snapshot();for(const kind of ['events','tasks']){const item=(s[kind]||[]).find(x=>String(x.id)===String(id));if(item)return {kind,item}}return null}
function targetCandidates(item){if(!item)return [];const s=snapshot();return (s[item.kind]||[]).filter(x=>x.date===item.date&&x.title===item.title)}
function log(role,text,extra){window.HaruStore.append(role,text,extra)}
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00');return !Number.isNaN(d.valueOf())&&todayOf(d)===v}
function todayOf(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function validItem(x){if(!x||!['events','tasks','notes','works'].includes(x.kind)||typeof x.title!=='string'||!x.title.trim()||x.title.length>160)return false;for(const f of ['date','time','place'])if(typeof x[f]!=='string')return false;return (!x.date||validDate(x.date))&&(!x.time||/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time))&&x.place.length<=160}
async function requestAI(message){
 let lastError;
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
   const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message}),signal:controller.signal});
   const raw=await r.text();let body;
   try{body=JSON.parse(raw)}catch{throw Object.assign(new Error('서버 응답이 JSON이 아님'),{code:'SERVER_FORMAT',retryable:false})}
   if(!r.ok){console.warn('Haru AI server status',r.status,String(raw).slice(0,400));throw Object.assign(new Error('서버 HTTP '+r.status),{code:'HTTP_'+r.status,retryable:r.status===429||r.status>=500});}
   if(typeof body?.reply!=='string'||!body.reply.trim())throw Object.assign(new Error('서버 응답에 reply 없음'),{code:'SERVER_REPLY',retryable:false});
   return body.reply.trim();
  }catch(e){lastError=e;if(e.name==='AbortError'){lastError=Object.assign(new Error('AI 응답 시간 초과'),{code:'TIMEOUT',retryable:true})}
   else if(e instanceof TypeError){lastError=Object.assign(new Error('AI 네트워크 연결 실패'),{code:'NETWORK',retryable:true})}
   if(!lastError.retryable||attempt===1)break;
  }finally{clearTimeout(timer)}
 }
 throw lastError;
}
function normalizeItem(raw,base){
 if(raw===null||raw===undefined)return null;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const item={};for(const f of ['kind','title','date','time','place']){
  const value=raw[f];item[f]=typeof value==='string'?value.trim():(base&&typeof base[f]==='string'?base[f]:'');
 }
 if(!item.kind&&base?.kind)item.kind=base.kind;
 return validItem(item)?item:null;
}
function mergeItem(raw,base){
 if(!base)return normalizeItem(raw,null);
 if(!raw||typeof raw!=='object')return normalizeItem(base,null);
 const merged={...base};for(const f of ['kind','title','date','time','place'])if(typeof raw[f]==='string'&&raw[f].trim())merged[f]=raw[f].trim();
 return normalizeItem(merged,null);
}
function jsonReply(raw){const t=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return JSON.parse(t)}catch{const i=t.indexOf('{'),j=t.lastIndexOf('}');if(i<0||j<=i)throw Error('AI 판단 결과 형식 오류');return JSON.parse(t.slice(i,j+1))}}
async function decide(text){
 const store=snapshot();
 const history=(store.messages||[]).filter(x=>!x.aiError).slice(-5,-1).map(x=>({role:x.who,text:String(x.text||'').slice(0,200)}));
 const agenda={events:(store.events||[]).slice(-100).map(x=>({id:String(x.id),title:x.title,date:x.date,time:x.time,place:x.place})),tasks:(store.tasks||[]).slice(-100).map(x=>({id:String(x.id),title:x.title,date:x.date,done:x.done}))};
 const prompt=`하루 AI 개인비서. 사용자의 의도를 문맥으로 판단하고 JSON 객체 하나만 출력. 오늘 ${today()}, 현재 한국시간 ${new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}.
반드시 친근하고 차분한 한국어 반말만 사용해. 존댓말(-요, -습니다, -세요, -까요)은 쓰지 마. 답변은 짧고 구어체로 쓰고, 날짜와 시각은 읽기 쉬운 말로 표현해. 불확실한 사람 이름·장소·모임명은 추측해 바꾸지 말고 확인 질문을 해. 사용자가 직접 수정한 고유명사는 그대로 유지해.
행동 action: chat,offer,propose,confirm,revise,cancel,agenda,weather,update,delete.
기존 일정의 제목이 띄어쓰기나 표현이 달라도 저장된 항목을 찾아야 한다. 현재 일정의 고유 ID를 그대로 써야 한다. 기존 일정 변경은 반드시 update, 취소/삭제는 delete. 기존 일정을 변경하면서 propose를 사용하지 말 것. 저장되지 않은 등록 제안 수정은 revise. 기존 항목 수정/삭제 시 반드시 아래 목록의 실제 id를 targetId로 지정. 동일 제목 일정이 복수이고 대상을 확정 못하면 chat으로 명확히 질문. 수정·삭제할 기존 항목이 없을 때만 chat으로 알려줄 것. 새 등록은 기존 항목이 없어도 propose로 진행하며 중복 검사를 먼저 할 것. 단순 사실 진술은 offer, 명시적 새 등록은 propose. 직전 제안에 동의하면 confirm. 날씨 실시간 데이터는 없으니 만들지 말 것. 완료됐다고 주장하지 말 것.
JSON: {"action":"chat|offer|propose|confirm|revise|cancel|agenda|weather|update|delete","reply":"짧은 한국어 답변","targetId":"기존 항목의 정확한 id 또는 빈 문자열","item":null 또는 {"kind":"events|tasks|notes|works","title":"제목","date":"YYYY-MM-DD 또는 빈 문자열","time":"HH:MM 또는 빈 문자열","place":"장소 또는 빈 문자열"}}.
update: item에는 변경할 필드만 넣어도 됨. 다른 필드는 원본 유지. delete: item은 null 가능. 새 일정 확인 전 저장 금지.
대기 요청: ${JSON.stringify(pending)}
최근 대화: ${JSON.stringify(history)}
실제 저장 목록: ${JSON.stringify(agenda)}
사용자: ${JSON.stringify(text)}`;
 let x;try{x=jsonReply(await requestAI(prompt))}catch(e){if(!e.code)e.code=e instanceof SyntaxError?'AI_JSON':'AI_REQUEST';throw e}
 if(!x||!['chat','offer','propose','confirm','revise','cancel','agenda','weather','update','delete'].includes(x.action)||typeof x.reply!=='string')throw Error('AI 행동 분류 결과 오류');
 if(['confirm','revise'].includes(x.action))x.item=mergeItem(x.item,pending?.item||pending);
 else if(x.action==='update'){const target=findTarget(x.targetId);x.item=target?mergeItem(x.item,target.item):null}
 else x.item=normalizeItem(x.item,null);
 return x;
}
function showHome(reply){const panel=$('haruHomeReply');if(!panel)return;panel.hidden=false;$('haruHomeReplyText').textContent=reply;panel.scrollIntoView({block:'nearest',behavior:'smooth'})}
function render(){window.HaruRenderConversation(snapshot().messages||[],$('messages'))}
function casualReply(text){
 return String(text||'').replace(/등록하시겠어요\?/g,'등록할까?').replace(/등록할까요\?/g,'등록할까?')
 .replace(/변경할까요\?/g,'변경할까?').replace(/확인해 주세요/g,'확인해 줘')
 .replace(/알려주세요/g,'알려줘').replace(/등록되어 있습니다/g,'등록되어 있어')
 .replace(/등록되어 있지 않습니다/g,'등록되어 있지 않아')
 .replace(/저장되었습니다/g,'저장했어').replace(/완료되었습니다/g,'완료했어')
 .replace(/없습니다/g,'없어').replace(/입니다(?=[.!?]|$)/g,'이야')
 .replace(/있어요(?=[.!?]|$)/g,'있어').replace(/없어요(?=[.!?]|$)/g,'없어')
 .replace(/할까요\?/g,'할까?');
}
function answer(reply,home,fromVoice,requestId,aiError=false){reply=casualReply(reply);log('assistant',reply,aiError?{aiError:true}:undefined);if(home)showHome(reply);else render();window.dispatchEvent(new CustomEvent('haru:answer-ready',{detail:{requestId,fromVoice,text:reply}}))}
function voiceReset(home){if(home)window.HaruLegacyVoice?.reset()}
function describe(item){return [item.date,item.time,item.title,item.place&&('장소 '+item.place)].filter(Boolean).join(' · ')}
// Local, deterministic schedule edit path: no AI call is needed for a clearly specified change.
function scheduleItems(){const s=snapshot();return [...(s.events||[]).map(item=>({item,kind:'events'})),...(s.tasks||[]).map(item=>({item,kind:'tasks'}))]}
function normalized(v){return String(v||'').toLowerCase().replace(/\s+/g,'').replace(/[^\p{L}\p{N}]/gu,'')}
function mentionedDay(text){const d=new Date();d.setHours(12,0,0,0);if(/모레/.test(text))d.setDate(d.getDate()+2);else if(/내일/.test(text))d.setDate(d.getDate()+1);else if(/오늘/.test(text)){}else{const full=text.match(/(20\d\d)[-.년\s]+(\d{1,2})[-.월\s]+(\d{1,2})/);if(full)return [full[1],full[2].padStart(2,'0'),full[3].padStart(2,'0')].join('-');return null}return todayOf(d)}
function parseTime(text){const globalEvening=/(?:저녁|오후|밤)\s*(?:\d{1,2}\s*(?:시|:)|일곱\s*시)/.test(text);const m=[...text.matchAll(/(?:(오전|오후|아침|저녁|밤|낮)\s*)?(\d{1,2})\s*(?:시|:)(?:\s*(\d{1,2})\s*분?)?/g)];return m.map(x=>{let h=+x[2],minute=+(x[3]||0);if(h>23||minute>59)return null;if((['오후','저녁','밤'].includes(x[1])||(!x[1]&&globalEvening&&m.length===1))&&h<12)h+=12;if(['오전','아침'].includes(x[1])&&h===12)h=0;return String(h).padStart(2,'0')+':'+String(minute).padStart(2,'0')}).filter(Boolean)}
function targetMatches(text,{day=null,oldTime=null}={}){
 const entries=scheduleItems(),query=normalized(text.replace(/(?:오전|오후|아침|저녁|밤|낮)?\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/g,' ').replace(/(?:내일|오늘|모레|일정|시간|변경|바꿔|바꿔줘|수정|옮겨|해줘|해주세요|등록|취소|삭제|몇|언제|시각|열두|열한|오케이|응|기존)/g,' '));
 const words=normalized(text).match(/[가-힣a-z]+/g)||[];
 const matches=entries.filter(({item})=>{
  if(day&&item.date!==day)return false;if(oldTime&&item.time!==oldTime)return false;
  const title=normalized(item.title);if(!title)return false;
  if(query&&(title.includes(query)||query.includes(title)))return true;
  const tokens=String(item.title||'').split(/\s+/).map(normalized).filter(x=>x.length>=2);
  return tokens.length>0&&tokens.every(t=>words.some(w=>w.includes(t)||t.includes(w))) || (tokens.length>0&&tokens.some(t=>t.length>=2&&words.some(w=>w.includes(t)))&&words.some(w=>w.includes('일정')||w.includes('시간')||w.includes('변경')));
 });
 return matches;
}
function localScheduleEdit(text){
 if(!/(변경|바꿔|수정|옮겨|미뤄|당겨)/.test(text))return null;
 const times=parseTime(text);if(!times.length)return null;
 const newTime=times[times.length-1],day=mentionedDay(text),oldTime=times.length>1?times[0]:null;
 let matches=targetMatches(text,{day,oldTime});
 if(!matches.length){const found=recentMatch(day);if(found)matches=[{item:found.item,kind:found.kind}]}
 if(!matches.length&&day){const byDay=scheduleItems().filter(x=>x.item.date===day);if(byDay.length===1)matches=byDay}
 if(matches.length!==1)return {error:matches.length?'같은 조건의 일정이 여러 개야. 날짜나 제목을 더 알려줘.':'변경할 기존 일정을 찾지 못했어. 일정 제목과 날짜를 알려줘.'};
 const {item:original,kind}=matches[0];rememberTarget(original);if(original.time===newTime)return {error:'이미 '+newTime+'으로 등록된 일정이야.'};
 return {target:{...original,_kind:kind},item:{kind,title:original.title,date:original.date,time:newTime,place:original.place||''}};
}
function resolveTarget(result,text){let target=findTarget(result.targetId);if(target){rememberTarget(target.item);return target;}const recent=recentMatch(mentionedDay(text));if(recent&&/(시간|바꿔|변경|수정|취소|삭제)/.test(text))return recent;const day=mentionedDay(text);const matches=targetMatches(text,{day});if(matches.length===1){rememberTarget(matches[0].item);return {kind:matches[0].kind,item:matches[0].item}}return null}

function scheduleTitle(text){
 let t=String(text||'').replace(/(?:오늘|내일|모레|이번\s*주|다음\s*주)/g,' ')
 .replace(/(?:오전|오후|아침|저녁|밤|낮)?\s*\d{1,2}\s*(?:시|:)\s*(?:\d{1,2}\s*분?)?/g,' ')
 .replace(/(?:일정|약속)\s*(?:을|를)?\s*(?:새로\s*)?(?:등록|추가|잡아|넣어).*$/,' ')
 .replace(/(?:등록|추가|잡아|넣어)\s*(?:해\s*줘|해주세요|해줘|해)?\s*$/,' ')
 .replace(/(?:일정|약속)\s*$/,' ').trim();
 return t.replace(/\s+/g,' ').trim();
}
function registrationRequest(text){return /(등록|추가|일정\s*잡아|일정\s*넣어)/.test(text)&&!/(변경|수정|삭제|취소)/.test(text)}
function duplicateMatches(item){
 const same=scheduleItems().filter(({item:x,kind})=>kind===item.kind&&x.date===item.date&&normalized(x.title)===normalized(item.title));
 const exact=same.filter(({item:x})=>(x.time||'')===(item.time||''));
 const conflict=scheduleItems().filter(({item:x,kind})=>kind==='events'&&item.kind==='events'&&x.date===item.date&&!!item.time&&x.time===item.time&&normalized(x.title)!==normalized(item.title));
 return {same,exact,conflict};
}
function localRegistration(text){
 if(!registrationRequest(text))return null;
 const day=mentionedDay(text),times=parseTime(text),title=scheduleTitle(text);
 if(!day||!times.length||!title)return null;
 const item={kind:'events',title,date:day,time:times[times.length-1],place:''};
 const duplicates=duplicateMatches(item);
 if(duplicates.exact.length)return {existing:duplicates.exact[0].item,error:describe(duplicates.exact[0].item)+' 일정이 이미 등록되어 있어. 중복 등록은 하지 않았어.'};
 if(duplicates.same.length)return {existing:duplicates.same[0].item,error:describe(duplicates.same[0].item)+' 일정이 이미 있어. 시간을 변경할까, 별도로 등록할까?'};
 return {item,conflict:duplicates.conflict.length>0};
}
function localAgenda(text){
 if(!/(일정|스케줄)/.test(text)||!/(뭐|알려|보여|있어|확인|몇\s*개)/.test(text)||/(등록|수정|변경|삭제|취소)/.test(text))return null;
 const day=mentionedDay(text);if(!day)return null;
 const found=scheduleItems().filter(({item})=>item.date===day).sort((a,b)=>(a.item.time||'99:99').localeCompare(b.item.time||'99:99'));
 return found.length?day+' 일정: '+found.map(({item})=>[item.time,item.title].filter(Boolean).join(' ')).join(', '):day+' 등록된 일정이 없어.';
}
function localConfirm(text){return /^(응|네|예|그래|좋아|오케이|ok|확인|맞아|진행해|변경해|저장해|해줘)[.!\s]*$/i.test(text)}
async function handle(form,input){const text=input.value.trim();if(!text)return;const home=form.id==='ask';const fromVoice=!!window.HaruLegacyVoice?.consumeVoiceSubmit?.(home?'home':'chat',text);if(busy){if(!queue.some(x=>x.text===text&&x.form===form))queue.push({form,input,text});input.value='';return}if(text.length>2000){alert('2,000자 이내로 말해 줘.');return}busy=true;input.value='';voiceReset(home);const requestId=String(Date.now())+Math.random();window.dispatchEvent(new CustomEvent('haru:question-start',{detail:{requestId,fromVoice,text}}));log('user',text);if(home)showHome('하루가 생각하고 있어…');else render();
try{
 const registration=localRegistration(text);
 if(registration){
  if(registration.error){if(registration.existing)rememberTarget(registration.existing);answer(registration.error,home,fromVoice,requestId);return}
  const item=registration.item;setPending({operation:'create',item});
  answer(describe(item)+(registration.conflict?' · 같은 시간에 다른 일정이 있어.':'')+' 등록할까? 확인 창에서 저장해 줘.',home,fromVoice,requestId);
  setTimeout(()=>window.HaruShowAIProposal(item),180);return;
 }
 const agendaReply=localAgenda(text);
 if(agendaReply){const day=mentionedDay(text),matches=scheduleItems().filter(x=>x.item.date===day);if(matches.length===1)rememberTarget(matches[0].item);answer(agendaReply,home,fromVoice,requestId);return}
 const local=localScheduleEdit(text);
 if(local){
  if(local.error){answer(local.error,home,fromVoice,requestId);return}
  const {target,item}=local;
  setPending({operation:'update',targetId:String(target.id),kind:target._kind,item});
  answer(describe(item)+'으로 기존 일정을 변경할까? 확인 창에서 저장해 줘.',home,fromVoice,requestId);
  setTimeout(()=>window.HaruShowAIProposal({...item,operation:'update',targetId:String(target.id)}),180);
  return;
 }
 if(pending?.operation==='create'&&localConfirm(text)){window.HaruShowAIProposal(pending.item);answer('등록 내용을 확인하고 저장해 줘.',home,fromVoice,requestId);return}
 if(pending?.operation&&localConfirm(text)){
  const target=findTarget(pending.targetId);
  if(!target){setPending(null);answer('기존 일정이 없어 변경하지 않았어.',home,fromVoice,requestId);return}
  window.HaruShowAIProposal({...target.item,...(pending.item||{}),kind:target.kind,operation:pending.operation,targetId:String(target.item.id)});
  answer('확인 창에서 저장하면 변경이 완료돼. 아직 저장하지 않았어.',home,fromVoice,requestId);
  return;
 }
 const result=await decide(text);const action=result.action;const item=result.item;let reply=result.reply.trim();
if(action==='update'||action==='delete'){
 const target=resolveTarget(result,text);
 if(!target||!['events','tasks'].includes(target.kind))reply='변경할 기존 일정을 정확히 찾지 못했어. 어떤 일정인지 알려줄래?';
 else if(action==='update'&&!item)reply='수정할 내용을 확인하지 못했어. 다시 알려줄래?';
 else {setPending({operation:action,targetId:String(target.item.id),kind:target.kind,item:action==='update'?item:null});
 reply=action==='delete'?'기존 '+target.item.title+' 일정을 삭제할까? 확인해 줘.':describe(item)+' 내용으로 기존 일정을 수정할까? 확인해 줘.';
 setTimeout(()=>window.HaruShowAIProposal({...(action==='update'?item:target.item),kind:target.kind,operation:action,targetId:String(target.item.id)}),180);
 }
}
else if(action==='cancel'&&pending){setPending(null);reply=reply||'알겠어. 변경하지 않을게.'}
else if(action==='offer'||action==='propose'||action==='revise'){
 if(item&&validItem(item)){setPending(item);if(action==='propose'){setTimeout(()=>window.HaruShowAIProposal(item),180);reply='등록 내용을 확인해줘. 저장이 끝나면 완료했다고 알려줄게.'}else reply=reply||describe(item)+' 일정으로 등록할까?'}
 else if(action==='revise'&&pending){reply=reply||'수정할 내용을 다시 알려줄래? 기존 일정은 유지하고 있어.'}
 else reply=reply||'등록할 내용을 조금 더 알려줄래?';
}
else if(action==='confirm'){
 const candidate=item&&validItem(item)?item:(pending?.item||pending);
 if(candidate&&validItem(candidate)){window.HaruShowAIProposal({...candidate,...(pending?.operation?{operation:pending.operation,targetId:pending.targetId}: {})});setPending(null);reply='알겠어. 등록 내용을 확인해줘. 저장이 끝나면 완료했다고 알려줄게.'}
 else reply='어떤 내용을 등록할지 아직 확인하지 못했어. 일정을 알려줄래?';
}
else if(action==='agenda'){
 // The AI receives the actual saved agenda. Do not fabricate an additional local answer.
 reply=reply||'저장된 일정 정보를 확인하지 못했어.';
}
else if(action==='weather'){reply=reply||'실시간 날씨 데이터가 연결되지 않아 정확한 기온을 알려줄 수 없어.'}
if(!reply)reply='어떤 도움을 줄까?';answer(reply,home,fromVoice,requestId)
}catch(e){const code=String(e.code||'UNEXPECTED').replace(/[^A-Z0-9_]/g,'').slice(0,32);console.warn('Haru AI unavailable ['+code+']',e);answer('AI 응답 처리에 문제가 생겼어 ('+code+'). 대화와 등록 대기 내용은 유지했어. 다시 시도해 줘.',home,fromVoice,requestId,true)}finally{busy=false;const next=queue.shift();if(next){next.input.value=next.text;void handle(next.form,next.input)}}}
$('ask').onsubmit=e=>{e.preventDefault();if(window.HaruLegacyVoice?.isListening()){window.HaruLegacyVoice.complete();return}void handle($('ask'),$('askText'))};
$('chatForm').onsubmit=e=>{e.preventDefault();if(window.HaruLegacyVoice?.isListening()){window.HaruLegacyVoice.complete();return}void handle($('chatForm'),$('chatText'))};
$('aiTest').onclick=async()=>{const b=$('aiTest'),s=$('aiTestStatus');b.disabled=true;s.textContent='AI 연결 확인 중…';try{s.textContent='연결 성공 · '+(await requestAI('한국어로 짧게 인사해 줘.')).slice(0,140)}catch(e){s.textContent='연결 실패 · '+e.message}finally{b.disabled=false}};
window.addEventListener('haru:proposal-closed',()=>setPending(null));
window.addEventListener('haru:save-confirmed',e=>{setPending(null);if(e.detail?.item?.id)rememberTarget(e.detail.item);else if(e.detail?.targetId){const t=findTarget(e.detail.targetId);if(t)rememberTarget(t.item)}});
window.HaruAITest={normalizeItem,mergeItem,validItem,jsonReply,localScheduleEdit,targetMatches,parseTime,resolveTarget,rememberTarget,recentMatch};
})();
(()=>{const $=id=>document.getElementById(id),f=$('proposalForm'),fields=$('proposalFields'),summary=$('proposalSummary'),edit=$('proposalEdit');const refresh=()=>{summary.replaceChildren();const title=document.createElement('strong');title.textContent=f.elements.title.value||'제목 확인 필요';summary.append(title);const detail=document.createElement('div');detail.textContent=[f.elements.date.value,f.elements.time.value,f.elements.place.value].filter(Boolean).join(' · ')||'날짜·시간 미지정';summary.append(detail)};window.HaruProposalCompact=()=>{fields.hidden=true;edit.textContent='✎ 내용 수정';refresh()};edit.addEventListener('click',()=>{fields.hidden=!fields.hidden;edit.textContent=fields.hidden?'✎ 내용 수정':'수정 접기';if(!fields.hidden)f.elements.title.focus()});for(const n of ['title','date','time','place'])f.elements[n].addEventListener('input',refresh)})();
