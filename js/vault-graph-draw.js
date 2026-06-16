function _drawBranchEdge(ctx,a,b,col,isHL,baseW){
  var mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  var trunkY=Math.max(a.y,b.y);
  var cpx=mx+(Math.random()-0.5)*18;
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
    return graphNodes.filter(function(n){return n.type===b;}).length-
           graphNodes.filter(function(n){return n.type===a;}).length;
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
