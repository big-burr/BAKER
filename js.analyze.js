// ═══════════════════════════════════════════════════════════
// ══  BAKER ANALYZE — Universal Drop & Analyze Panel  ═══════
// ═══════════════════════════════════════════════════════════
// Upgrade over filedrop.js — dedicated panel with:
// • Drag & drop zone: images, PDFs, text files, URLs, raw text
// • Live preview of dropped content
// • Custom prompt box to ask specific questions
// • Full analysis with Claude vision / text
// • Vault save with AI-generated summary + tags
// • History of last 5 analyzed items
// ═══════════════════════════════════════════════════════════
var ANALYZE=(function(){

  var PANEL_ID='analyze-panel';
  var LS_KEY='baker_analyze_history';
  var _processing=false;
  var _currentItem=null; // {type,name,data,preview}
  var _currentAnalysis=null;
  var _history=[];

  function _load(){
    try{var r=localStorage.getItem(LS_KEY);if(r)_history=JSON.parse(r);}
    catch(e){_history=[];}
    if(!Array.isArray(_history))_history=[];
  }
  function _saveHistory(){
    _history=_history.slice(-5);
    try{localStorage.setItem(LS_KEY,JSON.stringify(_history));}catch(e){}
  }

  // ── Accept types ──────────────────────────────────────────
  function _getItemType(file){
    if(!file)return null;
    if(/^image\//i.test(file.type))return'image';
    if(file.type==='application/pdf')return'pdf';
    if(/^text\//i.test(file.type)||/\.(txt|md|csv|json|js|py|html|css|xml)$/i.test(file.name))return'text';
    return null;
  }

  function _readBase64(file){
    return new Promise(function(res,rej){
      var r=new FileReader();
      r.onload=function(){res(r.result.split(',')[1]);};
      r.onerror=rej;
      r.readAsDataURL(file);
    });
  }
  function _readText(file){
    return new Promise(function(res,rej){
      var r=new FileReader();
      r.onload=function(){res(r.result);};
      r.onerror=rej;
      r.readAsText(file);
    });
  }

  // ── Handle drop ───────────────────────────────────────────
  async function handleDrop(e){
    e.preventDefault();
    var zone=document.getElementById('az-dropzone');
    if(zone)zone.classList.remove('az-drag-over');

    var file=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
    // Also handle dropped text/URL
    var text=e.dataTransfer&&e.dataTransfer.getData('text/plain');
    var url=e.dataTransfer&&e.dataTransfer.getData('text/uri-list');

    if(file){
      var type=_getItemType(file);
      if(!type){
        _showError('Unsupported file type. Drop an image, PDF, or text file.');
        return;
      }
      var data;
      if(type==='text'){
        data=await _readText(file);
        _currentItem={type:'text',name:file.name,data:data,
          preview:data.slice(0,400)+(data.length>400?'...':'')};
      }else{
        data=await _readBase64(file);
        _currentItem={type:type,name:file.name,data:data,
          mediaType:file.type,size:file.size,
          preview:type==='image'?('data:'+file.type+';base64,'+data):null};
      }
    }else if(url&&/^https?:\/\//.test(url.trim())){
      _currentItem={type:'url',name:url.trim(),data:url.trim(),preview:url.trim()};
    }else if(text&&text.trim().length>10){
      _currentItem={type:'text',name:'Pasted text',data:text.trim(),
        preview:text.slice(0,400)+(text.length>400?'...':'')};
    }else{
      return;
    }

    _renderPreview();
  }

  // ── Handle paste (Ctrl+V into panel) ─────────────────────
  async function handlePaste(e){
    var items=e.clipboardData&&e.clipboardData.items;
    if(!items)return;
    for(var i=0;i<items.length;i++){
      var item=items[i];
      if(/^image\//.test(item.type)){
        var file=item.getAsFile();
        if(file){
          var data=await _readBase64(file);
          _currentItem={type:'image',name:'Pasted image',data:data,
            mediaType:item.type,size:file.size,
            preview:'data:'+item.type+';base64,'+data};
          _renderPreview();
          return;
        }
      }
    }
    // Text paste
    var text=e.clipboardData.getData('text/plain');
    if(text&&text.trim().length>10){
      _currentItem={type:'text',name:'Pasted text',data:text.trim(),
        preview:text.slice(0,400)+(text.length>400?'...':'')};
      _renderPreview();
    }
  }

  // ── Render ────────────────────────────────────────────────
  function render(){
    var body=document.getElementById('az-body');if(!body)return;
    body.innerHTML=
      // Drop zone
      '<div id="az-dropzone" style="'+
        'border:2px dashed var(--border);border-radius:10px;padding:24px;text-align:center;'+
        'margin-bottom:12px;transition:all .2s;cursor:pointer;background:var(--surface)">'+
        '<div style="font-size:28px;margin-bottom:8px">⬇</div>'+
        '<div style="font-family:var(--mono);font-size:11px;color:var(--accent);margin-bottom:4px">Drop anything here</div>'+
        '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);line-height:1.7">'+
          'Images · PDFs · Text files · URLs · Paste with Ctrl+V<br>'+
          'Or drag from browser, file explorer, anywhere'+
        '</div>'+
      '</div>'+
      // Preview area (hidden until drop)
      '<div id="az-preview-area" style="display:none"></div>'+
      // Prompt input
      '<div id="az-prompt-area" style="display:none">'+
        '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.08em;margin-bottom:5px">CUSTOM PROMPT (optional)</div>'+
        '<div style="display:flex;gap:6px">'+
          '<input id="az-prompt" placeholder="Ask something specific about this content..." '+
          'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px 10px;font-family:var(--mono);font-size:10px;color:var(--text);outline:none">'+
          '<button id="az-analyze-btn" style="background:var(--accent-dim);border:1px solid var(--accent);border-radius:4px;padding:6px 12px;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer;white-space:nowrap">◆ Analyze</button>'+
        '</div>'+
        '<div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap" id="az-quick-prompts">'+
          _quickBtn('Summarize this','Provide a concise summary of this content.')+
          _quickBtn('Key points','Extract the key points and main ideas.')+
          _quickBtn('Action items','Identify any action items or next steps.')+
          _quickBtn('Explain simply','Explain this in simple terms.')+
        '</div>'+
      '</div>'+
      // Analysis output
      '<div id="az-output" style="display:none"></div>'+
      // History
      (_history.length?'<div id="az-history"><div style="font-family:var(--mono);font-size:8px;color:var(--muted);letter-spacing:.1em;margin:10px 0 6px">RECENT</div>'+
        _history.slice().reverse().map(function(h,i){
          return'<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface);border:1px solid var(--border);border-radius:4px;margin-bottom:4px;cursor:pointer;font-family:var(--mono);font-size:9px;color:var(--muted)" class="az-hist-item" data-i="'+(4-i)+'">'+
            '<span>'+(h.type==='image'?'🖼':h.type==='pdf'?'📄':h.type==='url'?'🔗':'📝')+'</span>'+
            '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+h.name+'</span>'+
            '<span>'+h.date+'</span></div>';
        }).join('')+'</div>':'');

    _bindDropzone();
  }

  function _quickBtn(label,prompt){
    return'<button class="az-quick" data-p="'+prompt+'" style="background:none;border:1px solid var(--border);border-radius:3px;padding:3px 7px;font-family:var(--mono);font-size:9px;color:var(--muted);cursor:pointer">'+label+'</button>';
  }

  function _bindDropzone(){
    var zone=document.getElementById('az-dropzone');
    if(!zone)return;
    zone.addEventListener('dragover',function(e){e.preventDefault();zone.classList.add('az-drag-over');zone.style.borderColor='var(--accent)';zone.style.background='rgba(124,106,247,0.06)';});
    zone.addEventListener('dragleave',function(){zone.classList.remove('az-drag-over');zone.style.borderColor='var(--border)';zone.style.background='var(--surface)';});
    zone.addEventListener('drop',function(e){zone.style.borderColor='var(--border)';zone.style.background='var(--surface)';handleDrop(e);});
    // File picker on click
    zone.addEventListener('click',function(){
      var inp=document.createElement('input');inp.type='file';
      inp.accept='image/*,.pdf,.txt,.md,.csv,.json,.js,.py,.html,.css';
      inp.onchange=async function(){
        if(!inp.files||!inp.files[0])return;
        var fakeEvt={dataTransfer:{files:inp.files,getData:function(){return'';}}};
        handleDrop(fakeEvt);
      };
      inp.click();
    });

    // Quick prompts
    document.querySelectorAll('.az-quick').forEach(function(btn){
      btn.addEventListener('click',function(){
        var inp=document.getElementById('az-prompt');
        if(inp)inp.value=btn.dataset.p;
      });
      btn.addEventListener('mouseenter',function(){btn.style.borderColor='var(--accent)';btn.style.color='var(--accent)';});
      btn.addEventListener('mouseleave',function(){btn.style.borderColor='var(--border)';btn.style.color='var(--muted)';});
    });

    // Analyze button
    var analyzeBtn=document.getElementById('az-analyze-btn');
    if(analyzeBtn)analyzeBtn.addEventListener('click',_runAnalysis);

    // Prompt enter
    var promptInp=document.getElementById('az-prompt');
    if(promptInp)promptInp.addEventListener('keydown',function(e){if(e.key==='Enter')_runAnalysis();});

    // History items
    document.querySelectorAll('.az-hist-item').forEach(function(item){
      item.addEventListener('click',function(){
        var h=_history[parseInt(item.dataset.i)];
        if(h){_currentItem=h;_currentAnalysis=h.analysis||null;_renderPreview();if(_currentAnalysis)_showAnalysis(_currentAnalysis);}
      });
    });

    // Paste listener on panel
    var panel=document.getElementById(PANEL_ID);
    if(panel)panel.addEventListener('paste',handlePaste);
  }

  function _renderPreview(){
    if(!_currentItem)return;
    var previewArea=document.getElementById('az-preview-area');
    var promptArea=document.getElementById('az-prompt-area');
    var output=document.getElementById('az-output');
    if(!previewArea)return;

    previewArea.style.display='block';
    if(promptArea)promptArea.style.display='block';
    if(output)output.style.display='none';
    _currentAnalysis=null;

    var html='<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px">';
    html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'+
      '<span style="font-size:16px">'+(_currentItem.type==='image'?'🖼':_currentItem.type==='pdf'?'📄':_currentItem.type==='url'?'🔗':'📝')+'</span>'+
      '<span style="font-family:var(--mono);font-size:10px;color:var(--accent);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_currentItem.name+'</span>'+
      '<button id="az-clear" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;padding:0">✕ Clear</button>'+
    '</div>';

    if(_currentItem.type==='image'&&_currentItem.preview){
      html+='<img src="'+_currentItem.preview+'" style="max-width:100%;max-height:180px;object-fit:contain;border-radius:4px;display:block;margin:0 auto">';
    }else if(_currentItem.type==='url'){
      html+='<div style="font-family:var(--mono);font-size:10px;color:var(--muted);word-break:break-all">'+_currentItem.data+'</div>';
    }else if(_currentItem.preview){
      html+='<div style="font-family:var(--mono);font-size:9px;color:var(--muted);line-height:1.6;max-height:80px;overflow:hidden">'+
        _currentItem.preview.replace(/</g,'&lt;')+'</div>';
    }
    html+='</div>';
    previewArea.innerHTML=html;

    var clearBtn=document.getElementById('az-clear');
    if(clearBtn)clearBtn.addEventListener('click',function(){
      _currentItem=null;_currentAnalysis=null;
      previewArea.style.display='none';
      if(promptArea)promptArea.style.display='none';
      if(output)output.style.display='none';
    });
  }

  // ── Run analysis ──────────────────────────────────────────
  async function _runAnalysis(){
    if(_processing||!_currentItem)return;
    var key=localStorage.getItem('baker_api_key');
    if(!key){_showError('No API key — go to Settings');return;}

    var customPrompt=(document.getElementById('az-prompt')||{}).value||'';
    _processing=true;

    var analyzeBtn=document.getElementById('az-analyze-btn');
    if(analyzeBtn){analyzeBtn.textContent='Analyzing...';analyzeBtn.disabled=true;}

    var output=document.getElementById('az-output');
    if(output){
      output.style.display='block';
      output.innerHTML='<div style="font-family:var(--mono);font-size:10px;color:var(--muted);padding:12px;text-align:center">'+
        '<div style="font-size:20px;margin-bottom:6px;animation:spin 1s linear infinite">◎</div>Analyzing...</div>';
    }

    try{
      var content=[];
      var basePrompt=customPrompt||'Analyze this content thoroughly. Provide:\n1. TITLE: [5-word descriptive title]\n2. SUMMARY: [2-3 sentence overview]\n3. KEY POINTS: [bullet list]\n4. DETAILS: [expanded analysis]\n5. TAGS: [3-5 relevant tags, comma-separated]';

      if(_currentItem.type==='image'){
        content=[
          {type:'image',source:{type:'base64',media_type:_currentItem.mediaType,data:_currentItem.data}},
          {type:'text',text:basePrompt}
        ];
      }else if(_currentItem.type==='pdf'){
        content=[
          {type:'document',source:{type:'base64',media_type:'application/pdf',data:_currentItem.data}},
          {type:'text',text:basePrompt}
        ];
      }else if(_currentItem.type==='url'){
        content=[{type:'text',text:'Analyze this URL and what it likely contains.\nURL: '+_currentItem.data+'\n\n'+basePrompt}];
      }else{
        var textContent=_currentItem.data;
        if(textContent.length>8000)textContent=textContent.slice(0,8000)+'...[truncated]';
        content=[{type:'text',text:'Analyze this content:\n\n'+textContent+'\n\n'+basePrompt}];
      }

      var resp=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,
          'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1200,
          messages:[{role:'user',content:content}]})
      });
      var d=await resp.json();
      if(d.error)throw new Error(d.error.message);
      var analysis=d.content.map(function(b){return b.text||'';}).join('').trim();

      _currentAnalysis=analysis;

      // Save to history
      var titleM=analysis.match(/^TITLE:\s*(.+)$/m);
      var shortTitle=titleM?titleM[1].trim():_currentItem.name;
      var histItem=Object.assign({},_currentItem,{
        analysis:analysis,
        date:new Date().toISOString().slice(0,10),
        name:shortTitle
      });
      // Remove base64 data from history to save space
      delete histItem.data;delete histItem.preview;
      _history.push(histItem);
      _saveHistory();

      _showAnalysis(analysis);
      if(typeof speakResponse==='function')
        speakResponse('Analysis complete, sir. '+shortTitle+'.');

    }catch(e){
      _showError('Analysis failed: '+e.message);
    }
    _processing=false;
    if(analyzeBtn){analyzeBtn.textContent='◆ Analyze';analyzeBtn.disabled=false;}
  }

  function _showAnalysis(analysis){
    var output=document.getElementById('az-output');if(!output)return;
    output.style.display='block';

    // Extract tags if present
    var tagsM=analysis.match(/^TAGS:\s*(.+)$/m);
    var tags=tagsM?tagsM[1].trim():'';

    var rendered=analysis
      .replace(/\*\*(.+?)\*\*/g,'<strong style="color:var(--accent)">$1</strong>')
      .replace(/^TITLE:\s*/m,'<span style="font-size:8px;color:var(--muted);letter-spacing:.1em">TITLE: </span>')
      .replace(/^SUMMARY:\s*/m,'<div style="margin-top:6px;font-size:8px;color:var(--muted);letter-spacing:.1em">SUMMARY</div>')
      .replace(/^KEY POINTS:\s*/m,'<div style="margin-top:6px;font-size:8px;color:var(--muted);letter-spacing:.1em">KEY POINTS</div>')
      .replace(/^DETAILS:\s*/m,'<div style="margin-top:6px;font-size:8px;color:var(--muted);letter-spacing:.1em">DETAILS</div>')
      .replace(/^TAGS:\s*/m,'<div style="margin-top:6px;font-size:8px;color:var(--muted);letter-spacing:.1em">TAGS</div>')
      .replace(/^[-•]\s/gm,'<div style="padding-left:8px;color:var(--muted)">• ')
      .replace(/\n/g,'<br>');

    output.innerHTML=
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border)">'+
          '<span style="font-family:var(--mono);font-size:9px;color:var(--accent);letter-spacing:.08em">◆ ANALYSIS</span>'+
          '<div style="display:flex;gap:5px">'+
            '<button id="az-save-btn" style="background:none;border:1px solid var(--green);border-radius:3px;padding:3px 8px;font-family:var(--mono);font-size:9px;color:var(--green);cursor:pointer">&#128190; Save to Vault</button>'+
            '<button id="az-copy-btn" style="background:none;border:1px solid var(--border);border-radius:3px;padding:3px 8px;font-family:var(--mono);font-size:9px;color:var(--muted);cursor:pointer">Copy</button>'+
          '</div>'+
        '</div>'+
        '<div style="padding:10px 12px;max-height:280px;overflow-y:auto;font-family:var(--mono);font-size:10px;color:var(--text);line-height:1.7">'+
          rendered+'</div>'+
        (tags?'<div style="padding:6px 12px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:4px">'+
          tags.split(',').map(function(t){return'<span style="background:rgba(124,106,247,0.1);border:1px solid var(--accent-dim);border-radius:3px;padding:2px 6px;font-family:var(--mono);font-size:8px;color:var(--accent)">'+t.trim()+'</span>';}).join('')+
        '</div>':'')+
      '</div>';

    var saveBtn=document.getElementById('az-save-btn');
    if(saveBtn)saveBtn.addEventListener('click',function(){_saveToVault(analysis);});
    var copyBtn=document.getElementById('az-copy-btn');
    if(copyBtn)copyBtn.addEventListener('click',function(){
      navigator.clipboard&&navigator.clipboard.writeText(analysis);
      copyBtn.textContent='Copied!';setTimeout(function(){copyBtn.textContent='Copy';},2000);
    });
  }

  // ── Save to vault ─────────────────────────────────────────
  async function _saveToVault(analysis){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected){
      alert('Connect vault first');return;
    }
    var saveBtn=document.getElementById('az-save-btn');
    if(saveBtn){saveBtn.textContent='Saving...';saveBtn.disabled=true;}
    try{
      var now=new Date();
      var ds=now.toISOString().slice(0,10);
      var titleM=analysis.match(/^TITLE:\s*(.+)$/m);
      var title=titleM?titleM[1].trim().replace(/[^a-zA-Z0-9\s-]/g,'').replace(/\s+/g,'-').toLowerCase():'analyzed-item';
      var fname=ds+'-'+title.slice(0,40)+'.md';
      var md='---\ntype: analyzed-file\ndate: '+ds+'\nsource: '+(_currentItem?_currentItem.name:'unknown')+'\n---\n\n';
      var displayTitle=titleM?titleM[1].trim():title.replace(/-/g,' ');
      md+='# '+displayTitle+'\n\n';
      md+='**Analyzed:** '+now.toLocaleString()+'  \n';
      md+='**Source:** '+(_currentItem?_currentItem.name:'pasted content')+'\n\n---\n\n';
      md+=analysis+'\n';
      var dir=vaultHandle;
      dir=await dir.getDirectoryHandle('04-Archive',{create:true});
      var fh=await dir.getFileHandle(fname,{create:true});
      var w=await fh.createWritable();await w.write(md);await w.close();
      if(typeof spawnBirthParticle==='function')spawnBirthParticle('general','04-Archive/'+fname);
      if(typeof buildGraph==='function')setTimeout(buildGraph,500);
      if(saveBtn){saveBtn.textContent='✓ Saved';saveBtn.style.borderColor='var(--green)';saveBtn.style.color='var(--green)';}
      if(typeof speakResponse==='function')speakResponse('Saved to vault, sir.');
    }catch(e){
      if(saveBtn){saveBtn.textContent='⚠ Failed';saveBtn.disabled=false;}
    }
  }

  function _showError(msg){
    var output=document.getElementById('az-output');
    if(output){output.style.display='block';output.innerHTML='<div style="font-family:var(--mono);font-size:10px;color:var(--red);padding:10px">'+msg+'</div>';}
  }

  // ── Panel ─────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    p.classList.add('az-vis');if(p._wbNormalise)p._wbNormalise();
    _load();render();
  }
  function hidePanel(){var p=document.getElementById(PANEL_ID);if(p)p.classList.remove('az-vis');}
  function togglePanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    if(p.classList.contains('az-vis'))hidePanel();else showPanel();
  }
  function handleVoice(cmd){
    var c=cmd.toLowerCase();
    if(/\b(open|show)\b.*\b(analyze|analyser|analysis|drop)\b|\banalyze (this|something)\b/.test(c)){
      showPanel();return'Analyze panel open, sir. Drop anything onto it.';
    }
    return null;
  }
  function init(){_load();}
  return{init,showPanel,hidePanel,togglePanel,handleVoice,handleDrop,handlePaste};
})();
