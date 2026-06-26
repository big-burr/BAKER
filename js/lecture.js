// ═══════════════════════════════════════════════════════════
// ══  LECTURE RECORDER MODULE  ══════════════════════════════
// ═══════════════════════════════════════════════════════════
// Uses BAKER's activateListening with extended silence window.
// Polls the orb-live element for real-time transcript.
// On stop: grabs accumulated text, sends to Claude.
// ═══════════════════════════════════════════════════════════
var LECTURE=(function(){

  var PANEL_ID='lecture-panel';
  var _recording=false;
  var _fullTranscript='';
  var _lastSnapshot='';
  var _pollInterval=null;
  var _timerInterval=null;
  var _startTime=null;

  // ── Timer ─────────────────────────────────────────────────
  function _startTimer(){
    _startTime=Date.now();
    _timerInterval=setInterval(function(){
      var el=document.getElementById('lec-timer');if(!el)return;
      var s=Math.floor((Date.now()-_startTime)/1000);
      el.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
    },1000);
  }
  function _stopTimer(){if(_timerInterval){clearInterval(_timerInterval);_timerInterval=null;}}

  function _updateDisplay(){
    var el=document.getElementById('lec-transcript');
    if(el)el.textContent=_fullTranscript||'Listening...';
    var wc=document.getElementById('lec-wordcount');
    if(wc)wc.textContent=_fullTranscript.trim().split(/\s+/).filter(Boolean).length+' words';
    // Auto-scroll transcript
    if(el)el.scrollTop=el.scrollHeight;
  }

  // ── Poll BAKER's live text display ────────────────────────
  function _startPolling(){
    if(_pollInterval)return;
    _pollInterval=setInterval(function(){
      if(!_recording)return;
      // Read from BAKER's orb-live element (real-time SR output)
      var liveEl=document.getElementById('orb-live');
      var current=liveEl?liveEl.textContent.trim():'';
      // Also check voiceFinal global
      var vf=(typeof voiceFinal!=='undefined')?voiceFinal:'';

      var combined=(vf+' '+current).trim();
      if(combined&&combined!==_lastSnapshot){
        _lastSnapshot=combined;
        // Update transcript display with latest
        var el=document.getElementById('lec-transcript');
        if(el)el.textContent=_fullTranscript+(_fullTranscript?' ':'')+combined;
        var wc=document.getElementById('lec-wordcount');
        var total=(_fullTranscript+' '+combined).trim();
        if(wc)wc.textContent=total.split(/\s+/).filter(Boolean).length+' words';
        if(el)el.scrollTop=el.scrollHeight;
      }
    },400);
  }
  function _stopPolling(){if(_pollInterval){clearInterval(_pollInterval);_pollInterval=null;}}

  // ── Capture finalized text via processCommand intercept ──
  // When BAKER's silence timer fires, processCommand is called
  // In lecture mode we capture that text and re-listen
  function _setupIntercept(){
    window._lectureMode=true;
    window._lectureCallback=function(txt){
      if(!_recording)return;
      if(txt&&txt.trim()){
        _fullTranscript+=(_fullTranscript?' ':'')+txt.trim();
        _lastSnapshot=''; // reset so poll picks up new content
        _updateDisplay();
      }
      // Re-activate listening after a brief pause
      setTimeout(function(){
        if(_recording&&typeof activateListening==='function'){
          activateListening();
        }
      },300);
    };
  }

  function _clearIntercept(){
    window._lectureMode=false;
    window._lectureCallback=null;
  }

  // ── Start recording ───────────────────────────────────────
  function startRecording(){
    if(_recording)return;
    _recording=true;
    _fullTranscript='';
    _lastSnapshot='';

    _startTimer();
    _setupIntercept();
    _startPolling();

    var btn=document.getElementById('lec-rec-btn');
    if(btn){btn.textContent='⏹ Stop';btn.style.borderColor='var(--red)';btn.style.color='var(--red)';}
    var status=document.getElementById('lec-status');
    if(status)status.textContent='● RECORDING';
    var el=document.getElementById('lec-transcript');
    if(el)el.textContent='Listening... speak now.';

    // Stop wake word and start BAKER listening
    if(typeof stopWakeWord==='function')stopWakeWord();
    setTimeout(function(){
      if(typeof activateListening==='function')activateListening();
    },200);
  }

  // ── Stop recording ────────────────────────────────────────
  function stopRecording(){
    if(!_recording)return;
    _recording=false;
    _stopTimer();
    _stopPolling();
    _clearIntercept();

    // Grab any remaining text from BAKER's current buffer
    var liveEl=document.getElementById('orb-live');
    var remaining=liveEl?liveEl.textContent.trim():'';
    var vf=(typeof voiceFinal!=='undefined')?voiceFinal.trim():'';
    if(vf)_fullTranscript+=(_fullTranscript?' ':'')+vf;
    else if(remaining&&remaining!==_lastSnapshot)_fullTranscript+=(_fullTranscript?' ':'')+remaining;

    // Kill BAKER's voiceRec cleanly without processing
    if(typeof voiceRec!=='undefined'&&voiceRec){
      voiceRec.onend=null;voiceRec.onresult=null;
      try{voiceRec.stop();}catch(e){}
      window.voiceRec=null;
    }
    window.voiceActive=false;
    window.voiceFinal='';
    if(liveEl)liveEl.textContent='';
    if(typeof setOrbState==='function')setOrbState('idle');

    var btn=document.getElementById('lec-rec-btn');
    if(btn){btn.textContent='⏺ Record';btn.style.borderColor='';btn.style.color='';}

    // Restart BAKER wake word
    setTimeout(function(){
      if(typeof startWakeWord==='function'){
        startWakeWord();
        if(typeof setStatus==='function')setStatus('Say "Baker" to begin');
      }
    },600);

    // Process transcript
    var words=_fullTranscript.trim().split(/\s+/).filter(Boolean).length;
    var status=document.getElementById('lec-status');
    _updateDisplay();

    if(words<3){
      if(status)status.textContent=words?'Too short — only '+words+' words':'Nothing captured';
      return;
    }
    if(status)status.textContent='Processing '+words+' words...';
    _processTranscript();
  }

  // ── Claude processing ─────────────────────────────────────
  async function _processTranscript(){
    var key=localStorage.getItem('baker_api_key');
    if(!key){document.getElementById('lec-status').textContent='No API key';return;}
    var subject=(document.getElementById('lec-subject')||{}).value||'Lecture';
    subject=subject.trim()||'Lecture';
    try{
      var resp=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1500,
          messages:[{role:'user',content:'Structure this lecture transcript into organized notes.\nSubject: '+subject+'\n\n## Key Points\n## Details\n## Action Items\n## Summary\n\nTranscript:\n'+_fullTranscript}]})
      });
      var d=await resp.json();var notes=d.content.map(function(b){return b.text||'';}).join('').trim();
      _showNotes(notes,subject);
      document.getElementById('lec-status').textContent='Notes ready';
    }catch(e){document.getElementById('lec-status').textContent='Failed: '+e.message;}
  }

  function _showNotes(notes,subject){
    var area=document.getElementById('lec-notes-area');if(!area)return;
    area.style.display='block';
    area.innerHTML='<div style="font-family:var(--mono);font-size:10px;color:var(--text);white-space:pre-wrap;line-height:1.7;max-height:220px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px">'+notes.replace(/</g,'&lt;')+'</div>'+
      '<button id="lec-save-btn" style="width:100%;background:none;border:1px solid var(--accent);border-radius:4px;padding:7px;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer">&#128190; Save to Vault</button>';
    document.getElementById('lec-save-btn').addEventListener('click',function(){_saveToVault(notes,subject);});
  }

  async function _saveToVault(notes,subject){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected){alert('Connect vault');return;}
    var date=new Date().toISOString().slice(0,10);
    var slug=subject.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,30);
    var fname=date+'-'+slug+'.md';
    try{
      var dir=vaultHandle;
      dir=await dir.getDirectoryHandle('02-Notes',{create:true});
      dir=await dir.getDirectoryHandle('Lectures',{create:true});
      var fh=await dir.getFileHandle(fname,{create:true});
      var w=await fh.createWritable();
      await w.write('---\ntype: lecture\ndate: '+date+'\nsubject: '+subject+'\n---\n\n# '+subject+'\n\n'+notes+'\n\n---\n## Raw Transcript\n\n'+_fullTranscript);
      await w.close();
      if(typeof spawnBirthParticle==='function')spawnBirthParticle('lecture','02-Notes/Lectures/'+fname);
      document.getElementById('lec-save-btn').textContent='✓ Saved';
    }catch(e){alert('Failed: '+e.message);}
  }

  function render(){
    var body=document.getElementById('lec-body');if(!body)return;
    body.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'+
        '<input id="lec-subject" placeholder="Subject / Course..." style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none">'+
        '<span id="lec-timer" style="font-family:var(--mono);font-size:14px;color:var(--accent);font-weight:700;min-width:46px">00:00</span></div>'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+
        '<button id="lec-rec-btn" style="background:none;border:1px solid var(--border);border-radius:6px;padding:8px 18px;font-family:var(--mono);font-size:11px;color:var(--text);cursor:pointer">&#9210; Record</button>'+
        '<span id="lec-status" style="font-family:var(--mono);font-size:10px;color:var(--muted)">Ready</span>'+
        '<span id="lec-wordcount" style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-left:auto">0 words</span></div>'+
      '<div id="lec-transcript" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;min-height:90px;max-height:180px;overflow-y:auto;font-family:var(--mono);font-size:10px;color:var(--muted);line-height:1.7">Press Record...</div>'+
      '<div id="lec-notes-area" style="display:none;margin-top:10px"></div>';
    document.getElementById('lec-rec-btn').addEventListener('click',function(){
      if(_recording)stopRecording();else startRecording();
    });
  }

  function showPanel(){var p=document.getElementById(PANEL_ID);if(!p)return;p.classList.add('lec-vis');if(p._wbNormalise)p._wbNormalise();render();}
  function hidePanel(){if(_recording)stopRecording();var p=document.getElementById(PANEL_ID);if(p)p.classList.remove('lec-vis');}
  function togglePanel(){var p=document.getElementById(PANEL_ID);if(!p)return;if(p.classList.contains('lec-vis'))hidePanel();else showPanel();}
  function handleVoice(cmd){
    var c=cmd.toLowerCase();
    if(/\b(open|launch)\b.*\blecture\b/.test(c)){showPanel();return'Lecture recorder open, sir.';}
    if(/\bstart.*\b(recording|lecture)\b/.test(c)){showPanel();startRecording();return'Recording, sir.';}
    if(/\bstop.*\b(recording|lecture)\b/.test(c)){stopRecording();return'Stopped, sir.';}
    return null;
  }
  function init(){window._lectureMode=false;window._lectureCallback=null;}
  return{init,showPanel,hidePanel,togglePanel,handleVoice};
})();
