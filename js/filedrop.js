// ═══════════════════════════════════════════════════════════
// ══  FILE DROP MODULE  ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Drag photo/PDF/screenshot onto BAKER → Claude analyzes it
// → saves to vault: 04-Archive/YYYY-MM-DD-[title].md
// Supports: images (jpg/png/gif/webp), PDFs
// ═══════════════════════════════════════════════════════════
var FILEDROP=(function(){

  var _overlay=null;
  var _processing=false;

  // ── Init drop zone on the whole page ─────────────────────
  function init(){
    document.addEventListener('dragover',function(e){
      e.preventDefault();
      _showOverlay();
    });
    document.addEventListener('dragleave',function(e){
      // Only hide if leaving the window entirely
      if(e.relatedTarget===null)_hideOverlay();
    });
    document.addEventListener('drop',function(e){
      e.preventDefault();
      _hideOverlay();
      var files=Array.from(e.dataTransfer.files);
      if(!files.length)return;
      var file=files[0]; // handle one at a time
      _handleFile(file);
    });
  }

  // ── Drop overlay UI ───────────────────────────────────────
  function _showOverlay(){
    if(_overlay)return;
    _overlay=document.createElement('div');
    _overlay.id='filedrop-overlay';
    _overlay.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.75);'+
      'display:flex;align-items:center;justify-content:center;pointer-events:none;'+
      'border:3px dashed var(--accent);transition:opacity .15s';
    _overlay.innerHTML='<div style="text-align:center">'+
      '<div style="font-size:48px;margin-bottom:12px">&#128229;</div>'+
      '<div style="font-family:var(--mono);font-size:16px;color:var(--accent);letter-spacing:.1em">DROP TO ANALYZE</div>'+
      '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:6px">Images, PDFs, Screenshots</div>'+
      '</div>';
    document.body.appendChild(_overlay);
  }
  function _hideOverlay(){
    if(_overlay){_overlay.remove();_overlay=null;}
  }

  // ── Handle dropped file ───────────────────────────────────
  async function _handleFile(file){
    if(_processing){
      if(typeof speakResponse==='function')speakResponse('Already processing a file, sir. Please wait.');
      return;
    }
    var key=localStorage.getItem('baker_api_key');
    if(!key){
      if(typeof speakResponse==='function')speakResponse('No API key set, sir.');
      return;
    }

    var isImage=/^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.type);
    var isPDF=file.type==='application/pdf';

    if(!isImage&&!isPDF){
      if(typeof speakResponse==='function')speakResponse('I can only analyze images and PDFs, sir.');
      return;
    }

    _processing=true;
    if(typeof speakResponse==='function')speakResponse('Analyzing file, sir. One moment.');
    if(typeof setStatus==='function')setStatus('Analyzing: '+file.name+'...');

    try{
      // Show processing indicator
      _showProcessing(file.name);

      // Read file as base64
      var base64=await _readFileBase64(file);
      var mediaType=isImage?file.type:'application/pdf';

      // Build Claude API request
      var content=[
        {
          type:isImage?'image':'document',
          source:{type:'base64',media_type:mediaType,data:base64}
        },
        {
          type:'text',
          text:isImage?
            'Analyze this image. Provide:\n1. A short descriptive title (5 words max, suitable as a filename)\n2. A detailed description of what you see\n3. Any text visible in the image (transcribe it)\n4. Key facts or information extracted\n\nFormat your response as:\nTITLE: [title]\nDESCRIPTION:\n[description]\nTEXT FOUND:\n[any text, or "None"]\nKEY INFO:\n[bullet points of key facts]'
            :
            'Analyze this PDF document. Provide:\n1. A short descriptive title (5 words max)\n2. A summary of the content\n3. Key information extracted\n\nFormat:\nTITLE: [title]\nSUMMARY:\n[summary]\nKEY INFO:\n[bullet points]'
        }
      ];

      var resp=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'x-api-key':key,
          'anthropic-version':'2023-06-01',
          'anthropic-dangerous-direct-browser-access':'true'
        },
        body:JSON.stringify({
          model:'claude-sonnet-4-6',
          max_tokens:1000,
          messages:[{role:'user',content:content}]
        })
      });

      var data=await resp.json();
      if(data.error){throw new Error(data.error.message);}
      var analysis=data.content.map(function(b){return b.text||'';}).join('').trim();

      // Extract title from response
      var titleMatch=analysis.match(/^TITLE:\s*(.+)$/m);
      var title=titleMatch?titleMatch[1].trim().replace(/[^a-zA-Z0-9\s-]/g,'').replace(/\s+/g,'-').toLowerCase():'analyzed-file';

      // Save to vault
      var saved=false;
      if(typeof vaultHandle!=='undefined'&&vaultHandle&&vaultConnected){
        saved=await _saveToVault(file,base64,analysis,title,isImage,mediaType);
      }

      // Show result
      _showResult(analysis,title,saved);

      if(typeof speakResponse==='function'){
        var shortTitle=titleMatch?titleMatch[1].trim():'the file';
        speakResponse('Analysis complete, sir. '+shortTitle+(saved?'. Saved to your vault.':'.'));
      }

    }catch(e){
      console.error('[FILEDROP]',e);
      _hideProcessing();
      if(typeof speakResponse==='function')speakResponse('File analysis failed, sir. '+e.message);
    }finally{
      _processing=false;
      if(typeof setStatus==='function')setStatus('Say "Baker" to begin');
    }
  }

  function _readFileBase64(file){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onload=function(){resolve(reader.result.split(',')[1]);};
      reader.onerror=reject;
      reader.readAsDataURL(file);
    });
  }

  async function _saveToVault(file,base64,analysis,title,isImage,mediaType){
    try{
      var now=new Date();
      var ds=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
      var fname=ds+'-'+title+'.md';

      // Build markdown note
      var md='---\ntype: analyzed-file\ndate: '+ds+'\noriginal: '+file.name+'\n---\n\n';
      md+='# '+title.replace(/-/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();})+'\n\n';
      md+='**Analyzed:** '+now.toLocaleString()+'\n';
      md+='**Source:** '+file.name+' ('+Math.round(file.size/1024)+'KB)\n\n';
      md+=analysis+'\n\n';

      // For images: embed as base64 data URI in markdown
      if(isImage){
        md+='## Original Image\n\n';
        md+='!['+title+'](data:'+mediaType+';base64,'+base64+')\n\n';
      }

      var dir=vaultHandle;
      dir=await dir.getDirectoryHandle('04-Archive',{create:true});
      var fh=await dir.getFileHandle(fname,{create:true});
      var w=await fh.createWritable();
      await w.write(md);
      await w.close();

      // Refresh vault index
      if(typeof buildGraph==='function')setTimeout(buildGraph,400);
      return true;
    }catch(e){
      console.error('[FILEDROP] vault save:',e);
      return false;
    }
  }

  // ── Processing UI ─────────────────────────────────────────
  var _procPanel=null;
  function _showProcessing(filename){
    if(_procPanel)_procPanel.remove();
    _procPanel=document.createElement('div');
    _procPanel.id='filedrop-processing';
    _procPanel.style.cssText='position:fixed;bottom:80px;right:24px;z-index:9997;'+
      'background:var(--surface);border:1px solid var(--accent);border-radius:10px;'+
      'padding:14px 18px;font-family:var(--mono);min-width:260px;'+
      'box-shadow:0 8px 32px rgba(0,0,0,.6);backdrop-filter:blur(20px)';
    _procPanel.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px">'+
      '<div style="width:10px;height:10px;border-radius:50%;background:var(--accent);animation:pulse 1s ease-in-out infinite"></div>'+
      '<div>'+
        '<div style="font-size:11px;color:var(--accent);letter-spacing:.06em">ANALYZING FILE</div>'+
        '<div style="font-size:10px;color:var(--muted);margin-top:2px">'+filename+'</div>'+
      '</div></div>';
    document.body.appendChild(_procPanel);
  }
  function _hideProcessing(){if(_procPanel){_procPanel.remove();_procPanel=null;}}

  function _showResult(analysis,title,saved){
    _hideProcessing();
    var panel=document.createElement('div');
    panel.id='filedrop-result';
    panel.style.cssText='position:fixed;bottom:80px;right:24px;z-index:9997;'+
      'background:var(--surface);border:1px solid var(--border);border-radius:10px;'+
      'padding:0;font-family:var(--mono);width:340px;max-height:420px;'+
      'box-shadow:0 8px 32px rgba(0,0,0,.6);backdrop-filter:blur(20px);display:flex;flex-direction:column';
    panel.innerHTML=
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);flex-shrink:0">'+
        '<div>'+
          '<div style="font-size:11px;color:var(--accent);letter-spacing:.06em">FILE ANALYZED</div>'+
          '<div style="font-size:9px;color:var(--muted);margin-top:2px">'+(saved?'&#10003; Saved to vault':'Not saved \u2014 vault disconnected')+'</div>'+
        '</div>'+
        '<button id="filedrop-close" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:0">&#215;</button>'+
      '</div>'+
      '<div style="padding:12px 14px;overflow-y:auto;flex:1;font-size:10px;color:var(--text);line-height:1.7;white-space:pre-wrap">'+
        analysis.replace(/</g,'&lt;').replace(/>/g,'&gt;')+
      '</div>';
    document.body.appendChild(panel);
    var close=document.getElementById('filedrop-close');
    if(close)close.addEventListener('click',function(){panel.remove();});
    // Auto-dismiss after 30s
    setTimeout(function(){if(panel.parentNode)panel.remove();},30000);
  }

  return{init};
})();
