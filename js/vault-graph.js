// ═══════════════════════════════════════════════════════════
// ══  VAULT GRAPH  ══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
var graphNodes=[],graphEdges=[],graphAnim=null;
var graphTransform={x:0,y:0,scale:1};
var graphPanning=false,graphPanStart={x:0,y:0};
var hoveredNode=null,simTick=0;
var pinnedNodes={};
var typeColors={
  conversation:'#c084fc',
  project:'#38bdf8',
  lecture:'#facc15',
  daily:'#4ade80',
  general:'#fb923c'
};
var ORPHAN_COLOR='#00e5cc';

function getPreviewLines(content,n){
  if(!content)return'';
  var stripped=content.replace(/^---[\s\S]*?---\s*/,'').trim();
  return stripped.split('\n').filter(function(l){return l.trim().length>0;}).slice(0,n).join('\n');
}

function initGraphCanvas(){
  var canvas=document.getElementById('vault-graph-canvas');
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  window.addEventListener('resize',function(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;});

  canvas.addEventListener('mousedown',function(e){
    if(e.target!==canvas)return;
    graphPanning=true;
    graphPanStart={x:e.clientX-graphTransform.x,y:e.clientY-graphTransform.y};
  });

  window.addEventListener('mousemove',function(e){
    if(graphPanning){
      graphTransform.x=e.clientX-graphPanStart.x;
      graphTransform.y=e.clientY-graphPanStart.y;
    }
    if(graphNodes.length){
      var mx=(e.clientX-graphTransform.x)/graphTransform.scale;
      var my=(e.clientY-graphTransform.y)/graphTransform.scale;
      hoveredNode=null;
      for(var i=0;i<graphNodes.length;i++){
        var n=graphNodes[i];var dx=mx-n.x,dy=my-n.y;
        if(Math.sqrt(dx*dx+dy*dy)<n.radius+6){hoveredNode=n;break;}
      }
      var tip=document.getElementById('graph-tooltip');
      if(hoveredNode){
        document.getElementById('tt-name').textContent=hoveredNode.name;
        document.getElementById('tt-path').textContent=hoveredNode.path;
        var typeEl=document.getElementById('tt-type');
        typeEl.textContent=hoveredNode.type+(hoveredNode.orphan?' · orphan':'')+(pinnedNodes[hoveredNode.id]?' · pinned':'');
        var col=hoveredNode.orphan?ORPHAN_COLOR:(typeColors[hoveredNode.type]||'#7c6af7');
        typeEl.style.background=col+'22';typeEl.style.color=col;
        typeEl.style.border='1px solid '+col+'44';
        var previewEl=document.getElementById('tt-preview');
        if(previewEl)previewEl.textContent=getPreviewLines(hoveredNode.content,3);
        tip.style.display='block';
        tip.style.left=Math.min(e.clientX+14,window.innerWidth-260)+'px';
        tip.style.top=Math.min(e.clientY-10,window.innerHeight-120)+'px';
        canvas.style.cursor='pointer';
      }else{
        tip.style.display='none';
        canvas.style.cursor=graphPanning?'grabbing':'grab';
      }
    }
  });

  window.addEventListener('mouseup',function(){graphPanning=false;});

  canvas.addEventListener('wheel',function(e){
    e.preventDefault();
    var factor=e.deltaY>0?0.9:1.1;
    var mx=e.clientX,my=e.clientY;
    graphTransform.x=mx-(mx-graphTransform.x)*factor;
    graphTransform.y=my-(my-graphTransform.y)*factor;
    graphTransform.scale=Math.max(0.1,Math.min(5,graphTransform.scale*factor));
  },{passive:false});

  canvas.addEventListener('click',function(e){
    if(!hoveredNode)return;
    var note=vaultIndex[hoveredNode.srcIdx!==undefined?hoveredNode.srcIdx:hoveredNode.id];
    if(!note)return;
    if(typeof VAULTUI!=='undefined'&&VAULTUI.showPanel){
      VAULTUI.showPanel();
      setTimeout(function(){
        var idx=vaultIndex.indexOf(note);
        if(idx>=0&&VAULTUI._openNoteByIdx)VAULTUI._openNoteByIdx(idx);
      },80);
    }
  });

  canvas.addEventListener('dblclick',function(e){
    if(!hoveredNode)return;
    var id=hoveredNode.id;
    if(pinnedNodes[id]){delete pinnedNodes[id];hoveredNode.pinned=false;}
    else{pinnedNodes[id]=true;hoveredNode.pinned=true;}
  });
}

function buildGraph(){
  document.getElementById('graph-overlay').classList.add('hidden');
  document.getElementById('graph-stats').style.display='flex';

  var candidates=vaultIndex.slice(0,150).map(function(note,i){
    return{srcIdx:i,name:note.name.replace('.md',''),path:note.path,
           type:detectType(note.path,note.content),content:note.content};
  });
  var filtered=candidates.filter(function(c){return GraphSettings.typeFilter[c.type]!==false;});

  graphNodes=filtered.map(function(c,i){
    return{id:i,srcIdx:c.srcIdx,name:c.name,path:c.path,type:c.type,
           content:c.content,x:0,y:0,vx:0,vy:0,
           radius:(4+Math.min(c.content.length/600,7))*(GraphSettings.nodeSizeScale||1),
           connCount:0,orphan:false,pinned:!!pinnedNodes[i]};
  });

  var edgeMap={};graphEdges=[];
  var nameMap={};graphNodes.forEach(function(n){nameMap[n.name.toLowerCase()]=n.id;});
  graphNodes.forEach(function(n){
    var note=vaultIndex[n.srcIdx];
    var links=note.content.match(/\[\[([^\]|]+)/g)||[];
    links.forEach(function(l){
      var target=l.replace('[[','').toLowerCase();
      if(nameMap[target]!==undefined&&nameMap[target]!==n.id){
        var a=Math.min(n.id,nameMap[target]),b=Math.max(n.id,nameMap[target]);
        var key=a+'-'+b;
        if(edgeMap[key]){edgeMap[key].weight++;}
        else{edgeMap[key]={a:n.id,b:nameMap[target],weight:1};graphEdges.push(edgeMap[key]);}
      }
    });
  });

  graphEdges.forEach(function(e){
    if(graphNodes[e.a])graphNodes[e.a].connCount++;
    if(graphNodes[e.b])graphNodes[e.b].connCount++;
  });
  graphNodes.forEach(function(n){n.orphan=n.connCount===0;});

  if(GraphSettings.sizeByConnections){
    var maxConn=Math.max(1,Math.max.apply(null,graphNodes.map(function(n){return n.connCount;})));
    graphNodes.forEach(function(n){
      n.radius=(3+Math.min((n.connCount/maxConn)*10,10))*(GraphSettings.nodeSizeScale||1);
    });
  }

  document.getElementById('stat-notes').textContent=graphNodes.length;
  document.getElementById('stat-links').textContent=graphEdges.length;

  var W=window.innerWidth,H=window.innerHeight;

  if(GraphSettings.yggdrasilMode){
    _layoutYggdrasil(W,H);
  }else if(GraphSettings.treeMode){
    _layoutForest(W,H);
  }else if(GraphSettings.gridMode){
    _layoutGrid(W,H);
  }else if(GraphSettings.clusterMode){
    _layoutCluster(W,H);
  }else{
    // Default: force-directed random spread
    var spread=Math.min(0.95,0.7*(GraphSettings.graphArea||1));
    var margin=(1-spread)/2;
    graphNodes.forEach(function(n){
      n.x=W*margin+Math.random()*(W*spread);
      n.y=H*margin+Math.random()*(H*spread);
    });
  }

  simTick=0;if(graphAnim)cancelAnimationFrame(graphAnim);runGraphSim();
}

// ── GRID LAYOUT (the old "square mode") ──────────────────
// Sorts all nodes by connection count desc, arranges into a tight grid
function _layoutGrid(W,H){
  var sorted=graphNodes.slice().sort(function(a,b){return b.connCount-a.connCount;});
  var cols=Math.ceil(Math.sqrt(sorted.length*1.6));
  var spread=Math.min(0.90,0.7*(GraphSettings.graphArea||1));
  sorted.forEach(function(n,i){
    var col=i%cols,row=Math.floor(i/cols);
    n.x=W*(0.05+spread*(col/(cols-1||1)));
    n.y=H*(0.10+0.80*(row/Math.max(1,Math.ceil(sorted.length/cols)-1)));
  });
}

// ── FOREST LAYOUT ────────────────────────────────────────
// Each type = its own tree. More horizontal padding between trees.
function _layoutForest(W,H){
  var TYPE_ORDER=['conversation','project','lecture','daily','general'];
  // More padding: 6% margin each side, 4% gap between trees
  var USABLE_LEFT=0.06,USABLE_RIGHT=0.94;
  var USABLE_TOP=0.08,USABLE_BOTTOM=0.86;

  var groups={};
  TYPE_ORDER.forEach(function(t){groups[t]=[];});
  var orphans=[];
  graphNodes.forEach(function(n){
    if(n.orphan)orphans.push(n);
    else groups[n.type].push(n);
  });

  var activeGroups=TYPE_ORDER.filter(function(t){return groups[t].length>0;});
  activeGroups.sort(function(a,b){return groups[b].length-groups[a].length;});
  var ordered=_centerLargest(activeGroups);

  var numSlots=ordered.length+(orphans.length>0?1:0);
  // Add inter-tree gap of 4% of W between each slot
  var GAP_FRAC=0.04;
  var totalGap=GAP_FRAC*(numSlots-1);
  var usableW=(USABLE_RIGHT-USABLE_LEFT)-totalGap;
  var slotW=usableW/Math.max(numSlots,1);
  var treeH=H*(USABLE_BOTTOM-USABLE_TOP);
  var baseY=H*USABLE_BOTTOM;

  ordered.forEach(function(type,treeIdx){
    var members=groups[type];
    // Center of this tree's slot, accounting for gaps
    var treeCX=W*(USABLE_LEFT+(treeIdx*(slotW+GAP_FRAC)+slotW*0.5));

    if(members.length===1){
      members[0].x=treeCX;members[0].y=baseY-treeH*0.3;return;
    }

    members.sort(function(a,b){return b.connCount-a.connCount;});
    var layers=_buildLayers(members);
    var numLayers=layers.length;

    layers.forEach(function(layer,li){
      var yFrac=li/(Math.max(numLayers-1,1));
      var y=baseY-yFrac*treeH*0.85;
      // Canopy width capped to 85% of slot to prevent overlap
      var spreadFrac=0.12+yFrac*0.42;
      var maxSpread=(slotW*W)*spreadFrac*0.5;

      layer.forEach(function(node,ni){
        var xFrac=layer.length===1?0.5:(ni/(layer.length-1));
        node.x=treeCX-maxSpread+xFrac*(maxSpread*2);
        node.y=y+(Math.random()-0.5)*10;
        node.x+=(Math.random()-0.5)*8;
      });
    });
  });

  // Orphan grove — far right
  if(orphans.length>0){
    var groveCX=W*(USABLE_LEFT+(ordered.length*(slotW+GAP_FRAC)+slotW*0.5));
    orphans.forEach(function(n,i){
      var angle=(i/Math.max(orphans.length,1))*Math.PI*2;
      var r=25+Math.random()*35;
      n.x=groveCX+Math.cos(angle)*r;
      n.y=baseY-treeH*0.22+Math.sin(angle)*r*0.5;
    });
  }
}

// ── YGGDRASIL LAYOUT ─────────────────────────────────────
// One giant tree spanning the whole canvas.
// Trunk = most connected node at center bottom (the world tree root).
// Branches split by type: each type gets a main branch direction.
// Notes spread along their branch, higher = less connected.
// Roots: orphan nodes hang below the trunk like roots.
// The 9 realms vibe: different branch angles for each type.
function _layoutYggdrasil(W,H){
  var CX=W*0.5;
  var TRUNK_Y=H*0.78;    // trunk node sits here
  var CANOPY_TOP=H*0.06; // topmost leaves
  var ROOT_BOT=H*0.95;   // deepest roots

  // Sort all non-orphan nodes by connCount desc
  var orphans=graphNodes.filter(function(n){return n.orphan;});
  var nonOrphans=graphNodes.filter(function(n){return!n.orphan;});
  nonOrphans.sort(function(a,b){return b.connCount-a.connCount;});

  // Place trunk (most connected overall) at center
  if(nonOrphans.length>0){
    nonOrphans[0].x=CX;nonOrphans[0].y=TRUNK_Y;
  }

  // Assign branch angles per type — spread around top arc like branches
  // Each type = one main branch direction emanating from trunk
  var TYPE_ORDER=['conversation','project','lecture','daily','general'];
  var typeGroups={};
  TYPE_ORDER.forEach(function(t){typeGroups[t]=[];});
  // Skip the trunk node (index 0) — it's special
  nonOrphans.slice(1).forEach(function(n){typeGroups[n.type].push(n);});

  var activeTypes=TYPE_ORDER.filter(function(t){return typeGroups[t].length>0;});
  var numBranches=activeTypes.length;

  // Branch angles: spread from -150° to -30° (top arc, left to right)
  // -90° = straight up (center branch gets that)
  var angleStart=-Math.PI*0.88;
  var angleEnd=-Math.PI*0.12;
  var trunkTreeH=TRUNK_Y-CANOPY_TOP;

  activeTypes.forEach(function(type,bi){
    var members=typeGroups[type];
    if(!members.length)return;

    // Main branch angle for this type
    var t=numBranches===1?0.5:(bi/(numBranches-1));
    var branchAngle=angleStart+(angleEnd-angleStart)*t;

    // Sort members by connCount desc — more connected = closer to trunk
    members.sort(function(a,b){return b.connCount-a.connCount;});

    // Place nodes along the branch in sub-layers
    // Layer 0 = closest to trunk, last layer = tip (leaf)
    var layers=_buildLayers(members);
    var numLayers=layers.length;

    layers.forEach(function(layer,li){
      // Distance from trunk — further out as li increases
      var distFrac=(li+1)/(numLayers+1);
      var dist=distFrac*trunkTreeH*0.88;

      // Sub-branch spread perpendicular to main branch angle
      // Widens as we go outward
      var spreadW=dist*0.28*(1+distFrac*0.5);

      var bx=CX+Math.cos(branchAngle)*dist;
      var by=TRUNK_Y+Math.sin(branchAngle)*dist;

      layer.forEach(function(node,ni){
        var xFrac=layer.length===1?0:(ni/(layer.length-1)-0.5);
        // Perpendicular direction (rotate branch angle by 90°)
        var perpAngle=branchAngle+Math.PI/2;
        node.x=bx+Math.cos(perpAngle)*xFrac*spreadW*2+(Math.random()-0.5)*10;
        node.y=by+Math.sin(perpAngle)*xFrac*spreadW*2+(Math.random()-0.5)*8;
      });
    });
  });

  // Roots: orphans hang below the trunk in a root system
  orphans.forEach(function(n,i){
    var angle=Math.PI*0.3+((i/(Math.max(orphans.length-1,1)))*Math.PI*0.4);
    var dist=(0.15+Math.random()*0.55)*(ROOT_BOT-TRUNK_Y);
    n.x=CX+Math.cos(angle)*dist*0.7+(Math.random()-0.5)*40;
    n.y=TRUNK_Y+Math.sin(angle)*dist;
  });
}

// ── CLUSTER LAYOUT ───────────────────────────────────────
function _layoutCluster(W,H){
  var typeOrder=['conversation','project','lecture','daily','general'];
  var groupCenters={};
  var activeTypes=typeOrder.filter(function(t){
    return graphNodes.some(function(n){return n.type===t&&!n.orphan;});
  });
  activeTypes.forEach(function(t,gi){
    var angle=(gi/activeTypes.length)*Math.PI*2-Math.PI/2;
    groupCenters[t]={x:W/2+Math.cos(angle)*W*0.28,y:H/2+Math.sin(angle)*H*0.28};
  });
  var orphans=graphNodes.filter(function(n){return n.orphan;});
  var nonOrphans=graphNodes.filter(function(n){return!n.orphan;});
  nonOrphans.forEach(function(n){
    var center=groupCenters[n.type]||{x:W/2,y:H/2};
    n.x=center.x+(Math.random()-0.5)*160;
    n.y=center.y+(Math.random()-0.5)*160;
  });
  orphans.forEach(function(n,i){
    var angle=(i/Math.max(1,orphans.length))*Math.PI*2;
    var r=40+Math.random()*40;
    n.x=W*0.12+Math.cos(angle)*r;
    n.y=H*0.82+Math.sin(angle)*r;
  });
}

// ── Helpers ───────────────────────────────────────────────
function _centerLargest(arr){
  if(arr.length<=1)return arr;
  var mid=Math.floor(arr.length/2);
  var result=arr.slice();
  var biggest=result.splice(0,1)[0];
  result.splice(mid,0,biggest);
  return result;
}

function _buildLayers(members){
  var layers=[];var i=0;var layerSize=1;
  while(i<members.length){
    layers.push(members.slice(i,i+layerSize));
    i+=layerSize;
    layerSize=Math.min(Math.ceil(layerSize*1.6),6);
  }
  return layers;
}

function detectType(path,content){
  var p=(path||'').toLowerCase();var c=(content||'').toLowerCase();
  if(p.includes('conversation')||c.includes('type: conversation'))return'conversation';
  if(p.includes('01-projects')||c.includes('type: project'))return'project';
  if(p.includes('lecture')||c.includes('type: lecture'))return'lecture';
  if(p.includes('07-system/daily'))return'daily';
  return'general';
}

var GRAPH_FPS=1000/30,lastGraphFrame=0;
function runGraphSim(){
  graphAnim=requestAnimationFrame(function(now){
    runGraphSim();if(now-lastGraphFrame<GRAPH_FPS)return;lastGraphFrame=now;
    var canvas=document.getElementById('vault-graph-canvas');
    var ctx=canvas.getContext('2d');
    var W=canvas.width,H=canvas.height;
    var linkDist=GraphSettings.linkDistance||90;
    var repulsion=(GraphSettings.repulsion||100)/100;
    var query=GraphSettings.searchQuery||'';
    var treeMode=GraphSettings.treeMode||false;
    var clusterMode=GraphSettings.clusterMode||false;
    var gridMode=GraphSettings.gridMode||false;
    var yggMode=GraphSettings.yggdrasilMode||false;
    var brightness=GraphSettings.nodeBrightness!==undefined?GraphSettings.nodeBrightness:1.0;
    var staticLayout=treeMode||gridMode||yggMode;

    // ── SIM (only in default + cluster mode) ─────────────
    if(simTick<300&&!staticLayout){
      var k=Math.sqrt((W*H)/Math.max(graphNodes.length,1))*0.9*repulsion;
      for(var i=0;i<graphNodes.length;i++){
        graphNodes[i].vx=0;graphNodes[i].vy=0;
        for(var j=0;j<graphNodes.length;j++){
          if(i===j)continue;
          var dx=graphNodes[i].x-graphNodes[j].x;
          var dy=graphNodes[i].y-graphNodes[j].y;
          var dist=Math.sqrt(dx*dx+dy*dy)||1;
          var f=(k*k)/dist;
          graphNodes[i].vx+=dx/dist*f*0.008;
          graphNodes[i].vy+=dy/dist*f*0.008;
        }
      }
      graphEdges.forEach(function(e){
        var a=graphNodes[e.a],b=graphNodes[e.b];if(!a||!b)return;
        var dx=b.x-a.x,dy=b.y-a.y;
        var dist=Math.sqrt(dx*dx+dy*dy)||1;
        var diff=(dist-linkDist)/dist;
        var w=0.04*(1+Math.min(e.weight-1,3)*0.15);
        a.vx+=dx*w*diff;a.vy+=dy*w*diff;
        b.vx-=dx*w*diff;b.vy-=dy*w*diff;
      });
      if(clusterMode){
        var typeOrder=['conversation','project','lecture','daily','general'];
        var activeCenters={};
        typeOrder.forEach(function(t){
          var m=graphNodes.filter(function(n){return n.type===t&&!n.orphan;});
          if(!m.length)return;
          activeCenters[t]={x:m.reduce(function(s,n){return s+n.x;},0)/m.length,
                             y:m.reduce(function(s,n){return s+n.y;},0)/m.length};
        });
        graphNodes.forEach(function(n){
          if(n.orphan){n.vx+=(W*0.12-n.x)*0.002;n.vy+=(H*0.82-n.y)*0.002;}
          else if(activeCenters[n.type]){
            var tc=activeCenters[n.type];
            n.vx+=(tc.x-n.x)*0.0008;n.vy+=(tc.y-n.y)*0.0008;
          }
        });
      }
      graphNodes.forEach(function(n){
        if(n.pinned)return;
        n.x+=Math.max(-8,Math.min(8,n.vx));
        n.y+=Math.max(-8,Math.min(8,n.vy));
        n.x=Math.max(30,Math.min(W/graphTransform.scale-30,n.x));
        n.y=Math.max(30,Math.min(H/graphTransform.scale-30,n.y));
      });
      simTick++;
    }

    // ── DRAW ─────────────────────────────────────────────
    ctx.clearRect(0,0,W,H);
    ctx.save();
    ctx.translate(graphTransform.x,graphTransform.y);
    ctx.scale(graphTransform.scale,graphTransform.scale);

    if(treeMode)_drawForest(ctx,W,H);
    if(yggMode)_drawYggdrasil(ctx,W,H);
    if(clusterMode&&!treeMode&&!yggMode)_drawClusterHalos(ctx);

    var matchedNodes=null;
    if(query){
      matchedNodes={};
      graphNodes.forEach(function(n){if(n.name.toLowerCase().includes(query))matchedNodes[n.id]=true;});
    }

    // ── EDGES ─────────────────────────────────────────────
    graphEdges.forEach(function(e){
      var a=graphNodes[e.a],b=graphNodes[e.b];if(!a||!b)return;
      var isHL=hoveredNode&&(e.a===hoveredNode.id||e.b===hoveredNode.id);
      var baseW=0.5+Math.min(e.weight-1,4)*0.6;
      var col=typeColors[a.type]||'#7c6af7';
      if((treeMode||yggMode)&&a.type===b.type){
        _drawBranchEdge(ctx,a,b,col,isHL,baseW);
      }else{
        ctx.beginPath();
        ctx.strokeStyle=isHL?(col+'cc'):'rgba(124,106,247,0.08)';
        ctx.lineWidth=isHL?Math.max(baseW,1.5):baseW;
        if(isHL){ctx.shadowColor=col+'66';ctx.shadowBlur=4;}else{ctx.shadowBlur=0;}
        ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
    });
    ctx.shadowBlur=0;

    graphNodes.forEach(function(n){_drawNode(ctx,n,matchedNodes,brightness);});
    ctx.restore();
  });
}

// ── Draw organic branch edge ──────────────────────────────
function _drawBranchEdge(ctx,a,b,col,isHL,baseW){
  var mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  var trunkY=Math.max(a.y,b.y);
  var cpx=mx+(Math.random()-0.5)*20;
  var cpy=my+(trunkY-my)*0.3;
  ctx.beginPath();ctx.moveTo(a.x,a.y);
  ctx.quadraticCurveTo(cpx,cpy,b.x,b.y);
  ctx.strokeStyle=isHL?(col+'dd'):(col+'28');
  ctx.lineWidth=isHL?Math.max(baseW,1.8):Math.max(baseW,0.8);
  if(isHL){ctx.shadowColor=col+'88';ctx.shadowBlur=6;}else{ctx.shadowBlur=0;}
  ctx.stroke();ctx.shadowBlur=0;
}

// ── Draw forest decorations ───────────────────────────────
function _drawForest(ctx,W,H){
  var TYPE_ORDER=['conversation','project','lecture','daily','general'];
  var USABLE_LEFT=0.06,USABLE_RIGHT=0.94;
  var GAP_FRAC=0.04;
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
  var baseY=H*0.86;

  orderedTypes.forEach(function(type,treeIdx){
    var members=graphNodes.filter(function(n){return n.type===type&&!n.orphan;});
    if(!members.length)return;
    var col=typeColors[type]||'#7c6af7';
    var treeCX=W*(USABLE_LEFT+(treeIdx*(slotW+GAP_FRAC)+slotW*0.5));

    var xs=members.map(function(n){return n.x;});
    var ys=members.map(function(n){return n.y;});
    var minX=Math.min.apply(null,xs)-20,maxX=Math.max.apply(null,xs)+20;
    var minY=Math.min.apply(null,ys)-20,maxY=Math.max.apply(null,ys)+20;

    // Halo
    var haloR=Math.max((maxX-minX),(maxY-minY))*0.65;
    var haloGrd=ctx.createRadialGradient(treeCX,(minY+maxY)/2,0,treeCX,(minY+maxY)/2,haloR+40);
    haloGrd.addColorStop(0,col+'12');haloGrd.addColorStop(1,col+'00');
    ctx.beginPath();
    ctx.ellipse(treeCX,(minY+maxY)/2,(maxX-minX)/2+30,(maxY-minY)/2+30,0,0,Math.PI*2);
    ctx.fillStyle=haloGrd;ctx.fill();

    // Ground + roots
    var trunk=members[0];
    ctx.beginPath();
    ctx.moveTo(treeCX-W*slotW*0.35,baseY+2);
    ctx.lineTo(treeCX+W*slotW*0.35,baseY+2);
    ctx.strokeStyle=col+'44';ctx.lineWidth=1.5;ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(trunk.x,trunk.y+trunk.radius);ctx.lineTo(trunk.x,baseY+2);
    ctx.strokeStyle=col+'30';ctx.lineWidth=2;ctx.stroke();

    // Label
    ctx.font='bold 10px IBM Plex Mono, monospace';
    ctx.fillStyle=col+'cc';ctx.textAlign='center';
    ctx.fillText(type.toUpperCase(),treeCX,baseY+16);
    ctx.fillStyle=col+'60';ctx.font='9px IBM Plex Mono, monospace';
    ctx.fillText(members.length+' notes',treeCX,baseY+28);
    ctx.textAlign='left';
  });

  if(orphans.length>0){
    var groveCX=W*(USABLE_LEFT+(orderedTypes.length*(slotW+GAP_FRAC)+slotW*0.5));
    ctx.font='bold 10px IBM Plex Mono, monospace';
    ctx.fillStyle=ORPHAN_COLOR+'80';ctx.textAlign='center';
    ctx.fillText('ORPHANS',groveCX,baseY+16);
    ctx.fillStyle=ORPHAN_COLOR+'50';ctx.font='9px IBM Plex Mono, monospace';
    ctx.fillText(orphans.length+' notes',groveCX,baseY+28);
    ctx.textAlign='left';
  }
}

// ── Draw Yggdrasil decorations ────────────────────────────
function _drawYggdrasil(ctx,W,H){
  var CX=W*0.5,TRUNK_Y=H*0.78;
  var nonOrphans=graphNodes.filter(function(n){return!n.orphan;});
  var trunk=nonOrphans.sort(function(a,b){return b.connCount-a.connCount;})[0];

  // Great trunk line — from roots up through trunk node to canopy
  var grad=ctx.createLinearGradient(CX,H*0.95,CX,H*0.06);
  grad.addColorStop(0,'rgba(74,222,128,0.08)');
  grad.addColorStop(0.4,'rgba(124,106,247,0.15)');
  grad.addColorStop(1,'rgba(124,106,247,0.04)');
  ctx.beginPath();
  ctx.moveTo(CX,H*0.95);ctx.lineTo(CX,H*0.06);
  ctx.strokeStyle=grad;ctx.lineWidth=3;ctx.stroke();

  // Nine realms ring — a faint circle around the trunk
  ctx.beginPath();ctx.arc(CX,TRUNK_Y,22,0,Math.PI*2);
  ctx.strokeStyle='rgba(124,106,247,0.35)';ctx.lineWidth=1.5;ctx.stroke();
  ctx.beginPath();ctx.arc(CX,TRUNK_Y,8,0,Math.PI*2);
  ctx.fillStyle='rgba(124,106,247,0.2)';ctx.fill();

  // World label
  ctx.font='bold 9px IBM Plex Mono, monospace';
  ctx.fillStyle='rgba(232,230,240,0.25)';ctx.textAlign='center';
  ctx.fillText('YGGDRASIL',CX,H*0.06-8);

  // Type branch labels at midpoint of each branch direction
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

  // Root label
  ctx.font='9px IBM Plex Mono, monospace';
  ctx.fillStyle=ORPHAN_COLOR+'60';ctx.textAlign='center';
  var orphanCount=graphNodes.filter(function(n){return n.orphan;}).length;
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

// ── Draw a single node ────────────────────────────────────
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

  if(isPinned){ctx.shadowColor='#f87171';ctx.shadowBlur=12;}
  else if(isHv){ctx.shadowColor=color;ctx.shadowBlur=16;}
  else if(isMatch){ctx.shadowColor='#fde047';ctx.shadowBlur=16;}
  else if(isCn){ctx.shadowColor=color;ctx.shadowBlur=8;}
  else if(isOrphan){ctx.shadowColor=ORPHAN_COLOR;ctx.shadowBlur=6;}
  else{ctx.shadowBlur=0;}

  var baseAlpha=Math.round((0.30+brightness*0.70)*255).toString(16).padStart(2,'0');
  var query=GraphSettings.searchQuery||'';

  ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);
  var fillColor;
  if(isPinned){fillColor='#f87171';}
  else if(isHv){fillColor=color;}
  else if(query){fillColor=isMatch?color:(color+'22');}
  else if(isCn){fillColor=color+'cc';}
  else{fillColor=color+baseAlpha;}
  ctx.fillStyle=fillColor;ctx.fill();

  if(isPinned){
    ctx.shadowBlur=0;ctx.strokeStyle='#f87171';ctx.lineWidth=1.5;
    var boxS=r*2+6;ctx.strokeRect(n.x-boxS/2,n.y-boxS/2,boxS,boxS);
  }

  var showLabel=isHv||isMatch||isPinned||GraphSettings.showLabels||(graphTransform.scale>1.8);
  if(showLabel){
    ctx.shadowBlur=0;
    ctx.font=(isHv||isMatch?'bold ':'')+'10px IBM Plex Mono, monospace';
    ctx.fillStyle=isPinned?'#f87171':(isHv||isMatch)?'rgba(232,230,240,1)':'rgba(232,230,240,0.6)';
    ctx.fillText(n.name,n.x+r+3,n.y+3);
  }
  ctx.shadowBlur=0;
}
