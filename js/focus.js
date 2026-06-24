// ═══════════════════════════════════════════════════════════
// ══  FOCUS MODULE  ═════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Classic 25/5 Pomodoro timer
// BAKER goes fully silent during focus
// Sessions saved to vault every 7 completions as Focus 1-7
// Visual: countdown ring + time display
// ═══════════════════════════════════════════════════════════
var FOCUS=(function(){

  var LS_KEY='baker_focus_v1';
  var WORK_MINS=25,BREAK_MINS=5;
  var PANEL_ID='focus-panel';
  var VAULT_SAVE_EVERY=7; // save note every 7 completed sessions

  var state={
    running:false,
    mode:'work',      // 'work' | 'break'
    remaining:WORK_MINS*60, // seconds
    sessionCount:0,   // completed work sessions this group
    totalSessions:0,  // all-time completed
    groupStart:null,  // timestamp when current group started
    sessions:[],      // log of completed sessions in current group
    savedGroups:0     // how many groups have been saved
  };

  var _interval=null;
  var _silenced=false;
  var _originalSpeak=null;

  // ── Storage ───────────────────────────────────────────────
  function _load(){
    try{
      var r=localStorage.getItem(LS_KEY);
      if(r){var d=JSON.parse(r);state.totalSessions=d.totalSessions||0;state.savedGroups=d.savedGroups||0;}
    }catch(e){}
  }
  function _save(){
    try{localStorage.setItem(LS_KEY,JSON.stringify({totalSessions:state.totalSessions,savedGroups:state.savedGroups}));}catch(e){}
  }

  // ── Silence BAKER ─────────────────────────────────────────
  function _silenceBAKER(){
    if(_silenced)return;
    _silenced=true;
    // Override speakResponse to no-op during focus
    if(typeof window.speakResponse==='function'){
      _originalSpeak=window.speakResponse;
      window.speakResponse=function(){};
    }
    // Also cancel any current speech
    if(window.speechSynthesis)window.speechSynthesis.cancel();
  }
  function _unsilenceBAKER(){
    if(!_silenced)return;
    _silenced=false;
    if(_originalSpeak)window.speakResponse=_originalSpeak;
    _originalSpeak=null;
  }

  // ── Timer logic ───────────────────────────────────────────
  function start(){
    if(state.running)return;
    if(!state.groupStart)state.groupStart=Date.now();
    state.running=true;
    _silenceBAKER();
    _interval=setInterval(_tick,1000);
    _render();
  }

  function pause(){
    if(!state.running)return;
    state.running=false;
    clearInterval(_interval);_interval=null;
    _unsilenceBAKER();
    _render();
  }

  function reset(){
    pause();
    state.mode='work';
    state.remaining=WORK_MINS*60;
    _render();
  }

  function skip(){
    // Skip to next phase
    if(state.mode==='work'){
      _completeWork();
    }else{
      _completeBreak();
    }
  }

  function _tick(){
    if(state.remaining>0){
      state.remaining--;
      _render();
    }else{
      if(state.mode==='work')_completeWork();
      else _completeBreak();
    }
  }

  function _completeWork(){
    clearInterval(_interval);_interval=null;
    state.running=false;
    state.sessionCount++;
    state.totalSessions++;
    state.sessions.push({n:state.totalSessions,duration:WORK_MINS});
    _save();

    // Save to vault every 7 sessions
    if(state.sessions.length>=VAULT_SAVE_EVERY){
      _saveGroupToVault();
    }

    // Switch to break
    state.mode='break';
    state.remaining=BREAK_MINS*60;
    _render();

    // Flash panel to signal completion
    _flashPanel();
  }

  function _completeBreak(){
    clearInterval(_interval);_interval=null;
    state.running=false;
    state.mode='work';
    state.remaining=WORK_MINS*60;
    _render();
    _flashPanel();
  }

  function _flashPanel(){
    var p=document.getElementById(PANEL_ID);
    if(!p)return;
    p.style.borderColor='var(--accent)';
    p.style.boxShadow='0 0 20px var(--accent)44';
    setTimeout(function(){
      p.style.borderColor='';p.style.boxShadow='';
    },1500);
  }

  // ── Vault save ────────────────────────────────────────────
  async function _saveGroupToVault(){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected){
      // Keep sessions pending for when vault connects
      return;
    }
    try{
      state.savedGroups++;
      var groupNum=state.savedGroups;
      var sessions=state.sessions.slice();
      state.sessions=[];
      state.sessionCount=0;
      state.groupStart=null;

      var md='---\ntype: focus-log\ngroup: '+groupNum+'\n---\n\n';
      md+='# Focus Group '+groupNum+'\n\n';
      sessions.forEach(function(s,i){
        md+='**Focus '+(i+1)+'** — '+s.duration+' min\n\n';
      });
      md+='**Total:** '+sessions.length+' sessions · '+(sessions.length*WORK_MINS)+' minutes\n';

      var dir=vaultHandle;
      dir=await dir.getDirectoryHandle('07-System',{create:true});
      dir=await dir.getDirectoryHandle('Focus',{create:true});
      var fname='focus-group-'+String(groupNum).padStart(3,'0')+'.md';
      var fh=await dir.getFileHandle(fname,{create:true});
      var w=await fh.createWritable();
      await w.write(md);await w.close();
      _save();
    }catch(e){console.error('[FOCUS] vault save:',e);}
  }

  // ── Render ────────────────────────────────────────────────
  function _render(){
    var panel=document.getElementById(PANEL_ID);
    if(!panel||!panel.classList.contains('foc-vis'))return;

    var body=document.getElementById('focus-body');
    if(!body)return;

    var mins=Math.floor(state.remaining/60);
    var secs=state.remaining%60;
    var timeStr=String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');

    var total=(state.mode==='work'?WORK_MINS:BREAK_MINS)*60;
    var progress=(total-state.remaining)/total;
    var isWork=state.mode==='work';
    var modeColor=isWork?'var(--accent)':'var(--green)';
    var modeLabel=isWork?'FOCUS':'BREAK';

    // SVG ring - 220px circle
    var R=90,CX=110,CY=110;
    var circ=2*Math.PI*R;
    var dash=circ*(1-progress);

    // Sessions dots
    var dots='';
    var dotTotal=8; // show 8 slots
    for(var i=0;i<dotTotal;i++){
      var filled=i<state.sessionCount;
      dots+='<div style="width:10px;height:10px;border-radius:50%;background:'+(filled?modeColor:'var(--surface2)')+';border:1px solid '+(filled?modeColor:'var(--border)')+'"></div>';
    }

    body.innerHTML=
      '<div style="text-align:center;padding:8px 0 16px">'+
      // Mode label
      '<div style="font-family:var(--mono);font-size:10px;color:'+modeColor+';letter-spacing:.2em;margin-bottom:16px">'+modeLabel+'</div>'+
      // Ring timer
      '<div style="position:relative;display:inline-block;margin-bottom:16px">'+
        '<svg width="220" height="220" viewBox="0 0 220 220">'+
          // Background ring
          '<circle cx="'+CX+'" cy="'+CY+'" r="'+R+'" fill="none" stroke="var(--surface2)" stroke-width="8"/>'+
          // Progress ring
          '<circle cx="'+CX+'" cy="'+CY+'" r="'+R+'" fill="none" stroke="'+modeColor+'" stroke-width="8"'+
          ' stroke-linecap="round" stroke-dasharray="'+circ+'" stroke-dashoffset="'+dash+'"'+
          ' transform="rotate(-90 '+CX+' '+CY+')" style="transition:stroke-dashoffset .5s ease"/>'+
        '</svg>'+
        // Time display centered in ring
        '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">'+
          '<div style="font-family:var(--mono);font-size:36px;font-weight:700;color:var(--text);letter-spacing:.04em">'+timeStr+'</div>'+
          '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:2px">'+(isWork?'until break':'until focus')+'</div>'+
        '</div>'+
      '</div>'+
      // Controls
      '<div style="display:flex;justify-content:center;gap:10px;margin-bottom:20px">'+
        '<button id="foc-reset" style="background:none;border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer">&#8635; Reset</button>'+
        '<button id="foc-main" style="background:var(--accent-dim);border:1px solid '+modeColor+';border-radius:6px;padding:10px 28px;font-family:var(--mono);font-size:13px;color:'+modeColor+';cursor:pointer;font-weight:600">'+
          (state.running?'&#9646;&#9646; Pause':'&#9654; '+(state.remaining===(isWork?WORK_MINS:BREAK_MINS)*60?'Start':'Resume'))+
        '</button>'+
        '<button id="foc-skip" style="background:none;border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer">&#9193; Skip</button>'+
      '</div>'+
      // Session dots
      '<div style="display:flex;justify-content:center;gap:6px;margin-bottom:12px">'+dots+'</div>'+
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted)">'+
        state.sessionCount+' / '+VAULT_SAVE_EVERY+' sessions — '+
        (state.sessions.length>0?'saves after session '+VAULT_SAVE_EVERY:'—')+
      '</div>'+
      // All-time stats
      '<div style="display:flex;justify-content:center;gap:24px;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">'+
        '<div style="text-align:center">'+
          '<div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--accent)">'+state.totalSessions+'</div>'+
          '<div style="font-family:var(--mono);font-size:8px;color:var(--muted)">TOTAL SESSIONS</div>'+
        '</div>'+
        '<div style="text-align:center">'+
          '<div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--accent)">'+(state.totalSessions*WORK_MINS)+'</div>'+
          '<div style="font-family:var(--mono);font-size:8px;color:var(--muted)">FOCUS MINUTES</div>'+
        '</div>'+
        '<div style="text-align:center">'+
          '<div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--accent)">'+state.savedGroups+'</div>'+
          '<div style="font-family:var(--mono);font-size:8px;color:var(--muted)">GROUPS SAVED</div>'+
        '</div>'+
      '</div>'+
      '</div>';

    // Bind controls
    document.getElementById('foc-main').addEventListener('click',function(){
      if(state.running)pause();else start();
    });
    document.getElementById('foc-reset').addEventListener('click',reset);
    document.getElementById('foc-skip').addEventListener('click',skip);
  }

  // ── Panel ─────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    p.classList.add('foc-vis');
    if(p._wbNormalise)p._wbNormalise();
    _render();
  }
  function hidePanel(){
    var p=document.getElementById(PANEL_ID);if(p)p.classList.remove('foc-vis');
    // Don't stop timer when panel closes
  }
  function togglePanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    if(p.classList.contains('foc-vis'))hidePanel();else showPanel();
  }

  // ── Voice ─────────────────────────────────────────────────
  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(/\b(start|begin|open)\b.*\b(focus|pomodoro|timer)\b|\bfocus (session|mode|timer)\b/.test(c)){
      showPanel();
      if(!state.running)start();
      return'Focus session started, sir. BAKER will go silent. Good luck.';
    }
    if(/\b(pause|stop)\b.*\b(focus|timer)\b/.test(c)){
      pause();return'Timer paused, sir.';
    }
    if(/\b(resume|continue)\b.*\b(focus|timer)\b/.test(c)){
      start();return'Resuming focus, sir.';
    }
    if(/\b(how (many|much)|focus (stats?|sessions?))\b/.test(c)){
      return'You have completed '+state.totalSessions+' focus sessions totalling '+(state.totalSessions*WORK_MINS)+' minutes, sir.';
    }
    return null;
  }

  function init(){
    _load();
    // If page becomes visible while BAKER is silenced but timer isn't running, unsilence
    document.addEventListener('visibilitychange',function(){
      if(!document.hidden&&_silenced&&!state.running){
        _unsilenceBAKER();
      }
    });
  }

  return{init,showPanel,hidePanel,togglePanel,handleVoice,start,pause,reset};
})();
