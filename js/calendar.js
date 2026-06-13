// ═══════════════════════════════════════════════════════════
// ══  CALENDAR / TASKS MODULE (CAL)  ═════════════════════════
// ═══════════════════════════════════════════════════════════
var CAL=(function(){
  var LS_KEY='baker_tasks';
  var TASKS_PATH=['07-System','Tasks.md']; // vault path: 07-System/Tasks.md
  var tasks=[]; // {id, text, done, due (YYYY-MM-DD or ''), }
  var saveDebounce=null;

  // ── ID ────────────────────────────────────────────────────
  function genId(){return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}

  // ── Local storage ─────────────────────────────────────────
  function loadLocal(){
    try{var raw=localStorage.getItem(LS_KEY);if(raw)tasks=JSON.parse(raw);}catch(e){tasks=[];}
  }
  function saveLocal(){
    try{localStorage.setItem(LS_KEY,JSON.stringify(tasks));}catch(e){}
  }

  // ── Markdown <-> tasks ────────────────────────────────────
  // Format: - [ ] Task text 📅 2026-06-15
  //         - [x] Done task
  function parseMarkdown(md){
    var lines=md.split('\n');
    var out=[];
    lines.forEach(function(line){
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
      var box=t.done?'[x]':'[ ]';
      var dueStr=t.due?(' 📅 '+t.due):'';
      lines.push('- '+box+' '+t.text+dueStr);
    });
    lines.push('');
    return lines.join('\n');
  }

  // ── Vault I/O ─────────────────────────────────────────────
  async function vaultRead(){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return null;
    try{
      var dir=vaultHandle;
      for(var i=0;i<TASKS_PATH.length-1;i++){
        dir=await dir.getDirectoryHandle(TASKS_PATH[i],{create:true});
      }
      var fileHandle=await dir.getFileHandle(TASKS_PATH[TASKS_PATH.length-1],{create:true});
      var file=await fileHandle.getFile();
      return await file.text();
    }catch(e){return null;}
  }
  async function vaultWrite(md){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return false;
    try{
      var dir=vaultHandle;
      for(var i=0;i<TASKS_PATH.length-1;i++){
        dir=await dir.getDirectoryHandle(TASKS_PATH[i],{create:true});
      }
      var fileHandle=await dir.getFileHandle(TASKS_PATH[TASKS_PATH.length-1],{create:true});
      var writable=await fileHandle.createWritable();
      await writable.write(md);
      await writable.close();
      return true;
    }catch(e){return false;}
  }

  // ── Sync ──────────────────────────────────────────────────
  async function syncFromVault(){
    var md=await vaultRead();
    if(md===null)return false; // no vault — stay on local
    var parsed=parseMarkdown(md);
    if(parsed.length||md.trim().length<30){ // either has tasks, or file is basically empty/new
      tasks=parsed;
      saveLocal();
    }
    return true;
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
    tasks.push(t);
    render();scheduleSave();
    return t;
  }
  function toggleTask(id){
    var t=tasks.find(x=>x.id===id);if(!t)return;
    t.done=!t.done;render();scheduleSave();
  }
  function deleteTask(id){
    tasks=tasks.filter(x=>x.id!==id);render();scheduleSave();
  }
  function findTaskByText(query){
    query=query.toLowerCase().trim();
    // exact match first
    var exact=tasks.find(t=>t.text.toLowerCase()===query);
    if(exact)return exact;
    // contains match
    return tasks.find(t=>t.text.toLowerCase().includes(query)||query.includes(t.text.toLowerCase()));
  }

// ── Date helpers ──────────────────────────────────────────
  var WEEKDAY_NAMES=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  var MONTH_NAMES_FULL=['january','february','march','april','may','june','july','august','september','october','november','december'];

  // Parses "today", "tomorrow", weekday names ("friday", "next tuesday"),
  // and explicit dates ("june 20th", "6/20", "6/20/2026") out of free text.
  // Returns {due:'YYYY-MM-DD', matched:'<the substring that was matched>'} or null.
  function parseDateFromText(text){
    var lower=text.toLowerCase();

    // "today" / "tomorrow"
    var m=lower.match(/\btoday\b/);
    if(m)return{due:todayStr(),matched:m[0]};
    m=lower.match(/\btomorrow\b/);
    if(m)return{due:tomorrowStr(),matched:m[0]};

    // Weekday names, optionally preceded by "next"
    var wdPattern=new RegExp('\\b(next\\s+)?('+WEEKDAY_NAMES.join('|')+')\\b');
    m=lower.match(wdPattern);
    if(m){
      var targetDow=WEEKDAY_NAMES.indexOf(m[2]);
      var isNext=!!m[1];
      var d=new Date();
      var curDow=d.getDay();
      var diff=(targetDow-curDow+7)%7;
      if(diff===0)diff=isNext?7:7; // if it's the same day, treat as next week's occurrence
      if(isNext&&diff<7)diff+=7; // "next friday" pushes to the week after if today isn't past it
      // Simpler: if isNext, always add a full week beyond the natural next occurrence
      if(isNext){
        var naturalDiff=(targetDow-curDow+7)%7;
        if(naturalDiff===0)naturalDiff=7;
        diff=naturalDiff+7;
      }else{
        diff=(targetDow-curDow+7)%7;
        if(diff===0)diff=7; // assume they mean the upcoming one, not today
      }
      d.setDate(d.getDate()+diff);
      return{due:dateToStr(d),matched:m[0]};
    }

    // Explicit "Month Day" or "Month Day, Year" e.g. "june 20th" / "june 20 2026"
    var monPattern=new RegExp('\\b('+MONTH_NAMES_FULL.join('|')+')\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b');
    m=lower.match(monPattern);
    if(m){
      var monIdx=MONTH_NAMES_FULL.indexOf(m[1]);
      var day=parseInt(m[2],10);
      var year=m[3]?parseInt(m[3],10):new Date().getFullYear();
      var d2=new Date(year,monIdx,day);
      // If the date already passed this year and no year was specified, assume next year
      if(!m[3]&&d2<new Date(new Date().toDateString()))d2.setFullYear(year+1);
      return{due:dateToStr(d2),matched:m[0]};
    }

    // Numeric "M/D" or "M/D/YYYY"
    var numPattern=/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
    m=lower.match(numPattern);
    if(m){
      var mo=parseInt(m[1],10)-1;
      var da=parseInt(m[2],10);
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

  function todayStr(){
    var d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function tomorrowStr(){
    var d=new Date();d.setDate(d.getDate()+1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function fmtDue(due){
    if(!due)return'';
    var today=todayStr(),tom=tomorrowStr();
    if(due===today)return'Today';
    if(due===tom)return'Tomorrow';
    if(due<today)return'Overdue · '+due;
    // Show short date
    var parts=due.split('-');
    var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(parts[1])-1]+' '+parseInt(parts[2]);
  }

  // ── Render ────────────────────────────────────────────────
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function render(){
    var list=document.getElementById('cal-list');
    if(!list)return;
    if(!tasks.length){
      list.innerHTML='<div class="cal-empty">No tasks yet.<br>Add one above, or say<br>"add task [name]" to Baker.</div>';
      updateNavBadge();
      _syncMonthGrid();
      return;
    }

    var today=todayStr();
    var groups={overdue:[],today:[],tomorrow:[],upcoming:[],noDate:[],done:[]};
    var tom=tomorrowStr();

    tasks.forEach(function(t){
      if(t.done){groups.done.push(t);return;}
      if(!t.due){groups.noDate.push(t);return;}
      if(t.due<today)groups.overdue.push(t);
      else if(t.due===today)groups.today.push(t);
      else if(t.due===tom)groups.tomorrow.push(t);
      else groups.upcoming.push(t);
    });

    function sortByDue(a,b){return(a.due||'9999').localeCompare(b.due||'9999');}
    groups.upcoming.sort(sortByDue);

    var html='';
    function renderGroup(label,cls,items){
      if(!items.length)return;
      html+='<div class="cal-group-label'+(cls?' '+cls:'')+'">'+label+' ('+items.length+')</div>';
      items.forEach(function(t){renderItem(t);});
    }
    function renderItem(t){
      var dueLbl=fmtDue(t.due);
      var dueCls=(t.due&&t.due<today&&!t.done)?'overdue':'';
      html+='<div class="cal-item'+(t.done?' done':'')+'" data-id="'+t.id+'">'+
        '<button class="cal-check'+(t.done?' done':'')+'" data-action="toggle" data-id="'+t.id+'">'+
        '<svg viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l3.5 3.5L13 4"/></svg>'+
        '</button>'+
        '<div class="cal-item-body">'+
        '<div class="cal-item-text">'+esc(t.text)+'</div>'+
        (dueLbl?'<div class="cal-item-date '+dueCls+'">'+dueLbl+'</div>':'')+
        '</div>'+
        '<button class="cal-del" data-action="delete" data-id="'+t.id+'">✕</button>'+
        '</div>';
    }

    renderGroup('Overdue','overdue',groups.overdue);
    renderGroup('Today','today',groups.today);
    renderGroup('Tomorrow','',groups.tomorrow);
    renderGroup('Upcoming','',groups.upcoming);
    renderGroup('No Date','',groups.noDate);
    renderGroup('Done','',groups.done);

    list.innerHTML=html;

    // Wire up clicks
    list.querySelectorAll('[data-action="toggle"]').forEach(btn=>{
      btn.addEventListener('click',()=>toggleTask(btn.dataset.id));
    });
    list.querySelectorAll('[data-action="delete"]').forEach(btn=>{
      btn.addEventListener('click',()=>deleteTask(btn.dataset.id));
    });

    updateNavBadge();
    _syncMonthGrid();
  }

  // Refresh month grid if it's open (cross-module sync, defined after MCAL loads)
  function _syncMonthGrid(){
    if(typeof MCAL!=='undefined'&&MCAL._refreshIfVisible)MCAL._refreshIfVisible();
  }

  function updateNavBadge(){
    var lbl=document.getElementById('cal-nav-lbl');
    if(!lbl)return;
    var today=todayStr();
    var dueCount=tasks.filter(t=>!t.done&&t.due&&t.due<=today).length;
    lbl.textContent=dueCount>0?('Tasks ('+dueCount+')'):'Tasks';
  }

  // ── Panel show/hide ───────────────────────────────────────
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
    if(p.classList.contains('cal-vis')){
      if(p._wbNormalise)p._wbNormalise();
      render();
    }
  }

  // ── Voice commands ────────────────────────────────────────
  // Returns a spoken response string, or null if not a task command
  async function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();

   // "add task X" / "add a task to X" / "remind me to X" / "schedule X for Y" / "add X to calendar for Y"
    var addM=c.match(/(?:add (?:a )?task(?: to)?|remind me to|add to my tasks?|new task|schedule(?: a)?|add)\s*[:]?\s*(.+?)(?:\s+(?:to|on)\s+(?:the\s+)?(?:calendar|tasks?|to.?do)\s*)?(?:\s+for\s+(.+))?$/);
    if(addM&&/(?:add (?:a )?task|remind me to|add to my tasks?|new task|schedule|add .+ to (?:the )?calendar)/.test(c)){
      var text=addM[1].trim();
      var dateText=(addM[2]||'').trim();
      var due='';

      // Try "for <date>" portion first, then fall back to scanning the whole text
      var combined=dateText||text;
      var parsed=parseDateFromText(combined);
      if(parsed){
        due=parsed.due;
        // Remove the matched date phrase from whichever string it came from
        if(dateText){dateText=dateText.replace(parsed.matched,'').trim();}
        else{text=text.replace(parsed.matched,'').trim();}
      }

      // If we still have leftover dateText that wasn't a date, fold it back into the task text
      if(dateText)text=(text+' '+dateText).trim();

      text=text.replace(/\s+/g,' ').replace(/^(to|for)\s+/,'').replace(/\s+(to|for)$/,'').trim();
      if(!text)return'What should I add, sir?';
      addTask(text,due);
      showPanel();
      var dueLabel='';
      if(due){
        if(due===todayStr())dueLabel=', due today';
        else if(due===tomorrowStr())dueLabel=', due tomorrow';
        else dueLabel=', due '+fmtDue(due);
      }
      return'Added "'+text+'" to your tasks'+dueLabel+', sir.';
    }

    // "complete task X" / "mark X done" / "finish X" / "check off X"
    var doneM=c.match(/(?:complete|finish|check off|mark (?:as )?done|mark .* (?:as )?done)\s*[:]?\s*(.+)/)||c.match(/mark\s+(.+?)\s+(?:as\s+)?done/);
    if(doneM){
      var query=doneM[1].trim();
      var t=findTaskByText(query);
      if(!t)return'I couldn\'t find a task matching "'+query+'", sir.';
      t.done=true;render();scheduleSave();showPanel();
      return'Marked "'+t.text+'" as done, sir.';
    }

    // "delete task X" / "remove task X"
    var delM=c.match(/(?:delete|remove)\s+(?:task|the task)?\s*[:]?\s*(.+)/);
    if(delM){
      var dquery=delM[1].trim();
      var dt=findTaskByText(dquery);
      if(!dt)return'I couldn\'t find a task matching "'+dquery+'", sir.';
      deleteTask(dt.id);showPanel();
      return'Removed "'+dt.text+'" from your tasks, sir.';
    }

    // "what are my tasks" / "list my tasks" / "show my tasks" / "what's on my list"
    if(/\b(my tasks|my to.?do|task list|what.?s on my (list|plate))\b/.test(c)){
      showPanel();
      var pending=tasks.filter(t=>!t.done);
      if(!pending.length)return'Your task list is clear, sir.';
      var today=todayStr();
      var dueToday=pending.filter(t=>t.due===today);
      var overdue=pending.filter(t=>t.due&&t.due<today);
      var parts=[];
      if(overdue.length)parts.push(overdue.length+' overdue');
      if(dueToday.length)parts.push(dueToday.length+' due today');
      parts.push(pending.length+' total pending');
      var summary='You have '+parts.join(', ')+'.';
      if(dueToday.length){
        summary+=' Today: '+dueToday.slice(0,3).map(t=>t.text).join(', ')+'.';
      }
      return summary;
    }

    // "open tasks" / "pull up my todo list" / "let's check my tasks" etc.
    if(/\b(open|pull up|show|let'?s (open|check|see))\b.*\b(tasks?|to.?do|task list)\b/.test(c)){
      showPanel();
      return'Here are your tasks, sir.';
    }

    return null; // not a task command
  }

  // ── Init ──────────────────────────────────────────────────
  var addInputEl,addDateEl,addBtnEl;
  async function init(){
    loadLocal();
    addInputEl=document.getElementById('cal-add-input');
    addDateEl=document.getElementById('cal-add-date');
    addBtnEl=document.getElementById('cal-add-btn');

    if(addBtnEl)addBtnEl.addEventListener('click',submitAdd);
    if(addInputEl)addInputEl.addEventListener('keydown',e=>{if(e.key==='Enter')submitAdd();});

    render();

    // If vault already connected at init, sync
    if(typeof vaultConnected!=='undefined'&&vaultConnected){
      await syncFromVault();render();
    }
  }
  function submitAdd(){
    var text=addInputEl.value.trim();
    if(!text)return;
    var due=addDateEl.value||'';
    addTask(text,due);
    addInputEl.value='';addDateEl.value='';
    addInputEl.focus();
  }

  // Called externally (from doConnect) once vault connects
  async function onVaultConnected(){
    await syncFromVault();render();
    var footer=document.getElementById('cal-footer');
    if(footer){footer.textContent='✓ Synced to vault';footer.className='cal-footer synced';}
  }

  return{init,showPanel,hidePanel,togglePanel,handleVoice,addTask,onVaultConnected,
    getTasks:()=>tasks,
    refreshAll:render,
    deleteTask,toggleTask,
    notifyChange:scheduleSave};
})();

// ═══════════════════════════════════════════════════════════
// ══  MONTH CALENDAR MODULE (MCAL)  ══════════════════════════
// ═══════════════════════════════════════════════════════════
var MCAL=(function(){
  var viewYear,viewMonth; // 0-indexed month
  var selectedDate=null;  // YYYY-MM-DD when detail view open
  var MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function pad(n){return String(n).padStart(2,'0');}
  function dateStr(y,m,d){return y+'-'+pad(m+1)+'-'+pad(d);}
  function todayStr(){var d=new Date();return dateStr(d.getFullYear(),d.getMonth(),d.getDate());}

  // ── Daily log lookup ──────────────────────────────────────
  // Returns the raw markdown content of 00-Capture/YYYY-MM-DD.md if it exists, else null
  function getDailyLogContent(ds){
    if(typeof vaultIndex==='undefined'||!vaultIndex.length)return null;
    var fname=ds+'.md';
    var note=vaultIndex.find(function(n){return n.path==='00-Capture/'+fname||n.name===fname&&n.path.indexOf('00-Capture')===0;});
    return note?note.content:null;
  }
  // Extracts bullet lines from a daily log for display
  function getDailyLogBullets(content){
    if(!content)return[];
    return content.split('\n').filter(function(l){return /^\s*-\s+/.test(l);}).map(function(l){return l.replace(/^\s*-\s+/,'').trim();});
  }

  // ── Build grid for current viewYear/viewMonth ────────────
  function buildGrid(){
    var grid=document.getElementById('mcal-days');
    if(!grid)return;
    document.getElementById('mcal-monthlbl').textContent=MONTH_NAMES[viewMonth]+' '+viewYear;

    var tasks=CAL.getTasks();
    var today=todayStr();

    // Count tasks per date
    var counts={}, overdueDates={};
    tasks.forEach(function(t){
      if(!t.due)return;
      counts[t.due]=(counts[t.due]||0)+(t.done?0:1);
      if(!t.done&&t.due<today)overdueDates[t.due]=true;
    });

    var firstDow=new Date(viewYear,viewMonth,1).getDay(); // 0=Sun
    var daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
    var daysInPrevMonth=new Date(viewYear,viewMonth,0).getDate();

    var cells=[];
    // Leading days from previous month
    for(var i=firstDow-1;i>=0;i--){
      var d=daysInPrevMonth-i;
      var pm=viewMonth-1,py=viewYear;
      if(pm<0){pm=11;py--;}
      cells.push({y:py,m:pm,d:d,other:true});
    }
    // Current month
    for(var d2=1;d2<=daysInMonth;d2++){
      cells.push({y:viewYear,m:viewMonth,d:d2,other:false});
    }
    // Trailing days to fill 6 rows (42 cells)
    var nm=viewMonth+1,ny=viewYear;
    if(nm>11){nm=0;ny++;}
    var nd=1;
    while(cells.length<42){
      cells.push({y:ny,m:nm,d:nd,other:true});nd++;
    }

    var html='';
    cells.forEach(function(c){
      var ds=dateStr(c.y,c.m,c.d);
      var isToday=ds===today;
      var cnt=counts[ds]||0;
      var hasLog=!!getDailyLogContent(ds);
      var cls='mcal-day';
      if(c.other)cls+=' other-month';
      if(isToday)cls+=' today';
      if(cnt>0)cls+=overdueDates[ds]?' has-overdue':' has-tasks';
      var badges='';
      if(cnt>0)badges+='<div class="mcal-daycount">'+cnt+' task'+(cnt>1?'s':'')+'</div>';
      if(hasLog)badges+='<div class="mcal-logicon" title="Daily log available">📝</div>';
      html+='<div class="'+cls+'" data-date="'+ds+'">'+
        '<div class="mcal-daynum">'+c.d+'</div>'+
        badges+
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
    if(input){input.value='';setTimeout(()=>input.focus(),50);}
  }
  function closeDay(){
    document.getElementById('mcal-detail').classList.remove('vis');
    selectedDate=null;
    buildGrid(); // refresh counts/dots in case tasks changed
  }
 function renderDetailList(){
    var list=document.getElementById('mcal-detail-list');
    if(!list||!selectedDate)return;
    var tasks=CAL.getTasks().filter(t=>t.due===selectedDate);

    // Daily log summary, if present
    var logContent=getDailyLogContent(selectedDate);
    var logHtml='';
    if(logContent){
      var bullets=getDailyLogBullets(logContent);
      if(bullets.length){
        logHtml='<div style="padding:8px 6px;margin-bottom:6px;border-bottom:1px solid var(--border)">'+
          '<div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:5px">📝 Daily log</div>'+
          bullets.map(function(b){return '<div style="font-size:11px;color:var(--text);line-height:1.6;margin-bottom:2px">· '+esc(b)+'</div>';}).join('')+
          '</div>';
      }
    }

    if(!tasks.length){
      list.innerHTML=logHtml+'<div class="mcal-detail-empty">Nothing scheduled for this day.<br>Add a task above.</div>';
      return;
    }
   // Sort: pending first, then done
    tasks.sort((a,b)=>(a.done?1:0)-(b.done?1:0));
    var html=logHtml;
    tasks.forEach(function(t){
      html+='<div class="cal-item'+(t.done?' done':'')+'" data-id="'+t.id+'">'+
        '<button class="cal-check'+(t.done?' done':'')+'" data-action="toggle" data-id="'+t.id+'">'+
        '<svg viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l3.5 3.5L13 4"/></svg>'+
        '</button>'+
        '<div class="cal-item-body"><div class="cal-item-text">'+esc(t.text)+'</div></div>'+
        '<button class="cal-del" data-action="delete" data-id="'+t.id+'">✕</button>'+
        '</div>';
    });
    list.innerHTML=html;
    list.querySelectorAll('[data-action="toggle"]').forEach(btn=>{
      btn.addEventListener('click',function(){
        CAL.toggleTask(btn.dataset.id);
        renderDetailList();
        CAL.refreshAll();
      });
    });
    list.querySelectorAll('[data-action="delete"]').forEach(btn=>{
      btn.addEventListener('click',function(){
        CAL.deleteTask(btn.dataset.id);
        renderDetailList();
        CAL.refreshAll();
        buildGrid();
      });
    });
  }
  function addToSelectedDay(){
    var input=document.getElementById('mcal-detail-input');
    var text=input.value.trim();
    if(!text||!selectedDate)return;
    CAL.addTask(text,selectedDate);
    input.value='';
    renderDetailList();
    buildGrid();
  }

  // ── Navigation ────────────────────────────────────────────
  function prevMonth(){viewMonth--;if(viewMonth<0){viewMonth=11;viewYear--;}buildGrid();}
  function nextMonth(){viewMonth++;if(viewMonth>11){viewMonth=0;viewYear++;}buildGrid();}
  function goToday(){var d=new Date();viewYear=d.getFullYear();viewMonth=d.getMonth();buildGrid();}

  // ── Panel show/hide ───────────────────────────────────────
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
    if(p.classList.contains('mcal-vis')){
      if(p._wbNormalise)p._wbNormalise();
      buildGrid();
    }else{
      document.getElementById('mcal-detail').classList.remove('vis');
      selectedDate=null;
    }
  }

  // ── Voice ─────────────────────────────────────────────────
  // Returns spoken response or null if not a calendar-view command
  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(/\b(open|pull up|show|let'?s (open|check|see))\b.*\b(calendar|month( view)?)\b/.test(c)||/\bcalendar view\b/.test(c)){
      showPanel();return'Here\'s your calendar, sir.';
    }
    if(/\bnext month\b/.test(c)&&document.getElementById('month-panel').classList.contains('mcal-vis')){
      nextMonth();return'Showing '+MONTH_NAMES[viewMonth]+', sir.';
    }
    if(/\b(previous|last) month\b/.test(c)&&document.getElementById('month-panel').classList.contains('mcal-vis')){
      prevMonth();return'Showing '+MONTH_NAMES[viewMonth]+', sir.';
    }
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

// ═══════════════════════════════════════════════════════════
// ══  VAULT NOTES BROWSER MODULE (VAULTUI)  ══════════════════
// ═══════════════════════════════════════════════════════════
var VAULTUI=(function(){
  var searchInput,listEl,viewerEl,viewerTitleEl,viewerContentEl,backBtn;

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  // ── List rendering ────────────────────────────────────────
  function renderList(query){
    if(!listEl)return;
    if(typeof vaultIndex==='undefined'||!vaultIndex.length){
      listEl.innerHTML='<div class="vp-empty">No vault connected.<br>Click "Connect Vault" in the nav bar to browse your notes here.</div>';
      return;
    }
    var q=(query||'').toLowerCase().trim();
    var items=vaultIndex;
    if(q){
      items=vaultIndex.filter(function(n){
        return n.name.toLowerCase().includes(q)||n.path.toLowerCase().includes(q)||n.content.toLowerCase().includes(q);
      });
    }
    if(!items.length){
      listEl.innerHTML='<div class="vp-empty">No notes match "'+esc(query)+'".</div>';
      return;
    }
    // Sort alphabetically by name, cap at 200 for perf
    items=items.slice().sort((a,b)=>a.name.localeCompare(b.name)).slice(0,200);
    var html='';
    items.forEach(function(n,i){
      var icon=detectIcon(n.path);
      html+='<div class="vp-item" data-idx="'+vaultIndex.indexOf(n)+'">'+
        '<span class="vp-item-icon">'+icon+'</span>'+
        '<div class="vp-item-body">'+
        '<div class="vp-item-name">'+esc(n.name.replace(/\.md$/,''))+'</div>'+
        '<div class="vp-item-path">'+esc(n.path)+'</div>'+
        '</div></div>';
    });
    listEl.innerHTML=html;
    listEl.querySelectorAll('.vp-item').forEach(function(item){
      item.addEventListener('click',function(){openNote(parseInt(item.dataset.idx));});
    });
  }

  function detectIcon(path){
    var p=(path||'').toLowerCase();
    if(p.includes('conversation'))return'💬';
    if(p.includes('01-projects'))return'📁';
    if(p.includes('lecture'))return'🎓';
    if(p.includes('daily')||p.includes('07-system'))return'📆';
    return'📄';
  }

  // ── Note viewer ───────────────────────────────────────────
  function openNote(idx){
    var note=vaultIndex[idx];
    if(!note)return;
    viewerTitleEl.textContent=note.name.replace(/\.md$/,'');
    viewerContentEl.textContent=note.content;
    viewerEl.classList.add('vis');
  }
  function closeNote(){
    viewerEl.classList.remove('vis');
  }

  // ── Open a note by name match (for voice) ────────────────
  function findNoteByQuery(query){
    if(typeof vaultIndex==='undefined'||!vaultIndex.length)return null;
    query=query.toLowerCase().trim();
    // exact filename match
    var exact=vaultIndex.find(n=>n.name.toLowerCase().replace(/\.md$/,'')===query);
    if(exact)return exact;
    // contains match on name
    var partial=vaultIndex.find(n=>n.name.toLowerCase().includes(query));
    if(partial)return partial;
    // contains match on path
    return vaultIndex.find(n=>n.path.toLowerCase().includes(query));
  }

  // ── Panel show/hide ───────────────────────────────────────
  function showPanel(){
    var p=document.getElementById('vault-panel');
    p.classList.add('vp-vis');
    if(p._wbNormalise)p._wbNormalise();
    renderList(searchInput?searchInput.value:'');
  }
  function hidePanel(){
    document.getElementById('vault-panel').classList.remove('vp-vis');
    closeNote();
  }
  function togglePanel(){
    var p=document.getElementById('vault-panel');
    p.classList.toggle('vp-vis');
    if(p.classList.contains('vp-vis')){
      if(p._wbNormalise)p._wbNormalise();
      renderList(searchInput?searchInput.value:'');
    }else{
      closeNote();
    }
  }

  // ── Voice ─────────────────────────────────────────────────
  // Returns spoken response or null if not a vault-browse command
  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();

    // "open my notes" / "browse my vault" / "show my vault notes"
    if(/\b(open|pull up|show|browse|let'?s (open|check|see))\b.*\b(vault|notes?)\b/.test(c)&&!/\bnote\b.*\b(today|down|that)\b/.test(c)){
      // Distinguish from "show note <text>" (creates a text widget) — only match if no quoted/literal text follows naturally
      var specificMatch=c.match(/(?:pull up|open|show|find|search for)\s+(?:my\s+)?(?:note|notes?)\s+(?:on|about|called|named|titled)\s+(.+)/);
      if(specificMatch){
        var q=specificMatch[1].trim();
        var note=findNoteByQuery(q);
        if(!note){showPanel();return'I couldn\'t find a note matching "'+q+'", sir. Here\'s your vault.';}
        showPanel();openNote(vaultIndex.indexOf(note));
        return'Here\'s '+note.name.replace(/\.md$/,'')+', sir.';
      }
      showPanel();
      return typeof vaultIndex!=='undefined'&&vaultIndex.length?'Here\'s your vault, sir.':'Your vault isn\'t connected yet, sir.';
    }

    // "pull up my [note name]" / "find my note on X"
    var pullMatch=c.match(/(?:pull up|find|open)\s+(?:my\s+)?(.+?)\s+(?:note|notes)\b/);
    if(pullMatch){
      var pq=pullMatch[1].trim();
      var pnote=findNoteByQuery(pq);
      if(!pnote)return null; // let it fall through to other handlers
      showPanel();openNote(vaultIndex.indexOf(pnote));
      return'Here\'s '+pnote.name.replace(/\.md$/,'')+', sir.';
    }

    return null;
  }

  // ── Init ──────────────────────────────────────────────────
  function init(){
    searchInput=document.getElementById('vp-search-input');
    listEl=document.getElementById('vp-list');
    viewerEl=document.getElementById('vp-viewer');
    viewerTitleEl=document.getElementById('vp-viewer-title');
    viewerContentEl=document.getElementById('vp-viewer-content');
    backBtn=document.getElementById('vp-back');

    if(searchInput)searchInput.addEventListener('input',function(){renderList(searchInput.value);});
    if(backBtn)backBtn.addEventListener('click',closeNote);

    renderList('');
  }

  // Called externally when vault connects/disconnects to refresh list
  function refresh(){
    if(document.getElementById('vault-panel').classList.contains('vp-vis')){
      renderList(searchInput?searchInput.value:'');
    }
  }

  return{init,showPanel,hidePanel,togglePanel,handleVoice,refresh};
})();

// ═══════════════════════════════════════════════════════════
// ══  GRAPH SETTINGS (shared state consumed by the graph sim)  ══
// ═══════════════════════════════════════════════════════════
var GraphSettings={
  typeFilter:{conversation:true,project:true,lecture:true,daily:true,general:true},
  linkDistance:90,
  repulsion:100,
  sizeByConnections:false,
  showLabels:false,
  searchQuery:''
};
var DEFAULT_GRAPH_SETTINGS=JSON.parse(JSON.stringify(GraphSettings));

// ═══════════════════════════════════════════════════════════
// ══  GRAPH SETTINGS PANEL MODULE (GRAPHUI)  ══════════════════
// ═══════════════════════════════════════════════════════════
var GRAPHUI=(function(){
  function showPanel(){
    var p=document.getElementById('graphui-panel');
    p.classList.add('gui-vis');
    if(p._wbNormalise)p._wbNormalise();
  }
  function hidePanel(){document.getElementById('graphui-panel').classList.remove('gui-vis');}
  function togglePanel(){
    var p=document.getElementById('graphui-panel');
    p.classList.toggle('gui-vis');
    if(p.classList.contains('gui-vis')&&p._wbNormalise)p._wbNormalise();
  }

  function applyAndRebuild(){
    // Re-run the build so filters/sizing take effect; sim restarts gently
    if(typeof vaultConnected!=='undefined'&&vaultConnected&&typeof buildGraph==='function'){
      buildGraph();
    }
  }

  function bindControls(){
    // Type filters
    document.querySelectorAll('[data-gui-type]').forEach(function(cb){
      cb.addEventListener('change',function(){
        GraphSettings.typeFilter[cb.dataset.guiType]=cb.checked;
        applyAndRebuild();
      });
    });
    // Link distance
    var ld=document.getElementById('gui-linkdist');
    ld.addEventListener('input',function(){
      GraphSettings.linkDistance=parseInt(this.value,10);
      document.getElementById('gui-linkdist-val').textContent=this.value;
      // Live-tunable without full rebuild
    });
    // Repulsion
    var rp=document.getElementById('gui-repulsion');
    rp.addEventListener('input',function(){
      GraphSettings.repulsion=parseInt(this.value,10);
      document.getElementById('gui-repulsion-val').textContent=this.value;
    });
    // Size by connections
    document.getElementById('gui-sizebyconn').addEventListener('change',function(){
      GraphSettings.sizeByConnections=this.checked;
      applyAndRebuild();
    });
    // Always show labels
    document.getElementById('gui-showlabels').addEventListener('change',function(){
      GraphSettings.showLabels=this.checked;
    });
    // Search / highlight
    document.getElementById('gui-search-input').addEventListener('input',function(){
      GraphSettings.searchQuery=this.value.trim().toLowerCase();
    });
    // Reset
    document.getElementById('gui-reset-btn').addEventListener('click',function(){
      GraphSettings=JSON.parse(JSON.stringify(DEFAULT_GRAPH_SETTINGS));
      document.querySelectorAll('[data-gui-type]').forEach(function(cb){cb.checked=true;});
      document.getElementById('gui-linkdist').value=GraphSettings.linkDistance;
      document.getElementById('gui-linkdist-val').textContent=GraphSettings.linkDistance;
      document.getElementById('gui-repulsion').value=GraphSettings.repulsion;
      document.getElementById('gui-repulsion-val').textContent=GraphSettings.repulsion;
      document.getElementById('gui-sizebyconn').checked=false;
      document.getElementById('gui-showlabels').checked=false;
      document.getElementById('gui-search-input').value='';
      applyAndRebuild();
    });
  }

  // ── Voice ─────────────────────────────────────────────────
  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(/\b(open|pull up|show|let'?s (open|check|see))\b.*\b(graph settings|graph options|graph view settings)\b/.test(c)){
      showPanel();return'Here are your graph settings, sir.';
    }
    return null;
  }

  function init(){bindControls();}
  return{init,showPanel,hidePanel,togglePanel,handleVoice};
})();
