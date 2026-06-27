// ═══════════════════════════════════════════════════════════
// ══  STRENGTH MAPS — Faction Character Body Maps  ══════════
// ═══════════════════════════════════════════════════════════
// Each faction has a unique SVG character with anatomically
// mapped muscle zones. Heat/strength values shade each zone.
// Zones are drawn as SVG paths that match the character art.
// ═══════════════════════════════════════════════════════════
var STRENGTH_MAPS=(function(){

  // ── Color helpers ─────────────────────────────────────────
  function heatColor(heat,theme,mode){
    if(heat<0.01)return'none';
    var a=Math.min(0.92,0.18+heat*0.74);
    if(mode==='strength'){
      // Strength mode: blue(low)→purple→gold(high)
      if(heat<0.33)return'rgba(96,165,250,'+a.toFixed(2)+')';
      if(heat<0.66)return'rgba(167,139,250,'+a.toFixed(2)+')';
      return'rgba(251,191,36,'+a.toFixed(2)+')';
    }
    // Soreness mode — faction colors
    var pipCol=window.BAKER_PIPBOY_COLOR||'#39ff14';
    function hexToRgb(h){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return r+','+g+','+b;}
    if(theme==='pipboy'||theme==='baker')return'rgba('+hexToRgb(pipCol)+','+a.toFixed(2)+')';
    if(theme==='enclave')return'rgba(220,40,20,'+a.toFixed(2)+')';
    if(theme==='bos')return'rgba(210,170,50,'+a.toFixed(2)+')';
    if(theme==='ncr')return'rgba(200,150,70,'+a.toFixed(2)+')';
    if(theme==='vaulttec')return'rgba(245,196,0,'+a.toFixed(2)+')';
    return'rgba(124,106,247,'+a.toFixed(2)+')';
  }

  function glowFilter(theme,id){
    var pipCol=window.BAKER_PIPBOY_COLOR||'#39ff14';
    var col=theme==='enclave'?'#dc2814':theme==='bos'?'#d2aa32':theme==='ncr'?'#c89646':theme==='vaulttec'?'#f5c400':pipCol;
    return'<defs><filter id="mg'+id+'" x="-30%" y="-30%" width="160%" height="160%">'+
      '<feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>'+
      '<feColorMatrix in="blur" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -7" result="glow"/>'+
      '<feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>'+
      '</filter>'+
      '<filter id="sg'+id+'"><feGaussianBlur stdDeviation="2"/></filter>'+
      '<radialGradient id="bg'+id+'" cx="50%" cy="50%" r="50%">'+
        '<stop offset="0%" style="stop-color:'+col+';stop-opacity:0.08"/>'+
        '<stop offset="100%" style="stop-color:'+col+';stop-opacity:0"/>'+
      '</radialGradient></defs>';
  }

  // ══════════════════════════════════════════════════════════
  // HUMAN / PIP-BOY — detailed cartoon human with muscle zones
  // ══════════════════════════════════════════════════════════
  function renderHuman(heat,theme,mode,w,h){
    w=w||200;h=h||380;
    var id='h'+Date.now().toString(36);
    var c=heat,pip=window.BAKER_PIPBOY_COLOR||'#39ff14';
    var lc=theme==='pipboy'?pip:'#7c6af7';  // line color
    var skin=theme==='pipboy'?'none':'rgba(200,160,120,0.15)';
    var outline=theme==='pipboy'?pip:'rgba(255,255,255,0.25)';

    function z(m){return heatColor(c(m),theme,mode);}
    function zo(m){return c(m)>0.01?'url(#mg'+id+')':'none';}

    return'<svg viewBox="0 0 200 380" xmlns="http://www.w3.org/2000/svg" style="width:'+w+'px;height:'+h+'px">'+
    glowFilter(theme,id)+
    // ── BACKGROUND ───────────────────────────────────────────
    '<rect width="200" height="380" fill="url(#bg'+id+')"/>'+

    // ── HEAD ─────────────────────────────────────────────────
    '<ellipse cx="100" cy="42" rx="22" ry="26" fill="'+skin+'" stroke="'+outline+'" stroke-width="1.2"/>'+
    // face features
    '<ellipse cx="91" cy="37" rx="5" ry="6" fill="rgba(0,0,0,0.3)"/>'+
    '<ellipse cx="109" cy="37" rx="5" ry="6" fill="rgba(0,0,0,0.3)"/>'+
    '<ellipse cx="92" cy="36" rx="3" ry="3.5" fill="'+lc+'" opacity="0.9"/>'+
    '<ellipse cx="110" cy="36" rx="3" ry="3.5" fill="'+lc+'" opacity="0.9"/>'+
    '<path d="M92 52 Q100 57 108 52" stroke="'+lc+'" stroke-width="1.5" fill="none" opacity="0.8"/>'+
    // hair
    '<path d="M78 30 Q80 15 100 12 Q120 15 122 30" fill="rgba(80,50,20,0.5)" stroke="none"/>'+

    // ── NECK ─────────────────────────────────────────────────
    '<rect x="94" y="66" width="12" height="14" rx="4" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.8"/>'+

    // ── TORSO ────────────────────────────────────────────────
    // Chest — left & right pec
    '<path d="M76 82 Q68 88 66 105 Q66 118 76 122 Q88 126 96 118 Q100 112 100 105 Q100 92 94 82 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.8"/>'+
    '<path d="M124 82 Q132 88 134 105 Q134 118 124 122 Q112 126 104 118 Q100 112 100 105 Q100 92 106 82 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.8"/>'+
    // Chest muscle overlay
    '<path d="M76 82 Q68 88 66 105 Q66 118 76 122 Q88 126 96 118 Q100 112 100 105 Q100 92 94 82 Z" fill="'+z('chest')+'" filter="'+zo('chest')+'" opacity="0.85"/>'+
    '<path d="M124 82 Q132 88 134 105 Q134 118 124 122 Q112 126 104 118 Q100 112 100 105 Q100 92 106 82 Z" fill="'+z('chest')+'" filter="'+zo('chest')+'" opacity="0.85"/>'+
    // Sternum line
    '<line x1="100" y1="82" x2="100" y2="126" stroke="'+outline+'" stroke-width="0.6" opacity="0.5"/>'+

    // ── SHOULDERS & DELTS ─────────────────────────────────────
    // Front delts
    '<ellipse cx="68" cy="86" rx="10" ry="13" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.8"/>'+
    '<ellipse cx="132" cy="86" rx="10" ry="13" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.8"/>'+
    '<ellipse cx="68" cy="86" rx="10" ry="13" fill="'+z('front-delts')+'" filter="'+zo('front-delts')+'" opacity="0.85"/>'+
    '<ellipse cx="132" cy="86" rx="10" ry="13" fill="'+z('front-delts')+'" filter="'+zo('front-delts')+'" opacity="0.85"/>'+
    // Side delts
    '<ellipse cx="56" cy="90" rx="8" ry="11" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.7"/>'+
    '<ellipse cx="144" cy="90" rx="8" ry="11" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.7"/>'+
    '<ellipse cx="56" cy="90" rx="8" ry="11" fill="'+z('side-delts')+'" filter="'+zo('side-delts')+'" opacity="0.8"/>'+
    '<ellipse cx="144" cy="90" rx="8" ry="11" fill="'+z('side-delts')+'" filter="'+zo('side-delts')+'" opacity="0.8"/>'+
    // Traps
    '<path d="M78 80 Q100 72 122 80 Q116 90 100 86 Q84 90 78 80 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.7"/>'+
    '<path d="M78 80 Q100 72 122 80 Q116 90 100 86 Q84 90 78 80 Z" fill="'+z('traps')+'" filter="'+zo('traps')+'" opacity="0.85"/>'+

    // ── UPPER ARMS ───────────────────────────────────────────
    // Biceps L/R
    '<path d="M47 100 Q38 108 38 128 Q38 144 47 148 Q56 150 60 140 Q64 128 60 108 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.8"/>'+
    '<path d="M47 100 Q38 108 38 128 Q38 144 47 148 Q56 150 60 140 Q64 128 60 108 Z" fill="'+z('biceps')+'" filter="'+zo('biceps')+'" opacity="0.85"/>'+
    '<path d="M153 100 Q162 108 162 128 Q162 144 153 148 Q144 150 140 140 Q136 128 140 108 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.8"/>'+
    '<path d="M153 100 Q162 108 162 128 Q162 144 153 148 Q144 150 140 140 Q136 128 140 108 Z" fill="'+z('biceps')+'" filter="'+zo('biceps')+'" opacity="0.85"/>'+
    // Triceps L/R
    '<path d="M47 102 Q36 112 36 130 Q36 146 45 150 Q38 140 40 120 Q42 110 48 104 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.6" opacity="0.7"/>'+
    '<path d="M47 102 Q36 112 36 130 Q36 146 45 150 Q38 140 40 120 Q42 110 48 104 Z" fill="'+z('triceps')+'" filter="'+zo('triceps')+'" opacity="0.75"/>'+
    '<path d="M153 102 Q164 112 164 130 Q164 146 155 150 Q162 140 160 120 Q158 110 152 104 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.6" opacity="0.7"/>'+
    '<path d="M153 102 Q164 112 164 130 Q164 146 155 150 Q162 140 160 120 Q158 110 152 104 Z" fill="'+z('triceps')+'" filter="'+zo('triceps')+'" opacity="0.75"/>'+

    // ── FOREARMS ─────────────────────────────────────────────
    '<path d="M42 150 Q34 158 35 180 Q36 196 44 200 Q52 202 56 192 Q60 176 56 156 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.7"/>'+
    '<path d="M42 150 Q34 158 35 180 Q36 196 44 200 Q52 202 56 192 Q60 176 56 156 Z" fill="'+z('forearms')+'" filter="'+zo('forearms')+'" opacity="0.8"/>'+
    '<path d="M158 150 Q166 158 165 180 Q164 196 156 200 Q148 202 144 192 Q140 176 144 156 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.7"/>'+
    '<path d="M158 150 Q166 158 165 180 Q164 196 156 200 Q148 202 144 192 Q140 176 144 156 Z" fill="'+z('forearms')+'" filter="'+zo('forearms')+'" opacity="0.8"/>'+

    // ── ABS & CORE ───────────────────────────────────────────
    // Abs 6-pack grid
    '<rect x="87" y="126" width="26" height="46" rx="6" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.8"/>'+
    '<rect x="87" y="126" width="26" height="46" rx="6" fill="'+z('abs')+'" filter="'+zo('abs')+'" opacity="0.85"/>'+
    // Grid lines
    '<line x1="87" y1="141" x2="113" y2="141" stroke="'+outline+'" stroke-width="0.5" opacity="0.4"/>'+
    '<line x1="87" y1="157" x2="113" y2="157" stroke="'+outline+'" stroke-width="0.5" opacity="0.4"/>'+
    '<line x1="100" y1="126" x2="100" y2="172" stroke="'+outline+'" stroke-width="0.5" opacity="0.4"/>'+
    // Obliques
    '<path d="M72 118 Q68 128 70 145 Q72 158 80 162 Q86 158 87 145 Q86 132 82 120 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.7"/>'+
    '<path d="M72 118 Q68 128 70 145 Q72 158 80 162 Q86 158 87 145 Q86 132 82 120 Z" fill="'+z('obliques')+'" filter="'+zo('obliques')+'" opacity="0.8"/>'+
    '<path d="M128 118 Q132 128 130 145 Q128 158 120 162 Q114 158 113 145 Q114 132 118 120 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.7"/>'+
    '<path d="M128 118 Q132 128 130 145 Q128 158 120 162 Q114 158 113 145 Q114 132 118 120 Z" fill="'+z('obliques')+'" filter="'+zo('obliques')+'" opacity="0.8"/>'+

    // ── HIPS & PELVIS ────────────────────────────────────────
    '<path d="M72 168 Q68 175 70 185 L130 185 Q132 175 128 168 Q114 172 100 172 Q86 172 72 168 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.7"/>'+

    // ── QUADS ────────────────────────────────────────────────
    '<path d="M72 185 Q62 195 60 225 Q58 250 66 262 Q74 270 82 266 Q90 258 90 240 Q92 215 86 190 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.8"/>'+
    '<path d="M72 185 Q62 195 60 225 Q58 250 66 262 Q74 270 82 266 Q90 258 90 240 Q92 215 86 190 Z" fill="'+z('quads')+'" filter="'+zo('quads')+'" opacity="0.85"/>'+
    '<path d="M128 185 Q138 195 140 225 Q142 250 134 262 Q126 270 118 266 Q110 258 110 240 Q108 215 114 190 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.8"/>'+
    '<path d="M128 185 Q138 195 140 225 Q142 250 134 262 Q126 270 118 266 Q110 258 110 240 Q108 215 114 190 Z" fill="'+z('quads')+'" filter="'+zo('quads')+'" opacity="0.85"/>'+

    // ── HAMSTRINGS (visible at sides) ────────────────────────
    '<path d="M60 195 Q52 210 54 240 Q56 258 64 264 Q60 250 62 228 Q64 210 68 198 Z" fill="'+z('hamstrings')+'" filter="'+zo('hamstrings')+'" opacity="0.6"/>'+
    '<path d="M140 195 Q148 210 146 240 Q144 258 136 264 Q140 250 138 228 Q136 210 132 198 Z" fill="'+z('hamstrings')+'" filter="'+zo('hamstrings')+'" opacity="0.6"/>'+

    // ── CALVES ───────────────────────────────────────────────
    '<path d="M62 266 Q55 278 57 308 Q58 326 66 332 Q74 334 78 326 Q82 312 80 290 Q78 272 70 266 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.7"/>'+
    '<path d="M62 266 Q55 278 57 308 Q58 326 66 332 Q74 334 78 326 Q82 312 80 290 Q78 272 70 266 Z" fill="'+z('calves')+'" filter="'+zo('calves')+'" opacity="0.85"/>'+
    '<path d="M138 266 Q145 278 143 308 Q142 326 134 332 Q126 334 122 326 Q118 312 120 290 Q122 272 130 266 Z" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.7"/>'+
    '<path d="M138 266 Q145 278 143 308 Q142 326 134 332 Q126 334 122 326 Q118 312 120 290 Q122 272 130 266 Z" fill="'+z('calves')+'" filter="'+zo('calves')+'" opacity="0.85"/>'+
    // Feet
    '<ellipse cx="70" cy="336" rx="12" ry="6" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.6" opacity="0.7"/>'+
    '<ellipse cx="130" cy="336" rx="12" ry="6" fill="'+skin+'" stroke="'+outline+'" stroke-width="0.6" opacity="0.7"/>'+

    // ── MUSCLE LABELS on hover zones ─────────────────────────
    (theme==='pipboy'?
    '<style>.mz:hover{opacity:1!important} .ml{display:none} .mz:hover+.ml{display:block}</style>':'')+'</svg>';
  }

  // ══════════════════════════════════════════════════════════
  // VAULT BOY — iconic cartoon style, slightly exaggerated
  // ══════════════════════════════════════════════════════════
  function renderVaultBoy(heat,mode,w,h){
    w=w||200;h=h||380;
    var id='vb'+Date.now().toString(36);
    var pip=window.BAKER_PIPBOY_COLOR||'#39ff14';
    function z(m){return heatColor(heat(m),null,mode,pip);}
    // VB is yellow-skinned cartoon: big head, thumb up pose if fresh, tired if sore
    var totalHeat=(heat('quads')+heat('chest')+heat('hamstrings')+heat('abs'))/4;
    var thumbUp=totalHeat<0.3;

    return'<svg viewBox="0 0 200 380" xmlns="http://www.w3.org/2000/svg" style="width:'+w+'px;height:'+h+'px">'+
    glowFilter('vaulttec',id)+
    '<rect width="200" height="380" fill="url(#bg'+id+')"/>'+
    // Jumpsuit body (blue)
    '<path d="M60 130 Q45 145 42 200 L42 290 Q42 300 55 300 L85 300 L85 220 L100 215 L115 220 L115 300 L145 300 Q158 300 158 290 L158 200 Q155 145 140 130 Z" fill="#1a3a8c" stroke="#2255aa" stroke-width="1.2"/>'+
    // Yellow 13 vault emblem
    '<circle cx="100" cy="175" r="18" fill="#f5c400" stroke="#c8a000" stroke-width="1"/>'+
    '<text x="100" y="181" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a3a8c" font-family="Arial">13</text>'+
    // Jumpsuit collar/stripe
    '<rect x="88" y="128" width="24" height="10" rx="2" fill="#f5c400"/>'+
    // HEAD — big cartoon head
    '<ellipse cx="100" cy="55" rx="30" ry="34" fill="#f5c400" stroke="#c8a000" stroke-width="1.2"/>'+
    // Eyes (big cartoon)
    '<ellipse cx="88" cy="45" rx="9" ry="10" fill="white"/>'+
    '<ellipse cx="112" cy="45" rx="9" ry="10" fill="white"/>'+
    '<ellipse cx="89" cy="46" rx="5" ry="6" fill="#2255aa"/>'+
    '<ellipse cx="113" cy="46" rx="5" ry="6" fill="#2255aa"/>'+
    '<ellipse cx="90" cy="45" rx="2.5" ry="3" fill="black"/>'+
    '<ellipse cx="114" cy="45" rx="2.5" ry="3" fill="black"/>'+
    // Eyebrows
    '<path d="M80 35 Q88 31 96 35" stroke="#c8a000" stroke-width="2" fill="none"/>'+
    '<path d="M104 35 Q112 31 120 35" stroke="#c8a000" stroke-width="2" fill="none"/>'+
    // Smile
    '<path d="M'+(thumbUp?'85 66 Q100 76 115 66':'88 68 Q100 64 112 68')+'" stroke="black" stroke-width="2" fill="none"/>'+
    // Cheeks
    '<circle cx="78" cy="58" r="6" fill="rgba(255,100,100,0.3)"/>'+
    '<circle cx="122" cy="58" r="6" fill="rgba(255,100,100,0.3)"/>'+
    // Hair
    '<path d="M72 32 Q78 18 100 16 Q122 18 128 32 Q116 22 100 22 Q84 22 72 32 Z" fill="#8B4513"/>'+
    // NECK
    '<rect x="93" y="87" width="14" height="12" rx="4" fill="#f5c400" stroke="#c8a000" stroke-width="0.8"/>'+
    // SHOULDERS
    '<ellipse cx="58" cy="120" rx="16" ry="18" fill="#1a3a8c" stroke="#2255aa" stroke-width="1"/>'+
    '<ellipse cx="142" cy="120" rx="16" ry="18" fill="#1a3a8c" stroke="#2255aa" stroke-width="1"/>'+
    // Muscle overlays on jumpsuit
    '<ellipse cx="82" cy="152" rx="16" ry="18" fill="'+z('chest')+'" opacity="0.7"/>'+
    '<ellipse cx="118" cy="152" rx="16" ry="18" fill="'+z('chest')+'" opacity="0.7"/>'+
    '<rect x="86" y="195" width="28" height="36" rx="5" fill="'+z('abs')+'" opacity="0.6"/>'+
    // ARMS
    // Upper arm L
    '<path d="M42 118 Q30 125 28 155 Q28 172 38 178 Q48 182 54 170 Q58 154 56 128 Z" fill="#f5c400" stroke="#c8a000" stroke-width="1"/>'+
    '<path d="M42 118 Q30 125 28 155 Q28 172 38 178 Q48 182 54 170 Q58 154 56 128 Z" fill="'+z('biceps')+'" opacity="0.75"/>'+
    // Thumb up arm if fresh
    (thumbUp?
      '<path d="M28 158 Q20 150 22 135 Q24 122 34 120" fill="none" stroke="#f5c400" stroke-width="8" stroke-linecap="round"/>'+
      '<circle cx="21" cy="128" r="10" fill="#f5c400" stroke="#c8a000" stroke-width="1"/>'+
      '<path d="M21 120 Q26 115 28 122 Q22 125 21 120 Z" fill="#f5c400" stroke="#c8a000" stroke-width="0.8"/>':
      '<path d="M28 158 Q20 168 22 185 Q24 198 32 200 Q40 200 42 190 Q40 175 36 162 Z" fill="#f5c400" stroke="#c8a000" stroke-width="0.8"/>'+
      '<path d="M28 158 Q20 168 22 185 Q24 198 32 200 Q40 200 42 190 Q40 175 36 162 Z" fill="'+z('forearms')+'" opacity="0.7"/>'+
      '<ellipse cx="28" cy="202" rx="10" ry="7" fill="#f5c400" stroke="#c8a000" stroke-width="0.8"/>'+
      '<rect x="20" y="196" width="6" height="14" rx="3" fill="#f5c400" stroke="#c8a000" stroke-width="0.6"/>'+
      '<rect x="26" y="196" width="6" height="12" rx="3" fill="#f5c400" stroke="#c8a000" stroke-width="0.6"/>'+
      '<rect x="32" y="197" width="6" height="11" rx="3" fill="#f5c400" stroke="#c8a000" stroke-width="0.6"/>'+
      '<rect x="38" y="198" width="6" height="10" rx="3" fill="#f5c400" stroke="#c8a000" stroke-width="0.6"/>')+
    // Upper arm R
    '<path d="M158 118 Q170 125 172 155 Q172 172 162 178 Q152 182 146 170 Q142 154 144 128 Z" fill="#f5c400" stroke="#c8a000" stroke-width="1"/>'+
    '<path d="M158 118 Q170 125 172 155 Q172 172 162 178 Q152 182 146 170 Q142 154 144 128 Z" fill="'+z('biceps')+'" opacity="0.75"/>'+
    // Right forearm
    '<path d="M172 158 Q180 168 178 185 Q176 198 168 200 Q160 200 158 190 Q160 175 164 162 Z" fill="#f5c400" stroke="#c8a000" stroke-width="0.8"/>'+
    '<path d="M172 158 Q180 168 178 185 Q176 198 168 200 Q160 200 158 190 Q160 175 164 162 Z" fill="'+z('forearms')+'" opacity="0.7"/>'+
    // LEGS
    '<path d="M60 298 Q50 310 52 340 Q53 356 62 360 Q72 362 76 354 Q80 338 78 316 Q76 306 68 298 Z" fill="#1a3a8c" stroke="#2255aa" stroke-width="0.8"/>'+
    '<path d="M60 298 Q50 310 52 340 Q53 356 62 360 Q72 362 76 354 Q80 338 78 316 Q76 306 68 298 Z" fill="'+z('calves')+'" opacity="0.5"/>'+
    '<path d="M140 298 Q150 310 148 340 Q147 356 138 360 Q128 362 124 354 Q120 338 122 316 Q124 306 132 298 Z" fill="#1a3a8c" stroke="#2255aa" stroke-width="0.8"/>'+
    '<path d="M140 298 Q150 310 148 340 Q147 356 138 360 Q128 362 124 354 Q120 338 122 316 Q124 306 132 298 Z" fill="'+z('calves')+'" opacity="0.5"/>'+
    // Boots
    '<path d="M50 356 Q46 364 50 370 L82 370 Q88 364 82 356 L76 354 Q72 362 64 362 Q56 360 50 356 Z" fill="#4a2800"/>'+
    '<path d="M150 356 Q154 364 150 370 L118 370 Q112 364 118 356 L124 354 Q128 362 136 362 Q144 360 150 356 Z" fill="#4a2800"/>'+
    // Quads overlay
    '<path d="M58 195 Q50 210 50 240 Q50 260 58 270 Q64 274 70 270 Q78 260 80 240 Q80 210 72 195 Z" fill="'+z('quads')+'" opacity="0.55"/>'+
    '<path d="M142 195 Q150 210 150 240 Q150 260 142 270 Q136 274 130 270 Q122 260 120 240 Q120 210 128 195 Z" fill="'+z('quads')+'" opacity="0.55"/>'+
    '</svg>';
  }

  // ══════════════════════════════════════════════════════════
  // T-60 POWER ARMOR — Brotherhood of Steel
  // ══════════════════════════════════════════════════════════
  function renderT60(heat,mode,w,h){
    w=w||200;h=h||380;
    var id='t60'+Date.now().toString(36);
    function z(m){return heatColor(heat(m),'bos',mode);}
    var steel='#3a3a42',steelLight='#5a5a66',gold='#d2aa32',dark='#1a1a1e',glow='#d2aa32';

    return'<svg viewBox="0 0 200 380" xmlns="http://www.w3.org/2000/svg" style="width:'+w+'px;height:'+h+'px">'+
    glowFilter('bos',id)+
    '<rect width="200" height="380" fill="url(#bg'+id+')"/>'+

    // ── HELMET ───────────────────────────────────────────────
    // Helmet base — iconic T-60 dome shape
    '<path d="M72 20 Q72 4 100 2 Q128 4 128 20 L132 52 Q132 68 118 72 L100 76 L82 72 Q68 68 68 52 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1.5"/>'+
    // Visor — glowing amber slit
    '<rect x="76" y="32" width="48" height="16" rx="6" fill="'+dark+'" stroke="'+gold+'" stroke-width="1.2"/>'+
    '<rect x="78" y="34" width="44" height="12" rx="5" fill="'+gold+'" opacity="0.8"/>'+
    '<rect x="80" y="36" width="40" height="8" rx="4" fill="rgba(255,200,0,0.3)"/>'+
    // Helmet vents
    '<rect x="76" y="56" width="6" height="12" rx="2" fill="'+dark+'"/>'+
    '<rect x="84" y="56" width="6" height="12" rx="2" fill="'+dark+'"/>'+
    '<rect x="110" y="56" width="6" height="12" rx="2" fill="'+dark+'"/>'+
    '<rect x="118" y="56" width="6" height="12" rx="2" fill="'+dark+'"/>'+
    // BoS crest
    '<path d="M96 10 L100 4 L104 10 L110 8 L106 14 L108 20 L100 17 L92 20 L94 14 L90 8 Z" fill="'+gold+'" opacity="0.9"/>'+
    // Helmet side ears/sensors
    '<circle cx="68" cy="40" r="8" fill="'+steelLight+'" stroke="'+gold+'" stroke-width="1"/>'+
    '<circle cx="132" cy="40" r="8" fill="'+steelLight+'" stroke="'+gold+'" stroke-width="1"/>'+
    '<circle cx="68" cy="40" r="3" fill="'+gold+'" opacity="0.7"/>'+
    '<circle cx="132" cy="40" r="3" fill="'+gold+'" opacity="0.7"/>'+

    // ── GORGET/NECK ──────────────────────────────────────────
    '<path d="M84 74 Q80 80 80 90 L120 90 Q120 80 116 74 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1"/>'+

    // ── CHEST PLATE ──────────────────────────────────────────
    '<path d="M55 90 Q44 96 42 120 L40 175 Q40 186 55 186 L145 186 Q160 186 160 175 L158 120 Q156 96 145 90 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1.5"/>'+
    // Chest muscle overlays
    '<path d="M60 100 Q55 110 58 135 Q62 150 76 154 Q88 156 96 146 Q100 138 100 125 Q98 106 90 98 Z" fill="'+z('chest')+'" opacity="0.8"/>'+
    '<path d="M140 100 Q145 110 142 135 Q138 150 124 154 Q112 156 104 146 Q100 138 100 125 Q102 106 110 98 Z" fill="'+z('chest')+'" opacity="0.8"/>'+
    // Chest detail lines
    '<path d="M58 100 Q56 112 60 130 L96 140 L100 105 L90 98 Z" fill="none" stroke="'+steelLight+'" stroke-width="0.8" opacity="0.6"/>'+
    '<path d="M142 100 Q144 112 140 130 L104 140 L100 105 L110 98 Z" fill="none" stroke="'+steelLight+'" stroke-width="0.8" opacity="0.6"/>'+
    // Chest fusion core reactor
    '<circle cx="100" cy="128" r="14" fill="'+dark+'" stroke="'+gold+'" stroke-width="1.5"/>'+
    '<circle cx="100" cy="128" r="10" fill="rgba(255,200,50,0.15)"/>'+
    '<circle cx="100" cy="128" r="6" fill="'+gold+'" opacity="0.8"/>'+
    '<circle cx="100" cy="128" r="3" fill="white" opacity="0.9"/>'+
    // Traps plates
    '<path d="M55 90 Q50 82 60 78 Q76 74 84 82 Q74 84 68 90 Z" fill="'+steelLight+'" stroke="'+gold+'" stroke-width="0.8"/>'+
    '<path d="M145 90 Q150 82 140 78 Q124 74 116 82 Q126 84 132 90 Z" fill="'+steelLight+'" stroke="'+gold+'" stroke-width="0.8"/>'+
    '<path d="M55 90 Q50 82 60 78 Q76 74 84 82 Q74 84 68 90 Z" fill="'+z('traps')+'" opacity="0.7"/>'+
    '<path d="M145 90 Q150 82 140 78 Q124 74 116 82 Q126 84 132 90 Z" fill="'+z('traps')+'" opacity="0.7"/>'+
    // Abs plate sections
    '<rect x="82" y="158" width="36" height="14" rx="3" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1"/>'+
    '<rect x="82" y="174" width="36" height="12" rx="3" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1"/>'+
    '<rect x="82" y="158" width="36" height="14" rx="3" fill="'+z('abs')+'" opacity="0.6"/>'+
    '<rect x="82" y="174" width="36" height="12" rx="3" fill="'+z('abs')+'" opacity="0.6"/>'+
    '<line x1="100" y1="158" x2="100" y2="186" stroke="'+steelLight+'" stroke-width="0.8" opacity="0.5"/>'+

    // ── SHOULDER PAULDRONS ────────────────────────────────────
    '<path d="M40 90 Q24 96 20 118 Q18 134 28 142 Q38 148 48 142 Q56 134 54 116 Q52 102 44 94 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1.5"/>'+
    '<path d="M40 90 Q24 96 20 118 Q18 134 28 142 Q38 148 48 142 Q56 134 54 116 Q52 102 44 94 Z" fill="'+z('front-delts')+'" opacity="0.7"/>'+
    '<path d="M160 90 Q176 96 180 118 Q182 134 172 142 Q162 148 152 142 Q144 134 146 116 Q148 102 156 94 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1.5"/>'+
    '<path d="M160 90 Q176 96 180 118 Q182 134 172 142 Q162 148 152 142 Q144 134 146 116 Q148 102 156 94 Z" fill="'+z('front-delts')+'" opacity="0.7"/>'+
    // Shoulder bolts
    '<circle cx="34" cy="106" r="4" fill="'+gold+'"/><circle cx="46" cy="96" r="3" fill="'+gold+'"/>'+
    '<circle cx="166" cy="106" r="4" fill="'+gold+'"/><circle cx="154" cy="96" r="3" fill="'+gold+'"/>'+

    // ── UPPER ARM ARMOR ──────────────────────────────────────
    '<path d="M20 140 Q10 148 12 175 Q14 192 24 198 Q36 202 42 192 Q48 178 46 155 Q44 142 32 138 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1.2"/>'+
    '<path d="M20 140 Q10 148 12 175 Q14 192 24 198 Q36 202 42 192 Q48 178 46 155 Q44 142 32 138 Z" fill="'+z('biceps')+'" opacity="0.7"/>'+
    '<path d="M180 140 Q190 148 188 175 Q186 192 176 198 Q164 202 158 192 Q152 178 154 155 Q156 142 168 138 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1.2"/>'+
    '<path d="M180 140 Q190 148 188 175 Q186 192 176 198 Q164 202 158 192 Q152 178 154 155 Q156 142 168 138 Z" fill="'+z('biceps')+'" opacity="0.7"/>'+
    // Tricep back-plate
    '<path d="M12 148 Q6 158 8 178 Q10 195 20 200 Q14 188 16 168 Q18 156 22 148 Z" fill="'+z('triceps')+'" opacity="0.6"/>'+
    '<path d="M188 148 Q194 158 192 178 Q190 195 180 200 Q186 188 184 168 Q182 156 178 148 Z" fill="'+z('triceps')+'" opacity="0.6"/>'+

    // ── FOREARM ARMOR ────────────────────────────────────────
    '<path d="M14 200 Q6 210 8 235 Q10 252 20 256 Q30 260 36 250 Q42 236 40 214 Q38 202 26 198 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1"/>'+
    '<path d="M14 200 Q6 210 8 235 Q10 252 20 256 Q30 260 36 250 Q42 236 40 214 Q38 202 26 198 Z" fill="'+z('forearms')+'" opacity="0.65"/>'+
    '<path d="M186 200 Q194 210 192 235 Q190 252 180 256 Q170 260 164 250 Q158 236 160 214 Q162 202 174 198 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1"/>'+
    '<path d="M186 200 Q194 210 192 235 Q190 252 180 256 Q170 260 164 250 Q158 236 160 214 Q162 202 174 198 Z" fill="'+z('forearms')+'" opacity="0.65"/>'+
    // Power fists
    '<rect x="8" y="254" width="32" height="22" rx="6" fill="'+steelLight+'" stroke="'+gold+'" stroke-width="1"/>'+
    '<rect x="160" y="254" width="32" height="22" rx="6" fill="'+steelLight+'" stroke="'+gold+'" stroke-width="1"/>'+
    '<rect x="8" y="256" width="32" height="8" rx="3" fill="'+gold+'" opacity="0.3"/>'+
    '<rect x="160" y="256" width="32" height="8" rx="3" fill="'+gold+'" opacity="0.3"/>'+

    // ── HIP PLATES ───────────────────────────────────────────
    '<path d="M55 184 Q44 188 42 202 L82 202 Q82 190 75 184 Z" fill="'+steelLight+'" stroke="'+gold+'" stroke-width="0.8"/>'+
    '<path d="M145 184 Q156 188 158 202 L118 202 Q118 190 125 184 Z" fill="'+steelLight+'" stroke="'+gold+'" stroke-width="0.8"/>'+
    '<rect x="82" y="186" width="36" height="18" rx="4" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1"/>'+
    '<rect x="82" y="186" width="36" height="18" rx="4" fill="'+z('glutes')+'" opacity="0.4"/>'+

    // ── LEG ARMOR ────────────────────────────────────────────
    '<path d="M44 200 Q34 212 34 250 Q34 272 44 282 Q54 290 64 286 Q74 278 76 258 Q78 232 70 210 Q66 202 56 198 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1.2"/>'+
    '<path d="M44 200 Q34 212 34 250 Q34 272 44 282 Q54 290 64 286 Q74 278 76 258 Q78 232 70 210 Q66 202 56 198 Z" fill="'+z('quads')+'" opacity="0.7"/>'+
    '<path d="M156 200 Q166 212 166 250 Q166 272 156 282 Q146 290 136 286 Q126 278 124 258 Q122 232 130 210 Q134 202 144 198 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1.2"/>'+
    '<path d="M156 200 Q166 212 166 250 Q166 272 156 282 Q146 290 136 286 Q126 278 124 258 Q122 232 130 210 Q134 202 144 198 Z" fill="'+z('quads')+'" opacity="0.7"/>'+
    // Leg detail rivets
    '<circle cx="54" cy="230" r="3" fill="'+gold+'"/><circle cx="66" cy="250" r="3" fill="'+gold+'"/>'+
    '<circle cx="146" cy="230" r="3" fill="'+gold+'"/><circle cx="134" cy="250" r="3" fill="'+gold+'"/>'+
    // Kneecap
    '<ellipse cx="55" cy="284" rx="14" ry="10" fill="'+steelLight+'" stroke="'+gold+'" stroke-width="1"/>'+
    '<ellipse cx="145" cy="284" rx="14" ry="10" fill="'+steelLight+'" stroke="'+gold+'" stroke-width="1"/>'+

    // ── SHIN ARMOR ───────────────────────────────────────────
    '<path d="M40 284 Q32 296 34 326 Q36 344 46 350 Q56 354 62 346 Q68 332 66 308 Q64 292 54 284 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1"/>'+
    '<path d="M40 284 Q32 296 34 326 Q36 344 46 350 Q56 354 62 346 Q68 332 66 308 Q64 292 54 284 Z" fill="'+z('calves')+'" opacity="0.65"/>'+
    '<path d="M160 284 Q168 296 166 326 Q164 344 154 350 Q144 354 138 346 Q132 332 134 308 Q136 292 146 284 Z" fill="'+steel+'" stroke="'+steelLight+'" stroke-width="1"/>'+
    '<path d="M160 284 Q168 296 166 326 Q164 344 154 350 Q144 354 138 346 Q132 332 134 308 Q136 292 146 284 Z" fill="'+z('calves')+'" opacity="0.65"/>'+
    // Hamstring back plates
    '<path d="M34 210 Q26 224 28 256 Q30 272 38 278 Q32 262 34 240 Q36 224 42 212 Z" fill="'+z('hamstrings')+'" opacity="0.55"/>'+
    '<path d="M166 210 Q174 224 172 256 Q170 272 162 278 Q168 262 166 240 Q164 224 158 212 Z" fill="'+z('hamstrings')+'" opacity="0.55"/>'+
    // Boots
    '<path d="M32 348 Q26 358 30 368 L70 368 Q76 358 70 348 L62 346 Q58 354 50 354 Q40 352 32 348 Z" fill="'+dark+'" stroke="'+steelLight+'" stroke-width="1"/>'+
    '<path d="M168 348 Q174 358 170 368 L130 368 Q124 358 130 348 L138 346 Q142 354 150 354 Q160 352 168 348 Z" fill="'+dark+'" stroke="'+steelLight+'" stroke-width="1"/>'+
    '</svg>';
  }

  // ══════════════════════════════════════════════════════════
  // NCR RANGER — Desert Ranger armor with muscle zones
  // ══════════════════════════════════════════════════════════
  function renderNCR(heat,mode,w,h){
    w=w||200;h=h||380;
    var id='ncr'+Date.now().toString(36);
    function z(m){return heatColor(heat(m),'ncr',mode);}
    var leather='#5c3d1e',leatherDark='#3a2510',khaki='#8b7355',gold='#c89646',metal='#6b6b6b';

    return'<svg viewBox="0 0 200 380" xmlns="http://www.w3.org/2000/svg" style="width:'+w+'px;height:'+h+'px">'+
    glowFilter('ncr',id)+
    '<rect width="200" height="380" fill="url(#bg'+id+')"/>'+

    // ── RANGER HELMET ────────────────────────────────────────
    // Base helmet
    '<ellipse cx="100" cy="42" rx="30" ry="32" fill="'+leather+'" stroke="'+leatherDark+'" stroke-width="1.5"/>'+
    // Gas mask — iconic NCR look
    '<ellipse cx="100" cy="50" rx="24" ry="20" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="1.2"/>'+
    // Goggle lenses (red tinted)
    '<ellipse cx="88" cy="40" rx="10" ry="9" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="1.5"/>'+
    '<ellipse cx="112" cy="40" rx="10" ry="9" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="1.5"/>'+
    '<ellipse cx="88" cy="40" rx="7" ry="6" fill="rgba(180,40,10,0.6)"/>'+
    '<ellipse cx="112" cy="40" rx="7" ry="6" fill="rgba(180,40,10,0.6)"/>'+
    '<ellipse cx="86" cy="38" rx="2.5" ry="2" fill="rgba(255,120,80,0.8)"/>'+
    '<ellipse cx="110" cy="38" rx="2.5" ry="2" fill="rgba(255,120,80,0.8)"/>'+
    // Goggle bridge
    '<rect x="96" y="37" width="8" height="4" rx="2" fill="'+metal+'"/>'+
    // Gas mask respirator
    '<path d="M82 58 Q90 68 100 70 Q110 68 118 58 Q112 72 100 76 Q88 72 82 58 Z" fill="'+metal+'" stroke="'+leatherDark+'" stroke-width="0.8"/>'+
    '<circle cx="88" cy="66" r="5" fill="'+metal+'" stroke="'+leatherDark+'" stroke-width="0.8"/>'+
    '<circle cx="112" cy="66" r="5" fill="'+metal+'" stroke="'+leatherDark+'" stroke-width="0.8"/>'+
    // Helmet top — flat top patrol cap brim
    '<rect x="68" y="14" width="64" height="8" rx="3" fill="'+leatherDark+'" stroke="'+leather+'" stroke-width="1"/>'+
    '<rect x="62" y="20" width="76" height="4" rx="2" fill="'+leatherDark+'"/>'+
    // NCR bear emblem on helmet
    '<circle cx="100" cy="18" r="6" fill="'+gold+'" opacity="0.9"/>'+
    '<path d="M97 16 L100 13 L103 16 L105 14 L103 17 L104 20 L100 18.5 L96 20 L97 17 L95 14 Z" fill="'+leatherDark+'" opacity="0.8"/>'+

    // ── NECK & COLLAR ─────────────────────────────────────────
    '<rect x="90" y="76" width="20" height="14" rx="4" fill="'+khaki+'" stroke="'+leatherDark+'" stroke-width="0.8"/>'+
    // Scarf/balaclava neck wrap
    '<path d="M80 80 Q78 86 80 92 L120 92 Q122 86 120 80 Q112 84 100 84 Q88 84 80 80 Z" fill="'+leather+'" stroke="'+leatherDark+'" stroke-width="0.8"/>'+

    // ── BODY ARMOR / COAT ────────────────────────────────────
    // Long duster coat base
    '<path d="M52 94 Q38 102 36 135 L34 250 Q34 265 50 270 L82 278 L82 200 L100 195 L118 200 L118 278 L150 270 Q166 265 166 250 L164 135 Q162 102 148 94 Z" fill="'+leather+'" stroke="'+leatherDark+'" stroke-width="1.2"/>'+
    // Coat lapels
    '<path d="M88 94 Q80 100 78 114 L88 112 Q92 102 100 98 Q108 102 112 112 L122 114 Q120 100 112 94 L100 90 Z" fill="'+khaki+'" stroke="'+leatherDark+'" stroke-width="0.8"/>'+
    // Ranger chest armor plate
    '<path d="M68 108 Q64 118 66 138 Q68 154 80 160 Q92 164 100 160 Q108 164 120 160 Q132 154 134 138 Q136 118 132 108 Q116 114 100 114 Q84 114 68 108 Z" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="1"/>'+
    // Chest plate muscle zones
    '<path d="M68 108 Q64 118 66 138 Q68 154 80 160 L100 160 L100 108 Q84 108 68 108 Z" fill="'+z('chest')+'" opacity="0.75"/>'+
    '<path d="M132 108 Q136 118 134 138 Q132 154 120 160 L100 160 L100 108 Q116 108 132 108 Z" fill="'+z('chest')+'" opacity="0.75"/>'+
    // Chest plate screws/details
    '<circle cx="76" cy="118" r="3" fill="'+metal+'"/><circle cx="124" cy="118" r="3" fill="'+metal+'"/>'+
    '<circle cx="76" cy="150" r="3" fill="'+metal+'"/><circle cx="124" cy="150" r="3" fill="'+metal+'"/>'+
    // NCR star badge
    '<path d="M97 130 L100 124 L103 130 L110 128 L106 133 L108 140 L100 136 L92 140 L94 133 L90 128 Z" fill="'+gold+'" opacity="0.9"/>'+
    // Traps — shoulder pad areas
    '<path d="M52 94 Q44 88 48 80 Q58 74 70 80 Q66 86 62 94 Z" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="0.8"/>'+
    '<path d="M148 94 Q156 88 152 80 Q142 74 130 80 Q134 86 138 94 Z" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="0.8"/>'+
    '<path d="M52 94 Q44 88 48 80 Q58 74 70 80 Q66 86 62 94 Z" fill="'+z('traps')+'" opacity="0.65"/>'+
    '<path d="M148 94 Q156 88 152 80 Q142 74 130 80 Q134 86 138 94 Z" fill="'+z('traps')+'" opacity="0.65"/>'+
    // Abs pouches/belt
    '<rect x="78" y="168" width="44" height="18" rx="3" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="0.8"/>'+
    '<rect x="78" y="168" width="44" height="18" rx="3" fill="'+z('abs')+'" opacity="0.55"/>'+
    '<rect x="86" y="170" width="10" height="14" rx="2" fill="'+metal+'" opacity="0.4"/>'+
    '<rect x="100" y="170" width="10" height="14" rx="2" fill="'+metal+'" opacity="0.4"/>'+
    '<rect x="114" y="170" width="8" height="14" rx="2" fill="'+metal+'" opacity="0.4"/>'+
    // Belt buckle
    '<rect x="92" y="185" width="16" height="10" rx="2" fill="'+gold+'"/>'+
    '<rect x="95" y="188" width="10" height="4" rx="1" fill="'+leatherDark+'"/>'+

    // ── ARMS ─────────────────────────────────────────────────
    // Upper arm L
    '<path d="M36 100 Q24 110 22 140 Q20 162 30 170 Q42 176 50 166 Q56 152 54 126 Q52 108 44 100 Z" fill="'+leather+'" stroke="'+leatherDark+'" stroke-width="1"/>'+
    '<path d="M36 100 Q24 110 22 140 Q20 162 30 170 Q42 176 50 166 Q56 152 54 126 Q52 108 44 100 Z" fill="'+z('biceps')+'" opacity="0.7"/>'+
    // Shoulder pad L
    '<path d="M34 102 Q26 96 32 88 Q42 84 50 92 Q44 96 38 102 Z" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="0.8"/>'+
    '<path d="M164 100 Q176 110 178 140 Q180 162 170 170 Q158 176 150 166 Q144 152 146 126 Q148 108 156 100 Z" fill="'+leather+'" stroke="'+leatherDark+'" stroke-width="1"/>'+
    '<path d="M164 100 Q176 110 178 140 Q180 162 170 170 Q158 176 150 166 Q144 152 146 126 Q148 108 156 100 Z" fill="'+z('biceps')+'" opacity="0.7"/>'+
    '<path d="M166 102 Q174 96 168 88 Q158 84 150 92 Q156 96 162 102 Z" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="0.8"/>'+
    // Forearm L + R
    '<path d="M22 168 Q14 178 16 204 Q18 222 28 228 Q38 232 44 222 Q50 208 48 186 Q46 170 34 166 Z" fill="'+khaki+'" stroke="'+leatherDark+'" stroke-width="0.8"/>'+
    '<path d="M22 168 Q14 178 16 204 Q18 222 28 228 Q38 232 44 222 Q50 208 48 186 Q46 170 34 166 Z" fill="'+z('forearms')+'" opacity="0.65"/>'+
    '<path d="M178 168 Q186 178 184 204 Q182 222 172 228 Q162 232 156 222 Q150 208 152 186 Q154 170 166 166 Z" fill="'+khaki+'" stroke="'+leatherDark+'" stroke-width="0.8"/>'+
    '<path d="M178 168 Q186 178 184 204 Q182 222 172 228 Q162 232 156 222 Q150 208 152 186 Q154 170 166 166 Z" fill="'+z('forearms')+'" opacity="0.65"/>'+
    // Gloves
    '<path d="M14 226 Q10 232 12 244 Q14 252 22 254 Q30 254 34 248 Q36 240 34 230 Z" fill="'+leatherDark+'"/>'+
    '<path d="M186 226 Q190 232 188 244 Q186 252 178 254 Q170 254 166 248 Q164 240 166 230 Z" fill="'+leatherDark+'"/>'+

    // ── LEGS ─────────────────────────────────────────────────
    // Trousers (khaki)
    '<path d="M50 268 Q40 282 40 316 Q40 340 50 350 Q60 356 68 350 Q76 340 76 316 Q76 290 70 272 Q64 268 58 268 Z" fill="'+khaki+'" stroke="'+leatherDark+'" stroke-width="0.8"/>'+
    '<path d="M50 268 Q40 282 40 316 Q40 340 50 350 Q60 356 68 350 Q76 340 76 316 Q76 290 70 272 Q64 268 58 268 Z" fill="'+z('quads')+'" opacity="0.6"/>'+
    '<path d="M150 268 Q160 282 160 316 Q160 340 150 350 Q140 356 132 350 Q124 340 124 316 Q124 290 130 272 Q136 268 142 268 Z" fill="'+khaki+'" stroke="'+leatherDark+'" stroke-width="0.8"/>'+
    '<path d="M150 268 Q160 282 160 316 Q160 340 150 350 Q140 356 132 350 Q124 340 124 316 Q124 290 130 272 Q136 268 142 268 Z" fill="'+z('quads')+'" opacity="0.6"/>'+
    // Hamstrings (back visible)
    '<path d="M40 285 Q32 298 34 326 Q36 342 44 348 Q36 332 38 310 Q40 295 46 285 Z" fill="'+z('hamstrings')+'" opacity="0.5"/>'+
    '<path d="M160 285 Q168 298 166 326 Q164 342 156 348 Q164 332 162 310 Q160 295 154 285 Z" fill="'+z('hamstrings')+'" opacity="0.5"/>'+
    // Knee pads
    '<ellipse cx="58" cy="318" rx="14" ry="10" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="0.8"/>'+
    '<ellipse cx="142" cy="318" rx="14" ry="10" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="0.8"/>'+
    // Boots
    '<path d="M38 350 Q32 358 34 368 L76 368 Q80 358 74 350 L68 350 Q66 356 58 356 Q48 354 38 350 Z" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="0.8"/>'+
    '<path d="M162 350 Q168 358 166 368 L124 368 Q120 358 126 350 L132 350 Q134 356 142 356 Q152 354 162 350 Z" fill="'+leatherDark+'" stroke="'+metal+'" stroke-width="0.8"/>'+
    // Calves
    '<path d="M40 350 Q34 358 36 362 Q38 356 46 350 Z" fill="'+z('calves')+'" opacity="0.5"/>'+
    '</svg>';
  }

  // ══════════════════════════════════════════════════════════
  // ENCLAVE HELLFIRE ARMOR — Heavy powered suit
  // ══════════════════════════════════════════════════════════
  function renderEnclave(heat,mode,w,h){
    w=w||200;h=h||380;
    var id='enc'+Date.now().toString(36);
    function z(m){return heatColor(heat(m),'enclave',mode);}
    var blk='#1a1a1e',darkRed='#5c1010',red='#8b1a1a',brightRed='#cc2020',chrome='#8a8a96',gold='#aa3300';

    return'<svg viewBox="0 0 200 380" xmlns="http://www.w3.org/2000/svg" style="width:'+w+'px;height:'+h+'px">'+
    glowFilter('enclave',id)+
    '<rect width="200" height="380" fill="url(#bg'+id+')"/>'+

    // ── HELLFIRE HELMET ──────────────────────────────────────
    // Thick angular helmet
    '<path d="M66 10 Q66 0 100 0 Q134 0 134 10 L138 46 Q138 64 124 70 L100 76 L76 70 Q62 64 62 46 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="1.5"/>'+
    // Visor — narrow red slit
    '<rect x="74" y="30" width="52" height="12" rx="3" fill="'+blk+'" stroke="'+brightRed+'" stroke-width="1.2"/>'+
    '<rect x="76" y="32" width="48" height="8" rx="2" fill="'+brightRed+'" opacity="0.9"/>'+
    '<rect x="78" y="34" width="44" height="4" rx="2" fill="rgba(255,100,50,0.4)"/>'+
    // Helmet cheek armor
    '<rect x="62" y="44" width="14" height="22" rx="3" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="0.8"/>'+
    '<rect x="124" y="44" width="14" height="22" rx="3" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="0.8"/>'+
    // Enclave E symbol
    '<text x="100" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="'+brightRed+'" font-family="Arial" opacity="0.9">Ε</text>'+
    // Helmet top spike array
    '<rect x="88" y="-2" width="6" height="12" rx="2" fill="'+brightRed+'"/>'+
    '<rect x="97" y="-6" width="6" height="16" rx="2" fill="'+brightRed+'"/>'+
    '<rect x="106" y="-2" width="6" height="12" rx="2" fill="'+brightRed+'"/>'+
    // Neck collar
    '<path d="M80 74 Q78 82 80 90 L120 90 Q122 82 120 74 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="1"/>'+

    // ── CHEST PLATE ──────────────────────────────────────────
    // Heavy angular chest
    '<path d="M48 90 Q36 98 34 128 L32 178 Q32 192 50 192 L150 192 Q168 192 168 178 L166 128 Q164 98 152 90 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="1.5"/>'+
    // Chest V design
    '<path d="M100 94 L60 110 L60 140 L100 150 L140 140 L140 110 Z" fill="'+red+'" stroke="'+brightRed+'" stroke-width="0.8" opacity="0.7"/>'+
    // Chest muscle overlays
    '<path d="M60 100 Q54 112 56 136 Q60 152 74 158 Q88 162 98 152 L100 130 L88 98 Z" fill="'+z('chest')+'" opacity="0.8"/>'+
    '<path d="M140 100 Q146 112 144 136 Q140 152 126 158 Q112 162 102 152 L100 130 L112 98 Z" fill="'+z('chest')+'" opacity="0.8"/>'+
    // Central energy cell
    '<ellipse cx="100" cy="136" rx="18" ry="18" fill="'+blk+'" stroke="'+brightRed+'" stroke-width="2"/>'+
    '<ellipse cx="100" cy="136" rx="14" ry="14" fill="'+darkRed+'" stroke="'+gold+'" stroke-width="1"/>'+
    '<ellipse cx="100" cy="136" rx="8" ry="8" fill="'+brightRed+'" opacity="0.9"/>'+
    '<ellipse cx="100" cy="136" rx="4" ry="4" fill="rgba(255,100,50,0.9)"/>'+
    // Abs plates
    '<rect x="80" y="164" width="40" height="14" rx="3" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="0.8"/>'+
    '<rect x="80" y="164" width="40" height="14" rx="3" fill="'+z('abs')+'" opacity="0.65"/>'+
    '<rect x="80" y="180" width="40" height="12" rx="3" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="0.8"/>'+
    '<line x1="100" y1="164" x2="100" y2="192" stroke="'+brightRed+'" stroke-width="0.8" opacity="0.5"/>'+
    // Traps heavy plates
    '<path d="M48 90 Q40 82 46 72 Q58 66 72 74 Q66 82 60 90 Z" fill="'+red+'" stroke="'+brightRed+'" stroke-width="1"/>'+
    '<path d="M48 90 Q40 82 46 72 Q58 66 72 74 Q66 82 60 90 Z" fill="'+z('traps')+'" opacity="0.7"/>'+
    '<path d="M152 90 Q160 82 154 72 Q142 66 128 74 Q134 82 140 90 Z" fill="'+red+'" stroke="'+brightRed+'" stroke-width="1"/>'+
    '<path d="M152 90 Q160 82 154 72 Q142 66 128 74 Q134 82 140 90 Z" fill="'+z('traps')+'" opacity="0.7"/>'+

    // ── SHOULDER ARMOR ───────────────────────────────────────
    '<path d="M32 94 Q16 102 14 130 Q12 152 24 162 Q36 170 46 162 Q54 150 52 124 Q50 106 40 96 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="1.5"/>'+
    '<path d="M32 94 Q16 102 14 130 Q12 152 24 162 Q36 170 46 162 Q54 150 52 124 Q50 106 40 96 Z" fill="'+z('front-delts')+'" opacity="0.7"/>'+
    '<path d="M168 94 Q184 102 186 130 Q188 152 176 162 Q164 170 154 162 Q146 150 148 124 Q150 106 160 96 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="1.5"/>'+
    '<path d="M168 94 Q184 102 186 130 Q182 152 176 162 Q164 170 154 162 Q146 150 148 124 Q150 106 160 96 Z" fill="'+z('front-delts')+'" opacity="0.7"/>'+
    // Shoulder spikes
    '<path d="M18 108 L10 96 L22 102 Z" fill="'+brightRed+'"/>'+
    '<path d="M24 100 L16 88 L28 94 Z" fill="'+brightRed+'"/>'+
    '<path d="M182 108 L190 96 L178 102 Z" fill="'+brightRed+'"/>'+
    '<path d="M176 100 L184 88 L172 94 Z" fill="'+brightRed+'"/>'+

    // ── ARMS ─────────────────────────────────────────────────
    '<path d="M14 160 Q4 170 6 200 Q8 220 18 228 Q30 234 36 222 Q42 206 40 180 Q38 164 26 158 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="1"/>'+
    '<path d="M14 160 Q4 170 6 200 Q8 220 18 228 Q30 234 36 222 Q42 206 40 180 Q38 164 26 158 Z" fill="'+z('biceps')+'" opacity="0.7"/>'+
    '<path d="M186 160 Q196 170 194 200 Q192 220 182 228 Q170 234 164 222 Q158 206 160 180 Q162 164 174 158 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="1"/>'+
    '<path d="M186 160 Q196 170 194 200 Q192 220 182 228 Q170 234 164 222 Q158 206 160 180 Q162 164 174 158 Z" fill="'+z('biceps')+'" opacity="0.7"/>'+
    // Tricep side
    '<path d="M4 168 Q-2 180 0 202 Q2 216 12 222 Q6 208 8 186 Q10 174 16 166 Z" fill="'+z('triceps')+'" opacity="0.6"/>'+
    '<path d="M196 168 Q202 180 200 202 Q198 216 188 222 Q194 208 192 186 Q190 174 184 166 Z" fill="'+z('triceps')+'" opacity="0.6"/>'+
    // Forearms + flamethrower
    '<path d="M6 226 Q-2 236 0 258 Q2 272 12 278 Q22 282 28 272 Q34 258 32 238 Q30 224 18 222 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="0.8"/>'+
    '<path d="M6 226 Q-2 236 0 258 Q2 272 12 278 Q22 282 28 272 Q34 258 32 238 Q30 224 18 222 Z" fill="'+z('forearms')+'" opacity="0.65"/>'+
    // Flamethrower nozzle on left arm
    '<rect x="-4" y="256" width="22" height="8" rx="3" fill="'+chrome+'" stroke="'+gold+'" stroke-width="0.8"/>'+
    '<rect x="-8" y="258" width="6" height="4" rx="2" fill="'+gold+'"/>'+
    '<path d="M194 226 Q202 236 200 258 Q198 272 188 278 Q178 282 172 272 Q166 258 168 238 Q170 224 182 222 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="0.8"/>'+
    '<path d="M194 226 Q202 236 200 258 Q198 272 188 278 Q178 282 172 272 Q166 258 168 238 Q170 224 182 222 Z" fill="'+z('forearms')+'" opacity="0.65"/>'+

    // ── LEGS ─────────────────────────────────────────────────
    '<path d="M44 192 Q34 206 34 242 Q34 266 46 278 Q58 286 68 280 Q78 270 78 248 Q80 218 70 202 Q64 194 56 192 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="1.2"/>'+
    '<path d="M44 192 Q34 206 34 242 Q34 266 46 278 Q58 286 68 280 Q78 270 78 248 Q80 218 70 202 Q64 194 56 192 Z" fill="'+z('quads')+'" opacity="0.7"/>'+
    '<path d="M156 192 Q166 206 166 242 Q166 266 154 278 Q142 286 132 280 Q122 270 122 248 Q120 218 130 202 Q136 194 144 192 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="1.2"/>'+
    '<path d="M156 192 Q166 206 166 242 Q166 266 154 278 Q142 286 132 280 Q122 270 122 248 Q120 218 130 202 Q136 194 144 192 Z" fill="'+z('quads')+'" opacity="0.7"/>'+
    // Glutes
    '<path d="M52 190 Q44 196 46 208 Q50 202 56 196 Z" fill="'+z('glutes')+'" opacity="0.5"/>'+
    '<path d="M148 190 Q156 196 154 208 Q150 202 144 196 Z" fill="'+z('glutes')+'" opacity="0.5"/>'+
    // Hamstrings
    '<path d="M34 210 Q26 226 28 254 Q30 270 40 278 Q32 260 34 238 Q36 222 42 212 Z" fill="'+z('hamstrings')+'" opacity="0.55"/>'+
    '<path d="M166 210 Q174 226 172 254 Q170 270 160 278 Q168 260 166 238 Q164 222 158 212 Z" fill="'+z('hamstrings')+'" opacity="0.55"/>'+
    // Knee armor
    '<ellipse cx="56" cy="280" rx="16" ry="12" fill="'+red+'" stroke="'+brightRed+'" stroke-width="1"/>'+
    '<ellipse cx="144" cy="280" rx="16" ry="12" fill="'+red+'" stroke="'+brightRed+'" stroke-width="1"/>'+
    // Shin armor
    '<path d="M38 280 Q30 294 32 326 Q34 346 44 352 Q56 358 64 350 Q72 338 70 314 Q68 296 58 280 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="1"/>'+
    '<path d="M38 280 Q30 294 32 326 Q34 346 44 352 Q56 358 64 350 Q72 338 70 314 Q68 296 58 280 Z" fill="'+z('calves')+'" opacity="0.65"/>'+
    '<path d="M162 280 Q170 294 168 326 Q166 346 156 352 Q144 358 136 350 Q128 338 130 314 Q132 296 142 280 Z" fill="'+darkRed+'" stroke="'+brightRed+'" stroke-width="1"/>'+
    '<path d="M162 280 Q170 294 168 326 Q166 346 156 352 Q144 358 136 350 Q128 338 130 314 Q132 296 142 280 Z" fill="'+z('calves')+'" opacity="0.65"/>'+
    // Heavy boots
    '<path d="M28 350 Q22 360 26 370 L74 370 Q80 360 72 350 Z" fill="'+blk+'" stroke="'+brightRed+'" stroke-width="1"/>'+
    '<path d="M172 350 Q178 360 174 370 L126 370 Q120 360 128 350 Z" fill="'+blk+'" stroke="'+brightRed+'" stroke-width="1"/>'+
    '</svg>';
  }

  // ══════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════
  function render(theme,heatFn,mode,width,height){
    if(theme==='bos')return renderT60(heatFn,mode,width,height);
    if(theme==='ncr')return renderNCR(heatFn,mode,width,height);
    if(theme==='enclave')return renderEnclave(heatFn,mode,width,height);
    if(theme==='vaulttec')return renderVaultBoy(heatFn,mode,width,height);
    // Default: human (pipboy or baker)
    return renderHuman(heatFn,theme||'baker',mode,width,height);
  }

  return{render:render};
})();
