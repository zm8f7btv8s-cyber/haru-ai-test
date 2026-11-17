(()=>{'use strict';
const ENDPOINT='https://haru-ai.nsunrang.workers.dev/chat';
const KEY='haru.assistant.v2.foundation';
const $=id=>document.getElementById(id);
const originalHome=$('ask').onsubmit;
const originalChat=$('chatForm').onsubmit;
let lastRequest='';
let busy=false;
// Existing schedule, task, memo and work commands always use the original
// local confirmation workflow. No AI output is ever automatically saved as an item.
const actionable=/예약|약속|회의|모임|일정|방문|진료|수업|골프|할\s*일|해야\s*할|잊지\s*말|챙겨|준비해|기억해|메모|적어\s*둬|기록해|작성해|정리해|조사해|비교해|계획\s*세워/;
const queryOnly=/(알려|보여|브리핑|몇\s*개|뭐\s*있|있어\?|있나요|어때|언제|무엇|뭐야|설명|추천)/;
const creation=/(등록|추가|저장|예약해|잡아\s*줘|넣어\s*줘|기록해|적어\s*둬|기억해|만들어|해\s*줘|있어|있다|있음|예정|갈\s*거|가야)/;
function isAction(text){if(queryOnly.test(text)&&!/(등록|추가|저장|예약해|잡아\s*줘)/.test(text))return false;return actionable.test(text)&&creation.test(text)}
function read(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');return s&&typeof s==='object'&&Array.isArray(s.messages)?s:null}catch{return null}}
function append(who,text){const s=read();if(!s)throw Error('대화 저장소를 읽을 수 없어요');s.messages.push({who,text});localStorage.setItem(KEY,JSON.stringify(s));}
function showChat(){document.querySelector('[data-go="chat"]')?.click(); // fallback: the chat section has no dedicated nav button
if(!document.getElementById('chat').classList.contains('active')){
 document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='chat'));
 document.querySelectorAll('nav button').forEach(x=>x.classList.remove('selected'));
}
render();window.scrollTo(0,0)}
function render(){const root=$('messages');root.replaceChildren();const s=read();for(const m of s?.messages||[]){const div=document.createElement('div');div.className='bubble'+(m.who==='user'?' mine':'');div.textContent=m.text;root.append(div)}root.scrollTop=root.scrollHeight}
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
async function handle(form,original,input){if(busy)return;const text=input.value.trim();if(!text)return;
 if(text.length>2000){alert('요청은 2,000자 이내로 입력해 줘.');return}
 busy=true;const send=$('sendAsk');const chatButton=$('chatForm').querySelector('button');send.disabled=true;chatButton.disabled=true;
 try{
  if(isAction(text)){
   lastRequest=text;
   const indicator=$('speechStatus');indicator.textContent='AI가 요청을 분석하는 중…';
   try{const item=await interpretAI(text);input.value='';if(input===$('askText'))window.HaruLegacyVoice?.reset();append('user',text);window.HaruShowAIProposal(item);indicator.textContent='AI 분석 완료 · 확인창에서 저장 여부를 결정해 줘.'}
   catch(err){indicator.textContent='AI 분석 실패 · 기존 방식으로 전환했어 ('+err.message+')';original.call(form,{preventDefault(){},currentTarget:form,target:form});}
   return;
  }
  append('user',text);input.value='';if(input===$('askText'))window.HaruLegacyVoice?.reset();showChat();const pending=document.createElement('div');pending.className='bubble ai-pending';pending.textContent='하루가 답변을 준비하고 있어요…';$('messages').append(pending);
  try{const reply=await requestAI(text);append('assistant',reply)}catch(err){append('assistant','AI 서버 연결에 실패했어요. '+err.message+' 다시 시도해 주세요.')}render();
 }catch(err){alert('요청 처리 오류: '+err.message)}finally{busy=false;send.disabled=false;chatButton.disabled=false}
}
$('ask').onsubmit=e=>{e.preventDefault();if(window.HaruLegacyVoice?.isListening()){window.HaruLegacyVoice.complete();return}void handle($('ask'),originalHome,$('askText'))};
$('chatForm').onsubmit=e=>{e.preventDefault();void handle($('chatForm'),originalChat,$('chatText'))};
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
