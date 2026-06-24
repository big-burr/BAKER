// ═══════════════════════════════════════════════════════════
// ══  PLACES PANEL MODULE  ══════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Nearby places via Overpass API (OpenStreetMap, free)
// Map: Leaflet + OSM tiles (free, no key)
// Distances: OSRM routing API (free, no key)
// Categories: food, gym, coffee, study, campus, gas, pharmacy
// Layout: map top, filterable list bottom
// Units: miles | Default radius: 5 miles
// ═══════════════════════════════════════════════════════════
var PLACES=(function(){

  var LS_KEY='baker_places_v1';
  var PANEL_ID='places-panel';
  var DEFAULT_RADIUS=5; // miles
  var MILES_PER_METER=0.000621371;

  var _map=null;
  var _markers=[];
  var _userMarker=null;
  var _results=[];
  var _userLat=null,_userLon=null;
  var _loading=false;
  var _activeCategory='all';
  var _leafletLoaded=false;

  // ── Categories → Overpass query tags ─────────────────────
  var CATS={
    food:{label:'🍔 Food',icon:'🍔',color:'#f87171',tags:[
      'amenity=restaurant','amenity=fast_food','amenity=food_court',
      'amenity=cafe','shop=deli','amenity=pub','amenity=bar'
    ]},
    coffee:{label:'☕ Coffee',icon:'☕',color:'#c084fc',tags:[
      'amenity=cafe','shop=coffee'
    ]},
    gym:{label:'💪 Gym',icon:'💪',color:'#4ade80',tags:[
      'leisure=fitness_centre','leisure=gym','amenity=gym',
      'sport=fitness','leisure=sports_centre'
    ]},
    study:{label:'📚 Study',icon:'📚',color:'#60a5fa',tags:[
      'amenity=library','amenity=study_room','building=library',
      'amenity=university','amenity=college','amenity=public_bookcase'
    ]},
    campus:{label:'🎓 Campus',icon:'🎓',color:'#a78bfa',tags:[
      'amenity=university','amenity=college','amenity=school',
      'building=university','building=college','amenity=classroom'
    ]},
    gas:{label:'⛽ Gas',icon:'⛽',color:'#fbbf24',tags:[
      'amenity=fuel','shop=gas','amenity=gas_station'
    ]},
    pharmacy:{label:'💊 Pharmacy',icon:'💊',color:'#34d399',tags:[
      'amenity=pharmacy','shop=pharmacy','amenity=hospital',
      'amenity=clinic','amenity=doctors'
    ]}
  };

  // ── Leaflet loader ────────────────────────────────────────
  function _loadLeaflet(cb){
    if(_leafletLoaded&&window.L){cb();return;}
    // Load CSS
    if(!document.getElementById('leaflet-css')){
      var link=document.createElement('link');
      link.id='leaflet-css';
      link.rel='stylesheet';
      link.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }
    // Load JS
    if(!window.L){
      var script=document.createElement('script');
      script.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      script.onload=function(){_leafletLoaded=true;cb();};
      document.head.appendChild(script);
    }else{_leafletLoaded=true;cb();}
  }

  // ── Get user location ─────────────────────────────────────
  function _getLocation(){
    return new Promise(function(resolve,reject){
      if(!navigator.geolocation){reject(new Error('Geolocation not supported'));return;}
      navigator.geolocation.getCurrentPosition(
        function(pos){resolve({lat:pos.coords.latitude,lon:pos.coords.longitude});},
        function(err){
          // Fall back to Oscoda MI
          resolve({lat:44.4186,lon:-83.3549,fallback:true});
        },
        {timeout:8000,maximumAge:60000}
      );
    });
  }

  // ── Overpass query ────────────────────────────────────────
  async function _fetchPlaces(lat,lon,category){
    var radiusM=Math.round(DEFAULT_RADIUS/MILES_PER_METER);
    var tags=category==='all'
      ? Object.values(CATS).flatMap(function(c){return c.tags;})
      : (CATS[category]?CATS[category].tags:[]);

    // Deduplicate tags
    tags=[...new Set(tags)];

    // Build Overpass union query
    var union=tags.map(function(t){
      var parts=t.split('=');
      return 'node["'+parts[0]+'"="'+parts[1]+'"](around:'+radiusM+','+lat+','+lon+');'+
             'way["'+parts[0]+'"="'+parts[1]+'"](around:'+radiusM+','+lat+','+lon+');';
    }).join('');

    var query='[out:json][timeout:15];('+union+');out center 40;';
    var url='https://overpass-api.de/api/interpreter?data='+encodeURIComponent(query);

    var controller=new AbortController();
    var timeout=setTimeout(function(){controller.abort();},12000);
    try{
      var resp=await fetch(url,{signal:controller.signal});
      var data=await resp.json();
      return data.elements||[];
    }finally{clearTimeout(timeout);}
  }

  // ── OSRM driving distance ─────────────────────────────────
  async function _getDrivingDistance(fromLat,fromLon,toLat,toLon){
    try{
      var url='https://router.project-osrm.org/route/v1/driving/'+
        fromLon+','+fromLat+';'+toLon+','+toLat+'?overview=false';
      var resp=await fetch(url,{signal:AbortSignal.timeout(4000)});
      var data=await resp.json();
      if(data.routes&&data.routes[0]){
        var meters=data.routes[0].distance;
        var seconds=data.routes[0].duration;
        return{
          miles:(meters*MILES_PER_METER).toFixed(1),
          mins:Math.round(seconds/60)
        };
      }
    }catch(e){}
    // Fallback: straight line
    var R=3958.8;
    var dLat=(toLat-fromLat)*Math.PI/180;
    var dLon=(toLon-fromLon)*Math.PI/180;
    var a=Math.sin(dLat/2)*Math.sin(dLat/2)+
          Math.cos(fromLat*Math.PI/180)*Math.cos(toLat*Math.PI/180)*
          Math.sin(dLon/2)*Math.sin(dLon/2);
    var dist=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    return{miles:dist.toFixed(1),mins:null};
  }

  // ── Categorize a result ───────────────────────────────────
  function _categorizeResult(el){
    var tags=el.tags||{};
    for(var cat in CATS){
      var catTags=CATS[cat].tags;
      for(var i=0;i<catTags.length;i++){
        var parts=catTags[i].split('=');
        if(tags[parts[0]]===parts[1])return cat;
      }
    }
    return'food'; // default
  }

  // ── Build results ─────────────────────────────────────────
  async function _buildResults(elements,userLat,userLon){
    // Extract name + coords
    var raw=elements.map(function(el){
      var lat=el.lat||(el.center&&el.center.lat);
      var lon=el.lon||(el.center&&el.center.lon);
      if(!lat||!lon)return null;
      var tags=el.tags||{};
      var name=tags.name||tags['name:en']||tags.brand||'Unnamed';
      if(name==='Unnamed')return null;
      return{
        id:el.id,
        name:name,
        lat:lat,lon:lon,
        category:_categorizeResult(el),
        tags:tags,
        hours:tags.opening_hours||null,
        phone:tags.phone||tags['contact:phone']||null,
        website:tags.website||tags['contact:website']||null,
        distance:null,mins:null
      };
    }).filter(Boolean);

    // Deduplicate by name+approx location
    var seen=new Set();
    raw=raw.filter(function(r){
      var key=r.name+'|'+r.lat.toFixed(3)+'|'+r.lon.toFixed(3);
      if(seen.has(key))return false;
      seen.add(key);return true;
    });

    // Sort by straight-line distance first
    raw.forEach(function(r){
      var dLat=r.lat-userLat,dLon=r.lon-userLon;
      r._rawDist=Math.sqrt(dLat*dLat+dLon*dLon);
    });
    raw.sort(function(a,b){return a._rawDist-b._rawDist;});

    // Limit to 30, then get driving distances for top 15
    raw=raw.slice(0,30);
    var top=raw.slice(0,15);
    var distPromises=top.map(function(r){
      return _getDrivingDistance(userLat,userLon,r.lat,r.lon).then(function(d){
        r.distance=d.miles;r.mins=d.mins;
      });
    });
    await Promise.allSettled(distPromises);

    // Straight line estimate for remainder
    raw.slice(15).forEach(function(r){
      var R=3958.8,dLat=(r.lat-userLat)*Math.PI/180,dLon=(r.lon-userLon)*Math.PI/180;
      var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(userLat*Math.PI/180)*Math.cos(r.lat*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
      r.distance=(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(1);
    });

    // Final sort by driving distance
    raw.sort(function(a,b){return parseFloat(a.distance||99)-parseFloat(b.distance||99);});
    return raw;
  }

  // ── Render ────────────────────────────────────────────────
  function _render(){
    var body=document.getElementById('places-body');
    if(!body)return;

    // Category filter bar
    var catBar='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">'+
      '<button class="pl-cat-btn'+((_activeCategory==='all')?' active':'')+'" data-cat="all" style="'+_catBtnStyle(_activeCategory==='all','#7c6af7')+'">🗺️ All</button>';
    Object.keys(CATS).forEach(function(k){
      var c=CATS[k];
      catBar+='<button class="pl-cat-btn'+((_activeCategory===k)?' active':'')+'" data-cat="'+k+'" style="'+_catBtnStyle(_activeCategory===k,c.color)+'">'+c.label+'</button>';
    });
    catBar+='</div>';

    // Map container
    var mapHtml='<div id="places-map" style="height:220px;border-radius:8px;overflow:hidden;margin-bottom:10px;border:1px solid var(--border)"></div>';

    // Results list
    var filtered=_activeCategory==='all'?_results:_results.filter(function(r){return r.category===_activeCategory;});
    var listHtml='';
    if(_loading){
      listHtml='<div style="text-align:center;padding:20px;font-family:var(--mono);font-size:11px;color:var(--muted)">'+
        '<div style="font-size:24px;margin-bottom:8px;animation:spin 1s linear infinite">&#9711;</div>Locating you and fetching places...</div>';
    }else if(!_results.length){
      listHtml='<div style="font-family:var(--mono);font-size:11px;color:var(--muted);padding:12px;text-align:center">No places found nearby. Try a different category or check your location.</div>';
    }else if(!filtered.length){
      listHtml='<div style="font-family:var(--mono);font-size:11px;color:var(--muted);padding:12px;text-align:center">No '+(_activeCategory in CATS?CATS[_activeCategory].label:'')+ ' found nearby.</div>';
    }else{
      listHtml='<div style="display:flex;flex-direction:column;gap:6px">';
      filtered.slice(0,20).forEach(function(r,i){
        var cat=CATS[r.category]||CATS.food;
        var distStr=r.distance?(r.distance+' mi'+(r.mins?' · '+r.mins+' min drive':' away')):'';
        var hoursStr=r.hours?'<div style="font-size:9px;color:var(--muted);margin-top:2px;font-family:var(--mono)">'+_esc(r.hours.slice(0,40))+'</div>':'';
        // Apple Maps on iOS/Mac, Google Maps everywhere else
      var isApple=/iPad|iPhone|Macintosh/i.test(navigator.userAgent);
      var mapsUrl=isApple
        ?'https://maps.apple.com/?daddr='+r.lat+','+r.lon+'&dirflg=d'
        :'https://www.google.com/maps/dir/?api=1&destination='+r.lat+','+r.lon;
        // Try Google Maps on non-Apple
        listHtml+='<div class="pl-result" data-idx="'+i+'" style="'+
          'display:flex;align-items:center;gap:10px;padding:10px 12px;'+
          'background:var(--surface);border:1px solid var(--border);border-radius:8px;'+
          'border-left:3px solid '+cat.color+';cursor:pointer;transition:all .15s">'+
          '<div style="font-size:20px;flex-shrink:0">'+cat.icon+'</div>'+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-family:var(--mono);font-size:11px;color:var(--text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_esc(r.name)+'</div>'+
            '<div style="font-family:var(--mono);font-size:9px;color:var(--accent);margin-top:2px">'+distStr+'</div>'+
            hoursStr+
          '</div>'+
          '<a href="'+mapsUrl+'" target="_blank" style="'+
          'background:none;border:1px solid var(--border);border-radius:4px;'+
          'padding:4px 8px;font-family:var(--mono);font-size:9px;color:var(--muted);'+
          'text-decoration:none;flex-shrink:0;white-space:nowrap">&#9193; Directions</a>'+
          '</div>';
      });
      listHtml+='</div>';
      if(filtered.length>20){
        listHtml+='<div style="font-family:var(--mono);font-size:9px;color:var(--muted);text-align:center;margin-top:6px">Showing 20 of '+filtered.length+' results</div>';
      }
    }

    body.innerHTML=catBar+mapHtml+listHtml;

    // Init map
    _initMap();

    // Category filter events
    body.querySelectorAll('.pl-cat-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        _activeCategory=btn.dataset.cat;
        _render();
      });
    });

    // Result hover → highlight map marker
    body.querySelectorAll('.pl-result').forEach(function(card){
      card.addEventListener('mouseenter',function(){
        var idx=parseInt(card.dataset.idx);
        var r=filtered[idx];
        if(r&&_map){_map.setView([r.lat,r.lon],15,{animate:true});}
      });
    });
  }

  function _catBtnStyle(active,color){
    return 'background:'+(active?color+'22':'none')+';border:1px solid '+(active?color:'var(--border)')+';'+
      'border-radius:4px;padding:3px 8px;font-family:var(--mono);font-size:9px;'+
      'color:'+(active?color:'var(--muted)')+';cursor:pointer;white-space:nowrap;transition:all .15s';
  }

  function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  // ── Leaflet map init ──────────────────────────────────────
  function _initMap(){
    if(!window.L)return;
    var mapEl=document.getElementById('places-map');
    if(!mapEl)return;

    // Destroy old map
    if(_map){_map.remove();_map=null;}

    var lat=_userLat||44.4186,lon=_userLon||-83.3549;
    _map=L.map('places-map',{zoomControl:true,attributionControl:false}).setView([lat,lon],13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
      maxZoom:19,subdomains:'abcd'
    }).addTo(_map);

    // User marker
    if(_userLat){
      var userIcon=L.divIcon({
        html:'<div style="width:14px;height:14px;border-radius:50%;background:#7c6af7;border:2px solid white;box-shadow:0 0 8px #7c6af7"></div>',
        iconSize:[14,14],className:''
      });
      L.marker([_userLat,_userLon],{icon:userIcon}).addTo(_map).bindPopup('You are here');
    }

    // Place markers
    var filtered=_activeCategory==='all'?_results:_results.filter(function(r){return r.category===_activeCategory;});
    filtered.slice(0,20).forEach(function(r){
      var cat=CATS[r.category]||CATS.food;
      var icon=L.divIcon({
        html:'<div style="font-size:16px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))">'+cat.icon+'</div>',
        iconSize:[20,20],className:''
      });
      // Apple Maps on iOS/Mac, Google Maps everywhere else
      var isApple=/iPad|iPhone|Macintosh/i.test(navigator.userAgent);
      var mapsUrl=isApple
        ?'https://maps.apple.com/?daddr='+r.lat+','+r.lon+'&dirflg=d'
        :'https://www.google.com/maps/dir/?api=1&destination='+r.lat+','+r.lon;
      L.marker([r.lat,r.lon],{icon:icon}).addTo(_map)
        .bindPopup('<div style="font-family:monospace;font-size:11px;min-width:120px">'+
          '<strong>'+r.name+'</strong><br>'+
          (r.distance?r.distance+' mi away<br>':'')+
          '<a href="'+mapsUrl+'" target="_blank" style="color:#7c6af7">Get Directions</a>'+
          '</div>');
    });
  }

  // ── Main search ───────────────────────────────────────────
  async function _search(){
    _loading=true;_results=[];
    _render();

    try{
      var loc=await _getLocation();
      _userLat=loc.lat;_userLon=loc.lon;

      if(loc.fallback&&typeof setStatus==='function'){
        setStatus('Location unavailable — showing Oscoda, MI');
      }

      var elements=await _fetchPlaces(_userLat,_userLon,_activeCategory);
      _results=await _buildResults(elements,_userLat,_userLon);

    }catch(e){
      console.error('[PLACES]',e);
      if(typeof speakResponse==='function')speakResponse('Could not fetch nearby places, sir.');
    }finally{
      _loading=false;
      _render();
    }
  }

  // ── Panel ─────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById(PANEL_ID);
    if(!p)return;
    p.classList.add('pl-vis');
    if(p._wbNormalise)p._wbNormalise();
    _loadLeaflet(function(){
      _render();
      _search();
    });
  }
  function hidePanel(){
    var p=document.getElementById(PANEL_ID);
    if(p)p.classList.remove('pl-vis');
    if(_map){_map.remove();_map=null;}
  }
  function togglePanel(){
    var p=document.getElementById(PANEL_ID);
    if(!p)return;
    if(p.classList.contains('pl-vis'))hidePanel();
    else showPanel();
  }

  // ── Voice ─────────────────────────────────────────────────
  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(/\b(open|show|find|nearby|places|around me)\b.*\b(places?|food|coffee|gym|pharmacy|gas|map)\b|\bwhat('?s| is) nearby\b/.test(c)){
      showPanel();
      // Set category from voice
      if(/\bfood\b|\beat\b|\brestaurant\b/.test(c))_activeCategory='food';
      else if(/\bcoffee\b|\bcafe\b/.test(c))_activeCategory='coffee';
      else if(/\bgym\b|\bfitness\b/.test(c))_activeCategory='gym';
      else if(/\bstudy\b|\blibrary\b/.test(c))_activeCategory='study';
      else if(/\bcampus\b|\buniversity\b/.test(c))_activeCategory='campus';
      else if(/\bgas\b|\bfuel\b/.test(c))_activeCategory='gas';
      else if(/\bpharmacy\b|\bdoctor\b|\bhospital\b/.test(c))_activeCategory='pharmacy';
      else _activeCategory='all';
      return'Finding nearby places, sir.';
    }
    if(/\b(find|show|nearest)\b.*\b(coffee|cafe)\b/.test(c)){showPanel();_activeCategory='coffee';return'Looking for coffee nearby, sir.';}
    if(/\b(find|show|nearest)\b.*\b(food|eat|restaurant)\b/.test(c)){showPanel();_activeCategory='food';return'Finding food nearby, sir.';}
    if(/\b(find|show|nearest)\b.*\bgym\b/.test(c)){showPanel();_activeCategory='gym';return'Locating nearby gyms, sir.';}
    return null;
  }

  function init(){}

  return{init,showPanel,hidePanel,togglePanel,handleVoice};
})();
