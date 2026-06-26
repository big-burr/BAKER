// ═══════════════════════════════════════════════════════════
// ══  VOICE MODULE  ═════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Owns: wake word, speech recognition, speech synthesis,
//       orb click handler, conversation mode helpers
// Globals exposed: speakResponse, setStatus, loadVoices,
//   startWakeWord, stopWakeWord, activateListening, stopVoice,
//   stopSpeaking, handleOrbClick, speakEndTime, isSpeaking,
//   voiceActive, conversationMode, conversationHistory, speechRate
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// VOICE
// ═══════════════════════════════════════════════════════════
var voiceRec=null,voiceActive=false,isSpeaking=false;
var voiceFinal='',silenceTimer=null,speechRate=0.92;
var MID_SENTENCE_WORDS=['and','but','so','because','that','which','who','when','where','if','although','however','therefore','then','or','nor','yet','for','as','since','while','though','unless','until','after','before','even'];
function getSilenceWindow(txt){var trimmed=(txt||'').trim().toLowerCase();var lastWord=trimmed.split(/\s+/).pop().replace(/[.,!?]*/g,'');var base=conversationMode?2200:3000;if(MID_SENTENCE_WORDS.indexOf(lastWord)!==-1)return base+1500;return base;}
var wakeRec=null;
var HOT_WORDS=['hey baker','chud','foid','JARVIS' 'clanker','pip boy','goul','president','Maxom','Damn','baker','yo baker','ok baker'];
var speakEndTime=0,ECHO_LOCKOUT_MS=1800;
var cachedVoices=[];
var conversationMode=false;
var conversationHistory=[];
function loadVoices(){cachedVoices=speechSynthesis.getVoices();}
function startWakeWord(){var SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return;stopWakeWord();wakeRec=new SR();wakeRec.continuous=true;wakeRec.interimResults=false;wakeRec.lang='en-US';wakeRec.onresult=function(e){var txt=e.results[e.results.length-1][0].transcript.toLowerCase().trim();if(HOT_WORDS.some(function(w){return txt.includes(w);})){stopWakeWord();activateListening();}};wakeRec.onend=function(){if(!voiceActive&&!isSpeaking){try{wakeRec.start();}catch(e){setTimeout(startWakeWord,1000);}}};try{wakeRec.start();document.getElementById('wake-status').textContent='👂 listening for wake word';}catch(e){}}
function stopWakeWord(){if(wakeRec){wakeRec.stop();wakeRec=null;}document.getElementById('wake-status').textContent='';}
function handleOrbClick(e){if(orbMusicMode){toggleMusicMode();return;}if(conversationMode){endConversationMode('Goodbye, sir.');return;}if(isSpeaking){stopSpeaking();return;}if(voiceActive){stopVoice();}else{activateListening();}}

function activateListening(){var SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setStatus('Voice requires Chrome');return;}if(window.orbInitAudio)window.orbInitAudio();var msSince=Date.now()-speakEndTime;if(msSince<ECHO_LOCKOUT_MS){setTimeout(activateListening,ECHO_LOCKOUT_MS-msSince+50);return;}voiceFinal='';document.getElementById('orb-live').textContent='';voiceRec=new SR();voiceRec.continuous=true;voiceRec.interimResults=true;voiceRec.lang='en-US';voiceRec.onstart=function(){voiceActive=true;setOrbState('listening');setStatus('Listening...');};voiceRec.onresult=function(e){var interim='';for(var i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)voiceFinal+=e.results[i][0].transcript+' ';else interim+=e.results[i][0].transcript;}var live=voiceFinal+interim;var liveEl=document.getElementById('orb-live');liveEl.textContent=live;var lastWord=live.trim().toLowerCase().split(/\s+/).pop().replace(/[.,!?]*/g,'');liveEl.style.opacity=(MID_SENTENCE_WORDS.indexOf(lastWord)!==-1)?'0.5':'1';if(silenceTimer)clearTimeout(silenceTimer);silenceTimer=setTimeout(function(){if(voiceActive)stopVoice();},getSilenceWindow(live));};voiceRec.onend=function(){if(voiceActive){try{voiceRec.start();}catch(e){}}};voiceRec.onerror=function(e){if(e.error==='not-allowed'){setStatus('Microphone denied');stopVoice();}};try{voiceRec.start();}catch(e){setStatus('Could not start mic');}}
function stopVoice(){voiceActive=false;if(silenceTimer){clearTimeout(silenceTimer);silenceTimer=null;}if(voiceRec){voiceRec.stop();voiceRec=null;}var txt=voiceFinal.trim();voiceFinal='';document.getElementById('orb-live').textContent='';setOrbState('thinking');if(txt){setStatus('Processing: '+txt);processCommand(txt);}else{setOrbState('idle');if(conversationMode){setStatus('Listening for you, sir...');setTimeout(activateListening,400);}else{setStatus('Say "Baker" to begin');startWakeWord();}}}
function stopSpeaking(){speechSynthesis.cancel();isSpeaking=false;speakEndTime=Date.now();setOrbState('idle');if(conversationMode){setStatus('Listening for you, sir...');setTimeout(activateListening,ECHO_LOCKOUT_MS);}else{setStatus('Say "Baker" to begin');setTimeout(startWakeWord,ECHO_LOCKOUT_MS);}}

// ═══════════════════════════════════════════════════════════
// SPEAK + STATUS
// ═══════════════════════════════════════════════════════════
function speakResponse(txt){isSpeaking=true;setOrbState('speaking');setStatus(txt);document.getElementById('orb-status-txt').textContent=txt;document.getElementById('orb-status-txt').className='orb-status-txt active';var voices=cachedVoices.length?cachedVoices:speechSynthesis.getVoices();var utt=new SpeechSynthesisUtterance(txt);var vp=window._falloutVoiceProfile;var preferred=vp?vp.names:['Daniel','Google UK English Male','Microsoft George','Microsoft David','Alex'];var chosen=null;preferred.forEach(function(p){if(!chosen)chosen=voices.find(function(v){return v.name.indexOf(p)!==-1;});});if(!chosen&&vp&&vp.gender){chosen=voices.find(function(v){var n=(v.name||'').toLowerCase();return v.lang&&v.lang.indexOf('en')===0&&(vp.gender==='female'?(n.includes('female')||n.includes('zira')||n.includes('samantha')||n.includes('karen')||n.includes('victoria')):(n.includes('male')||n.includes('david')||n.includes('mark')||n.includes('alex')||n.includes('fred')||n.includes('daniel')));});}if(!chosen)chosen=voices.find(function(v){return v.lang&&v.lang.indexOf('en')===0;});if(chosen)utt.voice=chosen;utt.rate=vp?vp.rate*speechRate:speechRate;utt.pitch=vp?vp.pitch:0.85;utt.volume=1;utt.onend=function(){isSpeaking=false;speakEndTime=Date.now();setOrbState('idle');if(conversationMode){var lbl='💬 Conversation — listening...';setStatus(lbl);document.getElementById('orb-status-txt').textContent=lbl;document.getElementById('orb-status-txt').className='orb-status-txt active';setTimeout(activateListening,ECHO_LOCKOUT_MS);}else{setStatus('Say "Baker" to begin');document.getElementById('orb-status-txt').textContent='Say "Baker" to begin';document.getElementById('orb-status-txt').className='orb-status-txt';setTimeout(startWakeWord,ECHO_LOCKOUT_MS);}};utt.onerror=function(){isSpeaking=false;setOrbState('idle');if(conversationMode){setTimeout(activateListening,ECHO_LOCKOUT_MS);}else{startWakeWord();}};speechSynthesis.speak(utt);}
function setStatus(txt){document.getElementById('sb-txt').textContent=txt;}
