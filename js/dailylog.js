// ═══════════════════════════════════════════════════════════
// ══  BAKER DAILY LOG — Quick Daily Check-in Panel  ═════════
// ═══════════════════════════════════════════════════════════
// Floating panel for filling out today's daily log.
// Matches the Obsidian vault daily note template:
//   Biometrics (mood/sleep/energy/weight/water)
//   Top 3 priorities for today
//   Wins — what got done
//   Challenges — what was hard
//   Gratitude
//   Notes / free write
//   Tomorrow's focus
// Auto-saves to localStorage + syncs to vault daily note
// ═══════════════════════════════════════════════════════════
var DAILYLOG=(function(){

  var PANEL_ID='dailylog-panel';
  var LS_KEY='baker_dailylog_v1';

  function _today(){return new Date().toISOString().slice(0,10);}
  function _load(){
    try{return JSON.parse(localStorage.getItem(LS_KEY)||'{}');}
    catch(e){return{};}
  }
  function _save(data){
    try{localStorage.setItem(LS_KEY,JSON.stringify(data));}catch(e){}
  }
  function _getToday(){
    var all=_load();
    return all[_today()]||{};
  }
  function _saveToday(fields){
    var all=_load();
    var t=_today();
    all[t]=Object.assign(all[t]||{},fields);
    // Prune to last 30 days
    var cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);
    var cs=cutoff.toISOString().slice(0,10);
    Object.keys(all).forEach(function(k){if(k<cs)delete all[k];});
    _save(all);
    return all[t];
  }

  // ── Sync saved data into biometrics module ─────────────
  function _syncBiometrics(entry){
    try{
      var bio=JSON.parse(localStorage.getItem('baker_biometrics_v1')||'[]');
      var t=_today();
      var existing=bio.find(function(e){return e.date===t;});
      var fields={date:t};
      if(entry.mood!=null)fields.mood=entry.mood;
      if(entry.sleep!=null)fields.sleep=entry.sleep;
      if(entry.energy!=null)fields.energy=entry.energy;
      if(entry.weight!=null)fields.weight=entry.weight;
      if(existing){Object.assign(existing,fields);}
      else{bio.push(fields);}
      bio.sort(function(a,b){return b.date.localeCompare(a.date);});
      localStorage.setItem('baker_biometrics_v1',JSON.stringify(bio));
    }catch(e){}
  }

  // ── Write to vault daily note ───────────────────────────
  async function _syncToVault(entry){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return;
    try{
      var date=_today();
      var d=new Date();
      var day=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
      var time=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');

      var md='---\ntype: daily\ndate: '+date+'\nday: '+day+'\n';
      if(entry.mood!=null)md+='mood: '+entry.mood+'\n';
      if(entry.sleep!=null)md+='sleep: '+entry.sleep+'\n';
      if(entry.energy!=null)md+='energy: '+entry.energy+'\n';
      if(entry.weight!=null)md+='weight: '+entry.weight+'\n';
      md+='updated: '+time+'\n---\n\n';
      md+='# '+day+', '+date+'\n\n';

      // Biometrics summary
      if(entry.mood!=null||entry.sleep!=null||entry.energy!=null){
        md+='## Biometrics\n\n';
        md+='| Metric | Value |\n|---|---|\n';
        if(entry.mood!=null)md+='| Mood | '+entry.mood+'/10 |\n';
        if(entry.sleep!=null)md+='| Sleep | '+entry.sleep+'h |\n';
        if(entry.energy!=null)md+='| Energy | '+entry.energy+'/10 |\n';
        if(entry.weight!=null)md+='| Bodyweight | '+entry.weight+'lbs |\n';
        if(entry.water!=null)md+='| Water | '+entry.water+' glasses |\n';
        md+='\n';
      }

      // Top 3
      if(entry.top3&&entry.top3.filter(Boolean).length){
        md+='## Top 3\n\n';
        entry.top3.filter(Boolean).forEach(function(t){md+='- [ ] '+t+'\n';});
        md+='\n';
      }

      // Wins
      if(entry.wins){md+='## Wins\n\n'+entry.wins+'\n\n';}

      // Challenges
      if(entry.challenges){md+='## Challenges\n\n'+entry.challenges+'\n\n';}

      // Gratitude
      if(entry.gratitude&&entry.gratitude.filter(Boolean).length){
        md+='## Gratitude\n\n';
        entry.gratitude.filter(Boolean).forEach(function(g){md+='- '+g+'\n';});
        md+='\n';
      }

      // Tomorrow's focus
      if(entry.tomorrow){md+='## Tomorrow\n\n'+entry.tomorrow+'\n\n';}

      // Free notes
      if(entry.notes){md+='## Notes\n\n'+entry.notes+'\n\n';}

      md+='---\n*Logged via BAKER Daily Log · '+date+' '+time+'*\n';

      var dir=vaultHandle;
      dir=await dir.getDirectoryHandle('00-Capture',{create:true});
      var fh=await dir.getFileHandle(date+'.md',{create:true});
      var w=await fh.createWritable();await w.write(md);await w.close();
      if(typeof spawnBirthParticle==='function')
        spawnBirthParticle('daily','00-Capture/'+date+'.md');
    }catch(e){console.error('[DAILYLOG] vault sync error:',e);}
  }

  // ── Render ──────────────────────────────────────────────
  function render(){
    var body=document.getElementById('dl-body');if(!body)return;
    var entry=_getToday();
    var date=_today();
    var d=new Date();
    var day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];

    // Progress indicator — how complete is today's log?
    var fields=['mood','sleep','energy','weight','water','wins','challenges','notes'];
    var filled=fields.filter(function(f){return entry[f]!=null&&entry[f]!=='';}).length;
    var top3filled=(entry.top3||[]).filter(Boolean).length;
    var gratFilled=(entry.gratitude||[]).filter(Boolean).length;
    var total=fields.length+3+3; // fields + 3 top3 + 3 gratitude
    var done=filled+Math.min(top3filled,3)+Math.min(gratFilled,3);
    var pct=Math.round((done/total)*100);

    var html=
      // Header with date + progress
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'+
        '<div>'+
          '<div style="font-family:var(--mono);font-size:13px;color:var(--accent);font-weight:700">'+day+'</div>'+
          '<div style="font-family:var(--mono);font-size:9px;color:var(--muted)">'+date+'</div>'+
        '</div>'+
        '<div style="text-align:right">'+
          '<div style="font-family:var(--mono);font-size:18px;font-weight:700;color:'+(pct>=80?'var(--green)':pct>=50?'var(--amber)':'var(--muted)')+'">'+pct+'%</div>'+
          '<div style="font-family:var(--mono);font-size:8px;color:var(--muted)">complete</div>'+
        '</div>'+
      '</div>'+
      // Progress bar
      '<div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:16px">'+
        '<div style="height:100%;width:'+pct+'%;background:var(--accent);border-radius:2px;transition:width .4s"></div>'+
      '</div>'+

      // ── BIOMETRICS ──────────────────────────────────────
      _section('BIOMETRICS')+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">'+
        _numInput('dl-mood','Mood',entry.mood,1,10,0.5,'/10')+
        _numInput('dl-sleep','Sleep',entry.sleep,0,24,0.5,'hrs')+
        _numInput('dl-energy','Energy',entry.energy,1,10,0.5,'/10')+
        _numInput('dl-weight','Bodyweight',entry.weight,50,500,0.5,'lbs')+
      '</div>'+
      '<div style="margin-bottom:14px">'+
        '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);letter-spacing:.08em;margin-bottom:5px">WATER INTAKE</div>'+
        '<div style="display:flex;gap:6px;align-items:center">'+
          [1,2,3,4,5,6,7,8].map(function(n){
            var active=(entry.water||0)>=n;
            return'<button class="dl-water-btn" data-n="'+n+'" style="width:28px;height:28px;border-radius:50%;border:2px solid '+(active?'var(--accent)':'var(--border)')+';background:'+(active?'rgba(124,106,247,0.15)':'none')+';font-size:13px;cursor:pointer;transition:all .15s">💧</button>';
          }).join('')+
          '<span style="font-family:var(--mono);font-size:10px;color:var(--accent);margin-left:4px">'+(entry.water||0)+' glasses</span>'+
        '</div>'+
      '</div>'+

      // ── TOP 3 ─────────────────────────────────────────
      _section('TOP 3 PRIORITIES')+
      '<div style="margin-bottom:14px">'+
        [0,1,2].map(function(i){
          return'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
            '<span style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700;flex-shrink:0">'+(i+1)+'</span>'+
            '<input class="dl-top3" data-i="'+i+'" value="'+(entry.top3&&entry.top3[i]?_esc(entry.top3[i]):'')+'" placeholder="Priority '+(i+1)+'..." '+
            'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:7px 10px;font-family:var(--mono);font-size:10px;color:var(--text);outline:none"></div>';
        }).join('')+
      '</div>'+

      // ── WINS ──────────────────────────────────────────
      _section('WINS')+
      _textarea('dl-wins',"What did you get done today? What went well?",(entry.wins||''),'50px')+

      // ── CHALLENGES ────────────────────────────────────
      _section('CHALLENGES')+
      _textarea('dl-challenges',"What was hard? What got in the way?",(entry.challenges||''),'50px')+

      // ── GRATITUDE ─────────────────────────────────────
      _section('GRATITUDE')+
      '<div style="margin-bottom:14px">'+
        [0,1,2].map(function(i){
          return'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
            '<span style="font-size:14px;flex-shrink:0">🙏</span>'+
            '<input class="dl-grat" data-i="'+i+'" value="'+(entry.gratitude&&entry.gratitude[i]?_esc(entry.gratitude[i]):'')+'" placeholder="Grateful for..." '+
            'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:7px 10px;font-family:var(--mono);font-size:10px;color:var(--text);outline:none"></div>';
        }).join('')+
      '</div>'+

      // ── TOMORROW ──────────────────────────────────────
      _section("TOMORROW'S FOCUS")+
      _textarea('dl-tomorrow',"What's the one thing for tomorrow?",(entry.tomorrow||''),'44px')+

      // ── FREE NOTES ────────────────────────────────────
      _section('NOTES')+
      _textarea('dl-notes',"Anything else on your mind...",(entry.notes||''),'60px')+

      // ── SAVE ──────────────────────────────────────────
      '<button id="dl-save-btn" style="width:100%;background:var(--accent-dim);border:1px solid var(--accent);border-radius:8px;padding:10px;font-family:var(--mono);font-size:11px;color:var(--accent);cursor:pointer;margin-top:4px">&#128190; Save to Vault</button>'+
      '<div id="dl-status" style="font-family:var(--mono);font-size:9px;color:var(--muted);text-align:center;margin-top:6px;min-height:14px"></div>';

    body.innerHTML=html;
    _bindEvents(entry);
  }

  function _section(label){
    return'<div style="font-family:var(--mono);font-size:8px;color:var(--accent);letter-spacing:.12em;margin-bottom:6px">'+label+'</div>';
  }
  function _numInput(id,label,val,min,max,step,unit){
    return'<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px">'+
      '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);letter-spacing:.06em;margin-bottom:5px">'+label+'</div>'+
      '<div style="display:flex;align-items:center;gap:5px">'+
        '<input id="'+id+'" type="number" value="'+(val!=null?val:'')+'" min="'+min+'" max="'+max+'" step="'+step+'" placeholder="—" '+
        'style="flex:1;background:none;border:none;font-family:var(--mono);font-size:20px;font-weight:700;color:var(--accent);outline:none;width:0;min-width:0">'+
        '<span style="font-family:var(--mono);font-size:9px;color:var(--muted)">'+unit+'</span>'+
      '</div></div>';
  }
  function _textarea(id,placeholder,val,minHeight){
    return'<textarea id="'+id+'" placeholder="'+placeholder+'" rows="2" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-family:var(--mono);font-size:10px;color:var(--text);resize:vertical;outline:none;min-height:'+minHeight+';margin-bottom:14px;box-sizing:border-box;line-height:1.6">'+_esc(val)+'</textarea>';
  }
  function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}

  // ── Bind all events ─────────────────────────────────────
  function _bindEvents(entry){
    var panel=document.getElementById(PANEL_ID);
    if(!panel)return;

    // Auto-collect all fields
    function _collect(){
      var top3=['dl-top3'].map?null:null;
      var t3=Array.from(panel.querySelectorAll('.dl-top3')).map(function(i){return i.value.trim();});
      var grat=Array.from(panel.querySelectorAll('.dl-grat')).map(function(i){return i.value.trim();});
      var mood=parseFloat((panel.querySelector('#dl-mood')||{}).value);
      var sleep=parseFloat((panel.querySelector('#dl-sleep')||{}).value);
      var energy=parseFloat((panel.querySelector('#dl-energy')||{}).value);
      var weight=parseFloat((panel.querySelector('#dl-weight')||{}).value);
      var fields={
        top3:t3,gratitude:grat,
        wins:(panel.querySelector('#dl-wins')||{}).value||'',
        challenges:(panel.querySelector('#dl-challenges')||{}).value||'',
        tomorrow:(panel.querySelector('#dl-tomorrow')||{}).value||'',
        notes:(panel.querySelector('#dl-notes')||{}).value||'',
        water:entry.water||0
      };
      if(!isNaN(mood))fields.mood=mood;
      if(!isNaN(sleep))fields.sleep=sleep;
      if(!isNaN(energy))fields.energy=energy;
      if(!isNaN(weight))fields.weight=weight;
      return fields;
    }

    // Water buttons
    panel.querySelectorAll('.dl-water-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        entry.water=parseInt(btn.dataset.n);
        var saved=_saveToday({water:entry.water});
        _syncBiometrics(saved);
        render(); // re-render to update water dots
      });
    });

    // Auto-save on any change
    var inputs=panel.querySelectorAll('input[type="number"],input[type="text"],textarea');
    inputs.forEach(function(inp){
      inp.addEventListener('change',function(){
        var fields=_collect();
        var saved=_saveToday(fields);
        _syncBiometrics(saved);
        // Update progress bar without full re-render
        entry=Object.assign(entry,fields);
      });
    });

    // Save to vault button
    var saveBtn=panel.querySelector('#dl-save-btn');
    if(saveBtn)saveBtn.addEventListener('click',async function(){
      var fields=_collect();
      var saved=_saveToday(fields);
      _syncBiometrics(saved);
      saveBtn.textContent='Saving...';saveBtn.disabled=true;
      await _syncToVault(saved);
      saveBtn.textContent='✓ Saved to Vault';
      var status=panel.querySelector('#dl-status');
      if(status)status.textContent='Written to 00-Capture/'+_today()+'.md';
      setTimeout(function(){
        saveBtn.textContent='💾 Save to Vault';
        saveBtn.disabled=false;
        if(typeof DAILY!=='undefined')DAILY.updateDailyNote();
        render(); // refresh progress
      },2000);
      if(typeof speakResponse==='function')speakResponse('Daily log saved, sir.');
    });
  }

  // ── Panel ────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    p.classList.add('dl-vis');if(p._wbNormalise)p._wbNormalise();
    render();
  }
  function hidePanel(){var p=document.getElementById(PANEL_ID);if(p)p.classList.remove('dl-vis');}
  function togglePanel(){
    var p=document.getElementById(PANEL_ID);if(!p)return;
    if(p.classList.contains('dl-vis'))hidePanel();else showPanel();
  }
  function handleVoice(cmd){
    var c=cmd.toLowerCase();
    if(/\b(daily log|log today|open log|fill.*log|daily check.?in)\b/.test(c)){
      showPanel();return'Daily log open, sir.';
    }
    return null;
  }
  function init(){}
  return{init,showPanel,hidePanel,togglePanel,handleVoice};
})();
