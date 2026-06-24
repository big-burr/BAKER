// ═══════════════════════════════════════════════════════════
// ══  PANELS MODULE  ════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Owns: makeWindowBehavior, makeDraggable, bringToFront,
//       openPanel, closePanel, toggleMinimize,
//       showConfirmPopup, showWidget,
//       openSettings, closeSettings, settings helpers
// ═══════════════════════════════════════════════════════════

function setOrbState(s){window.orbState=s;var dot=document.getElementById('nav-dot');var pill=document.getElementById('sb-mode');var panel=document.getElementById('orb-panel');dot.className='status-dot '+s;pill.textContent=s;pill.className='sb-pill '+s;panel.className='fp'+(s==='listening'?' listening':'');document.getElementById('nav-status-txt').textContent=s;}
function makeWindowBehavior(panelEl,hdrEl,opts){opts=opts||{};var MIN_W=opts.minW||180;var MIN_H=opts.minH||80;var NAV_H=44;function normalise(){if(panelEl.offsetParent===null&&panelEl.style.display==='none')return;var r=panelEl.getBoundingClientRect();if(!r.width||!r.height)return;panelEl.style.left=r.left+'px';panelEl.style.top=r.top+'px';panelEl.style.bottom='auto';panelEl.style.right='auto';panelEl.style.width=r.width+'px';panelEl.style.height=r.height+'px';}if(panelEl.style.display!=='none')normalise();panelEl._wbNormalise=normalise;['nw','n','ne','e','se','s','sw','w'].forEach(function(dir){var h=document.createElement('div');h.className='rh rh-'+dir;h.dataset.dir=dir;panelEl.appendChild(h);});var dragging=false,dox=0,doy=0;hdrEl.addEventListener('mousedown',function(e){if(e.button!==0)return;if(e.target.closest('.fp-btns,.spp-close,.spp-tabs,.spp-tab'))return;e.preventDefault();normalise();dragging=true;var r=panelEl.getBoundingClientRect();dox=e.clientX-r.left;doy=e.clientY-r.top;panelEl.style.transition='none';bringToFront(panelEl);document.addEventListener('mousemove',onDragMove);document.addEventListener('mouseup',onDragUp);});function onDragMove(e){if(!dragging)return;var x=e.clientX-dox;var y=e.clientY-doy;x=Math.max(0,Math.min(window.innerWidth-panelEl.offsetWidth,x));y=Math.max(NAV_H,Math.min(window.innerHeight-panelEl.offsetHeight-30,y));panelEl.style.left=x+'px';panelEl.style.top=y+'px';}function onDragUp(){dragging=false;panelEl.style.transition='';document.removeEventListener('mousemove',onDragMove);document.removeEventListener('mouseup',onDragUp);}var resizing=false,rdir='',rsx=0,rsy=0,rx=0,ry=0,rw=0,rh=0;panelEl.addEventListener('mousedown',function(e){var handle=e.target.closest('.rh');if(!handle)return;if(e.button!==0)return;e.preventDefault();e.stopPropagation();normalise();resizing=true;rdir=handle.dataset.dir;rsx=e.clientX;rsy=e.clientY;var r=panelEl.getBoundingClientRect();rx=r.left;ry=r.top;rw=r.width;rh=r.height;panelEl.style.transition='none';bringToFront(panelEl);document.addEventListener('mousemove',onResizeMove);document.addEventListener('mouseup',onResizeUp);});function onResizeMove(e){if(!resizing)return;var dx=e.clientX-rsx;var dy=e.clientY-rsy;var nx=rx,ny=ry,nw=rw,nh=rh;if(rdir.includes('e'))nw=Math.max(MIN_W,rw+dx);if(rdir.includes('w')){nw=Math.max(MIN_W,rw-dx);nx=rx+rw-nw;}if(rdir.includes('s'))nh=Math.max(MIN_H,rh+dy);if(rdir.includes('n')){nh=Math.max(MIN_H,rh-dy);ny=ry+rh-nh;}nx=Math.max(0,Math.min(window.innerWidth-MIN_W,nx));ny=Math.max(NAV_H,Math.min(window.innerHeight-MIN_H-30,ny));panelEl.style.left=nx+'px';panelEl.style.top=ny+'px';panelEl.style.width=nw+'px';panelEl.style.height=nh+'px';}function onResizeUp(){resizing=false;panelEl.style.transition='';document.removeEventListener('mousemove',onResizeMove);document.removeEventListener('mouseup',onResizeUp);}panelEl.addEventListener('mousedown',function(e){if(!e.target.closest('.rh'))bringToFront(panelEl);});}
var _zTop=30;
function bringToFront(el){el.style.zIndex=++_zTop;}
function makeDraggable(panelId,hdrId){var p=document.getElementById(panelId);var h=document.getElementById(hdrId);if(p&&h)makeWindowBehavior(p,h);}
function toggleMinimize(id){document.getElementById(id).classList.toggle('minimized');}
function closePanel(id){document.getElementById(id).style.display='none';}
function openPanel(id){var p=document.getElementById(id);p.style.display='flex';p.classList.remove('minimized');if(p._wbNormalise)p._wbNormalise();}

// ═══════════════════════════════════════════════════════════
// CONFIRM POPUP + WIDGET
// ═══════════════════════════════════════════════════════════
function showConfirmPopup(text,onYes,onNo){var popup=document.getElementById('confirm-popup');document.getElementById('confirm-popup-text').textContent=text;popup.classList.add('vis');var yesBtn=document.getElementById('confirm-yes');var noBtn=document.getElementById('confirm-no');function cleanup(){popup.classList.remove('vis');yesBtn.onclick=null;noBtn.onclick=null;}yesBtn.onclick=function(){cleanup();if(onYes)onYes();};noBtn.onclick=function(){cleanup();if(onNo)onNo();};}
function showWidget(type,title,data,icon){var panel=document.getElementById('widget-panel');var body=document.getElementById('widget-body');document.getElementById('widget-title').textContent=title||type;document.getElementById('widget-icon').textContent=icon||'⬡';body.innerHTML='';if(type==='url'||type==='pdf'){var iframe=document.createElement('iframe');iframe.id='widget-frame';iframe.style.cssText='width:100%;height:100%;border:none;background:var(--surface2);border-radius:0 0 10px 10px';iframe.src=data||'';body.appendChild(iframe);}else if(type==='text'){var div=document.createElement('div');div.style.cssText='padding:16px;overflow-y:auto;height:100%;font-family:var(--mono);font-size:12px;line-height:1.8;color:var(--text);white-space:pre-wrap;word-break:break-word';div.textContent=data||'';body.appendChild(div);}openPanel('widget-panel');if(!panel.style.left||panel.style.left===''){panel.style.left=Math.max(0,(window.innerWidth-480)/2)+'px';panel.style.top='64px';panel.style.width='480px';panel.style.height='360px';}}

// ═══════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════
function openSettings(){
  var overlay=document.getElementById('overlay');overlay.classList.add('open');
  var k=localStorage.getItem('baker_api_key');if(k)document.getElementById('key-input').value=k;
  var ws=localStorage.getItem('baker_web_search')==='true';document.getElementById('search-toggle').checked=ws;document.getElementById('search-lbl').textContent=ws?'ON':'OFF';
  var effort=localStorage.getItem('baker_effort')||'standard';setEffort(effort,true);
  var rate=parseFloat(localStorage.getItem('baker_speech_rate')||'0.92');var pct=Math.round(rate*100);document.getElementById('speech-rate-slider').value=pct;document.getElementById('speech-rate-display').textContent=pct;
  var id=localStorage.getItem('baker_spotify_id');if(id){var inp=document.getElementById('sp-set-id-inp');if(inp)inp.value=id;}
  SP.updateSettingsUI();
  if(typeof FALLOUT!=='undefined')setTimeout(function(){FALLOUT.injectSettingsSection();},0);
  if(typeof REMINDERS!=='undefined')setTimeout(function(){REMINDERS.injectSettings();},50);
}
function closeSettings(){document.getElementById('overlay').classList.remove('open');}
function closeIfOutside(e){if(e.target===document.getElementById('overlay'))closeSettings();}
function toggleShow(){var i=document.getElementById('key-input');i.type=i.type==='password'?'text':'password';}
function saveKey(){var v=document.getElementById('key-input').value.trim();if(v)localStorage.setItem('baker_api_key',v);closeSettings();}
function clearKey(){localStorage.removeItem('baker_api_key');document.getElementById('key-input').value='';closeSettings();}
function toggleWebSearch(){var b=document.getElementById('web-search-btn');var on=localStorage.getItem('baker_web_search')==='true';localStorage.setItem('baker_web_search',!on);b.className='hbtn'+(!on?' on':'');b.textContent=(!on?'🌐 Web ✓':'🌐 Web');}
function updateSearchToggle(){var on=document.getElementById('search-toggle').checked;localStorage.setItem('baker_web_search',on);document.getElementById('search-lbl').textContent=on?'ON':'OFF';var b=document.getElementById('web-search-btn');b.className='hbtn'+(on?' on':'');b.textContent=(on?'🌐 Web ✓':'🌐 Web');}
function setEffort(e,noSave){if(!noSave)localStorage.setItem('baker_effort',e);['deep','standard','quick','minimal'].forEach(function(x){document.getElementById('effort-'+x).classList.toggle('active',x===e);});}
document.getElementById('speech-rate-slider').addEventListener('input',function(){var v=parseInt(this.value);document.getElementById('speech-rate-display').textContent=v;speechRate=v/100;localStorage.setItem('baker_speech_rate',speechRate);});
