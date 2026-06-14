// ═══════════════════════════════════════════════════════════
// ══  VAULT GRAPH  ══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
var graphNodes=[],graphEdges=[],graphAnim=null;
var graphTransform={x:0,y:0,scale:1};
var graphPanning=false,graphPanStart={x:0,y:0};
var hoveredNode=null,simTick=0;
var pinnedNodes={}; // id -> true when pinned
var typeColors={conversation:'#a78bfa',project:'#60a5fa',lecture:'#fde047',daily:'#4ade80',general:'#7c6af7'};
var ORPHAN_COLOR='#00e5cc'; // bright teal for orphan nodes

// ── Strip frontmatter and return first N lines of content ──
function getPreviewLines(content,n){
  if(!content)return'';
  var stripped=content.replace(/^---[\s\S]*?---\s*/,'').trim();
  return stripped.split('\n').filter(function(l){return l.trim().length>0;}).slice(0,n).join('\n');
}

function initGraphCanvas(){
  var canvas=document.getElementById('vault-graph-canvas');
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  window.addEventListener('resize',function(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;});

  // Pan start
  canvas.addEventListener('mousedown',function(e){
    if(e.target!==canvas)return;
    graphPanning=true;
    graphPanStart={x:e.clientX-graphTransform.x,y:e.clientY-graphTransform.y};
  });

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
        typeEl.textContent=hoveredNode.type+(hoveredNode.orphan?' · orphan':'')+(pinnedNodes[hoveredNode.id]?' · pinned':'');
        typeEl.style.background=typeColors[hoveredNode.type]+'22';
        typeEl.style.color=hoveredNode.orphan?ORPHAN_COLOR:(typeColors[hoveredNode.type]||'#7c6af7');
        typeEl.style.border='1px solid '+(hoveredNode.orphan?ORPHAN_COLOR:(typeColors[hoveredNode.type]||'#7c6af7'))+'44';
        // Preview: first 3 lines of content
        var preview=getPreviewLines(hoveredNode.content,3);
        var previewEl=document.getElementById('tt-preview');
        if(previewEl){previewEl.textContent=preview;}
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

  // Zoom
  canvas.addEventListener('wheel',function(e){
    e.preventDefault();
    var factor=e.deltaY>0?0.9:1.1;
    var mx=e.clientX,my=e.clientY;
    graphTransform.x=mx-(mx-graphTransform.x)*factor;
    graphTransform.y=my-(my-graphTransform.y)*factor;
    graphTransform.scale=Math.max(0.1,Math.min(5,graphTransform.scale*factor));
  },{passive:false});

  // Click — open note in VAULTUI viewer
  canvas.addEventListener('click',function(e){
    if(!hoveredNode)return;
    var note=vaultIndex[hoveredNode.srcIdx!==undefined?hoveredNode.srcIdx:hoveredNode.id];
    if(!note)return;
    if(typeof VAULTUI!=='undefined'&&VAULTUI.showPanel){
      VAULTUI.showPanel();
      // Small delay so panel is visible before opening note
      setTimeout(function(){
        var idx=vaultIndex.indexOf(note);
        if(idx>=0&&VAULTUI._openNoteByIdx)VAULTUI._openNoteByIdx(idx);
      },80);
    }
  });

  // Double-click — pin/unpin node
  canvas.addEventListener('dblclick',function(e){
    if(!hoveredNode)return;
    var id=hoveredNode.id;
    if(pinnedNodes[id]){
      delete pinnedNodes[id];
      hoveredNode.pinned=false;
    }else{
      pinnedNodes[id]=true;
      hoveredNode.pinned=true;
    }
  });
}

function buildGraph(){
  document.getElementById('graph-overlay').classList.add('hidden');
  document.getElementById('graph-stats').style.display='flex';

  var candidates=vaultIndex.slice(0,150).map(function(note,i){
    return{srcIdx:i,name:note.name.replace('.md',''),path:note.path,type:detectType(note.path,note.content),content:note.content};
  });
  var filtered=candidates.filter(function(c){return GraphSettings.typeFilter[c.type]!==false;});

  graphNodes=filtered.map(function(c,i){
    return{
      id:i,srcIdx:c.srcIdx,name:c.name,path:c.path,type:c.type,
      content:c.content,
      x:0,y:0,vx:0,vy:0,
      radius:(4+Math.min(c.content.length/600,7))*GraphSettings.nodeSizeScale,
      connCount:0,linkWeight:0,orphan:false,
      pinned:!!pinnedNodes[i]
    };
  });

  // Build edges with weight (count duplicate links)
  var edgeMap={};
  graphEdges=[];
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

  // Connection counts + orphan detection
  graphEdges.forEach(function(e){
    if(graphNodes[e.a])graphNodes[e.a].connCount++;
    if(graphNodes[e.b])graphNodes[e.b].connCount++;
  });
  graphNodes.forEach(function(n){n.orphan=n.connCount===0;});

  if(GraphSettings.sizeByConnections){
    var maxConn=Math.max(1,Math.max.apply(null,graphNodes.map(function(n){return n.connCount;})));
    graphNodes.forEach(function(n){n.radius=(3+Math.min((n.connCount/maxConn)*10,10))*GraphSettings.nodeSizeScale;});
  }

  document.getElementById('stat-notes').textContent=graphNodes.length;
  document.getElementById('stat-links').textContent=graphEdges.length;

  var W=window.innerWidth,H=window.innerHeight;
  var spread=Math.min(0.95,0.7*GraphSettings.graphArea);
  var margin=(1-spread)/2;

  if(GraphSettings.treeMode){
    // Tree layout: sort by connection count desc, arrange in rows
    var sorted=graphNodes.slice().sort(function(a,b){return b.connCount-a.connCount;});
    var cols=Math.ceil(Math.sqrt(sorted.length*1.6));
    sorted.forEach(function(n,i){
      var col=i%cols,row=Math.floor(i/cols);
      n.x=W*(0.1+0.8*(col/(cols-1||1)));
      n.y=H*(0.12+0.76*(row/Math.max(1,Math.ceil(sorted.length/cols)-1)));
    });
  }else if(GraphSettings.clusterMode){
    // Cluster layout: group by type, arrange groups in a circle
    var typeGroups={};
    var typeOrder=['conversation','project','lecture','daily','general'];
    typeOrder.forEach(function(t){typeGroups[t]=[];});
    graphNodes.forEach(function(n){(typeGroups[n.orphan?'__orphan':n.type]||(typeGroups['__orphan']=[],typeGroups['__orphan'])).push(n);});
    // Place orphans in bottom-left corner cluster
    var orphans=graphNodes.filter(function(n){return n.orphan;});
    var nonOrphans=graphNodes.filter(function(n){return!n.orphan;});
    // Arrange type groups around a circle
    var groupCenters={};
    var activeTypes=typeOrder.filter(function(t){return typeGroups[t]&&typeGroups[t].length>0;});
    activeTypes.forEach(function(t,gi){
      var angle=(gi/activeTypes.length)*Math.PI*2-Math.PI/2;
      groupCenters[t]={x:W/2+Math.cos(angle)*W*0.28,y:H/2+Math.sin(angle)*H*0.28};
    });
    nonOrphans.forEach(function(n){
      var center=groupCenters[n.type]||{x:W/2,y:H/2};
      n.x=center.x+(Math.random()-0.5)*160;
      n.y=center.y+(Math.random()-0.5)*160;
    });
    // Orphans cluster bottom-left
    orphans.forEach(function(n,i){
      var angle=(i/Math.max(1,orphans.length))*Math.PI*2;
      var r=40+Math.random()*40;
      n.x=W*0.12+Math.cos(angle)*r;
      n.y=H*0.82+Math.sin(angle)*r;
    });
  }else{
    // Default random spread
    graphNodes.forEach(function(n){
      n.x=W*margin+Math.random()*(W*spread);
      n.y=H*margin+Math.random()*(H*spread);
    });
  }

  simTick=0;if(graphAnim)cancelAnimationFrame(graphAnim);runGraphSim();
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

    if(simTick<300&&!treeMode){
      var k=Math.sqrt((W*H)/Math.max(graphNodes.length,1))*0.9*repulsion;

      // Repulsion between all nodes
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

      // Link attraction (stronger for higher weight edges)
      graphEdges.forEach(function(e){
        var a=graphNodes[e.a],b=graphNodes[e.b];if(!a||!b)return;
        var dx=b.x-a.x,dy=b.y-a.y;
        var dist=Math.sqrt(dx*dx+dy*dy)||1;
        var target=linkDist;
        var diff=(dist-target)/dist;
        // weight multiplier: heavier links pull slightly harder
        var w=0.04*(1+Math.min(e.weight-1,3)*0.15);
        a.vx+=dx*w*diff;a.vy+=dy*w*diff;
        b.vx-=dx*w*diff;b.vy-=dy*w*diff;
      });

      // Cluster mode: add gentle attraction toward type center
      if(clusterMode){
        var typeOrder=['conversation','project','lecture','daily','general'];
        var activeCenters={};
        typeOrder.forEach(function(t,gi){
          var members=graphNodes.filter(function(n){return n.type===t&&!n.orphan;});
          if(!members.length)return;
          activeCenters[t]={x:W/2,y:H/2}; // fallback
        });
        graphNodes.forEach(function(n){
          if(n.orphan){
            // Orphans attracted to bottom-left corner
            var tx=W*0.12,ty=H*0.82;
            n.vx+=(tx-n.x)*0.002;n.vy+=(ty-n.y)*0.002;
          }else if(activeCenters[n.type]){
            // Mild type-based attraction
            var tc=activeCenters[n.type];
            n.vx+=(tc.x-n.x)*0.0008;n.vy+=(tc.y-n.y)*0.0008;
          }
        });
      }

      // Integrate velocities, skip pinned nodes
      graphNodes.forEach(function(n){
        if(n.pinned)return; // pinned nodes don't move
        n.x+=Math.max(-8,Math.min(8,n.vx));
        n.y+=Math.max(-8,Math.min(8,n.vy));
        n.x=Math.max(30,Math.min(W/graphTransform.scale-30,n.x));
        n.y=Math.max(30,Math.min(H/graphTransform.scale-30,n.y));
      });
      simTick++;
    }

    // ── DRAW ────────────────────────────────────────────────
    ctx.clearRect(0,0,W,H);
    ctx.save();
    ctx.translate(graphTransform.x,graphTransform.y);
    ctx.scale(graphTransform.scale,graphTransform.scale);

    // Cluster backgrounds (soft type halos)
    if(clusterMode){
      var typeOrder=['conversation','project','lecture','daily','general'];
      typeOrder.forEach(function(t){
        var members=graphNodes.filter(function(n){return n.type===t&&!n.orphan;});
        if(members.length<2)return;
        var cx=members.reduce(function(s,n){return s+n.x;},0)/members.length;
        var cy=members.reduce(function(s,n){return s+n.y;},0)/members.length;
        var maxR=members.reduce(function(m,n){return Math.max(m,Math.sqrt((n.x-cx)*(n.x-cx)+(n.y-cy)*(n.y-cy)));},0)+30;
        ctx.beginPath();ctx.arc(cx,cy,maxR,0,Math.PI*2);
        ctx.fillStyle=(typeColors[t]||'#7c6af7')+'0a';
        ctx.strokeStyle=(typeColors[t]||'#7c6af7')+'22';
        ctx.lineWidth=1;ctx.fill();ctx.stroke();
      });
      // Orphan cluster background
      var orphans=graphNodes.filter(function(n){return n.orphan;});
      if(orphans.length>0){
        var ocx=orphans.reduce(function(s,n){return s+n.x;},0)/orphans.length;
        var ocy=orphans.reduce(function(s,n){return s+n.y;},0)/orphans.length;
        var omaxR=orphans.reduce(function(m,n){return Math.max(m,Math.sqrt((n.x-ocx)*(n.x-ocx)+(n.y-ocy)*(n.y-ocy)));},0)+30;
        ctx.beginPath();ctx.arc(ocx,ocy,omaxR,0,Math.PI*2);
        ctx.fillStyle=ORPHAN_COLOR+'08';
        ctx.strokeStyle=ORPHAN_COLOR+'30';
        ctx.lineWidth=1;ctx.fill();ctx.stroke();
        // Label
        ctx.font='10px IBM Plex Mono, monospace';
        ctx.fillStyle=ORPHAN_COLOR+'80';
        ctx.textAlign='center';
        ctx.fillText('orphans',ocx,ocy-omaxR-6);
        ctx.textAlign='left';
      }
    }

    var matchedNodes=null;
    if(query){
      matchedNodes={};
      graphNodes.forEach(function(n){if(n.name.toLowerCase().includes(query))matchedNodes[n.id]=true;});
    }

    // Edges — thickness by weight
    graphEdges.forEach(function(e){
      var a=graphNodes[e.a],b=graphNodes[e.b];if(!a||!b)return;
      var isHL=hoveredNode&&(e.a===hoveredNode.id||e.b===hoveredNode.id);
      var baseW=0.5+Math.min(e.weight-1,4)*0.6; // weight 1=0.5px, 2=1.1px, 3=1.7px etc
      ctx.beginPath();
      ctx.strokeStyle=isHL?'rgba(124,106,247,0.6)':'rgba(124,106,247,0.08)';
      ctx.lineWidth=isHL?Math.max(baseW,1.5):baseW;
      if(isHL){ctx.shadowColor='rgba(124,106,247,0.4)';ctx.shadowBlur=4;}
      else{ctx.shadowBlur=0;}
      ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    });
    ctx.shadowBlur=0;

    // Nodes
    graphNodes.forEach(function(n){
      var isPinned=!!pinnedNodes[n.id];
      var isOrphan=n.orphan;
      var color=isOrphan?ORPHAN_COLOR:(typeColors[n.type]||'#7c6af7');
      var isHv=hoveredNode&&hoveredNode.id===n.id;
      var isCn=hoveredNode&&graphEdges.some(function(e){return(e.a===hoveredNode.id&&e.b===n.id)||(e.b===hoveredNode.id&&e.a===n.id);});
      var isMatch=matchedNodes&&matchedNodes[n.id];
      var r=isHv?n.radius*2.2:isCn?n.radius*1.4:isMatch?n.radius*1.8:n.radius;

      // Shadow/glow
      if(isPinned){ctx.shadowColor='#f87171';ctx.shadowBlur=10;}
      else if(isHv){ctx.shadowColor=color;ctx.shadowBlur=12;}
      else if(isMatch){ctx.shadowColor='#fde047';ctx.shadowBlur=14;}
      else if(isCn){ctx.shadowColor=color;ctx.shadowBlur=6;}
      else if(isOrphan){ctx.shadowColor=ORPHAN_COLOR;ctx.shadowBlur=5;}
      else{ctx.shadowBlur=0;}

      ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);
      var alpha=query?(isMatch?'ff':'22'):(isHv?'':isCn?'cc':'55');
      ctx.fillStyle=isPinned?'#f87171':(isHv?color:(alpha?color+alpha:color));
      ctx.fill();

      // Pinned node: red border box
      if(isPinned){
        ctx.shadowBlur=0;
        ctx.strokeStyle='#f87171';
        ctx.lineWidth=1.5;
        var boxS=r*2+6;
        ctx.strokeRect(n.x-boxS/2,n.y-boxS/2,boxS,boxS);
      }

      // Label
      var showLabel=isHv||isMatch||isPinned||GraphSettings.showLabels||(graphTransform.scale>1.8);
      if(showLabel){
        ctx.shadowBlur=0;
        ctx.font=(isHv||isMatch?'bold ':'')+'10px IBM Plex Mono, monospace';
        ctx.fillStyle=isPinned?'#f87171':(isHv||isMatch)?'rgba(232,230,240,1)':'rgba(232,230,240,0.5)';
        ctx.fillText(n.name,n.x+r+3,n.y+3);
      }
    });

    // Tree mode: draw hierarchy lines more prominently
    if(treeMode){
      // Already drawn above as edges, but add a subtle level indicator
      ctx.shadowBlur=0;
    }

    ctx.restore();
  });
}
