// ── Draw functions (vault-graph-draw.js) ────────────────
// ── Draw curved branch edge ─────────────────────────────
function _drawBranchEdge(ctx,a,b,col,isHL,baseW){
  var mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  var trunkY=Math.max(a.y,b.y);
  var cpx=mx+(((a.id*7+b.id*3)%9)-4)*4; // deterministic, no random per frame
  var cpy=my+(trunkY-my)*0.3;
  ctx.beginPath();ctx.moveTo(a.x,a.y);
  ctx.quadraticCurveTo(cpx,cpy,b.x,b.y);
  ctx.strokeStyle=isHL?(col+'dd'):(col+'28');
  ctx.lineWidth=isHL?Math.max(baseW,1.8):Math.max(baseW,0.8);
  if(isHL){ctx.shadowColor=col+'88';ctx.shadowBlur=6;}else{ctx.shadowBlur=0;}
  ctx.stroke();ctx.shadowBlur=0;
}

// ── Draw arcing cross-type edge ───────────────────────────
function _drawArcEdge(ctx,a,b,isHL,baseW){
  var mx=(a.x+b.x)/2;
  var my=(a.y+b.y)/2;
  // Arc rises above both nodes
  var rise=Math.min(Math.abs(b.x-a.x)*0.4,120);
  var cpx=mx;
  var cpy=Math.min(a.y,b.y)-rise;
  ctx.beginPath();ctx.moveTo(a.x,a.y);
  ctx.quadraticCurveTo(cpx,cpy,b.x,b.y);
  ctx.strokeStyle=isHL?'rgba(124,106,247,0.5)':'rgba(124,106,247,0.05)';
  ctx.lineWidth=isHL?1.5:0.6;
  ctx.setLineDash([4,6]);
  ctx.stroke();ctx.setLineDash([]);
}

// ── Draw forest decorations + species silhouettes ────────
function _drawForest(ctx,W,H){
  var TYPE_ORDER=['conversation','project','lecture','daily','general'];
  var USABLE_LEFT=0.06,USABLE_RIGHT=0.94,GAP_FRAC=0.04;
  var USABLE_TOP=0.08,USABLE_BOTTOM=0.86;
  var orphans=graphNodes.filter(function(n){return n.orphan;});
  var activeGroups=TYPE_ORDER.filter(function(t){
    return graphNodes.some(function(n){return n.type===t&&!n.orphan;});
  });
  var orderedTypes=activeGroups.slice().sort(function(a,b){
    // Count non-orphan nodes per type — same as _layoutForest
    return graphNodes.filter(function(n){return n.type===b&&!n.orphan;}).length-
           graphNodes.filter(function(n){return n.type===a&&!n.orphan;}).length;
  });
  orderedTypes=_centerLargest(orderedTypes);
  var numSlots=orderedTypes.length+(orphans.length>0?1:0);
  var totalGap=GAP_FRAC*(numSlots-1);
  var usableW=(USABLE_RIGHT-USABLE_LEFT)-totalGap;
  var slotW=usableW/Math.max(numSlots,1);
  var baseY=H*USABLE_BOTTOM;
  // Use the full layout height so silhouettes always fill the slot properly
  var fullTreeH=H*(USABLE_BOTTOM-USABLE_TOP);
  var slotPx=slotW*W;

  orderedTypes.forEach(function(type,treeIdx){
    var members=graphNodes.filter(function(n){return n.type===type&&!n.orphan;});
    if(!members.length)return;
    var col=typeColors[type]||'#7c6af7';
    var treeCX=W*(USABLE_LEFT+(treeIdx*(slotW+GAP_FRAC)+slotW*0.5));

    // Cap tree height so it stays proportional to slot width — no more stretching
    // Trees look best when roughly 1.6-2x taller than wide
    var treeH=Math.min(fullTreeH, slotPx*2.0);

    // ── Draw species silhouette behind nodes ──
    ctx.save();
    ctx.globalAlpha=0.13;
    _drawTreeSpecies(ctx,type,treeCX,baseY,slotPx,treeH,col);
    ctx.globalAlpha=1;
    ctx.restore();

    // Subtle ground line only — no halo oval, no root connector line
    ctx.beginPath();
    ctx.moveTo(treeCX-slotPx*0.42,baseY+2);ctx.lineTo(treeCX+slotPx*0.42,baseY+2);
    ctx.strokeStyle=col+'55';ctx.lineWidth=1.5;ctx.stroke();

    // Labels
    ctx.font='bold 10px IBM Plex Mono, monospace';
    ctx.fillStyle=col+'cc';ctx.textAlign='center';
    ctx.fillText(type.toUpperCase(),treeCX,baseY+16);
    ctx.fillStyle=col+'60';ctx.font='9px IBM Plex Mono, monospace';
    ctx.fillText(members.length+' notes',treeCX,baseY+28);
    ctx.textAlign='left';
  });

  // Orphan walnut grove
  if(orphans.length>0){
    var groveCX=W*(USABLE_LEFT+(orderedTypes.length*(slotW+GAP_FRAC)+slotW*0.5));
    var groveH=Math.min(fullTreeH*0.7, slotPx*2.0);
    ctx.save();ctx.globalAlpha=0.13;
    _drawWalnut(ctx,groveCX,baseY,slotPx,groveH,'#5a3a1a','#2d5c1a');
    ctx.globalAlpha=1;ctx.restore();
    ctx.font='bold 10px IBM Plex Mono, monospace';
    ctx.fillStyle=ORPHAN_COLOR+'80';ctx.textAlign='center';
    ctx.fillText('ORPHANS',groveCX,baseY+16);
    ctx.fillStyle=ORPHAN_COLOR+'50';ctx.font='9px IBM Plex Mono, monospace';
    ctx.fillText(orphans.length+' notes',groveCX,baseY+28);
    ctx.textAlign='left';
  }
}

// ── Species dispatcher ────────────────────────────────────
// Each species gets its own real-world bark/foliage color blended with type color

// ── Birth Particle Renderer ───────────────────────────────
function _drawBirthParticles(ctx){
  if(!birthParticles||!birthParticles.length)return;
  birthParticles.forEach(function(p){
    if(p.done&&p.popped){
      // Landing pop — 3 expanding rings + big flash
      var popT=Math.min((p.elapsed-p.life)/0.6,1);
      ctx.save();
      // Outer shockwave ring
      var popR1=20+popT*80;
      ctx.globalAlpha=(1-popT)*0.7;
      ctx.beginPath();ctx.arc(p.x,p.y,popR1,0,Math.PI*2);
      ctx.strokeStyle=p.col;ctx.lineWidth=3;
      ctx.shadowColor=p.col;ctx.shadowBlur=20;
      ctx.stroke();
      // Mid ring
      var popR2=10+popT*45;
      ctx.globalAlpha=(1-popT)*0.9;
      ctx.beginPath();ctx.arc(p.x,p.y,popR2,0,Math.PI*2);
      ctx.strokeStyle='#ffffff';ctx.lineWidth=2;
      ctx.shadowBlur=12;ctx.stroke();
      // Inner glow fill (fades fast)
      if(popT<0.4){
        ctx.globalAlpha=(1-popT/0.4)*0.5;
        ctx.beginPath();ctx.arc(p.x,p.y,popR2*0.5,0,Math.PI*2);
        var grd=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,popR2*0.5);
        grd.addColorStop(0,'#ffffff');grd.addColorStop(1,p.col+'00');
        ctx.fillStyle=grd;ctx.shadowBlur=30;ctx.fill();
      }
      ctx.restore();
      return;
    }
    // In-flight — large glowing comet
    var pulse=0.9+0.1*Math.sin(p.elapsed*14);
    var r=10; // much bigger
    ctx.save();
    // Outer aura — very wide
    ctx.globalAlpha=0.2*pulse;
    ctx.beginPath();ctx.arc(p.x,p.y,r*4.5,0,Math.PI*2);
    var grd2=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*4.5);
    grd2.addColorStop(0,p.col);grd2.addColorStop(1,p.col+'00');
    ctx.fillStyle=grd2;ctx.fill();
    // Mid glow
    ctx.globalAlpha=0.5*pulse;
    ctx.beginPath();ctx.arc(p.x,p.y,r*2,0,Math.PI*2);
    var grd3=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*2);
    grd3.addColorStop(0,p.col);grd3.addColorStop(1,p.col+'00');
    ctx.fillStyle=grd3;ctx.fill();
    // White hot core
    ctx.globalAlpha=pulse;
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);
    ctx.fillStyle='#ffffff';
    ctx.shadowColor=p.col;ctx.shadowBlur=24;
    ctx.fill();
    // Colored center
    ctx.globalAlpha=0.85*pulse;
    ctx.beginPath();ctx.arc(p.x,p.y,r*0.55,0,Math.PI*2);
    ctx.fillStyle=p.col;ctx.shadowBlur=0;ctx.fill();
    // Comet tail — draw trail behind movement direction
    if(p.t>0.05&&p.t<0.95){
      var prevT=Math.max(0,p.t-0.08);
      var e2=prevT<0.5?4*prevT*prevT*prevT:(1-Math.pow(-2*prevT+2,3)/2);
      var cx2=(p.sx+p.tx)/2,cy2=Math.min(p.sy,p.ty);
      var px2=(1-e2)*(1-e2)*p.sx+2*(1-e2)*e2*cx2+e2*e2*p.tx;
      var py2=(1-e2)*(1-e2)*p.sy+2*(1-e2)*e2*cy2+e2*e2*p.ty;
      var tailGrd=ctx.createLinearGradient(px2,py2,p.x,p.y);
      tailGrd.addColorStop(0,p.col+'00');tailGrd.addColorStop(1,p.col+'cc');
      ctx.globalAlpha=0.6*pulse;
      ctx.beginPath();ctx.moveTo(px2,py2);ctx.lineTo(p.x,p.y);
      ctx.strokeStyle=tailGrd;ctx.lineWidth=r*1.2;
      ctx.lineCap='round';ctx.stroke();
    }
    ctx.restore();
  });
}
