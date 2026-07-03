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
// Two-row layout: top row and bottom row of trees
// Trees far from viewport center fade when zoomed in
function _drawForest(ctx,W,H){
  var TYPE_ORDER=['conversation','project','lecture','daily','general','system','workout','academic','biometric','weekly'];
  var GAP_FRAC=0.055;
  var ROW1_TOP=0.04,ROW1_BOTTOM=0.46;
  var ROW2_TOP=0.54,ROW2_BOTTOM=0.96;
  var orphans=graphNodes.filter(function(n){return n.orphan;});
  var activeGroups=TYPE_ORDER.filter(function(t){
    return graphNodes.some(function(n){return n.type===t&&!n.orphan;});
  });
  var orderedTypes=_centerLargest(activeGroups.slice().sort(function(a,b){
    return graphNodes.filter(function(n){return n.type===b&&!n.orphan;}).length-
           graphNodes.filter(function(n){return n.type===a&&!n.orphan;}).length;
  }));
  if(!orderedTypes.length&&!orphans.length)return;

  var numTypes=orderedTypes.length+(orphans.length>0?1:0);
  var useRows=numTypes>4;

  // Viewport center in graph space — used for fade effect
  var vpCX=(-graphTransform.x)/graphTransform.scale+W/(2*graphTransform.scale);
  var vpCY=(-graphTransform.y)/graphTransform.scale+H/(2*graphTransform.scale);
  var fadeScale=graphTransform.scale; // >1 = zoomed in = fade distant trees

  function _treeFade(treeCX,treeBaseY){
    if(fadeScale<=1.0)return 1.0; // no fade when zoomed out
    var dx=treeCX-vpCX,dy=treeBaseY-vpCY;
    var dist=Math.sqrt(dx*dx+dy*dy);
    var fadeRadius=W/(fadeScale*0.8);
    return Math.max(0,Math.min(1,1-(dist-fadeRadius*0.4)/(fadeRadius*0.6)));
  }

  function _drawOneTree(type,treeCX,baseY,row_h,isOrphan){
    var members=isOrphan?orphans:graphNodes.filter(function(n){return n.type===type&&!n.orphan;});
    if(!members.length)return;
    var col=isOrphan?ORPHAN_COLOR:(typeColors[type]||'#7c6af7');
    var fade=_treeFade(treeCX,baseY);
    if(fade<=0.02)return; // fully faded — skip drawing
    var slotCount=useRows?Math.ceil(numTypes/2):numTypes;
    var slotPx=W*((1-GAP_FRAC*(slotCount+1))/Math.max(slotCount,1));
    var treeH=Math.min(row_h,slotPx*2.2);
    ctx.save();
    ctx.globalAlpha=0.13*fade;
    if(isOrphan)_drawWalnut(ctx,treeCX,baseY,slotPx,treeH,'#5a3a1a','#2d5c1a');
    else _drawTreeSpecies(ctx,type,treeCX,baseY,slotPx,treeH,col);
    ctx.restore();
    // Ground line
    ctx.save();ctx.globalAlpha=fade;
    ctx.beginPath();
    ctx.moveTo(treeCX-slotPx*0.40,baseY+2);ctx.lineTo(treeCX+slotPx*0.40,baseY+2);
    ctx.strokeStyle=col+(isOrphan?'55':'55');ctx.lineWidth=1.5;ctx.stroke();
    // Labels
    ctx.font='bold 10px IBM Plex Mono, monospace';
    ctx.fillStyle=col+'cc';ctx.textAlign='center';
    ctx.fillText(isOrphan?'ORPHANS':type.toUpperCase(),treeCX,baseY+16);
    ctx.fillStyle=col+'60';ctx.font='9px IBM Plex Mono, monospace';
    ctx.fillText(members.length+' notes',treeCX,baseY+28);
    ctx.restore();
    ctx.textAlign='left';
  }

  if(!useRows){
    // Single row
    var slotW=(0.94-0.06-GAP_FRAC*(numTypes-1))/Math.max(numTypes,1);
    var baseY=H*ROW2_BOTTOM;
    var row_h=H*(ROW2_BOTTOM-ROW1_TOP);
    orderedTypes.forEach(function(type,ti){
      var cx=W*(0.06+(ti*(slotW+GAP_FRAC)+slotW*0.5));
      _drawOneTree(type,cx,baseY,row_h,false);
    });
    if(orphans.length){
      var ocx=W*(0.06+(orderedTypes.length*(slotW+GAP_FRAC)+slotW*0.5));
      _drawOneTree(null,ocx,baseY,row_h,true);
    }
    return;
  }

  // Two rows
  var row1Count=Math.ceil(numTypes/2);
  var row2Count=numTypes-row1Count;
  var r1SlotW=(0.94-0.06-GAP_FRAC*(row1Count-1))/Math.max(row1Count,1);
  var r2SlotW=(0.94-0.06-GAP_FRAC*(row2Count-1))/Math.max(row2Count,1);
  var row1BaseY=H*ROW1_BOTTOM;
  var row2BaseY=H*ROW2_BOTTOM;
  var row1H=H*(ROW1_BOTTOM-ROW1_TOP);
  var row2H=H*(ROW2_BOTTOM-ROW2_TOP);

  orderedTypes.slice(0,row1Count).forEach(function(type,ti){
    var cx=W*(0.06+(ti*(r1SlotW+GAP_FRAC)+r1SlotW*0.5));
    _drawOneTree(type,cx,row1BaseY,row1H,false);
  });
  orderedTypes.slice(row1Count).forEach(function(type,ti){
    var cx=W*(0.06+(ti*(r2SlotW+GAP_FRAC)+r2SlotW*0.5));
    _drawOneTree(type,cx,row2BaseY,row2H,false);
  });
  if(orphans.length){
    var ocx=W*0.92;
    _drawOneTree(null,ocx,row2BaseY,row2H,true);
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
