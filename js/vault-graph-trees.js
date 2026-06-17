var TREE_BARK_COLORS={
  lecture:    '#d4c5a9', // silver-white birch bark
  general:    '#7a5c3a', // rich brown oak bark
  daily:      '#2d5a1b', // deep forest pine green
  conversation:'#8b6914', // golden hickory bark
  project:    '#c8b84a'  // ginkgo gold (fall color)
};
var TREE_FOLIAGE_COLORS={
  lecture:    '#b8d4a0', // pale birch green
  general:    '#3d6b2a', // deep oak green
  daily:      '#1a4a0e', // very dark pine green
  conversation:'#5a8a2a', // medium hickory green
  project:    '#d4a017'  // ginkgo golden yellow
};
function _drawTreeSpecies(ctx,type,cx,baseY,slotW,treeH,col){
  // Use real botanical colors blended 60% real / 40% type color
  var bark=TREE_BARK_COLORS[type]||col;
  var foliage=TREE_FOLIAGE_COLORS[type]||col;
  if(type==='lecture')           _drawBirch(ctx,cx,baseY,slotW,treeH,bark,foliage);
  else if(type==='general')      _drawOak(ctx,cx,baseY,slotW,treeH,bark,foliage);
  else if(type==='daily')        _drawPine(ctx,cx,baseY,slotW,treeH,bark,foliage);
  else if(type==='conversation')  _drawHickory(ctx,cx,baseY,slotW,treeH,bark,foliage);
  else if(type==='project')      _drawGinkgo(ctx,cx,baseY,slotW,treeH,bark,foliage);
}

// ── BIRCH (lecture) ──────────────────────────────────────
// Elegant, slender, tall. White/silver bark with horizontal lenticels.
// Delicate drooping branches, multi-stem at base. Very distinctive silhouette.
function _drawBirch(ctx,cx,baseY,slotW,treeH,col,foliage){
  foliage=foliage||col;
  var tw=slotW*0.042;
  var trunkTop=baseY-treeH*0.82;

  // Multi-stem base — birch often grows in clumps of 2-3
  var stems=[
    {ox:-slotW*0.060, lean:-0.05},
    {ox:0,            lean: 0.00},
    {ox: slotW*0.052, lean: 0.04}
  ];
  stems.forEach(function(s){
    ctx.beginPath();
    ctx.moveTo(cx+s.ox-tw,baseY);
    ctx.quadraticCurveTo(cx+s.ox*1.2-tw*0.5, baseY-treeH*0.45, cx+s.ox+s.lean*treeH-tw*0.3, trunkTop+treeH*0.12);
    ctx.quadraticCurveTo(cx+s.ox*1.2+tw*0.5, baseY-treeH*0.45, cx+s.ox+s.lean*treeH+tw*0.3, trunkTop+treeH*0.12);
    ctx.closePath();
    ctx.fillStyle=col;ctx.fill();
  });

  // Horizontal bark lenticels — the signature white birch marks
  for(var i=0;i<7;i++){
    var by=baseY-treeH*(0.08+i*0.11);
    var bw=tw*(1.1-i*0.06);
    ctx.beginPath();ctx.rect(cx-bw*2.2,by,bw*4.4,tw*0.35);
    ctx.fillStyle=col;ctx.fill();
    // Second stem mark
    ctx.beginPath();ctx.rect(cx+slotW*0.048-bw*2,by+tw*0.5,bw*3.5,tw*0.3);
    ctx.fillStyle=col;ctx.fill();
  }

  // Canopy — tall narrow oval, slightly asymmetric
  // Main center canopy
  ctx.beginPath();
  ctx.ellipse(cx,trunkTop+treeH*0.16,slotW*0.24,treeH*0.28,0,0,Math.PI*2);
  ctx.fillStyle=foliage;ctx.fill();

  // Right secondary canopy
  ctx.beginPath();
  ctx.ellipse(cx+slotW*0.14,trunkTop+treeH*0.24,slotW*0.17,treeH*0.20,0.15,0,Math.PI*2);
  ctx.fillStyle=foliage;ctx.fill();

  // Left secondary canopy
  ctx.beginPath();
  ctx.ellipse(cx-slotW*0.12,trunkTop+treeH*0.28,slotW*0.15,treeH*0.17,-0.12,0,Math.PI*2);
  ctx.fillStyle=foliage;ctx.fill();

  // Drooping branch sprays — birch has very distinctive pendulous branches
  var branchData=[
    {bx:cx-slotW*0.18, by:trunkTop+treeH*0.18, dx:-slotW*0.12, dy:treeH*0.14, n:4},
    {bx:cx+slotW*0.16, by:trunkTop+treeH*0.20, dx: slotW*0.12, dy:treeH*0.12, n:3},
    {bx:cx-slotW*0.14, by:trunkTop+treeH*0.34, dx:-slotW*0.16, dy:treeH*0.15, n:5},
    {bx:cx+slotW*0.12, by:trunkTop+treeH*0.36, dx: slotW*0.14, dy:treeH*0.13, n:4},
  ];
  branchData.forEach(function(b){
    for(var i=0;i<b.n;i++){
      var t=i/(b.n-1||1);
      ctx.beginPath();
      ctx.moveTo(b.bx,b.by);
      ctx.quadraticCurveTo(b.bx+b.dx*0.4,b.by+b.dy*0.3,b.bx+b.dx*(0.7+t*0.3),b.by+b.dy*(0.6+t*0.4));
      ctx.strokeStyle=col;ctx.lineWidth=tw*0.35;ctx.stroke();
    }
  });
}

// ── OAK (general) ────────────────────────────────────────
// The king. Massive spreading crown, deeply furrowed bark, gnarled branches.
// Short thick trunk, crown wider than tall. Ancient and powerful.
function _drawOak(ctx,cx,baseY,slotW,treeH,col,foliage){
  foliage=foliage||col;
  var tw=slotW*0.10;
  var trunkH=treeH*0.38;
  var trunkTop=baseY-trunkH;

  // Thick gnarled trunk — buttress roots flare dramatically at base
  ctx.beginPath();
  ctx.moveTo(cx-tw*2.2,baseY);
  ctx.quadraticCurveTo(cx-tw*1.8,baseY-trunkH*0.08,cx-tw*1.0,baseY-trunkH*0.22);
  ctx.quadraticCurveTo(cx-tw*0.7,baseY-trunkH*0.5,cx-tw*0.52,trunkTop);
  ctx.lineTo(cx+tw*0.52,trunkTop);
  ctx.quadraticCurveTo(cx+tw*0.7,baseY-trunkH*0.5,cx+tw*1.0,baseY-trunkH*0.22);
  ctx.quadraticCurveTo(cx+tw*1.8,baseY-trunkH*0.08,cx+tw*2.2,baseY);
  ctx.closePath();
  ctx.fillStyle=col;ctx.fill();
  // Extra buttress roots left and right
  [[-1.6,-2.8,0.04],[ 1.6, 2.8,0.04]].forEach(function(r){
    ctx.beginPath();
    ctx.moveTo(cx+r[0]*tw,baseY-trunkH*0.12);
    ctx.quadraticCurveTo(cx+r[1]*tw,baseY-trunkH*0.04,cx+r[1]*tw*1.1,baseY);
    ctx.strokeStyle=col;ctx.lineWidth=tw*0.8;ctx.lineCap='round';ctx.stroke();
  });

  // Bark texture — vertical fissures
  for(var i=0;i<4;i++){
    var fx=cx-tw*0.4+i*tw*0.25;
    ctx.beginPath();
    ctx.moveTo(fx,baseY-trunkH*0.1);
    ctx.lineTo(fx+tw*0.05,baseY-trunkH*0.55);
    ctx.strokeStyle=col;ctx.lineWidth=tw*0.18;ctx.stroke();
  }

  // Primary scaffold branches — the gnarled low branches oak is famous for
  var scaffolds=[
    {sx:cx-tw*0.3,sy:trunkTop,ex:cx-slotW*0.44,ey:trunkTop-treeH*0.12,mx:cx-slotW*0.22,my:trunkTop+treeH*0.04},
    {sx:cx+tw*0.3,sy:trunkTop,ex:cx+slotW*0.42,ey:trunkTop-treeH*0.10,mx:cx+slotW*0.20,my:trunkTop+treeH*0.05},
    {sx:cx-tw*0.1,sy:trunkTop,ex:cx-slotW*0.18,ey:trunkTop-treeH*0.28,mx:cx-slotW*0.08,my:trunkTop-treeH*0.08},
    {sx:cx+tw*0.1,sy:trunkTop,ex:cx+slotW*0.16,ey:trunkTop-treeH*0.30,mx:cx+slotW*0.07,my:trunkTop-treeH*0.09},
  ];
  scaffolds.forEach(function(s){
    ctx.beginPath();
    ctx.moveTo(s.sx,s.sy);
    ctx.quadraticCurveTo(s.mx,s.my,s.ex,s.ey);
    ctx.strokeStyle=col;ctx.lineWidth=tw*0.5;ctx.lineCap='round';ctx.stroke();
  });

  // Massive multi-lobed crown — oak crown is wider than it is tall
  // Central dome
  ctx.beginPath();
  ctx.ellipse(cx,trunkTop-treeH*0.22,slotW*0.40,treeH*0.30,0,0,Math.PI*2);
  ctx.fillStyle=foliage;ctx.fill();
  // Left lobe
  ctx.beginPath();
  ctx.ellipse(cx-slotW*0.34,trunkTop-treeH*0.10,slotW*0.28,treeH*0.22,-0.2,0,Math.PI*2);
  ctx.fillStyle=foliage;ctx.fill();
  // Right lobe
  ctx.beginPath();
  ctx.ellipse(cx+slotW*0.32,trunkTop-treeH*0.10,slotW*0.26,treeH*0.22,0.2,0,Math.PI*2);
  ctx.fillStyle=foliage;ctx.fill();
  // Top lobe
  ctx.beginPath();
  ctx.ellipse(cx,trunkTop-treeH*0.44,slotW*0.22,treeH*0.18,0,0,Math.PI*2);
  ctx.fillStyle=foliage;ctx.fill();
  // Low side lobes — oak hangs low
  ctx.beginPath();
  ctx.ellipse(cx-slotW*0.42,trunkTop-treeH*0.01,slotW*0.18,treeH*0.14,0.3,0,Math.PI*2);
  ctx.fillStyle=foliage;ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx+slotW*0.40,trunkTop-treeH*0.01,slotW*0.17,treeH*0.14,-0.3,0,Math.PI*2);
  ctx.fillStyle=foliage;ctx.fill();
}

// ── PINE (daily) ─────────────────────────────────────────
// Classic conifer. Perfectly symmetric layered tiers, straight trunk,
// sharp pointed top. Strong, reliable, geometric. Loblolly/Eastern White pine.
function _drawPine(ctx,cx,baseY,slotW,treeH,col,foliage){
  foliage=foliage||col;
  var tw=slotW*0.048;
  var trunkH=treeH*0.22;
  var trunkTop=baseY-trunkH;

  // Straight trunk — pine trunks are very straight and cylindrical
  ctx.beginPath();
  ctx.rect(cx-tw*0.55,baseY-trunkH,tw*1.1,trunkH);
  ctx.fillStyle=col;ctx.fill();

  // Bark plates — pine has plated scaly bark
  for(var p=0;p<5;p++){
    var py=baseY-trunkH*0.12-p*trunkH*0.17;
    ctx.beginPath();
    ctx.rect(cx-tw*0.5,py,tw,trunkH*0.12);
    ctx.fillStyle=col;ctx.fill();
  }

  // 6 tiers — graduated spacing, wider gaps at bottom like real pine
  var tiers=6;
  var crownH=treeH-trunkH;
  for(var i=0;i<tiers;i++){
    var frac=i/tiers;
    var tierW=slotW*(0.44-frac*0.09);
    // Tiers are more evenly spaced — no extreme stretching
    var tierBaseY=trunkTop-(crownH*frac*0.88);
    var tierH=crownH*0.17*(1-frac*0.25);
    var tierTopY=tierBaseY-tierH;

    // Slightly curved tier edges for natural look — pine tiers droop slightly
    ctx.beginPath();
    ctx.moveTo(cx,tierTopY);
    ctx.quadraticCurveTo(cx-tierW*0.5,tierBaseY-tierH*0.3,cx-tierW,tierBaseY);
    ctx.quadraticCurveTo(cx,tierBaseY+tierH*0.08,cx+tierW,tierBaseY);
    ctx.quadraticCurveTo(cx+tierW*0.5,tierBaseY-tierH*0.3,cx,tierTopY);
    ctx.fillStyle=foliage;ctx.fill();

    // Upswept tips with secondary needles
    [[-1,1],[1,1]].forEach(function(s){
      ctx.beginPath();
      ctx.moveTo(cx+s[0]*tierW,tierBaseY);
      ctx.quadraticCurveTo(cx+s[0]*tierW*0.78,tierBaseY-tierH*0.35,cx+s[0]*tierW*0.62,tierBaseY-tierH*0.5);
      ctx.strokeStyle=col;ctx.lineWidth=tw*0.38;ctx.lineCap='round';ctx.stroke();
      // Needle tufts at tip
      for(var n=0;n<3;n++){
        var nfrac=n/2;
        ctx.beginPath();
        ctx.moveTo(cx+s[0]*(tierW*0.72-nfrac*tierW*0.18),tierBaseY-tierH*(0.18+nfrac*0.22));
        ctx.lineTo(cx+s[0]*(tierW*0.82-nfrac*tierW*0.10),tierBaseY-tierH*(0.04+nfrac*0.12));
        ctx.strokeStyle=foliage;ctx.lineWidth=tw*0.22;ctx.stroke();
      }
    });
  }

  // Dead branch stubs on lower trunk — very characteristic of pine
  [0.15,0.28,0.40].forEach(function(yf){
    [-1,1].forEach(function(s){
      ctx.beginPath();
      ctx.moveTo(cx+s*tw*0.5,baseY-trunkH*yf);
      ctx.lineTo(cx+s*(tw*0.5+slotW*0.06),baseY-trunkH*(yf+0.04));
      ctx.strokeStyle=col;ctx.lineWidth=tw*0.3;ctx.lineCap='round';ctx.stroke();
    });
  });

  // Sharp pointed leader
  ctx.beginPath();
  ctx.moveTo(cx,baseY-treeH);
  ctx.lineTo(cx-slotW*0.035,trunkTop-crownH*0.84);
  ctx.lineTo(cx+slotW*0.035,trunkTop-crownH*0.84);
  ctx.closePath();
  ctx.fillStyle=foliage;ctx.fill();
}

// ── HICKORY (conversation) ────────────────────────────────
// Tall straight hardwood, high crown, compound leaves make for
// an airy irregular silhouette. Trunk is very straight with tight bark.
// One of the strongest North American hardwoods.
function _drawHickory(ctx,cx,baseY,slotW,treeH,col,foliage){
  foliage=foliage||col;
  var tw=slotW*0.055;
  var trunkH=treeH*0.52;
  var trunkTop=baseY-trunkH;

  // Very straight tall trunk — hickory is notably upright
  ctx.beginPath();
  ctx.moveTo(cx-tw*0.55,baseY);
  ctx.lineTo(cx-tw*0.42,trunkTop);
  ctx.lineTo(cx+tw*0.42,trunkTop);
  ctx.lineTo(cx+tw*0.55,baseY);
  ctx.closePath();
  ctx.fillStyle=col;ctx.fill();

  // Tight ridged bark — hickory has very tight interlacing ridges
  for(var r=0;r<6;r++){
    var ry=baseY-trunkH*0.08-r*trunkH*0.14;
    ctx.beginPath();
    ctx.moveTo(cx-tw*0.4,ry);
    ctx.lineTo(cx-tw*0.1,ry-trunkH*0.05);
    ctx.lineTo(cx+tw*0.3,ry-trunkH*0.02);
    ctx.strokeStyle=col;ctx.lineWidth=tw*0.2;ctx.stroke();
  }

  // High crown branches — hickory branches emerge high up
  // Primary branches angle outward then upward (compound leaf habit)
  var branches=[
    {sx:cx-tw*0.3,sy:trunkTop,        ex:cx-slotW*0.32,ey:trunkTop-treeH*0.14},
    {sx:cx+tw*0.3,sy:trunkTop,        ex:cx+slotW*0.30,ey:trunkTop-treeH*0.12},
    {sx:cx-tw*0.2,sy:trunkTop-treeH*0.04, ex:cx-slotW*0.22,ey:trunkTop-treeH*0.32},
    {sx:cx+tw*0.2,sy:trunkTop-treeH*0.04, ex:cx+slotW*0.20,ey:trunkTop-treeH*0.34},
    {sx:cx,       sy:trunkTop-treeH*0.06, ex:cx-slotW*0.08,ey:trunkTop-treeH*0.44},
    {sx:cx,       sy:trunkTop-treeH*0.06, ex:cx+slotW*0.06,ey:trunkTop-treeH*0.46},
  ];
  branches.forEach(function(b){
    ctx.beginPath();
    ctx.moveTo(b.sx,b.sy);
    ctx.quadraticCurveTo((b.sx+b.ex)/2,b.sy-(Math.abs(b.ey-b.sy)*0.3),b.ex,b.ey);
    ctx.strokeStyle=col;ctx.lineWidth=tw*0.45;ctx.lineCap='round';ctx.stroke();
  });

  // Airy irregular crown — compound leaves create open irregular texture
  // Multiple small-medium blobs rather than one solid mass
  var crownBlobs=[
    {ox:0,        oy:-0.52, rx:0.18,ry:0.16},
    {ox:-0.24,    oy:-0.38, rx:0.16,ry:0.14},
    {ox: 0.22,    oy:-0.36, rx:0.15,ry:0.13},
    {ox:-0.14,    oy:-0.60, rx:0.13,ry:0.12},
    {ox: 0.12,    oy:-0.62, rx:0.12,ry:0.11},
    {ox:-0.28,    oy:-0.20, rx:0.14,ry:0.12},
    {ox: 0.26,    oy:-0.20, rx:0.13,ry:0.11},
    {ox:0,        oy:-0.70, rx:0.10,ry:0.10},
  ];
  crownBlobs.forEach(function(b){
    ctx.beginPath();
    ctx.ellipse(cx+b.ox*slotW,trunkTop+b.oy*treeH,b.rx*slotW,b.ry*treeH,0,0,Math.PI*2);
    ctx.fillStyle=foliage;ctx.fill();
  });
}

// ── GINKGO (project) ─────────────────────────────────────
// THE SURPRISE. Ancient living fossil, 270 million years old.
// Unmistakable fan-shaped bilobed leaves, conical young shape
// but mature ginkgos have very distinctive tiered horizontal branching.
// Brilliant yellow in fall. Perfect for "project" — ancient, enduring, unique.
function _drawGinkgo(ctx,cx,baseY,slotW,treeH,col,foliage){
  foliage=foliage||col;
  var tw=slotW*0.052;
  var trunkH=treeH*0.35;
  var trunkTop=baseY-trunkH;

  // Straight trunk — ginkgo has a very clean straight trunk
  ctx.beginPath();
  ctx.moveTo(cx-tw*0.6,baseY);
  ctx.lineTo(cx-tw*0.44,trunkTop);
  ctx.lineTo(cx+tw*0.44,trunkTop);
  ctx.lineTo(cx+tw*0.6,baseY);
  ctx.closePath();
  ctx.fillStyle=col;ctx.fill();

  // Draw a genuine ginkgo fan leaf shape
  function drawFanLeaf(fx,fy,r,angle){
    ctx.save();
    ctx.translate(fx,fy);
    ctx.rotate(angle);
    // Fan shape — semicircle with a central notch (the defining ginkgo feature)
    ctx.beginPath();
    ctx.arc(0,0,r,Math.PI,0); // top semicircle
    ctx.closePath();
    ctx.fillStyle=foliage;ctx.fill();
    // Central notch — cut out a small triangle from the top
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(-r*0.15,-r*0.55);
    ctx.lineTo(r*0.15,-r*0.55);
    ctx.closePath();
    // We can't actually cut out, so draw the notch as a thin line instead
    ctx.strokeStyle=col;ctx.lineWidth=r*0.12;ctx.stroke();
    // Veins radiating from stem — very visible in ginkgo
    for(var v=-3;v<=3;v++){
      ctx.beginPath();
      ctx.moveTo(0,0);
      var vang=v*(Math.PI/8);
      ctx.lineTo(Math.sin(vang)*r*0.85,-Math.cos(vang)*r*0.85);
      ctx.strokeStyle=col;ctx.lineWidth=r*0.06;ctx.stroke();
    }
    ctx.restore();
  }

  // Horizontal tiered branches — mature ginkgo has very distinctive
  // horizontal whorls of branches at each tier
  var tierData=[
    {y:trunkTop+treeH*0.05, spread:0.38, fans:5, fanR:0.12, sW:slotW},
    {y:trunkTop-treeH*0.10, spread:0.30, fans:4, fanR:0.10, sW:slotW},
    {y:trunkTop-treeH*0.24, spread:0.22, fans:3, fanR:0.09, sW:slotW},
    {y:trunkTop-treeH*0.36, spread:0.16, fans:3, fanR:0.08, sW:slotW},
    {y:trunkTop-treeH*0.48, spread:0.10, fans:2, fanR:0.07, sW:slotW},
  ];

  tierData.forEach(function(tier,i){
    // Draw horizontal branch line
    ctx.beginPath();
    ctx.moveTo(cx-tier.spread*slotW,tier.y);
    ctx.lineTo(cx+tier.spread*slotW,tier.y);
    ctx.strokeStyle=col;ctx.lineWidth=tw*0.4;ctx.stroke();

    // Fan leaves clustered at branch tips and along branches
    for(var f=0;f<tier.fans;f++){
      var fx=cx-tier.spread*slotW+(f/(Math.max(tier.fans-1,1)))*tier.spread*slotW*2;
      var fanR=tier.fanR*slotW*(0.85+((f*7+i*3)%5)*0.07);
      // Small cluster of 2-3 fans at each position
      drawFanLeaf(fx,tier.y-fanR*0.3,fanR,0);
      if(f===0||f===tier.fans-1){
        drawFanLeaf(fx+(f===0?-1:1)*fanR*0.5,tier.y-fanR*0.5,fanR*0.7,(f===0?-0.3:0.3));
      }
    }
  });

  // Crown tuft at very top
  drawFanLeaf(cx,trunkTop-treeH*0.55,slotW*0.08,0);
  drawFanLeaf(cx-slotW*0.06,trunkTop-treeH*0.52,slotW*0.065,-0.4);
  drawFanLeaf(cx+slotW*0.06,trunkTop-treeH*0.52,slotW*0.065,0.4);
}

// ── WALNUT (orphan grove) ─────────────────────────────────
// Black walnut — one of the most prized North American hardwoods.
// Deep dark furrowed bark, compound leaves, distinctive divided crown.
// Perfect for a woodworker to recognize.
function _drawWalnut(ctx,cx,baseY,slotW,treeH,col,foliage){
  foliage=foliage||col;
  var tw=slotW*0.082;
  var trunkH=treeH*0.38;
  var trunkTop=baseY-trunkH;

  // Main trunk — walnut has very dark deeply furrowed bark, slight taper
  ctx.beginPath();
  ctx.moveTo(cx-tw*1.5,baseY);
  ctx.quadraticCurveTo(cx-tw*1.1,baseY-trunkH*0.2,cx-tw*0.6,baseY-trunkH*0.5);
  ctx.lineTo(cx-tw*0.48,trunkTop);
  ctx.lineTo(cx+tw*0.48,trunkTop);
  ctx.lineTo(cx+tw*0.6,baseY-trunkH*0.5);
  ctx.quadraticCurveTo(cx+tw*1.1,baseY-trunkH*0.2,cx+tw*1.5,baseY);
  ctx.closePath();
  ctx.fillStyle=col;ctx.fill();

  // Deep vertical furrows — walnut bark is very deeply ridged
  for(var f=0;f<5;f++){
    var fx=cx-tw*0.8+f*tw*0.38;
    ctx.beginPath();
    ctx.moveTo(fx,baseY-trunkH*0.05);
    ctx.bezierCurveTo(fx-tw*0.08,baseY-trunkH*0.3,fx+tw*0.08,baseY-trunkH*0.5,fx,baseY-trunkH*0.85);
    ctx.strokeStyle=col;ctx.lineWidth=tw*0.22;ctx.stroke();
  }

  // Walnut divides into 2-3 main scaffold limbs fairly low
  var scaffolds=[
    {ex:cx-slotW*0.28,ey:trunkTop-treeH*0.08,w:tw*0.65},
    {ex:cx+slotW*0.25,ey:trunkTop-treeH*0.07,w:tw*0.60},
    {ex:cx-slotW*0.05,ey:trunkTop-treeH*0.18,w:tw*0.50},
  ];
  scaffolds.forEach(function(s){
    ctx.beginPath();
    ctx.moveTo(cx,trunkTop+tw*0.3);
    ctx.quadraticCurveTo((cx+s.ex)/2,trunkTop-treeH*0.04,s.ex,s.ey);
    ctx.strokeStyle=col;ctx.lineWidth=s.w;ctx.lineCap='round';ctx.stroke();
  });

  // Wide rounded crown — two overlapping domes (one per main scaffold)
  // Walnut has a broad spreading crown
  ctx.beginPath();
  ctx.ellipse(cx-slotW*0.14,trunkTop-treeH*0.22,slotW*0.32,treeH*0.24,0,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx+slotW*0.12,trunkTop-treeH*0.22,slotW*0.30,treeH*0.23,0,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
  // Top join
  ctx.beginPath();
  ctx.ellipse(cx,trunkTop-treeH*0.34,slotW*0.22,treeH*0.16,0,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();

  // Compound leaf clusters at branch tips — walnut has very large compound leaves
  // Draw as small radiating finger shapes
  function leafCluster(lx,ly,r){
    // Compound leaf — central rachis with paired leaflets
    ctx.beginPath();
    ctx.moveTo(lx,ly);ctx.lineTo(lx,ly-r*0.9);
    ctx.strokeStyle=foliage;ctx.lineWidth=r*0.1;ctx.stroke();
    for(var i=0;i<5;i++){
      var lfrac=i/4;
      var ly2=ly-r*(0.15+lfrac*0.72);
      [-1,1].forEach(function(s){
        ctx.beginPath();
        ctx.ellipse(lx+s*r*0.38,ly2,r*0.30,r*0.13,s*0.4,0,Math.PI*2);
        ctx.fillStyle=foliage;ctx.fill();
      });
    }
    // Terminal leaflet at top
    ctx.beginPath();
    ctx.ellipse(lx,ly-r*0.95,r*0.22,r*0.12,0,0,Math.PI*2);
    ctx.fillStyle=foliage;ctx.fill();
  }
  leafCluster(cx-slotW*0.28,trunkTop-treeH*0.18,slotW*0.08);
  leafCluster(cx+slotW*0.24,trunkTop-treeH*0.17,slotW*0.08);
  leafCluster(cx,trunkTop-treeH*0.42,slotW*0.07);
}
// ── Draw Yggdrasil decorations ────────────────────────────
function _drawYggdrasil(ctx,W,H){
  var CX=W*0.5,TRUNK_Y=H*0.78;
  var grad=ctx.createLinearGradient(CX,H*0.95,CX,H*0.06);
  grad.addColorStop(0,'rgba(74,222,128,0.08)');
  grad.addColorStop(0.4,'rgba(124,106,247,0.15)');
  grad.addColorStop(1,'rgba(124,106,247,0.04)');
  ctx.beginPath();ctx.moveTo(CX,H*0.95);ctx.lineTo(CX,H*0.06);
  ctx.strokeStyle=grad;ctx.lineWidth=3;ctx.stroke();
  ctx.beginPath();ctx.arc(CX,TRUNK_Y,22,0,Math.PI*2);
  ctx.strokeStyle='rgba(124,106,247,0.35)';ctx.lineWidth=1.5;ctx.stroke();
  ctx.beginPath();ctx.arc(CX,TRUNK_Y,8,0,Math.PI*2);
  ctx.fillStyle='rgba(124,106,247,0.2)';ctx.fill();
  ctx.font='bold 9px IBM Plex Mono, monospace';
  ctx.fillStyle='rgba(232,230,240,0.25)';ctx.textAlign='center';
  ctx.fillText('YGGDRASIL',CX,H*0.06-8);
  var TYPE_ORDER=['conversation','project','lecture','daily','general'];
  var activeTypes=TYPE_ORDER.filter(function(t){
    return graphNodes.some(function(n){return n.type===t&&!n.orphan;});
  });
  var numBranches=activeTypes.length;
  var angleStart=-Math.PI*0.88,angleEnd=-Math.PI*0.12;
  var branchLabelDist=(TRUNK_Y-H*0.06)*0.45;
  activeTypes.forEach(function(type,bi){
    var t=numBranches===1?0.5:(bi/(numBranches-1));
    var angle=angleStart+(angleEnd-angleStart)*t;
    var lx=CX+Math.cos(angle)*branchLabelDist;
    var ly=TRUNK_Y+Math.sin(angle)*branchLabelDist;
    var col=typeColors[type]||'#7c6af7';
    ctx.font='bold 9px IBM Plex Mono, monospace';
    ctx.fillStyle=col+'99';ctx.textAlign='center';
    ctx.fillText(type.toUpperCase(),lx,ly-14);
  });
  var orphanCount=graphNodes.filter(function(n){return n.orphan;}).length;
  ctx.font='9px IBM Plex Mono, monospace';
  ctx.fillStyle=ORPHAN_COLOR+'60';ctx.textAlign='center';
  if(orphanCount>0)ctx.fillText('roots ('+orphanCount+')',CX,H*0.97);
  ctx.textAlign='left';
}

// ── Draw cluster halos ────────────────────────────────────
function _drawClusterHalos(ctx){
  var typeOrder=['conversation','project','lecture','daily','general'];
  typeOrder.forEach(function(t){
    var members=graphNodes.filter(function(n){return n.type===t&&!n.orphan;});
    if(members.length<2)return;
    var cx=members.reduce(function(s,n){return s+n.x;},0)/members.length;
    var cy=members.reduce(function(s,n){return s+n.y;},0)/members.length;
    var maxR=members.reduce(function(m,n){
      return Math.max(m,Math.sqrt((n.x-cx)*(n.x-cx)+(n.y-cy)*(n.y-cy)));
    },0)+30;
    ctx.beginPath();ctx.arc(cx,cy,maxR,0,Math.PI*2);
    ctx.fillStyle=(typeColors[t]||'#7c6af7')+'0d';
    ctx.strokeStyle=(typeColors[t]||'#7c6af7')+'28';
    ctx.lineWidth=1;ctx.fill();ctx.stroke();
  });
  var orphans=graphNodes.filter(function(n){return n.orphan;});
  if(orphans.length>0){
    var ocx=orphans.reduce(function(s,n){return s+n.x;},0)/orphans.length;
    var ocy=orphans.reduce(function(s,n){return s+n.y;},0)/orphans.length;
    var omaxR=orphans.reduce(function(m,n){
      return Math.max(m,Math.sqrt((n.x-ocx)*(n.x-ocx)+(n.y-ocy)*(n.y-ocy)));
    },0)+30;
    ctx.beginPath();ctx.arc(ocx,ocy,omaxR,0,Math.PI*2);
    ctx.fillStyle=ORPHAN_COLOR+'08';ctx.strokeStyle=ORPHAN_COLOR+'28';
    ctx.lineWidth=1;ctx.fill();ctx.stroke();
    ctx.font='10px IBM Plex Mono, monospace';
    ctx.fillStyle=ORPHAN_COLOR+'80';ctx.textAlign='center';
    ctx.fillText('orphans',ocx,ocy-omaxR-6);ctx.textAlign='left';
  }
}

// ── Draw a single node (with leaf sway) ──────────────────
function _drawNode(ctx,n,matchedNodes,brightness){
  var isPinned=!!pinnedNodes[n.id];
  var isOrphan=n.orphan;
  var color=isOrphan?ORPHAN_COLOR:(typeColors[n.type]||'#7c6af7');
  var isHv=hoveredNode&&hoveredNode.id===n.id;
  var isCn=hoveredNode&&graphEdges.some(function(e){
    return(e.a===hoveredNode.id&&e.b===n.id)||(e.b===hoveredNode.id&&e.a===n.id);
  });
  var isMatch=matchedNodes&&matchedNodes[n.id];
  var r=isHv?n.radius*2.2:isCn?n.radius*1.4:isMatch?n.radius*1.8:n.radius;

  // Leaf sway — only in tree/ygg modes and for leaf nodes
  var drawX=n.x,drawY=n.y;
  var isStaticLeafMode=(GraphSettings.treeMode||GraphSettings.yggdrasilMode);
  if(isStaticLeafMode&&n.isLeaf&&!isPinned){
    var swayAmt=2.5;
    var freq=0.6+((n.swayOffset||0)*0.3);
    drawX=n.x+Math.sin(swayTime*freq+(n.swayOffset||0))*swayAmt;
    drawY=n.y+Math.cos(swayTime*freq*0.7+(n.swayOffset||0))*swayAmt*0.4;
  }

  if(isPinned){ctx.shadowColor='#f87171';ctx.shadowBlur=12;}
  else if(isHv){ctx.shadowColor=color;ctx.shadowBlur=16;}
  else if(isMatch){ctx.shadowColor='#fde047';ctx.shadowBlur=16;}
  else if(isCn){ctx.shadowColor=color;ctx.shadowBlur=8;}
  else if(isOrphan){ctx.shadowColor=ORPHAN_COLOR;ctx.shadowBlur=6;}
  else{ctx.shadowBlur=0;}

  var baseAlpha=Math.round((0.30+brightness*0.70)*255).toString(16).padStart(2,'0');
  var query=GraphSettings.searchQuery||'';

  ctx.beginPath();ctx.arc(drawX,drawY,r,0,Math.PI*2);
  var fillColor;
  if(isPinned){fillColor='#f87171';}
  else if(isHv){fillColor=color;}
  else if(query){fillColor=isMatch?color:(color+'22');}
  else if(isCn){fillColor=color+'cc';}
  else{fillColor=color+baseAlpha;}
  ctx.fillStyle=fillColor;ctx.fill();

  if(isPinned){
    ctx.shadowBlur=0;ctx.strokeStyle='#f87171';ctx.lineWidth=1.5;
    var boxS=r*2+6;ctx.strokeRect(drawX-boxS/2,drawY-boxS/2,boxS,boxS);
  }

  var showLabel=isHv||isMatch||isPinned||GraphSettings.showLabels||(graphTransform.scale>1.8);
  if(showLabel){
    ctx.shadowBlur=0;
    ctx.font=(isHv||isMatch?'bold ':'')+'10px IBM Plex Mono, monospace';
    ctx.fillStyle=isPinned?'#f87171':(isHv||isMatch)?'rgba(232,230,240,1)':'rgba(232,230,240,0.6)';
    ctx.fillText(n.name,drawX+r+3,drawY+3);
  }
  ctx.shadowBlur=0;
}
