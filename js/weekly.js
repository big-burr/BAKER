// ═══════════════════════════════════════════════════════════
// ══  WEEKLY REVIEW MODULE  ═════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Pulls this week's tasks, workouts, focus, biometrics,
// habits into one summary. Optional AI narrative.
// ═══════════════════════════════════════════════════════════
var WEEKLY=(function(){

  var PANEL_ID='weekly-panel';

  function _weekStart(){
    var d=new Date();d.setDate(d.getDate()-d.getDay());
    return d.toISOString().slice(0,10);
  }
  function _weekEnd(){
    var d=new Date();d.setDate(d.getDate()+(6-d.getDay()));
    return d.toISOString().slice(0,10);
  }
  function _dayStr(d){return['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d];}

  function _gatherData(){
    var ws=_weekStart(),we=_weekEnd();
    var out={ws:ws,we:we,tasks:[],workouts:[],focus:{sessions:0,minutes:0},
             bio:[],habits:{done:0,total:0}};

    // Tasks
    if(typeof CAL!=='undefined'&&CAL.getTasks){
      var tasks=CAL.getTasks();
      out.tasks.done=tasks.filter(function(t){return t.done;});
      out.tasks.pending=tasks.filter(function(t){return!t.done&&t.due&&t.due>=ws&&t.due<=we;});
      out.tasks.overdue=tasks.filter(function(t){return!t.done&&t.due&&t.due<ws;});
    }

    // Workouts
    if(typeof STRENGTH!=='undefined'){
      var stData=JSON.parse(localStorage.getItem('baker_strength_v1')||'{}');
      if(stData.logs)out.workouts=(stData.logs||[]).filter(function(l){return l.date>=ws&&l.date<=we;});
    }

    // Focus
    var focData=JSON.parse(localStorage.getItem('baker_focus_v1')||'{}');
    if(focData.totalSessions){
      // Approximate weekly by recent (no per-session dates stored)
      out.focus.sessions=focData.totalSessions||0;
      out.focus.minutes=(focData.totalSessions||0)*25;
    }

    // Biometrics
    if(typeof BIOMETRICS!=='undefined'&&BIOMETRICS.getEntries){
      out.bio=BIOMETRICS.getEntries().filter(function(e){return e.date>=ws&&e.date<=we;});
    }

    // Habits
    var habData=JSON.parse(localStorage.getItem('baker_habits_v1')||'{}');
    if(habData.habits&&habData.log){
      var total=habData.habits.length*7,done=0;
      for(var i=0;i<7;i++){
        var d=new Date(ws+'T12:00:00');d.setDate(d.getDate()+i);
        var ds=d.toISOString().slice(0,10);
        var dayLog=habData.log[ds]||{};
        habData.habits.forEach(function(h){if(dayLog[h.id])done++;});
      }
      out.habits={done:done,total:total,pct:total?Math.round(done/total*100):0};
    }

    return out;
  }

  function render(){
    var body=document.getElementById('weekly-body');if(!body)return;
    var d=_gatherData();
    var html='<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.1em;margin-bottom:14px">'+
      'WEEK OF '+d.ws+' → '+d.we+'</div>';

    // Tasks summary
    html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">'+
      '<div style="font-size:9px;color:var(--accent);letter-spacing:.1em;margin-bottom:8px">TASKS</div>'+
      '<div style="display:flex;gap:16px">'+
        _statBox((d.tasks.done||[]).length,'Completed','var(--green)')+
        _statBox((d.tasks.pending||[]).length,'Due this week','var(--amber)')+
        _statBox((d.tasks.overdue||[]).length,'Overdue','var(--red)')+
      '</div>'+
      ((d.tasks.done||[]).length?'<div style="margin-top:8px;font-size:10px;color:var(--muted)">'+
        (d.tasks.done||[]).slice(0,5).map(function(t){return'<div style="padding:2px 0">✓ '+t.text+'</div>';}).join('')+
      '</div>':'')+
      '</div>';

    // Workouts
    html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">'+
      '<div style="font-size:9px;color:var(--accent);letter-spacing:.1em;margin-bottom:8px">WORKOUTS</div>'+
      (d.workouts.length?
        d.workouts.map(function(w){
          var sets=w.entries.reduce(function(s,e){return s+e.sets.filter(function(s){return s.done;}).length;},0);
          return'<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:10px;color:var(--text);border-bottom:1px solid var(--border)">'+
            '<span>'+_dayStr(new Date(w.date+'T12:00:00').getDay())+' — '+w.name+'</span>'+
            '<span style="color:var(--muted)">'+sets+' sets</span></div>';
        }).join('')
        :'<div style="font-size:10px;color:var(--muted)">No workouts logged this week</div>')+
      '</div>';

    // Bio averages
    if(d.bio.length){
      var avgMood=d.bio.filter(function(e){return e.mood!=null;}).reduce(function(s,e,_,a){return s+e.mood/a.length;},0)||0;
      var avgSleep=d.bio.filter(function(e){return e.sleep!=null;}).reduce(function(s,e,_,a){return s+e.sleep/a.length;},0)||0;
      var avgEnergy=d.bio.filter(function(e){return e.energy!=null;}).reduce(function(s,e,_,a){return s+e.energy/a.length;},0)||0;
      html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">'+
        '<div style="font-size:9px;color:var(--accent);letter-spacing:.1em;margin-bottom:8px">BIOMETRICS AVG</div>'+
        '<div style="display:flex;gap:16px">'+
          _statBox(avgMood.toFixed(1)+'/10','Mood','var(--accent)')+
          _statBox(avgSleep.toFixed(1)+'h','Sleep','var(--blue)')+
          _statBox(avgEnergy.toFixed(1)+'/10','Energy','var(--amber)')+
        '</div></div>';
    }

    // Habits
    if(d.habits.total){
      html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">'+
        '<div style="font-size:9px;color:var(--accent);letter-spacing:.1em;margin-bottom:8px">HABITS</div>'+
        '<div style="display:flex;align-items:center;gap:12px">'+
          '<div style="font-size:22px;font-weight:700;color:'+(d.habits.pct>=80?'var(--green)':d.habits.pct>=50?'var(--amber)':'var(--muted)')+'">'+d.habits.pct+'%</div>'+
          '<div style="flex:1">'+
            '<div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">'+
              '<div style="height:100%;width:'+d.habits.pct+'%;background:var(--accent);border-radius:3px"></div>'+
            '</div>'+
            '<div style="font-size:9px;color:var(--muted);margin-top:3px">'+d.habits.done+' of '+d.habits.total+' completions</div>'+
          '</div></div></div>';
    }

    // AI narrative button
    html+='<div style="display:flex;gap:6px;margin-bottom:10px">'+
      '<button id="weekly-ai-btn" style="flex:1;background:none;border:1px solid var(--accent-dim);border-radius:6px;padding:8px;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer">&#9670; Generate Summary</button>'+
      '<button id="weekly-save-btn" style="background:none;border:1px solid var(--green);border-radius:6px;padding:8px 12px;font-family:var(--mono);font-size:10px;color:var(--green);cursor:pointer">&#128190; Save</button>'+
      '</div>'+
      '<div id="weekly-ai-output" style="display:none"></div>';

    body.innerHTML=html;
    document.getElementById('weekly-ai-btn').addEventListener('click',function(){_generateSummary(d);});
    document.getElementById('weekly-save-btn').addEventListener('click',function(){
      var aiText=(document.getElementById('weekly-ai-output')||{}).textContent||'';
      _saveToVault(d,aiText||null);
    });
  }

  function _statBox(val,label,color){
    return'<div style="text-align:center;flex:1">'+
      '<div style="font-family:var(--mono);font-size:16px;font-weight:700;color:'+color+'">'+val+'</div>'+
      '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);margin-top:2px">'+label+'</div>'+
      '</div>';
  }

  async function _generateSummary(d){
    var key=localStorage.getItem('baker_api_key');
    if(!key)return;
    var btn=document.getElementById('weekly-ai-btn');
    if(btn){btn.textContent='Generating...';btn.disabled=true;}

    var context='Week of '+d.ws+':\n'+
      'Tasks completed: '+((d.tasks.done||[]).length)+'\n'+
      'Workouts: '+d.workouts.length+'\n'+
      'Habits: '+d.habits.pct+'%\n'+
      (d.bio.length?'Avg mood/sleep/energy tracked\n':'');

    try{
      var resp=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:300,
          messages:[{role:'user',content:'Write a brief, motivating weekly review for BAKER (an AI assistant for a college student). JARVIS tone. 3-4 sentences. Data:\n'+context}]})
      });
      var data=await resp.json();
      var text=data.content.map(function(b){return b.text||'';}).join('').trim();
      var out=document.getElementById('weekly-ai-output');
      if(out){out.style.display='block';
        out.innerHTML='<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:12px;font-family:var(--mono);font-size:10px;color:var(--text);line-height:1.7">'+text+'</div>';}
    }catch(e){}
    if(btn){btn.textContent='&#9670; Generate Weekly Summary';btn.disabled=false;}
  }

  function showPanel(){var p=document.getElementById(PANEL_ID);if(!p)return;p.classList.add('wkly-vis');if(p._wbNormalise)p._wbNormalise();render();}
  function hidePanel(){var p=document.getElementById(PANEL_ID);if(p)p.classList.remove('wkly-vis');}
  function togglePanel(){var p=document.getElementById(PANEL_ID);if(!p)return;if(p.classList.contains('wkly-vis'))hidePanel();else showPanel();}

  function handleVoice(cmd){
    var c=cmd.toLowerCase();
    if(/\b(weekly|week)\b.*\b(review|summary|recap)\b|\bweekly review\b/.test(c)){showPanel();return'Here is your weekly review, sir.';}
    return null;
  }

  function init(){}
  async function _saveToVault(d,aiText){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected){alert('Connect vault first');return;}
    var md='---\ntype: weekly\nweek: '+d.ws+'\n---\n\n# Weekly Review — '+d.ws+' to '+d.we+'\n\n';
    if(aiText)md+='> '+aiText+'\n\n';
    md+='## Stats\n\n| Metric | Value |\n|---|---|\n';
    md+='| Tasks completed | '+((d.tasks&&d.tasks.done&&d.tasks.done.length)||0)+' |\n';
    md+='| Workouts | '+(d.workouts&&d.workouts.length||0)+' |\n';
    md+='| Habits | '+(d.habits&&d.habits.pct||0)+'% |\n\n';
    md+='## Completed Tasks\n\n';
    ((d.tasks&&d.tasks.done)||[]).forEach(function(t){md+='- [x] '+t.text+'\n';});
    md+='\n## Workouts\n\n';
    (d.workouts||[]).forEach(function(w){
      md+='**'+w.name+'** ('+w.date+')\n';
      (w.entries||[]).forEach(function(e){
        var done=(e.sets||[]).filter(function(s){return s.done;});
        if(done.length)md+='- '+e.exercise+': '+done.map(function(s){return s.reps+'x'+s.weight;}).join(', ')+'\n';
      });
      md+='\n';
    });
    try{
      var dir=vaultHandle;
      dir=await dir.getDirectoryHandle('07-System',{create:true});
      dir=await dir.getDirectoryHandle('Weekly',{create:true});
      var fh=await dir.getFileHandle('week-'+d.ws+'.md',{create:true});
      var w=await fh.createWritable();await w.write(md);await w.close();
      if(typeof spawnBirthParticle==='function')spawnBirthParticle('system','07-System/Weekly/week-'+d.ws+'.md');
      var btn=document.getElementById('weekly-save-btn');
      if(btn){btn.textContent='Saved!';btn.disabled=true;}
      if(typeof speakResponse==='function')speakResponse('Weekly review saved to vault, sir.');
    }catch(e){alert('Save failed: '+e.message);}
  }

  return{init,showPanel,hidePanel,togglePanel,handleVoice};
})();
