(function(){
  'use strict';
  const KEY='haru.ui.season.preference';
  const seasons=['winter','spring','summer','autumn'];
  const pickAuto=()=>{const m=new Date().getMonth()+1;return m>=3&&m<=5?'spring':m>=6&&m<=8?'summer':m>=9&&m<=11?'autumn':'winter'};
  const selector=document.getElementById('seasonChoice');
  let saved='auto';try{saved=localStorage.getItem(KEY)||'auto'}catch(e){}
  if(!['auto',...seasons].includes(saved))saved='auto';
  selector.value=saved;
  const apply=()=>{document.body.dataset.season=selector.value==='auto'?pickAuto():selector.value};
  selector.addEventListener('change',()=>{try{localStorage.setItem(KEY,selector.value)}catch(e){}apply()});apply();
  // 기존 app.js의 state / 렌더 함수를 재사용하고 저장 키는 변경하지 않음.
  const agenda=document.getElementById('homeAgenda');
  function update(){
    if(!agenda)return;
    try{
      const now=new Date();const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
      const items=[];
      if(typeof state!=='undefined'){
        (state.events||[]).filter(x=>x.date===today).sort((a,b)=>(a.time||'').localeCompare(b.time||'')).slice(0,3).forEach(x=>items.push('📅 '+(x.time?x.time+' · ':'')+(x.title||'일정')));
        (state.tasks||[]).filter(x=>!x.done&&!x.completed).slice(0,3).forEach(x=>items.push('☐ '+(x.title||'할 일')));
      }
      agenda.replaceChildren();
      if(!items.length){const d=document.createElement('div');d.className='agenda-empty';d.textContent='오늘 등록된 일정이나 미완료 할 일이 없어요.';agenda.append(d)}
      items.forEach(t=>{const d=document.createElement('div');d.className='agenda-line';d.textContent=t;agenda.append(d)});
    }catch(e){agenda.textContent='일정을 확인하려면 나의 일정을 열어 주세요.'}
  }
  update();document.addEventListener('click',()=>setTimeout(update,250));document.addEventListener('visibilitychange',()=>{if(!document.hidden){apply();update()}});
  const calendar=document.getElementById('homeCalendarShortcut');calendar.addEventListener('click',()=>{setTimeout(()=>{const b=document.getElementById('calendarMode');if(b)b.click()},40)});
})();