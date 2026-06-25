// ═══════════════════════════════════════════════════════════
// ══  LECTURE RECORDER MODULE  ══════════════════════════════
// ═══════════════════════════════════════════════════════════
// Mic button → live transcript → Claude structures notes
// Saves to 02-Notes/Lectures/YYYY-MM-DD-[title].md
// ═══════════════════════════════════════════════════════════
var LECTURE=(function(){

  var PANEL_ID='lecture-panel';
  var _rec=null;
  var _chunks=[];
  var _recording=false;
  var _transcript='';
  var _startTime=null;

  // ── SpeechRecognition for live transcript ─────────────────
  var _SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  var _srRec=null;
  var _liveText='';

  function _startSR(){
    if(!_SR)return;
    _srRec=new _SR();
    _srRec.continuous=true;
    _srRec.interimResults=true;
    _srRec.lang='en-US';
    var finalText='';
    _srRec.onresult=function(e){
      var interim='';
      for(var i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal)finalText+=e.results[i][0].transcript+' ';
        else interim+=e.results[i][0].transcript;
      }
      _liveText=finalText+interim;
      _transcript=finalText;
      _updateLiveDisplay();
    };
    _srRec.onerror=function(){};
    _srRec.onend=function(){if(_recording)_srRec.start();};
    _srRec.start();
  }

  function _stopSR(){
    if(_srRec){_srRec.onend=null;_srRec.stop();_srRec=null;}
    _transcript=_liveText;
  }

  function _updateLiveDisplay(){
    var el=document.getElementById('lec-transcript');
    if(el)el.textContent=_liveText||'Listening...';
    var wc=document.getElementById('lec-wordcount');
    if(wc)wc.textContent=_liveText.trim().split(/\s+/).filter(Boolean).length+' words';
  }

  // ── Timer ─────────────────────────────────────────────────
  var _timerInterval=null;
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

  // ── Record controls ───────────────────────────────────────
  function startRecording(){
    if(_recording)return;
    _recording=true;_chunks=[];_liveText='';_transcript='';
    _startSR();_startTimer();
    var btn=document.getElementById('lec-rec-btn');
    if(btn){btn.textContent='⏹ Stop';btn.style.borderColor='var(--red)';btn.style.color='var(--red)';}
    var el=document.getElementById('lec-transcript');
    if(el)el.textContent='Listening...';
    var status=document.getElementById('lec-status');
    if(status)status.textContent='● RECORDING';
  }

  function stopRecording(){
    if(!_recording)return;
    _recording=false;
    _stopSR();_stopTimer();
    var btn=document.getElementById('lec-rec-btn');
    if(btn){btn.textContent='⏺ Record';btn.style.borderColor='';btn.style.color='';}
    var status=document.getElementById('lec-status');
    if(status)status.textContent='Processing...';
    if(_transcript.trim().length>20)_processTranscript();
    else if(status)status.textContent='Too short to process';
  }

  async function _processTranscript(){
    var key=localStorage.getItem('baker_api_key');
    if(!key){var s=document.getElementById('lec-status');if(s)s.textContent='No API key';return;}

    var subjectEl=document.getElementById('lec-subject');
    var subject=subjectEl?subjectEl.value.trim():'Lecture';

    try{
      var resp=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({
          model:'claude-sonnet-4-6',max_tokens:1500,
          messages:[{role:'user',content:
            'Structure this lecture transcript into organized notes.\n'+
            'Subject: '+subject+'\n\n'+
            'Format your response as markdown with these sections:\n'+
            '## Key Points\n(bullet list of main ideas)\n\n'+
            '## Details\n(expanded notes organized by topic)\n\n'+
            '## Action Items / Follow-ups\n(things to do or review)\n\n'+
            '## Summary\n(2-3 sentence overview)\n\n'+
            'Transcript:\n'+_transcript
          }]
        })
      });
      var d=await resp.json();
      var notes=d.content.map(function(b){return b.text||'';}).join('').trim();
      _showNotes(notes,subject);
    }catch(e){
      var s=document.getElementById('lec-status');
      if(s)s.textContent='Processing failed';
    }
  }

  function _showNotes(notes,subject){
    var status=document.getElementById('lec-status');
    if(status)status.textContent='Notes ready';
    var body=document.getElementById('lec-notes-area');
    if(!body)return;
    body.style.display='block';
    body.innerHTML='<div style="font-family:var(--mono);font-size:10px;color:var(--muted);white-space:pre-wrap;line-height:1.7;max-height:260px;overflow-y:auto">'+
      notes.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'+
      '<button id="lec-save-btn" style="background:none;border:1px solid var(--accent);border-radius:4px;padding:6px 14px;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer;margin-top:10px;width:100%">&#128190; Save to Vault</button>';
    document.getElementById('lec-save-btn').addEventListener('click',function(){_saveToVault(notes,subject);});
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
      if(btn){btn.textContent='✓ Saved to Vault';btn.disabled=true;}
      if(typeof speakResponse==='function')speakResponse('Lecture notes saved to vault, sir.');
    }catch(e){alert('Save failed: '+e.message);}
  }

  // ── Render ────────────────────────────────────────────────
  function render(){
    var body=document.getElementById('lec-body');if(!body)return;
    body.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'+
        '<input id="lec-subject" placeholder="Subject / Course name..." '+
        'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none">'+
        '<span id="lec-timer" style="font-family:var(--mono);font-size:13px;color:var(--accent);font-weight:700;min-width:44px">00:00</span>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'+
        '<button id="lec-rec-btn" style="background:none;border:1px solid var(--border);border-radius:6px;padding:8px 18px;font-family:var(--mono);font-size:11px;color:var(--text);cursor:pointer">&#9210; Record</button>'+
        '<span id="lec-status" style="font-family:var(--mono);font-size:10px;color:var(--muted)">Ready</span>'+
        '<span id="lec-wordcount" style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-left:auto">0 words</span>'+
      '</div>'+
      '<div id="lec-transcript" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;min-height:80px;max-height:160px;overflow-y:auto;font-family:var(--mono);font-size:10px;color:var(--muted);line-height:1.6">'+
        'Press Record to begin...'+
      '</div>'+
      '<div id="lec-notes-area" style="display:none;margin-top:12px"></div>';

    document.getElementById('lec-rec-btn').addEventListener('click',function(){
      if(_recording)stopRecording();else startRecording();
    });
  }

  function showPanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    p.classList.add('lec-vis');if(p._wbNormalise)p._wbNormalise();render();
  }
  function hidePanel(){
    if(_recording)stopRecording();
    var p=document.getElementById(PANEL_ID);if(p)p.classList.remove('lec-vis');
  }
  function togglePanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    if(p.classList.contains('lec-vis'))hidePanel();else showPanel();
  }

  function handleVoice(cmd){
    var c=cmd.toLowerCase();
    if(/\b(open|start|launch)\b.*\b(lecture|recording|record)\b/.test(c)){showPanel();return'Lecture recorder open, sir.';}
    if(/\b(start|begin)\b.*\b(recording|lecture)\b/.test(c)){showPanel();startRecording();return'Recording started, sir.';}
    if(/\b(stop|end|finish)\b.*\b(recording|lecture)\b/.test(c)){stopRecording();return'Recording stopped, sir. Processing notes.';}
    return null;
  }

  function init(){}
  return{init,showPanel,hidePanel,togglePanel,handleVoice};
})();
