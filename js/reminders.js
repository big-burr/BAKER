// ═══════════════════════════════════════════════════════════
// ══  REMINDERS MODULE  ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Timed reminders with browser notifications + Ntfy.sh
// push to iPhone. Voice-set, persistent across page reloads.
// Ntfy topic: BAKER-REMINDER (ntfy.sh/BAKER-REMINDER)
// ═══════════════════════════════════════════════════════════
var REMINDERS=(function(){

  var LS_KEY='baker_reminders_v1';
  var LS_NTFY='baker_ntfy_topic';
  var DEFAULT_TOPIC='BAKER-REMINDER';
  var CHECK_INTERVAL=15000; // check every 15s

  // reminder: {id, text, time:ms-timestamp, fired:bool, created:ms}
  var reminders=[];
  var _timer=null;
  var _notifGranted=false;

  // ── Storage ───────────────────────────────────────────────
  function _load(){
    try{var r=localStorage.getItem(LS_KEY);if(r)reminders=JSON.parse(r);}catch(e){reminders=[];}
    // Clean up old fired reminders older than 24h
    var cutoff=Date.now()-24*3600*1000;
    reminders=reminders.filter(function(r){return!r.fired||r.time>cutoff;});
    _save();
  }
  function _save(){
    try{localStorage.setItem(LS_KEY,JSON.stringify(reminders));}catch(e){}
  }

  // ── Notification permission ───────────────────────────────
  async function _requestPermission(){
    if(!('Notification' in window))return false;
    if(Notification.permission==='granted'){_notifGranted=true;return true;}
    if(Notification.permission==='denied')return false;
    var p=await Notification.requestPermission();
    _notifGranted=(p==='granted');
    return _notifGranted;
  }

  // ── Fire reminder ─────────────────────────────────────────
  async function _fire(reminder){
    reminder.fired=true;
    _save();

    var text=reminder.text;

    // 1. Browser notification
    if(_notifGranted||Notification.permission==='granted'){
      try{
        new Notification('BAKER Reminder',{
          body:text,
          icon:'icon.svg',
          badge:'icon.svg',
          tag:'baker-reminder-'+reminder.id,
          requireInteraction:true
        });
      }catch(e){}
    }

    // 2. Speak it
    if(typeof speakResponse==='function'){
      speakResponse('Reminder, sir. '+text);
    }

    // 3. Push to Ntfy.sh (phone notification)
    var topic=localStorage.getItem(LS_NTFY)||DEFAULT_TOPIC;
    try{
      await fetch('https://ntfy.sh/'+encodeURIComponent(topic),{
        method:'POST',
        headers:{
          'Content-Type':'text/plain',
          'Title':'BAKER Reminder',
          'Priority':'high',
          'Tags':'bell,baker'
        },
        body:text
      });
    }catch(e){
      // Ntfy offline or blocked - silent fail, browser notif already shown
    }

    // 4. Update HUD info if open
    if(typeof HUDINFO!=='undefined'&&HUDINFO.refresh)HUDINFO.refresh();
  }

  // ── Check loop ────────────────────────────────────────────
  function _check(){
    var now=Date.now();
    reminders.forEach(function(r){
      if(!r.fired&&r.time<=now){
        _fire(r);
      }
    });
  }

  function _startLoop(){
    if(_timer)return;
    _timer=setInterval(_check,CHECK_INTERVAL);
  }

  // ── Add reminder ──────────────────────────────────────────
  function add(text,timeMs){
    var r={
      id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      text:text,
      time:timeMs,
      fired:false,
      created:Date.now()
    };
    reminders.push(r);
    _save();
    return r;
  }

  function remove(id){
    reminders=reminders.filter(function(r){return r.id!==id;});
    _save();
  }

  function getAll(){return reminders.slice();}
  function getDueCount(){
    var now=Date.now();
    return reminders.filter(function(r){return!r.fired&&r.time>now;}).length;
  }
  function getPending(){
    var now=Date.now();
    return reminders.filter(function(r){return!r.fired&&r.time>now;})
      .sort(function(a,b){return a.time-b.time;});
  }

  // ── Parse time from natural language ─────────────────────
  // Handles: "at 3pm", "in 20 minutes", "at 9:30am", "in 2 hours", "tomorrow at 8am"
  function parseReminderTime(text){
    var lower=text.toLowerCase();
    var now=new Date();
    var ms=null;

    // "in X minutes/hours"
    var inMatch=lower.match(/\bin\s+(\d+)\s*(minute|min|hour|hr)s?\b/);
    if(inMatch){
      var n=parseInt(inMatch[1]);
      var unit=inMatch[2];
      ms=Date.now()+(unit.startsWith('h')?n*3600000:n*60000);
      return{ms:ms,matched:inMatch[0]};
    }

    // "at H:MM am/pm" or "at Hpm"
    var atMatch=lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    if(atMatch){
      var hour=parseInt(atMatch[1]);
      var min=parseInt(atMatch[2]||'0');
      var meridiem=atMatch[3];
      if(meridiem==='pm'&&hour<12)hour+=12;
      if(meridiem==='am'&&hour===12)hour=0;
      var target=new Date(now);
      target.setHours(hour,min,0,0);
      // If time already passed today, schedule for tomorrow
      if(target<=now)target.setDate(target.getDate()+1);
      ms=target.getTime();
      return{ms:ms,matched:atMatch[0]};
    }

    // "tomorrow at..."
    var tomMatch=lower.match(/\btomorrow\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    if(tomMatch){
      var th=parseInt(tomMatch[1]);
      var tm=parseInt(tomMatch[2]||'0');
      var tmer=tomMatch[3];
      if(tmer==='pm'&&th<12)th+=12;
      if(tmer==='am'&&th===12)th=0;
      var tom=new Date(now);
      tom.setDate(tom.getDate()+1);
      tom.setHours(th,tm,0,0);
      ms=tom.getTime();
      return{ms:ms,matched:tomMatch[0]};
    }

    return null;
  }

  // ── Voice handler ─────────────────────────────────────────
  async function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();

    // "remind me [at/in time] to [text]" or "set a reminder [to/for] [text] at [time]"
    var remMatch=c.match(/(?:remind me|set (?:a )?reminder(?:\s+(?:to|for))?)\s+(.+)/);
    if(remMatch){
      var rest=remMatch[1].trim();
      // Extract time
      var parsed=parseReminderTime(rest);
      if(!parsed){
        return "I need a time for that reminder, sir. Try saying 'remind me at 3pm to call the doctor'.";
      }
      // Extract text — remove the time phrase
      var text=rest.replace(parsed.matched,'').replace(/^\s*(to|for|that)\s+/,'').replace(/\s+at\s*$/,'').trim();
      if(!text)return "What should I remind you about, sir?";

      // Request notification permission
      await _requestPermission();

      var r=add(text,parsed.ms);
      var targetDate=new Date(parsed.ms);
      var timeLabel=targetDate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      var dateLabel=targetDate.toDateString()===now.toDateString()?'today':'tomorrow';

      // Send confirmation to phone too
      var topic=localStorage.getItem(LS_NTFY)||DEFAULT_TOPIC;
      try{
        fetch('https://ntfy.sh/'+encodeURIComponent(topic),{
          method:'POST',
          headers:{'Content-Type':'text/plain','Title':'Reminder Set','Tags':'white_check_mark'},
          body:'Reminder set: "'+text+'" at '+timeLabel+' '+dateLabel
        });
      }catch(e){}

      return 'Reminder set for '+timeLabel+' '+dateLabel+', sir. I\'ll remind you to '+text+'.';
    }

    // "what are my reminders" / "list reminders"
    if(/\b(my reminders|pending reminders|what.*reminders|list reminders)\b/.test(c)){
      var pending=getPending();
      if(!pending.length)return 'No pending reminders, sir.';
      var resp='You have '+pending.length+' reminder'+(pending.length>1?'s':'')+'. ';
      resp+=pending.slice(0,3).map(function(r){
        var t=new Date(r.time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
        return r.text+' at '+t;
      }).join('. ');
      return resp+', sir.';
    }

    // "cancel reminder" / "clear reminders"
    if(/\b(cancel|clear|delete)\b.*\breminder/.test(c)){
      var count=getPending().length;
      if(!count)return 'No pending reminders to cancel, sir.';
      reminders=reminders.filter(function(r){return r.fired;});
      _save();
      return 'Cleared '+count+' reminder'+(count>1?'s':'')+', sir.';
    }

    return null;
  }

  // ── Settings section injection ────────────────────────────
  function injectSettings(){
    var existing=document.getElementById('reminders-settings-section');
    if(existing){existing.innerHTML=_settingsHTML();_bindSettings();return;}
    var foSec=document.getElementById('fo-settings-section');
    if(!foSec)return;
    var sec=document.createElement('div');
    sec.id='reminders-settings-section';
    sec.className='sp-set-sep';
    sec.innerHTML=_settingsHTML();
    foSec.parentNode.insertBefore(sec,foSec);
    _bindSettings();
  }

  function _settingsHTML(){
    var topic=localStorage.getItem(LS_NTFY)||DEFAULT_TOPIC;
    return '<div class="sp-set-hd">&#128276; Reminders & Notifications</div>'+
      '<div class="field" style="margin-bottom:10px">'+
        '<label style="font-size:11px;color:var(--muted);font-family:var(--mono)">Ntfy.sh Topic (your phone channel)</label>'+
        '<div style="display:flex;gap:6px;margin-top:4px">'+
          '<input id="ntfy-topic-input" type="text" value="'+topic+'" placeholder="BAKER-REMINDER" '+
          'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px 10px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none">'+
          '<button id="ntfy-topic-save" style="background:none;border:1px solid var(--border);border-radius:4px;padding:6px 12px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer">Save</button>'+
          '<button id="ntfy-test-btn" style="background:none;border:1px solid var(--accent-dim);border-radius:4px;padding:6px 12px;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer">Test</button>'+
        '</div>'+
        '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:5px;line-height:1.6">'+
          'Install <a href="https://ntfy.sh" target="_blank" style="color:var(--accent)">ntfy.sh</a> app on iPhone. Subscribe to your topic to receive reminders.'+
        '</div>'+
      '</div>'+
      '<div id="ntfy-status" style="font-family:var(--mono);font-size:10px;color:var(--muted)"></div>';
  }

  function _bindSettings(){
    var saveBtn=document.getElementById('ntfy-topic-save');
    var testBtn=document.getElementById('ntfy-test-btn');
    var inp=document.getElementById('ntfy-topic-input');
    var status=document.getElementById('ntfy-status');
    if(saveBtn&&inp)saveBtn.addEventListener('click',function(){
      var v=inp.value.trim();
      if(v){localStorage.setItem(LS_NTFY,v);if(status)status.textContent='Topic saved.';}
    });
    if(testBtn)testBtn.addEventListener('click',async function(){
      var topic=inp?inp.value.trim():DEFAULT_TOPIC;
      if(status)status.textContent='Sending test...';
      try{
        var resp=await fetch('https://ntfy.sh/'+encodeURIComponent(topic),{
          method:'POST',
          headers:{'Content-Type':'text/plain','Title':'BAKER Test','Tags':'wave'},
          body:'BAKER notification system is online, sir.'
        });
        if(status)status.textContent=resp.ok?'Test sent! Check your phone.':'Failed to send ('+resp.status+').';
      }catch(e){if(status)status.textContent='Network error. Check your connection.';}
    });
  }

  // ── Init ──────────────────────────────────────────────────
  var now=new Date();
  function init(){
    _load();
    _requestPermission();
    _startLoop();
    // Check immediately on load
    _check();
  }

  return{init,add,remove,getAll,getPending,getDueCount,handleVoice,parseReminderTime,injectSettings};
})();
