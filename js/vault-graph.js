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

// ── Sap flow particle system ──────────────────────────────
var sapParticles=[];
function _initSapParticles(){
  sapParticles=[];
  if(!GraphSettings.treeMode&&!GraphSettings.yggdrasilMode)return;
  graphEdges.forEach(function(e){
    if(Math.random()<0.6){
      sapParticles.push({
        edgeA:e.a,edgeB:e.b,
        t:Math.random(),       // 0..1 position along edge
        speed:(0.003+Math.random()*0.005)*(Math.random()<0.5?1:-1),
        size:1.5+Math.random()*1.5,
        alpha:0.4+Math.random()*0.4
      });
    }
  });
}

// ── Leaf sway state ───────────────────────────────────────
var swayTime=0;

function getPreviewLines(content,n){
  if(!content)return'';
  var stripped=content.replace(/^---[\s\S]*?---\s*/,'').trim();
  return stripped.split('\n').filter(function(l){return l.trim().length>0;}).slice(0,n).join('\n');
}

function initGraphCanvas(){
  var canvas=document.getElementById('vault-graph-canvas');
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  window.addEventListener('resize',function(){
    canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  });

  // Pan
  canvas.addEventListener('mousedown',function(e){
    if(e.target!==canvas)return;
    graphPanning=true;
    graphPanStart={x:e.clientX-graphTransform.x,y:e.clientY-graphTransform.y};
  });

  // Pinch-to-zoom (touch)
  var lastPinchDist=null;
  canvas.addEventListener('touchstart',function(e){
    if(e.touches.length===2){
      lastPinchDist=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      );
    }
  },{passive:true});
  canvas.addEventListener('touchmove',function(e){
    if(e.touches.length===2&&lastPinchDist!==null){
      e.preventDefault();
      var dist=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      );
      var factor=dist/lastPinchDist;
      var mx=(e.touches[0].clientX+e.touches[1].clientX)/2;
      var my=(e.touches[0].clientY+e.touches[1].clientY)/2;
      graphTransform.x=mx-(mx-graphTransform.x)*factor;
      graphTransform.y=my-(my-graphTransform.y)*factor;
      graphTransform.scale=Math.max(0.1,Math.min(5,graphTransform.scale*factor));
      lastPinchDist=dist;
    }
  },{passive:false});
  canvas.addEventListener('touchend',function(){lastPinchDist=null;});

  // Hover + tooltip
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
        var linkCount=graphEdges.filter(function(e){return e.a===hoveredNode.id||e.b===hoveredNode.id;}).length;
        typeEl.textContent=hoveredNode.type+(hoveredNode.orphan?' · orphan':'')+(pinnedNodes[hoveredNode.id]?' · pinned':'')+' · '+linkCount+' links';
        var col=hoveredNode.orphan?ORPHAN_COLOR:(typeColors[hoveredNode.type]||'#7c6af7');
        typeEl.style.background=col+'22';typeEl.style.color=col;
        typeEl.style.border='1px solid '+col+'44';
        // Preview + last modified
        var previewEl=document.getElementById('tt-preview');
        if(previewEl){
          var note=vaultIndex[hoveredNode.srcIdx];
          var preview=getPreviewLines(hoveredNode.content,3);
          var modLine='';
          if(note&&note.mtime){
            var d=new Date(note.mtime);
            modLine='\n— '+d.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
          }
          previewEl.textContent=preview+(modLine?'\n'+modLine:'');
        }
        tip.style.display='block';
        tip.style.left=Math.min(e.clientX+14,window.innerWidth-270)+'px';
        tip.style.top=Math.min(e.clientY-10,window.innerHeight-130)+'px';
        canvas.style.cursor='pointer';
      }else{
        tip.style.display='none';
        canvas.style.cursor=graphPanning?'grabbing':'grab';
      }
    }
  });

  window.addEventListener('mouseup',function(){graphPanning=false;});

  // Scroll zoom
  canvas.addEventListener('wheel',function(e){
    e.preventDefault();
    var factor=e.deltaY>0?0.9:1.1;
    var mx=e.clientX,my=e.clientY;
    graphTransform.x=mx-(mx-graphTransform.x)*factor;
    graphTransform.y=my-(my-graphTransform.y)*factor;
    graphTransform.scale=Math.max(0.1,Math.min(5,graphTransform.scale*factor));
  },{passive:false});

  // Click → open note
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

  // Double-click → pin/unpin
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
           connCount:0,orphan:false,pinned:!!pinnedNodes[i],
           swayOffset:Math.random()*Math.PI*2};
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
  _updateModeLabel();

  var W=window.innerWidth,H=window.innerHeight;

  if(GraphSettings.yggdrasilMode){_layoutYggdrasil(W,H);}
  else if(GraphSettings.treeMode){_layoutForest(W,H);}
  else if(GraphSettings.gridMode){_layoutGrid(W,H);}
  else if(GraphSettings.clusterMode){_layoutCluster(W,H);}
  else{
    var spread=Math.min(0.95,0.7*(GraphSettings.graphArea||1));
    var margin=(1-spread)/2;
    graphNodes.forEach(function(n){
      n.x=W*margin+Math.random()*(W*spread);
      n.y=H*margin+Math.random()*(H*spread);
    });
  }

  _initSapParticles();
  simTick=0;if(graphAnim)cancelAnimationFrame(graphAnim);runGraphSim();
}

function _updateModeLabel(){
  var el=document.getElementById('stat-mode');
  if(!el)return;
  var mode=GraphSettings.yggdrasilMode?'🌳 Yggdrasil':
            GraphSettings.treeMode?'🌲 Forest':
            GraphSettings.gridMode?'⊞ Grid':
            GraphSettings.clusterMode?'⬡ Cluster':'◎ Default';
  el.textContent=mode;
}

// ── GRID LAYOUT ───────────────────────────────────────────
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

// ── FOREST LAYOUT ─────────────────────────────────────────
function _layoutForest(W,H){
  var TYPE_ORDER=['conversation','project','lecture','daily','general'];
  var USABLE_LEFT=0.06,USABLE_RIGHT=0.94;
  var USABLE_TOP=0.08,USABLE_BOTTOM=0.86;
  var GAP_FRAC=0.04;

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
  var totalGap=GAP_FRAC*(numSlots-1);
  var usableW=(USABLE_RIGHT-USABLE_LEFT)-totalGap;
  var slotW=usableW/Math.max(numSlots,1);
  var treeH=H*(USABLE_BOTTOM-USABLE_TOP);
  var baseY=H*USABLE_BOTTOM;

  ordered.forEach(function(type,treeIdx){
    var members=groups[type];
    var treeCX=W*(USABLE_LEFT+(treeIdx*(slotW+GAP_FRAC)+slotW*0.5));
    if(members.length===1){members[0].x=treeCX;members[0].y=baseY-treeH*0.3;return;}
    members.sort(function(a,b){return b.connCount-a.connCount;});
    var layers=_buildLayers(members);
    var numLayers=layers.length;
    layers.forEach(function(layer,li){
      var yFrac=li/(Math.max(numLayers-1,1));
      var y=baseY-yFrac*treeH*0.85;
      var spreadFrac=0.12+yFrac*0.42;
      var maxSpread=(slotW*W)*spreadFrac*0.5;
      layer.forEach(function(node,ni){
        var xFrac=layer.length===1?0.5:(ni/(layer.length-1));
        node.x=treeCX-maxSpread+xFrac*(maxSpread*2)+(Math.random()-0.5)*8;
        node.y=y+(Math.random()-0.5)*10;
        // Tag leaf nodes for sway
        node.isLeaf=(li===numLayers-1);
      });
    });
  });

  if(orphans.length>0){
    var groveCX=W*(USABLE_LEFT+(ordered.length*(slotW+GAP_FRAC)+slotW*0.5));
    orphans.forEach(function(n,i){
      var angle=(i/Math.max(orphans.length,1))*Math.PI*2;
      var r=25+Math.random()*35;
      n.x=groveCX+Math.cos(angle)*r;
      n.y=baseY-treeH*0.22+Math.sin(angle)*r*0.5;
      n.isLeaf=true;
    });
  }
}

// ── YGGDRASIL LAYOUT ──────────────────────────────────────
function _layoutYggdrasil(W,H){
  var CX=W*0.5;
  var TRUNK_Y=H*0.78;
  var CANOPY_TOP=H*0.06;
  var ROOT_BOT=H*0.95;

  var orphans=graphNodes.filter(function(n){return n.orphan;});
  var nonOrphans=graphNodes.filter(function(n){return!n.orphan;});
  nonOrphans.sort(function(a,b){return b.connCount-a.connCount;});

  if(nonOrphans.length>0){
    nonOrphans[0].x=CX;nonOrphans[0].y=TRUNK_Y;
    nonOrphans[0].isLeaf=false;
  }

  var TYPE_ORDER=['conversation','project','lecture','daily','general'];
  var typeGroups={};
  TYPE_ORDER.forEach(function(t){typeGroups[t]=[];});
  nonOrphans.slice(1).forEach(function(n){typeGroups[n.type].push(n);});

  var activeTypes=TYPE_ORDER.filter(function(t){return typeGroups[t].length>0;});
  var numBranches=activeTypes.length;
  var angleStart=-Math.PI*0.88,angleEnd=-Math.PI*0.12;
  var trunkTreeH=TRUNK_Y-CANOPY_TOP;

  activeTypes.forEach(function(type,bi){
    var members=typeGroups[type];if(!members.length)return;
    var t=numBranches===1?0.5:(bi/(numBranches-1));
    var branchAngle=angleStart+(angleEnd-angleStart)*t;
    members.sort(function(a,b){return b.connCount-a.connCount;});
    var layers=_buildLayers(members);
    var numLayers=layers.length;
    layers.forEach(function(layer,li){
      var distFrac=(li+1)/(numLayers+1);
      var dist=distFrac*trunkTreeH*0.88;
      var spreadW=dist*0.28*(1+distFrac*0.5);
      var bx=CX+Math.cos(branchAngle)*dist;
      var by=TRUNK_Y+Math.sin(branchAngle)*dist;
      layer.forEach(function(node,ni){
        var xFrac=layer.length===1?0:(ni/(layer.length-1)-0.5);
        var perpAngle=branchAngle+Math.PI/2;
        node.x=bx+Math.cos(perpAngle)*xFrac*spreadW*2+(Math.random()-0.5)*10;
        node.y=by+Math.sin(perpAngle)*xFrac*spreadW*2+(Math.random()-0.5)*8;
        node.isLeaf=(li===numLayers-1);
      });
    });
  });

  // Roots
  orphans.forEach(function(n,i){
    var angle=Math.PI*0.3+((i/(Math.max(orphans.length-1,1)))*Math.PI*0.4);
    var dist=(0.15+Math.random()*0.55)*(ROOT_BOT-TRUNK_Y);
    n.x=CX+Math.cos(angle)*dist*0.7+(Math.random()-0.5)*40;
    n.y=TRUNK_Y+Math.sin(angle)*dist;
    n.isLeaf=false;
  });
}

// ── CLUSTER LAYOUT ────────────────────────────────────────
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
  graphNodes.forEach(function(n){
    if(n.orphan){
      var angle=(graphNodes.indexOf(n)/Math.max(1,graphNodes.filter(function(x){return x.orphan;}).length))*Math.PI*2;
      n.x=W*0.12+Math.cos(angle)*45;n.y=H*0.82+Math.sin(angle)*45;
    }else{
      var center=groupCenters[n.type]||{x:W/2,y:H/2};
      n.x=center.x+(Math.random()-0.5)*160;
      n.y=center.y+(Math.random()-0.5)*160;
    }
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
    i+=layerSize;layerSize=Math.min(Math.ceil(layerSize*1.6),6);
  }
  return layers;
}

function detectType(path,content){
  var p=(path||'').toLowerCase();var c=(content||'').toLowerCase();
  var fname=(path||'').split('/').pop().toLowerCase();
  if(p.includes('conversation')||c.includes('type: conversation'))return'conversation';
  if(p.includes('01-projects')||c.includes('type: project'))return'project';
  if(p.includes('lecture')||c.includes('type: lecture'))return'lecture';
  // daily: explicit type tag, daily-log folder, 00-capture with date filename, or YYYY-MM-DD.md anywhere
  if(c.includes('type: daily')||c.includes('type: daily log'))return'daily';
  if(p.includes('07-system/daily')||p.includes('daily-log')||p.includes('daily log'))return'daily';
  if(p.includes('00-capture')&&/^\d{4}-\d{2}-\d{2}\.md$/.test(fname))return'daily';
  if(/^\d{4}-\d{2}-\d{2}\.md$/.test(fname))return'daily';
  return'general';
}

// ── SIMULATION + DRAW LOOP ────────────────────────────────
var GRAPH_FPS=1000/30,lastGraphFrame=0;
function runGraphSim(){
  graphAnim=requestAnimationFrame(function(now){
    runGraphSim();if(now-lastGraphFrame<GRAPH_FPS)return;lastGraphFrame=now;
    var dt=1/30;
    swayTime+=dt;

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

    // Physics sim (default + cluster only)
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
          activeCenters[t]={
            x:m.reduce(function(s,n){return s+n.x;},0)/m.length,
            y:m.reduce(function(s,n){return s+n.y;},0)/m.length
          };
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

    // Advance sap particles
    sapParticles.forEach(function(p){
      p.t+=p.speed;
      if(p.t>1)p.t=0;
      if(p.t<0)p.t=1;
    });

    // ── DRAW ──────────────────────────────────────────────
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

    // Cross-type edges arc over in tree/ygg modes
    graphEdges.forEach(function(e){
      var a=graphNodes[e.a],b=graphNodes[e.b];if(!a||!b)return;
      var isHL=hoveredNode&&(e.a===hoveredNode.id||e.b===hoveredNode.id);
      var baseW=0.5+Math.min(e.weight-1,4)*0.6;
      var col=typeColors[a.type]||'#7c6af7';
      var sameType=a.type===b.type;

      if((treeMode||yggMode)&&sameType){
        _drawBranchEdge(ctx,a,b,col,isHL,baseW);
      }else if((treeMode||yggMode)&&!sameType){
        // Cross-type: arc gracefully over the scene
        _drawArcEdge(ctx,a,b,isHL,baseW);
      }else{
        ctx.beginPath();
        ctx.strokeStyle=isHL?(col+'cc'):'rgba(124,106,247,0.08)';
        ctx.lineWidth=isHL?Math.max(baseW,1.5):baseW;
        if(isHL){ctx.shadowColor=col+'66';ctx.shadowBlur=4;}else{ctx.shadowBlur=0;}
        ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
    });
    ctx.shadowBlur=0;

    // Sap flow particles (tree + ygg modes)
    if(treeMode||yggMode){
      sapParticles.forEach(function(p){
        var a=graphNodes[p.edgeA],b=graphNodes[p.edgeB];
        if(!a||!b)return;
        var px=a.x+(b.x-a.x)*p.t;
        var py=a.y+(b.y-a.y)*p.t;
        var col=typeColors[a.type]||'#7c6af7';
        ctx.beginPath();ctx.arc(px,py,p.size,0,Math.PI*2);
        ctx.fillStyle=col+(Math.round(p.alpha*255).toString(16).padStart(2,'0'));
        ctx.shadowColor=col;ctx.shadowBlur=4;
        ctx.fill();ctx.shadowBlur=0;
      });
    }

    // Nodes with leaf sway
    graphNodes.forEach(function(n){_drawNode(ctx,n,matchedNodes,brightness);});

    ctx.restore();
  });
}

// ── Draw curved branch edge ───────────────────────────────
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
    var xs=members.map(function(n){return n.x;});
    var ys=members.map(function(n){return n.y;});
    var minY=Math.min.apply(null,ys)-20;
    // Use full height for silhouette so it always matches the layout area
    var treeH=fullTreeH;

    // ── Draw species silhouette (faded, behind everything) ──
    ctx.save();
    ctx.globalAlpha=0.18;
    _drawTreeSpecies(ctx,type,treeCX,baseY,slotPx,treeH,col);
    ctx.globalAlpha=1;
    ctx.restore();

    // Halo
    var minX=Math.min.apply(null,xs)-20,maxX=Math.max.apply(null,xs)+20;
    var maxY=Math.max.apply(null,ys)+20;
    var haloGrd=ctx.createRadialGradient(treeCX,(minY+maxY)/2,0,treeCX,(minY+maxY)/2,
      Math.max((maxX-minX),(maxY-minY))*0.65+40);
    haloGrd.addColorStop(0,col+'0e');haloGrd.addColorStop(1,col+'00');
    ctx.beginPath();
    ctx.ellipse(treeCX,(minY+maxY)/2,(maxX-minX)/2+30,(maxY-minY)/2+30,0,0,Math.PI*2);
    ctx.fillStyle=haloGrd;ctx.fill();

    // Ground line
    ctx.beginPath();
    ctx.moveTo(treeCX-slotPx*0.38,baseY+2);ctx.lineTo(treeCX+slotPx*0.38,baseY+2);
    ctx.strokeStyle=col+'44';ctx.lineWidth=1.5;ctx.stroke();

    // Root line from trunk to ground
    var trunk=members[0];
    ctx.beginPath();
    ctx.moveTo(trunk.x,trunk.y+trunk.radius);ctx.lineTo(trunk.x,baseY+2);
    ctx.strokeStyle=col+'30';ctx.lineWidth=2;ctx.stroke();

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
    var groveH=H*0.25;
    ctx.save();ctx.globalAlpha=0.13;
    _drawWalnut(ctx,groveCX,baseY,slotPx,groveH,ORPHAN_COLOR);
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
function _drawTreeSpecies(ctx,type,cx,baseY,slotW,treeH,col){
  if(type==='lecture')   _drawBirch(ctx,cx,baseY,slotW,treeH,col);
  else if(type==='general')   _drawOak(ctx,cx,baseY,slotW,treeH,col);
  else if(type==='daily')     _drawPine(ctx,cx,baseY,slotW,treeH,col);
  else if(type==='conversation') _drawHickory(ctx,cx,baseY,slotW,treeH,col);
  else if(type==='project')   _drawGinkgo(ctx,cx,baseY,slotW,treeH,col);
}

// ── BIRCH (lecture) ── tall, slender, elegant white bark
// Slim trunk, delicate drooping branches, oval-ish light canopy
function _drawBirch(ctx,cx,baseY,slotW,treeH,col){
  var trunkW=slotW*0.04;
  var trunkTop=baseY-treeH*0.88;
  // Slender trunk
  ctx.beginPath();
  ctx.moveTo(cx-trunkW,baseY);ctx.lineTo(cx-trunkW*0.5,trunkTop);
  ctx.lineTo(cx+trunkW*0.5,trunkTop);ctx.lineTo(cx+trunkW,baseY);
  ctx.closePath();ctx.fillStyle=col;ctx.fill();
  // Bark marks — horizontal dashes
  for(var i=0;i<5;i++){
    var by=baseY-treeH*(0.15+i*0.14);
    ctx.beginPath();ctx.moveTo(cx-trunkW*0.8,by);ctx.lineTo(cx+trunkW*0.8,by);
    ctx.strokeStyle=col;ctx.lineWidth=trunkW*0.5;ctx.stroke();
  }
  // Main canopy — elongated oval, slightly off-center drooping clusters
  var cW=slotW*0.38,cH=treeH*0.55;
  var cY=trunkTop+cH*0.3;
  ctx.beginPath();ctx.ellipse(cx,cY,cW,cH,0,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
  // Drooping side tufts
  for(var s=-1;s<=1;s+=2){
    ctx.beginPath();
    ctx.ellipse(cx+s*cW*0.5,cY+cH*0.2,cW*0.28,cH*0.35,s*0.3,0,Math.PI*2);
    ctx.fillStyle=col;ctx.fill();
  }
}

// ── OAK (general) ── wide spreading crown, gnarled trunk, massive presence
function _drawOak(ctx,cx,baseY,slotW,treeH,col){
  var trunkW=slotW*0.09;
  var trunkH=treeH*0.42;
  var trunkTop=baseY-trunkH;
  // Thick gnarled trunk — slight curve
  ctx.beginPath();
  ctx.moveTo(cx-trunkW,baseY);
  ctx.quadraticCurveTo(cx-trunkW*1.2,baseY-trunkH*0.5,cx-trunkW*0.4,trunkTop);
  ctx.lineTo(cx+trunkW*0.4,trunkTop);
  ctx.quadraticCurveTo(cx+trunkW*1.2,baseY-trunkH*0.5,cx+trunkW,baseY);
  ctx.closePath();ctx.fillStyle=col;ctx.fill();
  // Main wide canopy — layered blobs for oak bulk
  var cR=slotW*0.46;
  var cY=trunkTop-cR*0.55;
  ctx.beginPath();ctx.arc(cx,cY,cR,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
  // Side lobes
  ctx.beginPath();ctx.arc(cx-cR*0.55,cY+cR*0.1,cR*0.65,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
  ctx.beginPath();ctx.arc(cx+cR*0.55,cY+cR*0.1,cR*0.65,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
  // Top lobe
  ctx.beginPath();ctx.arc(cx,cY-cR*0.45,cR*0.5,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
  // Low branches poking out
  for(var s=-1;s<=1;s+=2){
    ctx.beginPath();ctx.moveTo(cx+s*trunkW*0.3,trunkTop+trunkH*0.15);
    ctx.lineTo(cx+s*cR*0.85,trunkTop-treeH*0.05);
    ctx.strokeStyle=col;ctx.lineWidth=trunkW*0.5;ctx.stroke();
  }
}

// ── PINE (daily) ── classic layered triangle, strong and symmetric
function _drawPine(ctx,cx,baseY,slotW,treeH,col){
  var trunkW=slotW*0.055;
  var trunkH=treeH*0.2;
  // Trunk
  ctx.beginPath();
  ctx.rect(cx-trunkW,baseY-trunkH,trunkW*2,trunkH);
  ctx.fillStyle=col;ctx.fill();
  // Layered triangles — 4 tiers, each one slightly narrower and higher
  var tiers=4;
  for(var i=0;i<tiers;i++){
    var frac=i/tiers;
    var tierW=slotW*(0.46-frac*0.12);
    var tierTop=baseY-trunkH-(treeH-trunkH)*(0.18+frac*0.72);
    var tierBase=baseY-trunkH-(treeH-trunkH)*(frac*0.55);
    ctx.beginPath();
    ctx.moveTo(cx,tierTop);
    ctx.lineTo(cx-tierW,tierBase);
    ctx.lineTo(cx+tierW,tierBase);
    ctx.closePath();ctx.fillStyle=col;ctx.fill();
  }
  // Pointed top cap
  ctx.beginPath();
  ctx.moveTo(cx,baseY-treeH);
  ctx.lineTo(cx-slotW*0.06,baseY-treeH*0.82);
  ctx.lineTo(cx+slotW*0.06,baseY-treeH*0.82);
  ctx.closePath();ctx.fillStyle=col;ctx.fill();
}

// ── HICKORY (conversation) ── tall straight trunk, irregular asymmetric crown
// Hickory is a tall hardwood with a high crown and slightly zigzag branching
function _drawHickory(ctx,cx,baseY,slotW,treeH,col){
  var trunkW=slotW*0.06;
  var trunkH=treeH*0.52; // tall straight trunk
  var trunkTop=baseY-trunkH;
  // Tall straight trunk
  ctx.beginPath();
  ctx.rect(cx-trunkW*0.5,baseY-trunkH,trunkW,trunkH);
  ctx.fillStyle=col;ctx.fill();
  // Irregular crown — 5 offset blobs at different heights/angles
  var blobs=[
    {ox:0,        oy:-0.30, r:0.30},
    {ox:-0.28,    oy:-0.18, r:0.22},
    {ox: 0.32,    oy:-0.20, r:0.24},
    {ox:-0.18,    oy:-0.48, r:0.18},
    {ox: 0.14,    oy:-0.55, r:0.16},
  ];
  blobs.forEach(function(b){
    ctx.beginPath();
    ctx.arc(cx+b.ox*slotW,trunkTop+b.oy*treeH,b.r*slotW,0,Math.PI*2);
    ctx.fillStyle=col;ctx.fill();
  });
  // Zigzag branch lines
  var branches=[[0,-0.08,-0.35,-0.22],[0,-0.08,0.38,-0.25],[0,-0.22,-0.20,-0.44],[0,-0.22,0.22,-0.50]];
  branches.forEach(function(b){
    ctx.beginPath();
    ctx.moveTo(cx+b[0]*slotW,trunkTop+b[1]*treeH);
    ctx.lineTo(cx+b[2]*slotW,trunkTop+b[3]*treeH);
    ctx.strokeStyle=col;ctx.lineWidth=trunkW*0.6;ctx.stroke();
  });
}

// ── GINKGO (project) ── surprise! fan-shaped leaves, ancient, distinctive
// The ginkgo biloba — one of the oldest living tree species.
// Fan-shaped lobes, straight trunk, spreading tiered crown.
function _drawGinkgo(ctx,cx,baseY,slotW,treeH,col){
  var trunkW=slotW*0.055;
  var trunkH=treeH*0.38;
  var trunkTop=baseY-trunkH;
  // Trunk
  ctx.beginPath();
  ctx.rect(cx-trunkW*0.5,baseY-trunkH,trunkW,trunkH);
  ctx.fillStyle=col;ctx.fill();
  // Ginkgo fan clusters — characteristic bilobed fans arranged in tiers
  // Each "fan" is a wide semicircle with a notch
  function drawFan(fx,fy,r,angle){
    ctx.save();ctx.translate(fx,fy);ctx.rotate(angle);
    // Fan shape: semicircle
    ctx.beginPath();ctx.arc(0,0,r,-Math.PI*0.05,-Math.PI,true);ctx.closePath();
    ctx.fillStyle=col;ctx.fill();
    // Central notch (ginkgo leaf characteristic)
    ctx.beginPath();ctx.arc(0,0,r*0.38,Math.PI*0.2,-Math.PI*1.2,false);ctx.closePath();
    ctx.fillStyle='rgba(0,0,0,0.0)'; // transparent — just clip visually via globalAlpha
    ctx.restore();
  }
  // 3 tiers of fans
  var tiers=[
    [{ox:0,oy:-0.55,r:0.30,a:0},{ox:-0.22,oy:-0.42,r:0.22,a:-0.4},{ox:0.22,oy:-0.42,r:0.22,a:0.4}],
    [{ox:-0.30,oy:-0.20,r:0.24,a:-0.6},{ox:0.30,oy:-0.20,r:0.24,a:0.6},{ox:0,oy:-0.28,r:0.20,a:0}],
    [{ox:-0.26,oy:-0.04,r:0.18,a:-0.8},{ox:0.26,oy:-0.04,r:0.18,a:0.8}],
  ];
  tiers.forEach(function(tier){
    tier.forEach(function(b){
      drawFan(cx+b.ox*slotW,trunkTop+b.oy*treeH,b.r*slotW,b.a);
    });
  });
  // Thin branch lines to each fan cluster
  var blines=[
    [0,0,-0.30,-0.44],[0,0,0.30,-0.44],[0,0,0,-0.52],
    [0,-0.44,-0.30,-0.20],[0,-0.44,0.30,-0.20]
  ];
  blines.forEach(function(b){
    ctx.beginPath();
    ctx.moveTo(cx+b[0]*slotW,trunkTop+b[1]*treeH);
    ctx.lineTo(cx+b[2]*slotW,trunkTop+b[3]*treeH);
    ctx.strokeStyle=col;ctx.lineWidth=trunkW*0.45;ctx.stroke();
  });
}

// ── WALNUT (orphan grove) ── broad rounded crown, divided trunk
function _drawWalnut(ctx,cx,baseY,slotW,treeH,col){
  var trunkW=slotW*0.08;
  var trunkH=treeH*0.35;
  var trunkTop=baseY-trunkH;
  // Divided trunk (walnut splits low)
  ctx.beginPath();
  ctx.moveTo(cx-trunkW,baseY);
  ctx.lineTo(cx-trunkW*0.8,trunkTop+trunkH*0.3);
  ctx.lineTo(cx-trunkW*1.4,trunkTop);
  ctx.strokeStyle=col;ctx.lineWidth=trunkW*0.9;ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx+trunkW,baseY);
  ctx.lineTo(cx+trunkW*0.8,trunkTop+trunkH*0.3);
  ctx.lineTo(cx+trunkW*1.4,trunkTop);
  ctx.strokeStyle=col;ctx.lineWidth=trunkW*0.9;ctx.stroke();
  // Short joining trunk section
  ctx.beginPath();ctx.rect(cx-trunkW*0.5,baseY-trunkH*0.35,trunkW,trunkH*0.35);
  ctx.fillStyle=col;ctx.fill();
  // Wide rounded canopy — two overlapping blobs (one per split trunk)
  ctx.beginPath();ctx.arc(cx-slotW*0.12,trunkTop-treeH*0.18,slotW*0.30,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
  ctx.beginPath();ctx.arc(cx+slotW*0.12,trunkTop-treeH*0.18,slotW*0.30,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
  // Top blob joining them
  ctx.beginPath();ctx.arc(cx,trunkTop-treeH*0.28,slotW*0.24,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
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
