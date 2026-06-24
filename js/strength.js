// ═══════════════════════════════════════════════════════════
// ══  STRENGTH MODULE  ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Tabs: Split | Log | Map | Score
// Storage: localStorage baker_strength_v1
// Vault: weekly workout note to 07-System/Workouts/
// Units: lbs | week starts Sunday
// ═══════════════════════════════════════════════════════════
var STRENGTH=(function(){

  var LS_KEY='baker_strength_v1';
  var DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DAYS_FULL=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  // ── Data schema ───────────────────────────────────────────
  // data = {
  //   bodyweight: number (lbs),
  //   split: [ { day:0-6, name:'Push', exercises:[{name,sets,reps,weight}] } ],
  //   logs: [ { date:'YYYY-MM-DD', day:0-6, entries:[{exercise,sets:[{reps,weight,done}]}], saved:bool } ],
  //   prs: { 'Bench Press': { weight:225, reps:5, date:'2026-06-01' } }
  // }
  var data={bodyweight:185,split:[],logs:[],prs:{}};
  var currentTab='split';
  var currentLogIdx=null; // index into data.logs for today

  // ── Muscle groups and their exercises ────────────────────
  var MUSCLES=[
    'chest','front-delts','side-delts','rear-delts',
    'biceps','triceps','forearms',
    'traps','lats','mid-back','lower-back',
    'abs','obliques',
    'quads','hamstrings','glutes','calves'
  ];

  // Exercise → primary muscles hit
  var EXERCISE_MUSCLES={
    'Bench Press':['chest','front-delts','triceps'],
    'Incline Bench':['chest','front-delts','triceps'],
    'Decline Bench':['chest','triceps'],
    'DB Fly':['chest'],
    'Cable Fly':['chest'],
    'Overhead Press':['front-delts','side-delts','triceps','traps'],
    'DB Lateral Raise':['side-delts'],
    'Cable Lateral Raise':['side-delts'],
    'Front Raise':['front-delts'],
    'Face Pull':['rear-delts','traps'],
    'Tricep Pushdown':['triceps'],
    'Skull Crusher':['triceps'],
    'Close Grip Bench':['triceps','chest'],
    'Deadlift':['lats','traps','lower-back','glutes','hamstrings'],
    'Romanian Deadlift':['hamstrings','glutes','lower-back'],
    'Barbell Row':['lats','mid-back','rear-delts','biceps'],
    'Cable Row':['lats','mid-back','biceps'],
    'Lat Pulldown':['lats','biceps'],
    'Pull Up':['lats','biceps','mid-back'],
    'Chin Up':['biceps','lats'],
    'Shrug':['traps'],
    'Barbell Curl':['biceps'],
    'DB Curl':['biceps'],
    'Hammer Curl':['biceps','forearms'],
    'Squat':['quads','glutes','hamstrings'],
    'Hack Squat':['quads','glutes'],
    'Leg Press':['quads','glutes','hamstrings'],
    'Leg Extension':['quads'],
    'Leg Curl':['hamstrings'],
    'Hip Thrust':['glutes'],
    'Lunge':['quads','glutes'],
    'Calf Raise':['calves'],
    'Plank':['abs','obliques'],
    'Ab Wheel':['abs'],
    'Cable Crunch':['abs'],
    'Russian Twist':['obliques'],
    'Farmer Carry':['forearms','traps','abs'],
  };

  // ── Soreness model (no API — time-based decay) ─────────────────
  // After working a muscle, it stays "hot" for 48h, then decays over 24h
  // Returns 0-1 heat value for a muscle
  function _muscleHeat(muscle){
    var now=Date.now();
    var heat=0;
    data.logs.forEach(function(log){
      var logTime=new Date(log.date+'T12:00:00').getTime();
      var age=(now-logTime)/(1000*3600); // hours ago
      if(age>96)return; // fully recovered after 4 days
      log.entries.forEach(function(entry){
        var muscles=EXERCISE_MUSCLES[entry.exercise]||[];
        if(!muscles.includes(muscle))return;
        var setsCompleted=entry.sets.filter(function(s){return s.done;}).length;
        if(!setsCompleted)return;
        // Peak at 0h, hold until 48h, decay 48-96h
        var intensity=Math.min(setsCompleted/4,1);
        var heatVal;
        if(age<48)heatVal=intensity;
        else heatVal=intensity*(1-(age-48)/48);
        heat=Math.max(heat,Math.max(0,heatVal));
      });
    });
    return heat;
  }

  // ── Strength Score ────────────────────────────────────────
  // Based on Wilks-lite: sum of (PR weight / bodyweight ratio) for key lifts
  // Normalized to 0-1000 scale
  var KEY_LIFTS=['Bench Press','Squat','Deadlift','Overhead Press','Barbell Row'];
  var STRENGTH_NORMS={
    'Bench Press':1.5,'Squat':2.0,'Deadlift':2.5,'Overhead Press':0.9,'Barbell Row':1.25
  };
  function _calcStrengthScore(){
    var bw=data.bodyweight||185;
    var total=0,count=0;
    KEY_LIFTS.forEach(function(lift){
      var pr=data.prs[lift];
      if(!pr)return;
      var ratio=pr.weight/bw;
      var norm=STRENGTH_NORMS[lift]||1.5;
      total+=(ratio/norm)*200;
      count++;
    });
    return count?Math.round(total/count):0;
  }
  function _calcWeeklyVolume(){
    var weekStart=_weekStart();
    var vol=0;
    data.logs.forEach(function(log){
      if(log.date<weekStart)return;
      log.entries.forEach(function(entry){
        entry.sets.forEach(function(s){
          if(s.done)vol+=s.reps*s.weight;
        });
      });
    });
    return vol;
  }
  function _weekStart(){
    var d=new Date();
    var day=d.getDay(); // 0=Sun
    d.setDate(d.getDate()-day);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  // ── Storage ───────────────────────────────────────────────
  function _load(){
    try{var r=localStorage.getItem(LS_KEY);if(r)data=JSON.parse(r);}
    catch(e){data={bodyweight:185,split:[],logs:[],prs:{}};}
    if(!data.prs)data.prs={};
    if(!data.split)data.split=[];
    if(!data.logs)data.logs=[];
    if(!data.bodyweight)data.bodyweight=185;
  }
  function _save(){
    // Prune logs older than 90 days to prevent localStorage bloat
    var cutoff=new Date();cutoff.setDate(cutoff.getDate()-90);
    var cs=cutoff.getFullYear()+'-'+String(cutoff.getMonth()+1).padStart(2,'0')+'-'+String(cutoff.getDate()).padStart(2,'0');
    data.logs=data.logs.filter(function(l){return l.date>=cs;});
    try{localStorage.setItem(LS_KEY,JSON.stringify(data));}catch(e){}
    if(typeof VAULTSYNC!=='undefined'&&VAULTSYNC.syncStrength)VAULTSYNC.syncStrength(data);
  }

  // ── Today's log entry ─────────────────────────────────────
  function _todayStr(){
    var d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function _getTodayLog(){
    var today=_todayStr();
    var log=data.logs.find(function(l){return l.date===today;});
    if(!log){
      var dayOfWeek=new Date().getDay();
      var splitDay=data.split.find(function(s){return s.day===dayOfWeek;});
      log={
        date:today,
        day:dayOfWeek,
        name:splitDay?splitDay.name:'Workout',
        entries:splitDay?splitDay.exercises.map(function(ex){
          return{exercise:ex.name,
                 targetSets:ex.sets,targetReps:ex.reps,targetWeight:ex.weight||0,
                 sets:[],note:''};
        }):[],
        saved:false
      };
      data.logs.push(log);
      _save();
    }
    return log;
  }

  // ── Vault save ────────────────────────────────────────────
  async function _saveWeekToVault(){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return false;
    try{
      var ws=_weekStart();
      var weekEnd=new Date(ws);weekEnd.setDate(weekEnd.getDate()+6);
      var we=weekEnd.getFullYear()+'-'+String(weekEnd.getMonth()+1).padStart(2,'0')+'-'+String(weekEnd.getDate()).padStart(2,'0');
      // Get this week's logs
      var weekLogs=data.logs.filter(function(l){return l.date>=ws&&l.date<=we;});
      if(!weekLogs.length)return false;

      var md='---\ntype: workout-week\ndate: '+ws+'\n---\n\n';
      md+='# Workout Week — '+ws+' to '+we+'\n\n';
      md+='**Strength Score:** '+_calcStrengthScore()+' | **Weekly Volume:** '+_calcWeeklyVolume().toLocaleString()+' lbs\n\n';

      weekLogs.forEach(function(log){
        md+='## '+DAYS_FULL[log.day]+' — '+log.name+' ('+log.date+')\n\n';
        if(!log.entries.length){md+='_Rest day_\n\n';return;}
        log.entries.forEach(function(entry){
          var doneSets=entry.sets.filter(function(s){return s.done;});
          if(!doneSets.length)return;
          md+='**'+entry.exercise+'**\n';
          doneSets.forEach(function(s,i){
            md+='- Set '+(i+1)+': '+s.reps+' reps × '+s.weight+'lbs\n';
          });
          if(entry.note)md+='  _'+entry.note+'_\n';
          md+='\n';
        });
      });

      // PRs this week
      var weekPRs=[];
      weekLogs.forEach(function(log){
        log.entries.forEach(function(entry){
          var pr=data.prs[entry.exercise];
          if(pr&&pr.date>=ws)weekPRs.push(entry.exercise+': '+pr.weight+'lbs × '+pr.reps);
        });
      });
      if(weekPRs.length){md+='## PRs This Week\n\n';weekPRs.forEach(function(p){md+='- '+p+'\n';});md+='\n';}

      var dir=vaultHandle;
      dir=await dir.getDirectoryHandle('07-System',{create:true});
      dir=await dir.getDirectoryHandle('Workouts',{create:true});
      var fname='workout-week-'+ws+'.md';
      var fh=await dir.getFileHandle(fname,{create:true});
      var w=await fh.createWritable();
      await w.write(md);await w.close();
      return true;
    }catch(e){console.error('[STRENGTH] vault save:',e);return false;}
  }

  // ── PR tracking ───────────────────────────────────────────
  function _checkPR(exercise,reps,weight){
    var existing=data.prs[exercise];
    // PR if heavier, or same weight for more reps
    if(!existing||weight>existing.weight||(weight===existing.weight&&reps>existing.reps)){
      data.prs[exercise]={weight:weight,reps:reps,date:_todayStr()};
      return true;
    }
    return false;
  }

  // ── Faction character SVG ─────────────────────────────────
  function _getFactionChar(theme,recoveryScore){
    // recoveryScore: 0=destroyed, 1=fresh
    var col='var(--accent)';
    var dark='var(--bg)';
    var fresh=recoveryScore>0.6;
    var mid=recoveryScore>0.3;

    // Pose offsets based on recovery
    var bodyY=fresh?0:mid?4:10;      // slumping
    var headTilt=fresh?0:mid?5:12;   // head drooping
    var armAngle=fresh?-15:mid?5:25; // arms hanging

    if(theme==='pipboy'||theme==='vaulttec'){
      // Vault Boy - thumbs up if fresh, arms down if tired
      return _vaultBoySVG(col,dark,fresh,mid,bodyY,headTilt);
    }else if(theme==='enclave'){
      return _hellFireSVG(col,dark,fresh,mid,bodyY);
    }else if(theme==='bos'){
      return _t60SVG(col,dark,fresh,mid,bodyY);
    }else if(theme==='ncr'){
      return _ncrRangerSVG(col,dark,fresh,mid,bodyY);
    }else{
      // Default: human silhouette
      return _humanSVG(col,dark,fresh,mid,bodyY,headTilt);
    }
  }

  function _humanSVG(col,dark,fresh,mid,bodyY,headTilt){
    return '<svg viewBox="0 0 80 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">'+
      '<g transform="translate(40,'+(bodyY)+')" fill="'+col+'" opacity="0.9">'+
      // Head
      '<circle cx="0" cy="'+(8+headTilt*0.3)+'" r="10" opacity="0.95"/>'+
      // Neck
      '<rect x="-3" y="17" width="6" height="7"/>'+
      // Torso
      '<rect x="-12" y="24" width="24" height="32" rx="3"/>'+
      // Arms
      (fresh?
        // Arms slightly raised
        '<rect x="-22" y="24" width="8" height="28" rx="3" transform="rotate(-8,-18,24)"/>'+
        '<rect x="14" y="24" width="8" height="28" rx="3" transform="rotate(8,18,24)"/>'
        :mid?
        // Arms hanging
        '<rect x="-22" y="28" width="8" height="26" rx="3"/>'+
        '<rect x="14" y="28" width="8" height="26" rx="3"/>'
        :
        // Arms slumped forward
        '<rect x="-22" y="30" width="8" height="26" rx="3" transform="rotate(10,-18,30)"/>'+
        '<rect x="14" y="30" width="8" height="26" rx="3" transform="rotate(-10,18,30)"/>'
      )+
      // Legs
      '<rect x="-12" y="58" width="10" height="36" rx="3" transform="rotate('+(fresh?0:mid?3:6)+',−7,58)"/>'+
      '<rect x="2" y="58" width="10" height="36" rx="3" transform="rotate('+(fresh?0:mid?-3:-6)+',7,58)"/>'+
      // Feet
      '<rect x="-14" y="91" width="12" height="6" rx="2"/>'+
      '<rect x="2" y="91" width="12" height="6" rx="2"/>'+
      '</g></svg>';
  }

  function _vaultBoySVG(col,dark,fresh,mid,bodyY,headTilt){
    return '<svg viewBox="0 0 80 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">'+
      '<g transform="translate(40,'+(bodyY)+')">'+
      // Head with big eyes
      '<circle cx="'+(headTilt*0.3)+'" cy="8" r="12" fill="'+col+'" opacity="0.95"/>'+
      // Eyes
      '<circle cx="'+(headTilt*0.3-4)+'" cy="6" r="3" fill="'+dark+'"/>'+
      '<circle cx="'+(headTilt*0.3+4)+'" cy="6" r="3" fill="'+dark+'"/>'+
      '<circle cx="'+(headTilt*0.3-3)+'" cy="5" r="1.2" fill="'+col+'"/>'+
      '<circle cx="'+(headTilt*0.3+5)+'" cy="5" r="1.2" fill="'+col+'"/>'+
      // Smile or frown
      (fresh?
        '<path d="M'+(headTilt*0.3-4)+' 13 Q'+(headTilt*0.3)+' 17 '+(headTilt*0.3+4)+' 13" stroke="'+dark+'" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
        :
        '<path d="M'+(headTilt*0.3-3)+' 15 Q'+(headTilt*0.3)+' 12 '+(headTilt*0.3+3)+' 15" stroke="'+dark+'" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
      )+
      // Pip-Boy suit body
      '<rect x="-13" y="21" width="26" height="30" rx="4" fill="'+col+'"/>'+
      // Pip-Boy wrist device on left arm
      (fresh?
        // Thumbs up arm
        '<g transform="rotate(-45,-20,22)"><rect x="-20" y="21" width="8" height="22" rx="3" fill="'+col+'"/></g>'+
        '<circle cx="-26" cy="12" r="5" fill="'+col+'"/>'+  // thumb up fist
        '<rect x="-28" y="8" width="4" height="8" rx="2" fill="'+col+'"/>'  // thumb
        :
        // Arm down
        '<rect x="-22" y="24" width="8" height="24" rx="3" fill="'+col+'"/>'+
        '<rect x="-24" y="46" width="10" height="6" rx="2" fill="'+col+'"/>'
      )+
      // Right arm
      '<rect x="14" y="24" width="8" height="24" rx="3" fill="'+col+'"/>'+
      // Legs
      '<rect x="-12" y="51" width="11" height="30" rx="3" fill="'+col+'"/>'+
      '<rect x="1" y="51" width="11" height="30" rx="3" fill="'+col+'"/>'+
      // Boots
      '<rect x="-14" y="78" width="13" height="8" rx="2" fill="'+col+'"/>'+
      '<rect x="1" y="78" width="13" height="8" rx="2" fill="'+col+'"/>'+
      // Pip-Boy on wrist detail
      '<rect x="-24" y="32" width="10" height="8" rx="2" fill="'+dark+'" opacity="0.6"/>'+
      '<circle cx="-19" cy="36" r="2.5" fill="'+col+'" opacity="0.8"/>'+
      '</g></svg>';
  }

  function _hellFireSVG(col,dark,fresh,mid,bodyY){
    // Enclave Hellfire armor - bulky, intimidating
    return '<svg viewBox="0 0 80 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">'+
      '<g transform="translate(40,'+(bodyY)+')">'+
      // Helmet - rounded top, visor
      '<rect x="-13" y="-2" width="26" height="22" rx="8" fill="'+col+'"/>'+
      '<rect x="-10" y="4" width="20" height="10" rx="3" fill="'+dark+'" opacity="0.8"/>'+
      // Helmet antenna/crest
      '<rect x="-2" y="-8" width="4" height="8" rx="1" fill="'+col+'"/>'+
      // Visor glow
      '<rect x="-9" y="5" width="18" height="8" rx="2" fill="'+col+'" opacity="'+(fresh?'0.6':'0.2')+'"/>'+
      // Neck/collar
      '<rect x="-8" y="19" width="16" height="6" rx="2" fill="'+col+'"/>'+
      // Massive torso armor
      '<rect x="-17" y="25" width="34" height="36" rx="5" fill="'+col+'"/>'+
      // Chest detail lines
      '<rect x="-14" y="29" width="28" height="2" rx="1" fill="'+dark+'" opacity="0.4"/>'+
      '<rect x="-14" y="35" width="28" height="2" rx="1" fill="'+dark+'" opacity="0.4"/>'+
      // Shoulder pauldrons
      '<ellipse cx="-20" cy="27" rx="8" ry="6" fill="'+col+'"/>'+
      '<ellipse cx="20" cy="27" rx="8" ry="6" fill="'+col+'"/>'+
      // Arms - bulky
      '<rect x="-26" y="26" width="10" height="26" rx="4" fill="'+col+'" transform="rotate('+(fresh?-5:mid?3:10)+','+-21+',26)"/>'+
      '<rect x="16" y="26" width="10" height="26" rx="4" fill="'+col+'" transform="rotate('+(fresh?5:mid?-3:-10)+',21,26)"/>'+
      // Gauntlets
      '<rect x="-27" y="50" width="12" height="8" rx="3" fill="'+col+'" opacity="0.85"/>'+
      '<rect x="15" y="50" width="12" height="8" rx="3" fill="'+col+'" opacity="0.85"/>'+
      // Legs - bulky
      '<rect x="-15" y="61" width="13" height="32" rx="4" fill="'+col+'"/>'+
      '<rect x="2" y="61" width="13" height="32" rx="4" fill="'+col+'"/>'+
      // Boots
      '<rect x="-17" y="90" width="15" height="8" rx="3" fill="'+col+'"/>'+
      '<rect x="2" y="90" width="15" height="8" rx="3" fill="'+col+'"/>'+
      // Incinerator on back/hip (signature weapon hint)
      '<rect x="17" y="45" width="6" height="18" rx="2" fill="'+col+'" opacity="0.5"/>'+
      '</g></svg>';
  }

  function _t60SVG(col,dark,fresh,mid,bodyY){
    // Brotherhood T-60 power armor
    return '<svg viewBox="0 0 80 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">'+
      '<g transform="translate(40,'+(bodyY)+')">'+
      // T-60 helmet - distinctive T-shape visor
      '<rect x="-12" y="-2" width="24" height="24" rx="6" fill="'+col+'"/>'+
      // T-shaped visor
      '<rect x="-10" y="3" width="20" height="5" rx="2" fill="'+dark+'" opacity="0.9"/>'+
      '<rect x="-5" y="3" width="10" height="14" rx="2" fill="'+dark+'" opacity="0.9"/>'+
      // Visor light
      '<rect x="-9" y="4" width="18" height="3" rx="1" fill="'+col+'" opacity="'+(fresh?'0.7':'0.15')+'"/>'+
      // Neck
      '<rect x="-7" y="21" width="14" height="5" rx="2" fill="'+col+'"/>'+
      // Chest - BoS emblem shape
      '<rect x="-16" y="26" width="32" height="34" rx="5" fill="'+col+'"/>'+
      // Chest cross detail
      '<rect x="-14" y="31" width="28" height="3" rx="1" fill="'+dark+'" opacity="0.35"/>'+
      '<rect x="-3" y="28" width="6" height="28" rx="1" fill="'+dark+'" opacity="0.25"/>'+
      // Shoulder pauldrons - larger than Hellfire, more angular
      '<rect x="-26" y="23" width="12" height="8" rx="3" fill="'+col+'"/>'+
      '<rect x="14" y="23" width="12" height="8" rx="3" fill="'+col+'"/>'+
      // Arms
      '<rect x="-25" y="30" width="10" height="28" rx="4" fill="'+col+'" transform="rotate('+(fresh?-3:mid?4:10)+','+-20+',30)"/>'+
      '<rect x="15" y="30" width="10" height="28" rx="4" fill="'+col+'" transform="rotate('+(fresh?3:mid?-4:-10)+',20,30)"/>'+
      // Forearm detail / vents
      '<rect x="-24" y="44" width="9" height="3" rx="1" fill="'+dark+'" opacity="0.4"/>'+
      '<rect x="15" y="44" width="9" height="3" rx="1" fill="'+dark+'" opacity="0.4"/>'+
      // Gauntlets
      '<rect x="-26" y="56" width="12" height="7" rx="3" fill="'+col+'"/>'+
      '<rect x="14" y="56" width="12" height="7" rx="3" fill="'+col+'"/>'+
      // Legs
      '<rect x="-14" y="60" width="12" height="32" rx="4" fill="'+col+'"/>'+
      '<rect x="2" y="60" width="12" height="32" rx="4" fill="'+col+'"/>'+
      // Knee pads
      '<rect x="-14" y="73" width="12" height="6" rx="2" fill="'+col+'" opacity="0.7"/>'+
      '<rect x="2" y="73" width="12" height="6" rx="2" fill="'+col+'" opacity="0.7"/>'+
      // Boots
      '<rect x="-16" y="89" width="14" height="8" rx="3" fill="'+col+'"/>'+
      '<rect x="2" y="89" width="14" height="8" rx="3" fill="'+col+'"/>'+
      '</g></svg>';
  }

  function _ncrRangerSVG(col,dark,fresh,mid,bodyY){
    // NCR Veteran Ranger - iconic helmet + duster
    return '<svg viewBox="0 0 80 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">'+
      '<g transform="translate(40,'+(bodyY)+')">'+
      // Gas mask helmet - round with goggle eyes
      '<circle cx="0" cy="8" r="13" fill="'+col+'"/>'+
      // Goggle eyes
      '<circle cx="-5" cy="6" r="5" fill="'+dark+'" opacity="0.9"/>'+
      '<circle cx="5" cy="6" r="5" fill="'+dark+'" opacity="0.9"/>'+
      '<circle cx="-5" cy="6" r="3.5" fill="'+col+'" opacity="'+(fresh?'0.5':'0.15')+'"/>'+
      '<circle cx="5" cy="6" r="3.5" fill="'+col+'" opacity="'+(fresh?'0.5':'0.15')+'"/>'+
      // Goggle bridge
      '<rect x="-1" y="4" width="2" height="4" fill="'+col+'"/>'+
      // Gas mask filter/mouth piece
      '<rect x="-5" y="14" width="10" height="6" rx="2" fill="'+col+'" opacity="0.85"/>'+
      '<circle cx="-3" cy="17" r="1.5" fill="'+dark+'" opacity="0.6"/>'+
      '<circle cx="3" cy="17" r="1.5" fill="'+dark+'" opacity="0.6"/>'+
      // Ranger hat brim hint
      '<rect x="-14" y="0" width="28" height="3" rx="1" fill="'+col+'" opacity="0.6"/>'+
      // Neck/collar
      '<rect x="-5" y="20" width="10" height="5" rx="2" fill="'+col+'"/>'+
      // Duster coat body - long and flowing
      '<rect x="-13" y="25" width="26" height="38" rx="4" fill="'+col+'"/>'+
      // Coat lapels
      '<path d="M-13 25 L-5 32 L0 27 L5 32 L13 25" stroke="'+dark+'" stroke-width="1" fill="none" opacity="0.5"/>'+
      // Badge/star on chest
      '<polygon points="0,28 1.5,32 5,32 2.5,34.5 3.5,38 0,36 -3.5,38 -2.5,34.5 -5,32 -1.5,32" fill="'+dark+'" opacity="0.7"/>'+
      // Arms in duster sleeves
      '<rect x="-20" y="25" width="8" height="30" rx="3" fill="'+col+'" transform="rotate('+(fresh?-8:mid?2:10)+','+-16+',25)"/>'+
      '<rect x="12" y="25" width="8" height="30" rx="3" fill="'+col+'" transform="rotate('+(fresh?8:mid?-2:-10)+',16,25)"/>'+
      // Gloves
      '<rect x="-21" y="52" width="9" height="6" rx="2" fill="'+col+'" opacity="0.75"/>'+
      '<rect x="12" y="52" width="9" height="6" rx="2" fill="'+col+'" opacity="0.75"/>'+
      // Duster bottom flare
      '<path d="M-13 63 L-16 85 L-8 85 L0 75 L8 85 L16 85 L13 63 Z" fill="'+col+'"/>'+
      // Legs under duster
      '<rect x="-10" y="63" width="9" height="25" rx="3" fill="'+col+'" opacity="0.7"/>'+
      '<rect x="1" y="63" width="9" height="25" rx="3" fill="'+col+'" opacity="0.7"/>'+
      // Boots
      '<rect x="-12" y="85" width="11" height="7" rx="2" fill="'+col+'"/>'+
      '<rect x="1" y="85" width="11" height="7" rx="2" fill="'+col+'"/>'+
      // Holster hint
      '<rect x="13" y="50" width="4" height="14" rx="1" fill="'+col+'" opacity="0.5"/>'+
      '</g></svg>';
  }

  // ── Heat map SVG body ─────────────────────────────────────
  function _heatColor(heat,theme){
    // Map heat (0-1) to a color
    if(heat<0.01)return'rgba(255,255,255,0.04)';
    // Use accent color at varying opacity
    var alpha=0.15+heat*0.75;
    if(theme==='pipboy'||theme==='pipboy')return'rgba(57,255,20,'+alpha.toFixed(2)+')';
    if(theme==='enclave')return'rgba(200,30,0,'+alpha.toFixed(2)+')';
    if(theme==='bos')return'rgba(200,160,60,'+alpha.toFixed(2)+')';
    if(theme==='ncr')return'rgba(200,160,90,'+alpha.toFixed(2)+')';
    if(theme==='vaulttec')return'rgba(245,196,0,'+alpha.toFixed(2)+')';
    return'rgba(124,106,247,'+alpha.toFixed(2)+')';
  }

  // Simplified front body map with clickable muscle regions
  function _buildHeatMap(){
    var theme=typeof FALLOUT!=='undefined'?FALLOUT.getTheme():'none';
    var muscles={
      chest:_muscleHeat('chest'),
      'front-delts':_muscleHeat('front-delts'),
      'side-delts':_muscleHeat('side-delts'),
      biceps:_muscleHeat('biceps'),
      triceps:_muscleHeat('triceps'),
      forearms:_muscleHeat('forearms'),
      abs:_muscleHeat('abs'),
      quads:_muscleHeat('quads'),
      calves:_muscleHeat('calves'),
      lats:_muscleHeat('lats'),
      traps:_muscleHeat('traps'),
      hamstrings:_muscleHeat('hamstrings'),
      glutes:_muscleHeat('glutes'),
    };
    var c=function(m){return _heatColor(muscles[m]||0,theme);};
    var acc='var(--accent)';

    // Overall recovery 0-1
    var totalHeat=Object.values(muscles).reduce(function(s,v){return s+v;},0)/Object.keys(muscles).length;
    var recovery=1-totalHeat;

    return {svg:
      '<svg viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-height:300px">'+
      '<defs>'+
      '<radialGradient id="bg-grad" cx="50%" cy="50%" r="50%">'+
      '<stop offset="0%" stop-color="var(--surface2)"/>'+
      '<stop offset="100%" stop-color="var(--bg)"/>'+
      '</radialGradient></defs>'+
      '<rect width="200" height="340" fill="url(#bg-grad)" rx="8"/>'+

      // ── FRONT VIEW ──
      '<text x="52" y="15" font-size="8" fill="var(--muted)" font-family="var(--mono)" text-anchor="middle">FRONT</text>'+
      '<text x="152" y="15" font-size="8" fill="var(--muted)" font-family="var(--mono)" text-anchor="middle">BACK</text>'+
      '<line x1="100" y1="10" x2="100" y2="330" stroke="var(--border)" stroke-width="1" opacity="0.4"/>'+

      // HEAD FRONT
      '<ellipse cx="52" cy="32" rx="14" ry="16" fill="var(--surface2)" stroke="'+acc+'" stroke-width="0.8" opacity="0.6"/>'+
      // NECK
      '<rect x="47" y="47" width="10" height="8" rx="2" fill="var(--surface2)" stroke="'+acc+'" stroke-width="0.6" opacity="0.5"/>'+
      // TRAPS (front)
      '<ellipse cx="35" cy="56" rx="10" ry="6" fill="'+c('traps')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="traps" style="cursor:pointer"/>'+
      '<ellipse cx="69" cy="56" rx="10" ry="6" fill="'+c('traps')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="traps" style="cursor:pointer"/>'+
      // CHEST
      '<ellipse cx="44" cy="72" rx="15" ry="12" fill="'+c('chest')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="chest" style="cursor:pointer"/>'+
      '<ellipse cx="60" cy="72" rx="15" ry="12" fill="'+c('chest')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="chest" style="cursor:pointer"/>'+
      // FRONT DELTS
      '<circle cx="31" cy="63" r="7" fill="'+c('front-delts')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="front-delts" style="cursor:pointer"/>'+
      '<circle cx="73" cy="63" r="7" fill="'+c('front-delts')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="front-delts" style="cursor:pointer"/>'+
      // SIDE DELTS
      '<ellipse cx="25" cy="70" rx="5" ry="9" fill="'+c('side-delts')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="side-delts" style="cursor:pointer"/>'+
      '<ellipse cx="79" cy="70" rx="5" ry="9" fill="'+c('side-delts')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="side-delts" style="cursor:pointer"/>'+
      // BICEPS
      '<ellipse cx="23" cy="88" rx="5" ry="11" fill="'+c('biceps')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="biceps" style="cursor:pointer"/>'+
      '<ellipse cx="81" cy="88" rx="5" ry="11" fill="'+c('biceps')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="biceps" style="cursor:pointer"/>'+
      // TRICEPS (visible on sides)
      '<ellipse cx="19" cy="90" rx="4" ry="9" fill="'+c('triceps')+'" stroke="'+acc+'" stroke-width="0.6" opacity="0.7" data-muscle="triceps" style="cursor:pointer"/>'+
      '<ellipse cx="85" cy="90" rx="4" ry="9" fill="'+c('triceps')+'" stroke="'+acc+'" stroke-width="0.6" opacity="0.7" data-muscle="triceps" style="cursor:pointer"/>'+
      // FOREARMS
      '<ellipse cx="21" cy="108" rx="4" ry="10" fill="'+c('forearms')+'" stroke="'+acc+'" stroke-width="0.6" data-muscle="forearms" style="cursor:pointer"/>'+
      '<ellipse cx="83" cy="108" rx="4" ry="10" fill="'+c('forearms')+'" stroke="'+acc+'" stroke-width="0.6" data-muscle="forearms" style="cursor:pointer"/>'+
      // ABS
      '<rect x="42" y="85" width="20" height="36" rx="4" fill="'+c('abs')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="abs" style="cursor:pointer"/>'+
      // Abs grid lines
      '<line x1="42" y1="97" x2="62" y2="97" stroke="'+acc+'" stroke-width="0.5" opacity="0.3"/>'+
      '<line x1="42" y1="109" x2="62" y2="109" stroke="'+acc+'" stroke-width="0.5" opacity="0.3"/>'+
      '<line x1="52" y1="85" x2="52" y2="121" stroke="'+acc+'" stroke-width="0.5" opacity="0.3"/>'+
      // QUADS
      '<ellipse cx="43" cy="148" rx="12" ry="24" fill="'+c('quads')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="quads" style="cursor:pointer"/>'+
      '<ellipse cx="61" cy="148" rx="12" ry="24" fill="'+c('quads')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="quads" style="cursor:pointer"/>'+
      // CALVES FRONT
      '<ellipse cx="43" cy="195" rx="8" ry="15" fill="'+c('calves')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="calves" style="cursor:pointer"/>'+
      '<ellipse cx="61" cy="195" rx="8" ry="15" fill="'+c('calves')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="calves" style="cursor:pointer"/>'+
      // Feet
      '<ellipse cx="41" cy="215" rx="9" ry="4" fill="var(--surface2)" stroke="'+acc+'" stroke-width="0.6" opacity="0.5"/>'+
      '<ellipse cx="63" cy="215" rx="9" ry="4" fill="var(--surface2)" stroke="'+acc+'" stroke-width="0.6" opacity="0.5"/>'+

      // ── BACK VIEW ──
      // HEAD BACK
      '<ellipse cx="152" cy="32" rx="14" ry="16" fill="var(--surface2)" stroke="'+acc+'" stroke-width="0.8" opacity="0.6"/>'+
      // NECK BACK
      '<rect x="147" y="47" width="10" height="8" rx="2" fill="var(--surface2)" stroke="'+acc+'" stroke-width="0.6" opacity="0.5"/>'+
      // TRAPS (back - prominent)
      '<ellipse cx="152" cy="60" rx="22" ry="10" fill="'+c('traps')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="traps" style="cursor:pointer"/>'+
      // REAR DELTS
      '<circle cx="131" cy="63" r="7" fill="'+c('rear-delts')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="rear-delts" style="cursor:pointer"/>'+
      '<circle cx="173" cy="63" r="7" fill="'+c('rear-delts')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="rear-delts" style="cursor:pointer"/>'+
      // LATS
      '<ellipse cx="138" cy="85" rx="12" ry="18" fill="'+c('lats')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="lats" style="cursor:pointer"/>'+
      '<ellipse cx="166" cy="85" rx="12" ry="18" fill="'+c('lats')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="lats" style="cursor:pointer"/>'+
      // MID BACK / RHOMBOIDS
      '<rect x="142" y="75" width="20" height="20" rx="3" fill="'+c('mid-back')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="mid-back" style="cursor:pointer"/>'+
      // LOWER BACK / ERECTORS
      '<rect x="143" y="97" width="18" height="18" rx="3" fill="'+c('lower-back')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="lower-back" style="cursor:pointer"/>'+
      // TRICEPS BACK
      '<ellipse cx="125" cy="88" rx="5" ry="11" fill="'+c('triceps')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="triceps" style="cursor:pointer"/>'+
      '<ellipse cx="179" cy="88" rx="5" ry="11" fill="'+c('triceps')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="triceps" style="cursor:pointer"/>'+
      // FOREARMS BACK
      '<ellipse cx="123" cy="108" rx="4" ry="10" fill="'+c('forearms')+'" stroke="'+acc+'" stroke-width="0.6" data-muscle="forearms" style="cursor:pointer"/>'+
      '<ellipse cx="181" cy="108" rx="4" ry="10" fill="'+c('forearms')+'" stroke="'+acc+'" stroke-width="0.6" data-muscle="forearms" style="cursor:pointer"/>'+
      // GLUTES
      '<ellipse cx="143" cy="128" rx="14" ry="13" fill="'+c('glutes')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="glutes" style="cursor:pointer"/>'+
      '<ellipse cx="161" cy="128" rx="14" ry="13" fill="'+c('glutes')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="glutes" style="cursor:pointer"/>'+
      // HAMSTRINGS
      '<ellipse cx="143" cy="158" rx="12" ry="22" fill="'+c('hamstrings')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="hamstrings" style="cursor:pointer"/>'+
      '<ellipse cx="161" cy="158" rx="12" ry="22" fill="'+c('hamstrings')+'" stroke="'+acc+'" stroke-width="0.8" data-muscle="hamstrings" style="cursor:pointer"/>'+
      // CALVES BACK
      '<ellipse cx="143" cy="195" rx="8" ry="15" fill="'+c('calves')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="calves" style="cursor:pointer"/>'+
      '<ellipse cx="161" cy="195" rx="8" ry="15" fill="'+c('calves')+'" stroke="'+acc+'" stroke-width="0.7" data-muscle="calves" style="cursor:pointer"/>'+
      // Feet back
      '<ellipse cx="141" cy="215" rx="9" ry="4" fill="var(--surface2)" stroke="'+acc+'" stroke-width="0.6" opacity="0.5"/>'+
      '<ellipse cx="163" cy="215" rx="9" ry="4" fill="var(--surface2)" stroke="'+acc+'" stroke-width="0.6" opacity="0.5"/>'+

      // Tooltips via title
      '</svg>',
      recovery:recovery
    };
  }

  // ── Render functions ──────────────────────────────────────
  function _el(id){return document.getElementById(id);}
  function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function render(){
    var panel=_el('strength-panel');
    if(!panel||!panel.classList.contains('str-vis'))return;
    if(currentTab==='split')_renderSplit();
    else if(currentTab==='log')_renderLog();
    else if(currentTab==='map')_renderMap();
    else if(currentTab==='score')_renderScore();
    // Update tab active state
    ['split','log','map','score'].forEach(function(t){
      var btn=_el('str-tab-'+t);
      if(btn)btn.classList.toggle('active',t===currentTab);
      var content=_el('str-'+t+'-content');
      if(content)content.classList.toggle('active',t===currentTab);
    });
  }

  // ── SPLIT TAB ─────────────────────────────────────────────
  function _renderSplit(){
    var el=_el('str-split-content');if(!el)return;
    var today=new Date().getDay();
    var html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'+
      '<span style="font-family:var(--mono);font-size:11px;color:var(--muted)">Weekly Split — tap a day to edit</span>'+
      '<div style="display:flex;gap:6px;align-items:center">'+
      '<label style="font-size:11px;color:var(--muted);font-family:var(--mono)">Bodyweight:</label>'+
      '<input id="str-bw-input" type="number" value="'+data.bodyweight+'" min="50" max="500" step="0.5" style="width:60px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:4px 6px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none"> lbs'+
      '</div></div>';

    // Week grid
    html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:16px">';
    for(var d=0;d<7;d++){
      var splitDay=data.split.find(function(s){return s.day===d;});
      var isToday=d===today;
      html+='<div class="str-day-card'+(isToday?' today':'')+'" data-day="'+d+'" style="'+
        'background:var(--surface'+(isToday?'':'2')+');border:1px solid '+(isToday?'var(--accent)':'var(--border)')+';'+
        'border-radius:6px;padding:8px 4px;cursor:pointer;text-align:center;transition:all .15s">'+
        '<div style="font-family:var(--mono);font-size:9px;color:'+(isToday?'var(--accent)':'var(--muted)')+';letter-spacing:.08em">'+DAYS[d]+'</div>'+
        '<div style="font-size:10px;color:var(--text);margin-top:4px;line-height:1.3">'+(splitDay?_esc(splitDay.name):'<span style="color:var(--muted);font-size:9px">REST</span>')+'</div>'+
        (splitDay?'<div style="font-size:9px;color:var(--muted);margin-top:2px">'+splitDay.exercises.length+' ex</div>':'')+'</div>';
    }
    html+='</div>';

    // Edit panel for selected day
    html+='<div id="str-day-editor" style="display:none"></div>';

    el.innerHTML=html;

    // Bodyweight save
    var bwInput=_el('str-bw-input');
    if(bwInput)bwInput.addEventListener('change',function(){
      data.bodyweight=parseFloat(this.value)||185;
      _save();
    });

    // Day card clicks
    el.querySelectorAll('.str-day-card').forEach(function(card){
      card.addEventListener('click',function(){
        _showDayEditor(parseInt(card.dataset.day));
      });
    });
  }

  function _showDayEditor(dayIdx){
    var ed=_el('str-day-editor');if(!ed)return;
    var splitDay=data.split.find(function(s){return s.day===dayIdx;});
    var isRest=!splitDay;
    var exercises=splitDay?splitDay.exercises:[];

    var exList=exercises.map(function(ex,i){
      return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px">'+
        '<input value="'+_esc(ex.name)+'" data-exidx="'+i+'" data-field="name" placeholder="Exercise" '+
        'style="flex:1;background:none;border:none;outline:none;font-family:var(--mono);font-size:11px;color:var(--text)">'+
        '<input type="number" value="'+ex.sets+'" data-exidx="'+i+'" data-field="sets" min="1" max="20" '+
        'style="width:36px;background:none;border:1px solid var(--border);border-radius:3px;text-align:center;font-family:var(--mono);font-size:10px;color:var(--muted);padding:2px"> sets'+
        '<input type="number" value="'+ex.reps+'" data-exidx="'+i+'" data-field="reps" min="1" max="100" '+
        'style="width:36px;background:none;border:1px solid var(--border);border-radius:3px;text-align:center;font-family:var(--mono);font-size:10px;color:var(--muted);padding:2px"> reps'+
        '<input type="number" value="'+(ex.weight||0)+'" data-exidx="'+i+'" data-field="weight" min="0" max="2000" step="5" '+
        'style="width:46px;background:none;border:1px solid var(--border);border-radius:3px;text-align:center;font-family:var(--mono);font-size:10px;color:var(--muted);padding:2px"> lbs'+
        '<button data-rmidx="'+i+'" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:0 4px">&#215;</button>'+
        '</div>';
    }).join('');

    ed.style.display='block';
    ed.innerHTML='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:4px">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'+
      '<span style="font-family:var(--mono);font-size:11px;color:var(--accent)">'+DAYS_FULL[dayIdx]+'</span>'+
      '<input id="str-day-name" value="'+(isRest?'':_esc(splitDay.name))+'" placeholder="Day name (e.g. Push)" '+
      'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none">'+
      '<button id="str-day-rest" style="background:none;border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer">'+
      (isRest?'Mark Active':'Mark REST')+'</button></div>'+
      '<div id="str-ex-list">'+(isRest?'<div style="color:var(--muted);font-size:11px;font-family:var(--mono);padding:8px">Rest day — mark active to add exercises.</div>':exList)+'</div>'+
      (!isRest?'<button id="str-add-ex" style="background:none;border:1px dashed var(--border);border-radius:4px;padding:5px 10px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer;width:100%;margin-top:6px">+ Add exercise</button>':'')+
      '<button id="str-day-save" style="background:var(--accent-dim);border:1px solid var(--accent);border-radius:4px;padding:6px 16px;font-family:var(--mono);font-size:11px;color:var(--accent);cursor:pointer;margin-top:10px;float:right">Save Day</button>'+
      '</div>';

    // Wire events
    var saveBtn=_el('str-day-save');
    if(saveBtn)saveBtn.addEventListener('click',function(){_saveDayEditor(dayIdx,exercises);});

    var restBtn=_el('str-day-rest');
    if(restBtn)restBtn.addEventListener('click',function(){
      data.split=data.split.filter(function(s){return s.day!==dayIdx;});
      _save();ed.style.display='none';_renderSplit();
    });

    var addBtn=_el('str-add-ex');
    if(addBtn)addBtn.addEventListener('click',function(){
      exercises.push({name:'',sets:3,reps:5,weight:0});
      _showDayEditor(dayIdx);
    });

    // Remove exercise
    ed.querySelectorAll('[data-rmidx]').forEach(function(btn){
      btn.addEventListener('click',function(){
        exercises.splice(parseInt(btn.dataset.rmidx),1);
        _showDayEditor(dayIdx);
      });
    });

    // Field edits
    ed.querySelectorAll('[data-exidx]').forEach(function(inp){
      inp.addEventListener('change',function(){
        var i=parseInt(inp.dataset.exidx);
        var f=inp.dataset.field;
        if(f==='name')exercises[i].name=inp.value;
        else exercises[i][f]=parseFloat(inp.value)||0;
      });
    });
  }

  function _saveDayEditor(dayIdx,exercises){
    var nameInp=_el('str-day-name');
    var name=nameInp?nameInp.value.trim():'';
    if(!name&&exercises.length===0){
      data.split=data.split.filter(function(s){return s.day!==dayIdx;});
    }else{
      var existing=data.split.find(function(s){return s.day===dayIdx;});
      var filtered=exercises.filter(function(ex){return ex.name.trim();});
      if(existing){existing.name=name||existing.name;existing.exercises=filtered;}
      else{data.split.push({day:dayIdx,name:name||DAYS_FULL[dayIdx],exercises:filtered});}
    }
    _save();
    _el('str-day-editor').style.display='none';
    _renderSplit();
  }

  // ── LOG TAB ───────────────────────────────────────────────
  function _renderLog(){
    var el=_el('str-log-content');if(!el)return;
    var log=_getTodayLog();
    var today=new Date();
    var dayName=log.name||DAYS_FULL[today.getDay()];
    var splitDay=data.split.find(function(s){return s.day===today.getDay();});
    var isRest=!splitDay;

    var html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'+
      '<div>'+
      '<div style="font-family:var(--mono);font-size:13px;color:var(--accent)">'+_esc(dayName)+'</div>'+
      '<div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:2px">'+log.date+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:6px">'+
      '<button id="str-ai-rec" style="background:none;border:1px solid var(--accent-dim);border-radius:4px;padding:5px 10px;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer">&#9670; AI Recs</button>'+
      '<button id="str-save-vault" style="background:none;border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer">&#128190; Save Week</button>'+
      '</div></div>';

    if(isRest){
      html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;text-align:center">'+
        '<div style="font-size:24px;margin-bottom:8px">&#127774;</div>'+
        '<div style="font-family:var(--mono);font-size:12px;color:var(--accent);margin-bottom:8px">Rest Day</div>'+
        '<div style="font-family:var(--mono);font-size:10px;color:var(--muted);line-height:1.6">Active recovery suggestions:</div>'+
        '<div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:6px;line-height:1.8">'+
        '&#8226; 20-30 min walk or light cardio<br>'+
        '&#8226; Foam rolling — focus on soreness<br>'+
        '&#8226; Mobility work — hips, thoracic spine<br>'+
        '&#8226; Hydration + protein target<br>'+
        '&#8226; Sleep 8h for muscle repair'+
        '</div></div>';
    }else{
      // Exercise log entries
      if(!log.entries.length){
        html+='<div style="color:var(--muted);font-family:var(--mono);font-size:11px;padding:12px">No exercises yet. Add your split in the Split tab, or add manually:</div>';
      }
      html+='<div id="str-entries-list">';
      log.entries.forEach(function(entry,ei){
        var doneCount=entry.sets.filter(function(s){return s.done;}).length;
        var isPR=false;
        html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
          '<span style="font-family:var(--mono);font-size:12px;color:var(--text)">'+_esc(entry.exercise)+'</span>'+
          '<span style="font-family:var(--mono);font-size:10px;color:var(--muted)">'+doneCount+'/'+entry.sets.length+' sets</span>'+
          '</div>'+
          // Target
          (entry.targetSets?'<div style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-bottom:6px">Target: '+entry.targetSets+'×'+entry.targetReps+' @ '+entry.targetWeight+'lbs</div>':'')+
          // Set rows
          '<div id="str-sets-'+ei+'">';
        entry.sets.forEach(function(s,si){
          html+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+
            '<button class="str-set-done" data-ei="'+ei+'" data-si="'+si+'" style="'+
            'width:22px;height:22px;border-radius:50%;border:1.5px solid '+(s.done?'var(--green)':'var(--border)')+';'+
            'background:'+(s.done?'rgba(74,222,128,.15)':'none')+';cursor:pointer;font-size:11px;flex-shrink:0">'+
            (s.done?'&#10003;':'')+'</button>'+
            '<span style="font-family:var(--mono);font-size:10px;color:var(--muted);width:40px">Set '+(si+1)+'</span>'+
            '<input type="number" value="'+s.reps+'" min="0" max="100" class="str-set-reps" data-ei="'+ei+'" data-si="'+si+'" '+
            'style="width:38px;background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:2px 4px;font-family:var(--mono);font-size:11px;color:var(--text);text-align:center;outline:none"> reps '+
            '<input type="number" value="'+s.weight+'" min="0" max="2000" step="2.5" class="str-set-weight" data-ei="'+ei+'" data-si="'+si+'" '+
            'style="width:52px;background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:2px 4px;font-family:var(--mono);font-size:11px;color:var(--text);text-align:center;outline:none"> lbs'+
            '</div>';
        });
        html+='</div>'+
          '<button class="str-add-set" data-ei="'+ei+'" style="background:none;border:1px dashed var(--border);border-radius:3px;padding:3px 8px;font-family:var(--mono);font-size:9px;color:var(--muted);cursor:pointer;margin-top:4px">+ Set</button>'+
          '</div>';
      });
      html+='</div>';

      // Add custom exercise
      html+='<div style="display:flex;gap:6px;margin-top:8px">'+
        '<input id="str-custom-ex" list="str-ex-datalist" placeholder="Add exercise..." '+
        'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px 10px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none">'+
        '<button id="str-custom-add" style="background:none;border:1px solid var(--border);border-radius:4px;padding:6px 12px;font-family:var(--mono);font-size:10px;color:var(--muted);cursor:pointer">Add</button>'+
        '</div>'+
        '<datalist id="str-ex-datalist">'+
        Object.keys(EXERCISE_MUSCLES).map(function(ex){return'<option value="'+_esc(ex)+'">';}).join('')+
        '</datalist>';
    }

    el.innerHTML=html;
    _bindLogEvents(log);
  }

  function _bindLogEvents(log){
    // AI recommendations button
    var aiBtn=_el('str-ai-rec');
    if(aiBtn)aiBtn.addEventListener('click',function(){_getAIRecs(log);});

    // Save week to vault
    var svBtn=_el('str-save-vault');
    if(svBtn)svBtn.addEventListener('click',async function(){
      svBtn.textContent='Saving...';
      var ok=await _saveWeekToVault();
      svBtn.textContent=ok?'&#10003; Saved':'&#9888; Failed';
      setTimeout(function(){svBtn.textContent='&#128190; Save Week';},2000);
    });

    // Set done toggles
    document.querySelectorAll('.str-set-done').forEach(function(btn){
      btn.addEventListener('click',function(){
        var ei=parseInt(btn.dataset.ei),si=parseInt(btn.dataset.si);
        log.entries[ei].sets[si].done=!log.entries[ei].sets[si].done;
        // Check PR
        var entry=log.entries[ei];
        var s=entry.sets[si];
        if(s.done&&s.weight>0)_checkPR(entry.exercise,s.reps,s.weight);
        _save();_renderLog();
      });
    });

    // Set reps/weight inputs
    document.querySelectorAll('.str-set-reps').forEach(function(inp){
      inp.addEventListener('change',function(){
        var ei=parseInt(inp.dataset.ei),si=parseInt(inp.dataset.si);
        log.entries[ei].sets[si].reps=parseInt(inp.value)||0;
        _save();
      });
    });
    document.querySelectorAll('.str-set-weight').forEach(function(inp){
      inp.addEventListener('change',function(){
        var ei=parseInt(inp.dataset.ei),si=parseInt(inp.dataset.si);
        log.entries[ei].sets[si].weight=parseFloat(inp.value)||0;
        _save();
      });
    });

    // Add set
    document.querySelectorAll('.str-add-set').forEach(function(btn){
      btn.addEventListener('click',function(){
        var ei=parseInt(btn.dataset.ei);
        var prev=log.entries[ei].sets.slice(-1)[0];
        log.entries[ei].sets.push({reps:prev?prev.reps:5,weight:prev?prev.weight:0,done:false});
        _save();_renderLog();
      });
    });

    // Add custom exercise
    var customAdd=_el('str-custom-add');
    if(customAdd)customAdd.addEventListener('click',function(){
      var inp=_el('str-custom-ex');
      var name=(inp?inp.value.trim():'');
      if(!name)return;
      log.entries.push({exercise:name,sets:[{reps:5,weight:0,done:false}],note:''});
      _save();inp.value='';_renderLog();
    });
  }

  // ── AI Recommendations ────────────────────────────────────
  async function _getAIRecs(log){
    var key=localStorage.getItem('baker_api_key');
    if(!key){if(typeof speakResponse==='function')speakResponse('No API key, sir.');return;}
    var recDiv=_el('str-ai-rec');
    if(recDiv){recDiv.textContent='Thinking...';recDiv.disabled=true;}

    // Build context
    var recentLogs=data.logs.slice(-7).map(function(l){
      return l.name+' ('+l.date+'): '+l.entries.map(function(e){
        var done=e.sets.filter(function(s){return s.done;});
        return e.exercise+' '+done.length+'×'+( done[0]?done[0].reps+'@'+done[0].weight+'lbs':'');
      }).join(', ');
    }).join('\n');

    var prs=Object.entries(data.prs).map(function(kv){return kv[0]+': '+kv[1].weight+'lbs×'+kv[1].reps;}).join(', ');
    var todayExercises=log.entries.map(function(e){return e.exercise+'('+e.targetSets+'×'+e.targetReps+'@'+e.targetWeight+'lbs)';}).join(', ');
    var prompt='You are BAKER, a strength training assistant. The user follows a custom strength split (heavy, low reps) and has access to both gym and home equipment. Units: lbs. Bodyweight: '+data.bodyweight+'lbs.\n\nToday ('+DAYS_FULL[log.day]+' — '+log.name+'): '+todayExercises+'\nRecent training:\n'+recentLogs+'\nPRs: '+prs+'\n\nGive 3-5 specific, actionable workout recommendations for today. Focus on weight selection, technique cues, and progression. Keep it concise — 2-3 sentences per rec. No markdown headers. JARVIS tone.';

    try{
      var resp=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:400,messages:[{role:'user',content:prompt}]})
      });
      var d=await resp.json();
      var text=d.content.map(function(b){return b.text||'';}).join('').trim();
      // Show in a modal/overlay
      _showRecModal(text);
    }catch(e){if(typeof speakResponse==='function')speakResponse('Could not get recommendations, sir.');}
    finally{if(recDiv){recDiv.textContent='&#9670; AI Recs';recDiv.disabled=false;}}
  }

  function _showRecModal(text){
    var existing=_el('str-rec-modal');if(existing)existing.remove();
    var modal=document.createElement('div');
    modal.id='str-rec-modal';
    modal.style.cssText='position:absolute;inset:0;background:rgba(0,0,0,.85);z-index:50;display:flex;align-items:center;justify-content:center;padding:20px;border-radius:14px';
    modal.innerHTML='<div style="background:var(--surface);border:1px solid var(--accent);border-radius:10px;padding:20px;max-width:500px;width:100%;max-height:80%;overflow-y:auto">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'+
      '<span style="font-family:var(--mono);font-size:11px;color:var(--accent);letter-spacing:.1em">&#9670; BAKER RECOMMENDATIONS</span>'+
      '<button id="str-rec-close" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px">&#215;</button>'+
      '</div>'+
      '<div style="font-family:var(--mono);font-size:11px;color:var(--text);line-height:1.8;white-space:pre-wrap">'+_esc(text)+'</div>'+
      '</div>';
    _el('strength-panel').appendChild(modal);
    _el('str-rec-close').addEventListener('click',function(){modal.remove();});
  }

  // ── MAP TAB ───────────────────────────────────────────────
  function _renderMap(){
    var el=_el('str-map-content');if(!el)return;
    var theme=typeof FALLOUT!=='undefined'?FALLOUT.getTheme():'none';
    var mapData=_buildHeatMap();
    var recovery=mapData.recovery;

    el.innerHTML='<div style="display:flex;gap:16px;height:100%">'+
      // Left: character
      '<div style="width:100px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:8px">'+
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.08em;text-align:center">RECOVERY</div>'+
      '<div style="width:90px;height:130px">'+_getFactionChar(theme,recovery)+'</div>'+
      '<div style="font-family:var(--mono);font-size:10px;color:var(--accent);text-align:center">'+Math.round(recovery*100)+'%</div>'+
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);text-align:center">'+
      (recovery>0.75?'Fresh':'recovery>0.5'?'Good':recovery>0.25?'Fatigued':'Destroyed')+'</div>'+
      // Heat legend
      '<div style="margin-top:8px;width:80px">'+
      '<div style="font-family:var(--mono);font-size:8px;color:var(--muted);margin-bottom:4px">SORENESS</div>'+
      '<div style="height:8px;border-radius:4px;background:linear-gradient(to right,rgba(255,255,255,0.04),var(--accent));border:1px solid var(--border)"></div>'+
      '<div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:7px;color:var(--muted);margin-top:2px"><span>None</span><span>Peak</span></div>'+
      '</div>'+
      '</div>'+
      // Right: heat map
      '<div style="flex:1;overflow:auto" id="str-heatmap-wrap">'+
      mapData.svg+
      '</div>'+
      '</div>';

    // Muscle tooltips
    el.querySelectorAll('[data-muscle]').forEach(function(el){
      el.addEventListener('mouseenter',function(e){
        var muscle=el.dataset.muscle;
        var heat=_muscleHeat(muscle);
        var tip=_el('str-muscle-tip');
        if(!tip){tip=document.createElement('div');tip.id='str-muscle-tip';
          tip.style.cssText='position:fixed;background:var(--surface);border:1px solid var(--accent);border-radius:4px;padding:4px 8px;font-family:var(--mono);font-size:10px;color:var(--text);z-index:9999;pointer-events:none';
          document.body.appendChild(tip);}
        tip.textContent=muscle.replace(/-/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();})+' — '+(heat>0.6?'Very Sore':heat>0.3?'Sore':heat>0.1?'Slightly Sore':'Fresh');
        tip.style.left=(e.clientX+10)+'px';tip.style.top=(e.clientY-20)+'px';tip.style.display='block';
      });
      el.addEventListener('mouseleave',function(){var t=_el('str-muscle-tip');if(t)t.style.display='none';});
    });
  }

  // ── SCORE TAB ─────────────────────────────────────────────
  function _renderScore(){
    var el=_el('str-score-content');if(!el)return;
    var score=_calcStrengthScore();
    var volume=_calcWeeklyVolume();
    var bw=data.bodyweight;
    var scoreColor=score>=800?'var(--green)':score>=600?'var(--amber)':score>=400?'var(--blue)':'var(--muted)';
    var scoreLbl=score>=900?'Elite':score>=800?'Advanced':score>=600?'Intermediate':score>=400?'Novice':'Beginner';

    var html='<div style="text-align:center;padding:16px 0 24px">'+
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.12em;margin-bottom:8px">STRENGTH SCORE</div>'+
      '<div style="font-size:56px;font-weight:700;color:'+scoreColor+';font-family:var(--mono);line-height:1;text-shadow:0 0 20px '+scoreColor+'44">'+score+'</div>'+
      '<div style="font-family:var(--mono);font-size:12px;color:'+scoreColor+';margin-top:6px;letter-spacing:.1em">'+scoreLbl+'</div>'+
      '<div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:4px">based on '+bw+'lbs bodyweight</div>'+
      '</div>'+

      // Weekly volume
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;text-align:center">'+
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.1em;margin-bottom:6px">WEEKLY VOLUME</div>'+
      '<div style="font-size:24px;font-weight:700;color:var(--accent);font-family:var(--mono)">'+volume.toLocaleString()+' <span style="font-size:13px">lbs</span></div>'+
      '</div>'+

      // Per-lift PRs and ratios
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.1em;margin-bottom:8px">LIFT PRs & STRENGTH RATIOS</div>'+
      '<div style="display:flex;flex-direction:column;gap:6px">';

    KEY_LIFTS.forEach(function(lift){
      var pr=data.prs[lift];
      var norm=STRENGTH_NORMS[lift]||1.5;
      var ratio=pr?(pr.weight/bw):0;
      var pct=Math.min(100,Math.round((ratio/norm)*100));
      var barColor=pct>=100?'var(--green)':pct>=75?'var(--accent)':pct>=50?'var(--amber)':'var(--muted)';
      html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
        '<span style="font-size:11px;color:var(--text)">'+lift+'</span>'+
        '<div style="text-align:right">'+
        (pr?'<span style="font-family:var(--mono);font-size:11px;color:var(--accent)">'+pr.weight+'lbs × '+pr.reps+'</span>':'<span style="font-family:var(--mono);font-size:10px;color:var(--muted)">No PR yet</span>')+
        '</div></div>'+
        '<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">'+
        '<div style="height:100%;width:'+pct+'%;background:'+barColor+';border-radius:2px;transition:width .5s ease"></div>'+
        '</div>'+
        '<div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:3px">'+
        '<span>'+ratio.toFixed(2)+'× BW</span><span>Target: '+norm+'× ('+Math.round(norm*bw)+'lbs)</span></div>'+
        '</div>';
    });
    html+='</div>';

    el.innerHTML=html;
  }

  // ── Panel show/hide ───────────────────────────────────────
  function showPanel(){
    var p=_el('strength-panel');
    p.classList.add('str-vis');
    if(p._wbNormalise)p._wbNormalise();
    render();
  }
  function hidePanel(){_el('strength-panel').classList.remove('str-vis');}
  function togglePanel(){
    var p=_el('strength-panel');
    p.classList.toggle('str-vis');
    if(p.classList.contains('str-vis')){if(p._wbNormalise)p._wbNormalise();render();}
  }
  function switchTab(tab){
    currentTab=tab;render();
  }

  // ── Voice ─────────────────────────────────────────────────
  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(/\b(open|pull up|show|launch)\b.*\b(strength|workout|gym|training|lifts?)\b/.test(c)){
      showPanel();return"Here's your strength panel, sir.";
    }
    if(/\b(log|open)\b.*\b(workout|session|training)\b/.test(c)){
      showPanel();switchTab('log');return"Here's today's workout log, sir.";
    }
    if(/\b(muscle map|heat map|recovery)\b/.test(c)){
      showPanel();switchTab('map');return"Here's your muscle recovery map, sir.";
    }
    if(/\bstrength score\b/.test(c)){
      showPanel();switchTab('score');
      var score=_calcStrengthScore();
      return'Your strength score is '+score+', sir.';
    }
    return null;
  }

  // ── Init ──────────────────────────────────────────────────
  function init(){
    _load();
  }

  function importData(imported){
    if(!imported)return;
    if(imported.split&&imported.split.length)data.split=imported.split;
    if(imported.bodyweight)data.bodyweight=imported.bodyweight;
    if(imported.prs&&Object.keys(imported.prs).length)data.prs=Object.assign({},imported.prs,data.prs);
    try{localStorage.setItem(LS_KEY,JSON.stringify(data));}catch(e){}
    render();
  }
  return{init,showPanel,hidePanel,togglePanel,switchTab,handleVoice,importData};
})();
