// ═══════════════════════════════════════════════════════════
// ══  CALENDAR / TASKS MODULE (CAL)  ════════════════════════
// ═══════════════════════════════════════════════════════════
// Owns: task CRUD, vault sync (07-System/Tasks.md),
//       daily-log task import, voice commands, panel UI.
// Depends on globals: vaultHandle, vaultConnected, vaultIndex (set in hud.html)
// ═══════════════════════════════════════════════════════════
var CAL=(function(){
  var LS_KEY='baker_tasks';
  var TASKS_PATH=['07-System','Tasks.md'];
  var tasks=[];
  var saveDebounce=null;

  // ── ID ────────────────────────────────────────────────────
  function genId(){return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}

  // ── LocalStorage ──────────────────────────────────────────
  function loadLocal(){
    try{var raw=localStorage.getItem(LS_KEY);if(raw)tasks=JSON.parse(raw);}catch(e){tasks=[];}
  }
  function saveLocal(){
    try{localStorage.setItem(LS_KEY,JSON.stringify(tasks));}catch(e){}
  }

  // ── Markdown ↔ tasks ──────────────────────────────────────
  // Format: - [ ] Task text 📅 2026-06-15
  //         - [x] Done task
  function parseMarkdown(md){
    var out=[];
    md.split('\n').forEach(function(line){
      var m=line.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/);
      if(!m)return;
      var done=m[1].toLowerCase()==='x';
      var text=m[2].trim();
      var due='';
      var dm=text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
      if(dm){due=dm[1];text=text.replace(/📅\s*\d{4}-\d{2}-\d{2}/,'').trim();}
      out.push({id:genId(),text:text,done:done,due:due});
    });
    return out;
  }
  function toMarkdown(){
    var lines=['# Tasks','','_Synced with BAKER — managed via voice or HUD panel_',''];
    tasks.forEach(function(t){
      lines.push('- '+(t.done?'[x]':'[ ]')+' '+t.text+(t.due?' 📅 '+t.due:''));
    });
    lines.push('');
    return lines.join('\n');
  }

  // ── Vault I/O ─────────────────────────────────────────────
  async function vaultRead(){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return null;
    try{
      var dir=vaultHandle;
      for(var i=0;i<TASKS_PATH.length-1;i++)dir=await dir.getDirectoryHandle(TASKS_PATH[i],{create:true});
      var fh=await dir.getFileHandle(TASKS_PATH[TASKS_PATH.length-1],{create:true});
      return await(await fh.getFile()).text();
    }catch(e){return null;}
  }
  async function vaultWrite(md){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return false;
    try{
      var dir=vaultHandle;
      for(var i=0;i<TASKS_PATH.length-1;i++)dir=await dir.getDirectoryHandle(TASKS_PATH[i],{create:true});
      var fh=await dir.getFileHandle(TASKS_PATH[TASKS_PATH.length-1],{create:true});
      var w=await fh.createWritable();
      await w.write(md);await w.close();
      return true;
    }catch(e){return false;}
  }

  // ── Sync ──────────────────────────────────────────────────
  async function syncFromVault(){
    var md=await vaultRead();
    if(md===null)return false;
    var parsed=parseMarkdown(md);
    if(parsed.length||md.trim().length<30){tasks=parsed;saveLocal();}
    return true;
  }

  // Scan all daily logs in vaultIndex for checkbox items and merge into tasks.
  // Skips any task whose text already exists (case-insensitive).
  // Uses the log filename date (YYYY-MM-DD) as the due date.
  function syncTasksFromDailyLogs(){
    if(typeof vaultIndex==='undefined'||!vaultIndex.length)return 0;
    var added=0;
    vaultIndex.forEach(function(note){
      if(!/^00-Capture\/\d{4}-\d{2}-\d{2}\.md$/.test(note.path))return;
      var dateMatch=note.path.match(/(\d{4}-\d{2}-\d{2})\.md$/);
      var due=dateMatch?dateMatch[1]:'';
      (note.content||'').split('\n').forEach(function(line){
        var m=line.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/);
        if(!m)return;
        var done=m[1].toLowerCase()==='x';
        var text=m[2].trim().replace(/📅\s*\d{4}-\d{2}-\d{2}/,'').trim();
        if(!text)return;
        if(tasks.some(function(t){return t.text.toLowerCase()===text.toLowerCase();}))return;
        tasks.push({id:genId(),text:text,done:done,due:due});
        added++;
      });
    });
    if(added)saveLocal();
    return added;
  }

  function scheduleSave(){
    clearTimeout(saveDebounce);
    saveDebounce=setTimeout(async function(){
      saveLocal();
      var footer=document.getElementById('cal-footer');
      if(typeof vaultConnected!=='undefined'&&vaultConnected){
        var ok=await vaultWrite(toMarkdown());
        if(footer){footer.textContent=ok?'✓ Synced to vault':'⚠ Vault write failed';footer.className='cal-footer'+(ok?' synced':'');}
      }else{
        if(footer){footer.textContent='Local only — connect vault to sync';footer.className='cal-footer';}
      }
    },500);
  }

  // ── Task operations ───────────────────────────────────────
  function addTask(text,due){
    text=text.trim();if(!text)return null;
    var t={id:genId(),text:text,done:false,due:due||''};
    tasks.push(t);render();scheduleSave();
    return t;
  }
  function toggleTask(id){
    var t=tasks.find(function(x){return x.id===id;});if(!t)return;
    t.done=!t.done;render();scheduleSave();
  }
  function deleteTask(id){
    tasks=tasks.filter(function(x){return x.id!==id;});render();scheduleSave();
  }
  function findTaskByText(query){
    query=query.toLowerCase().trim();
    return tasks.find(function(t){return t.text.toLowerCase()===query;})||
           tasks.find(function(t){return t.text.toLowerCase().includes(query)||query.includes(t.text.toLowerCase());});
  }

  // ── Date helpers ──────────────────────────────────────────
  var WEEKDAY_NAMES=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  var MONTH_NAMES_FULL=['january','february','march','april','may','june','july','august','september','october','november','december'];

  function parseDateFromText(text){
    var lower=text.toLowerCase();
    var m;

    m=lower.match(/\btoday\b/);   if(m)return{due:todayStr(),matched:m[0]};
    m=lower.match(/\btomorrow\b/);if(m)return{due:tomorrowStr(),matched:m[0]};

    var wdPat=new RegExp('\\b(next\\s+)?('+WEEKDAY_NAMES.join('|')+')\\b');
    m=lower.match(wdPat);
    if(m){
      var targetDow=WEEKDAY_NAMES.indexOf(m[2]);
      var isNext=!!m[1];
      var d=new Date();var curDow=d.getDay();
      var diff;
      if(isNext){var nat=(targetDow-curDow+7)%7;diff=(nat||7)+7;}
      else{diff=(targetDow-curDow+7)%7||7;}
      d.setDate(d.getDate()+diff);
      return{due:dateToStr(d),matched:m[0]};
    }

    var monPat=new RegExp('\\b('+MONTH_NAMES_FULL.join('|')+')\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b');
    m=lower.match(monPat);
    if(m){
      var monIdx=MONTH_NAMES_FULL.indexOf(m[1]);
      var day=parseInt(m[2],10);
      var year=m[3]?parseInt(m[3],10):new Date().getFullYear();
      var d2=new Date(year,monIdx,day);
      if(!m[3]&&d2<new Date(new Date().toDateString()))d2.setFullYear(year+1);
      return{due:dateToStr(d2),matched:m[0]};
    }

    m=lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if(m){
      var mo=parseInt(m[1],10)-1,da=parseInt(m[2],10);
      var yr=m[3]?(m[3].length===2?2000+parseInt(m[3],10):parseInt(m[3],10)):new Date().getFullYear();
      var d3=new Date(yr,mo,da);
      if(!m[3]&&d3<new Date(new Date().toDateString()))d3.setFullYear(yr+1);
      return{due:dateToStr(d3),matched:m[0]};
    }

    return null;
  }

  function dateToStr(d){
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function todayStr(){var d=new Date();return dateToStr(d);}
  function tomorrowStr(){var d=new Date();d.setDate(d.getDate()+1);return dateToStr(d);}

  // FIX: done tasks never show "Overdue" — just their plain date
  function fmtDue(due,done){
    if(!due)return'';
    var today=todayStr(),tom=tomorrowStr();
    if(due===today)return'Today';
    if(due===tom)return'Tomorrow';
    if(due<today)return done?due:'Overdue · '+due;
    var p=due.split('-');
    var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(p[1])-1]+' '+parseInt(p[2]);
  }

  // ── Render ────────────────────────────────────────────────
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function render(){
    var list=document.getElementById('cal-list');
    if(!list)return;
    if(!tasks.length){
      list.innerHTML='<div class="cal-empty">No tasks yet.<br>Add one above, or say<br>"add task [name]" to Baker.</div>';
      updateNavBadge();_syncMonthGrid();
      return;
    }

    var today=todayStr(),tom=tomorrowStr();
    var groups={overdue:[],today:[],tomorrow:[],upcoming:[],noDate:[],done:[]};

    tasks.forEach(function(t){
      if(t.done){groups.done.push(t);return;}
      if(!t.due){groups.noDate.push(t);return;}
      if(t.due<today)groups.overdue.push(t);
      else if(t.due===today)groups.today.push(t);
      else if(t.due===tom)groups.tomorrow.push(t);
      else groups.upcoming.push(t);
    });
    groups.upcoming.sort(function(a,b){return(a.due||'9999').localeCompare(b.due||'9999');});

    var html='';
    function renderGroup(label,cls,items){
      if(!items.length)return;
      html+='<div class="cal-group-label'+(cls?' '+cls:'')+'">'+label+' ('+items.length+')</div>';
      items.forEach(renderItem);
    }
    function renderItem(t){
      // FIX: pass t.done so completed past-due tasks don't get "Overdue" label
      var dueLbl=fmtDue(t.due,t.done);
      var dueCls=(t.due&&t.due<today&&!t.done)?'overdue':'';
      html+='<div class="cal-item'+(t.done?' done':'')+'" data-id="'+esc(t.id)+'">'+
        '<button class="cal-check'+(t.done?' done':'')+'" data-action="toggle" data-id="'+esc(t.id)+'">'+
        '<svg viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l3.5 3.5L13 4"/></svg>'+
        '</button>'+
        '<div class="cal-item-body">'+
        '<div class="cal-item-text">'+esc(t.text)+'</div>'+
        (dueLbl?'<div class="cal-item-date '+dueCls+'">'+dueLbl+'</div>':'')+
        '</div>'+
        '<button class="cal-del" data-action="delete" data-id="'+esc(t.id)+'">✕</button>'+
        '</div>';
    }

    renderGroup('Overdue','overdue',groups.overdue);
    renderGroup('Today','today',groups.today);
    renderGroup('Tomorrow','',groups.tomorrow);
    renderGroup('Upcoming','',groups.upcoming);
    renderGroup('No Date','',groups.noDate);
    renderGroup('Done','',groups.done);

    list.innerHTML=html;
    list.querySelectorAll('[data-action="toggle"]').forEach(function(btn){
      btn.addEventListener('click',function(){toggleTask(btn.dataset.id);});
    });
    list.querySelectorAll('[data-action="delete"]').forEach(function(btn){
      btn.addEventListener('click',function(){deleteTask(btn.dataset.id);});
    });

    updateNavBadge();_syncMonthGrid();
  }

  function _syncMonthGrid(){
    if(typeof MCAL!=='undefined'&&MCAL._refreshIfVisible)MCAL._refreshIfVisible();
  }

  function updateNavBadge(){
    var lbl=document.getElementById('cal-nav-lbl');if(!lbl)return;
    var today=todayStr();
    var due=tasks.filter(function(t){return!t.done&&t.due&&t.due<=today;}).length;
    lbl.textContent=due>0?('Tasks ('+due+')'):'Tasks';
  }

  // ── Panel ─────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById('calendar-panel');
    p.classList.add('cal-vis');
    if(p._wbNormalise)p._wbNormalise();
    render();
  }
  function hidePanel(){document.getElementById('calendar-panel').classList.remove('cal-vis');}
  function togglePanel(){
    var p=document.getElementById('calendar-panel');
    p.classList.toggle('cal-vis');
    if(p.classList.contains('cal-vis')){if(p._wbNormalise)p._wbNormalise();render();}
  }

  // ── Voice ─────────────────────────────────────────────────
  async function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();

    // Add task
    var addM=c.match(/(?:add (?:a )?task(?: to)?|remind me to|add to my tasks?|new task|schedule(?: a)?|add)\s*[:]?\s*(.+?)(?:\s+(?:to|on)\s+(?:the\s+)?(?:calendar|tasks?|to.?do)\s*)?(?:\s+for\s+(.+))?$/);
    if(addM&&/(?:add (?:a )?task|remind me to|add to my tasks?|new task|schedule|add .+ to (?:the )?calendar)/.test(c)){
      var text=addM[1].trim();
      var dateText=(addM[2]||'').trim();
      var due='';
      var parsed=parseDateFromText(dateText||text);
      if(parsed){
        due=parsed.due;
        if(dateText)dateText=dateText.replace(parsed.matched,'').trim();
        else text=text.replace(parsed.matched,'').trim();
      }
      if(dateText)text=(text+' '+dateText).trim();
      text=text.replace(/\s+/g,' ').replace(/^(to|for)\s+/,'').replace(/\s+(to|for)$/,'').trim();
      if(!text)return'What should I add, sir?';
      addTask(text,due);showPanel();
      var dueLabel='';
      if(due){
        if(due===todayStr())dueLabel=', due today';
        else if(due===tomorrowStr())dueLabel=', due tomorrow';
        else dueLabel=', due '+fmtDue(due,false);
      }
      return'Added "'+text+'" to your tasks'+dueLabel+', sir.';
    }

    // Complete task
    var doneM=c.match(/(?:complete|finish|check off|mark (?:as )?done|mark .* (?:as )?done)\s*[:]?\s*(.+)/)||
               c.match(/mark\s+(.+?)\s+(?:as\s+)?done/);
    if(doneM){
      var t=findTaskByText(doneM[1].trim());
      if(!t)return'I couldn\'t find a task matching "'+doneM[1].trim()+'", sir.';
      t.done=true;render();scheduleSave();showPanel();
      return'Marked "'+t.text+'" as done, sir.';
    }

    // Delete task
    var delM=c.match(/(?:delete|remove)\s+(?:task|the task)?\s*[:]?\s*(.+)/);
    if(delM){
      var dt=findTaskByText(delM[1].trim());
      if(!dt)return'I couldn\'t find a task matching "'+delM[1].trim()+'", sir.';
      deleteTask(dt.id);showPanel();
      return'Removed "'+dt.text+'" from your tasks, sir.';
    }

    // List tasks
    if(/\b(my tasks|my to.?do|task list|what.?s on my (list|plate))\b/.test(c)){
      showPanel();
      var pending=tasks.filter(function(t){return!t.done;});
      if(!pending.length)return'Your task list is clear, sir.';
      var today=todayStr();
      var dueToday=pending.filter(function(t){return t.due===today;});
      var overdue=pending.filter(function(t){return t.due&&t.due<today;});
      var parts=[];
      if(overdue.length)parts.push(overdue.length+' overdue');
      if(dueToday.length)parts.push(dueToday.length+' due today');
      parts.push(pending.length+' total pending');
      var summary='You have '+parts.join(', ')+'.';
      if(dueToday.length)summary+=' Today: '+dueToday.slice(0,3).map(function(t){return t.text;}).join(', ')+'.';
      return summary;
    }

    // Open tasks panel
    if(/\b(open|pull up|show|let'?s (open|check|see))\b.*\b(tasks?|to.?do|task list)\b/.test(c)){
      showPanel();return'Here are your tasks, sir.';
    }

    return null;
  }

  // ── Init ──────────────────────────────────────────────────
  var addInputEl,addDateEl,addBtnEl;
  async function init(){
    loadLocal();
    addInputEl=document.getElementById('cal-add-input');
    addDateEl=document.getElementById('cal-add-date');
    addBtnEl=document.getElementById('cal-add-btn');
    if(addBtnEl)addBtnEl.addEventListener('click',submitAdd);
    if(addInputEl)addInputEl.addEventListener('keydown',function(e){if(e.key==='Enter')submitAdd();});
    render();
    if(typeof vaultConnected!=='undefined'&&vaultConnected){
      await syncFromVault();
      syncTasksFromDailyLogs();
      render();
    }
  }
  function submitAdd(){
    var text=addInputEl.value.trim();if(!text)return;
    var due=addDateEl.value||'';
    addTask(text,due);
    addInputEl.value='';addDateEl.value='';
    addInputEl.focus();
  }

  // Called from doConnect() once vault connects
  async function onVaultConnected(){
    await syncFromVault();
    syncTasksFromDailyLogs();
    render();
    var footer=document.getElementById('cal-footer');
    if(footer){footer.textContent='✓ Synced to vault';footer.className='cal-footer synced';}
  }

  return{
    init,showPanel,hidePanel,togglePanel,handleVoice,
    addTask,deleteTask,toggleTask,
    onVaultConnected,
    getTasks:function(){return tasks;},
    refreshAll:render,
    notifyChange:scheduleSave
  };
})();


// ═══════════════════════════════════════════════════════════
// ══  MONTH CALENDAR MODULE (MCAL)  ═════════════════════════
// ═══════════════════════════════════════════════════════════
// Owns: month grid view, day detail panel, cross-module sync with CAL.
// Depends on globals: vaultIndex (for daily log dots/bullets)
// ═══════════════════════════════════════════════════════════
var MCAL=(function(){
  var viewYear,viewMonth;
  var selectedDate=null;
  var MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function pad(n){return String(n).padStart(2,'0');}
  function dateStr(y,m,d){return y+'-'+pad(m+1)+'-'+pad(d);}
  function todayStr(){var d=new Date();return dateStr(d.getFullYear(),d.getMonth(),d.getDate());}

  // ── Daily log lookup ──────────────────────────────────────
  function getDailyLogContent(ds){
    if(typeof vaultIndex==='undefined'||!vaultIndex.length)return null;
    var fname=ds+'.md';
    var note=vaultIndex.find(function(n){
      return n.path==='00-Capture/'+fname||(n.name===fname&&n.path.indexOf('00-Capture')===0);
    });
    return note?note.content:null;
  }

  // FIX: exclude checkbox lines so they don't double-render alongside the task list
  function getDailyLogBullets(content){
    if(!content)return[];
    return content.split('\n').filter(function(l){
      return /^\s*-\s+/.test(l)&&!/^\s*-\s*\[[ xX]\]/.test(l);
    }).map(function(l){return l.replace(/^\s*-\s+/,'').trim();});
  }

  // ── Grid ──────────────────────────────────────────────────
  function buildGrid(){
    var grid=document.getElementById('mcal-days');if(!grid)return;
    document.getElementById('mcal-monthlbl').textContent=MONTH_NAMES[viewMonth]+' '+viewYear;

    var tasks=CAL.getTasks();
    var today=todayStr();
    var counts={},overdueDates={};
    tasks.forEach(function(t){
      if(!t.due)return;
      counts[t.due]=(counts[t.due]||0)+(t.done?0:1);
      if(!t.done&&t.due<today)overdueDates[t.due]=true;
    });

    var firstDow=new Date(viewYear,viewMonth,1).getDay();
    var daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
    var daysInPrevMonth=new Date(viewYear,viewMonth,0).getDate();

    var cells=[];
    for(var i=firstDow-1;i>=0;i--){
      var pm=viewMonth-1,py=viewYear;
      if(pm<0){pm=11;py--;}
      cells.push({y:py,m:pm,d:daysInPrevMonth-i,other:true});
    }
    for(var d2=1;d2<=daysInMonth;d2++)cells.push({y:viewYear,m:viewMonth,d:d2,other:false});
    var nm=viewMonth+1,ny=viewYear,nd=1;
    if(nm>11){nm=0;ny++;}
    while(cells.length<42){cells.push({y:ny,m:nm,d:nd,other:true});nd++;}

    var html='';
    cells.forEach(function(c){
      var ds=dateStr(c.y,c.m,c.d);
      var isToday=(ds===today);
      var cnt=counts[ds]||0;
      var hasLog=!!getDailyLogContent(ds);
      var cls='mcal-day'+(c.other?' other-month':'')+(isToday?' today':'');
      if(cnt>0)cls+=overdueDates[ds]?' has-overdue':' has-tasks';
      html+='<div class="'+cls+'" data-date="'+ds+'">'+
        '<div class="mcal-daynum">'+c.d+'</div>'+
        (cnt>0?'<div class="mcal-daycount">'+cnt+' task'+(cnt>1?'s':'')+'</div>':'')+
        (hasLog?'<div class="mcal-logicon" title="Daily log available">📝</div>':'')+
        '</div>';
    });
    grid.innerHTML=html;
    grid.querySelectorAll('.mcal-day').forEach(function(cell){
      cell.addEventListener('click',function(){openDay(cell.dataset.date);});
    });
  }

  // ── Day detail ────────────────────────────────────────────
  function openDay(ds){
    selectedDate=ds;
    var detail=document.getElementById('mcal-detail');
    var parts=ds.split('-');
    var dObj=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2]));
    var dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var label=dayNames[dObj.getDay()]+', '+MONTH_NAMES[dObj.getMonth()]+' '+dObj.getDate()+', '+dObj.getFullYear();
    if(ds===todayStr())label='Today — '+label;
    document.getElementById('mcal-detail-date').textContent=label;
    renderDetailList();
    detail.classList.add('vis');
    var input=document.getElementById('mcal-detail-input');
    if(input){input.value='';setTimeout(function(){input.focus();},50);}
  }
  function closeDay(){
    document.getElementById('mcal-detail').classList.remove('vis');
    selectedDate=null;
    buildGrid();
  }

  function renderDetailList(){
    var list=document.getElementById('mcal-detail-list');
    if(!list||!selectedDate)return;
    var tasks=CAL.getTasks().filter(function(t){return t.due===selectedDate;});

    // Daily log bullets (FIX: checkbox lines already excluded by getDailyLogBullets)
    var logContent=getDailyLogContent(selectedDate);
    var logHtml='';
    if(logContent){
      var bullets=getDailyLogBullets(logContent);
      if(bullets.length){
        logHtml='<div style="padding:8px 6px;margin-bottom:6px;border-bottom:1px solid var(--border)">'+
          '<div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:5px">📝 Daily log</div>'+
          bullets.map(function(b){return'<div style="font-size:11px;color:var(--text);line-height:1.6;margin-bottom:2px">· '+esc(b)+'</div>';}).join('')+
          '</div>';
      }
    }

    if(!tasks.length){
      list.innerHTML=logHtml+'<div class="mcal-detail-empty">Nothing scheduled for this day.<br>Add a task above.</div>';
      return;
    }

    tasks.sort(function(a,b){return(a.done?1:0)-(b.done?1:0);});
    var html=logHtml;
    tasks.forEach(function(t){
      html+='<div class="cal-item'+(t.done?' done':'')+'" data-id="'+esc(t.id)+'">'+
        '<button class="cal-check'+(t.done?' done':'')+'" data-action="toggle" data-id="'+esc(t.id)+'">'+
        '<svg viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l3.5 3.5L13 4"/></svg>'+
        '</button>'+
        '<div class="cal-item-body"><div class="cal-item-text">'+esc(t.text)+'</div></div>'+
        '<button class="cal-del" data-action="delete" data-id="'+esc(t.id)+'">✕</button>'+
        '</div>';
    });
    list.innerHTML=html;

    list.querySelectorAll('[data-action="toggle"]').forEach(function(btn){
      btn.addEventListener('click',function(){
        CAL.toggleTask(btn.dataset.id);
        renderDetailList();CAL.refreshAll();
      });
    });
    list.querySelectorAll('[data-action="delete"]').forEach(function(btn){
      btn.addEventListener('click',function(){
        CAL.deleteTask(btn.dataset.id);
        renderDetailList();CAL.refreshAll();buildGrid();
      });
    });
  }

  function addToSelectedDay(){
    var input=document.getElementById('mcal-detail-input');
    var text=input.value.trim();
    if(!text||!selectedDate)return;
    CAL.addTask(text,selectedDate);
    input.value='';
    renderDetailList();buildGrid();
  }

  // ── Navigation ────────────────────────────────────────────
  function prevMonth(){viewMonth--;if(viewMonth<0){viewMonth=11;viewYear--;}buildGrid();}
  function nextMonth(){viewMonth++;if(viewMonth>11){viewMonth=0;viewYear++;}buildGrid();}
  function goToday(){var d=new Date();viewYear=d.getFullYear();viewMonth=d.getMonth();buildGrid();}

  // ── Panel ─────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById('month-panel');
    p.classList.add('mcal-vis');
    if(p._wbNormalise)p._wbNormalise();
    buildGrid();
  }
  function hidePanel(){
    document.getElementById('month-panel').classList.remove('mcal-vis');
    document.getElementById('mcal-detail').classList.remove('vis');
    selectedDate=null;
  }
  function togglePanel(){
    var p=document.getElementById('month-panel');
    p.classList.toggle('mcal-vis');
    if(p.classList.contains('mcal-vis')){if(p._wbNormalise)p._wbNormalise();buildGrid();}
    else{document.getElementById('mcal-detail').classList.remove('vis');selectedDate=null;}
  }

  // ── Voice ─────────────────────────────────────────────────
  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(/\b(open|pull up|show|let'?s (open|check|see))\b.*\b(calendar|month( view)?)\b/.test(c)||/\bcalendar view\b/.test(c)){
      showPanel();return'Here\'s your calendar, sir.';
    }
    var isVis=document.getElementById('month-panel').classList.contains('mcal-vis');
    if(/\bnext month\b/.test(c)&&isVis){nextMonth();return'Showing '+MONTH_NAMES[viewMonth]+', sir.';}
    if(/\b(previous|last) month\b/.test(c)&&isVis){prevMonth();return'Showing '+MONTH_NAMES[viewMonth]+', sir.';}
    return null;
  }

  // ── Init ──────────────────────────────────────────────────
  function init(){
    var d=new Date();viewYear=d.getFullYear();viewMonth=d.getMonth();
    document.getElementById('mcal-prev').addEventListener('click',prevMonth);
    document.getElementById('mcal-next').addEventListener('click',nextMonth);
    document.getElementById('mcal-today').addEventListener('click',goToday);
    document.getElementById('mcal-back').addEventListener('click',closeDay);
    document.getElementById('mcal-detail-addbtn').addEventListener('click',addToSelectedDay);
    document.getElementById('mcal-detail-input').addEventListener('keydown',function(e){if(e.key==='Enter')addToSelectedDay();});
    buildGrid();
  }

  function _refreshIfVisible(){
    var p=document.getElementById('month-panel');
    if(!p||!p.classList.contains('mcal-vis'))return;
    buildGrid();
    if(selectedDate)renderDetailList();
  }

  return{init,showPanel,hidePanel,togglePanel,handleVoice,_refreshIfVisible};
})();
