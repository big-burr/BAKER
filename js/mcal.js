// mcal.js — Month calendar module (MCAL)
// Depends on: CAL (cal.js must load first), vaultIndex

var MCAL=(function(){
  var viewYear,viewMonth;
  var selectedDate=null;
  var MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function pad(n){return String(n).padStart(2,'0');}
  function dateStr(y,m,d){return y+'-'+pad(m+1)+'-'+pad(d);}
  function todayStr(){var d=new Date();return dateStr(d.getFullYear(),d.getMonth(),d.getDate());}

  function getDailyLogContent(ds){
    if(typeof vaultIndex==='undefined'||!vaultIndex.length)return null;
    var fname=ds+'.md';
    var note=vaultIndex.find(function(n){
      return n.path==='00-Capture/'+fname||(n.name===fname&&n.path.indexOf('00-Capture')===0);
    });
    return note?note.content:null;
  }

  // Exclude checkbox lines so they don't double-render alongside the task list
  function getDailyLogBullets(content){
    if(!content)return[];
    return content.split('\n').filter(function(l){
      return /^\s*-\s+/.test(l)&&!/^\s*-\s*\[[ xX]\]/.test(l);
    }).map(function(l){return l.replace(/^\s*-\s+/,'').trim();});
  }

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
        (hasLog?'<div class="mcal-logicon" title="Daily log available">&#128221;</div>':'')+
        '</div>';
    });
    grid.innerHTML=html;
    grid.querySelectorAll('.mcal-day').forEach(function(cell){
      cell.addEventListener('click',function(){openDay(cell.dataset.date);});
    });
  }

  function openDay(ds){
    selectedDate=ds;
    var detail=document.getElementById('mcal-detail');
    var parts=ds.split('-');
    var dObj=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2]));
    var dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var label=dayNames[dObj.getDay()]+', '+MONTH_NAMES[dObj.getMonth()]+' '+dObj.getDate()+', '+dObj.getFullYear();
    if(ds===todayStr())label='Today \u2014 '+label;
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
    var logContent=getDailyLogContent(selectedDate);
    var logHtml='';
    if(logContent){
      var bullets=getDailyLogBullets(logContent);
      if(bullets.length){
        logHtml='<div style="padding:8px 6px;margin-bottom:6px;border-bottom:1px solid var(--border)">'+
          '<div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:5px">&#128221; Daily log</div>'+
          bullets.map(function(b){return'<div style="font-size:11px;color:var(--text);line-height:1.6;margin-bottom:2px">&#183; '+esc(b)+'</div>';}).join('')+
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
        '<button class="cal-del" data-action="delete" data-id="'+esc(t.id)+'">&times;</button>'+
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

  function prevMonth(){viewMonth--;if(viewMonth<0){viewMonth=11;viewYear--;}buildGrid();}
  function nextMonth(){viewMonth++;if(viewMonth>11){viewMonth=0;viewYear++;}buildGrid();}
  function goToday(){var d=new Date();viewYear=d.getFullYear();viewMonth=d.getMonth();buildGrid();}

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

  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(/\b(open|pull up|show|let'?s (open|check|see))\b.*\b(calendar|month( view)?)\b/.test(c)||/\bcalendar view\b/.test(c)){
      showPanel();return"Here's your calendar, sir.";
    }
    var isVis=document.getElementById('month-panel').classList.contains('mcal-vis');
    if(/\bnext month\b/.test(c)&&isVis){nextMonth();return'Showing '+MONTH_NAMES[viewMonth]+', sir.';}
    if(/\b(previous|last) month\b/.test(c)&&isVis){prevMonth();return'Showing '+MONTH_NAMES[viewMonth]+', sir.';}
    return null;
  }

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
