// ═══════════════════════════════════════════════════════════
// ══  LECTURE RECORDER MODULE  ══════════════════════════════
// ═══════════════════════════════════════════════════════════
// Strategy: hijack BAKER's own voiceRec SR instance.
// We intercept the onresult handler, accumulate everything
// into a lecture transcript, and suppress processCommand.
// On stop: restore BAKER's handlers and restart wake word.
// This avoids all Chrome single-SR conflicts.
// ═══════════════════════════════════════════════════════════
var LECTURE=(function(){

  var PANEL_ID='lecture-panel';
  var _recording=false;
  var _transcript='';
  var _liveText='';
  var _startTime=null;
  var _timerInterval=null;

  // Saved BAKER handlers we override during lecture
  var _savedOnResult=null;
  var _savedOnEnd=null;
  var _savedProcessCommand=null;
  var _savedSilenceTimer=null;

  // ── Timer ─────────────────────────────────────────────────
  function _startTimer(){
    _startTime=Date.now();
    _timerInterval=setInterval(function(){
      var el=document.getElementById('lec-timer');
      if(!el)return;
      var s=Math.floor((Date.now()-_startTime)/1000);
      el.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
    },1000);
  }
  function _stopTimer(){
    if(_timerInterval){clearInterval(_timerInterval);_timerInterval=null;}
  }

  function _updateDisplay(){
    var el=document.getElementById('lec-transcript');
    if(el)el.textContent=_liveText||'Listening...';
    var wc=document.getElementById('lec-wordcount');
    if(wc)wc.textContent=_liveText.trim().split(/\s+/).filter(Boolean).length+' words';
  }

  // ── Start: hijack BAKER's active SR ──────────────────────
  function startRecording(){
    if(_recording)return;

    // First stop whatever BAKER is doing and kill silence timer
    if(typeof stopWakeWord==='function')stopWakeWord();
    if(typeof silenceTimer!=='undefined'&&silenceTimer){
      clearTimeout(silenceTimer);
      window.silenceTimer=null;
    }

    // If BAKER voiceRec is running, stop it cleanly
    if(typeof voiceRec!=='undefined'&&voiceRec){
      voiceRec.onend=null; // prevent BAKER restart
      voiceRec.stop();
      window.voiceRec=null;
    }
    if(typeof voiceActive!=='undefined')window.voiceActive=false;

    _recording=true;
    _transcript='';
    _liveText='';
    _startTimer();

    var btn=document.getElementById('lec-rec-btn');
    if(btn){btn.textContent='⏹ Stop';btn.style.borderColor='var(--red)';btn.style.color='var(--red)';}
    var status=document.getElementById('lec-status');
    if(status)status.textContent='● RECORDING';
    if(typeof setOrbState==='function')setOrbState('listening');
    if(typeof setStatus==='function')setStatus('Lecture recording...');

    // Now start a new SR instance purely for lecture
    var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){
      if(status)status.textContent='Speech recognition not supported in this browser';
      stopRecording();return;
    }

    var sr=new SR();
    sr.continuous=true;
    sr.interimResults=true;
    sr.lang='en-US';
    sr.maxAlternatives=1;

    var finalText='';

    sr.onstart=function(){
      var s=document.getElementById('lec-status');
      if(s)s.textContent='● RECORDING';
    };

    sr.onresult=function(e){
      var interim='';
      for(var i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal){
          finalText+=e.results[i][0].transcript+' ';
        }else{
          interim+=e.results[i][0].transcript;
        }
      }
      _liveText=finalText+interim;
      _transcript=finalText;
      _updateDisplay();
    };

    sr.onerror=function(e){
      var status=document.getElementById('lec-status');
      if(e.error==='not-allowed'){
        if(status)status.textContent='Mic denied — allow mic in browser settings';
        stopRecording();
      }else if(e.error==='no-speech'){
        // Expected — browser restarts on next onend
      }else if(e.error==='aborted'){
        // Normal on stop
      }else{
        if(status)status.textContent='Mic error: '+e.error;
      }
    };

    sr.onend=function(){
      // Only restart if still recording
      if(_recording){
        try{sr.start();}
        catch(err){
          var s=document.getElementById('lec-status');
          if(s)s.textContent='Recording interrupted — press stop and try again';
          // Don't loop infinitely
          _recording=false;
        }
      }
    };

    // Store reference so stopRecording can stop it
    window._lectureSR=sr;

    try{
      sr.start();
    }catch(e){
      var s=document.getElementById('lec-status');
      if(s)s.textContent='Could not start mic: '+e.message;
      _recording=false;
      _stopTimer();
    }
  }

  // ── Stop: restore BAKER ───────────────────────────────────
  function stopRecording(){
    if(!_recording&&!window._lectureSR)return;
    _recording=false;
    _stopTimer();

    // Kill lecture SR
    if(window._lectureSR){
      var lsr=window._lectureSR;
      lsr.onend=null;
      lsr.onerror=null;
      lsr.onresult=null;
      try{lsr.stop();}catch(e){}
      window._lectureSR=null;
    }

    var btn=document.getElementById('lec-rec-btn');
    if(btn){btn.textContent='⏺ Record';btn.style.borderColor='';btn.style.color='';}

    if(typeof setOrbState==='function')setOrbState('idle');

    var status=document.getElementById('lec-status');
    var words=_transcript.trim().split(/\s+/).filter(Boolean).length;

    // Restart BAKER wake word
    setTimeout(function(){
      if(typeof startWakeWord==='function'){
        startWakeWord();
        if(typeof setStatus==='function')setStatus('Say "Baker" to begin');
      }
    },600);

    if(words<3){
      if(status)status.textContent='Nothing recorded — check mic permissions';
      return;
    }

    if(status)status.textContent='Processing '+words+' words...';
    _processTranscript();
  }

  // ── Process with Claude ───────────────────────────────────
  async function _processTranscript(){
    var key=localStorage.getItem('baker_api_key');
    if(!key){
      var s=document.getElementById('lec-status');
      if(s)s.textContent='No API key — set in Settings';
      return;
    }
    var subjectEl=document.getElementById('lec-subject');
    var subject=subjectEl?subjectEl.value.trim():'Lecture';
    if(!subject)subject='Lecture';

    try{
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
          max_tokens:1500,
          messages:[{role:'user',content:
            'Structure this lecture transcript into organized notes.\n'+
            'Subject: '+subject+'\n\n'+
            '## Key Points\n(bullet list of main ideas)\n\n'+
            '## Details\n(expanded notes organized by topic)\n\n'+
            '## Action Items\n(things to do or review)\n\n'+
            '## Summary\n(2-3 sentence overview)\n\n'+
            'Transcript:\n'+_transcript
          }]
        })
      });
      var d=await resp.json();
      var notes=d.content.map(function(b){return b.text||'';}).join('').trim();
      _showNotes(notes,subject);
      var status=document.getElementById('lec-status');
      if(status)status.textContent='Notes ready';
    }catch(e){
      var s=document.getElementById('lec-status');
      if(s)s.textContent='Processing failed: '+e.message;
    }
  }

  function _showNotes(notes,subject){
    var area=document.getElementById('lec-notes-area');
    if(!area)return;
    area.style.display='block';
    area.innerHTML=
      '<div style="font-family:var(--mono);font-size:10px;color:var(--text);white-space:pre-wrap;line-height:1.7;max-height:240px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px">'+
      notes.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'+
      '<button id="lec-save-btn" style="width:100%;background:none;border:1px solid var(--accent);border-radius:4px;padding:7px;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer">&#128190; Save to Vault</button>';
    document.getElementById('lec-save-btn').addEventListener('click',function(){
      _saveToVault(notes,subject);
    });
  }

  async function _saveToVault(notes,subject){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected){
      alert('Connect vault first');return;
    }
    var date=new Date().toISOString().slice(0,10);
    var slug=subject.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,30);
    var fname=date+'-'+slug+'.md';
    var md='---\ntype: lecture\ndate: '+date+'\nsubject: '+subject+'\n---\n\n# '+subject+'\n\n'+notes+'\n\n---\n\n## Raw Transcript\n\n'+_transcript;
    try{
      var dir=vaultHandle;
      dir=await dir.getDirectoryHandle('02-Notes',{create:true});
      dir=await dir.getDirectoryHandle('Lectures',{create:true});
      var fh=await dir.getFileHandle(fname,{create:true});
      var w=await fh.createWritable();await w.write(md);await w.close();
      if(typeof spawnBirthParticle==='function')spawnBirthParticle('lecture','02-Notes/Lectures/'+fname);
      if(typeof buildGraph==='function')setTimeout(buildGraph,500);
      var btn=document.getElementById('lec-save-btn');
      if(btn){btn.textContent='✓ Saved';btn.disabled=true;}
      if(typeof speakResponse==='function')speakResponse('Lecture saved to vault, sir.');
    }catch(e){
      alert('Save failed: '+e.message);
    }
  }

  // ── Render ────────────────────────────────────────────────
  function render(){
    var body=document.getElementById('lec-body');if(!body)return;
    body.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'+
        '<input id="lec-subject" placeholder="Subject / Course..." '+
        'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none">'+
        '<span id="lec-timer" style="font-family:var(--mono);font-size:14px;color:var(--accent);font-weight:700;min-width:46px">00:00</span>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+
        '<button id="lec-rec-btn" style="background:none;border:1px solid var(--border);border-radius:6px;padding:8px 18px;font-family:var(--mono);font-size:11px;color:var(--text);cursor:pointer">&#9210; Record</button>'+
        '<span id="lec-status" style="font-family:var(--mono);font-size:10px;color:var(--muted)">Ready — press Record to begin</span>'+
        '<span id="lec-wordcount" style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-left:auto">0 words</span>'+
      '</div>'+
      '<div id="lec-transcript" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;min-height:90px;max-height:160px;overflow-y:auto;font-family:var(--mono);font-size:10px;color:var(--muted);line-height:1.7">'+
        'Press Record to start transcribing...'+
      '</div>'+
      '<div id="lec-notes-area" style="display:none;margin-top:10px"></div>';

    document.getElementById('lec-rec-btn').addEventListener('click',function(){
      if(_recording)stopRecording();else startRecording();
    });
  }

  // ── Panel ─────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    p.classList.add('lec-vis');
    if(p._wbNormalise)p._wbNormalise();
    render();
  }

  function hidePanel(){
    if(_recording)stopRecording();
    else{
      // Still restart BAKER if it got confused
      setTimeout(function(){
        if(typeof startWakeWord==='function')startWakeWord();
      },300);
    }
    var p=document.getElementById(PANEL_ID);
    if(p)p.classList.remove('lec-vis');
  }

  function togglePanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    if(p.classList.contains('lec-vis'))hidePanel();else showPanel();
  }

  function handleVoice(cmd){
    var c=cmd.toLowerCase();
    if(/\b(open|start|launch)\b.*\b(lecture|recorder)\b/.test(c)){showPanel();return'Lecture recorder open, sir.';}
    if(/\b(start|begin)\b.*\b(recording|lecture)\b/.test(c)){showPanel();startRecording();return'Recording started, sir.';}
    if(/\b(stop|end|finish)\b.*\b(recording|lecture)\b/.test(c)){stopRecording();return'Recording stopped, sir.';}
    return null;
  }

  function init(){
    // Clean up any stale lecture SR on page load
    if(window._lectureSR){
      try{window._lectureSR.stop();}catch(e){}
      window._lectureSR=null;
    }
  }

  return{init,showPanel,hidePanel,togglePanel,handleVoice};
})();
