// ═══════════════════════════════════════════════════════════
// ══  VAULT SYNC MODULE  ════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Central vault persistence layer — reads and writes all
// module data as structured markdown notes in the vault.
// Zero API cost — pure file IO via File System Access API.
//
// Vault paths:
//   07-System/Tasks.md          ← CAL tasks
//   07-System/Strength/split.md ← Strength split
//   07-System/Budget/budget.md  ← Budget data
//   07-System/Academic/current.md ← Academic semester
//   07-System/Biometrics/log.md ← Biometric log
//   07-System/Reminders.md      ← Active reminders
//   07-System/Memory.md         ← BAKER persistent memory
// ═══════════════════════════════════════════════════════════
var VAULTSYNC=(function(){

  var _ready=false;
  var _writeQueue={};  // path → pending write timer
  var DEBOUNCE=1200;   // ms to wait before writing after a change

  // ── Core write helper ─────────────────────────────────────
  async function _write(subpath,content){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return false;
    try{
      var parts=('07-System/'+subpath).split('/');
      var dir=vaultHandle;
      for(var i=0;i<parts.length-1;i++){
        dir=await dir.getDirectoryHandle(parts[i],{create:true});
      }
      var fname=parts[parts.length-1];
      var fh=await dir.getFileHandle(fname,{create:true});
      var w=await fh.createWritable();
      await w.write(content);
      await w.close();
      // Spawn birth particle — this triggers a graph rebuild via spawnBirthParticle
      var fullPath='07-System/'+subpath;
      if(typeof spawnBirthParticle==='function'){
        spawnBirthParticle('system',fullPath);
      }else if(typeof buildGraph==='function'){
        // Fallback if particles not available
        setTimeout(buildGraph,600);
      }
      return true;
    }catch(e){
      console.error('[VAULTSYNC] write error:',subpath,e);
      return false;
    }
  }

  // ── Core read helper ──────────────────────────────────────
  async function _read(subpath){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return null;
    try{
      var parts=('07-System/'+subpath).split('/');
      var dir=vaultHandle;
      for(var i=0;i<parts.length-1;i++){
        try{dir=await dir.getDirectoryHandle(parts[i]);}
        catch(e){return null;} // folder doesn't exist yet
      }
      var fname=parts[parts.length-1];
      var fh=await dir.getFileHandle(fname);
      return await(await fh.getFile()).text();
    }catch(e){return null;}
  }

  // ── Debounced write (prevents hammering on rapid changes) ─
  function scheduleWrite(subpath,contentFn){
    if(_writeQueue[subpath])clearTimeout(_writeQueue[subpath]);
    _writeQueue[subpath]=setTimeout(async function(){
      delete _writeQueue[subpath];
      var content=typeof contentFn==='function'?contentFn():contentFn;
      await _write(subpath,content);
    },DEBOUNCE);
  }

  // ══════════════════════════════════════════════════════════
  // TASKS (CAL)
  // ══════════════════════════════════════════════════════════
  function _tasksToMd(tasks){
    var now=new Date().toISOString();
    var md='---\ntype: system-tasks\nupdated: '+now+'\n---\n\n# BAKER Tasks\n\n';
    var pending=tasks.filter(function(t){return!t.done;});
    var done=tasks.filter(function(t){return t.done;});
    if(pending.length){
      md+='## Pending\n\n';
      pending.forEach(function(t){
        md+='- [ ] '+t.text+(t.due?' `due:'+t.due+'`':'')+'\n';
      });
      md+='\n';
    }
    if(done.length){
      md+='## Completed\n\n';
      done.slice(0,50).forEach(function(t){
        md+='- [x] '+t.text+(t.due?' `due:'+t.due+'`':'')+'\n';
      });
    }
    return md;
  }

  function _tasksFromMd(md){
    var tasks=[];
    var lines=md.split('\n');
    var id=1;
    lines.forEach(function(line){
      var pendM=line.match(/^- \[ \] (.+)$/);
      var doneM=line.match(/^- \[x\] (.+)$/);
      var m=pendM||doneM;
      if(!m)return;
      var raw=m[1];
      var dueM=raw.match(/`due:([^`]+)`/);
      var due=dueM?dueM[1]:null;
      var text=raw.replace(/`due:[^`]+`/,'').trim();
      tasks.push({id:'v'+id++,text:text,due:due,done:!!doneM});
    });
    return tasks;
  }

  async function syncTasks(){
    if(typeof CAL==='undefined')return;
    var tasks=CAL.getTasks();
    scheduleWrite('Tasks.md',function(){return _tasksToMd(tasks);});
  }

  async function readTasks(){
    var md=await _read('Tasks.md');
    if(!md)return null;
    return _tasksFromMd(md);
  }

  // ══════════════════════════════════════════════════════════
  // STRENGTH SPLIT
  // ══════════════════════════════════════════════════════════
  function _splitToMd(data){
    var DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var md='---\ntype: system-strength\nbodyweight: '+data.bodyweight+'\n---\n\n# Strength Split\n\n';
    md+='**Bodyweight:** '+data.bodyweight+' lbs\n\n';
    data.split.forEach(function(day){
      md+='## '+DAYS[day.day]+' — '+day.name+'\n\n';
      day.exercises.forEach(function(ex){
        md+='- '+ex.name+' | '+ex.sets+'×'+ex.reps+' @ '+ex.weight+'lbs\n';
      });
      md+='\n';
    });
    // PRs
    if(Object.keys(data.prs||{}).length){
      md+='## Personal Records\n\n';
      Object.entries(data.prs).forEach(function(kv){
        md+='- **'+kv[0]+':** '+kv[1].weight+'lbs × '+kv[1].reps+' reps ('+kv[1].date+')\n';
      });
    }
    return md;
  }

  function _splitFromMd(md){
    var DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var split=[];var prs={};
    var bwM=md.match(/bodyweight:\s*(\d+(?:\.\d+)?)/);
    var bodyweight=bwM?parseFloat(bwM[1]):185;
    var sections=md.split(/^## /m);
    sections.forEach(function(sec){
      var dayMatch=sec.match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) — (.+)/);
      if(!dayMatch)return;
      var dayIdx=DAYS.indexOf(dayMatch[1]);
      if(dayIdx<0)return;
      var name=dayMatch[2].trim();
      var exercises=[];
      sec.split('\n').forEach(function(line){
        var exM=line.match(/^- (.+?) \| (\d+)×(\d+) @ (\d+(?:\.\d+)?)lbs/);
        if(exM)exercises.push({name:exM[1],sets:parseInt(exM[2]),reps:parseInt(exM[3]),weight:parseFloat(exM[4])});
      });
      split.push({day:dayIdx,name:name,exercises:exercises});
    });
    // PRs
    var prSec=md.match(/## Personal Records\n\n([\s\S]*?)(?:\n##|$)/);
    if(prSec){
      prSec[1].split('\n').forEach(function(line){
        var prM=line.match(/\*\*(.+?):\*\* (\d+(?:\.\d+)?)lbs × (\d+) reps \((.+?)\)/);
        if(prM)prs[prM[1]]={weight:parseFloat(prM[2]),reps:parseInt(prM[3]),date:prM[4]};
      });
    }
    return{bodyweight:bodyweight,split:split,prs:prs};
  }

  async function syncStrength(data){
    scheduleWrite('Strength/split.md',function(){return _splitToMd(data);});
  }

  async function readStrength(){
    var md=await _read('Strength/split.md');
    if(!md)return null;
    return _splitFromMd(md);
  }

  // ══════════════════════════════════════════════════════════
  // BUDGET
  // ══════════════════════════════════════════════════════════
  function _budgetToMd(data){
    var md='---\ntype: system-budget\nupdated: '+new Date().toISOString()+'\n---\n\n# BAKER Budget\n\n';
    // Monthly summary
    var months=Object.keys(data.months||{}).sort().reverse().slice(0,3);
    months.forEach(function(m){
      var month=data.months[m];
      md+='## '+m+'\n\n';
      md+='**Income:** $'+((month.income||0).toFixed(2))+'  \n';
      md+='**Spent:** $'+((month.spent||0).toFixed(2))+'  \n';
      md+='**Saved:** $'+((month.saved||0).toFixed(2))+'\n\n';
      if(month.transactions&&month.transactions.length){
        md+='| Date | Category | Amount | Note |\n|---|---|---|---|\n';
        month.transactions.slice(0,20).forEach(function(t){
          md+='| '+(t.date||'')+'|'+(t.cat||'misc')+'|$'+(parseFloat(t.amount)||0).toFixed(2)+'|'+(t.note||'')+' |\n';
        });
        md+='\n';
      }
    });
    return md;
  }

  async function syncBudget(data){
    scheduleWrite('Budget/budget.md',function(){return _budgetToMd(data);});
  }

  // ══════════════════════════════════════════════════════════
  // ACADEMIC
  // ══════════════════════════════════════════════════════════
  function _academicToMd(data){
    var md='---\ntype: system-academic\nsemester: '+data.semester+'\nupdated: '+new Date().toISOString()+'\n---\n\n# '+data.semester+'\n\n';
    data.classes.forEach(function(cls){
      var done=(cls.assignments||[]).filter(function(a){return a.done;}).length;
      var total=(cls.assignments||[]).length;
      md+='## '+cls.name+'\n\n';
      if(cls.grade!=null)md+='**Grade:** '+cls.grade+'%  \n';
      md+='**Progress:** '+done+'/'+total+' assignments\n\n';
      if(total){
        (cls.assignments||[]).forEach(function(a){
          md+='- ['+(a.done?'x':' ')+'] '+a.name+(a.due?' `due:'+a.due+'`':'')+'\n';
        });
        md+='\n';
      }
    });
    return md;
  }

  function _academicFromMd(md){
    var semM=md.match(/semester:\s*(.+)/);
    var semester=semM?semM[1].trim():'';
    var classes=[];
    var sections=md.split(/^## /m).slice(1);
    sections.forEach(function(sec){
      var name=sec.split('\n')[0].trim();
      if(!name)return;
      var gradeM=sec.match(/\*\*Grade:\*\* (\d+(?:\.\d+)?)%/);
      var assignments=[];
      var id=1;
      sec.split('\n').forEach(function(line){
        var doneM=line.match(/^- \[x\] (.+?)(?:\s+`due:([^`]+)`)?$/);
        var pendM=line.match(/^- \[ \] (.+?)(?:\s+`due:([^`]+)`)?$/);
        var m=doneM||pendM;
        if(!m)return;
        assignments.push({
          id:'r'+id++,name:m[1].replace(/`due:[^`]+`/,'').trim(),
          due:m[2]||null,done:!!doneM,reminded:false
        });
      });
      classes.push({
        id:'c'+classes.length,name:name,
        color:['#7c6af7','#60a5fa','#4ade80','#f59e0b','#f87171','#c084fc','#38bdf8','#fb923c'][classes.length%8],
        grade:gradeM?parseFloat(gradeM[1]):null,
        assignments:assignments
      });
    });
    return{semester:semester,classes:classes};
  }

  async function syncAcademic(data){
    scheduleWrite('Academic/current.md',function(){return _academicToMd(data);});
  }

  async function readAcademic(){
    var md=await _read('Academic/current.md');
    if(!md)return null;
    return _academicFromMd(md);
  }

  // ══════════════════════════════════════════════════════════
  // BIOMETRICS
  // ══════════════════════════════════════════════════════════
  function _biometricsToMd(entries){
    var md='---\ntype: system-biometrics\nupdated: '+new Date().toISOString()+'\n---\n\n# BAKER Biometrics\n\n';
    md+='| Date | Mood | Sleep | Energy |\n|---|---|---|---|\n';
    entries.slice(0,90).forEach(function(e){
      md+='| '+e.date+' | '+(e.mood!=null?e.mood:'—')+' | '+(e.sleep!=null?e.sleep+'h':'—')+' | '+(e.energy!=null?e.energy:'—')+' |\n';
    });
    return md;
  }

  async function syncBiometrics(entries){
    scheduleWrite('Biometrics/log.md',function(){return _biometricsToMd(entries);});
  }

  // ══════════════════════════════════════════════════════════
  // REMINDERS
  // ══════════════════════════════════════════════════════════
  function _remindersToMd(reminders){
    var pending=reminders.filter(function(r){return!r.fired;});
    var md='---\ntype: system-reminders\nupdated: '+new Date().toISOString()+'\n---\n\n# Active Reminders\n\n';
    if(!pending.length){md+='_No active reminders._\n';return md;}
    pending.forEach(function(r){
      var dt=new Date(r.time);
      md+='- '+r.text+' — '+dt.toLocaleString()+'\n';
    });
    return md;
  }

  async function syncReminders(reminders){
    scheduleWrite('Reminders.md',function(){return _remindersToMd(reminders);});
  }

  // ══════════════════════════════════════════════════════════
  // PERSISTENT MEMORY (BAKER-Memory.md)
  // ══════════════════════════════════════════════════════════
  var _memory={facts:[]};
  var MEMORY_PATH='Memory.md';

  function _memoryToMd(mem){
    var md='---\ntype: baker-memory\nupdated: '+new Date().toISOString()+'\n---\n\n# BAKER Memory\n\n';
    md+='> This file is BAKER\'s persistent memory. It is automatically injected into every conversation.\n\n';
    if(mem.facts&&mem.facts.length){
      md+='## Known Facts\n\n';
      mem.facts.forEach(function(f){
        md+='- '+f+'\n';
      });
    }
    return md;
  }

  function _memoryFromMd(md){
    var facts=[];
    var inFacts=false;
    md.split('\n').forEach(function(line){
      if(line==='## Known Facts')inFacts=true;
      else if(line.startsWith('## ')&&inFacts)inFacts=false;
      else if(inFacts&&line.startsWith('- '))facts.push(line.slice(2).trim());
    });
    return{facts:facts};
  }

  async function readMemory(){
    var md=await _read(MEMORY_PATH);
    if(!md)return null;
    _memory=_memoryFromMd(md);
    return _memory;
  }

  function addMemory(fact){
    if(!fact||_memory.facts.includes(fact))return;
    _memory.facts.push(fact);
    if(_memory.facts.length>100)_memory.facts=_memory.facts.slice(-100);
    scheduleWrite(MEMORY_PATH,function(){return _memoryToMd(_memory);});
  }

  function getMemoryContext(){
    if(!_memory.facts||!_memory.facts.length)return'';
    return'## BAKER Memory\n'+_memory.facts.map(function(f){return'- '+f;}).join('\n')+'\n\n';
  }

  // ══════════════════════════════════════════════════════════
  // ON VAULT CONNECT — Read everything back
  // ══════════════════════════════════════════════════════════
  async function onVaultConnect(){
    _ready=true;
    if(typeof setStatus==='function')setStatus('Syncing BAKER data from vault...');

    var promises=[
      // Always auto-read tasks and strength split
      readTasks().then(function(tasks){
        if(tasks&&tasks.length&&typeof CAL!=='undefined'&&CAL.importTasks){
          CAL.importTasks(tasks);
          if(typeof setStatus==='function')setStatus('Tasks restored from vault');
        }
      }),
      readStrength().then(function(strengthData){
        if(strengthData&&typeof STRENGTH!=='undefined'&&STRENGTH.importData){
          STRENGTH.importData(strengthData);
          if(typeof setStatus==='function')setStatus('Strength split restored from vault');
        }
      }),
      // Read memory and inject into future conversations
      readMemory()
    ];

    // Prompt for other modules
    var toRead=[];
    if(typeof ACADEMIC!=='undefined')toRead.push(
      readAcademic().then(function(d){if(d&&ACADEMIC.importData)ACADEMIC.importData(d);})
    );

    await Promise.allSettled([...promises,...toRead]);
    if(typeof setStatus==='function')setStatus('Vault sync complete');
  }

  function init(){
    // Will be called after vault connects via onVaultConnect()
  }

  return{
    init,onVaultConnect,
    syncTasks,syncStrength,syncBudget,syncAcademic,syncBiometrics,syncReminders,
    addMemory,getMemoryContext,readMemory,
    write:_write,read:_read,
    _getMemory:function(){return _memory;},
    _clearMemory:function(){_memory={facts:[]};scheduleWrite(MEMORY_PATH,function(){return _memoryToMd(_memory);});}
  };
})();
