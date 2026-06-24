// ═══════════════════════════════════════════════════════════
// ══  ACADEMIC MODULE  ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Tracks: classes, assignments, grades (percentage)
// Layout: single scrolling view, collapsible sections
// Assignments auto-sync to CAL task panel with due dates
// 24h deadline reminders via Ntfy + browser
// Vault: saves semester summary to 07-System/Academic/
// ═══════════════════════════════════════════════════════════
var ACADEMIC=(function(){

  var LS_KEY='baker_academic_v1';
  var PANEL_ID='academic-panel';

  // Data schema:
  // semester: { name:'Fall 2026', classes:[{id,name,credits,color,assignments:[{id,name,due,done,reminded}], grade:null}] }
  var data={semester:'',classes:[],archived:[]};

  var _collapsed={};  // {sectionKey: bool}
  var _editingClass=null;
  var _editingAssignment=null;

  var CLASS_COLORS=['#7c6af7','#60a5fa','#4ade80','#f59e0b','#f87171','#c084fc','#38bdf8','#fb923c'];

  // ── Storage ───────────────────────────────────────────────
  function _load(){
    try{var r=localStorage.getItem(LS_KEY);if(r)data=JSON.parse(r);}
    catch(e){data={semester:'',classes:[],archived:[]};}
    if(!data.classes)data.classes=[];
    if(!data.archived)data.archived=[];
  }
  function _save(){
    try{localStorage.setItem(LS_KEY,JSON.stringify(data));}catch(e){}
    _syncToCAL();
    _checkReminders();
    if(typeof VAULTSYNC!=='undefined'&&VAULTSYNC.syncAcademic)VAULTSYNC.syncAcademic(data);
  }

  function _id(){return 'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);}

  // ── Sync assignments → CAL tasks ──────────────────────────
  function _syncToCAL(){
    if(typeof CAL==='undefined')return;
    data.classes.forEach(function(cls){
      (cls.assignments||[]).forEach(function(asgn){
        if(!asgn.due||asgn.done)return;
        // Check if already in CAL
        var tasks=CAL.getTasks();
        var taskText='['+cls.name+'] '+asgn.name;
        var exists=tasks.some(function(t){return t.text===taskText;});
        if(!exists){
          CAL.addTask(taskText,asgn.due);
          asgn.calSynced=true;
        }
      });
    });
  }

  // ── 24h reminders ─────────────────────────────────────────
  function _checkReminders(){
    if(typeof REMINDERS==='undefined')return;
    var tomorrow=new Date();
    tomorrow.setDate(tomorrow.getDate()+1);
    var tomorrowStr=tomorrow.getFullYear()+'-'+String(tomorrow.getMonth()+1).padStart(2,'0')+'-'+String(tomorrow.getDate()).padStart(2,'0');
    data.classes.forEach(function(cls){
      (cls.assignments||[]).forEach(function(asgn){
        if(asgn.done||asgn.reminded||!asgn.due)return;
        if(asgn.due===tomorrowStr){
          // Set a reminder for 9am tomorrow
          var target=new Date(tomorrow);
          target.setHours(9,0,0,0);
          REMINDERS.add('['+cls.name+'] '+asgn.name+' due tomorrow',target.getTime());
          asgn.reminded=true;
        }
      });
    });
  }

  // ── Vault save ────────────────────────────────────────────
  async function saveToVault(){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return false;
    try{
      var md='---\ntype: academic\nsemester: '+data.semester+'\n---\n\n';
      md+='# '+data.semester+'\n\n';
      data.classes.forEach(function(cls){
        var done=(cls.assignments||[]).filter(function(a){return a.done;}).length;
        var total=(cls.assignments||[]).length;
        var gradeStr=cls.grade!=null?cls.grade+'%':'In progress';
        md+='## '+cls.name+'\n\n';
        md+='**Grade:** '+gradeStr+' | **Progress:** '+done+'/'+total+' assignments\n\n';
        if(total){
          md+='| Assignment | Due | Status |\n|---|---|---|\n';
          (cls.assignments||[]).forEach(function(a){
            md+='| '+a.name+' | '+(a.due||'—')+' | '+(a.done?'Done':'Pending')+' |\n';
          });
          md+='\n';
        }
      });
      var dir=vaultHandle;
      dir=await dir.getDirectoryHandle('07-System',{create:true});
      dir=await dir.getDirectoryHandle('Academic',{create:true});
      var fname=data.semester.replace(/\s+/g,'-').toLowerCase()+'.md';
      var fh=await dir.getFileHandle(fname,{create:true});
      var w=await fh.createWritable();
      await w.write(md);await w.close();
      return true;
    }catch(e){console.error('[ACADEMIC] vault:',e);return false;}
  }

  // ── Helpers ───────────────────────────────────────────────
  function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function _todayStr(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function _daysUntil(due){
    if(!due)return null;
    var diff=Math.ceil((new Date(due+'T23:59:59')-new Date())/(1000*3600*24));
    return diff;
  }
  function _dueLabel(due){
    if(!due)return'';
    var d=_daysUntil(due);
    if(d<0)return'<span style="color:var(--red)">Overdue '+Math.abs(d)+'d</span>';
    if(d===0)return'<span style="color:var(--red)">Due today</span>';
    if(d===1)return'<span style="color:var(--amber)">Tomorrow</span>';
    if(d<=7)return'<span style="color:var(--amber)">'+d+'d</span>';
    return'<span style="color:var(--muted)">'+due+'</span>';
  }

  // ── Render ────────────────────────────────────────────────
  function render(){
    var panel=document.getElementById(PANEL_ID);
    if(!panel||!panel.classList.contains('acad-vis'))return;
    var body=document.getElementById('academic-body');
    if(!body)return;

    var html='';

    // ── Semester header ──
    html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">'+
      '<input id="acad-semester" value="'+_esc(data.semester)+'" placeholder="e.g. Fall 2026" '+
      'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-family:var(--mono);font-size:12px;color:var(--text);font-weight:600;outline:none">'+
      '<button id="acad-save-vault" style="background:none;border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer" title="Save to vault">&#128190;</button>'+
      '</div>';

    // ── Stats bar ──
    var totalClasses=data.classes.length;
    var totalAsgn=data.classes.reduce(function(s,c){return s+(c.assignments||[]).length;},0);
    var doneAsgn=data.classes.reduce(function(s,c){return s+(c.assignments||[]).filter(function(a){return a.done;}).length;},0);
    var overdueAsgn=data.classes.reduce(function(s,c){
      return s+(c.assignments||[]).filter(function(a){return!a.done&&a.due&&_daysUntil(a.due)<0;}).length;
    },0);

    html+='<div style="display:flex;gap:8px;margin-bottom:16px">'+
      _miniStat(totalClasses,'Classes','var(--accent)')+
      _miniStat(doneAsgn+'/'+totalAsgn,'Done','var(--green)')+
      (overdueAsgn?_miniStat(overdueAsgn,'Overdue','var(--red)'):_miniStat('0','Overdue','var(--muted)'))+
      '</div>';

    // ── Upcoming assignments across all classes ──
    var upcoming=[];
    data.classes.forEach(function(cls){
      (cls.assignments||[]).forEach(function(a){
        if(!a.done&&a.due){
          upcoming.push({cls:cls,asgn:a,days:_daysUntil(a.due)});
        }
      });
    });
    upcoming.sort(function(a,b){return(a.days||999)-(b.days||999);});
    var soonAsgn=upcoming.filter(function(u){return u.days!=null&&u.days<=7;});

    if(soonAsgn.length){
      html+='<div class="acad-section" id="acad-sect-upcoming">'+
        '<div class="acad-sect-hdr" data-sect="upcoming">'+
          '<span style="color:var(--amber)">&#9888; Due This Week ('+soonAsgn.length+')</span>'+
          '<span class="acad-chevron">'+((_collapsed['upcoming'])?'&#9658;':'&#9660;')+'</span>'+
        '</div>';
      if(!_collapsed['upcoming']){
        html+='<div class="acad-sect-body">';
        soonAsgn.forEach(function(u){
          html+='<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;background:var(--surface);border:1px solid var(--border);margin-bottom:4px">'+
            '<div style="width:8px;height:8px;border-radius:50%;background:'+u.cls.color+';flex-shrink:0"></div>'+
            '<span style="font-family:var(--mono);font-size:10px;color:var(--muted);width:90px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_esc(u.cls.name)+'</span>'+
            '<span style="font-family:var(--mono);font-size:11px;color:var(--text);flex:1">'+_esc(u.asgn.name)+'</span>'+
            _dueLabel(u.asgn.due)+
            '<button class="acad-done-btn" data-cls="'+u.cls.id+'" data-asgn="'+u.asgn.id+'" style="background:none;border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-size:10px;color:var(--muted);cursor:pointer">Done</button>'+
          '</div>';
        });
        html+='</div>';
      }
      html+='</div>';
    }

    // ── Classes ──
    html+='<div class="acad-section" id="acad-sect-classes">'+
      '<div class="acad-sect-hdr" data-sect="classes">'+
        '<span>Classes ('+totalClasses+')</span>'+
        '<div style="display:flex;align-items:center;gap:8px">'+
          '<button id="acad-add-class" style="background:none;border:1px solid var(--accent-dim);border-radius:4px;padding:2px 8px;font-family:var(--mono);font-size:9px;color:var(--accent);cursor:pointer">+ Class</button>'+
          '<span class="acad-chevron">'+((_collapsed['classes'])?'&#9658;':'&#9660;')+'</span>'+
        '</div>'+
      '</div>';

    if(!_collapsed['classes']){
      html+='<div class="acad-sect-body">';
      if(!totalClasses){
        html+='<div style="font-family:var(--mono);font-size:10px;color:var(--muted);padding:10px 4px">No classes yet. Click + Class to add one.</div>';
      }
      data.classes.forEach(function(cls){
        var clsDone=(cls.assignments||[]).filter(function(a){return a.done;}).length;
        var clsTotal=(cls.assignments||[]).length;
        var pct=clsTotal?Math.round(clsDone/clsTotal*100):0;
        html+='<div class="acad-class-card" style="border-left:3px solid '+cls.color+'">'+
          // Class header
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'+
            '<span style="font-family:var(--mono);font-size:12px;color:var(--text);font-weight:600;flex:1">'+_esc(cls.name)+'</span>'+
            (cls.grade!=null?'<span style="font-family:var(--mono);font-size:11px;color:'+(cls.grade>=90?'var(--green)':cls.grade>=80?'var(--accent)':cls.grade>=70?'var(--amber)':'var(--red)')+'">'+cls.grade+'%</span>':'')+
            '<button class="acad-edit-cls" data-id="'+cls.id+'" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px">&#9998;</button>'+
            '<button class="acad-del-cls" data-id="'+cls.id+'" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px">&#215;</button>'+
          '</div>'+
          // Progress bar
          (clsTotal?'<div style="height:3px;background:var(--border);border-radius:2px;margin-bottom:8px"><div style="height:100%;width:'+pct+'%;background:'+cls.color+';border-radius:2px;transition:width .3s"></div></div>':'')+
          // Grade input
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">'+
            '<span style="font-family:var(--mono);font-size:9px;color:var(--muted)">GRADE</span>'+
            '<input type="number" class="acad-grade-inp" data-id="'+cls.id+'" value="'+(cls.grade!=null?cls.grade:'')+'" min="0" max="100" step="0.1" placeholder="—" '+
            'style="width:60px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 6px;font-family:var(--mono);font-size:11px;color:var(--text);text-align:center;outline:none"> %'+
          '</div>'+
          // Assignments
          '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.08em;margin-bottom:6px">ASSIGNMENTS ('+clsDone+'/'+clsTotal+')</div>'+
          '<div class="acad-asgn-list" data-cls="'+cls.id+'">';

        (cls.assignments||[]).forEach(function(asgn){
          html+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+
            '<button class="acad-done-btn" data-cls="'+cls.id+'" data-asgn="'+asgn.id+'" style="'+
            'width:18px;height:18px;border-radius:50%;border:1.5px solid '+(asgn.done?'var(--green)':'var(--border)')+';'+
            'background:'+(asgn.done?'rgba(74,222,128,.15)':'none')+';cursor:pointer;flex-shrink:0;font-size:9px">'+
            (asgn.done?'&#10003;':'')+'</button>'+
            '<span style="font-family:var(--mono);font-size:10px;color:'+(asgn.done?'var(--muted)':'var(--text)')+';flex:1;'+(asgn.done?'text-decoration:line-through':'')+'">'
            +_esc(asgn.name)+'</span>'+
            _dueLabel(asgn.due)+
            '<button class="acad-del-asgn" data-cls="'+cls.id+'" data-asgn="'+asgn.id+'" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;padding:0">&#215;</button>'+
          '</div>';
        });

        // Add assignment form
        html+='</div>'+
          '<div style="display:flex;gap:5px;margin-top:6px">'+
            '<input class="acad-new-asgn" data-cls="'+cls.id+'" placeholder="Add assignment..." '+
            'style="flex:1;background:var(--bg);border:1px dashed var(--border);border-radius:4px;padding:4px 8px;font-family:var(--mono);font-size:10px;color:var(--text);outline:none">'+
            '<input type="date" class="acad-new-due" data-cls="'+cls.id+'" '+
            'style="width:120px;background:var(--bg);border:1px dashed var(--border);border-radius:4px;padding:4px 6px;font-family:var(--mono);font-size:10px;color:var(--muted);outline:none">'+
            '<button class="acad-add-asgn" data-cls="'+cls.id+'" style="background:none;border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer">+</button>'+
          '</div>'+
        '</div>';
      });
      html+='</div>';
    }
    html+='</div>';

    body.innerHTML=html;
    _bindEvents();
  }

  function _miniStat(val,label,color){
    return '<div style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px;text-align:center">'+
      '<div style="font-family:var(--mono);font-size:16px;font-weight:700;color:'+color+'">'+val+'</div>'+
      '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);margin-top:2px">'+label+'</div>'+
      '</div>';
  }

  function _bindEvents(){
    // Semester name
    var semInp=document.getElementById('acad-semester');
    if(semInp)semInp.addEventListener('change',function(){data.semester=this.value.trim();_save();});

    // Save to vault
    var vaultBtn=document.getElementById('acad-save-vault');
    if(vaultBtn)vaultBtn.addEventListener('click',async function(){
      vaultBtn.textContent='&#8987;';
      var ok=await saveToVault();
      vaultBtn.textContent=ok?'&#10003;':'&#9888;';
      setTimeout(function(){vaultBtn.textContent='&#128190;';},2000);
    });

    // Add class
    var addClassBtn=document.getElementById('acad-add-class');
    if(addClassBtn)addClassBtn.addEventListener('click',function(){
      var name=window.prompt('Class name:');
      if(!name)return;
      data.classes.push({id:_id(),name:name.trim(),color:CLASS_COLORS[data.classes.length%CLASS_COLORS.length],assignments:[],grade:null});
      _save();render();
    });

    // Section collapse
    document.querySelectorAll('.acad-sect-hdr').forEach(function(hdr){
      hdr.addEventListener('click',function(e){
        if(e.target.closest('button'))return;
        var sect=hdr.dataset.sect;
        _collapsed[sect]=!_collapsed[sect];
        render();
      });
    });

    // Grade inputs
    document.querySelectorAll('.acad-grade-inp').forEach(function(inp){
      inp.addEventListener('change',function(){
        var cls=data.classes.find(function(c){return c.id===inp.dataset.id;});
        if(cls)cls.grade=inp.value!==''?parseFloat(inp.value):null;
        _save();render();
      });
    });

    // Done buttons
    document.querySelectorAll('.acad-done-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        var cls=data.classes.find(function(c){return c.id===btn.dataset.cls;});
        if(!cls)return;
        var asgn=(cls.assignments||[]).find(function(a){return a.id===btn.dataset.asgn;});
        if(!asgn)return;
        asgn.done=!asgn.done;
        // Remove from CAL if done
        if(asgn.done&&typeof CAL!=='undefined'){
          var tasks=CAL.getTasks();
          var taskText='['+cls.name+'] '+asgn.name;
          var t=tasks.find(function(t){return t.text===taskText;});
          if(t){CAL.toggleTask(t.id);}
        }
        _save();render();
      });
    });

    // Delete assignment
    document.querySelectorAll('.acad-del-asgn').forEach(function(btn){
      btn.addEventListener('click',function(){
        var cls=data.classes.find(function(c){return c.id===btn.dataset.cls;});
        if(!cls)return;
        cls.assignments=(cls.assignments||[]).filter(function(a){return a.id!==btn.dataset.asgn;});
        _save();render();
      });
    });

    // Delete class
    document.querySelectorAll('.acad-del-cls').forEach(function(btn){
      btn.addEventListener('click',function(){
        if(!window.confirm('Delete this class and all its assignments?'))return;
        data.classes=data.classes.filter(function(c){return c.id!==btn.dataset.id;});
        _save();render();
      });
    });

    // Add assignment
    document.querySelectorAll('.acad-add-asgn').forEach(function(btn){
      btn.addEventListener('click',function(){_addAssignment(btn.dataset.cls);});
    });
    document.querySelectorAll('.acad-new-asgn').forEach(function(inp){
      inp.addEventListener('keydown',function(e){if(e.key==='Enter')_addAssignment(inp.dataset.cls);});
    });
  }

  function _addAssignment(clsId){
    var cls=data.classes.find(function(c){return c.id===clsId;});
    if(!cls)return;
    var nameInp=document.querySelector('.acad-new-asgn[data-cls="'+clsId+'"]');
    var dueInp=document.querySelector('.acad-new-due[data-cls="'+clsId+'"]');
    var name=nameInp?nameInp.value.trim():'';
    var due=dueInp?dueInp.value:'';
    if(!name)return;
    if(!cls.assignments)cls.assignments=[];
    cls.assignments.push({id:_id(),name:name,due:due,done:false,reminded:false});
    if(nameInp)nameInp.value='';
    if(dueInp)dueInp.value='';
    _save();render();
  }

  // ── Panel ─────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    p.classList.add('acad-vis');
    if(p._wbNormalise)p._wbNormalise();
    render();
  }
  function hidePanel(){var p=document.getElementById(PANEL_ID);if(p)p.classList.remove('acad-vis');}
  function togglePanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    if(p.classList.contains('acad-vis'))hidePanel();else showPanel();
  }

  // ── Voice ─────────────────────────────────────────────────
  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(/\b(open|show|pull up)\b.*\b(academic|classes|semester|homework|assignments)\b/.test(c)){
      showPanel();return'Here are your academics, sir.';
    }
    if(/\bwhat.*\b(assignments?|homework|due)\b/.test(c)){
      var upcoming=[];
      data.classes.forEach(function(cls){
        (cls.assignments||[]).forEach(function(a){
          if(!a.done&&a.due){
            var d=Math.ceil((new Date(a.due+'T23:59:59')-new Date())/(1000*3600*24));
            if(d<=7)upcoming.push('['+cls.name+'] '+a.name+' in '+d+'d');
          }
        });
      });
      if(!upcoming.length)return'No assignments due in the next week, sir.';
      return'Coming up: '+upcoming.slice(0,3).join(', ')+', sir.';
    }
    return null;
  }

  function init(){_load();}

  function importData(imported){
    if(!imported)return;
    if(imported.semester)data.semester=imported.semester;
    if(imported.classes&&imported.classes.length){
      // Merge: add classes not already present
      imported.classes.forEach(function(ic){
        var exists=data.classes.some(function(c){return c.name===ic.name;});
        if(!exists)data.classes.push(ic);
      });
    }
    try{localStorage.setItem(LS_KEY,JSON.stringify(data));}catch(e){}
    render();
  }
  return{init,showPanel,hidePanel,togglePanel,handleVoice,saveToVault,importData};
})();
