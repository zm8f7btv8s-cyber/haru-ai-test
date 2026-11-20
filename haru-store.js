(()=>{'use strict';
const KEY='haru.assistant.v2.foundation';
function read(){try{const s=JSON.parse(localStorage.getItem(KEY)||'{}');return s&&typeof s==='object'&&!Array.isArray(s)?s:{}}catch{return {}}}
function update(mutator){const s=read();mutator(s);localStorage.setItem(KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('haru:store-updated'));return s}
function append(who,text,extra){return update(s=>{if(!Array.isArray(s.messages))s.messages=[];s.messages.push({id:globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random(),who,text,createdAt:new Date().toISOString(),...(extra||{})})})}
window.HaruStore={read,update,append,key:KEY};
})();
