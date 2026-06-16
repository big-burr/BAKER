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
  graphNodes.forEach(function(n){
  // Only send to orphan grove if unlinked AND untyped (general)
  // Typed notes (daily, lecture, conversation, project) always stay in their tree
  n.orphan=(n.connCount===0&&n.type==='general');
});

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
    ctx.fillStyle=col;ctx.globalAlpha*=0.7;ctx.fill();ctx.globalAlpha=1;
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

  tierData.forEach(function(tier){
    // Draw horizontal branch line
    ctx.beginPath();
    ctx.moveTo(cx-tier.spread*slotW,tier.y);
    ctx.lineTo(cx+tier.spread*slotW,tier.y);
    ctx.strokeStyle=col;ctx.lineWidth=tw*0.4;ctx.stroke();

    // Fan leaves clustered at branch tips and along branches
    for(var f=0;f<tier.fans;f++){
      var fx=cx-tier.spread*slotW+(f/(Math.max(tier.fans-1,1)))*tier.spread*slotW*2;
      var fanR=tier.fanR*slotW*(0.8+Math.random()*0.4);
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
