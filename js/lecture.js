// ═══════════════════════════════════════════════════════════
// ══  LECTURE RECORDER MODULE  ══════════════════════════════
// ═══════════════════════════════════════════════════════════
// Uses BAKER's existing voiceRec SR instance — no new SR.
// Sets a global flag that intercepts processCommand so
// everything heard goes to lecture transcript instead.
// ═══════════════════════════════════════════════════════════
var LECTURE=(function(){

  var PANEL_ID='lecture-panel';
  var _recording=false;
  var _transcript='';
  var _timerInterval=null;
  var _startTime=null;

  // ── Intercept BAKER's voice pipeline ─────────────────────
  // We set window._lectureMode = true which processCommand checks
  // and routes text to lecture instead of AI
  function _startIntercept(){
    window._lectureMode=true;
    window._lectureCallback=function(txt){
      if(!_recording)return;
      _transcript+=txt+' ';
      var el=document.getElementById('lec-transcript');
      if(el)el.textContent=_transcript;
      var wc=document.getElementById('lec-wordcount');
      if(wc)wc.textContent=_transcript.trim().split(/\s+/).filter(Boolean).length+' words';
      // Keep BAKER listening — re-activate after each result
      setTimeout(function(){
        if(_recording&&typeof activateListening==='function')activateListening();
      },200);
    };
  }

  function _stopIntercept(){
    window._lectureMode=false;
    window._lectureCallback=null;
  }

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
  function _stopTimer(){if(_timerInterval){clearInterval(_timerInterval);_timerInterval=null;}}

  // ── Record ────────────────────────────────────────────────
  function startRecording(){
    if(_recording)return;
    _recording=true;
    _transcript='';
    _startTimer();
    _startIntercept();

    var btn=document.getElementById('lec-rec-btn');
    if(btn){btn.textContent='⏹ Stop';btn.style.borderColor='var(--red)';btn.style.color='var(--red)';}
    var status=document.getElementById('lec-status');
    if(status)status.textContent='● RECORDING';
    var el=document.getElementById('lec-transcript');
    if(el)el.textContent='Listening... speak now.';

    // Stop wake word, activate BAKER's listening
    if(typeof stopWakeWord==='function')stopWakeWord();
    // Small delay then activate — gives SR time to release cleanly
    setTimeout(function(){
      if(typeof activateListening==='function')activateListening();
    },300);
  }

  function stopRecording(){
    if(!_recording)return;
    _recording=false;
    _stopTimer();
    _stopIntercept();

    var btn=document.getElementById('lec-rec-btn');
    if(btn){btn.textContent='⏺ Record';btn.style.borderColor='';btn.style.color='';}

    // Stop BAKER voice, restore wake word
    if(typeof stopVoice==='function'&&typeof voiceActive!=='undefined'&&voiceActive){
      // Don't let stopVoice process the last chunk as a command
      if(typeof voiceRec!=='undefined'&&voiceRec){
        voiceRec.onend=null;
        voiceRec.stop();
        window.voiceRec=null;
      }
      window.voiceActive=false;
      window.voiceFinal='';
      var liveEl=document.getElementById('orb-live');
      if(liveEl)liveEl.textContent='';
    }
    if(typeof setOrbState==='function')setOrbState('idle');

    // Restart wake word cleanly
    setTimeout(function(){
      if(typeof startWakeWord==='function'){
        startWakeWord();
        if(typeof setStatus==='function')setStatus('Say "Baker" to begin');
      }
    },500);

    var status=document.getElementById('lec-status');
    var words=_transcript.trim().split(/\s+/).filter(Boolean).length;
    if(words<3){
      if(status)status.textContent='Nothing captured — try again';
      return;
    }
    if(status)status.textContent='Processing '+words+' words...';
    _processTranscript();
  }

  // ── Process ───────────────────────────────────────────────
  async function _processTranscript(){
    var key=localStorage.getItem('baker_api_key');
    if(!key){document.getElementById('lec-status').textContent='No API key';return;}
    var subjectEl=document.getElementById('lec-subject');
    var subject=subjectEl&&subjectEl.value.trim()||'Lecture';
    try{
      var resp=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1500,
          messages:[{role:'user',content:
            'Structure this lecture transcript into organized notes for subject: '+subject+'\n\n'+
            'Format:\n## Key Points\n## Details\n## Action Items\n## Summary\n\n'+
            'Transcript:\n'+_transcript}]})
      });
      var d=await resp.json();
      var notes=d.content.map(function(b){return b.text||'';}).join('').trim();
      _showNotes(notes,subject);
      var s=document.getElementById('lec-status');
      if(s)s.textContent='Notes ready';
    }catch(e){
      var s=document.getElementById('lec-status');
      if(s)s.textContent='Failed: '+e.message;
    }
  }

  function _showNotes(notes,subject){
    var area=document.getElementById('lec-notes-area');
    if(!area)return;
    area.style.display='block';
    area.innerHTML=
      '<div style="font-family:var(--mono);font-size:10px;color:var(--text);white-space:pre-wrap;line-height:1.7;max-height:220px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px">'+
      notes.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'+
      '<button id="lec-save-btn" style="width:100%;background:none;border:1px solid var(--accent);border-radius:4px;padding:7px;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer">&#128190; Save to Vault</button>';
    document.getElementById('lec-save-btn').addEventListener('click',function(){_saveToVault(notes,subject);});
  }

  async function _saveToVault(notes,subject){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected){alert('Connect vault first');return;}
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
      if(typeof speakResponse==='function')speakResponse('Lecture saved, sir.');
    }catch(e){alert('Save failed: '+e.message);}
  }

  // ── Render ────────────────────────────────────────────────
  function render(){
    var body=document.getElementById('lec-body');if(!body)return;
    body.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'+
        '<input id="lec-subject" placeholder="Subject / Course..." style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none">'+
        '<span id="lec-timer" style="font-family:var(--mono);font-size:14px;color:var(--accent);font-weight:700;min-width:46px">00:00</span>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+
        '<button id="lec-rec-btn" style="background:none;border:1px solid var(--border);border-radius:6px;padding:8px 18px;font-family:var(--mono);font-size:11px;color:var(--text);cursor:pointer">&#9210; Record</button>'+
        '<span id="lec-status" style="font-family:var(--mono);font-size:10px;color:var(--muted)">Ready</span>'+
        '<span id="lec-wordcount" style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-left:auto">0 words</span>'+
      '</div>'+
      '<div id="lec-transcript" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;min-height:90px;max-height:160px;overflow-y:auto;font-family:var(--mono);font-size:10px;color:var(--muted);line-height:1.7">Press Record...</div>'+
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
    if(/\bstart.*\b(recording|lecture)\b/.test(c)){showPanel();startRecording();return'Recording started, sir.';}
    if(/\bstop.*\b(recording|lecture)\b/.test(c)){stopRecording();return'Stopped, sir.';}
    return null;
  }

  function init(){window._lectureMode=false;window._lectureCallback=null;}
  return{init,showPanel,hidePanel,togglePanel,handleVoice,isRecording:function(){return _recording;}};
})();
