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
    treeMode:false,clusterMode:false,gridMode:false,yggdrasilMode:false,nineRealmsMode:false,
    linkStrength:0.5,collisionRadius:50,gravity:0.5,velocityDecay:0.4,simSpeed:0.6,
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
    function _on(id,ev,fn){var e=_el(id);if(e)e.addEventListener(ev,fn);}
    // Type filters
    document.querySelectorAll('[data-gui-type]').forEach(function(cb){
      cb.addEventListener('change',function(){
        GraphSettings.typeFilter[cb.dataset.guiType]=cb.checked;
        applyAndRebuild();
      });
    });
    // Link distance
    var ld=_el('gui-linkdist');
    var ldDebounce;
    ld.addEventListener('input',function(){
      GraphSettings.linkDistance=parseInt(this.value,10);
      (_el('gui-linkdist-val')||{}).textContent =this.value;
      clearTimeout(ldDebounce);ldDebounce=setTimeout(applyAndRebuild,150);
    });
    // Repulsion
    var rp=_el('gui-repulsion');
    var rpDebounce;
    rp.addEventListener('input',function(){
      GraphSettings.repulsion=parseInt(this.value,10);
      (_el('gui-repulsion-val')||{}).textContent =this.value;
      clearTimeout(rpDebounce);rpDebounce=setTimeout(applyAndRebuild,150);
    });
    // Node size
    var ns=_el('gui-nodesize');
    var nsDebounce;
    ns.addEventListener('input',function(){
      GraphSettings.nodeSizeScale=parseInt(this.value,10)/100;
      (_el('gui-nodesize-val')||{}).textContent =this.value;
      clearTimeout(nsDebounce);nsDebounce=setTimeout(applyAndRebuild,150);
    });
    // Graph area
    var ga=_el('gui-grapharea');
    var gaDebounce;
    ga.addEventListener('input',function(){
      GraphSettings.graphArea=parseInt(this.value,10)/100;
      (_el('gui-grapharea-val')||{}).textContent =this.value;
      clearTimeout(gaDebounce);gaDebounce=setTimeout(applyAndRebuild,150);
    });
    // Size by connections
    _on('gui-sizebyconn','change',function(){
      GraphSettings.sizeByConnections=this.checked;
      applyAndRebuild();
    });
    // Always show labels
    _on('gui-showlabels','change',function(){
      GraphSettings.showLabels=this.checked;
    });
    // Cluster by type
    _on('gui-clustermode','change',function(){
      GraphSettings.clusterMode=this.checked;
      if(this.checked)GraphSettings.treeMode=false;
      (_el('gui-treemode')||{}).checked =false;
      applyAndRebuild();
    });
    // Tree mode (forest)
    _on('gui-treemode','change',function(){
      GraphSettings.treeMode=this.checked;
      if(this.checked)GraphSettings.clusterMode=false;
      (_el('gui-clustermode')||{}).checked =false;
      applyAndRebuild();
    });
    // Grid mode
    _on('gui-gridmode','change',function(){
      GraphSettings.gridMode=this.checked;
      if(this.checked){GraphSettings.treeMode=false;GraphSettings.yggdrasilMode=false;GraphSettings.clusterMode=false;}
      (_el('gui-treemode')||{}).checked =false;
      (_el('gui-yggmode')||{}).checked =false;
      (_el('gui-clustermode')||{}).checked =false;
      applyAndRebuild();
    });
    // Yggdrasil mode
    _on('gui-yggmode','change',function(){
      GraphSettings.yggdrasilMode=this.checked;
      if(this.checked){GraphSettings.treeMode=false;GraphSettings.gridMode=false;GraphSettings.clusterMode=false;}
      (_el('gui-treemode')||{}).checked =false;
      (_el('gui-gridmode')||{}).checked =false;
      (_el('gui-clustermode')||{}).checked =false;
      applyAndRebuild();
    });
    // Nine Realms mode
    _on('gui-ninerealmsmode','change',function(){
      GraphSettings.nineRealmsMode=this.checked;
      if(this.checked){
        GraphSettings.treeMode=false;GraphSettings.gridMode=false;
        GraphSettings.clusterMode=false;GraphSettings.yggdrasilMode=false;
      }
      (_el('gui-treemode')||{}).checked=false;
      (_el('gui-gridmode')||{}).checked=false;
      (_el('gui-clustermode')||{}).checked=false;
      (_el('gui-yggmode')||{}).checked=false;
      applyAndRebuild();
    });
    // Node brightness
    _on('gui-brightness','input',function(){
      GraphSettings.nodeBrightness=parseInt(this.value,10)/100;
      (_el('gui-brightness-val')||{}).textContent =this.value;
    });
    _on('gui-linkstrength','input',function(){
      GraphSettings.linkStrength=parseInt(this.value,10)/100;
      (_el('gui-linkstrength-val')||{}).textContent=this.value;
      applyAndRebuild();
    });
    _on('gui-collision','input',function(){
      GraphSettings.collisionRadius=parseInt(this.value,10);
      (_el('gui-collision-val')||{}).textContent=this.value;
      applyAndRebuild();
    });
    _on('gui-gravity','input',function(){
      GraphSettings.gravity=parseInt(this.value,10)/100;
      (_el('gui-gravity-val')||{}).textContent=this.value;
      applyAndRebuild();
    });
    _on('gui-decay','input',function(){
      GraphSettings.velocityDecay=parseInt(this.value,10)/100;
      (_el('gui-decay-val')||{}).textContent=this.value;
      applyAndRebuild();
    });
    _on('gui-simspeed','input',function(){
      GraphSettings.simSpeed=parseInt(this.value,10)/100;
      (_el('gui-simspeed-val')||{}).textContent=this.value;
      applyAndRebuild();
    });
    // Search / highlight
    _on('gui-search-input','input',function(){
      GraphSettings.searchQuery=this.value.trim().toLowerCase();
    });
    // Reset
    _on('gui-reset-btn','click',function(){
      GraphSettings=JSON.parse(JSON.stringify(DEFAULT_GRAPH_SETTINGS));
      document.querySelectorAll('[data-gui-type]').forEach(function(cb){cb.checked=true;});
      function _set(id,prop,val){var e=_el(id);if(e)e[prop]=val;}
      _set('gui-linkdist','value',GraphSettings.linkDistance);
      _set('gui-linkdist-val','textContent',GraphSettings.linkDistance);
      _set('gui-repulsion','value',GraphSettings.repulsion);
      _set('gui-repulsion-val','textContent',GraphSettings.repulsion);
      _set('gui-nodesize','value',GraphSettings.nodeSizeScale*100);
      _set('gui-nodesize-val','textContent',GraphSettings.nodeSizeScale*100);
      _set('gui-grapharea','value',GraphSettings.graphArea*100);
      _set('gui-grapharea-val','textContent',GraphSettings.graphArea*100);
      _set('gui-sizebyconn','checked',false);
      _set('gui-showlabels','checked',false);
      _set('gui-clustermode','checked',false);
      _set('gui-treemode','checked',false);
      _set('gui-gridmode','checked',false);
      _set('gui-yggmode','checked',false);
      _set('gui-brightness','value',100);
      _set('gui-brightness-val','textContent','100');
      _set('gui-search-input','value','');
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
  function switchGuiTab(tab){
    ['filter','display','forces'].forEach(function(t){
      var btn=document.getElementById('gui-tab-'+t);
      var cnt=document.getElementById('gui-tab-'+t+'-content');
      if(btn)btn.classList.toggle('active',t===tab);
      if(cnt)cnt.style.display=(t===tab?'block':'none');
    });
  }
  return{init,showPanel,hidePanel,togglePanel,handleVoice,switchGuiTab};
})();


// ═══════════════════════════════════════════════════════════
// ══  VAULT CHAT PANEL MODULE (VAULTCHAT)  ══════════════════
// ═══════════════════════════════════════════════════════════
var VAULTCHAT=(function(){
  var VCHAT_KEY='baker_vc_history';
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
    // "make a note" / "note that" / "add to my notes" — creates a vault note
    var noteMatch=c.match(/(?:make a note(?: that| about)?|note (?:this|that)|jot (?:this|that)|log this|save (?:this|that) to (?:my )?(?:vault|notes?))[:,]?\s*(.+)/);
    if(noteMatch){
      var noteContent=noteMatch[1].trim();
      if(!noteContent)return'What should I note, sir?';
      _writeQuickNote(noteContent);
      return'Noted, sir. I\'ve saved that to your vault.';
    }
    return null;
  }

  // Write a quick note to today's daily log under ## Notes
  async function _writeQuickNote(content){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected){
      if(typeof speakResponse==='function')speakResponse('Vault not connected, sir. I cannot save that.');
      return;
    }
    try{
      var now=new Date();
      var ds=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
      var ts=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
      var dir=await vaultHandle.getDirectoryHandle('00-Capture',{create:true});
      var fname=ds+'.md';
      var fh=await dir.getFileHandle(fname,{create:true});
      var existing=await(await fh.getFile()).text();
      // If file is empty/new, create with template
      if(!existing.trim()){
        existing='---\ntype: daily\ndate: '+ds+'\nweek: \nmood: \nenergy: \n---\n\n# Daily Log \u2014 '+ds+'\n\n## Top 3\n- \n- \n- \n\n## Notes\n\n## Done\n\n## Tomorrow\n\n## Conversations\n\n## Transactions\n';
      }
      var bullet='- '+ts+' \u2014 '+content+'\n';
      var notesIdx=existing.indexOf('## Notes');
      if(notesIdx>=0){
        var insertAt=existing.indexOf('\n',notesIdx)+1;
        // Skip blank line after header
        if(existing[insertAt]==='\n')insertAt++;
        existing=existing.slice(0,insertAt)+bullet+existing.slice(insertAt);
      }else{
        existing+='\'\n## Notes\n'+bullet;
      }
      var w=await fh.createWritable();
      await w.write(existing);await w.close();
      // Refresh vault index
      if(typeof buildGraph==='function')setTimeout(buildGraph,400);
    }catch(e){
      console.error('[VAULTCHAT] _writeQuickNote error:',e);
    }
  }

  function onVaultReady(){buildIDF();}

  function init(){
    // Load persisted history
    try{
      var saved=localStorage.getItem(VCHAT_KEY);
      if(saved){
        history=JSON.parse(saved);
        // Rebuild UI from saved history
        var msgs=_msgs();
        if(msgs&&history.length){
          var welcome=document.getElementById('vc-welcome');
          if(welcome)welcome.remove();
          history.forEach(function(m){
            if(m.role==='user')appendMsg('user',m.content);
            else if(m.role==='assistant')appendMsg('baker',m.content,[]);
          });
        }
      }
    }catch(e){history=[];}
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
