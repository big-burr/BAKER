// ═══════════════════════════════════════════════════════════
// ══  VAULT NOTES BROWSER MODULE (VAULTUI)  ══════════════════
// ═══════════════════════════════════════════════════════════
var VAULTUI=(function(){
  var searchInput,listEl,viewerEl,viewerTitleEl,viewerContentEl,backBtn;
  var createEl,createListEl,createFormEl,createTitleInput,createBackBtn,newBtn;
  var sortSelect,filterBarEl,editBtn,saveBtn,cancelEditBtn,viewerEditArea,viewerHdrEl;
  var pendingTemplate=null; // template key while title-prompt form is showing
  var currentNoteIdx=null;  // index of note currently open in viewer
  var editing=false;

  var sortMode='name';      // 'name' | 'modified' | 'type'
  var activeTypeFilter='all'; // 'all' | 'conversation' | 'project' | 'lecture' | 'daily' | 'general'

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function pad(n){return String(n).padStart(2,'0');}
  function todayStr(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  function mondayOfWeekStr(){
    var d=new Date();
    var day=d.getDay(); // 0=Sun
    var diff=(day===0?-6:1-day); // shift to Monday
    d.setDate(d.getDate()+diff);
    return 'Week of '+(d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()));
  }
  // Sanitize free-text into a filename-safe slug, spaces -> hyphens
  function slugify(s){
    return String(s||'').trim().replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,'-');
  }

  // ── Frontmatter parsing ───────────────────────────────────
  function parseFrontmatter(content){
    if(!content)return{};
    var m=content.match(/^---\s*\n([\s\S]*?)\n---/);
    if(!m)return{};
    var fm={};
    m[1].split('\n').forEach(function(line){
      var kv=line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if(kv)fm[kv[1].trim().toLowerCase()]=kv[2].trim();
    });
    return fm;
  }

  function noteCategory(note){
    var fm=parseFrontmatter(note.content);
    var t=(fm.type||'').toLowerCase();
    if(t==='conversation')return'conversation';
    if(t==='project')return'project';
    if(t==='lecture')return'lecture';
    if(t==='daily-log'||t==='daily')return'daily';
    if(t)return'general';
    return detectIcon._category(note.path);
  }

  function detectIcon(path){
    var p=(path||'').toLowerCase();
    if(p.includes('conversation'))return'💬';
    if(p.includes('01-projects'))return'📁';
    if(p.includes('lecture'))return'🎓';
    if(p.includes('daily')||p.includes('07-system'))return'📆';
    return'📄';
  }
  detectIcon._category=function(path){
    var p=(path||'').toLowerCase();
    if(p.includes('conversation'))return'conversation';
    if(p.includes('01-projects'))return'project';
    if(p.includes('lecture'))return'lecture';
    if(p.includes('daily')||p.includes('07-system'))return'daily';
    return'general';
  };

  var CATEGORY_LABELS={all:'All',conversation:'💬 Conv',project:'📁 Proj',lecture:'🎓 Lec',daily:'📆 Daily',general:'📄 Gen'};
  var CATEGORY_ORDER=['all','conversation','project','lecture','daily','general'];

  // ── Templates ─────────────────────────────────────────────
  var TEMPLATES={
    'daily-log':{
      type:'daily',
      label:'📆 Daily Log',
      desc:'Today\'s log — top 3, notes, done, tomorrow',
      folder:'00-Capture',
      needsTitle:false,
      filename:function(){return todayStr()+'.md';},
      body:function(){return '---\n'+
        'date: '+todayStr()+'\n'+
        'type: daily\n'+
        'week: \n'+
        'mood: \n'+
        'energy: \n'+
        '---\n\n'+
        '# 📅 Daily Log\n\n'+
        '## 🎯 Top 3 today\n'+
        '- [ ] \n- [ ] \n- [ ] \n\n'+
        '## 🧠 Notes & thoughts\n\n\n'+
        '## 📚 College\n'+
        '<!-- Classes attended, what was covered, assignments due -->\n\n'+
        '## ✅ Done today\n\n\n'+
        '## 🔁 Tomorrow\n'+
        '- [ ] \n\n'+
        '## 🌙 End of day reflection\n\n\n'+
        '---\n'+
        '*Process inbox before closing* · [[HOME]]\n';
      }
    },
    'lecture':{
      type:'lecture',
      label:'🎓 Lecture',
      desc:'Lecture recording — raw notes, key points, follow-ups',
      folder:'00-Capture/Lectures',
      needsTitle:true,
      titleLabel:'Lecture title / topic',
      filename:function(title){return todayStr()+'-'+slugify(title)+'.md';},
      body:function(title){return '---\n'+
        'date: '+todayStr()+'\n'+
        'type: lecture\n'+
        'course: \n'+
        'professor: \n'+
        'topic: '+title+'\n'+
        'status: raw\n'+
        'tags: [lecture, college]\n'+
        '---\n\n'+
        '# 🎓 Lecture — '+title+'\n\n'+
        '**Date:** '+todayStr()+'\n'+
        '**Professor:** \n'+
        '**Course:** \n\n'+
        '---\n\n'+
        '## 📝 Raw notes / transcript\n'+
        '<!-- Paste your recording transcript or live notes here -->\n\n'+
        '---\n\n'+
        '## 🔑 Key points\n'+
        '<!-- After class: pull out the 3-5 things that actually mattered -->\n'+
        '- \n- \n- \n\n'+
        '## ❓ Questions to follow up\n'+
        '- \n\n'+
        '## 🔗 Connects to\n'+
        '<!-- Link to related notes or projects -->\n\n'+
        '---\n'+
        '*Status: raw → reviewed → distilled* · [[HOME]]\n';
      }
    },
    'project':{
      type:'project',
      label:'🚀 Project',
      desc:'New project — goal, milestones, tasks, log',
      folder:'01-Projects',
      needsTitle:true,
      titleLabel:'Project name',
      filename:function(title){return slugify(title)+'.md';},
      body:function(title){return '---\n'+
        'date-created: '+todayStr()+'\n'+
        'type: project\n'+
        'status: active\n'+
        'project-name: '+title+'\n'+
        'goal: \n'+
        'deadline: \n'+
        'tags: [project]\n'+
        '---\n\n'+
        '# 🚀 Project — '+title+'\n\n'+
        '**Goal:** \n\n'+
        '**Deadline:** \n\n'+
        '**Status:** active\n\n'+
        '---\n\n'+
        '## 🗺 Overview\n'+
        '<!-- What is this project? Why does it matter? -->\n\n'+
        '## 🎯 Milestones\n'+
        '- [ ] \n- [ ] \n- [ ] \n\n'+
        '## 📋 Tasks\n'+
        '- [ ] \n- [ ] \n\n'+
        '## 📓 Log\n'+
        '<!-- Running notes — date each entry -->\n\n'+
        '### '+todayStr()+'\n'+
        '- \n\n'+
        '## 🔗 Related notes & resources\n\n\n'+
        '## 🧠 Decisions made\n'+
        '<!-- Key choices and why — important for the AI assistant layer later -->\n\n'+
        '---\n'+
        '*[[HOME]] · Status: active → paused → complete → [[04-Archive]]*\n';
      }
    },
    'weekly-review':{
      label:'📊 Weekly Review',
      desc:'What got done, what\'s open, focus for next week',
      folder:'07-System',
      needsTitle:true,
      titleLabel:'Short label for this review (optional)',
      filename:function(title){return todayStr()+(title?('-'+slugify(title)):'')+'.md';},
      body:function(title){return '---\n'+
        'date: '+todayStr()+'\n'+
        'type: weekly-review\n'+
        'week: '+mondayOfWeekStr()+'\n'+
        'tags: [review]\n'+
        '---\n\n'+
        '# 📊 Weekly Review — '+mondayOfWeekStr()+'\n\n'+
        '**Date:** '+todayStr()+'\n\n'+
        '---\n\n'+
        '## ✅ What got done\n'+
        '<!-- Projects moved, tasks completed, wins -->\n\n'+
        '## 🔄 What\'s still open\n'+
        '<!-- Carried over tasks, stalled projects -->\n\n'+
        '## 📚 What I learned\n'+
        '<!-- From lectures, conversations, reading, experience -->\n\n'+
        '## 🔗 Notes to process\n'+
        '<!-- Inbox items still needing attention -->\n\n'+
        '## 🎯 Focus for next week\n'+
        '1. \n2. \n3. \n\n'+
        '## 🌱 One insight worth keeping\n'+
        '<!-- Most valuable thing this week — move to 05-Notes/Atomic when ready -->\n\n'+
        '---\n'+
        '*[[HOME]]*\n';
      }
    },
    'conversation':{
      label:'💬 Conversation',
      desc:'Capture a conversation — uses Project layout as placeholder',
      folder:'07-System',
      needsTitle:true,
      titleLabel:'Conversation title',
      filename:function(title){return todayStr()+'-'+slugify(title)+'.md';},
      body:function(title){return '---\n'+
        'date-created: '+todayStr()+'\n'+
        'type: conversation\n'+
        'status: active\n'+
        'project-name: '+title+'\n'+
        'goal: \n'+
        'deadline: \n'+
        'tags: [conversation]\n'+
        '---\n\n'+
        '# 💬 Conversation — '+title+'\n\n'+
        '**Date:** '+todayStr()+'\n\n'+
        '---\n\n'+
        '## 🗺 Overview\n'+
        '<!-- What is this conversation about? Why does it matter? -->\n\n'+
        '## 📓 Log\n'+
        '<!-- Running notes — date each entry -->\n\n'+
        '### '+todayStr()+'\n'+
        '- \n\n'+
        '## 🔗 Related notes & resources\n\n\n'+
        '## 🧠 Decisions made\n'+
        '<!-- Key choices and why — important for the AI assistant layer later -->\n\n'+
        '---\n'+
        '*[[HOME]]*\n';
      }
    }
  };
  var TEMPLATE_ORDER=['daily-log','lecture','project','weekly-review','conversation'];

  // ── List rendering ────────────────────────────────────────
  function renderList(query){
    if(!listEl)return;
    if(typeof vaultIndex==='undefined'||!vaultIndex.length){
      listEl.innerHTML='<div class="vp-empty">No vault connected.<br>Click "Connect Vault" in the nav bar to browse your notes here.</div>';
      return;
    }
    var q=(query||'').toLowerCase().trim();
    var items=vaultIndex.map(function(n,i){return{note:n,idx:i};});

    if(q){
      var typeMatch=q.match(/(?:^|\s)type:(\S+)/);
      var tagMatch=q.match(/(?:^|\s)(?:tag:|#)(\S+)/);
      var freeText=q.replace(/(?:^|\s)type:\S+/,'').replace(/(?:^|\s)(?:tag:|#)\S+/,'').trim();

      items=items.filter(function(o){
        var n=o.note;
        var fm=parseFrontmatter(n.content);
        if(typeMatch){
          var ft=(fm.type||'').toLowerCase();
          if(ft!==typeMatch[1].toLowerCase()&&noteCategory(n)!==typeMatch[1].toLowerCase())return false;
        }
        if(tagMatch){
          var tags=(fm.tags||'').toLowerCase();
          if(!tags.includes(tagMatch[1].toLowerCase()))return false;
        }
        if(freeText){
          return n.name.toLowerCase().includes(freeText)||n.path.toLowerCase().includes(freeText)||n.content.toLowerCase().includes(freeText);
        }
        return true;
      });

      // TF-IDF re-rank when free text present
      if(freeText&&items.length>1){
        var scores=_vaultTFIDF(freeText,items.map(function(o){return o.note;}));
        items=items.map(function(o,i){return{note:o.note,idx:o.idx,score:scores[i]||0};});
        items.sort(function(a,b){return b.score-a.score;});
      }
    }

    if(activeTypeFilter!=='all'){
      items=items.filter(function(o){return noteCategory(o.note)===activeTypeFilter;});
    }

    if(!items.length){
      listEl.innerHTML='<div class="vp-empty">No notes match'+(query?' "'+esc(query)+'"':' this filter')+'.</div>';
      return;
    }

    if(sortMode==='modified'){
      items=items.slice().sort(function(a,b){return(b.note.mtime||0)-(a.note.mtime||0);});
    }else if(sortMode==='type'){
      items=items.slice().sort(function(a,b){
        var ca=noteCategory(a.note),cb=noteCategory(b.note);
        if(ca!==cb)return ca.localeCompare(cb);
        return a.note.name.localeCompare(b.note.name);
      });
    }else{
      items=items.slice().sort(function(a,b){return a.note.name.localeCompare(b.note.name);});
    }

    items=items.slice(0,200);

    var html='';
    items.forEach(function(o){
      var n=o.note;
      var icon=detectIcon(n.path);
      html+='<div class="vp-item" data-idx="'+o.idx+'">'+
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

  // ── TF-IDF engine (for note search ranking) ──────────────
  var _idfCache={};
  var _STOP=new Set(['the','and','for','are','but','not','you','all','can','had','was','one','our','out','get','has','how','its','may','now','see','who','did','too','use','that','this','with','have','from','they','will','been','were','said','each','into','than','your','more','then','some','them','what','when','also','just','know','take','after','could','think','about','would','these','those','other','well','want','much','still','while','even','back','come','made','only','over','here','down','does','like','time','most','date','type','tags','status']);

  function _buildVaultIDF(){
    _idfCache={};
    var N=vaultIndex.length;if(!N)return;
    var df={};
    vaultIndex.forEach(function(note){
      var words=new Set((note.name+' '+note.content).toLowerCase().split(/\W+/).filter(function(w){return w.length>2&&!_STOP.has(w);}));
      words.forEach(function(w){df[w]=(df[w]||0)+1;});
    });
    Object.keys(df).forEach(function(w){_idfCache[w]=Math.log((N+1)/(df[w]+1))+1;});
  }

  function _vaultTFIDF(query,notes){
    if(!Object.keys(_idfCache).length)_buildVaultIDF();
    var qWords=query.toLowerCase().split(/\W+/).filter(function(w){return w.length>2&&!_STOP.has(w);});
    if(!qWords.length)return notes.map(function(){return 0;});
    return notes.map(function(note){
      var content=(note.name+' '+note.content).toLowerCase();
      var words=content.split(/\W+/);
      var tf={};words.forEach(function(w){if(w.length>2)tf[w]=(tf[w]||0)+1;});
      var total=words.length||1;
      var score=0;
      qWords.forEach(function(w){
        var termTF=(tf[w]||0)/total;
        var idf=_idfCache[w]||Math.log(2);
        var nameBoost=note.name.toLowerCase().includes(w)?5:1;
        score+=termTF*idf*nameBoost;
      });
      // Recency boost
      var dm=note.name.match(/(\d{4}-\d{2}-\d{2})/);
      if(dm){var age=(Date.now()-new Date(dm[1]).getTime())/(86400000);if(age<7)score*=1.5;else if(age<30)score*=1.2;}
      return score;
    });
  }

  // Rebuild IDF when vault loads
  function _onVaultReady(){_buildVaultIDF();}

  // ── Daily log task pre-fill ───────────────────────────────
  // When creating a daily log, inject today's tasks from CAL as checkboxes
  function _injectTodaysTasks(content){
    if(typeof CAL==='undefined')return content;
    var tasks=CAL.getTasks();
    var today=(function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
    var todayTasks=tasks.filter(function(t){return!t.done&&(t.due===today||!t.due);});
    if(!todayTasks.length)return content;
    var taskLines=todayTasks.map(function(t){return'- [ ] '+t.text+(t.due?' 📅 '+t.due:'');}).join('\n');
    // Replace the placeholder checkboxes in the Top 3 section
    return content.replace('- [ ] \n- [ ] \n- [ ] ',''+taskLines+'\n');
  }

  // ── Filter bar ────────────────────────────────────────────
  function renderFilterBar(){
    if(!filterBarEl)return;
    var html='<select class="vp-sort-select" id="vp-sort-select">'+
      '<option value="name"'+(sortMode==='name'?' selected':'')+'>Name</option>'+
      '<option value="modified"'+(sortMode==='modified'?' selected':'')+'>Modified</option>'+
      '<option value="type"'+(sortMode==='type'?' selected':'')+'>Type</option>'+
      '</select>'+
      '<div class="vp-chip-row" id="vp-chip-row">';
    CATEGORY_ORDER.forEach(function(cat){
      html+='<button class="vp-chip'+(activeTypeFilter===cat?' act':'')+'" data-cat="'+cat+'">'+CATEGORY_LABELS[cat]+'</button>';
    });
    html+='</div>';
    filterBarEl.innerHTML=html;

    var sortSel=document.getElementById('vp-sort-select');
    if(sortSel)sortSel.addEventListener('change',function(){
      sortMode=this.value;
      renderList(searchInput?searchInput.value:'');
    });
    filterBarEl.querySelectorAll('.vp-chip').forEach(function(chip){
      chip.addEventListener('click',function(){
        activeTypeFilter=chip.dataset.cat;
        filterBarEl.querySelectorAll('.vp-chip').forEach(function(c){c.classList.toggle('act',c===chip);});
        renderList(searchInput?searchInput.value:'');
      });
    });
  }

  // ── Note viewer ───────────────────────────────────────────
  function openNote(idx){
    var note=vaultIndex[idx];
    if(!note)return;
    currentNoteIdx=idx;
    exitEditMode(false);
    viewerTitleEl.textContent=note.name.replace(/\.md$/,'');
    viewerContentEl.textContent=note.content;
    viewerEl.classList.add('vis');
  }
  function closeNote(){
    exitEditMode(false);
    viewerEl.classList.remove('vis');
    currentNoteIdx=null;
  }

  function openNoteByPath(path){
    var idx=vaultIndex.findIndex(function(n){return n.path===path;});
    if(idx>=0)openNote(idx);
  }

  // ── Edit mode ─────────────────────────────────────────────
  function enterEditMode(){
    if(!editBtn)editBtn=document.getElementById('vp-edit-btn');
    if(!saveBtn)saveBtn=document.getElementById('vp-save-btn');
    if(!cancelEditBtn)cancelEditBtn=document.getElementById('vp-cancel-edit-btn');
    if(!viewerEditArea)viewerEditArea=document.getElementById('vp-viewer-edit');
    if(currentNoteIdx===null)return;
    var note=vaultIndex[currentNoteIdx];
    if(!note)return;
    editing=true;
    viewerEditArea.value=note.content;
    viewerContentEl.style.display='none';
    viewerEditArea.style.display='block';
    if(editBtn)editBtn.style.display='none';
    if(saveBtn)saveBtn.style.display='inline-flex';
    if(cancelEditBtn)cancelEditBtn.style.display='inline-flex';
    setTimeout(function(){viewerEditArea.focus();},30);
  }
  function exitEditMode(refreshView){
    editing=false;
    if(!editBtn)editBtn=document.getElementById('vp-edit-btn');
    if(!saveBtn)saveBtn=document.getElementById('vp-save-btn');
    if(!cancelEditBtn)cancelEditBtn=document.getElementById('vp-cancel-edit-btn');
    if(!viewerEditArea)viewerEditArea=document.getElementById('vp-viewer-edit');
    if(viewerEditArea)viewerEditArea.style.display='none';
    if(viewerContentEl)viewerContentEl.style.display='block';
    if(editBtn)editBtn.style.display='inline-flex';
    if(saveBtn)saveBtn.style.display='none';
    if(cancelEditBtn)cancelEditBtn.style.display='none';
    if(refreshView&&currentNoteIdx!==null){
      var note=vaultIndex[currentNoteIdx];
      if(note)viewerContentEl.textContent=note.content;
    }
  }
  function cancelEdit(){exitEditMode(true);}

  async function saveEdit(){
    if(currentNoteIdx===null)return;
    var note=vaultIndex[currentNoteIdx];
    if(!note)return;
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected){
      if(typeof setStatus==='function')setStatus('Vault not connected — cannot save, sir.');
      return;
    }
    var newContent=viewerEditArea.value;
    var pathParts=note.path.split('/');
    var fname=pathParts.pop();
    try{
      var dir=vaultHandle;
      for(var i=0;i<pathParts.length;i++){
        dir=await dir.getDirectoryHandle(pathParts[i],{create:true});
      }
      var fileHandle=await dir.getFileHandle(fname,{create:true});
      var writable=await fileHandle.createWritable();
      await writable.write(newContent);
      await writable.close();
      note.content=newContent;
      try{var f=await fileHandle.getFile();note.mtime=f.lastModified;}catch(e){}
      viewerContentEl.textContent=newContent;
      exitEditMode(false);
      if(typeof setStatus==='function')setStatus('Saved '+note.name+', sir.');
      if(typeof buildGraph==='function'&&typeof vaultConnected!=='undefined'&&vaultConnected){
        if(typeof graphNodes!=='undefined'&&graphNodes.length)buildGraph();
      }
    }catch(e){
      console.error('[VAULTUI] saveEdit error:',e);
      if(typeof setStatus==='function')setStatus('Could not save note, sir.');
    }
  }

  function findNoteByQuery(query){
    if(typeof vaultIndex==='undefined'||!vaultIndex.length)return null;
    query=query.toLowerCase().trim();
    var exact=vaultIndex.find(n=>n.name.toLowerCase().replace(/\.md$/,'')===query);
    if(exact)return exact;
    var partial=vaultIndex.find(n=>n.name.toLowerCase().includes(query));
    if(partial)return partial;
    return vaultIndex.find(n=>n.path.toLowerCase().includes(query));
  }

  // ── Quick Create ──────────────────────────────────────────
  function showCreatePanel(){
    if(!createEl)return;
    pendingTemplate=null;
    renderCreateChoices();
    createEl.classList.add('vis');
  }
  function hideCreatePanel(){
    if(!createEl)return;
    createEl.classList.remove('vis');
    pendingTemplate=null;
  }

  function renderCreateChoices(){
    if(!createListEl)return;
    createFormEl.style.display='none';
    createListEl.style.display='block';
    var html='';
    TEMPLATE_ORDER.forEach(function(key){
      var t=TEMPLATES[key];
      html+='<div class="vp-item vp-create-choice" data-key="'+key+'">'+
        '<span class="vp-item-icon">'+t.label.split(' ')[0]+'</span>'+
        '<div class="vp-item-body">'+
        '<div class="vp-item-name">'+esc(t.label.replace(/^\S+\s/,''))+'</div>'+
        '<div class="vp-item-path">'+esc(t.desc)+'</div>'+
        '</div></div>';
    });
    createListEl.innerHTML=html;
    createListEl.querySelectorAll('.vp-create-choice').forEach(function(item){
      item.addEventListener('click',function(){selectTemplate(item.dataset.key);});
    });
  }

  function selectTemplate(key){
    var t=TEMPLATES[key];
    if(!t)return;
    if(!t.needsTitle){createNote(key,'');return;}
    pendingTemplate=key;
    createListEl.style.display='none';
    createFormEl.style.display='flex';
    document.getElementById('vp-create-form-title').textContent=t.label;
    createTitleInput.placeholder=t.titleLabel||'Title';
    createTitleInput.value='';
    setTimeout(function(){createTitleInput.focus();},50);
  }

  function submitCreateForm(){
    if(!pendingTemplate)return;
    var t=TEMPLATES[pendingTemplate];
    var title=createTitleInput.value.trim();
    if(t.needsTitle&&pendingTemplate!=='weekly-review'&&!title){createTitleInput.focus();return;}
    createNote(pendingTemplate,title);
  }

  async function createNote(key,title){
    var t=TEMPLATES[key];
    if(!t)return;
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected){
      hideCreatePanel();
      if(typeof setStatus==='function')setStatus('Connect your vault first, sir.');
      return;
    }
    var fname=t.filename(title);
    var folderParts=t.folder.split('/');
    var fullPath=t.folder+'/'+fname;

    try{
      var existing=vaultIndex.find(function(n){return n.path===fullPath;});
      if(existing){hideCreatePanel();showPanel();openNoteByPath(fullPath);return;}

      var dir=vaultHandle;
      for(var i=0;i<folderParts.length;i++){
        dir=await dir.getDirectoryHandle(folderParts[i],{create:true});
      }

      var fileExists=false;
      try{await dir.getFileHandle(fname,{create:false});fileExists=true;}catch(e){fileExists=false;}

      var fileHandle=await dir.getFileHandle(fname,{create:true});

      if(!fileExists){
        var content=t.body(title);
        // Pre-fill today's tasks into daily log
        if(key==='daily-log')content=_injectTodaysTasks(content);
        var writable=await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        var mtime=Date.now();
        try{var f0=await fileHandle.getFile();mtime=f0.lastModified;}catch(e){}
        vaultIndex.push({name:fname,path:fullPath,content:content,mtime:mtime});
      }else{
        var f=await fileHandle.getFile();
        var existingContent=await f.text();
        var idx=vaultIndex.findIndex(function(n){return n.path===fullPath;});
        if(idx>=0){vaultIndex[idx].content=existingContent;vaultIndex[idx].mtime=f.lastModified;}
        else vaultIndex.push({name:fname,path:fullPath,content:existingContent,mtime:f.lastModified});
      }

      hideCreatePanel();
      renderList(searchInput?searchInput.value:'');
      openNoteByPath(fullPath);

      if(typeof buildGraph==='function'&&typeof vaultConnected!=='undefined'&&vaultConnected){
        if(typeof graphNodes!=='undefined'&&graphNodes.length){
          buildGraph();
          // Spawn birth particle after graph rebuilds
          var _bpType=t.type||detectType(fullPath,'');
          var _bpPath=fullPath;
          setTimeout(function(){
            if(typeof spawnBirthParticle==='function')spawnBirthParticle(_bpType,_bpPath);
          },200);
          // Smart link suggestions (async, non-blocking)
          _suggestLinks(fullPath,content||'');
        }
      }
    }catch(e){
      console.error('[VAULTUI] createNote error:',e);
      if(typeof setStatus==='function')setStatus('Could not create note, sir.');
      hideCreatePanel();
    }
  }

  // ── Panel show/hide ───────────────────────────────────────
  function showPanel(){
    var p=document.getElementById('vault-panel');
    p.classList.add('vp-vis');
    if(p._wbNormalise)p._wbNormalise();
    renderFilterBar();
    renderList(searchInput?searchInput.value:'');
  }
  function hidePanel(){
    document.getElementById('vault-panel').classList.remove('vp-vis');
    closeNote();hideCreatePanel();
  }
  function togglePanel(){
    var p=document.getElementById('vault-panel');
    p.classList.toggle('vp-vis');
    if(p.classList.contains('vp-vis')){
      if(p._wbNormalise)p._wbNormalise();
      renderFilterBar();
      renderList(searchInput?searchInput.value:'');
    }else{closeNote();hideCreatePanel();}
  }

  // ── Voice ─────────────────────────────────────────────────
  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();

    if(/\b(new|create|start)\b.*\b(daily log|today'?s log|day'?s log)\b/.test(c)){
      showPanel();createNote('daily-log','');
      return'Creating today\'s daily log, sir.';
    }

    if(/\b(open|pull up|show|browse|let'?s (open|check|see))\b.*\b(vault|notes?)\b/.test(c)&&!/\bnote\b.*\b(today|down|that)\b/.test(c)){
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

    var pullMatch=c.match(/(?:pull up|find|open)\s+(?:my\s+)?(.+?)\s+(?:note|notes)\b/);
    if(pullMatch){
      var pq=pullMatch[1].trim();
      var pnote=findNoteByQuery(pq);
      if(!pnote)return null;
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
    viewerEditArea=document.getElementById('vp-viewer-edit');
    viewerHdrEl=document.querySelector('#vp-viewer .vp-viewer-hdr');
    backBtn=document.getElementById('vp-back');
    editBtn=document.getElementById('vp-edit-btn');
    saveBtn=document.getElementById('vp-save-btn');
    cancelEditBtn=document.getElementById('vp-cancel-edit-btn');
    newBtn=document.getElementById('vp-new-btn');
    createEl=document.getElementById('vp-create');
    createListEl=document.getElementById('vp-create-list');
    createFormEl=document.getElementById('vp-create-form');
    createTitleInput=document.getElementById('vp-create-title-input');
    createBackBtn=document.getElementById('vp-create-back');
    filterBarEl=document.getElementById('vp-filter-bar');

    if(searchInput)searchInput.addEventListener('input',function(){renderList(searchInput.value);});
    if(backBtn)backBtn.addEventListener('click',closeNote);
    if(newBtn)newBtn.addEventListener('click',showCreatePanel);
    if(editBtn)editBtn.addEventListener('click',enterEditMode);
    if(saveBtn)saveBtn.addEventListener('click',saveEdit);
    if(cancelEditBtn)cancelEditBtn.addEventListener('click',cancelEdit);
    if(createBackBtn)createBackBtn.addEventListener('click',function(){
      if(createFormEl&&createFormEl.style.display!=='none'&&pendingTemplate){
        pendingTemplate=null;renderCreateChoices();
      }else{hideCreatePanel();}
    });
    var createSubmitBtn=document.getElementById('vp-create-submit');
    if(createSubmitBtn)createSubmitBtn.addEventListener('click',submitCreateForm);
    if(createTitleInput)createTitleInput.addEventListener('keydown',function(e){if(e.key==='Enter')submitCreateForm();});

    renderFilterBar();
    renderList('');
  }

  function refresh(){
    _onVaultReady(); // rebuild TF-IDF index when vault connects
    if(document.getElementById('vault-panel').classList.contains('vp-vis')){
      renderFilterBar();
      renderList(searchInput?searchInput.value:'');
    }
  }

  
  // ── Smart Note Linking ────────────────────────────────────
  function _suggestLinks(newPath,newContent){
    if(!vaultIndex||vaultIndex.length<2)return;
    // Find up to 5 related notes using TF-IDF
    var words=newContent.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(function(w){return w.length>3;});
    if(words.length<3)return;
    var scores=[];
    vaultIndex.forEach(function(note){
      if(note.path===newPath)return;
      var c=(note.content||'').toLowerCase();
      var score=words.reduce(function(s,w){return s+(c.includes(w)?1:0);},0);
      if(score>0)scores.push({note:note,score:score});
    });
    scores.sort(function(a,b){return b.score-a.score;});
    var top=scores.slice(0,5);
    if(!top.length)return;
    // Show suggestion popup
    _showLinkSuggestPopup(newPath,top.map(function(s){return s.note;}));
  }

  function _showLinkSuggestPopup(targetPath,suggestions){
    var existing=document.getElementById('baker-link-suggest');
    if(existing)existing.remove();
    var pop=document.createElement('div');
    pop.id='baker-link-suggest';
    pop.style.cssText='position:fixed;top:54px;right:24px;z-index:500;background:rgba(22,22,25,.97);border:1px solid var(--accent-dim);border-radius:10px;padding:12px 14px;backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,.6);max-width:300px;min-width:220px;animation:fadeIn .2s ease both';
    var hdr=document.createElement('div');
    hdr.style.cssText='font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center';
    hdr.innerHTML='&#128279; Link Suggestions<button onclick="document.getElementById('baker-link-suggest').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0">&#215;</button>';
    pop.appendChild(hdr);
    var sub=document.createElement('div');
    sub.style.cssText='font-family:var(--mono);font-size:9px;color:var(--muted);margin-bottom:8px';
    sub.textContent='Click to add wikilink to '+targetPath.split('/').pop();
    pop.appendChild(sub);
    suggestions.forEach(function(note){
      var row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;cursor:pointer;transition:background .15s;margin-bottom:2px';
      row.onmouseover=function(){this.style.background='rgba(124,106,247,.12)';};
      row.onmouseout=function(){this.style.background='transparent';};
      var name=document.createElement('span');
      name.style.cssText='font-family:var(--mono);font-size:11px;color:var(--text);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      name.textContent=note.name.replace('.md','');
      var add=document.createElement('button');
      add.style.cssText='background:var(--accent-dim);border:none;border-radius:4px;color:var(--accent);font-family:var(--mono);font-size:9px;padding:2px 7px;cursor:pointer;flex-shrink:0';
      add.textContent='+ Link';
      add.onclick=function(){
        _insertWikilink(targetPath,note.name.replace('.md',''));
        row.style.opacity='0.4';add.textContent='Added';add.disabled=true;
      };
      row.appendChild(name);row.appendChild(add);
      pop.appendChild(row);
    });
    var dismiss=document.createElement('div');
    dismiss.style.cssText='font-family:var(--mono);font-size:9px;color:var(--muted);text-align:center;margin-top:6px;cursor:pointer';
    dismiss.textContent='Dismiss';
    dismiss.onclick=function(){pop.remove();};
    pop.appendChild(dismiss);
    document.body.appendChild(pop);
    // Auto-dismiss after 30s
    setTimeout(function(){if(pop.parentNode)pop.remove();},30000);
  }

  function _insertWikilink(targetPath,linkName){
    // Find the note in vaultIndex and append wikilink
    var idx=vaultIndex.findIndex(function(n){return n.path===targetPath;});
    if(idx<0)return;
    var note=vaultIndex[idx];
    var link='\n\n## Related\n- [['+linkName+']]';
    // Check if already has Related section
    if(note.content&&note.content.includes('[['+linkName+']]'))return;
    var newContent=note.content+(note.content.includes('## Related')?('\n- [['+linkName+']]'):link);
    // Write to vault
    if(typeof vaultHandle==='undefined'||!vaultHandle)return;
    var parts=targetPath.split('/');
    var fname=parts.pop();
    var getDir=Promise.resolve(vaultHandle);
    parts.forEach(function(p){getDir=getDir.then(function(d){return d.getDirectoryHandle(p,{create:false});});});
    getDir.then(function(dir){return dir.getFileHandle(fname,{create:false});})
    .then(function(fh){return fh.createWritable();})
    .then(function(w){return w.write(newContent).then(function(){return w.close();});})
    .then(function(){
      vaultIndex[idx].content=newContent;
      if(typeof setStatus==='function')setStatus('Link added to '+fname);
      // Refresh viewer if this note is currently open
      var viewer=document.getElementById('vp-viewer-content');
      var viewerTitle=document.getElementById('vp-viewer-title');
      if(viewer&&viewerTitle&&viewerTitle.textContent===fname.replace('.md',''))viewer.textContent=newContent;
    }).catch(function(){});
  }

  return{init,showPanel,hidePanel,togglePanel,handleVoice,refresh,_openNoteByIdx:openNote};
})();

// ═══════════════════════════════════════════════════════════
// ══  GRAPH SETTINGS  ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Safe init: if hud.html already defined GraphSettings, merge in any
// missing keys rather than overwriting. This prevents the vault-ui.js
// load from wiping nodeBrightness / gridMode / yggdrasilMode etc.
(function(){
  var defaults={
    typeFilter:{conversation:true,project:true,lecture:true,daily:true,general:true},
    linkDistance:90,repulsion:100,sizeByConnections:false,showLabels:false,
    searchQuery:'',nodeSizeScale:1,graphArea:1,
    treeMode:false,clusterMode:false,gridMode:false,yggdrasilMode:false,
    nodeBrightness:1.0
  };
  if(typeof GraphSettings==='undefined'){
    GraphSettings=defaults;
  }else{
    // Fill in any keys that hud.html's version is missing
    Object.keys(defaults).forEach(function(k){
      if(GraphSettings[k]===undefined)GraphSettings[k]=defaults[k];
    });
  }
  DEFAULT_GRAPH_SETTINGS=JSON.parse(JSON.stringify(GraphSettings));
})();

// ═══════════════════════════════════════════════════════════
// ══  GRAPH SETTINGS PANEL MODULE (GRAPHUI)  ══════════════
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
    if(typeof vaultConnected!=='undefined'&&vaultConnected&&typeof buildGraph==='function'){
      buildGraph();
    }
  }

  function bindControls(){
    function _el(id){return document.getElementById(id);}
    // Type filters
    document.querySelectorAll('[data-gui-type]').forEach(function(cb){
      cb.addEventListener('change',function(){
        GraphSettings.typeFilter[cb.dataset.guiType]=cb.checked;
        applyAndRebuild();
      });
    });
    // Link distance
    var ld=_el('gui-linkdist');if(!ld)return; // guard: if panel not in DOM, abort
    var ldDebounce;
    ld.addEventListener('input',function(){
      GraphSettings.linkDistance=parseInt(this.value,10);
      _el('gui-linkdist-val').textContent=this.value;
      clearTimeout(ldDebounce);ldDebounce=setTimeout(applyAndRebuild,150);
    });
    // Repulsion
    var rp=_el('gui-repulsion');
    var rpDebounce;
    rp.addEventListener('input',function(){
      GraphSettings.repulsion=parseInt(this.value,10);
      _el('gui-repulsion-val').textContent=this.value;
      clearTimeout(rpDebounce);rpDebounce=setTimeout(applyAndRebuild,150);
    });
    // Node size
    var ns=_el('gui-nodesize');
    var nsDebounce;
    ns.addEventListener('input',function(){
      GraphSettings.nodeSizeScale=parseInt(this.value,10)/100;
      _el('gui-nodesize-val').textContent=this.value;
      clearTimeout(nsDebounce);nsDebounce=setTimeout(applyAndRebuild,150);
    });
    // Graph area
    var ga=_el('gui-grapharea');
    var gaDebounce;
    ga.addEventListener('input',function(){
      GraphSettings.graphArea=parseInt(this.value,10)/100;
      _el('gui-grapharea-val').textContent=this.value;
      clearTimeout(gaDebounce);gaDebounce=setTimeout(applyAndRebuild,150);
    });
    // Size by connections
    _el('gui-sizebyconn').addEventListener('change',function(){
      GraphSettings.sizeByConnections=this.checked;
      applyAndRebuild();
    });
    // Always show labels
    _el('gui-showlabels').addEventListener('change',function(){
      GraphSettings.showLabels=this.checked;
    });
    // Cluster by type
    _el('gui-clustermode').addEventListener('change',function(){
      GraphSettings.clusterMode=this.checked;
      if(this.checked)GraphSettings.treeMode=false;
      _el('gui-treemode').checked=false;
      applyAndRebuild();
    });
    // Tree mode (forest)
    _el('gui-treemode').addEventListener('change',function(){
      GraphSettings.treeMode=this.checked;
      if(this.checked)GraphSettings.clusterMode=false;
      _el('gui-clustermode').checked=false;
      applyAndRebuild();
    });
    // Grid mode
    _el('gui-gridmode').addEventListener('change',function(){
      GraphSettings.gridMode=this.checked;
      if(this.checked){GraphSettings.treeMode=false;GraphSettings.yggdrasilMode=false;GraphSettings.clusterMode=false;}
      _el('gui-treemode').checked=false;
      _el('gui-yggmode').checked=false;
      _el('gui-clustermode').checked=false;
      applyAndRebuild();
    });
    // Yggdrasil mode
    _el('gui-yggmode').addEventListener('change',function(){
      GraphSettings.yggdrasilMode=this.checked;
      if(this.checked){GraphSettings.treeMode=false;GraphSettings.gridMode=false;GraphSettings.clusterMode=false;}
      _el('gui-treemode').checked=false;
      _el('gui-gridmode').checked=false;
      _el('gui-clustermode').checked=false;
      applyAndRebuild();
    });
    // Node brightness
    _el('gui-brightness').addEventListener('input',function(){
      GraphSettings.nodeBrightness=parseInt(this.value,10)/100;
      _el('gui-brightness-val').textContent=this.value;
    });
    // Search / highlight
    _el('gui-search-input').addEventListener('input',function(){
      GraphSettings.searchQuery=this.value.trim().toLowerCase();
    });
    // Reset
    _el('gui-reset-btn').addEventListener('click',function(){
      GraphSettings=JSON.parse(JSON.stringify(DEFAULT_GRAPH_SETTINGS));
      document.querySelectorAll('[data-gui-type]').forEach(function(cb){cb.checked=true;});
      _el('gui-linkdist').value=GraphSettings.linkDistance;
      _el('gui-linkdist-val').textContent=GraphSettings.linkDistance;
      _el('gui-repulsion').value=GraphSettings.repulsion;
      _el('gui-repulsion-val').textContent=GraphSettings.repulsion;
      _el('gui-nodesize').value=GraphSettings.nodeSizeScale*100;
      _el('gui-nodesize-val').textContent=GraphSettings.nodeSizeScale*100;
      _el('gui-grapharea').value=GraphSettings.graphArea*100;
      _el('gui-grapharea-val').textContent=GraphSettings.graphArea*100;
      _el('gui-sizebyconn').checked=false;
      _el('gui-showlabels').checked=false;
      _el('gui-clustermode').checked=false;
      _el('gui-treemode').checked=false;
      _el('gui-gridmode').checked=false;
      _el('gui-yggmode').checked=false;
      _el('gui-brightness').value=100;
      _el('gui-brightness-val').textContent='100';
      _el('gui-search-input').value='';
      applyAndRebuild();
    });
  }

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


// ═══════════════════════════════════════════════════════════
// ══  VAULT CHAT PANEL MODULE (VAULTCHAT)  ══════════════════
// ═══════════════════════════════════════════════════════════
var VAULTCHAT=(function(){
  var history=[];
  var busy=false;
  var currentMode='smart';
  var modeMeta={
    smart:{label:'Balanced',topN:12,minScore:0.03},
    broad:{label:'Wide sweep',topN:20,minScore:0.01},
    exact:{label:'Tight focus',topN:6,minScore:0.08}
  };
  var STOP=new Set(['the','and','for','are','but','not','you','all','can','had','was','one','our','out','get','has','how','its','may','now','see','who','did','too','use','that','this','with','have','from','they','will','been','were','said','each','into','than','your','more','then','some','them','what','when','also','just','know','take','after','could','think','about','would','these','those','other','well','want','much','still','while','even','back','come','made','only','over','here','down','does','like','time','most','date','type','tags','status']);
  var idfCache={};

  function buildIDF(){
    idfCache={};
    var N=(typeof vaultIndex!=='undefined')?vaultIndex.length:0;
    if(!N)return;
    var df={};
    vaultIndex.forEach(function(note){
      var words=new Set((note.name+' '+note.content).toLowerCase().split(/\W+/).filter(function(w){return w.length>2&&!STOP.has(w);}));
      words.forEach(function(w){df[w]=(df[w]||0)+1;});
    });
    Object.keys(df).forEach(function(w){idfCache[w]=Math.log((N+1)/(df[w]+1))+1;});
  }

  function tfidfScore(query,note){
    var qWords=query.toLowerCase().split(/\W+/).filter(function(w){return w.length>2&&!STOP.has(w);});
    if(!qWords.length)return 0;
    var content=(note.name+' '+note.content).toLowerCase();
    var words=content.split(/\W+/);
    var tf={};words.forEach(function(w){if(w.length>2)tf[w]=(tf[w]||0)+1;});
    var total=words.length||1;
    var score=0;
    qWords.forEach(function(w){
      var idf=idfCache[w]||Math.log(2);
      score+=((tf[w]||0)/total)*idf*(note.name.toLowerCase().includes(w)?5:1);
    });
    var dm=note.name.match(/(\d{4}-\d{2}-\d{2})/);
    if(dm){var age=(Date.now()-new Date(dm[1]).getTime())/86400000;if(age<7)score*=1.5;else if(age<30)score*=1.2;}
    return score;
  }

  function findRelevant(query,topN,minScore){
    if(typeof vaultIndex==='undefined'||!vaultIndex.length)return[];
    if(!Object.keys(idfCache).length)buildIDF();
    var scored=vaultIndex.map(function(note){return{note:note,score:tfidfScore(query,note)};});
    scored.sort(function(a,b){return b.score-a.score;});
    var results=scored.filter(function(s){return s.score>0;}).slice(0,topN);
    var maxScore=results.length?results[0].score:1;
    return results.map(function(s){return{note:s.note,score:s.score,pct:Math.round((s.score/maxScore)*100)};});
  }

  function buildSystem(relevant,query){
    var h=new Date().getHours();
    var tod=h>=5&&h<12?'morning':h>=12&&h<17?'afternoon':h>=17&&h<21?'evening':'night';
    var now=new Date();
    var ctx='[Date: '+now.toLocaleDateString([],{weekday:'long',year:'numeric',month:'long',day:'numeric'})+']';
    var sys='You are BAKER, an intelligent AI second brain modelled after JARVIS from Iron Man.\n'+
      'You have access to the user\'s personal knowledge vault.\n'+
      'Personality: precise, composed, quietly witty. Address as "sir" occasionally.\n'+
      'It is currently '+tod+'. '+ctx+'\n\n'+
      'RULES:\n- Answer from the vault notes provided\n'+
      '- If notes don\'t contain the answer, say so and suggest what to add\n'+
      '- Reference specific notes by name when relevant\n'+
      '- Spot patterns across notes the user might miss\n\n';
    if(!relevant.length){sys+='No vault connected or no relevant notes found.';return sys;}
    sys+='VAULT NOTES IN CONTEXT ('+relevant.length+' most relevant):\n\n';
    relevant.forEach(function(r){
      var trimmed=r.note.content.length>1500?r.note.content.slice(0,1500)+'\n...[truncated]':r.note.content;
      sys+='=== '+r.note.name+' ===\n'+trimmed+'\n\n';
    });
    sys+='Answer using the vault notes above. Be specific.';
    return sys;
  }

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function getTime(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}

  function _panel(){return document.getElementById('vaultchat-panel');}
  function _msgs(){return document.getElementById('vc-messages');}
  function _input(){return document.getElementById('vc-input');}

  function render(){
    var p=_panel();if(!p)return;
    // Panel already built via HTML — just refresh state
    var connected=typeof vaultConnected!=='undefined'&&vaultConnected;
    var statusEl=document.getElementById('vc-status');
    if(statusEl)statusEl.textContent=connected?(typeof vaultIndex!=='undefined'?vaultIndex.length+' notes':''):'Not connected';
  }

  function appendMsg(role,txt,sources){
    var msgs=_msgs();if(!msgs)return;
    var wrap=document.createElement('div');wrap.className='vc-msg vc-msg-'+role;
    var bub=document.createElement('div');bub.className='vc-bubble';bub.textContent=txt;
    var meta=document.createElement('div');meta.className='vc-meta';
    meta.textContent=(role==='user'?'You':'BAKER')+' · '+getTime();
    wrap.appendChild(bub);wrap.appendChild(meta);
    if(role==='baker'&&sources&&sources.length){
      var row=document.createElement('div');row.className='vc-sources';
      sources.slice(0,5).forEach(function(s){
        var chip=document.createElement('span');chip.className='vc-chip';
        chip.textContent=s.note.name.replace('.md','');
        chip.title=s.note.path;
        chip.addEventListener('click',function(){
          if(typeof VAULTUI!=='undefined'&&VAULTUI._openNoteByIdx){
            var idx=(typeof vaultIndex!=='undefined')?vaultIndex.indexOf(s.note):-1;
            if(idx>=0){VAULTUI.showPanel();setTimeout(function(){VAULTUI._openNoteByIdx(idx);},80);}
          }
        });
        row.appendChild(chip);
      });
      wrap.appendChild(row);
    }
    msgs.appendChild(wrap);msgs.scrollTop=msgs.scrollHeight;
  }

  function showThinking(){
    var msgs=_msgs();if(!msgs)return;
    var d=document.createElement('div');d.className='vc-msg vc-msg-baker';d.id='vc-thinking';
    d.innerHTML='<div class="vc-bubble vc-thinking"><span></span><span></span><span></span></div>';
    msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;
  }
  function removeThinking(){var t=document.getElementById('vc-thinking');if(t)t.remove();}

  function send(){
    if(busy)return;
    var input=_input();if(!input)return;
    var txt=input.value.trim();if(!txt)return;
    var key=localStorage.getItem('baker_api_key');
    if(!key){appendMsg('baker','No API key set, sir. Open Settings.');return;}
    input.value='';
    appendMsg('user',txt);
    var welcome=document.getElementById('vc-welcome');if(welcome)welcome.remove();
    var meta=modeMeta[currentMode];
    var relevant=findRelevant(txt,meta.topN,meta.minScore);
    history.push({role:'user',content:txt});
    busy=true;
    var sendBtn=document.getElementById('vc-send-btn');
    if(sendBtn)sendBtn.disabled=true;
    showThinking();
    fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,system:buildSystem(relevant,txt),messages:history.slice(-20)})
    }).then(function(resp){return resp.json();})
    .then(function(data){
      if(data.error)throw new Error(data.error.message);
      var raw=data.content.map(function(b){return b.text||'';}).join('').trim();
      removeThinking();
      appendMsg('baker',raw,relevant);
      history.push({role:'assistant',content:raw});
      if(history.length>20)history=history.slice(-20);
      try{localStorage.setItem(VCHAT_KEY,JSON.stringify(history));}catch(e){}
    }).catch(function(err){
      removeThinking();
      appendMsg('baker','I encountered a fault, sir: '+err.message);
    }).finally(function(){
      busy=false;
      if(sendBtn)sendBtn.disabled=false;
      var inp=_input();if(inp)inp.focus();
    });
  }

  function setMode(mode){
    currentMode=mode;
    ['smart','broad','exact'].forEach(function(m){
      var el=document.getElementById('vc-mode-'+m);
      if(el)el.className='vc-mode-pill'+(m===mode?' vc-mode-active':'');
    });
  }

  function clearChat(){
    history=[];
    try{localStorage.removeItem(VCHAT_KEY);}catch(e){}
    var msgs=_msgs();if(!msgs)return;
    msgs.innerHTML='<div class="vc-welcome" id="vc-welcome"><div class="vc-welcome-icon">🧠</div><div class="vc-welcome-title">Vault Chat</div><div class="vc-welcome-sub">Ask anything about your notes.</div></div>';
  }

  function showPanel(){
    var p=_panel();if(!p)return;
    p.classList.add('vc-vis');
    if(p._wbNormalise)p._wbNormalise();
    buildIDF();render();
    setTimeout(function(){var i=_input();if(i)i.focus();},100);
  }
  function hidePanel(){var p=_panel();if(p)p.classList.remove('vc-vis');}
  function togglePanel(){var p=_panel();if(!p)return;p.classList.toggle('vc-vis');if(p.classList.contains('vc-vis')){if(p._wbNormalise)p._wbNormalise();buildIDF();render();setTimeout(function(){var i=_input();if(i)i.focus();},100);}}

  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(/\b(open|pull up|show|launch)\b.*\b(vault chat|chat|ask my vault|query my vault)\b/.test(c)){
      showPanel();return'Opening vault chat, sir.';
    }
    return null;
  }

  function onVaultReady(){buildIDF();}

  function init(){
    var input=_input();
    if(input){
      input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
    }
    var sendBtn=document.getElementById('vc-send-btn');
    if(sendBtn)sendBtn.addEventListener('click',send);
    ['smart','broad','exact'].forEach(function(m){
      var el=document.getElementById('vc-mode-'+m);
      if(el)el.addEventListener('click',function(){setMode(m);});
    });
    var clearBtn=document.getElementById('vc-clear-btn');
    if(clearBtn)clearBtn.addEventListener('click',clearChat);
  }

  return{init,showPanel,hidePanel,togglePanel,handleVoice,onVaultReady,send};
})();
