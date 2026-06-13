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
  searchQuery:'',
  nodeSizeScale:1,
  graphArea:1
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
    var ldDebounce;
    ld.addEventListener('input',function(){
      GraphSettings.linkDistance=parseInt(this.value,10);
      document.getElementById('gui-linkdist-val').textContent=this.value;
      clearTimeout(ldDebounce);
      ldDebounce=setTimeout(applyAndRebuild,150);
    });
    // Repulsion
    var rp=document.getElementById('gui-repulsion');
    var rpDebounce;
    rp.addEventListener('input',function(){
      GraphSettings.repulsion=parseInt(this.value,10);
      document.getElementById('gui-repulsion-val').textContent=this.value;
      clearTimeout(rpDebounce);
      rpDebounce=setTimeout(applyAndRebuild,150);
    });
    // Node size
    var ns=document.getElementById('gui-nodesize');
    var nsDebounce;
    ns.addEventListener('input',function(){
      GraphSettings.nodeSizeScale=parseInt(this.value,10)/100;
      document.getElementById('gui-nodesize-val').textContent=this.value;
      clearTimeout(nsDebounce);
      nsDebounce=setTimeout(applyAndRebuild,150);
    });
    // Graph area
    var ga=document.getElementById('gui-grapharea');
    var gaDebounce;
    ga.addEventListener('input',function(){
      GraphSettings.graphArea=parseInt(this.value,10)/100;
      document.getElementById('gui-grapharea-val').textContent=this.value;
      clearTimeout(gaDebounce);
      gaDebounce=setTimeout(applyAndRebuild,150);
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
      document.getElementById('gui-nodesize').value=GraphSettings.nodeSizeScale*100;
      document.getElementById('gui-nodesize-val').textContent=GraphSettings.nodeSizeScale*100;
      document.getElementById('gui-grapharea').value=GraphSettings.graphArea*100;
      document.getElementById('gui-grapharea-val').textContent=GraphSettings.graphArea*100;
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
