(()=>{'use strict';
const ENDPOINT='https://haru-ai.nsunrang.workers.dev/chat';
const KEY='haru.assistant.v2.foundation';
const $=id=>document.getElementById(id);
const originalHome=$('ask').onsubmit;
const originalChat=$('chatForm').onsubmit;
let busy=false;
// Existing schedule, task, memo and work commands always use the original
// local confirmation workflow. No AI output is ever automatically saved as an item.
const actionable=/예약|약속|회의|모임|일정|방문|진료|수업|골프|할\s*일|해야\s*할|잊지\s*말|챙겨|준비해|기억해|메모|적어\s*둬|기록해|작성해|정리해|조사해|비교해|계획\s*세워/;
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
async function handle(form,original,input){if(busy)return;const text=input.value.trim();if(!text)return;
if(actionable.test(text)){original.call(form,{preventDefault(){},currentTarget:form,target:form});return}
if(text.length>2000){alert('AI 질문은 2,000자 이내로 입력해 줘.');return}
busy=true;const send=$('sendAsk');const chatButton=$('chatForm').querySelector('button');send.disabled=true;chatButton.disabled=true;
try{append('user',text);input.value='';if(input===$('askText'))window.HaruLegacyVoice?.reset();showChat();const pending=document.createElement('div');pending.className='bubble ai-pending';pending.textContent='하루가 답변을 준비하고 있어요…';$('messages').append(pending);
try{const reply=await requestAI(text);append('assistant',reply)}catch(err){append('assistant','AI 서버 연결에 실패했어요. '+err.message+' 다시 시도해 주세요.')}render();
}catch(err){alert('대화 저장 오류: '+err.message)}finally{busy=false;send.disabled=false;chatButton.disabled=false}}
$('ask').onsubmit=e=>{e.preventDefault();if(window.HaruLegacyVoice?.isListening()){window.HaruLegacyVoice.complete();return}void handle($('ask'),originalHome,$('askText'))};
$('chatForm').onsubmit=e=>{e.preventDefault();void handle($('chatForm'),originalChat,$('chatText'))};
$('aiTest').onclick=async()=>{const b=$('aiTest'),s=$('aiTestStatus');b.disabled=true;s.textContent='서버 응답 확인 중…';try{const r=await requestAI('연결 테스트입니다. 한국어로 짧게 인사해 주세요.');s.textContent='연결 성공 · '+r.slice(0,160)}catch(e){s.textContent='연결 실패 · '+e.message}finally{b.disabled=false}};
})();
