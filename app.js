
// Shared conversation renderer: date separators only when a new day begins.
window.HaruRenderConversation=function(messages,root){
 root.replaceChildren();let lastDay=null;
 for(const m of messages||[]){
  const dt=m.createdAt?new Date(m.createdAt):null;
  const valid=dt&&!Number.isNaN(dt.getTime());
  const day=valid?[dt.getFullYear(),String(dt.getMonth()+1).padStart(2,'0'),String(dt.getDate()).padStart(2,'0')].join('-'):'unknown';
  if(day!==lastDay){const sep=document.createElement('div');sep.className='haru-chat-day';sep.textContent=valid?dt.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'}):'이전 대화 · 날짜 정보 없음';root.append(sep);lastDay=day;}
  const wrap=document.createElement('div');wrap.className='haru-chat-entry'+(m.who==='user'?' mine':'');
  const bubble=document.createElement('div');bubble.className='bubble'+(m.who==='user'?' mine':'');bubble.textContent=m.text||'';wrap.append(bubble);
  if(valid){const time=document.createElement('small');time.className='haru-message-time';time.textContent=dt.toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit'});wrap.append(time)}
  root.append(wrap);
 }
 root.scrollTop=root.scrollHeight;
};
(()=>{'use strict';const $=id=>document.getElementById(id),key='haru.assistant.v2.foundation',oldKey='haru.fresh.test.v1';const date=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let state={events:[],tasks:[],works:[],notes:[],messages:[]};try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x&&typeof x==='object')for(const k of Object.keys(state))if(Array.isArray(x[k]))state[k]=x[k]}catch{}let legacy={events:[],tasks:[]};try{const x=JSON.parse(localStorage.getItem(oldKey)||'null');if(x&&Array.isArray(x.events)&&Array.isArray(x.tasks))legacy=x}catch{}const save=()=>{const latest=window.HaruStore?.read();if(Array.isArray(latest?.messages))state.messages=latest.messages;window.HaruStore.update(current=>{for(const k of ['events','tasks','works','notes'])current[k]=state[k];current.messages=state.messages})};const uid=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random();// Copy legacy records into this version's editable store once; never mutate the original key.
const migrationKey=key+'.legacyImported';
if(localStorage.getItem(migrationKey)!=='yes'){
 for(const kind of ['events','tasks']){
  const ids=new Set(state[kind].map(x=>String(x.id)));
  for(const [i,record] of legacy[kind].entries()){
   const sourceId='legacy-'+kind+'-'+i;
   if(!ids.has(sourceId))state[kind].push({...record,id:sourceId,legacy:false});
  }
 }
 try{localStorage.setItem(key,JSON.stringify(state));localStorage.setItem(migrationKey,'yes')}catch(e){console.warn('Legacy import failed',e)}
}
const all=k=>[...state[k]];const el=(tag,html,cls)=>{const x=document.createElement(tag);x.className=cls||'';x.innerHTML=html;return x};const clear=id=>$(id).replaceChildren();const fmt=s=>s||'날짜 미정';function show(id){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('selected',x.dataset.go===id));if(id==='life')life();if(id==='brief')brief();if(id==='work')works();if(id==='files')notes();if(id==='chat'){chat();requestAnimationFrame(()=>requestAnimationFrame(()=>{const messages=$('messages');messages.scrollTop=messages.scrollHeight;window.scrollTo(0,document.documentElement.scrollHeight)}))}else scrollTo(0,0)}document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)show(b.dataset.go)});$('today').textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date());let editKind='events',editingId=null;
function openEditor(kind,item=null){editKind=kind;editingId=item?.id??null;$('entryHeading').textContent=(item?'일정 수정':'새 일정');if(kind==='tasks')$('entryHeading').textContent=item?'할 일 수정':'새 할 일';$('entryForm').reset();const f=$('entryForm');f.elements.title.value=item?.title||'';f.elements.date.value=item?.date||date();f.elements.time.value=item?.time||'';f.elements.place.value=item?.place||'';$('timeRow').hidden=kind!=='events';$('placeRow').hidden=kind!=='events';$('editor').showModal();document.activeElement?.blur?.()}
$('newEvent').onclick=()=>openEditor('events');$('newTask').onclick=()=>openEditor('tasks');$('cancel').onclick=()=>$('editor').close();
$('entryForm').onsubmit=e=>{e.preventDefault();const f=e.target;const title=f.elements.title.value.trim();if(!title)return;const old=editingId!=null?state[editKind].find(x=>String(x.id)===String(editingId)):null;const x={...(old||{}),id:old?.id||uid(),title,date:f.elements.date.value};if(editKind==='events'){x.time=f.elements.time.value;x.place=f.elements.place.value.trim()}else x.done=old?.done||false;if(old)Object.assign(old,x);else state[editKind].push(x);try{save()}catch(err){alert('저장하지 못했어. 저장 공간을 확인해 줘.');return}$('editor').close();life()};
function addItems(target,items,kind){clear(target);if(!items.length){$(target).append(el('p','아직 등록된 항목이 없어.','hint'));return}for(const x of items.slice().sort((a,b)=>{const day=(a.date||'').localeCompare(b.date||'');if(day)return day;if(kind!=='events')return 0;const ta=a.time||'99:99',tb=b.time||'99:99';return ta.localeCompare(tb)})){const card=el('div',`<b class="${x.done?'done':''}">${safe(x.title)}</b><p><small>${safe(fmt(x.date))}${x.time?' · '+safe(x.time):''}${x.place?' · '+safe(x.place):''}</small></p>`,'item haru-compact-item');const detail=el('details','<summary>상세 · 수정 / 삭제</summary>','haru-item-actions');card.append(detail);const edit=el('button','수정');edit.onclick=()=>openEditor(kind,x);detail.append(edit);if(kind==='tasks'){const done=el('button',x.done?'완료 취소':'완료');done.onclick=()=>{x.done=!x.done;save();life()};detail.append(done)}const del=el('button','삭제');del.onclick=()=>{if(confirm('이 항목을 삭제할까?')){state[kind]=state[kind].filter(y=>String(y.id)!==String(x.id));save();life()}};detail.append(del);$(target).append(card)}}
function life(){addItems('events',all('events'),'events');addItems('tasks',all('tasks'),'tasks')}function brief(){const todays=all('events').filter(x=>x.date===date()),tasks=all('tasks').filter(x=>x.date===date()&&!x.done);$('briefContent').replaceChildren(el('div',`<h3>오늘의 일정 · ${todays.length}건</h3>${todays.map(x=>`<p>${safe(x.time||'')} ${safe(x.title)}</p>`).join('')||'<p>오늘 일정이 없어.</p>'}<h3>오늘의 할 일 · ${tasks.length}건</h3>${tasks.map(x=>`<p>${safe(x.title)}</p>`).join('')||'<p>오늘 할 일이 없어.</p>'}`,'item'))}function works(){clear('works');for(const x of state.works){const c=el('div',`<b class="${x.done?'done':''}">${safe(x.title)}</b>`,'item');const b=el('button',x.done?'다시 진행':'완료');b.onclick=()=>{x.done=!x.done;save();works()};const d=el('button','삭제');d.onclick=()=>{state.works=state.works.filter(y=>y.id!==x.id);save();works()};c.append(b,d);$('works').append(c)}}$('workForm').onsubmit=e=>{e.preventDefault();const f=e.target;const title=f.querySelector('input').value.trim();if(!title)return;state.works.push({id:uid(),title,done:false});save();f.reset();works()};function notes(){clear('notes');for(const x of state.notes.slice().reverse()){const c=el('div',`<small>${safe(x.created)}</small><p>${safe(x.text).replace(/\n/g,'<br>')}</p>`,'item');const d=el('button','삭제');d.onclick=()=>{state.notes=state.notes.filter(y=>y.id!==x.id);save();notes()};c.append(d);$('notes').append(c)}}$('noteForm').onsubmit=e=>{e.preventDefault();const f=e.target,text=f.querySelector('textarea').value.trim();if(!text)return;state.notes.push({id:uid(),text,created:date()});save();f.reset();notes()};function chat(){try{const latest=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(latest?.messages))state.messages=latest.messages}catch{}window.HaruRenderConversation(state.messages,$('messages'));if(!state.messages.length)$('messages').append(el('div','하루에게 편하게 말해 줘.','bubble'))}let pending=null;
window.HaruShowAIProposal=function(item){
 if(!item||!['events','tasks','notes','works'].includes(item.kind))throw Error('지원하지 않는 요청 종류');
 pending={...item,original:item.original||''};
 const names={events:'일정',tasks:'할 일',notes:'메모',works:'작업'};
 $('proposalHeading').textContent='AI '+names[item.kind]+' 등록 확인';
 $('proposalInfo').textContent='AI가 분석한 내용이야. 날짜·시간·제목을 확인하고 수정한 뒤 저장해 줘. 확인 전에는 저장되지 않아.';
 const f=$('proposalForm');f.elements.title.value=item.title||'';
 f.elements.date.value=item.date||'';f.elements.time.value=item.time||'';f.elements.place.value=item.place||'';
 const dated=item.kind==='events'||item.kind==='tasks';
 $('proposalDateRow').hidden=!dated;$('proposalTimeRow').hidden=item.kind!=='events';$('proposalPlaceRow').hidden=item.kind!=='events';
 $('proposal').showModal();$('proposalHeading').focus({preventScroll:true});window.HaruProposalCompact?.();
};
$('proposalCancel').onclick=()=>{pending=null;$('proposal').close();window.dispatchEvent(new Event('haru:proposal-closed'))};$('proposalForm').onsubmit=e=>{e.preventDefault();if(!pending)return;const f=e.currentTarget,title=f.elements.namedItem('title').value.trim();if(!title){alert('제목을 입력해 줘.');return}const kind=pending.kind;const item={id:uid(),title};if(kind==='events'||kind==='tasks'){item.date=f.elements.namedItem('date').value||date();if(kind==='events'){item.time=f.elements.namedItem('time').value;item.place=f.elements.namedItem('place').value.trim()}else item.done=false}else if(kind==='works')item.done=false;else{item.text=title;item.created=date();delete item.title}
// Warn on an exact duplicate or overlapping schedule before persisting.
if(kind==='events'){
 const overlaps=state.events.filter(x=>x.date===item.date&&item.time&&x.time===item.time);
 if(overlaps.length){
  const exact=overlaps.some(x=>x.title.trim()===title);
  if(!confirm(exact?'같은 날짜·시간·제목의 일정이 이미 있어. 그래도 등록할까?':'같은 시간에 '+overlaps.map(x=>x.title).slice(0,2).join(', ')+' 일정이 있어. 그래도 등록할까?'))return;
 }
}
// Commit the record and confirmation together; do not report success until persistence is verified.
const before=JSON.stringify(state);state[kind].push(item);try{save();const persisted=JSON.parse(localStorage.getItem(key)||'null');if(!persisted||!Array.isArray(persisted[kind])||!persisted[kind].some(x=>String(x.id)===String(item.id)))throw new Error('저장 검증 실패')}catch(err){state=JSON.parse(before);alert('일정을 저장하지 못했어. 다시 시도해 줘.');console.error('Haru save error',err);return}
window.HaruStore.append('assistant',[item.date,item.time,title,'저장했어.'].filter(Boolean).join(' '));
pending=null;$('proposal').close();
// Only announce completion after storage verification. Keep the page where the request began.
const savedKind={events:'일정',tasks:'할 일',notes:'메모',works:'작업'}[kind];
const when=[item.date,item.time].filter(Boolean).join(' ');
const savedReply=[when,title,'저장했어.'].filter(Boolean).join(' ');
const onHome=document.getElementById('home')?.classList.contains('active');
if(onHome){const panel=$('haruHomeReply'),label=$('haruHomeReplyText');if(panel&&label){panel.hidden=false;label.textContent=savedReply}}
else if(document.getElementById('chat')?.classList.contains('active')){chat()}
else if(kind==='events'||kind==='tasks'){life()}
else if(kind==='works'){works()}
else{notes()}
window.dispatchEvent(new CustomEvent('haru:save-confirmed',{detail:{kind,item,reply:savedReply,home:onHome}}));};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='haru-2.0-backup-'+date()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};show('home')})();
