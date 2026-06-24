// ═══════════════════════════════════════════════════════════
// ══  HUD INFO PANEL MODULE  ════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Movable, resizable, closeable ambient widget
// Shows: clock, date, weather (Fahrenheit), vault stats,
//        tasks due today, active reminder count
// Weather: Open-Meteo API (free, no key needed)
// Default position: top-left
// ═══════════════════════════════════════════════════════════
var HUDINFO=(function(){

  var LS_KEY='baker_hudinfo';
  var WEATHER_CACHE_KEY='baker_weather_cache';

  // Oscoda, MI coords
  var DEFAULT_LAT=44.4186;
  var DEFAULT_LON=-83.3549;

  var _timer=null;
  var _weatherTimer=null;
  var _state={
    lat:DEFAULT_LAT,
    lon:DEFAULT_LON,
    city:'Oscoda, MI',
    weather:null,
    weatherAge:0
  };

  // ── Weather codes → description + emoji ──────────────────
  var WX={
    0:['Clear','☀️'],1:['Mostly Clear','🌤️'],2:['Partly Cloudy','⛅'],3:['Overcast','☁️'],
    45:['Foggy','🌫️'],48:['Icy Fog','🌫️'],
    51:['Light Drizzle','🌦️'],53:['Drizzle','🌦️'],55:['Heavy Drizzle','🌧️'],
    61:['Light Rain','🌧️'],63:['Rain','🌧️'],65:['Heavy Rain','🌧️'],
    71:['Light Snow','🌨️'],73:['Snow','❄️'],75:['Heavy Snow','❄️'],77:['Snow Grains','❄️'],
    80:['Showers','🌦️'],81:['Heavy Showers','🌧️'],82:['Violent Showers','⛈️'],
    85:['Snow Showers','🌨️'],86:['Heavy Snow Showers','❄️'],
    95:['Thunderstorm','⛈️'],96:['Thunderstorm+Hail','⛈️'],99:['Severe Storm','⛈️']
  };

  // ── Fetch weather (Open-Meteo, free, no key) ──────────────
  async function _fetchWeather(){
    try{
      var url='https://api.open-meteo.com/v1/forecast?latitude='+_state.lat+'&longitude='+_state.lon+
        '&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relativehumidity_2m'+
        '&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America%2FDetroit';
      var resp=await fetch(url);
      var d=await resp.json();
      var cur=d.current;
      _state.weather={
        temp:Math.round(cur.temperature_2m),
        feels:Math.round(cur.apparent_temperature),
        code:cur.weathercode,
        wind:Math.round(cur.windspeed_10m),
        humidity:cur.relativehumidity_2m,
        updated:Date.now()
      };
      // Cache it
      try{localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify(_state.weather));}catch(e){}
      _render();
    }catch(e){
      // Use cached if available
      try{var c=localStorage.getItem(WEATHER_CACHE_KEY);if(c)_state.weather=JSON.parse(c);}catch(e2){}
    }
  }

  // ── Render ────────────────────────────────────────────────
  function _render(){
    var panel=document.getElementById('hudinfo-panel');
    if(!panel||!panel.classList.contains('hi-vis'))return;

    var now=new Date();
    var h=now.getHours(),m=now.getMinutes(),s=now.getSeconds();
    var ampm=h>=12?'PM':'AM';
    var h12=h%12||12;
    var timeStr=h12+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+' '+ampm;
    var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    var dateStr=days[now.getDay()]+', '+months[now.getMonth()]+' '+now.getDate()+', '+now.getFullYear();

    // Weather
    var wx=_state.weather;
    var wxInfo=wx?WX[wx.code]||['Unknown','🌡️']:null;
    var wxHtml=wxInfo?
      '<div class="hi-row">'+
        '<span class="hi-label">WEATHER</span>'+
        '<span class="hi-val">'+wxInfo[0]+' '+wxInfo[1]+'</span>'+
      '</div>'+
      '<div class="hi-row">'+
        '<span class="hi-label">TEMP</span>'+
        '<span class="hi-val">'+wx.temp+'°F <span class="hi-sub">(feels '+wx.feels+'°)</span></span>'+
      '</div>'+
      '<div class="hi-row">'+
        '<span class="hi-label">WIND</span>'+
        '<span class="hi-val">'+wx.wind+' mph</span>'+
      '</div>'+
      '<div class="hi-row">'+
        '<span class="hi-label">HUMIDITY</span>'+
        '<span class="hi-val">'+wx.humidity+'%</span>'+
      '</div>'
      :'<div class="hi-row"><span class="hi-label">WEATHER</span><span class="hi-val hi-sub">Loading...</span></div>';

    // Vault stats
    var vaultHtml='';
    if(typeof vaultIndex!=='undefined'&&vaultIndex.length){
      var today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
      var tasksDue=0;
      if(typeof CAL!=='undefined'&&CAL.getTasks){
        tasksDue=CAL.getTasks().filter(function(t){return!t.done&&t.due&&t.due<=today;}).length;
      }
      var remCount=0;
      if(typeof REMINDERS!=='undefined')remCount=REMINDERS.getDueCount();
      vaultHtml=
        '<div class="hi-divider"></div>'+
        '<div class="hi-row">'+
          '<span class="hi-label">VAULT</span>'+
          '<span class="hi-val">'+vaultIndex.length+' notes</span>'+
        '</div>'+
        (tasksDue>0?'<div class="hi-row"><span class="hi-label">DUE TODAY</span><span class="hi-val hi-alert">'+tasksDue+' task'+(tasksDue>1?'s':'')+'</span></div>':'')+
        (remCount>0?'<div class="hi-row"><span class="hi-label">REMINDERS</span><span class="hi-val hi-alert">'+remCount+' pending</span></div>':'');
    }

    // Strength today
    var strengthHtml='';
    if(typeof STRENGTH!=='undefined'){
      var todayDay=now.getDay();
      var split=typeof data!=='undefined'?null:null; // STRENGTH manages its own data
      // Just show a workout indicator if strength data exists
    }

    var body=document.getElementById('hudinfo-body');
    if(!body)return;
    body.innerHTML=
      '<div class="hi-time">'+timeStr+'</div>'+
      '<div class="hi-date">'+dateStr+'</div>'+
      '<div class="hi-location">'+_state.city+'</div>'+
      '<div class="hi-divider"></div>'+
      wxHtml+
      vaultHtml;
  }

  // ── Panel show/hide ───────────────────────────────────────
  function showPanel(){
    var p=document.getElementById('hudinfo-panel');
    if(!p)return;
    p.classList.add('hi-vis');
    if(p._wbNormalise)p._wbNormalise();
    _startLoop();
    _fetchWeather();
    _render();
  }
  function hidePanel(){
    var p=document.getElementById('hudinfo-panel');
    if(p)p.classList.remove('hi-vis');
    _stopLoop();
  }
  function togglePanel(){
    var p=document.getElementById('hudinfo-panel');
    if(!p)return;
    if(p.classList.contains('hi-vis'))hidePanel();
    else showPanel();
  }

  function _startLoop(){
    if(_timer)return;
    _timer=setInterval(_render,1000);
    // Weather refresh every 10 minutes
    _weatherTimer=setInterval(_fetchWeather,10*60*1000);
  }
  function _stopLoop(){
    if(_timer){clearInterval(_timer);_timer=null;}
    if(_weatherTimer){clearInterval(_weatherTimer);_weatherTimer=null;}
  }

  function handleVoice(cmd){
    var c=cmd.toLowerCase();
    if(/\b(hud|info|status|weather|clock)\b.*\b(panel|widget|overlay)\b|\b(open|show|pull up)\b.*\b(hud info|status panel|weather|clock)\b/.test(c)){
      showPanel();return"HUD info panel open, sir.";
    }
    if(/\bwhat('?s| is) the (weather|temp|temperature)\b/.test(c)){
      var wx=_state.weather;
      if(!wx)return"Weather data loading, sir.";
      var wxInfo=WX[wx.code]||['Unknown',''];
      return wxInfo[0]+', '+wx.temp+' degrees Fahrenheit, feels like '+wx.feels+'. Wind '+wx.wind+' miles per hour, sir.';
    }
    if(/\bwhat (time|day|date) is it\b/.test(c)){
      var n=new Date();
      var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return 'It is '+days[n.getDay()]+', '+n.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+', sir.';
    }
    return null;
  }

  function init(){
    // Try to load cached weather immediately
    try{var c=localStorage.getItem(WEATHER_CACHE_KEY);if(c)_state.weather=JSON.parse(c);}catch(e){}
    // Auto-show on load? No — user opens it
    // But try to get weather in background
    setTimeout(_fetchWeather,2000);
  }

  return{init,showPanel,hidePanel,togglePanel,handleVoice,refresh:_render};
})();
