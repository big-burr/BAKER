// ═══════════════════════════════════════════════════════════
// ══  BIOMETRICS MODULE  ════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Tracks mood (1-10), sleep (hours), energy (1-10)
// Data source: parses vault daily logs (00-Capture/YYYY-MM-DD.md)
// Also stores locally in baker_biometrics_v1 for fast access
// Morning prompt handled by hud.html INIT block
// Panel: movable/resizable, chart + log + today entry
// ═══════════════════════════════════════════════════════════
var BIOMETRICS=(function(){

  var LS_KEY='baker_biometrics_v1';
  var PANEL_ID='biometrics-panel';

  // entry: {date:'YYYY-MM-DD', mood:1-10|null, sleep:0-24|null, energy:1-10|null, note:''}
  var entries=[];
  var currentTab='log'; // 'log' | 'trends'

  // ── Storage ───────────────────────────────────────────────
  function _load(){
    try{var r=localStorage.getItem(LS_KEY);if(r)entries=JSON.parse(r);}
    catch(e){entries=[];}
  }
  function _save(){
    try{localStorage.setItem(LS_KEY,JSON.stringify(entries));}catch(e){}
    if(typeof VAULTSYNC!=='undefined'&&VAULTSYNC.syncBiometrics)VAULTSYNC.syncBiometrics(entries);
  }

  function _todayStr(){
    var d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  function _getEntry(date){
    return entries.find(function(e){return e.date===date;})||null;
  }
  function _setEntry(date,fields){
    var existing=_getEntry(date);
    if(existing){Object.assign(existing,fields);}
    else{entries.push(Object.assign({date:date,mood:null,sleep:null,energy:null,note:''},fields));}
    entries.sort(function(a,b){return b.date.localeCompare(a.date);});
    _save();
  }

  // ── Parse from vault ──────────────────────────────────────
  // Reads mood/sleep/energy from frontmatter of daily log notes
  function syncFromVault(){
    if(typeof vaultIndex==='undefined'||!vaultIndex.length)return;
    vaultIndex.forEach(function(note){
      if(!/^00-Capture\/\d{4}-\d{2}-\d{2}\.md$/.test(note.path))return;
      var dateMatch=note.path.match(/(\d{4}-\d{2}-\d{2})\.md$/);
      if(!dateMatch)return;
      var date=dateMatch[1];
      var content=note.content||'';
      // Parse frontmatter
      var moodM=content.match(/^mood:\s*(\d+(?:\.\d+)?)/m);
      var sleepM=content.match(/^sleep:\s*(\d+(?:\.\d+)?)/m);
      var energyM=content.match(/^energy:\s*(\d+(?:\.\d+)?)/m);
      var noteM=content.match(/^## 🌙 End of day reflection\n+([\s\S]*?)(?:\n##|\n---|\s*$)/m);
      if(!moodM&&!sleepM&&!energyM)return;
      var fields={};
      if(moodM)fields.mood=parseFloat(moodM[1]);
      if(sleepM)fields.sleep=parseFloat(sleepM[1]);
      if(energyM)fields.energy=parseFloat(energyM[1]);
      if(noteM&&noteM[1].trim())fields.note=noteM[1].trim().slice(0,200);
      _setEntry(date,fields);
    });
  }

  // ── Write back to vault daily log ─────────────────────────
  async function _writeToVault(date,fields){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return false;
    try{
      var dir=await vaultHandle.getDirectoryHandle('00-Capture',{create:true});
      var fname=date+'.md';
      var fh=await dir.getFileHandle(fname,{create:true});
      var existing=await(await fh.getFile()).text();

      // If file empty create template with sleep field
      if(!existing.trim()){
        existing='---\ntype: daily\ndate: '+date+'\nweek: \nmood: \nsleep: \nenergy: \n---\n\n# Daily Log — '+date+'\n\n## Top 3\n- \n- \n- \n\n## Notes\n\n## Done\n\n## Tomorrow\n\n## Conversations\n';
      }

      // Update frontmatter fields
      if(fields.mood!=null){
        if(/^mood:\s*/m.test(existing))existing=existing.replace(/^(mood:\s*).*$/m,'$1'+fields.mood);
        else existing=existing.replace(/^(energy:)/m,'mood: '+fields.mood+'\n$1');
      }
      if(fields.sleep!=null){
        if(/^sleep:\s*/m.test(existing))existing=existing.replace(/^(sleep:\s*).*$/m,'$1'+fields.sleep);
        else existing=existing.replace(/^(energy:)/m,'sleep: '+fields.sleep+'\n$1');
      }
      if(fields.energy!=null){
        if(/^energy:\s*/m.test(existing))existing=existing.replace(/^(energy:\s*).*$/m,'$1'+fields.energy);
      }

      var w=await fh.createWritable();
      await w.write(existing);await w.close();

      // Update vaultIndex
      if(typeof vaultIndex!=='undefined'){
        var vi=vaultIndex.findIndex(function(n){return n.path==='00-Capture/'+fname;});
        if(vi>=0)vaultIndex[vi].content=existing;
        else vaultIndex.push({name:fname,path:'00-Capture/'+fname,content:existing});
      }
      return true;
    }catch(e){console.error('[BIOMETRICS] vault write:',e);return false;}
  }

  // ── Log today (called from morning prompt response) ───────
  async function logToday(mood,sleep,energy){
    var today=_todayStr();
    var fields={};
    if(mood!=null)fields.mood=mood;
    if(sleep!=null)fields.sleep=sleep;
    if(energy!=null)fields.energy=energy;
    _setEntry(today,fields);
    await _writeToVault(today,fields);
    render();
  }

  // ── Stats helpers ─────────────────────────────────────────
  function _avg(arr){
    var vals=arr.filter(function(v){return v!=null&&!isNaN(v);});
    return vals.length?vals.reduce(function(s,v){return s+v;},0)/vals.length:null;
  }
  function _last30(){
    var cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);
    var cs=cutoff.getFullYear()+'-'+String(cutoff.getMonth()+1).padStart(2,'0')+'-'+String(cutoff.getDate()).padStart(2,'0');
    return entries.filter(function(e){return e.date>=cs;});
  }

  // ── Sparkline SVG ─────────────────────────────────────────
  function _sparkline(values,color,maxVal,w,h){
    var filtered=values.filter(function(v){return v!=null;});
    if(filtered.length<2)return '<svg width="'+w+'" height="'+h+'"></svg>';
    var pts=values.map(function(v,i){
      var x=(i/(values.length-1))*w;
      var y=v!=null?h-((v/maxVal)*h*0.85+h*0.07):null;
      return v!=null?x+','+y:null;
    }).filter(Boolean).join(' ');
    // Area fill
    var first=values.findIndex(function(v){return v!=null;});
    var last=values.length-1-values.slice().reverse().findIndex(function(v){return v!=null;});
    var fx=(first/(values.length-1))*w;
    var lx=(last/(values.length-1))*w;
    return '<svg viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">'+
      '<defs><linearGradient id="sg-'+color.replace('#','')+'" x1="0" y1="0" x2="0" y2="1">'+
      '<stop offset="0%" stop-color="'+color+'" stop-opacity="0.3"/>'+
      '<stop offset="100%" stop-color="'+color+'" stop-opacity="0.02"/>'+
      '</linearGradient></defs>'+
      '<polygon points="'+fx+','+h+' '+pts+' '+lx+','+h+'" fill="url(#sg-'+color.replace('#','')+')" />'+
      '<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'+
      '</svg>';
  }

  // ── Render ────────────────────────────────────────────────
  function render(){
    var panel=document.getElementById(PANEL_ID);
    if(!panel||!panel.classList.contains('bio-vis'))return;

    // Sync from vault first
    if(typeof vaultIndex!=='undefined'&&vaultIndex.length)syncFromVault();

    var today=_todayStr();
    var todayEntry=_getEntry(today);
    var last30=_last30();

    // Tab buttons
    ['log','trends'].forEach(function(t){
      var btn=document.getElementById('bio-tab-'+t);
      if(btn)btn.classList.toggle('active',t===currentTab);
    });

    var body=document.getElementById('bio-body');
    if(!body)return;

    if(currentTab==='log')_renderLog(body,today,todayEntry,last30);
    else _renderTrends(body,last30);
  }

  function _renderLog(body,today,todayEntry,last30){
    var avgMood=_avg(last30.map(function(e){return e.mood;}));
    var avgSleep=_avg(last30.map(function(e){return e.sleep;}));
    var avgEnergy=_avg(last30.map(function(e){return e.energy;}));

    var td=todayEntry||{mood:null,sleep:null,energy:null};

    var html=
      // Today entry
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px">'+
      '<div style="font-family:var(--mono);font-size:9px;color:var(--accent);letter-spacing:.1em;margin-bottom:12px">TODAY — '+today+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">'+
      _metricInput('bio-mood','MOOD',td.mood,'1','10','1',avgMood?avgMood.toFixed(1):'—')+
      _metricInput('bio-sleep','SLEEP (HRS)',td.sleep,'0','12','0.5',avgSleep?avgSleep.toFixed(1)+'h':'—')+
      _metricInput('bio-energy','ENERGY',td.energy,'1','10','1',avgEnergy?avgEnergy.toFixed(1):'—')+
      '</div>'+
      '<div style="display:flex;gap:8px">'+
      '<button id="bio-save-today" style="flex:1;background:var(--accent-dim);border:1px solid var(--accent);border-radius:4px;padding:7px;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer">Save Today</button>'+
      (typeof vaultConnected!=='undefined'&&vaultConnected?'<div style="font-family:var(--mono);font-size:9px;color:var(--muted);align-self:center">Will write to vault</div>':'')+
      '</div></div>'+

      // 30-day averages
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">'+
      _statCard('AVG MOOD',avgMood?avgMood.toFixed(1)+'/10':'No data','var(--accent)')+
      _statCard('AVG SLEEP',avgSleep?avgSleep.toFixed(1)+'h':'No data','var(--blue)')+
      _statCard('AVG ENERGY',avgEnergy?avgEnergy.toFixed(1)+'/10':'No data','var(--amber)')+
      '</div>'+

      // Recent log
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.1em;margin-bottom:8px">RECENT ENTRIES</div>'+
      '<div style="display:flex;flex-direction:column;gap:4px">';

    var recent=entries.slice(0,14);
    if(!recent.length){
      html+='<div style="font-family:var(--mono);font-size:10px;color:var(--muted);padding:8px">No entries yet. Log today above or connect your vault.</div>';
    }else{
      recent.forEach(function(e){
        var moodColor=e.mood!=null?(e.mood>=7?'var(--green)':e.mood>=5?'var(--amber)':'var(--red)'):'var(--border)';
        html+='<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface);border-radius:5px;border:1px solid var(--border)">'+
          '<span style="font-family:var(--mono);font-size:9px;color:var(--muted);width:78px;flex-shrink:0">'+e.date+'</span>'+
          (e.mood!=null?'<span style="font-size:9px;color:'+moodColor+'">&#9679; '+e.mood+'/10</span>':'<span style="font-size:9px;color:var(--border)">&#9675;</span>')+
          (e.sleep!=null?'<span style="font-size:9px;color:var(--blue)">&#128564; '+e.sleep+'h</span>':'')+
          (e.energy!=null?'<span style="font-size:9px;color:var(--amber)">&#9889; '+e.energy+'/10</span>':'')+
          '</div>';
      });
    }
    html+='</div>';

    body.innerHTML=html;
    _bindLogEvents(today);
  }

  function _metricInput(id,label,value,min,max,step,avg){
    return '<div style="text-align:center">'+
      '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);letter-spacing:.08em;margin-bottom:5px">'+label+'</div>'+
      '<input id="'+id+'" type="number" value="'+(value!=null?value:'')+'" min="'+min+'" max="'+max+'" step="'+step+'" placeholder="—" '+
      'style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:8px;font-family:var(--mono);font-size:14px;font-weight:700;color:var(--text);text-align:center;outline:none">'+
      '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);margin-top:3px">avg '+avg+'</div>'+
      '</div>';
  }

  function _statCard(label,value,color){
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center">'+
      '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);letter-spacing:.08em;margin-bottom:4px">'+label+'</div>'+
      '<div style="font-family:var(--mono);font-size:16px;font-weight:700;color:'+color+'">'+value+'</div>'+
      '</div>';
  }

  function _bindLogEvents(today){
    var saveBtn=document.getElementById('bio-save-today');
    if(saveBtn)saveBtn.addEventListener('click',async function(){
      var mood=parseFloat(document.getElementById('bio-mood').value)||null;
      var sleep=parseFloat(document.getElementById('bio-sleep').value)||null;
      var energy=parseFloat(document.getElementById('bio-energy').value)||null;
      saveBtn.textContent='Saving...';saveBtn.disabled=true;
      await logToday(mood,sleep,energy);
      saveBtn.textContent='Saved ✓';
      setTimeout(function(){saveBtn.textContent='Save Today';saveBtn.disabled=false;},2000);
    });
  }

  function _renderTrends(body,last30){
    if(last30.length<2){
      body.innerHTML='<div style="font-family:var(--mono);font-size:11px;color:var(--muted);padding:20px;text-align:center">Log at least 2 days to see trends.<br><br>Connect your vault to import existing daily logs.</div>';
      return;
    }

    // Sort oldest first for charts
    var sorted=last30.slice().sort(function(a,b){return a.date.localeCompare(b.date);});
    var moods=sorted.map(function(e){return e.mood;});
    var sleeps=sorted.map(function(e){return e.sleep;});
    var energies=sorted.map(function(e){return e.energy;});
    var dates=sorted.map(function(e){return e.date.slice(5);});// MM-DD

    // Correlations
    var moodEnergy=_correlation(moods,energies);
    var sleepMood=_correlation(sleeps,moods);
    var sleepEnergy=_correlation(sleeps,energies);

    var html=
      // Mood chart
      '<div style="margin-bottom:16px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+
      '<span style="font-family:var(--mono);font-size:9px;color:var(--accent);letter-spacing:.1em">MOOD (last '+last30.length+' days)</span>'+
      '<span style="font-family:var(--mono);font-size:9px;color:var(--muted)">avg '+(_avg(moods)||0).toFixed(1)+'/10</span>'+
      '</div>'+
      '<div style="height:60px;background:var(--surface);border-radius:6px;padding:6px;overflow:hidden">'+
      _sparkline(moods,'#7c6af7',10,300,48)+
      '</div>'+
      _dateAxis(dates)+'</div>'+

      // Sleep chart
      '<div style="margin-bottom:16px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+
      '<span style="font-family:var(--mono);font-size:9px;color:var(--blue);letter-spacing:.1em">SLEEP (hours)</span>'+
      '<span style="font-family:var(--mono);font-size:9px;color:var(--muted)">avg '+(_avg(sleeps)||0).toFixed(1)+'h</span>'+
      '</div>'+
      '<div style="height:60px;background:var(--surface);border-radius:6px;padding:6px;overflow:hidden">'+
      _sparkline(sleeps,'#60a5fa',12,300,48)+
      '</div>'+
      _dateAxis(dates)+'</div>'+

      // Energy chart
      '<div style="margin-bottom:16px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+
      '<span style="font-family:var(--mono);font-size:9px;color:var(--amber);letter-spacing:.1em">ENERGY</span>'+
      '<span style="font-family:var(--mono);font-size:9px;color:var(--muted)">avg '+(_avg(energies)||0).toFixed(1)+'/10</span>'+
      '</div>'+
      '<div style="height:60px;background:var(--surface);border-radius:6px;padding:6px;overflow:hidden">'+
      _sparkline(energies,'#fbbf24',10,300,48)+
      '</div>'+
      _dateAxis(dates)+'</div>'+

      // Correlations
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.1em;margin-bottom:8px">CORRELATIONS</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'+
      _corrCard('Sleep → Mood',sleepMood,'var(--accent)')+
      _corrCard('Sleep → Energy',sleepEnergy,'var(--blue)')+
      _corrCard('Mood → Energy',moodEnergy,'var(--amber)')+
      '</div>'+

      // Streaks
      '<div style="margin-top:14px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px">'+
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.08em;margin-bottom:6px">LOGGING STREAK</div>'+
      '<div style="font-family:var(--mono);font-size:20px;font-weight:700;color:var(--accent)">'+_calcStreak()+' days</div>'+
      '</div>';

    body.innerHTML=html;

    // Make sparklines responsive
    body.querySelectorAll('svg').forEach(function(svg){
      svg.style.width='100%';svg.style.height='100%';
    });
  }

  function _dateAxis(dates){
    if(!dates.length)return'';
    var step=Math.max(1,Math.floor(dates.length/5));
    var shown=dates.filter(function(_,i){return i%step===0||i===dates.length-1;});
    return '<div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:8px;color:var(--muted);margin-top:2px;padding:0 6px">'+
      shown.map(function(d){return'<span>'+d+'</span>';}).join('')+'</div>';
  }

  function _corrCard(label,corr,color){
    var val=corr!=null?corr.toFixed(2):'N/A';
    var strength=corr==null?'—':Math.abs(corr)>0.7?'Strong':Math.abs(corr)>0.4?'Moderate':'Weak';
    var sign=corr>0?'+':'';
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px;text-align:center">'+
      '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);margin-bottom:4px">'+label+'</div>'+
      '<div style="font-family:var(--mono);font-size:14px;font-weight:700;color:'+color+'">'+(corr!=null?sign+val:'N/A')+'</div>'+
      '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);margin-top:2px">'+strength+'</div>'+
      '</div>';
  }

  function _correlation(xs,ys){
    var pairs=xs.map(function(x,i){return[x,ys[i]];}).filter(function(p){return p[0]!=null&&p[1]!=null;});
    if(pairs.length<3)return null;
    var n=pairs.length;
    var mx=pairs.reduce(function(s,p){return s+p[0];},0)/n;
    var my=pairs.reduce(function(s,p){return s+p[1];},0)/n;
    var num=pairs.reduce(function(s,p){return s+(p[0]-mx)*(p[1]-my);},0);
    var dx=Math.sqrt(pairs.reduce(function(s,p){return s+Math.pow(p[0]-mx,2);},0));
    var dy=Math.sqrt(pairs.reduce(function(s,p){return s+Math.pow(p[1]-my,2);},0));
    if(!dx||!dy)return null;
    return num/(dx*dy);
  }

  function _calcStreak(){
    var today=_todayStr();
    var d=new Date();
    var streak=0;
    while(streak<365){
      var ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      var e=_getEntry(ds);
      if(!e||( e.mood==null&&e.sleep==null&&e.energy==null))break;
      streak++;
      d.setDate(d.getDate()-1);
    }
    return streak;
  }

  // ── Panel show/hide ───────────────────────────────────────
  function showPanel(){
    var p=document.getElementById(PANEL_ID);
    if(!p)return;
    p.classList.add('bio-vis');
    if(p._wbNormalise)p._wbNormalise();
    render();
  }
  function hidePanel(){
    var p=document.getElementById(PANEL_ID);
    if(p)p.classList.remove('bio-vis');
  }
  function togglePanel(){
    var p=document.getElementById(PANEL_ID);
    if(!p)return;
    if(p.classList.contains('bio-vis'))hidePanel();
    else showPanel();
  }
  function switchTab(tab){
    currentTab=tab;render();
  }

  // ── Voice handler ─────────────────────────────────────────
  async function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();

    // Open panel
    if(/\b(open|show|pull up)\b.*\b(biometrics?|health tracker|mood|sleep tracker)\b/.test(c)){
      showPanel();return'Here are your biometrics, sir.';
    }

    // "log my sleep as 7.5 hours"
    var sleepM=c.match(/(?:log|track|record|i (slept|got|had))\b.*?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/);
    if(sleepM){
      var sleep=parseFloat(sleepM[2]);
      if(sleep>=0&&sleep<=24){
        await logToday(null,sleep,null);
        return'Logged '+sleep+' hours of sleep for today, sir.';
      }
    }

    // "log my mood as 8" / "my mood is 7"
    var moodM=c.match(/(?:log|track|my)\s+mood\s*(?:is|as|was|at)?\s*(\d+(?:\.\d+)?)/);
    if(moodM){
      var mood=parseFloat(moodM[1]);
      if(mood>=1&&mood<=10){
        await logToday(mood,null,null);
        return'Mood logged as '+mood+' out of 10, sir.';
      }
    }

    // "log my energy as 6"
    var energyM=c.match(/(?:log|track|my)\s+energy\s*(?:is|as|was|at)?\s*(\d+(?:\.\d+)?)/);
    if(energyM){
      var energy=parseFloat(energyM[1]);
      if(energy>=1&&energy<=10){
        await logToday(null,null,energy);
        return'Energy logged as '+energy+' out of 10, sir.';
      }
    }

    // Morning prompt response: "I slept 7 hours, energy 8"
    var morningM=c.match(/(?:slept?|got|had)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?).*?(?:energy|feel).*?(\d+(?:\.\d+)?)/);
    if(!morningM)morningM=c.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b.*?(\d+(?:\.\d+)?)\s*(?:out of|\/\s*10)?/);
    if(morningM){
      var ms=parseFloat(morningM[1]),me=parseFloat(morningM[2]);
      if(ms>=0&&ms<=24&&me>=1&&me<=10){
        await logToday(null,ms,me);
        return'Got it, sir. Logged '+ms+' hours sleep and energy at '+me+'. Have a good day.';
      }
    }

    return null;
  }

  // ── Init ──────────────────────────────────────────────────
  function init(){
    _load();
    // Sync from vault when it connects
  }

  // Called when vault connects
  function onVaultReady(){
    syncFromVault();
    render();
  }

  return{init,showPanel,hidePanel,togglePanel,switchTab,handleVoice,logToday,onVaultReady,getEntries:function(){return entries.slice();}};
})();
