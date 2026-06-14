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
      label:'📆 Daily Log',
      desc:'Today\'s log — top 3, notes, done, tomorrow',
      folder:'00-Capture',
      needsTitle:false,
      filename:function(){return todayStr()+'.md';},
      body:function(){return '---\n'+
        'date: '+todayStr()+'\n'+
        'type: daily-log\n'+
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
        if(typeof graphNodes!=='undefined'&&graphNodes.length)buildGraph();
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
    if(document.getElementById('vault-panel').classList.contains('vp-vis')){
      renderFilterBar();
      renderList(searchInput?searchInput.value:'');
    }
  }

  return{init,showPanel,hidePanel,togglePanel,handleVoice,refresh,_openNoteByIdx:openNote};
})();

// ═══════════════════════════════════════════════════════════
// ══  GRAPH SETTINGS  ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════
var GraphSettings={
  typeFilter:{conversation:true,project:true,lecture:true,daily:true,general:true},
  linkDistance:90,
  repulsion:100,
  sizeByConnections:false,
  showLabels:false,
  searchQuery:'',
  nodeSizeScale:1,
  graphArea:1,
  treeMode:false,
  clusterMode:false,
  nodeBrightness:1.0
};
var DEFAULT_GRAPH_SETTINGS=JSON.parse(JSON.stringify(GraphSettings));

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
    // Type filters
    document.querySelectorAll('[data-gui-type]').forEach(function(cb){
      cb.addEventListener('change',function(){
        GraphSettings.typeFilter[cb.dataset.guiType]=cb.checked;
        applyAndRebuild();
      });
    });
    // Link distance
    var ld=document.getElementById('gui-linkdist');
    var ldDebounce;
    ld.addEventListener('input',function(){
      GraphSettings.linkDistance=parseInt(this.value,10);
      document.getElementById('gui-linkdist-val').textContent=this.value;
      clearTimeout(ldDebounce);ldDebounce=setTimeout(applyAndRebuild,150);
    });
    // Repulsion
    var rp=document.getElementById('gui-repulsion');
    var rpDebounce;
    rp.addEventListener('input',function(){
      GraphSettings.repulsion=parseInt(this.value,10);
      document.getElementById('gui-repulsion-val').textContent=this.value;
      clearTimeout(rpDebounce);rpDebounce=setTimeout(applyAndRebuild,150);
    });
    // Node size
    var ns=document.getElementById('gui-nodesize');
    var nsDebounce;
    ns.addEventListener('input',function(){
      GraphSettings.nodeSizeScale=parseInt(this.value,10)/100;
      document.getElementById('gui-nodesize-val').textContent=this.value;
      clearTimeout(nsDebounce);nsDebounce=setTimeout(applyAndRebuild,150);
    });
    // Graph area
    var ga=document.getElementById('gui-grapharea');
    var gaDebounce;
    ga.addEventListener('input',function(){
      GraphSettings.graphArea=parseInt(this.value,10)/100;
      document.getElementById('gui-grapharea-val').textContent=this.value;
      clearTimeout(gaDebounce);gaDebounce=setTimeout(applyAndRebuild,150);
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
    // Cluster by type
    document.getElementById('gui-clustermode').addEventListener('change',function(){
      GraphSettings.clusterMode=this.checked;
      if(this.checked)GraphSettings.treeMode=false;
      document.getElementById('gui-treemode').checked=false;
      applyAndRebuild();
    });
    // Tree mode (forest)
    document.getElementById('gui-treemode').addEventListener('change',function(){
      GraphSettings.treeMode=this.checked;
      if(this.checked)GraphSettings.clusterMode=false;
      document.getElementById('gui-clustermode').checked=false;
      applyAndRebuild();
    });
    // Node brightness
    document.getElementById('gui-brightness').addEventListener('input',function(){
      GraphSettings.nodeBrightness=parseInt(this.value,10)/100;
      document.getElementById('gui-brightness-val').textContent=this.value;
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
      document.getElementById('gui-nodesize').value=GraphSettings.nodeSizeScale*100;
      document.getElementById('gui-nodesize-val').textContent=GraphSettings.nodeSizeScale*100;
      document.getElementById('gui-grapharea').value=GraphSettings.graphArea*100;
      document.getElementById('gui-grapharea-val').textContent=GraphSettings.graphArea*100;
      document.getElementById('gui-sizebyconn').checked=false;
      document.getElementById('gui-showlabels').checked=false;
      document.getElementById('gui-clustermode').checked=false;
      document.getElementById('gui-treemode').checked=false;
      document.getElementById('gui-brightness').value=100;
      document.getElementById('gui-brightness-val').textContent='100';
      document.getElementById('gui-search-input').value='';
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
