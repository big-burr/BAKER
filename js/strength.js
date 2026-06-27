// ═══════════════════════════════════════════════════════════
// ══  STRENGTH MODULE v2 — Stronger-style  ══════════════════
// ═══════════════════════════════════════════════════════════
// Tabs: Split | Workout | Map | Score
// Fast set logging, auto-fill last weights, 120s rest timer,
// exercise history, PR detection, muscle heat map,
// faction characters, AI recs, vault sync
// ═══════════════════════════════════════════════════════════
var STRENGTH=(function(){

  var LS_KEY='baker_strength_v1';
  var DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DAYS_FULL=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var REST_DEFAULT=120; // seconds

  var data={bodyweight:185,split:[],logs:[],prs:{},restTime:REST_DEFAULT,customExercises:[]};
  var currentTab='workout';
  var _restTimer=null;
  var _restRemaining=0;
  var _historyExercise=null; // exercise name for history popup

  // ── Exercise database ─────────────────────────────────────
  var EXERCISE_MUSCLES={
    'Bench Press':['chest','front-delts','triceps'],
    'Incline Bench':['chest','front-delts','triceps'],
    'Decline Bench':['chest','triceps'],
    'DB Fly':['chest'],'Cable Fly':['chest'],
    'Overhead Press':['front-delts','side-delts','triceps','traps'],
    'DB Lateral Raise':['side-delts'],'Cable Lateral Raise':['side-delts'],
    'Front Raise':['front-delts'],'Face Pull':['rear-delts','traps'],
    'Tricep Pushdown':['triceps'],'Skull Crusher':['triceps'],
    'Close Grip Bench':['triceps','chest'],
    'Deadlift':['lats','traps','lower-back','glutes','hamstrings'],
    'Romanian Deadlift':['hamstrings','glutes','lower-back'],
    'Barbell Row':['lats','mid-back','rear-delts','biceps'],
    'Cable Row':['lats','mid-back','biceps'],
    'Lat Pulldown':['lats','biceps'],'Pull Up':['lats','biceps','mid-back'],
    'Chin Up':['biceps','lats'],'Shrug':['traps'],
    'Barbell Curl':['biceps'],'DB Curl':['biceps'],
    'Hammer Curl':['biceps','forearms'],
    'Squat':['quads','glutes','hamstrings'],
    'Hack Squat':['quads','glutes'],'Leg Press':['quads','glutes','hamstrings'],
    'Leg Extension':['quads'],'Leg Curl':['hamstrings'],
    'Hip Thrust':['glutes'],'Lunge':['quads','glutes'],
    'Calf Raise':['calves'],
    'Plank':['abs','obliques'],'Ab Wheel':['abs'],
    'Cable Crunch':['abs'],'Russian Twist':['obliques'],
    'Farmer Carry':['forearms','traps','abs'],
    'Dips':['chest','triceps'],'Push Up':['chest','triceps'],
    'Incline DB Press':['chest','front-delts'],
    'DB Row':['lats','mid-back','biceps'],
    'Pendlay Row':['lats','mid-back'],
    'Sumo Deadlift':['glutes','hamstrings','quads'],
    'Front Squat':['quads','abs'],
    'Bulgarian Split Squat':['quads','glutes'],
    'Seated Calf Raise':['calves'],
    'Preacher Curl':['biceps'],
    'Concentration Curl':['biceps'],
    'Overhead Tricep Extension':['triceps'],
    'Cable Kickback':['triceps'],
    'Lateral Raise Machine':['side-delts'],
    'Chest Press Machine':['chest','triceps'],
    'Leg Press (Single)':['quads','glutes'],
    'Goblet Squat':['quads','glutes'],
  };

  // ── Storage ───────────────────────────────────────────────
  function _load(){
    try{var r=localStorage.getItem(LS_KEY);if(r){var d=JSON.parse(r);
      data.bodyweight=d.bodyweight||185;data.split=d.split||[];
      data.logs=d.logs||[];data.prs=d.prs||{};data.restTime=d.restTime||REST_DEFAULT;
      data.customExercises=d.customExercises||[];
      // Merge custom exercises into EXERCISE_MUSCLES
      data.customExercises.forEach(function(ce){
        if(ce.name&&ce.muscles)EXERCISE_MUSCLES[ce.name]=ce.muscles;
      });
    }}catch(e){}
  }
  function addCustomExercise(name,muscles,pattern){
    if(!name||!muscles||!muscles.length)return false;
    var exists=data.customExercises.some(function(ce){return ce.name.toLowerCase()===name.toLowerCase();});
    if(exists)return false;
    var ce={name:name,muscles:muscles,pattern:pattern||'',custom:true};
    data.customExercises.push(ce);
    EXERCISE_MUSCLES[name]=muscles;
    _save();return true;
  }
  function getAllExercises(){
    var std=Object.keys(EXERCISE_MUSCLES).filter(function(k){return!data.customExercises.some(function(ce){return ce.name===k;});}).sort();
    var custom=data.customExercises.map(function(ce){return'★ '+ce.name;}).sort();
    return std.concat(custom);
  }
  function _save(){
    var cutoff=new Date();cutoff.setDate(cutoff.getDate()-90);
    var cs=cutoff.toISOString().slice(0,10);
    data.logs=data.logs.filter(function(l){return l.date>=cs;});
    try{localStorage.setItem(LS_KEY,JSON.stringify(data));}catch(e){}
    if(typeof VAULTSYNC!=='undefined'&&VAULTSYNC.syncStrength)VAULTSYNC.syncStrength(data);
  }

  function _today(){return new Date().toISOString().slice(0,10);}
  function _weekStart(){var d=new Date();d.setDate(d.getDate()-d.getDay());return d.toISOString().slice(0,10);}
  function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');}
  function _el(id){return document.getElementById(id);}

  // ── Get/create today's workout ────────────────────────────
  function _getTodayLog(){
    var today=_today();
    var log=data.logs.find(function(l){return l.date===today;});
    if(!log){
      var dayOfWeek=new Date().getDay();
      var splitDay=data.split.find(function(s){return s.day===dayOfWeek;});
      log={date:today,day:dayOfWeek,name:splitDay?splitDay.name:'Workout',entries:[]};
      // Auto-populate from split with last session weights
      if(splitDay){
        log.entries=splitDay.exercises.map(function(ex){
          var prev=_getLastPerformance(ex.name);
          var sets=[];
          for(var i=0;i<ex.sets;i++){
            sets.push({
              reps:prev&&prev.sets[i]?prev.sets[i].reps:ex.reps,
              weight:prev&&prev.sets[i]?prev.sets[i].weight:ex.weight||0,
              done:false
            });
          }
          return{exercise:ex.name,sets:sets,note:''};
        });
      }
      data.logs.push(log);_save();
    }
    return log;
  }

  // ── Last performance for auto-fill ────────────────────────
  function _getLastPerformance(exerciseName){
    var today=_today();
    for(var i=data.logs.length-1;i>=0;i--){
      var log=data.logs[i];
      if(log.date===today)continue;
      var entry=log.entries.find(function(e){return e.exercise===exerciseName;});
      if(entry){
        var doneSets=entry.sets.filter(function(s){return s.done;});
        if(doneSets.length)return{sets:doneSets,date:log.date};
      }
    }
    return null;
  }

  // ── Exercise history ──────────────────────────────────────
  function _getExerciseHistory(name,limit){
    limit=limit||10;
    var history=[];
    for(var i=data.logs.length-1;i>=0;i--){
      var log=data.logs[i];
      var entry=log.entries.find(function(e){return e.exercise===name;});
      if(!entry)continue;
      var doneSets=entry.sets.filter(function(s){return s.done;});
      if(!doneSets.length)continue;
      var bestSet=doneSets.reduce(function(best,s){
        return(s.weight>best.weight||(s.weight===best.weight&&s.reps>best.reps))?s:best;
      },doneSets[0]);
      var totalVol=doneSets.reduce(function(v,s){return v+s.reps*s.weight;},0);
      history.push({date:log.date,sets:doneSets.length,bestWeight:bestSet.weight,
        bestReps:bestSet.reps,volume:totalVol});
      if(history.length>=limit)break;
    }
    return history;
  }

  // ── PR check ──────────────────────────────────────────────
  function _checkPR(exercise,reps,weight){
    var existing=data.prs[exercise];
    if(!existing||weight>existing.weight||(weight===existing.weight&&reps>existing.reps)){
      data.prs[exercise]={weight:weight,reps:reps,date:_today()};
      return true;
    }
    return false;
  }

  // ── Rest timer ────────────────────────────────────────────
  function _startRest(){
    _stopRest();
    _restRemaining=data.restTime||REST_DEFAULT;
    _updateRestDisplay();
    _restTimer=setInterval(function(){
      _restRemaining--;
      if(_restRemaining<=0){_stopRest();_restRemaining=0;}
      _updateRestDisplay();
    },1000);
  }
  function _stopRest(){
    if(_restTimer){clearInterval(_restTimer);_restTimer=null;}
    var el=_el('str-rest-bar');if(el)el.style.display='none';
  }
  function _updateRestDisplay(){
    var el=_el('str-rest-bar');
    if(!el){
      var panel=_el('strength-panel');if(!panel)return;
      el=document.createElement('div');el.id='str-rest-bar';
      el.style.cssText='position:absolute;bottom:0;left:0;right:0;background:rgba(15,15,16,.95);border-top:1px solid var(--accent);padding:10px 16px;display:flex;align-items:center;gap:12px;z-index:10';
      panel.appendChild(el);
    }
    el.style.display='flex';
    var pct=Math.max(0,(_restRemaining/(data.restTime||REST_DEFAULT))*100);
    el.innerHTML=
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.08em;flex-shrink:0">REST</div>'+
      '<div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">'+
        '<div style="height:100%;width:'+pct+'%;background:var(--accent);border-radius:3px;transition:width 1s linear"></div>'+
      '</div>'+
      '<div style="font-family:var(--mono);font-size:16px;font-weight:700;color:'+(_restRemaining<=10?'var(--red)':'var(--accent)')+';min-width:38px;text-align:right">'+
        Math.floor(_restRemaining/60)+':'+String(_restRemaining%60).padStart(2,'0')+'</div>'+
      '<button onclick="STRENGTH._skipRest()" style="background:none;border:1px solid var(--border);border-radius:4px;padding:3px 10px;font-family:var(--mono);font-size:9px;color:var(--muted);cursor:pointer">Skip</button>';
  }
  function _skipRest(){_stopRest();}

  // ── Soreness model (48h decay) ────────────────────────────
  function _muscleHeat(muscle){
    var now=Date.now(),heat=0;
    data.logs.forEach(function(log){
      var logTime=new Date(log.date+'T12:00:00').getTime();
      var age=(now-logTime)/(1000*3600);
      if(age>96)return;
      log.entries.forEach(function(entry){
        var muscles=EXERCISE_MUSCLES[entry.exercise]||[];
        if(!muscles.includes(muscle))return;
        var setsCompleted=entry.sets.filter(function(s){return s.done;}).length;
        if(!setsCompleted)return;
        var intensity=Math.min(setsCompleted/4,1);
        var heatVal=age<48?intensity:intensity*(1-(age-48)/48);
        heat=Math.max(heat,Math.max(0,heatVal));
      });
    });
    return heat;
  }

  // ── Strength Score ────────────────────────────────────────
  var KEY_LIFTS=['Bench Press','Squat','Deadlift','Overhead Press','Barbell Row'];
  var STRENGTH_NORMS={'Bench Press':1.5,'Squat':2.0,'Deadlift':2.5,'Overhead Press':0.9,'Barbell Row':1.25};
  function _calcScore(){
    var bw=data.bodyweight||185,total=0,count=0;
    KEY_LIFTS.forEach(function(lift){
      var pr=data.prs[lift];if(!pr)return;
      total+=(pr.weight/bw/(STRENGTH_NORMS[lift]||1.5))*200;count++;
    });
    return count?Math.round(total/count):0;
  }
  function _calcWeeklyVolume(){
    var ws=_weekStart(),vol=0;
    data.logs.forEach(function(log){
      if(log.date<ws)return;
      log.entries.forEach(function(e){e.sets.forEach(function(s){if(s.done)vol+=s.reps*s.weight;});});
    });
    return vol;
  }

  // ── Vault save ────────────────────────────────────────────
  async function _saveWeekToVault(){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return false;
    try{
      var ws=_weekStart();
      var we=new Date(ws);we.setDate(we.getDate()+6);
      var weStr=we.toISOString().slice(0,10);
      var weekLogs=data.logs.filter(function(l){return l.date>=ws&&l.date<=weStr;});
      if(!weekLogs.length)return false;
      var md='---\ntype: workout-week\ndate: '+ws+'\n---\n\n# Workout Week '+ws+' to '+weStr+'\n\n';
      md+='**Score:** '+_calcScore()+' | **Volume:** '+_calcWeeklyVolume().toLocaleString()+' lbs\n\n';
      weekLogs.forEach(function(log){
        md+='## '+DAYS_FULL[log.day]+' — '+(log.name||'Rest')+' ('+log.date+')\n\n';
        if(!log.entries.length){md+='_Rest_\n\n';return;}
        log.entries.forEach(function(entry){
          var done=entry.sets.filter(function(s){return s.done;});
          if(!done.length)return;
          md+='**'+entry.exercise+'**\n';
          done.forEach(function(s,i){md+='- Set '+(i+1)+': '+s.reps+' x '+s.weight+'lbs\n';});
          md+='\n';
        });
      });
      var dir=vaultHandle;
      dir=await dir.getDirectoryHandle('07-System',{create:true});
      dir=await dir.getDirectoryHandle('Workouts',{create:true});
      var fh=await dir.getFileHandle('workout-week-'+ws+'.md',{create:true});
      var w=await fh.createWritable();await w.write(md);await w.close();
      if(typeof spawnBirthParticle==='function')spawnBirthParticle('workout','07-System/Workouts/workout-week-'+ws+'.md');
      return true;
    }catch(e){return false;}
  }

  // ── Faction character SVG ─────────────────────────────────
  function _getFactionChar(theme,recovery){
    var col='var(--accent)',dark='var(--bg)';
    var fresh=recovery>0.6,mid=recovery>0.3;
    if(theme==='pipboy'||theme==='vaulttec')return _vaultBoySVG(col,dark,fresh,mid);
    if(theme==='enclave')return _armorSVG(col,dark,fresh,'enclave');
    if(theme==='bos')return _armorSVG(col,dark,fresh,'bos');
    if(theme==='ncr')return _rangerSVG(col,dark,fresh);
    return _humanSVG(col,dark,fresh,mid);
  }
  function _humanSVG(c,d,f,m){
    return '<svg viewBox="0 0 80 140" xmlns="http://www.w3.org/2000/svg"><g transform="translate(40,0)" fill="'+c+'" opacity="0.9">'+
      '<circle cx="0" cy="12" r="10"/>'+
      '<rect x="-3" y="21" width="6" height="7"/>'+
      '<rect x="-12" y="28" width="24" height="30" rx="3"/>'+
      '<rect x="-20" y="28" width="8" height="26" rx="3" transform="rotate('+(f?-8:m?2:10)+' -16 28)"/>'+
      '<rect x="12" y="28" width="8" height="26" rx="3" transform="rotate('+(f?8:m?-2:-10)+' 16 28)"/>'+
      '<rect x="-10" y="60" width="9" height="34" rx="3"/>'+
      '<rect x="1" y="60" width="9" height="34" rx="3"/>'+
      '</g></svg>';
  }
  function _vaultBoySVG(c,d,f,m){
    return '<svg viewBox="0 0 80 140" xmlns="http://www.w3.org/2000/svg"><g transform="translate(40,0)">'+
      '<circle cx="0" cy="10" r="12" fill="'+c+'"/>'+
      '<circle cx="-4" cy="8" r="3" fill="'+d+'"/><circle cx="4" cy="8" r="3" fill="'+d+'"/>'+
      (f?'<path d="M-4 15 Q0 19 4 15" stroke="'+d+'" stroke-width="1.5" fill="none"/>':'<path d="M-3 16 Q0 13 3 16" stroke="'+d+'" stroke-width="1.5" fill="none"/>')+
      '<rect x="-13" y="23" width="26" height="28" rx="4" fill="'+c+'"/>'+
      (f?'<g transform="rotate(-45 -20 24)"><rect x="-20" y="23" width="8" height="20" rx="3" fill="'+c+'"/></g><circle cx="-26" cy="14" r="5" fill="'+c+'"/><rect x="-28" y="10" width="4" height="8" rx="2" fill="'+c+'"/>':
      '<rect x="-22" y="26" width="8" height="22" rx="3" fill="'+c+'"/>')+
      '<rect x="14" y="26" width="8" height="22" rx="3" fill="'+c+'"/>'+
      '<rect x="-12" y="51" width="11" height="28" rx="3" fill="'+c+'"/>'+
      '<rect x="1" y="51" width="11" height="28" rx="3" fill="'+c+'"/>'+
      '<rect x="-14" y="76" width="13" height="7" rx="2" fill="'+c+'"/>'+
      '<rect x="1" y="76" width="13" height="7" rx="2" fill="'+c+'"/>'+
      '</g></svg>';
  }
  function _armorSVG(c,d,f,type){
    var helmet=type==='enclave'?
      '<rect x="-13" y="0" width="26" height="22" rx="8" fill="'+c+'"/><rect x="-10" y="5" width="20" height="8" rx="3" fill="'+d+'" opacity="0.8"/><rect x="-2" y="-6" width="4" height="7" rx="1" fill="'+c+'"/>':
      '<rect x="-12" y="0" width="24" height="22" rx="6" fill="'+c+'"/><rect x="-10" y="5" width="20" height="4" rx="2" fill="'+d+'"/><rect x="-5" y="5" width="10" height="12" rx="2" fill="'+d+'"/>';
    return '<svg viewBox="0 0 80 140" xmlns="http://www.w3.org/2000/svg"><g transform="translate(40,2)">'+helmet+
      '<rect x="-17" y="27" width="34" height="34" rx="5" fill="'+c+'"/>'+
      '<ellipse cx="-20" cy="29" rx="8" ry="6" fill="'+c+'"/>'+
      '<ellipse cx="20" cy="29" rx="8" ry="6" fill="'+c+'"/>'+
      '<rect x="-25" y="30" width="10" height="26" rx="4" fill="'+c+'" transform="rotate('+(f?-3:8)+' -20 30)"/>'+
      '<rect x="15" y="30" width="10" height="26" rx="4" fill="'+c+'" transform="rotate('+(f?3:-8)+' 20 30)"/>'+
      '<rect x="-14" y="62" width="12" height="30" rx="4" fill="'+c+'"/>'+
      '<rect x="2" y="62" width="12" height="30" rx="4" fill="'+c+'"/>'+
      '<rect x="-16" y="89" width="14" height="8" rx="3" fill="'+c+'"/>'+
      '<rect x="2" y="89" width="14" height="8" rx="3" fill="'+c+'"/>'+
      '</g></svg>';
  }
  function _rangerSVG(c,d,f){
    return '<svg viewBox="0 0 80 140" xmlns="http://www.w3.org/2000/svg"><g transform="translate(40,2)">'+
      '<circle cx="0" cy="10" r="13" fill="'+c+'"/>'+
      '<circle cx="-5" cy="8" r="5" fill="'+d+'"/><circle cx="5" cy="8" r="5" fill="'+d+'"/>'+
      '<rect x="-14" y="2" width="28" height="3" rx="1" fill="'+c+'" opacity="0.6"/>'+
      '<rect x="-5" y="16" width="10" height="5" rx="2" fill="'+c+'"/>'+
      '<rect x="-13" y="27" width="26" height="36" rx="4" fill="'+c+'"/>'+
      '<rect x="-20" y="27" width="8" height="28" rx="3" fill="'+c+'" transform="rotate('+(f?-8:6)+' -16 27)"/>'+
      '<rect x="12" y="27" width="8" height="28" rx="3" fill="'+c+'" transform="rotate('+(f?8:-6)+' 16 27)"/>'+
      '<path d="M-13 63 L-16 85 L-6 85 L0 73 L6 85 L16 85 L13 63 Z" fill="'+c+'"/>'+
      '<rect x="-12" y="85" width="11" height="7" rx="2" fill="'+c+'"/>'+
      '<rect x="1" y="85" width="11" height="7" rx="2" fill="'+c+'"/>'+
      '</g></svg>';
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  function render(){
    var panel=_el('strength-panel');
    if(!panel||!panel.classList.contains('str-vis'))return;
    ['split','workout','map','score','coach'].forEach(function(t){
      var btn=_el('str-tab-'+t);if(btn)btn.classList.toggle('active',t===currentTab);
      var content=_el('str-'+t+'-content');if(content)content.style.display=(t===currentTab?'block':'none');
    });
    if(currentTab==='split')_renderSplit();
    else if(currentTab==='workout')_renderWorkout();
    else if(currentTab==='map')_renderMap();
    else if(currentTab==='score')_renderScore();
    else if(currentTab==='coach')_renderCoach();
  }

  // ── SPLIT TAB ─────────────────────────────────────────────
  function _showCustomExerciseModal(){
    var existing=document.getElementById('str-custom-modal');if(existing)existing.remove();
    var ALL_MUSCLES=['chest','front-delts','side-delts','rear-delts','traps','lats','mid-back',
      'lower-back','biceps','triceps','forearms','abs','obliques','quads','hamstrings','glutes','calves'];
    var PATTERNS=['Push','Pull','Hinge','Squat','Carry','Isolation','Compound','Core'];
    var modal=document.createElement('div');modal.id='str-custom-modal';
    modal.style.cssText='position:absolute;inset:0;background:rgba(0,0,0,.85);z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;border-radius:14px';
    modal.innerHTML='<div style="background:var(--surface);border:1px solid var(--accent);border-radius:10px;padding:16px;width:100%;max-width:360px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'+
        '<span style="font-family:var(--mono);font-size:11px;color:var(--accent)">★ New Exercise</span>'+
        '<button id="str-custom-close" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px">×</button></div>'+
      '<input id="str-custom-name" placeholder="Exercise name..." style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:7px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none;margin-bottom:10px;box-sizing:border-box">'+
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.08em;margin-bottom:5px">MUSCLES WORKED</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">'+
        ALL_MUSCLES.map(function(m){
          return'<label style="display:flex;align-items:center;gap:3px;background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:3px 6px;cursor:pointer;font-family:var(--mono);font-size:9px;color:var(--muted)">'+
            '<input type="checkbox" value="'+m+'" style="margin:0"> '+m+'</label>';
        }).join('')+'</div>'+
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.08em;margin-bottom:5px">MOVEMENT PATTERN</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">'+
        PATTERNS.map(function(p){
          return'<label style="display:flex;align-items:center;gap:3px;background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:3px 8px;cursor:pointer;font-family:var(--mono);font-size:9px;color:var(--muted)">'+
            '<input type="radio" name="str-pattern" value="'+p+'" style="margin:0"> '+p+'</label>';
        }).join('')+'</div>'+
      '<button id="str-custom-save" style="width:100%;background:var(--accent-dim);border:1px solid var(--accent);border-radius:4px;padding:8px;font-family:var(--mono);font-size:11px;color:var(--accent);cursor:pointer">Save Exercise</button>'+
      '</div>';
    _el('strength-panel').appendChild(modal);
    _el('str-custom-close').addEventListener('click',function(){modal.remove();});
    modal.addEventListener('click',function(e){if(e.target===modal)modal.remove();});
    _el('str-custom-save').addEventListener('click',function(){
      var name=(_el('str-custom-name')||{}).value||'';
      if(!name.trim()){alert('Enter a name');return;}
      var muscles=[].slice.call(modal.querySelectorAll('input[type=checkbox]:checked')).map(function(cb){return cb.value;});
      if(!muscles.length){alert('Select at least one muscle');return;}
      var patternEl=modal.querySelector('input[name=str-pattern]:checked');
      var pattern=patternEl?patternEl.value:'';
      var ok=addCustomExercise(name.trim(),muscles,pattern);
      if(ok){modal.remove();_renderSplit();}
      else{alert('Exercise already exists');}
    });
  }

  function _renderSplit(){
    var el=_el('str-split-content');if(!el)return;
    var today=new Date().getDay();
    var html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'+
      '<span style="font-family:var(--mono);font-size:10px;color:var(--muted)">Tap a day to edit your split</span>'+
      '<div style="display:flex;gap:6px;align-items:center">'+
      '<button id="str-add-custom" style="background:none;border:1px solid var(--accent-dim);border-radius:4px;padding:3px 8px;font-family:var(--mono);font-size:9px;color:var(--accent);cursor:pointer">★ Custom</button>'+
        '<label style="font-size:10px;color:var(--muted);font-family:var(--mono)">BW:</label>'+
        '<input id="str-bw" type="number" value="'+data.bodyweight+'" min="50" max="500" step="0.5" '+
        'style="width:55px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 6px;font-family:var(--mono);font-size:10px;color:var(--text);outline:none"> lbs'+
      '</div></div>';
    html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px">';
    for(var d=0;d<7;d++){
      var splitDay=data.split.find(function(s){return s.day===d;});
      var isToday=d===today;
      html+='<div class="str-day-card" data-day="'+d+'" style="background:var(--surface'+(isToday?'':'2')+');border:1px solid '+(isToday?'var(--accent)':'var(--border)')+';border-radius:6px;padding:8px 4px;cursor:pointer;text-align:center;transition:all .15s">'+
        '<div style="font-family:var(--mono);font-size:9px;color:'+(isToday?'var(--accent)':'var(--muted)')+'">'+DAYS[d]+'</div>'+
        '<div style="font-size:10px;color:var(--text);margin-top:3px">'+(splitDay?_esc(splitDay.name):'<span style="color:var(--muted);font-size:9px">REST</span>')+'</div>'+
        (splitDay?'<div style="font-size:8px;color:var(--muted);margin-top:2px">'+splitDay.exercises.length+' ex</div>':'')+'</div>';
    }
    html+='</div><div id="str-day-editor" style="display:none"></div>';
    el.innerHTML=html;
    _el('str-bw').addEventListener('change',function(){data.bodyweight=parseFloat(this.value)||185;_save();});
    var custBtn=_el('str-add-custom');
    if(custBtn)custBtn.addEventListener('click',_showCustomExerciseModal);
    el.querySelectorAll('.str-day-card').forEach(function(card){
      card.addEventListener('click',function(){_showDayEditor(parseInt(card.dataset.day));});
    });
  }

  function _showDayEditor(dayIdx){
    var ed=_el('str-day-editor');if(!ed)return;
    var splitDay=data.split.find(function(s){return s.day===dayIdx;});
    var exercises=splitDay?JSON.parse(JSON.stringify(splitDay.exercises)):[];
    ed.style.display='block';
    function _rebuildEditor(){
      var exList=exercises.map(function(ex,i){
        return '<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;background:var(--bg);border:1px solid var(--border);border-radius:5px;padding:7px 9px">'+
          '<input value="'+_esc(ex.name)+'" data-i="'+i+'" data-f="name" list="str-ex-list" placeholder="Exercise" style="flex:1;background:none;border:none;font-family:var(--mono);font-size:10px;color:var(--text);outline:none;min-width:0">'+
          '<input type="number" value="'+ex.sets+'" data-i="'+i+'" data-f="sets" min="1" max="20" style="width:32px;background:none;border:1px solid var(--border);border-radius:3px;text-align:center;font-family:var(--mono);font-size:10px;color:var(--muted);padding:2px;outline:none">'+
          '<span style="font-size:9px;color:var(--muted)">×</span>'+
          '<input type="number" value="'+ex.reps+'" data-i="'+i+'" data-f="reps" min="1" max="100" style="width:32px;background:none;border:1px solid var(--border);border-radius:3px;text-align:center;font-family:var(--mono);font-size:10px;color:var(--muted);padding:2px;outline:none">'+
          '<span style="font-size:9px;color:var(--muted)">@</span>'+
          '<input type="number" value="'+(ex.weight||0)+'" data-i="'+i+'" data-f="weight" min="0" max="2000" step="5" style="width:44px;background:none;border:1px solid var(--border);border-radius:3px;text-align:center;font-family:var(--mono);font-size:10px;color:var(--muted);padding:2px;outline:none">'+
          '<button data-rm="'+i+'" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:0 2px">×</button>'+
          '</div>';
      }).join('');
      ed.innerHTML='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px">'+
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">'+
          '<span style="font-family:var(--mono);font-size:11px;color:var(--accent)">'+DAYS_FULL[dayIdx]+'</span>'+
          '<input id="str-day-name" value="'+(splitDay?_esc(splitDay.name):'')+'" placeholder="Day name" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-family:var(--mono);font-size:10px;color:var(--text);outline:none">'+
        '</div>'+
        '<datalist id="str-ex-list">'+getAllExercises().map(function(e){return'<option value="'+e+'">';}).join('')+'</datalist>'+
        exList+
        '<div style="display:flex;gap:6px;margin-top:8px">'+
          '<button id="str-add-ex" style="flex:1;background:none;border:1px dashed var(--border);border-radius:4px;padding:5px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer">+ Exercise</button>'+
          '<button id="str-save-day" style="background:var(--accent-dim);border:1px solid var(--accent);border-radius:4px;padding:5px 14px;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer">Save</button>'+
          '<button id="str-rest-day" style="background:none;border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer">REST</button>'+
        '</div></div>';
      // Bind
      ed.querySelectorAll('[data-f]').forEach(function(inp){
        inp.addEventListener('change',function(){var i=parseInt(inp.dataset.i),f=inp.dataset.f;
          if(f==='name')exercises[i].name=inp.value;else exercises[i][f]=parseFloat(inp.value)||0;});
      });
      ed.querySelectorAll('[data-rm]').forEach(function(b){
        b.addEventListener('click',function(){exercises.splice(parseInt(b.dataset.rm),1);_rebuildEditor();});
      });
      _el('str-add-ex').addEventListener('click',function(){
        exercises.push({name:'',sets:3,reps:5,weight:0});_rebuildEditor();
      });
      _el('str-save-day').addEventListener('click',function(){
        var name=(_el('str-day-name')||{}).value||'';
        var filtered=exercises.filter(function(e){return e.name.trim();});
        data.split=data.split.filter(function(s){return s.day!==dayIdx;});
        if(filtered.length)data.split.push({day:dayIdx,name:name.trim()||DAYS_FULL[dayIdx],exercises:filtered});
        _save();ed.style.display='none';_renderSplit();
      });
      _el('str-rest-day').addEventListener('click',function(){
        data.split=data.split.filter(function(s){return s.day!==dayIdx;});
        _save();ed.style.display='none';_renderSplit();
      });
    }
    _rebuildEditor();
  }

  // ── WORKOUT TAB (Stronger-style) ──────────────────────────
  function _renderWorkout(){
    var el=_el('str-workout-content');if(!el)return;
    var log=_getTodayLog();
    var splitDay=data.split.find(function(s){return s.day===new Date().getDay();});
    var isRest=!splitDay&&!log.entries.length;
    var doneSets=0,totalSets=0;
    log.entries.forEach(function(e){e.sets.forEach(function(s){totalSets++;if(s.done)doneSets++;});});

    var html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'+
      '<div><div style="font-family:var(--mono);font-size:13px;color:var(--accent)">'+_esc(log.name||'Workout')+'</div>'+
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted)">'+log.date+' · '+doneSets+'/'+totalSets+' sets</div></div>'+
      '<div style="display:flex;gap:6px">'+
        '<button id="str-ai-btn" style="background:none;border:1px solid var(--accent-dim);border-radius:4px;padding:4px 8px;font-family:var(--mono);font-size:9px;color:var(--accent);cursor:pointer">◆ AI</button>'+
        '<button id="str-save-week" style="background:none;border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-family:var(--mono);font-size:9px;color:var(--muted);cursor:pointer">💾</button>'+
      '</div></div>';

    if(isRest){
      html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:20px;text-align:center">'+
        '<div style="font-size:24px;margin-bottom:8px">🌙</div>'+
        '<div style="font-family:var(--mono);font-size:12px;color:var(--accent);margin-bottom:8px">Rest Day</div>'+
        '<div style="font-family:var(--mono);font-size:10px;color:var(--muted);line-height:1.8">'+
        '• 20-30 min walk or light cardio<br>• Foam rolling + mobility<br>• Hydrate + hit protein target<br>• Sleep 8h for recovery</div></div>';
    }else{
      // Exercise cards
      log.entries.forEach(function(entry,ei){
        var prev=_getLastPerformance(entry.exercise);
        var doneCount=entry.sets.filter(function(s){return s.done;}).length;
        var muscles=(EXERCISE_MUSCLES[entry.exercise]||[]).join(', ');

        html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">'+
          // Exercise header
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
            '<div style="cursor:pointer" data-hist="'+_esc(entry.exercise)+'">'+
              '<span style="font-family:var(--mono);font-size:12px;color:var(--text);font-weight:500">'+_esc(entry.exercise)+'</span>'+
              (muscles?'<div style="font-family:var(--mono);font-size:8px;color:var(--muted);margin-top:1px">'+muscles+'</div>':'')+
            '</div>'+
            '<span style="font-family:var(--mono);font-size:10px;color:var(--muted)">'+doneCount+'/'+entry.sets.length+'</span>'+
          '</div>'+
          // Previous performance
          (prev?'<div style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-bottom:8px;padding:4px 6px;background:var(--bg);border-radius:3px">Last ('+prev.date.slice(5)+'): '+
            prev.sets.map(function(s,i){return s.weight+'×'+s.reps;}).join(' · ')+'</div>':'')+
          // Set header
          '<div style="display:flex;gap:4px;padding:0 4px;margin-bottom:4px">'+
            '<span style="width:24px"></span>'+
            '<span style="flex:1;font-family:var(--mono);font-size:8px;color:var(--muted);text-align:center">WEIGHT</span>'+
            '<span style="flex:1;font-family:var(--mono);font-size:8px;color:var(--muted);text-align:center">REPS</span>'+
            '<span style="width:28px"></span>'+
          '</div>';
        // Set rows
        entry.sets.forEach(function(s,si){
          html+='<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:2px 4px;border-radius:4px;background:'+(s.done?'rgba(74,222,128,.06)':'none')+'">'+
            '<span style="font-family:var(--mono);font-size:9px;color:var(--muted);width:24px;text-align:center">'+(si+1)+'</span>'+
            '<input type="number" value="'+s.weight+'" data-ei="'+ei+'" data-si="'+si+'" data-f="weight" min="0" max="2000" step="2.5" '+
              'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:6px 4px;font-family:var(--mono);font-size:12px;color:var(--text);text-align:center;outline:none;font-weight:600">'+
            '<input type="number" value="'+s.reps+'" data-ei="'+ei+'" data-si="'+si+'" data-f="reps" min="0" max="200" '+
              'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:6px 4px;font-family:var(--mono);font-size:12px;color:var(--text);text-align:center;outline:none;font-weight:600">'+
            '<button class="str-done-btn" data-ei="'+ei+'" data-si="'+si+'" style="width:28px;height:28px;border-radius:50%;border:2px solid '+(s.done?'var(--green)':'var(--border)')+';background:'+(s.done?'rgba(74,222,128,.15)':'none')+';cursor:pointer;font-size:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center">'+
              (s.done?'✓':'')+'</button>'+
          '</div>';
        });
        // Add set button
        html+='<button class="str-add-set" data-ei="'+ei+'" style="background:none;border:1px dashed var(--border);border-radius:3px;padding:3px;font-family:var(--mono);font-size:9px;color:var(--muted);cursor:pointer;width:100%;margin-top:4px">+ Set</button>';
        html+='</div>';
      });
      // Add custom exercise
      html+='<div style="display:flex;gap:5px;margin-top:6px">'+
        '<input id="str-custom-ex" list="str-workout-list" placeholder="Add exercise..." style="flex:1;background:var(--bg);border:1px dashed var(--border);border-radius:4px;padding:6px 10px;font-family:var(--mono);font-size:10px;color:var(--text);outline:none">'+
        '<button id="str-custom-add" style="background:none;border:1px solid var(--border);border-radius:4px;padding:6px 10px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer">+</button>'+
        '</div>'+
        '<datalist id="str-workout-list">'+getAllExercises().map(function(e){return'<option value="'+e+'">';}).join('')+'</datalist>';
    }
    html+='<div id="str-rest-bar" style="display:none"></div>';
    el.innerHTML=html;
    _bindWorkout(log);
  }

  function _bindWorkout(log){
    // Done buttons
    document.querySelectorAll('.str-done-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        var ei=parseInt(btn.dataset.ei),si=parseInt(btn.dataset.si);
        var s=log.entries[ei].sets[si];
        // Read current values from inputs
        var wInp=document.querySelector('[data-ei="'+ei+'"][data-si="'+si+'"][data-f="weight"]');
        var rInp=document.querySelector('[data-ei="'+ei+'"][data-si="'+si+'"][data-f="reps"]');
        if(wInp)s.weight=parseFloat(wInp.value)||0;
        if(rInp)s.reps=parseInt(rInp.value)||0;
        s.done=!s.done;
        if(s.done){
          var isPR=_checkPR(log.entries[ei].exercise,s.reps,s.weight);
          if(isPR)_showPRPopup(log.entries[ei].exercise,s.weight,s.reps);
          _startRest();
        }
        _save();_renderWorkout();
      });
    });
    // Weight/rep inputs
    document.querySelectorAll('[data-f="weight"],[data-f="reps"]').forEach(function(inp){
      inp.addEventListener('change',function(){
        var ei=parseInt(inp.dataset.ei),si=parseInt(inp.dataset.si),f=inp.dataset.f;
        if(f==='weight')log.entries[ei].sets[si].weight=parseFloat(inp.value)||0;
        else log.entries[ei].sets[si].reps=parseInt(inp.value)||0;
        _save();
      });
    });
    // Add set
    document.querySelectorAll('.str-add-set').forEach(function(btn){
      btn.addEventListener('click',function(){
        var ei=parseInt(btn.dataset.ei);
        var last=log.entries[ei].sets.slice(-1)[0];
        log.entries[ei].sets.push({reps:last?last.reps:5,weight:last?last.weight:0,done:false});
        _save();_renderWorkout();
      });
    });
    // Custom exercise
    var addBtn=_el('str-custom-add');
    if(addBtn)addBtn.addEventListener('click',function(){
      var inp=_el('str-custom-ex');var name=inp?inp.value.trim():'';
      if(!name)return;
      var prev=_getLastPerformance(name);
      log.entries.push({exercise:name,sets:[{reps:prev?prev.sets[0].reps:5,weight:prev?prev.sets[0].weight:0,done:false}],note:''});
      if(inp)inp.value='';_save();_renderWorkout();
    });
    // Exercise history on name click
    document.querySelectorAll('[data-hist]').forEach(function(el){
      el.addEventListener('click',function(){_showHistory(el.dataset.hist);});
    });
    // AI + Save week
    var aiBtn=_el('str-ai-btn');if(aiBtn)aiBtn.addEventListener('click',function(){_getAIRecs(log);});
    var svBtn=_el('str-save-week');if(svBtn)svBtn.addEventListener('click',async function(){
      svBtn.textContent='...';var ok=await _saveWeekToVault();svBtn.textContent=ok?'✓':'⚠';
      setTimeout(function(){svBtn.textContent='💾';},2000);
    });
  }

  // ── PR celebration ────────────────────────────────────────
  function _showPRPopup(exercise,weight,reps){
    var existing=document.getElementById('str-pr-popup');if(existing)existing.remove();
    var popup=document.createElement('div');popup.id='str-pr-popup';
    popup.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:50;background:var(--surface);border:2px solid var(--green);border-radius:12px;padding:24px 32px;text-align:center;box-shadow:0 8px 32px rgba(74,222,128,.3)';
    popup.innerHTML='<div style="font-size:32px;margin-bottom:8px">🏆</div>'+
      '<div style="font-family:var(--mono);font-size:14px;color:var(--green);font-weight:700;letter-spacing:.08em;margin-bottom:6px">NEW PR!</div>'+
      '<div style="font-family:var(--mono);font-size:12px;color:var(--text)">'+_esc(exercise)+'</div>'+
      '<div style="font-family:var(--mono);font-size:18px;color:var(--accent);font-weight:700;margin-top:4px">'+weight+' lbs × '+reps+'</div>';
    _el('strength-panel').appendChild(popup);
    setTimeout(function(){if(popup.parentNode)popup.remove();},3000);
  }

  // ── Exercise history popup ────────────────────────────────
  function _showHistory(name){
    var hist=_getExerciseHistory(name,8);
    var existing=document.getElementById('str-hist-popup');if(existing)existing.remove();
    var popup=document.createElement('div');popup.id='str-hist-popup';
    popup.style.cssText='position:absolute;inset:0;z-index:50;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:16px;border-radius:14px';
    var pr=data.prs[name];
    var rows=hist.length?hist.map(function(h){
      return '<tr><td style="padding:4px 8px;color:var(--muted)">'+h.date.slice(5)+'</td>'+
        '<td style="padding:4px;text-align:center;color:var(--text)">'+h.bestWeight+'</td>'+
        '<td style="padding:4px;text-align:center;color:var(--text)">'+h.bestReps+'</td>'+
        '<td style="padding:4px;text-align:center;color:var(--muted)">'+h.sets+'</td>'+
        '<td style="padding:4px;text-align:right;color:var(--muted)">'+h.volume.toLocaleString()+'</td></tr>';
    }).join(''):'<tr><td colspan="5" style="padding:12px;text-align:center;color:var(--muted)">No history yet</td></tr>';
    popup.innerHTML='<div style="background:var(--surface);border:1px solid var(--accent);border-radius:10px;padding:16px;width:100%;max-width:360px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'+
        '<span style="font-family:var(--mono);font-size:12px;color:var(--accent)">'+_esc(name)+'</span>'+
        '<button id="str-hist-close" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px">×</button>'+
      '</div>'+
      (pr?'<div style="font-family:var(--mono);font-size:10px;color:var(--green);margin-bottom:10px">PR: '+pr.weight+'lbs × '+pr.reps+' ('+pr.date+')</div>':'')+
      '<table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:10px">'+
        '<thead><tr style="border-bottom:1px solid var(--border)">'+
          '<th style="text-align:left;padding:4px 8px;color:var(--muted);font-weight:normal">Date</th>'+
          '<th style="text-align:center;padding:4px;color:var(--muted);font-weight:normal">Best</th>'+
          '<th style="text-align:center;padding:4px;color:var(--muted);font-weight:normal">Reps</th>'+
          '<th style="text-align:center;padding:4px;color:var(--muted);font-weight:normal">Sets</th>'+
          '<th style="text-align:right;padding:4px;color:var(--muted);font-weight:normal">Vol</th></tr></thead>'+
        '<tbody>'+rows+'</tbody></table></div>';
    _el('strength-panel').appendChild(popup);
    _el('str-hist-close').addEventListener('click',function(){popup.remove();});
    popup.addEventListener('click',function(e){if(e.target===popup)popup.remove();});
  }

  // ── AI Recommendations ────────────────────────────────────
  async function _getAIRecs(log){
    var key=localStorage.getItem('baker_api_key');if(!key)return;
    var btn=_el('str-ai-btn');if(btn){btn.textContent='...';btn.disabled=true;}
    var recent=data.logs.slice(-5).map(function(l){
      return l.name+' ('+l.date+'): '+l.entries.map(function(e){
        var d=e.sets.filter(function(s){return s.done;});
        return e.exercise+' '+d.length+'x'+(d[0]?d[0].reps+'@'+d[0].weight:'');
      }).join(', ');
    }).join('\\n');
    var prs=Object.entries(data.prs).map(function(kv){return kv[0]+': '+kv[1].weight+'lbs×'+kv[1].reps;}).join(', ');
    try{
      var resp=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:400,
          messages:[{role:'user',content:'BAKER strength coach. User trains for strength (heavy, low reps), '+data.bodyweight+'lbs BW. Today: '+log.name+'. Recent:\\n'+recent+'\\nPRs: '+prs+'\\n\\nGive 3-4 specific recs for today. Weight selection, cues, progression. Concise, JARVIS tone.'}]})
      });
      var d=await resp.json();var text=d.content.map(function(b){return b.text||'';}).join('');
      _showRecModal(text);
    }catch(e){}
    if(btn){btn.textContent='◆ AI';btn.disabled=false;}
  }
  function _showRecModal(text){
    var ex=document.getElementById('str-rec-modal');if(ex)ex.remove();
    var m=document.createElement('div');m.id='str-rec-modal';
    m.style.cssText='position:absolute;inset:0;background:rgba(0,0,0,.85);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;border-radius:14px';
    m.innerHTML='<div style="background:var(--surface);border:1px solid var(--accent);border-radius:10px;padding:16px;max-width:440px;width:100%;max-height:80%;overflow-y:auto">'+
      '<div style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="font-family:var(--mono);font-size:10px;color:var(--accent);letter-spacing:.1em">◆ RECOMMENDATIONS</span>'+
      '<button id="str-rec-close" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px">×</button></div>'+
      '<div style="font-family:var(--mono);font-size:10px;color:var(--text);line-height:1.8;white-space:pre-wrap">'+_esc(text)+'</div></div>';
    _el('strength-panel').appendChild(m);
    _el('str-rec-close').addEventListener('click',function(){m.remove();});
    m.addEventListener('click',function(e){if(e.target===m)m.remove();});
  }

  // ── MAP TAB ───────────────────────────────────────────────
  function _renderMap(){
    var el=_el('str-map-content');if(!el)return;
    var theme=typeof FALLOUT!=='undefined'?FALLOUT.getTheme():'none';
    function hc(m){
      var h=_muscleHeat(m);if(h<0.01)return'rgba(255,255,255,0.04)';
      var a=0.15+h*0.75;
      if(theme==='pipboy')return'rgba(57,255,20,'+a.toFixed(2)+')';
      if(theme==='enclave')return'rgba(200,30,0,'+a.toFixed(2)+')';
      if(theme==='bos')return'rgba(200,160,60,'+a.toFixed(2)+')';
      if(theme==='ncr')return'rgba(200,160,90,'+a.toFixed(2)+')';
      if(theme==='vaulttec')return'rgba(245,196,0,'+a.toFixed(2)+')';
      return'rgba(124,106,247,'+a.toFixed(2)+')';
    }
    var totalHeat=0,count=0;
    ['chest','front-delts','side-delts','biceps','triceps','abs','quads','calves','lats','traps','hamstrings','glutes'].forEach(function(m){totalHeat+=_muscleHeat(m);count++;});
    var recovery=1-(totalHeat/count);
    var acc='var(--accent)';

    el.innerHTML='<div style="display:flex;gap:14px">'+
      '<div style="width:90px;flex-shrink:0;text-align:center">'+
        '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);letter-spacing:.08em;margin-bottom:4px">RECOVERY</div>'+
        '<div style="width:80px;height:120px;margin:0 auto">'+_getFactionChar(theme,recovery)+'</div>'+
        '<div style="font-family:var(--mono);font-size:11px;color:var(--accent);margin-top:4px">'+Math.round(recovery*100)+'%</div>'+
        '<div style="font-family:var(--mono);font-size:8px;color:var(--muted)">'+
          (recovery>0.75?'Fresh':recovery>0.5?'Good':recovery>0.25?'Fatigued':'Destroyed')+'</div>'+
        '<div style="margin-top:10px;width:70px;margin-left:auto;margin-right:auto">'+
          '<div style="font-family:var(--mono);font-size:7px;color:var(--muted);margin-bottom:3px">SORENESS</div>'+
          '<div style="height:6px;border-radius:3px;background:linear-gradient(to right,rgba(255,255,255,0.04),'+acc+');border:1px solid var(--border)"></div>'+
          '<div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:6px;color:var(--muted);margin-top:1px"><span>None</span><span>Peak</span></div>'+
        '</div></div>'+
      '<div style="flex:1;overflow:auto">'+
        '<svg viewBox="0 0 200 320" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-height:380px">'+
        '<text x="52" y="14" font-size="7" fill="var(--muted)" font-family="var(--mono)" text-anchor="middle">FRONT</text>'+
        '<text x="152" y="14" font-size="7" fill="var(--muted)" font-family="var(--mono)" text-anchor="middle">BACK</text>'+
        '<line x1="100" y1="10" x2="100" y2="310" stroke="var(--border)" stroke-width="1" opacity="0.3"/>'+
        // FRONT: head, traps, chest, delts, biceps, triceps, forearms, abs, quads, calves
        '<ellipse cx="52" cy="30" rx="12" ry="14" fill="var(--surface2)" stroke="'+acc+'" stroke-width="0.6" opacity="0.5"/>'+
        '<ellipse cx="35" cy="52" rx="9" ry="5" fill="'+hc('traps')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<ellipse cx="69" cy="52" rx="9" ry="5" fill="'+hc('traps')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<ellipse cx="44" cy="68" rx="14" ry="11" fill="'+hc('chest')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<ellipse cx="60" cy="68" rx="14" ry="11" fill="'+hc('chest')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<circle cx="30" cy="60" r="6" fill="'+hc('front-delts')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<circle cx="74" cy="60" r="6" fill="'+hc('front-delts')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<ellipse cx="24" cy="60" rx="4" ry="8" fill="'+hc('side-delts')+'" stroke="'+acc+'" stroke-width="0.5"/>'+
        '<ellipse cx="80" cy="60" rx="4" ry="8" fill="'+hc('side-delts')+'" stroke="'+acc+'" stroke-width="0.5"/>'+
        '<ellipse cx="22" cy="84" rx="5" ry="10" fill="'+hc('biceps')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<ellipse cx="82" cy="84" rx="5" ry="10" fill="'+hc('biceps')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<ellipse cx="20" cy="104" rx="4" ry="9" fill="'+hc('forearms')+'" stroke="'+acc+'" stroke-width="0.5"/>'+
        '<ellipse cx="84" cy="104" rx="4" ry="9" fill="'+hc('forearms')+'" stroke="'+acc+'" stroke-width="0.5"/>'+
        '<rect x="42" y="82" width="20" height="32" rx="3" fill="'+hc('abs')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<line x1="42" y1="94" x2="62" y2="94" stroke="'+acc+'" stroke-width="0.4" opacity="0.3"/>'+
        '<line x1="42" y1="106" x2="62" y2="106" stroke="'+acc+'" stroke-width="0.4" opacity="0.3"/>'+
        '<line x1="52" y1="82" x2="52" y2="114" stroke="'+acc+'" stroke-width="0.4" opacity="0.3"/>'+
        '<ellipse cx="43" cy="140" rx="11" ry="22" fill="'+hc('quads')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<ellipse cx="61" cy="140" rx="11" ry="22" fill="'+hc('quads')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<ellipse cx="43" cy="185" rx="7" ry="14" fill="'+hc('calves')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<ellipse cx="61" cy="185" rx="7" ry="14" fill="'+hc('calves')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        // BACK: traps, lats, mid-back, lower-back, rear-delts, triceps, glutes, hamstrings, calves
        '<ellipse cx="152" cy="30" rx="12" ry="14" fill="var(--surface2)" stroke="'+acc+'" stroke-width="0.6" opacity="0.5"/>'+
        '<ellipse cx="152" cy="56" rx="20" ry="9" fill="'+hc('traps')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<circle cx="132" cy="60" r="6" fill="'+hc('rear-delts')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<circle cx="172" cy="60" r="6" fill="'+hc('rear-delts')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<ellipse cx="140" cy="82" rx="11" ry="16" fill="'+hc('lats')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<ellipse cx="164" cy="82" rx="11" ry="16" fill="'+hc('lats')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<rect x="143" y="73" width="18" height="18" rx="3" fill="'+hc('mid-back')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<rect x="144" y="93" width="16" height="16" rx="3" fill="'+hc('lower-back')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<ellipse cx="126" cy="84" rx="4" ry="10" fill="'+hc('triceps')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<ellipse cx="178" cy="84" rx="4" ry="10" fill="'+hc('triceps')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<ellipse cx="143" cy="122" rx="12" ry="11" fill="'+hc('glutes')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<ellipse cx="161" cy="122" rx="12" ry="11" fill="'+hc('glutes')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<ellipse cx="143" cy="150" rx="10" ry="20" fill="'+hc('hamstrings')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<ellipse cx="161" cy="150" rx="10" ry="20" fill="'+hc('hamstrings')+'" stroke="'+acc+'" stroke-width="0.7"/>'+
        '<ellipse cx="143" cy="185" rx="7" ry="14" fill="'+hc('calves')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '<ellipse cx="161" cy="185" rx="7" ry="14" fill="'+hc('calves')+'" stroke="'+acc+'" stroke-width="0.6"/>'+
        '</svg></div></div>';
  }

  // ── SCORE TAB ─────────────────────────────────────────────
  function _renderScore(){
    var el=_el('str-score-content');if(!el)return;
    var score=_calcScore(),vol=_calcWeeklyVolume(),bw=data.bodyweight;
    var scoreColor=score>=800?'var(--green)':score>=600?'var(--amber)':score>=400?'var(--blue)':'var(--muted)';
    var scoreLbl=score>=900?'Elite':score>=800?'Advanced':score>=600?'Intermediate':score>=400?'Novice':'Beginner';

    var html='<div style="text-align:center;padding:12px 0 20px">'+
      '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);letter-spacing:.12em;margin-bottom:6px">STRENGTH SCORE</div>'+
      '<div style="font-size:48px;font-weight:700;color:'+scoreColor+';font-family:var(--mono);line-height:1;text-shadow:0 0 16px '+scoreColor+'44">'+score+'</div>'+
      '<div style="font-family:var(--mono);font-size:11px;color:'+scoreColor+';margin-top:4px;letter-spacing:.1em">'+scoreLbl+'</div>'+
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:3px">'+bw+'lbs BW</div></div>'+
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px;text-align:center">'+
        '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);letter-spacing:.1em;margin-bottom:4px">WEEKLY VOLUME</div>'+
        '<div style="font-size:20px;font-weight:700;color:var(--accent);font-family:var(--mono)">'+vol.toLocaleString()+' <span style="font-size:11px">lbs</span></div></div>'+
      '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);letter-spacing:.1em;margin-bottom:6px">LIFT PRs & RATIOS</div>';
    KEY_LIFTS.forEach(function(lift){
      var pr=data.prs[lift],norm=STRENGTH_NORMS[lift]||1.5;
      var ratio=pr?(pr.weight/bw):0;
      var pct=Math.min(100,Math.round((ratio/norm)*100));
      var barColor=pct>=100?'var(--green)':pct>=75?'var(--accent)':pct>=50?'var(--amber)':'var(--muted)';
      html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:6px">'+
        '<div style="display:flex;justify-content:space-between;margin-bottom:4px">'+
          '<span style="font-size:10px;color:var(--text)">'+lift+'</span>'+
          (pr?'<span style="font-family:var(--mono);font-size:10px;color:var(--accent)">'+pr.weight+'×'+pr.reps+'</span>':'<span style="font-size:9px;color:var(--muted)">—</span>')+
        '</div>'+
        '<div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+barColor+';border-radius:2px"></div></div>'+
        '<div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:8px;color:var(--muted);margin-top:2px">'+
          '<span>'+ratio.toFixed(2)+'× BW</span><span>Target: '+norm+'× ('+Math.round(norm*bw)+')</span></div></div>';
    });
    el.innerHTML=html;
  }

  // ── COACH TAB ────────────────────────────────────────────────
  var _coachCache=null;
  var _coachCacheDate=null;

  function _renderCoach(){
    var el=_el('str-coach-content');if(!el)return;
    var log=_getTodayLog();
    var totalVol=_calcWeeklyVolume();
    var score=_calcScore();
    var weekLogs=data.logs.filter(function(l){return l.date>=_weekStart();});

    el.innerHTML=
      // Header stats
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">'+
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px;text-align:center">'+
          '<div style="font-family:var(--mono);font-size:16px;font-weight:700;color:var(--accent)">'+score+'</div>'+
          '<div style="font-family:var(--mono);font-size:8px;color:var(--muted)">SCORE</div></div>'+
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px;text-align:center">'+
          '<div style="font-family:var(--mono);font-size:16px;font-weight:700;color:var(--green)">'+weekLogs.length+'</div>'+
          '<div style="font-family:var(--mono);font-size:8px;color:var(--muted)">SESSIONS</div></div>'+
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px;text-align:center">'+
          '<div style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--amber)">'+Math.round(totalVol/1000)+'k</div>'+
          '<div style="font-family:var(--mono);font-size:8px;color:var(--muted)">LBS LIFTED</div></div>'+
      '</div>'+
      // Weekly targets
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">'+
        '<div style="font-family:var(--mono);font-size:9px;color:var(--accent);letter-spacing:.1em;margin-bottom:8px">WEEKLY TARGETS</div>'+
        ['Bench Press','Squat','Deadlift'].map(function(lift){
          var pr=data.prs[lift];
          var norm=STRENGTH_NORMS[lift]||1.5;
          var target=Math.round(data.bodyweight*norm/5)*5;
          var current=pr?pr.weight:0;
          var pct=Math.min(100,Math.round((current/target)*100));
          return'<div style="margin-bottom:6px">'+
            '<div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;margin-bottom:3px">'+
              '<span style="color:var(--text)">'+lift+'</span>'+
              '<span style="color:var(--muted)">'+current+' / '+target+' lbs</span></div>'+
            '<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">'+
              '<div style="height:100%;width:'+pct+'%;background:'+(pct>=100?'var(--green)':pct>=75?'var(--accent)':'var(--amber)')+';border-radius:2px"></div>'+
            '</div></div>';
        }).join('')+
      '</div>'+
      // Training notes
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">'+
        '<div style="font-family:var(--mono);font-size:9px;color:var(--accent);letter-spacing:.1em;margin-bottom:6px">TRAINING NOTES</div>'+
        '<textarea id="str-coach-notes" rows="3" placeholder="Notes, cues, reminders..." style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px;font-family:var(--mono);font-size:10px;color:var(--text);resize:none;outline:none;box-sizing:border-box">'+
          (localStorage.getItem('baker_strength_notes')||'')+'</textarea>'+
      '</div>'+
      // AI Coach
      '<button id="str-coach-btn" style="width:100%;background:none;border:1px solid var(--accent-dim);border-radius:6px;padding:10px;font-family:var(--mono);font-size:11px;color:var(--accent);cursor:pointer;margin-bottom:8px">◆ Get Coaching Recommendations</button>'+
      '<div id="str-coach-output" style="font-family:var(--mono);font-size:10px;color:var(--text);line-height:1.8;white-space:pre-wrap">'+
        (_coachCache&&_coachCacheDate===_today()?_coachCache:'')+'</div>';

    // Notes autosave
    var notesEl=_el('str-coach-notes');
    if(notesEl)notesEl.addEventListener('input',function(){localStorage.setItem('baker_strength_notes',this.value);});

    var coachBtn=_el('str-coach-btn');
    if(coachBtn)coachBtn.addEventListener('click',function(){_runCoach(log);});
  }

  async function _runCoach(log){
    var key=localStorage.getItem('baker_api_key');if(!key)return;
    var btn=_el('str-coach-btn');var out=_el('str-coach-output');
    if(btn){btn.textContent='◆ Analyzing...';btn.disabled=true;}
    if(out)out.textContent='';
    var recent=data.logs.slice(-7).map(function(l){
      return l.name+' ('+l.date+'): '+l.entries.map(function(e){
        var d=e.sets.filter(function(s){return s.done;});
        return d.length?e.exercise+' '+d.length+'×'+(d[0]?d[0].reps+'@'+d[0].weight+'lbs':''):null;
      }).filter(Boolean).join(', ');
    }).filter(Boolean).join('\n');
    var prsStr=Object.entries(data.prs).slice(0,10).map(function(kv){return kv[0]+': '+kv[1].weight+'lbs×'+kv[1].reps;}).join(', ');
    var notes=localStorage.getItem('baker_strength_notes')||'';
    try{
      var resp=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:600,
          messages:[{role:'user',content:
            'You are BAKER, a personal strength coach AI in JARVIS style. Give specific, actionable coaching.'+
            '\n\nBodyweight: '+data.bodyweight+'lbs | Score: '+_calcScore()+' | Weekly Volume: '+_calcWeeklyVolume().toLocaleString()+'lbs'+
            '\nToday: '+log.name+
            '\nRecent sessions:\n'+recent+
            '\nPRs: '+prsStr+
            (notes?'\nNotes: '+notes:'')+
            '\n\nProvide: 1) Today focus (2-3 sentences) 2) Specific weights/reps to hit 3) One technical cue per main lift 4) Recovery tip 5) Weekly goal. Be specific with numbers. JARVIS tone. Call user sir.'}]})
      });
      var d=await resp.json();
      var text=d.content.map(function(b){return b.text||'';}).join('').trim();
      _coachCache=text;_coachCacheDate=_today();
      if(out)out.textContent=text;
    }catch(e){if(out)out.textContent='Analysis failed: '+e.message;}
    if(btn){btn.textContent='◆ Get Coaching Recommendations';btn.disabled=false;}
  }

    // ── Panel ─────────────────────────────────────────────────
  function showPanel(){var p=_el('strength-panel');if(!p)return;p.classList.add('str-vis');if(p._wbNormalise)p._wbNormalise();render();}
  function hidePanel(){_el('strength-panel').classList.remove('str-vis');_stopRest();}
  function togglePanel(){var p=_el('strength-panel');p.classList.toggle('str-vis');if(p.classList.contains('str-vis')){if(p._wbNormalise)p._wbNormalise();render();}}
  function switchTab(tab){currentTab=tab;render();}
  function handleVoice(cmd){
    var c=cmd.toLowerCase();
    if(/\b(open|show|launch)\b.*\b(strength|workout|gym|training)\b/.test(c)){showPanel();return'Strength panel open, sir.';}
    if(/\b(log|start)\b.*\bworkout\b/.test(c)){showPanel();switchTab('workout');return"Today's workout, sir.";}
    if(/\b(muscle map|heat map|recovery)\b/.test(c)){showPanel();switchTab('map');return'Recovery map, sir.';}
    if(/\bstrength score\b/.test(c)){showPanel();switchTab('score');return'Score is '+_calcScore()+', sir.';}
    return null;
  }
  function importData(imported){
    if(!imported)return;
    if(imported.split&&imported.split.length)data.split=imported.split;
    if(imported.bodyweight)data.bodyweight=imported.bodyweight;
    if(imported.prs)data.prs=Object.assign({},imported.prs,data.prs);
    _save();render();
  }
  function init(){_load();}

  return{init,showPanel,hidePanel,togglePanel,switchTab,handleVoice,importData,_skipRest:_skipRest};
})();  // ── MAP TAB ───────────────────────────────────────────────────
  var _mapMode='soreness'; // 'soreness' | 'strength'

  function _renderMap(){
    var el=_el('str-map-content');if(!el)return;
    var theme=typeof FALLOUT!=='undefined'?FALLOUT.getTheme():'baker';

    function heatFn(muscle){
      if(_mapMode==='strength'){
        // Strength: PR weight / (bodyweight * norm) capped at 1
        var prList={
          'chest':['Bench Press','Incline Bench','DB Fly','Cable Fly','Close Grip Bench','Dips','Push Up','Decline Bench'],
          'front-delts':['Overhead Press','Front Raise'],
          'side-delts':['DB Lateral Raise','Cable Lateral Raise'],
          'rear-delts':['Face Pull'],
          'traps':['Shrug','Deadlift','Barbell Row','Overhead Press'],
          'lats':['Lat Pulldown','Pull Up','Barbell Row','Cable Row','DB Row','Chin Up'],
          'mid-back':['Barbell Row','Cable Row','Pendlay Row'],
          'lower-back':['Deadlift','Romanian Deadlift'],
          'biceps':['Barbell Curl','DB Curl','Hammer Curl','Chin Up','Preacher Curl'],
          'triceps':['Tricep Pushdown','Skull Crusher','Close Grip Bench','Dips','Overhead Tricep Extension'],
          'forearms':['Farmer Carry','Hammer Curl'],
          'abs':['Plank','Ab Wheel','Cable Crunch'],
          'obliques':['Russian Twist'],
          'quads':['Squat','Leg Press','Leg Extension','Hack Squat','Goblet Squat','Bulgarian Split Squat'],
          'hamstrings':['Romanian Deadlift','Leg Curl','Deadlift'],
          'glutes':['Hip Thrust','Squat','Bulgarian Split Squat'],
          'calves':['Calf Raise','Seated Calf Raise']
        };
        var lifts=prList[muscle]||[];
        var best=0;
        lifts.forEach(function(l){
          var pr=data.prs[l];
          if(!pr)return;
          var norm=STRENGTH_NORMS[l]||(data.bodyweight*1.2);
          var ratio=pr.weight/(data.bodyweight*1.5);
          best=Math.max(best,Math.min(1,ratio));
        });
        return best;
      }
      return _muscleHeat(muscle);
    }

    var totalHeat=0,count=0;
    ['chest','front-delts','side-delts','biceps','triceps','abs','quads','calves','lats','traps','hamstrings','glutes'].forEach(function(m){totalHeat+=_muscleHeat(m);count++;});
    var recovery=1-(totalHeat/count);
    var recColor=recovery>0.75?'var(--green)':recovery>0.4?'var(--amber)':'var(--red)';

    // Build active legend
    var MUSCLE_LABELS={'chest':'Chest','front-delts':'Front Delt','side-delts':'Side Delt','rear-delts':'Rear Delt',
      'traps':'Traps','lats':'Lats','mid-back':'Mid Back','lower-back':'Lower Back',
      'biceps':'Biceps','triceps':'Triceps','forearms':'Forearms',
      'abs':'Abs','obliques':'Obliques','glutes':'Glutes','quads':'Quads',
      'hamstrings':'Hamstrings','calves':'Calves'};
    var activeMuscles=Object.keys(MUSCLE_LABELS).filter(function(m){return heatFn(m)>0.01;});

    var mapHtml=typeof STRENGTH_MAPS!=='undefined'
      ?STRENGTH_MAPS.render(theme,heatFn,_mapMode,190,320)
      :'<div style="font-family:var(--mono);font-size:10px;color:var(--muted);padding:20px">Map loading...</div>';

    el.innerHTML=
      // Controls row
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
        '<div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--muted)">'+
          (theme.toUpperCase())+' — '+(_mapMode==='soreness'?'SORENESS':'STRENGTH')+'</div>'+
        '<div style="display:flex;gap:5px">'+
          '<button id="str-map-sor" style="background:'+(_mapMode==='soreness'?'var(--accent-dim)':'none')+';border:1px solid '+(_mapMode==='soreness'?'var(--accent)':'var(--border)')+';border-radius:4px;padding:3px 8px;font-family:var(--mono);font-size:9px;color:'+(_mapMode==='soreness'?'var(--accent)':'var(--muted)')+';cursor:pointer">Soreness</button>'+
          '<button id="str-map-str" style="background:'+(_mapMode==='strength'?'var(--accent-dim)':'none')+';border:1px solid '+(_mapMode==='strength'?'var(--accent)':'var(--border)')+';border-radius:4px;padding:3px 8px;font-family:var(--mono);font-size:9px;color:'+(_mapMode==='strength'?'var(--accent)':'var(--muted)')+';cursor:pointer">Strength</button>'+
        '</div>'+
      '</div>'+
      // Recovery bar
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'+
        '<span style="font-family:var(--mono);font-size:9px;color:var(--muted)">Recovery</span>'+
        '<div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden">'+
          '<div style="height:100%;width:'+Math.round(recovery*100)+'%;background:'+recColor+';border-radius:2px"></div>'+
        '</div>'+
        '<span style="font-family:var(--mono);font-size:10px;color:'+recColor+'">'+Math.round(recovery*100)+'%</span>'+
      '</div>'+
      // Map SVG
      '<div style="display:flex;justify-content:center">'+mapHtml+'</div>'+
      // Legend
      (activeMuscles.length?
        '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">'+
        activeMuscles.map(function(m){
          var h=heatFn(m);
          var pct=Math.round(h*100);
          var col=_mapMode==='soreness'?
            (h<0.33?'#60a5fa':h<0.66?'#fb923c':'#f87171'):
            (h<0.33?'#60a5fa':h<0.66?'#a78bfa':'#fbbf24');
          return'<span style="font-family:var(--mono);font-size:8px;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-left:2px solid '+col+';border-radius:3px;padding:2px 5px">'+
            MUSCLE_LABELS[m]+' '+pct+'%</span>';
        }).join('')+'</div>':'');

    // Bind toggle buttons
    var sorBtn=_el('str-map-sor'),strBtn=_el('str-map-str');
    if(sorBtn)sorBtn.addEventListener('click',function(){_mapMode='soreness';_renderMap();});
    if(strBtn)strBtn.addEventListener('click',function(){_mapMode='strength';_renderMap();});
  }
