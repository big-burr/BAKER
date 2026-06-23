// ═══════════════════════════════════════════════════════════
// ══  FALLOUT MODE MODULE  ══════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Owns: Pip-Boy aesthetic mode — color swap, scanlines,
//       vault door canvas, font, settings UI wiring.
// Depends on globals: window.orbState, orbMusicMode
// localStorage keys:
//   baker_fallout_mode    — 'true'/'false'
//   baker_fallout_color   — hex string e.g. '#39ff14'
//   baker_fallout_scanlines — 0–100 integer
// ═══════════════════════════════════════════════════════════
var FALLOUT=(function(){

  var LS_MODE='baker_fallout_mode';
  var LS_COLOR='baker_fallout_color';
  var LS_SCAN='baker_fallout_scanlines';

  var DEFAULT_COLOR='#39ff14';
  var DEFAULT_SCAN=50;

  var active=false;
  var color=DEFAULT_COLOR;
  var scanlines=DEFAULT_SCAN;

  // ── Vault door state ──────────────────────────────────────
  var vaultAngle=0;
  var vaultRafId=null;
  var vaultLastTime=0;
  var vaultCanvas=null;
  var vaultCtx=null;

  // Spin speed (rad/s) per orb state
  var SPIN={
    idle:     0.15,
    listening:1.8,
    speaking: 1.0,
    thinking: 2.5
  };

  // ── Apply / remove mode ───────────────────────────────────
  function apply(){
    document.body.classList.add('fallout-mode');
    document.body.style.setProperty('--fo-color', color);
    document.body.style.setProperty('--fo-scanline-opacity', (scanlines/100*0.18).toFixed(3));
    _showVaultDoor();
    _startVaultLoop();
    _updateSettingsUI();
  }

  function remove(){
    document.body.classList.remove('fallout-mode');
    _hideVaultDoor();
    _stopVaultLoop();
    _updateSettingsUI();
  }

  // ── Toggle with 300ms fade ────────────────────────────────
  function toggle(){
    // Kick off fade transition on body
    document.body.style.transition='background .3s,color .3s,border-color .3s';
    active=!active;
    localStorage.setItem(LS_MODE,active);
    if(active)apply();else remove();
    setTimeout(function(){document.body.style.transition='';},350);
  }

  // ── Color ─────────────────────────────────────────────────
  function setColor(hex){
    if(!/^#[0-9a-fA-F]{6}$/.test(hex))return;
    color=hex;
    localStorage.setItem(LS_COLOR,hex);
    if(active){
      document.body.style.setProperty('--fo-color',hex);
    }
    // Keep pickers in sync
    var pi=document.getElementById('fo-color-picker');
    var hi=document.getElementById('fo-color-hex');
    if(pi)pi.value=hex;
    if(hi)hi.value=hex;
  }

  // ── Scanlines ─────────────────────────────────────────────
  function setScanlines(val){
    scanlines=Math.max(0,Math.min(100,parseInt(val)||0));
    localStorage.setItem(LS_SCAN,scanlines);
    if(active){
      document.body.style.setProperty('--fo-scanline-opacity',(scanlines/100*0.18).toFixed(3));
    }
    var lbl=document.getElementById('fo-scan-val');
    if(lbl)lbl.textContent=scanlines;
  }

  // ── Vault door canvas ─────────────────────────────────────
  function _createVaultCanvas(){
    if(document.getElementById('vault-door-canvas'))return;
    var c=document.createElement('canvas');
    c.id='vault-door-canvas';
    c.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;display:none;cursor:pointer;z-index:3';
    // Same click/dblclick behavior as the orb
    c.addEventListener('click',function(){
      if(typeof handleOrbClick==='function')handleOrbClick();
    });
    c.addEventListener('dblclick',function(e){
      e.stopPropagation();
      if(typeof toggleMusicMode==='function')toggleMusicMode();
    });
    var orbBody=document.querySelector('#orb-panel .fp-body');
    if(orbBody)orbBody.appendChild(c);
    vaultCanvas=c;
  }

  function _showVaultDoor(){
    _createVaultCanvas();
    // Hide orb, show vault door
    var orbC=document.getElementById('orb-canvas');
    var recC=document.getElementById('record-canvas');
    if(orbMusicMode){
      // In music mode — record canvas stays, vault door hidden
      if(vaultCanvas)vaultCanvas.style.display='none';
      return;
    }
    if(orbC)orbC.style.display='none';
    if(recC)recC.style.display='none';
    if(vaultCanvas)vaultCanvas.style.display='block';
  }

  function _hideVaultDoor(){
    if(vaultCanvas)vaultCanvas.style.display='none';
    // Restore normal orb canvas (record canvas restored by music mode logic)
    var orbC=document.getElementById('orb-canvas');
    if(orbC&&!orbMusicMode)orbC.style.display='block';
  }

  // ── Vault door draw ───────────────────────────────────────
  function _drawVaultDoor(){
    if(!vaultCanvas)return;
    var W=vaultCanvas.offsetWidth,H=vaultCanvas.offsetHeight;
    if(!W||!H)return;
    if(vaultCanvas.width!==W||vaultCanvas.height!==H){
      vaultCanvas.width=W;vaultCanvas.height=H;
      vaultCtx=null;
    }
    if(!vaultCtx)vaultCtx=vaultCanvas.getContext('2d');
    var ctx=vaultCtx;
    var col=color;
    var cx=W/2,cy=H/2;
    var R=Math.min(W,H)/2-10;

    ctx.clearRect(0,0,W,H);

    // ── Outer shadow ring ──
    ctx.save();
    ctx.shadowColor=col;
    ctx.shadowBlur=18;
    ctx.beginPath();
    ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle=col;
    ctx.lineWidth=2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(vaultAngle);

    // ── Outer gear ring ──
    ctx.beginPath();
    ctx.arc(0,0,R,0,Math.PI*2);
    ctx.fillStyle='#0a0a0b';
    ctx.fill();
    ctx.strokeStyle=col;
    ctx.lineWidth=3;
    ctx.stroke();

    // ── Gear teeth (12 teeth) ──
    var TEETH=12;
    var TOOTH_H=R*0.12;
    var TOOTH_W_INNER=0.18; // radians half-width at inner radius
    var TOOTH_W_OUTER=0.11;
    var innerR=R-2;
    var outerR=R+TOOTH_H;
    for(var i=0;i<TEETH;i++){
      var baseAngle=(i/TEETH)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(
        Math.cos(baseAngle-TOOTH_W_INNER)*innerR,
        Math.sin(baseAngle-TOOTH_W_INNER)*innerR
      );
      ctx.lineTo(
        Math.cos(baseAngle-TOOTH_W_OUTER)*outerR,
        Math.sin(baseAngle-TOOTH_W_OUTER)*outerR
      );
      ctx.lineTo(
        Math.cos(baseAngle+TOOTH_W_OUTER)*outerR,
        Math.sin(baseAngle+TOOTH_W_OUTER)*outerR
      );
      ctx.lineTo(
        Math.cos(baseAngle+TOOTH_W_INNER)*innerR,
        Math.sin(baseAngle+TOOTH_W_INNER)*innerR
      );
      ctx.closePath();
      ctx.fillStyle=col;
      ctx.fill();
      ctx.strokeStyle='#0a0a0b';
      ctx.lineWidth=1;
      ctx.stroke();
    }

    // ── Outer ring band ──
    ctx.beginPath();
    ctx.arc(0,0,R*0.92,0,Math.PI*2);
    ctx.strokeStyle=col;
    ctx.lineWidth=4;
    ctx.globalAlpha=0.4;
    ctx.stroke();
    ctx.globalAlpha=1;

    // ── Inner plate ──
    ctx.beginPath();
    ctx.arc(0,0,R*0.78,0,Math.PI*2);
    ctx.fillStyle='#0d0d0e';
    ctx.fill();
    ctx.strokeStyle=col;
    ctx.lineWidth=2.5;
    ctx.stroke();

    // ── Spoke lines (6 spokes) ──
    for(var s=0;s<6;s++){
      var sa=(s/6)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa)*R*0.22,Math.sin(sa)*R*0.22);
      ctx.lineTo(Math.cos(sa)*R*0.76,Math.sin(sa)*R*0.76);
      ctx.strokeStyle=col;
      ctx.lineWidth=2;
      ctx.globalAlpha=0.5;
      ctx.stroke();
      ctx.globalAlpha=1;
    }

    // ── Rivets on inner plate ring ──
    var RIVETS=8;
    for(var rv=0;rv<RIVETS;rv++){
      var ra=(rv/RIVETS)*Math.PI*2;
      var rx=Math.cos(ra)*R*0.68;
      var ry=Math.sin(ra)*R*0.68;
      ctx.beginPath();
      ctx.arc(rx,ry,R*0.028,0,Math.PI*2);
      ctx.fillStyle='#0a0a0b';
      ctx.fill();
      ctx.strokeStyle=col;
      ctx.lineWidth=1.5;
      ctx.stroke();
    }

    // ── Center hub ──
    ctx.beginPath();
    ctx.arc(0,0,R*0.38,0,Math.PI*2);
    ctx.fillStyle='#0a0a0b';
    ctx.fill();
    ctx.strokeStyle=col;
    ctx.lineWidth=2;
    ctx.stroke();

    // ── Inner hub ring detail ──
    ctx.beginPath();
    ctx.arc(0,0,R*0.28,0,Math.PI*2);
    ctx.strokeStyle=col;
    ctx.lineWidth=1;
    ctx.globalAlpha=0.35;
    ctx.stroke();
    ctx.globalAlpha=1;

    ctx.restore(); // end rotation transform

    // ── "111" text — drawn in screen space (no rotation) ──
    ctx.save();
    ctx.shadowColor=col;
    ctx.shadowBlur=12;
    var fontSize=Math.round(R*0.32);
    ctx.font='bold '+fontSize+'px "Courier Prime", "Courier New", monospace';
    ctx.fillStyle=col;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText('111',cx,cy);
    ctx.restore();

    // ── State indicator ring (pulsing when active) ──
    var state=window.orbState||'idle';
    if(state!=='idle'){
      var pulse=0.5+0.5*Math.abs(Math.sin(Date.now()/300));
      ctx.save();
      ctx.globalAlpha=pulse*0.4;
      ctx.shadowColor=col;
      ctx.shadowBlur=20;
      ctx.beginPath();
      ctx.arc(cx,cy,R+14,0,Math.PI*2);
      ctx.strokeStyle=col;
      ctx.lineWidth=2;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── RAF loop ──────────────────────────────────────────────
  var _FPS=1000/30,_lastDraw=0;
  function _startVaultLoop(){
    if(vaultRafId)return;
    vaultLastTime=performance.now();
    function frame(now){
      if(!active){vaultRafId=null;return;}
      vaultRafId=requestAnimationFrame(frame);
      if(now-_lastDraw<_FPS)return;
      _lastDraw=now;
      var dt=(now-vaultLastTime)/1000;
      vaultLastTime=now;
      var state=window.orbState||'idle';
      var speed=SPIN[state]||SPIN.idle;
      vaultAngle+=speed*dt;
      if(vaultCanvas&&vaultCanvas.style.display!=='none')_drawVaultDoor();
    }
    vaultRafId=requestAnimationFrame(frame);
  }
  function _stopVaultLoop(){
    if(vaultRafId){cancelAnimationFrame(vaultRafId);vaultRafId=null;}
  }

  // ── Settings UI ───────────────────────────────────────────
  // Called by openSettings() to inject our section into the modal
  function injectSettingsSection(){
    // Use the existing placeholder div — populate it if empty, refresh if already populated
    var sec=document.getElementById('fo-settings-section');
    if(!sec){
      // Fallback: create and insert before modal-note
      sec=document.createElement('div');
      sec.id='fo-settings-section';
      var modal=document.querySelector('.modal');
      if(!modal)return;
      var note=modal.querySelector('.modal-note');
      if(note)modal.insertBefore(sec,note);
      else modal.appendChild(sec);
    }
    sec.className='sp-set-sep';
    sec.innerHTML=
      '<div class="sp-set-hd">☢ Fallout Mode</div>'+
      // Toggle
      '<div class="toggle-row" style="margin-bottom:14px">'+
        '<div>'+
          '<div class="toggle-desc">Pip-Boy aesthetic — green phosphor, vault door, scanlines.</div>'+
        '</div>'+
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">'+
          '<span class="toggle-lbl" id="fo-mode-lbl">'+(active?'ON':'OFF')+'</span>'+
          '<label class="toggle">'+
            '<input type="checkbox" id="fo-mode-toggle"'+(active?' checked':'')+'>'+
            '<div class="toggle-track"></div>'+
            '<div class="toggle-thumb"></div>'+
          '</label>'+
        '</div>'+
      '</div>'+
      // Color picker
      '<div class="field" style="margin-bottom:12px">'+
        '<label>Screen Color</label>'+
        '<div style="display:flex;gap:8px;align-items:center;margin-top:4px">'+
          '<input type="color" id="fo-color-picker" value="'+color+'" style="width:38px;height:32px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;padding:1px">'+
          '<input type="text" id="fo-color-hex" value="'+color+'" maxlength="7" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px 10px;font-family:var(--mono);font-size:12px;color:var(--text);outline:none" placeholder="#39ff14">'+
          '<button id="fo-color-apply" style="background:transparent;border:1px solid var(--border);border-radius:4px;padding:6px 12px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer">Apply</button>'+
        '</div>'+
      '</div>'+
      // Scanline slider
      '<div class="field">'+
        '<label>Scanline Intensity — <span id="fo-scan-val">'+scanlines+'</span></label>'+
        '<input type="range" id="fo-scan-slider" min="0" max="100" value="'+scanlines+'" style="width:100%;accent-color:var(--accent);margin-top:6px">'+
      '</div>';

    _bindSettingsEvents();
  }

  function _bindSettingsEvents(){
    var toggle=document.getElementById('fo-mode-toggle');
    var lbl=document.getElementById('fo-mode-lbl');
    var picker=document.getElementById('fo-color-picker');
    var hex=document.getElementById('fo-color-hex');
    var apply=document.getElementById('fo-color-apply');
    var scan=document.getElementById('fo-scan-slider');

    if(toggle)toggle.addEventListener('change',function(){
      lbl.textContent=this.checked?'ON':'OFF';
      FALLOUT.toggle();
    });
    if(picker)picker.addEventListener('input',function(){
      if(hex)hex.value=this.value;
    });
    if(picker)picker.addEventListener('change',function(){
      setColor(this.value);
    });
    if(hex)hex.addEventListener('input',function(){
      var v=this.value.trim();
      if(/^#[0-9a-fA-F]{6}$/.test(v)&&picker)picker.value=v;
    });
    if(apply)apply.addEventListener('click',function(){
      var v=(hex?hex.value.trim():color);
      if(/^#[0-9a-fA-F]{6}$/.test(v))setColor(v);
    });
    if(hex)hex.addEventListener('keydown',function(e){
      if(e.key==='Enter'){
        var v=this.value.trim();
        if(/^#[0-9a-fA-F]{6}$/.test(v))setColor(v);
      }
    });
    if(scan)scan.addEventListener('input',function(){setScanlines(this.value);});
  }

  function _updateSettingsUI(){
    var toggle=document.getElementById('fo-mode-toggle');
    var lbl=document.getElementById('fo-mode-lbl');
    if(toggle)toggle.checked=active;
    if(lbl)lbl.textContent=active?'ON':'OFF';
  }

  // ── Public: called from orbState changes ──────────────────
  // hud.html setOrbState() should call FALLOUT.onOrbState(s) after
  // setting window.orbState — the RAF loop reads window.orbState directly
  // so no explicit hook is needed; kept for future use.
  function onOrbState(){}

  // ── Init ──────────────────────────────────────────────────
  function init(){
    // Load persisted state
    active=localStorage.getItem(LS_MODE)==='true';
    color=localStorage.getItem(LS_COLOR)||DEFAULT_COLOR;
    scanlines=parseInt(localStorage.getItem(LS_SCAN)||DEFAULT_SCAN);

    if(active)apply();

    // openSettings() in hud.html already calls FALLOUT.injectSettingsSection()
    // directly, so no patching needed here.
  }

  return{init,toggle,setColor,setScanlines,onOrbState,injectSettingsSection,isActive:function(){return active;}};
})();
