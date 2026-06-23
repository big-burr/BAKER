// ═══════════════════════════════════════════════════════════
// ══  FALLOUT MODE MODULE  ══════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Owns: Fallout faction themes — Pip-Boy, Vault-Tec, Enclave,
//       Brotherhood of Steel, NCR. Each theme has its own
//       color palette, font, orb canvas art, nav logo, icon,
//       and boot voice line. One theme active at a time.
// Depends on globals: window.orbState, orbMusicMode, speakResponse
// localStorage: baker_fallout_theme — theme key string
// ═══════════════════════════════════════════════════════════
var FALLOUT=(function(){

  var LS_THEME='baker_fallout_theme';
  var LS_COLOR='baker_fallout_color';
  var LS_SCAN='baker_fallout_scanlines';

  // ── Theme definitions ─────────────────────────────────────
  var THEMES={
    none:{
      key:'none',
      label:'Default',
      logo:'BAKER',
      accent:'#7c6af7',
      accentDim:'#3d3578',
      bg:'#0f0f10',
      surface:'#1a1a1d',
      surface2:'#222226',
      border:'#2e2e34',
      text:'#e8e6f0',
      muted:'#7a7880',
      green:'#4ade80',
      amber:'#fbbf24',
      red:'#f87171',
      blue:'#60a5fa',
      mono:"'IBM Plex Mono',monospace",
      sans:"'IBM Plex Sans',sans-serif",
      scanlines:false,
      boot:null,
      icon:null
    },
    pipboy:{
      key:'pipboy',
      label:'Pip-Boy 3000',
      logo:'PIP-BOY 3000',
      accent:'#39ff14',
      accentDim:'#1a3d1a',
      bg:'#060a06',
      surface:'#0b120b',
      surface2:'#0f180f',
      border:'#1a2e1a',
      text:'#39ff14',
      muted:'#3a5c3a',
      green:'#39ff14',
      amber:'#c8a000',
      red:'#c84040',
      blue:'#40a040',
      mono:"'Courier Prime','Courier New',monospace",
      sans:"'Courier Prime','Courier New',monospace",
      scanlines:true,
      scanOpacity:50,
      boot:'Pip-Boy 3000 online. All systems nominal, sir.',
      icon:'pipboy'
    },
    vaulttec:{
      key:'vaulttec',
      label:'Vault-Tec',
      logo:'VAULT-TEC CORP',
      accent:'#f5c400',
      accentDim:'#3d3000',
      bg:'#0a0c14',
      surface:'#0e1220',
      surface2:'#131828',
      border:'#1e2a4a',
      text:'#e8e0c0',
      muted:'#7a7060',
      green:'#4ade80',
      amber:'#f5c400',
      red:'#f87171',
      blue:'#4a9eff',
      mono:"'IBM Plex Mono',monospace",
      sans:"'IBM Plex Sans',sans-serif",
      scanlines:false,
      boot:'Welcome back, Overseer. Your vault awaits.',
      icon:'vaulttec'
    },
    enclave:{
      key:'enclave',
      label:'The Enclave',
      logo:'ENCLAVE COMMAND',
      accent:'#cc2200',
      accentDim:'#4a0800',
      bg:'#0a0808',
      surface:'#140c0c',
      surface2:'#1a1010',
      border:'#3a1414',
      text:'#e8d0d0',
      muted:'#7a5050',
      green:'#4ade80',
      amber:'#cc7700',
      red:'#cc2200',
      blue:'#6080cc',
      mono:"'Share Tech Mono','Courier New',monospace",
      sans:"'Share Tech Mono','Courier New',monospace",
      scanlines:false,
      boot:'Enclave Command online. For the preservation of America.',
      icon:'enclave'
    },
    bos:{
      key:'bos',
      label:'Brotherhood of Steel',
      logo:'BROTHERHOOD OF STEEL',
      accent:'#c8a040',
      accentDim:'#4a3800',
      bg:'#080a0c',
      surface:'#0e1216',
      surface2:'#12181e',
      border:'#2a3040',
      text:'#d0d8e0',
      muted:'#607080',
      green:'#4ade80',
      amber:'#c8a040',
      red:'#cc4040',
      blue:'#5090c0',
      mono:"'MedievalSharp','Palatino Linotype','Book Antiqua',serif",
      sans:"'Cinzel','Palatino Linotype',serif",
      scanlines:false,
      boot:'Ad Victoriam, soldier. The Brotherhood stands ready.',
      icon:'bos'
    },
    ncr:{
      key:'ncr',
      label:'NCR',
      logo:'NEW CALIFORNIA REPUBLIC',
      accent:'#c8a060',
      accentDim:'#4a3018',
      bg:'#0e0c08',
      surface:'#181410',
      surface2:'#201a14',
      border:'#3a2e20',
      text:'#e0d0b0',
      muted:'#806040',
      green:'#80b040',
      amber:'#c8a060',
      red:'#c05030',
      blue:'#6080a0',
      mono:"'Special Elite','Courier New',monospace",
      sans:"'Special Elite','Courier New',monospace",
      scanlines:false,
      boot:'NCR systems online. The Republic will bring order to the wasteland.',
      icon:'ncr'
    }
  };

  var currentTheme='none';
  var color=THEMES.pipboy.accent;
  var scanlines=50;

  // ── Orb canvas state ──────────────────────────────────────
  var orbAngle=0;
  var orbRafId=null;
  var orbLastTime=0;
  var orbCanvas=null;
  var orbCtx=null;
  var _lastDraw=0;
  var _FPS=1000/30;

  var SPIN={idle:0.15,listening:1.8,speaking:1.0,thinking:2.5};

  // ── Google Fonts loader ───────────────────────────────────
  var _loadedFonts={};
  function _loadFont(url){
    if(_loadedFonts[url])return;
    _loadedFonts[url]=true;
    var l=document.createElement('link');
    l.rel='link';l.rel='stylesheet';l.href=url;
    document.head.appendChild(l);
  }
  function _ensureThemeFonts(themeKey){
    if(themeKey==='enclave')_loadFont('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
    if(themeKey==='bos')_loadFont('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');
    if(themeKey==='ncr')_loadFont('https://fonts.googleapis.com/css2?family=Special+Elite&display=swap');
    if(themeKey==='pipboy')_loadFont('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
  }

  // ── Apply theme ───────────────────────────────────────────
  function _applyTheme(key){
    var t=THEMES[key]||THEMES.none;
    var b=document.body;

    b.style.transition='background .3s,color .3s,border-color .3s';

    // Remove all theme classes
    Object.keys(THEMES).forEach(function(k){b.classList.remove('theme-'+k);});

    if(key!=='none'){
      b.classList.add('theme-'+key);
      _ensureThemeFonts(key);
    }

    // Apply CSS variables
    var vars={
      '--bg':t.bg,'--surface':t.surface,'--surface2':t.surface2,
      '--border':t.border,'--accent':t.accent,'--accent-dim':t.accentDim,
      '--text':t.text,'--muted':t.muted,'--green':t.green,
      '--amber':t.amber,'--red':t.red,'--blue':t.blue,
      '--mono':t.mono,'--sans':t.sans
    };
    Object.keys(vars).forEach(function(v){b.style.setProperty(v,vars[v]);});

    // Scanlines (Pip-Boy only)
    if(t.scanlines){
      b.style.setProperty('--fo-scanline-opacity',((t.scanOpacity||50)/100*0.18).toFixed(3));
      b.classList.add('fallout-scanlines');
    }else{
      b.classList.remove('fallout-scanlines');
      b.style.setProperty('--fo-scanline-opacity','0');
    }

    // fo-color for pipboy scanline tint
    b.style.setProperty('--fo-color',t.accent);

    // Nav logo
    var logo=document.querySelector('.nav-logo');
    if(logo)logo.textContent=t.logo;

    // Orb panel label
    var orbLbl=document.getElementById('orb-panel-label');
    if(orbLbl)orbLbl.textContent=t.logo;

    // Panel borders + box shadow for all named panels
    _updatePanelStyles(t);

    // Favicon
    _setFavicon(key,t.accent);

    // Orb canvas
    setTimeout(function(){b.style.transition='';},350);

    if(key==='none'){
      _hideOrbCanvas();
    }else{
      _showOrbCanvas();
      _startOrbLoop();
    }
  }

  function _updatePanelStyles(t){
    var panels=[
      'spotify-panel','calendar-panel','month-panel','vault-panel',
      'vaultchat-panel','graphui-panel','budget-panel',
      'daily-brief-panel','vault-health-panel'
    ];
    panels.forEach(function(id){
      var p=document.getElementById(id);
      if(!p)return;
      p.style.borderColor=t.accent;
      p.style.boxShadow='0 0 12px '+t.accent+'22,0 8px 32px rgba(0,0,0,.6)';
      p.style.background=t.bg.replace('#','rgba(')+',0.97)'; // fallback
      // Use CSS var instead for robustness
      p.style.background='';
    });
    // fp panels (floating panels)
    document.querySelectorAll('.fp').forEach(function(p){
      p.style.borderColor=t.accent;
      p.style.boxShadow='0 0 10px '+t.accent+'18,0 8px 24px rgba(0,0,0,.5)';
    });
    var nav=document.getElementById('status-bar');
    if(nav)nav.style.borderTopColor=t.accent;
    var navLogo=document.querySelector('.nav-logo');
    if(navLogo){
      navLogo.style.color=t.accent;
      navLogo.style.borderColor=t.accent;
      navLogo.style.textShadow='0 0 8px '+t.accent+'88';
    }
    // Active hbtn
    document.querySelectorAll('.hbtn.on').forEach(function(btn){
      btn.style.color=t.accent;
      btn.style.borderColor=t.accent;
    });
  }

  // ── Favicon ───────────────────────────────────────────────
  function _setFavicon(themeKey,accentColor){
    var icons={
      none:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0f0f10"/><text x="16" y="22" font-family="monospace" font-size="14" font-weight="bold" fill="#7c6af7" text-anchor="middle">B</text></svg>',
      pipboy:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#060a06"/><circle cx="16" cy="16" r="11" fill="none" stroke="#39ff14" stroke-width="2"/><circle cx="16" cy="16" r="6" fill="none" stroke="#39ff14" stroke-width="1.5"/><text x="16" y="20" font-family="monospace" font-size="9" font-weight="bold" fill="#39ff14" text-anchor="middle">111</text></svg>',
      vaulttec:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0a0c14"/><circle cx="16" cy="16" r="11" fill="#0e1220" stroke="#f5c400" stroke-width="2"/><text x="16" y="14" font-family="sans-serif" font-size="6" font-weight="bold" fill="#f5c400" text-anchor="middle">VAULT</text><text x="16" y="22" font-family="sans-serif" font-size="6" font-weight="bold" fill="#f5c400" text-anchor="middle">TEC</text></svg>',
      enclave:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0a0808"/><path d="M16 4 L28 10 L28 22 L16 28 L4 22 L4 10 Z" fill="#140c0c" stroke="#cc2200" stroke-width="1.5"/><text x="16" y="20" font-family="monospace" font-size="9" font-weight="bold" fill="#cc2200" text-anchor="middle">E</text></svg>',
      bos:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#080a0c"/><circle cx="16" cy="16" r="11" fill="#0e1216" stroke="#c8a040" stroke-width="2"/><line x1="16" y1="5" x2="16" y2="27" stroke="#c8a040" stroke-width="2"/><line x1="5" y1="16" x2="27" y2="16" stroke="#c8a040" stroke-width="1.5" opacity="0.6"/></svg>',
      ncr:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0e0c08"/><rect x="4" y="8" width="24" height="16" rx="2" fill="#181410" stroke="#c8a060" stroke-width="1.5"/><text x="16" y="20" font-family="monospace" font-size="8" font-weight="bold" fill="#c8a060" text-anchor="middle">NCR</text></svg>'
    };
    var svg=icons[themeKey]||icons.none;
    var url='data:image/svg+xml;base64,'+btoa(svg);
    var link=document.querySelector("link[rel='icon']");
    if(link)link.href=url;
  }

  // ── Orb canvas ────────────────────────────────────────────
  function _createOrbCanvas(){
    if(document.getElementById('faction-orb-canvas'))return;
    var c=document.createElement('canvas');
    c.id='faction-orb-canvas';
    c.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;display:none;cursor:pointer;z-index:3';
    c.addEventListener('click',function(){if(typeof handleOrbClick==='function')handleOrbClick();});
    c.addEventListener('dblclick',function(e){e.stopPropagation();if(typeof toggleMusicMode==='function')toggleMusicMode();});
    var orbBody=document.querySelector('#orb-panel .fp-body');
    if(orbBody)orbBody.appendChild(c);
    orbCanvas=c;
  }

  function _showOrbCanvas(){
    _createOrbCanvas();
    if(orbMusicMode)return;
    var orbC=document.getElementById('orb-canvas');
    var recC=document.getElementById('record-canvas');
    if(orbC)orbC.style.display='none';
    if(recC)recC.style.display='none';
    if(orbCanvas)orbCanvas.style.display='block';
  }

  function _hideOrbCanvas(){
    if(orbCanvas)orbCanvas.style.display='none';
    var orbC=document.getElementById('orb-canvas');
    if(orbC&&!orbMusicMode)orbC.style.display='block';
  }

  // ── Draw dispatch ─────────────────────────────────────────
  function _drawOrb(){
    if(!orbCanvas)return;
    var W=orbCanvas.offsetWidth,H=orbCanvas.offsetHeight;
    if(!W||!H)return;
    if(orbCanvas.width!==W||orbCanvas.height!==H){orbCanvas.width=W;orbCanvas.height=H;orbCtx=null;}
    if(!orbCtx)orbCtx=orbCanvas.getContext('2d');
    var t=THEMES[currentTheme]||THEMES.none;
    var col=t.accent;
    orbCtx.clearRect(0,0,W,H);
    if(currentTheme==='pipboy'||currentTheme==='none')_drawVaultDoor(orbCtx,W,H,col);
    else if(currentTheme==='vaulttec')_drawVaultTec(orbCtx,W,H,col);
    else if(currentTheme==='enclave')_drawEnclave(orbCtx,W,H,col);
    else if(currentTheme==='bos')_drawBoS(orbCtx,W,H,col);
    else if(currentTheme==='ncr')_drawNCR(orbCtx,W,H,col);
  }

  // ── Vault door (Pip-Boy) ──────────────────────────────────
  function _drawVaultDoor(ctx,W,H,col){
    var cx=W/2,cy=H/2,R=Math.min(W,H)/2-10;
    ctx.save();ctx.shadowColor=col;ctx.shadowBlur=18;
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();ctx.restore();
    ctx.save();ctx.translate(cx,cy);ctx.rotate(orbAngle);
    ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);
    ctx.fillStyle='#0a0a0b';ctx.fill();
    ctx.strokeStyle=col;ctx.lineWidth=3;ctx.stroke();
    var TEETH=12,TOOTH_H=R*0.12;
    for(var i=0;i<TEETH;i++){
      var ba=(i/TEETH)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ba-0.18)*(R-2),Math.sin(ba-0.18)*(R-2));
      ctx.lineTo(Math.cos(ba-0.11)*(R+TOOTH_H),Math.sin(ba-0.11)*(R+TOOTH_H));
      ctx.lineTo(Math.cos(ba+0.11)*(R+TOOTH_H),Math.sin(ba+0.11)*(R+TOOTH_H));
      ctx.lineTo(Math.cos(ba+0.18)*(R-2),Math.sin(ba+0.18)*(R-2));
      ctx.closePath();ctx.fillStyle=col;ctx.fill();
    }
    ctx.beginPath();ctx.arc(0,0,R*0.92,0,Math.PI*2);
    ctx.strokeStyle=col;ctx.lineWidth=4;ctx.globalAlpha=0.4;ctx.stroke();ctx.globalAlpha=1;
    ctx.beginPath();ctx.arc(0,0,R*0.78,0,Math.PI*2);
    ctx.fillStyle='#0d0d0e';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.stroke();
    for(var s=0;s<6;s++){
      var sa=(s/6)*Math.PI*2;
      ctx.beginPath();ctx.moveTo(Math.cos(sa)*R*0.22,Math.sin(sa)*R*0.22);
      ctx.lineTo(Math.cos(sa)*R*0.76,Math.sin(sa)*R*0.76);
      ctx.strokeStyle=col;ctx.lineWidth=2;ctx.globalAlpha=0.5;ctx.stroke();ctx.globalAlpha=1;
    }
    for(var rv=0;rv<8;rv++){
      var ra=(rv/8)*Math.PI*2;
      ctx.beginPath();ctx.arc(Math.cos(ra)*R*0.68,Math.sin(ra)*R*0.68,R*0.028,0,Math.PI*2);
      ctx.fillStyle='#0a0a0b';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.stroke();
    }
    ctx.beginPath();ctx.arc(0,0,R*0.38,0,Math.PI*2);
    ctx.fillStyle='#0a0a0b';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();
    ctx.restore();
    ctx.save();ctx.shadowColor=col;ctx.shadowBlur=12;
    ctx.font='bold '+Math.round(R*0.32)+'px "Courier Prime","Courier New",monospace';
    ctx.fillStyle=col;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('111',cx,cy);ctx.restore();
    var state=window.orbState||'idle';
    if(state!=='idle'){
      var pulse=0.5+0.5*Math.abs(Math.sin(Date.now()/300));
      ctx.save();ctx.globalAlpha=pulse*0.4;ctx.shadowColor=col;ctx.shadowBlur=20;
      ctx.beginPath();ctx.arc(cx,cy,R+14,0,Math.PI*2);
      ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();ctx.restore();
    }
  }

  // ── Vault-Tec emblem ──────────────────────────────────────
  function _drawVaultTec(ctx,W,H,col){
    var cx=W/2,cy=H/2,R=Math.min(W,H)/2-10;
    var blue='#4a9eff', yellow=col;
    ctx.save();ctx.shadowColor=yellow;ctx.shadowBlur=16;
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle=yellow;ctx.lineWidth=3;ctx.stroke();ctx.restore();
    // Outer ring
    ctx.save();ctx.translate(cx,cy);ctx.rotate(orbAngle*0.3);
    ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);
    ctx.fillStyle='#0e1220';ctx.fill();
    // Blue/yellow split ring
    ctx.beginPath();ctx.arc(0,0,R*0.9,0,Math.PI*2);
    ctx.strokeStyle=blue;ctx.lineWidth=R*0.08;ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,R*0.9,-Math.PI/2,Math.PI/2);
    ctx.strokeStyle=yellow;ctx.lineWidth=R*0.08;ctx.stroke();
    // Tick marks
    for(var i=0;i<12;i++){
      var a=(i/12)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*R*0.82,Math.sin(a)*R*0.82);
      ctx.lineTo(Math.cos(a)*R*0.75,Math.sin(a)*R*0.75);
      ctx.strokeStyle=i%3===0?yellow:blue;ctx.lineWidth=2;ctx.stroke();
    }
    ctx.restore();
    // Inner vault door — counter-rotates
    ctx.save();ctx.translate(cx,cy);ctx.rotate(-orbAngle*0.5);
    ctx.beginPath();ctx.arc(0,0,R*0.62,0,Math.PI*2);
    ctx.fillStyle='#0a0c14';ctx.fill();ctx.strokeStyle=yellow;ctx.lineWidth=2;ctx.stroke();
    // Vault-Tec V shape
    ctx.beginPath();
    ctx.moveTo(-R*0.25,-R*0.18);ctx.lineTo(0,R*0.18);ctx.lineTo(R*0.25,-R*0.18);
    ctx.strokeStyle=yellow;ctx.lineWidth=R*0.07;ctx.lineJoin='round';
    ctx.lineCap='round';ctx.stroke();
    // Spokes
    for(var s=0;s<6;s++){
      var sa=(s/6)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa)*R*0.15,Math.sin(sa)*R*0.15);
      ctx.lineTo(Math.cos(sa)*R*0.58,Math.sin(sa)*R*0.58);
      ctx.strokeStyle=blue;ctx.lineWidth=1;ctx.globalAlpha=0.5;ctx.stroke();ctx.globalAlpha=1;
    }
    ctx.restore();
    // Center hub
    ctx.save();ctx.translate(cx,cy);
    ctx.beginPath();ctx.arc(0,0,R*0.22,0,Math.PI*2);
    ctx.fillStyle=yellow;ctx.fill();
    ctx.font='bold '+Math.round(R*0.18)+'px "IBM Plex Mono",monospace';
    ctx.fillStyle='#0a0c14';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('VT',0,0);ctx.restore();
    _drawStateRing(ctx,cx,cy,R,yellow);
  }

  // ── Enclave sigil ─────────────────────────────────────────
  function _drawEnclave(ctx,W,H,col){
    var cx=W/2,cy=H/2,R=Math.min(W,H)/2-10;
    ctx.save();ctx.shadowColor=col;ctx.shadowBlur=20;
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();ctx.restore();
    // Dark background
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.fillStyle='#0a0808';ctx.fill();
    // Rotating outer hex ring
    ctx.save();ctx.translate(cx,cy);ctx.rotate(orbAngle*0.2);
    var SIDES=6;
    ctx.beginPath();
    for(var i=0;i<=SIDES;i++){
      var a=(i/SIDES)*Math.PI*2-Math.PI/6;
      if(i===0)ctx.moveTo(Math.cos(a)*R*0.95,Math.sin(a)*R*0.95);
      else ctx.lineTo(Math.cos(a)*R*0.95,Math.sin(a)*R*0.95);
    }
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.globalAlpha=0.6;ctx.stroke();ctx.globalAlpha=1;
    // Tick marks on hex
    for(var t2=0;t2<18;t2++){
      var ta=(t2/18)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ta)*R*0.88,Math.sin(ta)*R*0.88);
      ctx.lineTo(Math.cos(ta)*R*R*0.82/R,Math.sin(ta)*R*0.82);
      ctx.strokeStyle=col;ctx.lineWidth=1;ctx.globalAlpha=0.4;ctx.stroke();ctx.globalAlpha=1;
    }
    ctx.restore();
    // Inner circle — counter rotates
    ctx.save();ctx.translate(cx,cy);ctx.rotate(-orbAngle*0.3);
    ctx.beginPath();ctx.arc(0,0,R*0.7,0,Math.PI*2);
    ctx.fillStyle='#140c0c';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();
    // Eagle wings — simplified
    var ew=R*0.55,eh=R*0.25;
    // Left wing
    ctx.beginPath();ctx.moveTo(0,-R*0.05);
    ctx.bezierCurveTo(-ew*0.3,-eh,-ew*0.7,-eh*0.5,-ew,-R*0.02);
    ctx.bezierCurveTo(-ew*0.6,eh*0.3,-ew*0.3,eh*0.1,0,R*0.1);
    ctx.fillStyle=col;ctx.globalAlpha=0.85;ctx.fill();ctx.globalAlpha=1;
    // Right wing
    ctx.beginPath();ctx.moveTo(0,-R*0.05);
    ctx.bezierCurveTo(ew*0.3,-eh,ew*0.7,-eh*0.5,ew,-R*0.02);
    ctx.bezierCurveTo(ew*0.6,eh*0.3,ew*0.3,eh*0.1,0,R*0.1);
    ctx.fillStyle=col;ctx.globalAlpha=0.85;ctx.fill();ctx.globalAlpha=1;
    ctx.restore();
    // Center hub - E
    ctx.save();ctx.translate(cx,cy);
    ctx.beginPath();ctx.arc(0,0,R*0.28,0,Math.PI*2);
    ctx.fillStyle='#0a0808';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();
    ctx.font='bold '+Math.round(R*0.26)+'px "Share Tech Mono","Courier New",monospace';
    ctx.fillStyle=col;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor=col;ctx.shadowBlur=8;
    ctx.fillText('E',0,0);ctx.restore();
    _drawStateRing(ctx,cx,cy,R,col);
  }

  // ── Brotherhood of Steel ──────────────────────────────────
  function _drawBoS(ctx,W,H,col){
    var cx=W/2,cy=H/2,R=Math.min(W,H)/2-10;
    ctx.save();ctx.shadowColor=col;ctx.shadowBlur=16;
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();ctx.restore();
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.fillStyle='#080a0c';ctx.fill();
    // Outer gear ring — slow rotation
    ctx.save();ctx.translate(cx,cy);ctx.rotate(orbAngle*0.4);
    var TEETH=18;
    for(var i=0;i<TEETH;i++){
      var ba=(i/TEETH)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ba-0.12)*(R*0.92),Math.sin(ba-0.12)*(R*0.92));
      ctx.lineTo(Math.cos(ba-0.08)*(R),Math.sin(ba-0.08)*(R));
      ctx.lineTo(Math.cos(ba+0.08)*(R),Math.sin(ba+0.08)*(R));
      ctx.lineTo(Math.cos(ba+0.12)*(R*0.92),Math.sin(ba+0.12)*(R*0.92));
      ctx.closePath();ctx.fillStyle=col;ctx.fill();
    }
    ctx.beginPath();ctx.arc(0,0,R*0.88,0,Math.PI*2);
    ctx.strokeStyle=col;ctx.lineWidth=3;ctx.stroke();
    ctx.restore();
    // Inner plate
    ctx.save();ctx.translate(cx,cy);ctx.rotate(-orbAngle*0.15);
    ctx.beginPath();ctx.arc(0,0,R*0.75,0,Math.PI*2);
    ctx.fillStyle='#0e1216';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();
    // Cross of the Brotherhood
    var arm=R*0.55,thick=R*0.1;
    ctx.fillStyle=col;ctx.globalAlpha=0.9;
    // Vertical
    ctx.fillRect(-thick/2,-arm,thick,arm*2);
    // Horizontal
    ctx.fillRect(-arm,-thick/2,arm*2,thick);
    ctx.globalAlpha=1;
    // Circle at center of cross
    ctx.beginPath();ctx.arc(0,0,R*0.2,0,Math.PI*2);
    ctx.fillStyle='#080a0c';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();
    ctx.restore();
    // BoS text center
    ctx.save();ctx.translate(cx,cy);
    ctx.font='bold '+Math.round(R*0.2)+'px serif';
    ctx.fillStyle=col;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor=col;ctx.shadowBlur=8;
    ctx.fillText('BoS',0,0);ctx.restore();
    _drawStateRing(ctx,cx,cy,R,col);
  }

  // ── NCR emblem ────────────────────────────────────────────
  function _drawNCR(ctx,W,H,col){
    var cx=W/2,cy=H/2,R=Math.min(W,H)/2-10;
    ctx.save();ctx.shadowColor=col;ctx.shadowBlur=14;
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();ctx.restore();
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.fillStyle='#0e0c08';ctx.fill();
    // Flag shape — slow wave via rotation
    ctx.save();ctx.translate(cx,cy);ctx.rotate(orbAngle*0.15);
    // Outer decorative ring
    ctx.beginPath();ctx.arc(0,0,R*0.92,0,Math.PI*2);
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.globalAlpha=0.5;ctx.stroke();ctx.globalAlpha=1;
    // Rope/laurel detail — small dots
    for(var i=0;i<24;i++){
      var a=(i/24)*Math.PI*2;
      ctx.beginPath();ctx.arc(Math.cos(a)*R*0.84,Math.sin(a)*R*0.84,R*0.025,0,Math.PI*2);
      ctx.fillStyle=col;ctx.globalAlpha=0.5;ctx.fill();ctx.globalAlpha=1;
    }
    ctx.restore();
    // Inner circle
    ctx.save();ctx.translate(cx,cy);ctx.rotate(-orbAngle*0.1);
    ctx.beginPath();ctx.arc(0,0,R*0.68,0,Math.PI*2);
    ctx.fillStyle='#181410';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();
    // Bear silhouette — simplified geometric
    var bR=R*0.35;
    // Body
    ctx.beginPath();ctx.ellipse(0,R*0.08,bR*0.55,bR*0.45,0,0,Math.PI*2);
    ctx.fillStyle=col;ctx.globalAlpha=0.8;ctx.fill();ctx.globalAlpha=1;
    // Head
    ctx.beginPath();ctx.arc(0,-bR*0.18,bR*0.3,0,Math.PI*2);
    ctx.fillStyle=col;ctx.globalAlpha=0.8;ctx.fill();ctx.globalAlpha=1;
    // Ears
    ctx.beginPath();ctx.arc(-bR*0.2,-bR*0.42,bR*0.1,0,Math.PI*2);
    ctx.fillStyle=col;ctx.fill();
    ctx.beginPath();ctx.arc(bR*0.2,-bR*0.42,bR*0.1,0,Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=1;
    ctx.restore();
    // NCR text bottom
    ctx.save();ctx.translate(cx,cy+R*0.55);
    ctx.font='bold '+Math.round(R*0.18)+'px "Special Elite","Courier New",monospace';
    ctx.fillStyle=col;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor=col;ctx.shadowBlur=6;
    ctx.fillText('NCR',0,0);ctx.restore();
    _drawStateRing(ctx,cx,cy,R,col);
  }

  // ── Shared state ring ─────────────────────────────────────
  function _drawStateRing(ctx,cx,cy,R,col){
    var state=window.orbState||'idle';
    if(state!=='idle'){
      var pulse=0.5+0.5*Math.abs(Math.sin(Date.now()/300));
      ctx.save();ctx.globalAlpha=pulse*0.4;ctx.shadowColor=col;ctx.shadowBlur=20;
      ctx.beginPath();ctx.arc(cx,cy,R+14,0,Math.PI*2);
      ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();ctx.restore();
    }
  }

  // ── RAF loop ──────────────────────────────────────────────
  function _startOrbLoop(){
    if(orbRafId)return;
    orbLastTime=performance.now();
    function frame(now){
      if(currentTheme==='none'){orbRafId=null;return;}
      orbRafId=requestAnimationFrame(frame);
      if(now-_lastDraw<_FPS)return;
      _lastDraw=now;
      var dt=(now-orbLastTime)/1000;
      orbLastTime=now;
      var speed=SPIN[window.orbState||'idle']||SPIN.idle;
      orbAngle+=speed*dt;
      if(orbCanvas&&orbCanvas.style.display!=='none')_drawOrb();
    }
    orbRafId=requestAnimationFrame(frame);
  }
  function _stopOrbLoop(){
    if(orbRafId){cancelAnimationFrame(orbRafId);orbRafId=null;}
  }

  // ── Set theme (public) ────────────────────────────────────
  function setTheme(key){
    if(!THEMES[key])key='none';
    var prev=currentTheme;
    currentTheme=key;
    localStorage.setItem(LS_THEME,key);

    if(key==='none'){
      _stopOrbLoop();
      _hideOrbCanvas();
      // Restore default CSS vars
      _applyTheme('none');
    }else{
      _applyTheme(key);
    }

    // Update settings UI
    _updateSettingsUI();

    // Speak boot line
    var t=THEMES[key];
    if(t&&t.boot&&key!==prev&&typeof speakResponse==='function'){
      setTimeout(function(){speakResponse(t.boot);},400);
    }
  }

  // ── Voice command ─────────────────────────────────────────
  function handleVoiceTheme(cmd){
    var c=cmd.toLowerCase();
    if(/pip.?boy|fallout mode|green mode/.test(c)){setTheme('pipboy');return'Pip-Boy mode activated, sir.';}
    if(/vault.?tec|overseer/.test(c)){setTheme('vaulttec');return'Vault-Tec interface online, Overseer.';}
    if(/enclave/.test(c)){setTheme('enclave');return'Enclave Command online, sir.';}
    if(/brotherhood|b.?o.?s|ad victoriam/.test(c)){setTheme('bos');return'Brotherhood interface activated. Ad Victoriam.';}
    if(/ncr|new california/.test(c)){setTheme('ncr');return'NCR systems online, sir.';}
    if(/default theme|normal mode|reset theme|no theme/.test(c)){setTheme('none');return'Returning to default interface, sir.';}
    return null;
  }

  // ── Settings UI ───────────────────────────────────────────
  function injectSettingsSection(){
    var sec=document.getElementById('fo-settings-section');
    if(!sec){
      sec=document.createElement('div');
      sec.id='fo-settings-section';
      var modal=document.querySelector('.modal');
      if(!modal)return;
      var note=modal.querySelector('.modal-note');
      if(note)modal.insertBefore(sec,note);
      else modal.appendChild(sec);
    }
    sec.className='sp-set-sep';

    var optionsHtml=Object.keys(THEMES).map(function(k){
      var t=THEMES[k];
      return '<option value="'+k+'"'+(k===currentTheme?' selected':'')+'>'+t.label+'</option>';
    }).join('');

    sec.innerHTML=
      '<div class="sp-set-hd">&#9762; Fallout Themes</div>'+
      '<div class="field" style="margin-bottom:14px">'+
        '<label style="display:block;margin-bottom:6px;font-size:12px;color:var(--muted)">Active Theme</label>'+
        '<select id="fo-theme-select" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:7px 10px;font-family:var(--mono);font-size:12px;color:var(--text);outline:none;cursor:pointer">'+
          optionsHtml+
        '</select>'+
      '</div>'+
      // Scanlines (Pip-Boy only)
      '<div class="field" id="fo-scan-row" style="'+(currentTheme==='pipboy'?'':'display:none')+'">'+
        '<label>Scanline Intensity \u2014 <span id="fo-scan-val">'+(localStorage.getItem(LS_SCAN)||50)+'</span></label>'+
        '<input type="range" id="fo-scan-slider" min="0" max="100" value="'+(localStorage.getItem(LS_SCAN)||50)+'" style="width:100%;accent-color:var(--accent);margin-top:6px">'+
      '</div>';

    _bindSettingsEvents();
  }

  function _bindSettingsEvents(){
    var sel=document.getElementById('fo-theme-select');
    var scanRow=document.getElementById('fo-scan-row');
    var scan=document.getElementById('fo-scan-slider');
    var scanVal=document.getElementById('fo-scan-val');

    if(sel)sel.addEventListener('change',function(){
      setTheme(this.value);
      if(scanRow)scanRow.style.display=(this.value==='pipboy'?'':'none');
    });
    if(scan)scan.addEventListener('input',function(){
      var v=parseInt(this.value)||0;
      localStorage.setItem(LS_SCAN,v);
      if(scanVal)scanVal.textContent=v;
      if(currentTheme==='pipboy'){
        document.body.style.setProperty('--fo-scanline-opacity',(v/100*0.18).toFixed(3));
      }
    });
  }

  function _updateSettingsUI(){
    var sel=document.getElementById('fo-theme-select');
    if(sel)sel.value=currentTheme;
    var scanRow=document.getElementById('fo-scan-row');
    if(scanRow)scanRow.style.display=(currentTheme==='pipboy'?'':'none');
  }

  // ── Public shims for old API (hud.html calls these) ───────
  function toggle(){
    if(currentTheme==='none')setTheme('pipboy');
    else setTheme('none');
  }
  function setColor(hex){
    color=hex;localStorage.setItem(LS_COLOR,hex);
    if(currentTheme==='pipboy'){
      document.body.style.setProperty('--fo-color',hex);
      document.body.style.setProperty('--accent',hex);
    }
  }
  function setScanlines(val){
    scanlines=Math.max(0,Math.min(100,parseInt(val)||0));
    localStorage.setItem(LS_SCAN,scanlines);
    if(currentTheme==='pipboy')
      document.body.style.setProperty('--fo-scanline-opacity',(scanlines/100*0.18).toFixed(3));
  }
  function isActive(){return currentTheme!=='none';}
  function onOrbState(){}

  // ── Init ──────────────────────────────────────────────────
  function init(){
    var saved=localStorage.getItem(LS_THEME)||'none';
    color=localStorage.getItem(LS_COLOR)||THEMES.pipboy.accent;
    scanlines=parseInt(localStorage.getItem(LS_SCAN)||50);
    currentTheme='none'; // ensure clean state before apply
    if(saved!=='none')setTheme(saved);
  }

  return{
    init,toggle,setTheme,setColor,setScanlines,
    onOrbState,isActive,injectSettingsSection,
    handleVoiceTheme,
    getTheme:function(){return currentTheme;}
  };
})();
