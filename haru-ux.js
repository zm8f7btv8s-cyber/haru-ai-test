(()=>{'use strict';
const editor=document.getElementById('editor');
editor?.addEventListener('close',()=>{document.activeElement?.blur?.();window.scrollTo({top:0,behavior:'instant'})});
editor?.addEventListener('cancel',()=>document.activeElement?.blur?.());
// Only blur the automatic dialog focus; don't interfere with an intentional tap.
editor?.addEventListener('focusin',e=>{if(e.target===editor)e.target.blur()});
const chat=document.getElementById('chat');
chat?.addEventListener('click',e=>{if(e.target.closest('.haru-replay,.haru-stop'))return});
})();
