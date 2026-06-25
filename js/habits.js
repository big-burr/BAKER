// ═══════════════════════════════════════════════════════════
// ══  HABITS MODULE  ════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Daily habit tracker — tap or voice to check off
// Layout: Today view + Weekly overview tabs
// Vault: weekly log to 07-System/Habits/
// Morning nudge once per day if habits unchecked
// ═══════════════════════════════════════════════════════════
var HABITS=(function(){

  var LS_KEY='baker_habits_v1';
  var PANEL_ID='habits-panel';

  // data = { habits:[{id,name,emoji,color}], log:{YYYY-MM-DD:{habitId:bool}} }
  var data={habits:[],log:{}};
  var currentTab='today';

  var COLORS=['#7c6af7','#60a5fa','#4ade80','#f59e0b','#f87171','#c084fc','#38bdf8','#fb923c'];
  var DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // ── Storage ───────────────────────────────────────────────
  function _load(){
    try{var r=localStorage.getItem(LS_KEY);if(r)data=JSON.parse(r);}
    catch(e){data={habits:[],log:{}};}
    if(!data.habits)data.habits=[];
    if(!data.log)data.log={};
  }
  function _save(){
    // Prune log older than 90 days
    var cutoff=new Date();cutoff.setDate(cutoff.getDate()-90);
    var cs=cutoff.toISOString().slice(0,10);
    Object.keys(data.log).forEach(function(d){if(d<cs)delete data.log[d];});
    try{localStorage.setItem(LS_KEY,JSON.stringify(data));}catch(e){}
    _checkWeeklyVaultSave();
  }

  function _id(){return 'h'+Date.now().toString(36)+Math.random().toString(36).slice(2,4);}
  function _today(){return new Date().toISOString().slice(0,10);}
  function _weekStart(){
    var d=new Date();d.setDate(d.getDate()-d.getDay());
    return d.toISOString().slice(0,10);
  }

  // ── Vault save ────────────────────────────────────────────
  var _lastVaultSave='';
  async function _checkWeeklyVaultSave(){
    var ws=_weekStart();
    if(_lastVaultSave===ws)return;
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return;
    try{
      var md='---\ntype: habit-log\nweek: '+ws+'\n---\n\n# Habit Log — Week of '+ws+'\n\n';
      // Build 7-day table
      var days=[];
      for(var i=0;i<7;i++){
        var d=new Date(ws+'T12:00:00');
        d.setDate(d.getDate()+i);
        days.push(d.toISOString().slice(0,10));
      }
      md+='| Habit | '+days.map(function(d){return DAYS[new Date(d+'T12:00:00').getDay()];}).join(' | ')+' | Score |\n';
      md+='|---|'+days.map(function(){return'---';}).join('|')+'|---|\n';
      data.habits.forEach(function(h){
        var row='| '+(h.emoji||'')+ ' '+h.name+' |';
        var score=0;
        days.forEach(function(d){
          var done=data.log[d]&&data.log[d][h.id];
          row+=' '+(done?'✓':'·')+' |';
          if(done)score++;
        });
        row+=' '+score+'/7 |\n';
        md+=row;
      });
      var dir=vaultHandle;
      dir=await dir.getDirectoryHandle('07-System',{create:true});
      dir=await dir.getDirectoryHandle('Habits',{create:true});
      var fh=await dir.getFileHandle('habits-week-'+ws+'.md',{create:true});
      var w=await fh.createWritable();await w.write(md);await w.close();
      _lastVaultSave=ws;
      if(typeof spawnBirthParticle==='function')
        spawnBirthParticle('system','07-System/Habits/habits-week-'+ws+'.md');
    }catch(e){console.error('[HABITS] vault:',e);}
  }

  // ── Morning nudge ─────────────────────────────────────────
  function checkMorningNudge(){
    if(!data.habits.length)return;
    var nudgeKey='baker_habits_nudge_'+_today();
    if(localStorage.getItem(nudgeKey))return;
    var h=new Date().getHours();
    if(h<8||h>11)return;
    var todayLog=data.log[_today()]||{};
    var anyDone=data.habits.some(function(h){return todayLog[h.id];});
    if(!anyDone){
      localStorage.setItem(nudgeKey,'1');
      setTimeout(function(){
        if(typeof speakResponse==='function')
          speakResponse("Don't forget your habits, sir.");
      },4000);
    }
  }

  // ── Completion stats ──────────────────────────────────────
  function _todayScore(){
    var log=data.log[_today()]||{};
    var done=data.habits.filter(function(h){return log[h.id];}).length;
    return{done:done,total:data.habits.length};
  }
  function _weekScore(habitId){
    var ws=_weekStart();var score=0;
    for(var i=0;i<7;i++){
      var d=new Date(ws+'T12:00:00');d.setDate(d.getDate()+i);
      var ds=d.toISOString().slice(0,10);
      if(data.log[ds]&&data.log[ds][habitId])score++;
    }
    return score;
  }
  function _streak(habitId){
    var streak=0;
    var d=new Date();
    while(streak<365){
      var ds=d.toISOString().slice(0,10);
      if(data.log[ds]&&data.log[ds][habitId])streak++;
      else if(ds!==_today())break;
      d.setDate(d.getDate()-1);
    }
    return streak;
  }

  // ── Render ────────────────────────────────────────────────
  function render(){
    var panel=document.getElementById(PANEL_ID);
    if(!panel||!panel.classList.contains('hab-vis'))return;
    ['today','week'].forEach(function(t){
      var btn=document.getElementById('hab-tab-'+t);
      if(btn)btn.classList.toggle('active',t===currentTab);
    });
    var body=document.getElementById('hab-body');
    if(!body)return;
    if(currentTab==='today')_renderToday(body);
    else _renderWeek(body);
  }

  function _renderToday(body){
    var today=_today();
    var todayLog=data.log[today]||{};
    var score=_todayScore();
    var pct=score.total?Math.round((score.done/score.total)*100):0;

    var html='<div style="margin-bottom:14px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
        '<span style="font-family:var(--mono);font-size:10px;color:var(--muted)">TODAY\'S PROGRESS</span>'+
        '<span style="font-family:var(--mono);font-size:11px;color:var(--accent)">'+score.done+'/'+score.total+'</span>'+
      '</div>'+
      '<div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">'+
        '<div style="height:100%;width:'+pct+'%;background:var(--accent);border-radius:3px;transition:width .4s ease"></div>'+
      '</div></div>';

    if(!data.habits.length){
      html+='<div style="font-family:var(--mono);font-size:11px;color:var(--muted);padding:16px;text-align:center">'+
        'No habits yet.<br><br>Add your first habit below.</div>';
    }else{
      html+='<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">';
      data.habits.forEach(function(h){
        var done=!!todayLog[h.id];
        var streak=_streak(h.id);
        html+='<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;'+
          'background:var(--surface);border:1px solid '+(done?h.color:'var(--border)')+';border-radius:8px;'+
          'border-left:3px solid '+h.color+';cursor:pointer;transition:all .15s" '+
          'class="hab-item" data-id="'+h.id+'">'+
          '<div style="width:28px;height:28px;border-radius:50%;border:2px solid '+h.color+';'+
            'background:'+(done?h.color:'none')+';display:flex;align-items:center;justify-content:center;'+
            'flex-shrink:0;font-size:14px;transition:all .15s">'+
            (done?'<span style="color:white">&#10003;</span>':'')+'</div>'+
          '<div style="flex:1">'+
            '<div style="font-family:var(--mono);font-size:12px;color:'+(done?'var(--muted)':'var(--text)')+';'+
              (done?'text-decoration:line-through':'')+'">'+
              (h.emoji?h.emoji+' ':'')+h.name+'</div>'+
            (streak>1?'<div style="font-family:var(--mono);font-size:9px;color:var(--amber);margin-top:2px">'+
              '&#128293; '+streak+' day streak</div>':'')+'</div>'+
          '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);text-align:right">'+
            _weekScore(h.id)+'/7 this week</div>'+
          '</div>';
      });
      html+='</div>';
    }

    // Add habit form
    html+='<div style="display:flex;gap:6px;align-items:center;padding-top:10px;border-top:1px solid var(--border)">'+
      '<input id="hab-emoji" placeholder="☀️" style="width:38px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px;font-size:16px;text-align:center;outline:none">'+
      '<input id="hab-name" placeholder="Add habit..." style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none">'+
      '<button id="hab-add" style="background:none;border:1px solid var(--accent-dim);border-radius:4px;padding:5px 10px;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer">+</button>'+
      '</div>';

    body.innerHTML=html;
    _bindToday(todayLog,today);
  }

  function _bindToday(todayLog,today){
    // Tap to toggle
    document.querySelectorAll('.hab-item').forEach(function(item){
      item.addEventListener('click',function(){
        var id=item.dataset.id;
        if(!data.log[today])data.log[today]={};
        data.log[today][id]=!data.log[today][id];
        _save();render();
      });
    });
    // Add habit
    var addBtn=document.getElementById('hab-add');
    if(addBtn)addBtn.addEventListener('click',_addHabit);
    var nameInp=document.getElementById('hab-name');
    if(nameInp)nameInp.addEventListener('keydown',function(e){if(e.key==='Enter')_addHabit();});
  }

  function _addHabit(){
    var nameInp=document.getElementById('hab-name');
    var emojiInp=document.getElementById('hab-emoji');
    var name=nameInp?nameInp.value.trim():'';
    if(!name)return;
    var emoji=emojiInp?emojiInp.value.trim():'';
    data.habits.push({
      id:_id(),name:name,emoji:emoji,
      color:COLORS[data.habits.length%COLORS.length]
    });
    if(nameInp)nameInp.value='';
    if(emojiInp)emojiInp.value='';
    _save();render();
  }

  function _renderWeek(body){
    var ws=_weekStart();
    var days=[];
    for(var i=0;i<7;i++){
      var d=new Date(ws+'T12:00:00');d.setDate(d.getDate()+i);
      days.push(d.toISOString().slice(0,10));
    }
    var todayStr=_today();

    var html='<div style="overflow-x:auto">'+
      '<table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:10px">'+
      '<thead><tr>'+
        '<th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:normal;min-width:110px">HABIT</th>'+
        days.map(function(d){
          var isToday=d===todayStr;
          return'<th style="text-align:center;padding:6px 4px;color:'+(isToday?'var(--accent)':'var(--muted)')+';font-weight:'+(isToday?'700':'normal')+'">'+
            DAYS[new Date(d+'T12:00:00').getDay()]+'<br>'+
            '<span style="font-size:8px">'+d.slice(5)+'</span></th>';
        }).join('')+
        '<th style="text-align:center;padding:6px 4px;color:var(--muted)">Score</th>'+
      '</tr></thead><tbody>';

    data.habits.forEach(function(h){
      html+='<tr style="border-top:1px solid var(--border)">'+
        '<td style="padding:8px;color:var(--text)">'+(h.emoji?h.emoji+' ':'')+h.name+'</td>';
      var score=0;
      days.forEach(function(d){
        var done=data.log[d]&&data.log[d][h.id];
        if(done)score++;
        var isToday=d===todayStr;
        html+='<td style="text-align:center;padding:4px" class="hab-week-cell" data-date="'+d+'" data-id="'+h.id+'">'+
          '<div style="width:24px;height:24px;border-radius:50%;margin:0 auto;cursor:pointer;'+
          'background:'+(done?h.color:'var(--surface2)')+';border:1px solid '+(done?h.color:'var(--border)')+';'+
          'display:flex;align-items:center;justify-content:center;font-size:10px;'+
          (isToday?'box-shadow:0 0 6px '+h.color+'44;':'')+'">'+
          (done?'<span style="color:white;font-weight:700">✓</span>':'')+'</div></td>';
      });
      var pct=Math.round((score/7)*100);
      html+='<td style="text-align:center;padding:8px">'+
        '<div style="font-size:11px;color:'+(score>=5?'var(--green)':score>=3?'var(--amber)':'var(--muted)')+'">'+score+'/7</div>'+
        '<div style="height:3px;background:var(--border);border-radius:2px;margin-top:3px;overflow:hidden">'+
          '<div style="height:100%;width:'+pct+'%;background:'+h.color+';border-radius:2px"></div>'+
        '</div></td></tr>';
    });

    // Manage row
    html+='<tr style="border-top:1px solid var(--border)"><td colspan="9" style="padding:8px">'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    data.habits.forEach(function(h){
      html+='<div style="display:flex;align-items:center;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:3px 8px">'+
        '<span style="width:8px;height:8px;border-radius:50%;background:'+h.color+';display:inline-block"></span>'+
        '<span style="font-family:var(--mono);font-size:10px;color:var(--muted)">'+h.name+'</span>'+
        '<button class="hab-del" data-id="'+h.id+'" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;padding:0 2px">&#215;</button>'+
        '</div>';
    });
    html+='</div></td></tr>';
    html+='</tbody></table></div>';

    body.innerHTML=html;

    // Week cell toggle
    document.querySelectorAll('.hab-week-cell').forEach(function(cell){
      cell.addEventListener('click',function(){
        var d=cell.dataset.date,id=cell.dataset.id;
        if(!data.log[d])data.log[d]={};
        data.log[d][id]=!data.log[d][id];
        _save();render();
      });
    });
    // Delete
    document.querySelectorAll('.hab-del').forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        if(!confirm('Delete this habit?'))return;
        data.habits=data.habits.filter(function(h){return h.id!==btn.dataset.id;});
        _save();render();
      });
    });
  }

  // ── Panel ─────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    p.classList.add('hab-vis');
    if(p._wbNormalise)p._wbNormalise();
    render();
  }
  function hidePanel(){var p=document.getElementById(PANEL_ID);if(p)p.classList.remove('hab-vis');}
  function togglePanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    if(p.classList.contains('hab-vis'))hidePanel();else showPanel();
  }
  function switchTab(t){currentTab=t;render();}

  // ── Voice ─────────────────────────────────────────────────
  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(/\b(open|show|habits?|tracker)\b.*\b(habit|tracker|habits)\b|\bhabit tracker\b/.test(c)){
      showPanel();return'Here are your habits, sir.';
    }
    // "mark [habit] done" / "did my [habit]" / "[habit] done"
    var markM=c.match(/(?:mark|log|did|completed?|finished?|done)\s+(?:my\s+)?(.+?)(?:\s+done|\s+complete[d]?)?$/);
    if(markM){
      var habitName=markM[1].trim();
      var match=data.habits.find(function(h){
        return h.name.toLowerCase().includes(habitName)||habitName.includes(h.name.toLowerCase());
      });
      if(match){
        var today=_today();
        if(!data.log[today])data.log[today]={};
        data.log[today][match.id]=true;
        _save();render();
        return match.name+' marked done, sir. '+_streak(match.id)+' day streak.';
      }
    }
    // "what are my habits" / "how am I doing"
    if(/\b(my habits|habit progress|how.*doing)\b/.test(c)){
      var s=_todayScore();
      if(!s.total)return'No habits set up yet, sir.';
      return'You\'ve completed '+s.done+' of '+s.total+' habits today, sir.';
    }
    return null;
  }

  function init(){
    _load();
    // Morning nudge check
    setTimeout(checkMorningNudge,5000);
    setInterval(checkMorningNudge,60*60*1000); // recheck hourly
  }

  return{init,showPanel,hidePanel,togglePanel,switchTab,handleVoice};
})();
