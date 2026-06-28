// ═══════════════════════════════════════════════════════════
// ══  BAKER TIMELINE — Life at a Glance  ════════════════════
// ═══════════════════════════════════════════════════════════
// A scrollable visual timeline of your life in BAKER.
// Shows every workout, daily note, habit streak, academic
// milestone, focus session, and conversation — rendered as
// a beautiful vertical timeline with faction-themed styling.
// Tap any event to expand details. Voice: "Baker, timeline"
// ═══════════════════════════════════════════════════════════
var TIMELINE=(function(){

  var PANEL_ID='timeline-panel';
  var _range=30; // days to show

  function _dateStr(d){
    if(!d)d=new Date();
    return d.toISOString().slice(0,10);
  }
  function _daysAgo(n){
    var d=new Date();d.setDate(d.getDate()-n);return _dateStr(d);
  }
  function _fmtDate(ds){
    var d=new Date(ds+'T12:00:00');
    return['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]+' '+
      ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]+
      ' '+d.getDate();
  }
  function _today(){return _dateStr();}

  // ── Gather all events from localStorage ──────────────────
  function _gatherEvents(){
    var events=[];
    var start=_daysAgo(_range);

    // ── WORKOUTS from strength logs ───────────────────────
    try{
      var st=JSON.parse(localStorage.getItem('baker_strength_v1')||'{}');
      (st.logs||[]).filter(function(l){return l.date>=start;}).forEach(function(l){
        var doneSets=0,totalVol=0;
        l.entries.forEach(function(e){
          e.sets.filter(function(s){return s.done;}).forEach(function(s){
            doneSets++;totalVol+=s.reps*s.weight;
          });
        });
        if(doneSets>0){
          events.push({
            date:l.date,type:'workout',
            title:l.name||'Workout',
            detail:l.entries.filter(function(e){return e.sets.some(function(s){return s.done;});}).map(function(e){return e.exercise;}).join(', '),
            meta:doneSets+' sets · '+totalVol.toLocaleString()+' lbs',
            icon:'💪',color:'#ff6b6b'
          });
        }
      });
    }catch(e){}

    // ── HABITS streaks and completions ────────────────────
    try{
      var hab=JSON.parse(localStorage.getItem('baker_habits_v1')||'{}');
      var habLog=hab.log||{};
      Object.keys(habLog).filter(function(d){return d>=start;}).forEach(function(d){
        var done=Object.values(habLog[d]).filter(Boolean).length;
        var total=(hab.habits||[]).length;
        if(done>0){
          events.push({
            date:d,type:'habits',
            title:'Habits — '+done+'/'+total,
            detail:(hab.habits||[]).filter(function(h){return habLog[d][h.id];}).map(function(h){return(h.emoji||'')+h.name;}).join(' · '),
            meta:Math.round((done/Math.max(total,1))*100)+'% completion',
            icon:'⊙',color:'#7c6af7'
          });
        }
      });
    }catch(e){}

    // ── BIOMETRICS entries ────────────────────────────────
    try{
      var bio=JSON.parse(localStorage.getItem('baker_biometrics_v1')||'[]');
      bio.filter(function(e){return e.date>=start;}).forEach(function(e){
        var parts=[];
        if(e.mood!=null)parts.push('Mood '+e.mood+'/10');
        if(e.sleep!=null)parts.push('Sleep '+e.sleep+'h');
        if(e.energy!=null)parts.push('Energy '+e.energy+'/10');
        if(!parts.length)return;
        var avg=((e.mood||5)+(e.energy||5))/2;
        events.push({
          date:e.date,type:'biometric',
          title:'Daily Check-in',
          detail:parts.join(' · '),
          meta:avg>=7?'Feeling good':'avg >= 5 ? "Decent":"Rough day"',
          icon:'⬡',color:'#06d6a0'
        });
      });
    }catch(e){}

    // ── FOCUS sessions ────────────────────────────────────
    try{
      var foc=JSON.parse(localStorage.getItem('baker_focus_v1')||'{}');
      if(foc.sessions){
        foc.sessions.filter(function(s){return s.date>=start;}).forEach(function(s){
          events.push({
            date:s.date,type:'focus',
            title:'Focus Session',
            detail:(s.count||1)+' Pomodoro'+(s.count!==1?'s':'')+' completed',
            meta:((s.count||1)*25)+' minutes of deep work',
            icon:'⏱',color:'#60a5fa'
          });
        });
      }
    }catch(e){}

    // ── TASKS completed ───────────────────────────────────
    try{
      var cal=JSON.parse(localStorage.getItem('baker_cal_v1')||'[]');
      // Group completed tasks by date
      var byDate={};
      cal.filter(function(t){return t.done&&t.doneAt;}).forEach(function(t){
        var d=new Date(t.doneAt).toISOString().slice(0,10);
        if(d<start)return;
        if(!byDate[d])byDate[d]=[];
        byDate[d].push(t);
      });
      Object.keys(byDate).forEach(function(d){
        var tasks=byDate[d];
        events.push({
          date:d,type:'tasks',
          title:tasks.length+' Task'+(tasks.length!==1?'s':'')+' Completed',
          detail:tasks.map(function(t){return t.text;}).join(' · '),
          meta:'✓ Cleared from list',
          icon:'☑',color:'#4ade80'
        });
      });
    }catch(e){}

    // ── ACADEMIC milestones ───────────────────────────────
    try{
      var ac=JSON.parse(localStorage.getItem('baker_academic_v1')||'{}');
      (ac.classes||[]).forEach(function(cls){
        (cls.assignments||[]).filter(function(a){return a.done&&a.doneAt&&a.doneAt>=start;}).forEach(function(a){
          events.push({
            date:a.doneAt?a.doneAt.slice(0,10):_today(),type:'academic',
            title:'Assignment Complete',
            detail:'['+cls.name+'] '+a.name,
            meta:cls.grade!=null?'Grade: '+cls.grade+'%':'',
            icon:'🎓',color:'#ffd166'
          });
        });
      });
    }catch(e){}

    // ── INBOX captures ────────────────────────────────────
    try{
      var inbox=JSON.parse(localStorage.getItem('baker_inbox_v1')||'[]');
      var byDay={};
      inbox.filter(function(i){return i.date>=start;}).forEach(function(i){
        if(!byDay[i.date])byDay[i.date]=[];
        byDay[i.date].push(i);
      });
      Object.keys(byDay).forEach(function(d){
        var items=byDay[d];
        if(!items.length)return;
        events.push({
          date:d,type:'inbox',
          title:items.length+' Capture'+(items.length!==1?'s':''),
          detail:items.slice(0,3).map(function(i){return i.text;}).join(' · ')+(items.length>3?' +more':''),
          meta:'From Inbox',
          icon:'📬',color:'#c084fc'
        });
      });
    }catch(e){}

    // ── STRENGTH PRs ──────────────────────────────────────
    try{
      var st2=JSON.parse(localStorage.getItem('baker_strength_v1')||'{}');
      Object.entries(st2.prs||{}).filter(function(kv){return kv[1].date>=start;}).forEach(function(kv){
        events.push({
          date:kv[1].date,type:'pr',
          title:'New PR — '+kv[0],
          detail:kv[1].weight+'lbs × '+kv[1].reps+' reps',
          meta:'Personal Record 🏆',
          icon:'🏆',color:'#fbbf24'
        });
      });
    }catch(e){}

    // Sort by date descending, then by type priority
    var typePriority={pr:0,workout:1,academic:2,tasks:3,habits:4,biometric:5,focus:6,inbox:7};
    events.sort(function(a,b){
      if(b.date!==a.date)return b.date<a.date?-1:1;
      return (typePriority[a.type]||9)-(typePriority[b.type]||9);
    });
    return events;
  }

  // ── Render ─────────────────────────────────────────────────
  function render(){
    var body=document.getElementById('tl-body');if(!body)return;
    var events=_gatherEvents();
    var today=_today();

    if(!events.length){
      body.innerHTML='<div style="font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;padding:40px 20px">'+
        '<div style="font-size:32px;margin-bottom:12px">📡</div>'+
        'No events yet, sir.<br><br>Use BAKER for a few days and your timeline will fill up automatically.</div>';
      return;
    }

    // Group by date
    var byDate={};var dateOrder=[];
    events.forEach(function(e){
      if(!byDate[e.date]){byDate[e.date]=[];dateOrder.push(e.date);}
      byDate[e.date].push(e);
    });
    // dedupe dateOrder
    dateOrder=dateOrder.filter(function(d,i){return dateOrder.indexOf(d)===i;});

    var html='<div style="position:relative;padding-left:28px">';
    // Vertical spine
    html+='<div style="position:absolute;left:12px;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,var(--accent),rgba(124,106,247,0.1))"></div>';

    dateOrder.forEach(function(date){
      var evts=byDate[date];
      var isToday=date===today;
      var label=isToday?'Today':_fmtDate(date);

      // Date label
      html+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;margin-top:16px">'+
        '<div style="width:10px;height:10px;border-radius:50%;background:'+(isToday?'var(--accent)':'var(--border)')+
        ';border:2px solid '+(isToday?'var(--accent)':'rgba(255,255,255,0.2)')+
        ';flex-shrink:0;margin-left:-5px'+(isToday?';box-shadow:0 0 8px var(--accent)':'')+'" ></div>'+
        '<span style="font-family:var(--mono);font-size:'+(isToday?'11':'10')+'px;color:'+(isToday?'var(--accent)':'var(--muted)')+
        ';font-weight:'+(isToday?'700':'400')+';letter-spacing:.06em">'+label+'</span>'+
        (isToday?'<span style="background:var(--accent-dim);border:1px solid var(--accent);border-radius:3px;padding:1px 6px;font-family:var(--mono);font-size:8px;color:var(--accent)">NOW</span>':'')+
        '</div>';

      // Events for this date
      evts.forEach(function(ev,i){
        var expanded=false;
        html+='<div class="tl-event" data-date="'+date+'" data-i="'+i+'" style="'+
          'background:var(--surface);border:1px solid var(--border);border-left:3px solid '+ev.color+';'+
          'border-radius:6px;padding:10px 12px;margin-bottom:6px;cursor:pointer;transition:all .15s;'+
          'position:relative">'+
          '<div style="display:flex;align-items:center;gap:8px">'+
            '<span style="font-size:16px;flex-shrink:0">'+ev.icon+'</span>'+
            '<div style="flex:1;min-width:0">'+
              '<div style="font-family:var(--mono);font-size:11px;color:var(--text);font-weight:500;'+
                'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+ev.title+'</div>'+
              (ev.meta?'<div style="font-family:var(--mono);font-size:9px;color:'+ev.color+';margin-top:2px">'+ev.meta+'</div>':'')+
            '</div>'+
            '<span style="font-size:9px;color:var(--muted);flex-shrink:0">▾</span>'+
          '</div>'+
          '<div class="tl-detail" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">'+
            '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);line-height:1.7">'+
              (ev.detail||'')+'</div>'+
          '</div></div>';
      });
    });

    html+='</div>';

    // Footer stats
    var totalWorkouts=events.filter(function(e){return e.type==='workout';}).length;
    var totalPRs=events.filter(function(e){return e.type==='pr';}).length;
    var totalFocus=events.filter(function(e){return e.type==='focus';}).length;
    html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">'+
      '<div><div style="font-family:var(--mono);font-size:18px;font-weight:700;color:#ff6b6b">'+totalWorkouts+'</div><div style="font-family:var(--mono);font-size:8px;color:var(--muted)">WORKOUTS</div></div>'+
      '<div><div style="font-family:var(--mono);font-size:18px;font-weight:700;color:#fbbf24">'+totalPRs+'</div><div style="font-family:var(--mono);font-size:8px;color:var(--muted)">NEW PRs</div></div>'+
      '<div><div style="font-family:var(--mono);font-size:18px;font-weight:700;color:#60a5fa">'+totalFocus+'</div><div style="font-family:var(--mono);font-size:8px;color:var(--muted)">FOCUS SESSIONS</div></div>'+
      '</div>';

    body.innerHTML=html;

    // Bind expand/collapse
    body.querySelectorAll('.tl-event').forEach(function(card){
      card.addEventListener('click',function(){
        var detail=card.querySelector('.tl-detail');
        var arrow=card.querySelector('span:last-child');
        if(detail.style.display==='none'){
          detail.style.display='block';
          if(arrow)arrow.textContent='▴';
          card.style.background='rgba(124,106,247,0.06)';
        }else{
          detail.style.display='none';
          if(arrow)arrow.textContent='▾';
          card.style.background='var(--surface)';
        }
      });
    });
  }

  // ── Range selector ─────────────────────────────────────────
  function setRange(days){_range=days;render();}

  // ── Panel ─────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    p.classList.add('tl-vis');if(p._wbNormalise)p._wbNormalise();render();
  }
  function hidePanel(){var p=document.getElementById(PANEL_ID);if(p)p.classList.remove('tl-vis');}
  function togglePanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    if(p.classList.contains('tl-vis'))hidePanel();else showPanel();
  }

  function handleVoice(cmd){
    var c=cmd.toLowerCase();
    if(/\b(timeline|history|log|what have i done|show my progress|my week)\b/.test(c)){
      showPanel();return'Here is your timeline, sir.';
    }
    return null;
  }

  function init(){}
  return{init,showPanel,hidePanel,togglePanel,handleVoice,setRange};
})();
