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

  // ── Lightweight markdown → HTML renderer ────────────────
  function _renderMarkdown(md){
    if(!md)return'';
    var lines=md.split('\n');
    var html='';
    var inCode=false;
    var inList=false;
    var inOList=false;

    function closeList(){
      if(inList){html+='</ul>';inList=false;}
      if(inOList){html+='</ol>';inOList=false;}
    }
    function inline(s){
      return s
        .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,'<em>$1</em>')
        .replace(/`([^`]+)`/g,'<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px;font-size:0.9em">$1</code>')
        .replace(/\[\[([^\]]+)\]\]/g,'<span style="color:var(--accent);cursor:pointer;border-bottom:1px solid var(--accent-dim)">$1</span>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" style="color:var(--accent);text-decoration:underline">$1</a>');
    }

    lines.forEach(function(line){
      // Fenced code block
      if(line.startsWith('```')){
        if(inCode){html+='</code></pre>';inCode=false;}
        else{closeList();html+='<pre style="background:rgba(255,255,255,0.05);border-radius:6px;padding:10px 12px;overflow-x:auto;margin:8px 0"><code style="font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--text)">';inCode=true;}
        return;
      }
      if(inCode){html+=esc(line)+'\n';return;}

      // Horizontal rule
      if(/^[-*_]{3,}$/.test(line.trim())){closeList();html+='<hr style="border:none;border-top:1px solid var(--border);margin:12px 0">';return;}

      // Headings
      var hm=line.match(/^(#{1,6})\s+(.+)/);
      if(hm){closeList();var lvl=hm[1].length;var sz=['18','16','14','13','12','11'][lvl-1]||'12';
        html+='<h'+lvl+' style="font-family:var(--mono);font-size:'+sz+'px;color:var(--accent);margin:12px 0 4px;font-weight:700;letter-spacing:.04em">'+inline(esc(hm[2]))+'</h'+lvl+'>';return;}

      // Frontmatter --- skip
      if(line.trim()==='---'&&html===''){return;}

      // Checkboxes
      var cbm=line.match(/^\s*-\s+\[([ xX])\]\s+(.*)/);
      if(cbm){
        if(!inList){html+='<ul style="list-style:none;padding-left:4px;margin:4px 0">';inList=true;}
        var done=cbm[1].toLowerCase()==='x';
        html+='<li style="padding:3px 0;display:flex;align-items:flex-start;gap:7px">'+
          '<span style="width:14px;height:14px;border-radius:3px;border:1.5px solid '+(done?'var(--accent)':'var(--border)')+';background:'+(done?'var(--accent-dim)':'none')+';flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:2px">'+
          (done?'<span style="color:var(--accent);font-size:9px">✓</span>':'')+
          '</span><span style="'+(done?'text-decoration:line-through;color:var(--muted)':'color:var(--text)')+'">'+inline(esc(cbm[2]))+'</span></li>';
        return;
      }

      // Bullet list
      var bm=line.match(/^\s*[-*+]\s+(.*)/);
      if(bm){
        if(inOList){html+='</ol>';inOList=false;}
        if(!inList){html+='<ul style="padding-left:16px;margin:4px 0">';inList=true;}
        html+='<li style="padding:2px 0;color:var(--text)">'+inline(esc(bm[1]))+'</li>';
        return;
      }

      // Ordered list
      var om=line.match(/^\s*(\d+)\.\s+(.*)/);
      if(om){
        if(inList){html+='</ul>';inList=false;}
        if(!inOList){html+='<ol style="padding-left:18px;margin:4px 0">';inOList=true;}
        html+='<li style="padding:2px 0;color:var(--text)">'+inline(esc(om[2]))+'</li>';
        return;
      }

      // Blockquote
      var qm=line.match(/^>\s*(.*)/);
      if(qm){closeList();
        html+='<blockquote style="border-left:3px solid var(--accent-dim);padding:4px 10px;margin:6px 0;color:var(--muted);font-style:italic">'+inline(esc(qm[1]))+'</blockquote>';
        return;
      }

      // Table row
      if(line.includes('|')){
        closeList();
        var cells=line.split('|').filter(function(c){return c.trim();});
        if(cells.length&&!/^[-|\s]+$/.test(line)){
          html+='<tr>'+cells.map(function(c){return'<td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text)">'+inline(esc(c.trim()))+'</td>';}).join('')+'</tr>';
        }
        return;
      }

      // Empty line
      if(!line.trim()){closeList();html+='<div style="height:6px"></div>';return;}

      // Regular paragraph
      closeList();
      html+='<p style="margin:4px 0;color:var(--text);line-height:1.7">'+inline(esc(line))+'</p>';
    });

    closeList();
    if(inCode)html+='</code></pre>';

    // Wrap table rows
    html=html.replace(/(<tr>.*?<\/tr>)+/gs,function(m){
      return'<table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:10px;margin:8px 0">'+m+'</table>';
    });
    return html;
  }
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
    viewerContentEl.innerHTML=_renderMarkdown(note.content);
    viewerEl.classList.add('vis');
  }
  function closeNote(){
    currentNoteIdx=null;
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
      if(note)viewerContentEl.innerHTML=_renderMarkdown(note.content);
    }
  }
  async function _deleteCurrentNote(){
    if(currentNoteIdx===null)return;
    var note=vaultIndex[currentNoteIdx];
    if(!note)return;
    if(!window.confirm('Delete "'+note.name.replace(/\.md$/,'')+'"? This cannot be undone.'))return;
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected){
      if(typeof setStatus==='function')setStatus('Vault not connected.');return;
    }
    try{
      var parts=note.path.split('/');
      var dir=vaultHandle;
      for(var i=0;i<parts.length-1;i++)dir=await dir.getDirectoryHandle(parts[i]);
      await dir.removeEntry(parts[parts.length-1]);
      vaultIndex.splice(currentNoteIdx,1);
      currentNoteIdx=null;
      closeNote();
      renderList(searchInput?searchInput.value:'');
      if(typeof buildGraph==='function')setTimeout(buildGraph,300);
      if(typeof setStatus==='function')setStatus('Note deleted.');
    }catch(e){
      console.error('[VAULTUI] delete:',e);
      if(typeof setStatus==='function')setStatus('Could not delete note.');
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
      viewerContentEl.innerHTML=_renderMarkdown(newContent);
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
        buildGraph();
        // Spawn birth particle after graph rebuilds — regardless of current node count
        var _bpType=t.type||detectType(fullPath,'');
        var _bpPath=fullPath;
        setTimeout(function(){
          if(typeof spawnBirthParticle==='function')spawnBirthParticle(_bpType,_bpPath);
        },400);
        // Smart link suggestions (async, non-blocking)
        _suggestLinks(fullPath,content||'');
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
    var words=newContent.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(function(w){return w.length>2;});
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
    hdr.innerHTML='&#128279; Link Suggestions<button onclick="document.getElementById(\'baker-link-suggest\').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0">&#215;</button>';
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
      if(viewer&&viewerTitle&&viewerTitle.textContent===fname.replace('.md',''))viewer.innerHTML=_renderMarkdown(newContent);
    }).catch(function(){});
  }

  return{init,showPanel,hidePanel,togglePanel,handleVoice,refresh,_openNoteByIdx:openNote};
})();
