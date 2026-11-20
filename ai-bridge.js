(()=>{'use strict';
const $=id=>document.getElementById(id);
const ENDPOINT='https://haru-ai.nsunrang.workers.dev/chat';
const SESSION_KEY='haru.ai.pending.v3m';
let busy=false;const queue=[];
let pending=null;
try{const x=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(x&&Date.now()-x.at<3600000)pending=x.value}catch{}
function setPending(value){pending=value;try{if(value)sessionStorage.setItem(SESSION_KEY,JSON.stringify({value,at:Date.now()}));else sessionStorage.removeItem(SESSION_KEY)}catch{}}
function snapshot(){return window.HaruStore.read()||{}}
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
   if(!r.ok)throw Object.assign(new Error('서버 HTTP '+r.status),{code:'HTTP_'+r.status,retryable:r.status===429||r.status>=500});
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
async function decide(text){const store=snapshot();const history=(store.messages||[]).filter(x=>!x.aiError).slice(-12,-1).map(x=>({role:x.who,text:String(x.text||'').slice(0,450)}));const agenda={events:(store.events||[]).slice(-80).map(x=>({id:x.id,title:x.title,date:x.date,time:x.time,place:x.place})),tasks:(store.tasks||[]).slice(-40).map(x=>({id:x.id,title:x.title,date:x.date,done:x.done}))};
const prompt=`당신은 하루 AI 개인비서의 판단 엔진입니다. 규칙 단어 매칭이 아니라 현재 발화와 이전 대화의 의미를 종합해 결정하세요. 사용자의 발화를 임의로 명령으로 만들지 마세요. 반드시 JSON 객체 하나만 반환하세요. 오늘 ${today()}, 현재 ${new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}, 시간대 Asia/Seoul.\n행동 action: chat(일반 대화), offer(사용자가 일정/할 일을 이야기했지만 등록 지시가 없어서 등록 제안), propose(명시적 등록 요청이므로 저장 확인창), confirm(앞서 제안한 등록에 동의), revise(제안한 항목을 수정), cancel(제안을 거절), agenda(저장된 일정/할 일 조회), weather(날씨 질문이나 이전 날씨 질문의 지역 답변).\n사용자가 이미 등록된 일정을 묻는 경우 agenda. 단순 사실 진술은 offer, 명시적인 저장 요청은 propose. 직전 질문이 등록 제안이었다면 어떤 표현이든 의미로 판단. 동의와 수정이 섞이면 revise. 정보가 부족하면 reply로 질문하고 item은 null. '등록 완료'라고 말하면 안 됩니다. 실시간 날씨 API가 없으므로 기온/예보를 만들지 말고 연결되지 않았음을 알리세요.\nJSON 스키마: {"action":"chat|offer|propose|confirm|revise|cancel|agenda|weather","reply":"사용자에게 할 자연스러운 짧은 한국어 답변","item":null 또는 {"kind":"events|tasks|notes|works","title":"간결한 제목","date":"YYYY-MM-DD 또는 빈 문자열","time":"HH:MM 또는 빈 문자열","place":"장소 또는 빈 문자열"}}.\n등록/수정/제안 시 item에 구조화한 정보를 넣으세요. confirm은 pending의 정보를 유지하되 사용자가 수정한 경우 revise. 날짜/시간은 추측하지 마세요. 장소와 제목에 날짜/시간/명령어를 섞지 마세요.\n대기 중인 요청: ${JSON.stringify(pending)}\n최근 대화: ${JSON.stringify(history)}\n저장된 일정과 할 일: ${JSON.stringify(agenda)}\n현재 사용자 발화: ${JSON.stringify(text)}`;
let x;try{x=jsonReply(await requestAI(prompt))}catch(e){if(!e.code)e.code=e instanceof SyntaxError?'AI_JSON':'AI_REQUEST';throw e}if(!x||!['chat','offer','propose','confirm','revise','cancel','agenda','weather'].includes(x.action)||typeof x.reply!=='string')throw Error('AI 행동 분류 결과 오류');if(['confirm','revise'].includes(x.action))x.item=mergeItem(x.item,pending);
else x.item=normalizeItem(x.item,null);
if(['offer','propose'].includes(x.action)&&!x.item&&x.reply.trim()==='')x.reply='일정 정보를 조금 더 알려줄래?';
return x}
function showHome(reply){const panel=$('haruHomeReply');if(!panel)return;panel.hidden=false;$('haruHomeReplyText').textContent=reply;panel.scrollIntoView({block:'nearest',behavior:'smooth'})}
function render(){window.HaruRenderConversation(snapshot().messages||[],$('messages'))}
function answer(reply,home,fromVoice,requestId,aiError=false){log('assistant',reply,aiError?{aiError:true}:undefined);if(home)showHome(reply);else render();window.dispatchEvent(new CustomEvent('haru:answer-ready',{detail:{requestId,fromVoice,text:reply}}))}
function voiceReset(home){if(home)window.HaruLegacyVoice?.reset()}
function describe(item){return [item.date,item.time,item.title,item.place&&('장소 '+item.place)].filter(Boolean).join(' · ')}
async function handle(form,input){const text=input.value.trim();if(!text)return;const home=form.id==='ask';const fromVoice=!!window.HaruLegacyVoice?.consumeVoiceSubmit?.(home?'home':'chat',text);if(busy){if(!queue.some(x=>x.text===text&&x.form===form))queue.push({form,input,text});input.value='';return}if(text.length>2000){alert('2,000자 이내로 말해 줘.');return}busy=true;input.value='';voiceReset(home);const requestId=String(Date.now())+Math.random();window.dispatchEvent(new CustomEvent('haru:question-start',{detail:{requestId,fromVoice,text}}));log('user',text);if(home)showHome('하루가 생각하고 있어…');else render();
try{const result=await decide(text);const action=result.action;const item=result.item;let reply=result.reply.trim();
if(action==='cancel'&&pending){setPending(null);reply=reply||'알겠어. 등록하지 않을게.'}
else if(action==='offer'||action==='propose'||action==='revise'){
 if(item&&validItem(item)){setPending(item);if(action==='propose'){window.HaruShowAIProposal(item);reply='등록 내용을 확인해줘. 저장이 끝나면 완료했다고 알려줄게.'}else reply=reply||describe(item)+' 일정으로 등록할까?'}
 else if(action==='revise'&&pending){reply=reply||'수정할 내용을 다시 알려줄래? 기존 일정은 유지하고 있어.'}
 else reply=reply||'등록할 내용을 조금 더 알려줄래?';
}
else if(action==='confirm'){
 const candidate=item&&validItem(item)?item:pending;
 if(candidate&&validItem(candidate)){window.HaruShowAIProposal(candidate);setPending(null);reply='알겠어. 등록 내용을 확인해줘. 저장이 끝나면 완료했다고 알려줄게.'}
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
window.HaruAITest={normalizeItem,mergeItem,validItem,jsonReply};
})();
(()=>{const $=id=>document.getElementById(id),f=$('proposalForm'),fields=$('proposalFields'),summary=$('proposalSummary'),edit=$('proposalEdit');const refresh=()=>{summary.replaceChildren();const title=document.createElement('strong');title.textContent=f.elements.title.value||'제목 확인 필요';summary.append(title);const detail=document.createElement('div');detail.textContent=[f.elements.date.value,f.elements.time.value,f.elements.place.value].filter(Boolean).join(' · ')||'날짜·시간 미지정';summary.append(detail)};window.HaruProposalCompact=()=>{fields.hidden=true;edit.textContent='✎ 내용 수정';refresh()};edit.addEventListener('click',()=>{fields.hidden=!fields.hidden;edit.textContent=fields.hidden?'✎ 내용 수정':'수정 접기';if(!fields.hidden)f.elements.title.focus()});for(const n of ['title','date','time','place'])f.elements[n].addEventListener('input',refresh)})();
