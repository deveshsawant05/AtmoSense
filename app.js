/* ══════════════════════════════════════════════════════
   AtmoSense — app.js  (fixed)
   Bugs fixed:
   1. Theme toggle: charts exist before applyTheme() is called
   2. Rain chart: added missing root `type:'bar'`
   3. Tooltips: CSS vars replaced with real hex colors
   4. Chart.defaults moved before chart creation
══════════════════════════════════════════════════════ */

$(function () {
  $.ajaxSetup({ cache: false }); // Prevent aggressive browser caching of ThingSpeak API URLs

  /* ══ 1. DATA ══ */
  let tempData  = Array(24).fill(0);
  let humData   = Array(24).fill(0);
  let rainData  = Array(24).fill(0);
  let aqiData = Array(24).fill(0);
  let dayNightData = Array(24).fill(1); // 1 for Day, 0 for Night

  let timeLabels = Array(24).fill('');
  let totalSamples = 0;

  let CUR = { temp: 0, hum: 0, rain: 0, aqi: 0, isNight: 0 };

  /* ══ 2. UTILITIES ══ */
  const avg  = arr => (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1);
  const pad2 = n   => String(n).padStart(2,'0');

  function heatIndex(T,H) {
    return Math.round((-8.78+1.611*T+2.339*H-0.146*T*H-0.01231*T*T-0.01642*H*H+0.00221*T*T*H+0.00073*T*H*H-0.0000036*T*T*H*H)*10)/10;
  }
  function dewPoint(T,H) {
    const g=(17.27*T)/(237.7+T)+Math.log(H/100);
    return Math.round((237.7*g/(17.27-g))*10)/10;
  }
  function conditionFromData(rain,aqi,isNight) {
    if(rain >= 1) {
      // Assuming rain field > 0 means rain
      if(rain > 50) return {label:'Heavy Rain', cls:'pill-rainy', icon:'⛈️'};
      return {label:'Raining', cls:'pill-rainy', icon:'🌧️'};
    }
    // No rain
    if(isNight) return {label:'Clear Night', cls:'pill-night', icon:'🌙'};
    if(aqi > 150) return {label:'Hazy/Smog', cls:'pill-cloudy', icon:'🌫️'};
    return {label:'Clear Day', cls:'pill-sunny', icon:'☀️'};
  }

  /* ══ 3. THEME STATE (declared early, charts read isDark) ══ */
  let isDark = false;

  /* Real colors for Chart.js — it cannot resolve CSS variables */
  function tc() {
    return {
      text:      isDark ? '#7fb2d8'               : '#4a6a8a',
      grid:      isDark ? 'rgba(100,180,220,0.07)' : 'rgba(0,0,0,0.06)',
      ttBg:      isDark ? '#0d1e30'               : '#ffffff',
      ttBorder:  isDark ? 'rgba(100,180,220,0.25)' : 'rgba(0,0,0,0.08)',
      ttTitle:   isDark ? '#7fb2d8'               : '#4a6a8a',
      ttBody:    isDark ? '#e8f4ff'               : '#0d1f35'
    };
  }

  /* ══ 4. CLOCK & UPTIME ══ */
  const startTime = Date.now();
  function tick() {
    const d=new Date();
    $('#ts').text(d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())+' '+pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds()));
    const e=Math.floor((Date.now()-startTime)/1000);
    $('#uptime').text(pad2(Math.floor(e/3600))+':'+pad2(Math.floor((e%3600)/60))+':'+pad2(e%60));
  }
  setInterval(tick,1000); tick();

  /* ══ 5. CARDS ══ */
  function populateCards() {
    $('#val-temp').text(parseFloat(CUR.temp).toFixed(1)); 
    $('#val-hum').text(parseFloat(CUR.hum).toFixed(1));
    $('#val-rain').text(CUR.rain > 0.1 ? "Wet" : "Dry"); 
    $('#val-aqi').text(Math.round(CUR.aqi));
    $('#avg-temp').text(parseFloat(avg(tempData)).toFixed(1)+'°C'); 
    $('#avg-hum').text(parseFloat(avg(humData)).toFixed(1)+'%');
    $('#peak-rain').text(rainData.filter(v => v>0.1).length); // How many times it rained
    $('#avg-aqi').text(Math.round(avg(aqiData)));
    $('#tag-temp').text(CUR.temp>35?'Hot':CUR.temp>30?'Warm':CUR.temp>20?'Comfortable':'Cool');
    $('#tag-hum').text(CUR.hum>80?'Very Humid':CUR.hum>60?'Moderate':'Low');
    $('#tag-rain').text(CUR.rain>0.1 ? 'Raining' : 'Clear');
    $('#tag-aqi').text(CUR.aqi>300?'Hazardous':CUR.aqi>200?'Very Unhealthy':CUR.aqi>150?'Unhealthy':CUR.aqi>100?'Poor':CUR.aqi>50?'Moderate':'Good');
  }
  populateCards();

  /* ══ 6. DERIVED ══ */
  function populateDerived() {
    const hi=heatIndex(CUR.temp,CUR.hum), dp=dewPoint(CUR.temp,CUR.hum);
    const cond=conditionFromData(CUR.rain,CUR.aqi,CUR.isNight);
    $('#heatIdx').text(hi);
    const comfort=hi>40?'Dangerous':hi>37?'Very Hot':hi>32?'Uncomfortable':hi>27?'Warm':'Comfortable';
    const comCls=hi>40?'col-bad':hi>35?'col-warn':'col-good';
    const rainProb=CUR.rain > 0 ? 100 : Math.min(100,Math.round(Math.max(0,CUR.hum-55)*1.2));
    const probCls=rainProb>60?'col-bad':rainProb>30?'col-warn':'col-good';
    const vis=CUR.aqi>200?'Poor':CUR.aqi>100?'Reduced':'Good';
    const visCls=CUR.aqi>150?'col-bad':CUR.aqi>100?'col-warn':'col-good';
    $('#dew').text(dp+'°C').attr('class',dp>24?'col-warn':'col-good');
    $('#comfort').text(comfort).attr('class',comCls);
    $('#rainProb').text(rainProb+'%').attr('class',probCls);
    $('#visibility').text(vis).attr('class',visCls);
    
    // Guess atmospheric pressure (derived realistically based on temp/hum/rain conditions)
    const estPressure = Math.round(1015 - (CUR.rain > 0 ? 12 : 0) - (CUR.temp > 30 ? 4 : 0) + (CUR.temp < 15 ? 5 : 0) - (CUR.hum > 80 ? 3 : 0));
    $('#pressure').text(estPressure + ' hPa').attr('class', estPressure < 1005 ? 'col-warn' : 'col-good');

    $('#cond-icon').text(cond.icon);
    $('#cond-name').text(cond.label);
    
    let desc = '';
    if(CUR.rain > 0) desc = 'Precipitation detected. ';
    if(CUR.isNight) desc += 'Night time condition. ';
    else desc += 'Day time condition. ';
    if(CUR.aqi > 100) desc += 'Poor air quality.';
    $('#cond-desc').text(desc || "Clear weather conditions.");
  }
  populateDerived();

  /* ══ 7. GAUGE ══ */
  function drawGauge() {
    const canvas=document.getElementById('gaugeCanvas'); if(!canvas)return;
    const ctx=canvas.getContext('2d'), W=canvas.width, H=canvas.height;
    const cx=W/2, cy=H-14, R=88;
    const hi=heatIndex(CUR.temp,CUR.hum);
    const pct=Math.min(1,Math.max(0,(hi-20)/30));
    ctx.clearRect(0,0,W,H);
    ctx.beginPath(); ctx.arc(cx,cy,R,Math.PI,0);
    ctx.strokeStyle=isDark?'rgba(100,180,220,0.14)':'rgba(0,0,0,0.09)';
    ctx.lineWidth=14; ctx.lineCap='round'; ctx.stroke();
    if(pct>0){
      const g=ctx.createLinearGradient(cx-R,0,cx+R,0);
      g.addColorStop(0,'#00c8f0'); g.addColorStop(0.45,'#ffb700'); g.addColorStop(1,'#f05060');
      ctx.beginPath(); ctx.arc(cx,cy,R,Math.PI,Math.PI+pct*Math.PI);
      ctx.strokeStyle=g; ctx.lineWidth=14; ctx.lineCap='round'; ctx.stroke();
    }
    ctx.font='9px "Space Mono",monospace'; ctx.fillStyle=isDark?'rgba(127,178,216,0.75)':'rgba(74,106,138,0.8)';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ['20','30','40','50'].forEach((v,i)=>{
      const a=Math.PI+(i/3)*Math.PI;
      ctx.fillText(v, cx+(R+18)*Math.cos(a), cy+(R+18)*Math.sin(a));
    });
  }
  drawGauge();

  /* ══ 8. SPARKLINES ══ */
  function sparkline(id,data,color){
    const canvas=document.getElementById(id); if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const W=canvas.parentElement.offsetWidth||220, H=40;
    canvas.width=W; canvas.height=H;
    const mn=Math.min(...data), range=(Math.max(...data)-mn)||1;
    const pts=data.map((v,i)=>({x:(i/(data.length-1))*W, y:H-((v-mn)/range)*(H-6)-3}));
    const grd=ctx.createLinearGradient(0,0,0,H);
    grd.addColorStop(0,color+'44'); grd.addColorStop(1,color+'00');
    ctx.beginPath(); ctx.moveTo(pts[0].x,H);
    pts.forEach(p=>ctx.lineTo(p.x,p.y));
    ctx.lineTo(pts.at(-1).x,H); ctx.closePath();
    ctx.fillStyle=grd; ctx.fill();
    ctx.beginPath();
    pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
    ctx.strokeStyle=color; ctx.lineWidth=1.8; ctx.lineJoin='round'; ctx.stroke();
  }
  function updateSparklines(){
    sparkline('spark-temp', tempData.slice(-12), '#ea580c');
    sparkline('spark-hum',  humData.slice(-12),  '#0088c7');
    sparkline('spark-rain', rainData.slice(-12), '#3b76d4');
    sparkline('spark-aqi',  aqiData.slice(-12),  '#d97706');
  }
  setTimeout(updateSparklines,150);

  /* ══ 9. CHART.JS — defaults BEFORE chart creation ══ */
  Chart.defaults.font.family="'Space Mono',monospace";
  Chart.defaults.font.size=10;
  Chart.defaults.animation={duration:600};

  function ttPlugin(extraCallbacks){
    const c=tc();
    return {
      backgroundColor:c.ttBg, borderColor:c.ttBorder, borderWidth:1,
      titleColor:c.ttTitle, bodyColor:c.ttBody,
      titleFont:{family:"'Space Mono',monospace",size:10},
      bodyFont:{family:"'DM Sans',sans-serif",size:12},
      padding:12, cornerRadius:10,
      callbacks: extraCallbacks||{}
    };
  }

  function makeGrad(ctx,r,g,b,a0,a1){
    const gd=ctx.createLinearGradient(0,0,0,300);
    gd.addColorStop(0,'rgba('+r+','+g+','+b+','+a0+')');
    gd.addColorStop(1,'rgba('+r+','+g+','+b+','+a1+')');
    return gd;
  }

  /* ── MAIN CHART: Temperature + Humidity ── */
  const mainCtx=document.getElementById('mainChart').getContext('2d');

  let mainChart=new Chart(mainCtx,{
    type:'line',
    data:{
      labels:timeLabels,
      datasets:[
        { label:'Temperature °C', data:tempData,
          borderColor:'#ea580c', backgroundColor:makeGrad(mainCtx,234,88,12,0.22,0),
          borderWidth:2, pointRadius:0, pointHoverRadius:5, tension:0.4, fill:true, yAxisID:'y' },
        { label:'Humidity %', data:humData,
          borderColor:'#0088c7', backgroundColor:makeGrad(mainCtx,0,136,199,0.18,0),
          borderWidth:2, pointRadius:0, pointHoverRadius:5, tension:0.4, fill:true, yAxisID:'y1' }
      ]
    },
    options: buildMainOpts()
  });

  function buildMainOpts(){
    const c=tc();
    const ticks={color:c.text,font:{family:"'Space Mono',monospace",size:9}};
    return {
      responsive:true, maintainAspectRatio:true,
      interaction:{mode:'index',intersect:false},
      plugins:{ legend:{display:false}, tooltip:ttPlugin() },
      scales:{
        x:{ border:{display:false}, grid:{color:c.grid}, ticks:{...ticks,maxTicksLimit:8} },
        y:{ position:'left', suggestedMin:15, suggestedMax:40, border:{display:false}, grid:{color:c.grid},
            ticks:{...ticks, callback:v=>v+'°'} },
        y1:{ position:'right', suggestedMin:30, suggestedMax:100, border:{display:false}, grid:{display:false},
             ticks:{...ticks, callback:v=>v+'%'} }
      }
    };
  }

  /* ── RAIN CHART ── */
  const rainCtx=document.getElementById('rainChart').getContext('2d');

  let rainChart=new Chart(rainCtx,{
    type:'bar',
    data:{
      labels:timeLabels,
      datasets:[
        { 
          label:'Rain (Events)', data:rainData,
          backgroundColor:'rgba(59,118,212,0.45)', borderColor:'#3b76d4',
          borderWidth:1, borderRadius:3, yAxisID:'y' }
      ]
    },
    options: buildRainOpts()
  });

  function buildRainOpts(){
    const c=tc();
    const ticks={color:c.text,font:{family:"'Space Mono',monospace",size:9}};
    return {
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{ display:false },
        tooltip: ttPlugin({ label:ctx=>'Rain Events: '+ctx.raw })
      },
      scales:{
        x:{ border:{display:false}, grid:{color:c.grid}, ticks:{...ticks,maxTicksLimit:8} },
        y:{ position:'left', min:0, suggestedMax:5, border:{display:false}, grid:{color:c.grid},
            ticks:{...ticks, stepSize:1} }
      }
    };
  }

  /* ── AQI CHART ── */
  const aqiCtx=document.getElementById('aqiChart').getContext('2d');

  let aqiChart=new Chart(aqiCtx,{
    type:'line',
    data:{
      labels:timeLabels,
      datasets:[
        { 
          label:'AQI', data:aqiData,
          borderColor:'#d97706', backgroundColor:'rgba(217,119,6,0.1)',
          borderWidth:2, pointRadius:0, tension:0.4, fill:true, yAxisID:'y' }
      ]
    },
    options: buildAqiOpts()
  });

  function buildAqiOpts(){
    const c=tc();
    const ticks={color:c.text,font:{family:"'Space Mono',monospace",size:9}};
    return {
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{ display:false },
        tooltip: ttPlugin({ label:ctx=>'AQI: '+ctx.raw })
      },
      scales:{
        x:{ border:{display:false}, grid:{color:c.grid}, ticks:{...ticks,maxTicksLimit:8} },
        y:{ position:'left', min:0, suggestedMax:200, border:{display:false}, grid:{color:c.grid},
            ticks:{...ticks} }
      }
    };
  }

  /* ══ 10. REFRESH CHARTS ON THEME CHANGE (safe — charts already exist) ══ */
  function refreshChartTheme(){
    mainChart.options=buildMainOpts(); mainChart.update('none');
    
    rainChart.options=buildRainOpts();
    rainChart.data.datasets[0].backgroundColor=isDark?'rgba(96,144,240,0.55)':'rgba(59,118,212,0.45)';
    rainChart.data.datasets[0].borderColor     =isDark?'#6090f0':'#3b76d4';
    rainChart.update('none');

    aqiChart.options=buildAqiOpts();
    aqiChart.update('none');
    
    drawGauge();
  }

  /* ══ 11. THEME TOGGLE (wired AFTER charts exist) ══ */
    function applyTheme(dark){
    isDark = dark;

    localStorage.setItem('theme', dark ? 'dark' : 'light');

    $('html').attr('data-theme', dark ? 'dark' : 'light');

    $('#themeIcon').text(dark ? '🌙' : '☀️');
    $('#themeLabel').text(dark ? 'Dark' : 'Light');

    refreshChartTheme();
    }

    // LOAD saved theme OR default to light
    const savedTheme = localStorage.getItem('theme');
    applyTheme(savedTheme === 'dark');
  $('#themeToggle').on('click',()=>applyTheme(!isDark));

  /* ══ 12. DATA LOG TABLE ══ */
  function buildLog(){
    const rows=[];
    for(let i=tempData.length-1;i>=Math.max(0, tempData.length-12);i--){
      if(!timeLabels[i]) continue;
      const cond=conditionFromData(rainData[i],aqiData[i],dayNightData[i]===0);
      const hi=heatIndex(tempData[i],humData[i]);
      const col=hi>38?'color:var(--red)':hi>34?'color:var(--amber)':'';
      rows.push(`<tr>
        <td>${timeLabels[i]}</td>
        <td>${parseFloat(tempData[i]).toFixed(1)}</td>
        <td>${parseFloat(humData[i]).toFixed(1)}</td>
        <td>${rainData[i] > 0.1 ? 'Detected' : 'None'}</td>
        <td>${Math.round(aqiData[i])}</td>
        <td><span class="pill ${cond.cls}">${cond.icon} ${cond.label}</span></td>
        <td style="${col}">${parseFloat(hi).toFixed(1)}°C</td>
      </tr>`);
    }
    $('#logBody').html(rows.join(''));
  }
  buildLog();

  /* ══ 13. DATA FETCHING (ThingSpeak API) ══ */
  function getChannelId() {
    return typeof CONFIG !== 'undefined' ? CONFIG.THINGSPEAK_CHANNEL_ID : 'YOUR_CHANNEL_ID';
  }
  function getApiKey() {
    return typeof CONFIG !== 'undefined' ? CONFIG.THINGSPEAK_READ_API_KEY : '';
  }
  
  function fetchThingSpeakData(scale) {
    const CHANNEL_ID = getChannelId();
    const API_KEY = getApiKey();
    let url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?`;
    let lastUrl = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds/last.json`;
    
    if (API_KEY) {
      url += `api_key=${API_KEY}&`;
      lastUrl += `?api_key=${API_KEY}`;
    }
    
    $('#main-chart-sub').text(scale === 'monthly' ? 'Past Month' : scale === 'daily' ? 'Past 30 Days' : 'Past 24 Hours');
    $('#chart-sub-label').text(scale === 'monthly' ? 'Monthly Profile' : scale === 'daily' ? 'Daily Profile' : 'Hourly Profile');
    
    // Local groupings instead of ThingSpeak backend averages
    if (scale === 'hourly') {
      url += 'days=2'; // Fetch robust raw points
    } 
    else if (scale === 'daily') {
      url += 'days=30'; 
    } 
    else if (scale === 'monthly') {
      url += 'results=8000'; // Bring in max allowed points for long timeline
    }

    if (getChannelId() === 'YOUR_CHANNEL_ID') {
      // Provide mock fallback if channel ID isn't set
      console.warn("Please set your ThingSpeak Channel ID!");
      generateMockData(scale);
      return;
    }

    $.getJSON(url, function(data) {
      if (!data.feeds || data.feeds.length === 0) return;
      $('#samples-total').text(data.channel.last_entry_id || '—');
      
      const groupedMap = {};
      
      data.feeds.forEach(f => {
          const date = new Date(f.created_at);
          let gKey;
          
          if (scale === 'hourly') {
              gKey = date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + ' ' + pad2(date.getHours()) + ':00';
          } else if (scale === 'daily') {
              gKey = date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
          } else {
              gKey = date.getFullYear() + '-' + pad2(date.getMonth() + 1);
          }
          
          if(!groupedMap[gKey]) groupedMap[gKey] = { temp:0, hum:0, rain:0, aqi:0, count:0, dayNight:0, date: date };
          groupedMap[gKey].temp += parseFloat(f.field1 || 0);
          groupedMap[gKey].hum += parseFloat(f.field2 || 0);
          groupedMap[gKey].aqi += parseFloat(f.field3 || 0);
          groupedMap[gKey].rain += parseFloat(f.field4 || 0) > 0 ? 1 : 0;
          groupedMap[gKey].dayNight += parseFloat(f.field5 || 0);
          groupedMap[gKey].count++;
      });
      
      let processedFeeds = Object.keys(groupedMap).map(k => {
          let m = groupedMap[k];
          return {
             created_at: m.date,
             field1: (m.temp / m.count).toFixed(1),
             field2: (m.hum / m.count).toFixed(1),
             field3: (m.aqi / m.count).toFixed(1),
             field4: m.rain, // sum of rain events
             field5: (m.dayNight / m.count) > 0.5 ? 1 : 0
          };
      });
      
      if (scale === 'hourly') processedFeeds = processedFeeds.slice(-24);
      else if (scale === 'daily') processedFeeds = processedFeeds.slice(-30);
      else if (scale === 'monthly') processedFeeds = processedFeeds.slice(-12);

      // Empty arrays to ensure zero accumulation
      tempData.length = 0; humData.length = 0; 
      aqiData.length = 0; rainData.length = 0; 
      timeLabels.length = 0; dayNightData.length = 0;

      processedFeeds.forEach(feed => {
        let date = new Date(feed.created_at);
        if (scale === 'hourly') timeLabels.push(pad2(date.getHours()) + ':00');
        else if (scale === 'daily') timeLabels.push(date.getDate() + '/' + (date.getMonth()+1));
        else timeLabels.push(date.toLocaleString('default', { month: 'short' }));
        
        tempData.push(parseFloat(feed.field1 || 0));
        humData.push(parseFloat(feed.field2 || 0));
        aqiData.push(parseFloat(feed.field3 || 0));
        rainData.push(parseFloat(feed.field4 || 0));
        dayNightData.push(parseFloat(feed.field5 || 0));
      });

      // Try fetching the absolute latest raw point for the live cards first
      $.getJSON(lastUrl, function(latest) {
          if (latest && latest.created_at) {
              CUR.temp = parseFloat(latest.field1 || 0).toFixed(1);
              CUR.hum = parseFloat(latest.field2 || 0).toFixed(1);
              CUR.aqi = Math.round(parseFloat(latest.field3 || 0));
              CUR.rain = parseFloat(latest.field4 || 0);
              CUR.isNight = parseFloat(latest.field5 || 1) === 0;
          } else {
              setCurFromHistory();
          }
          updateUI();
      }).fail(function() {
          setCurFromHistory();
          updateUI();
      });

    }).fail(function() {
      console.warn("Failed to fetch from ThingSpeak - Falling back to local mock rendering for timeline");
      generateMockData(scale);
    });
  }

  function setCurFromHistory() {
      if(tempData.length > 0) {
          CUR.temp = parseFloat(tempData.at(-1)).toFixed(1);
          CUR.hum = parseFloat(humData.at(-1)).toFixed(1);
          CUR.aqi = Math.round(aqiData.at(-1));
          CUR.rain = rainData.at(-1);
          CUR.isNight = dayNightData.at(-1) === 0;
      }
  }

  function generateMockData(scale) {
      let count = scale === 'hourly' ? 24 : scale === 'daily' ? 30 : 12;
      tempData.length = 0; humData.length = 0; aqiData.length = 0; rainData.length = 0; timeLabels.length = 0; dayNightData.length = 0;
      let now = new Date();
      
      let temp = 20;
      let hum = 60;
      let rainCycles = 0;
      
      for(let i=0; i<count; i++) {
         let d;
         if(scale === 'hourly') {
             d = new Date(now - (count - i - 1) * 3600 * 1000);
             timeLabels.push(pad2(d.getHours()) + ':00');
         } else if (scale === 'daily') {
             d = new Date(now - (count - i - 1) * 86400 * 1000);
             timeLabels.push(d.getDate() + '/' + (d.getMonth()+1));
         } else {
             d = new Date(now.getFullYear(), now.getMonth() - (count - i - 1), 1);
             timeLabels.push(d.toLocaleString('default', { month: 'short' }));
         }
         
         const hour = d.getHours();
         const isDay = (hour >= 6 && hour < 18);
         let hourShifted = (hour - 4 + 24) % 24; 
         let diurnalBase = -Math.cos(hourShifted * Math.PI / 12); 
         let targetTemp = 27 + (13 * diurnalBase); 

         let isRaining = false;
         if (rainCycles > 0) {
             targetTemp -= 6;
             rainCycles--;
             isRaining = true;
         } else if (Math.random() < 0.1) {
             rainCycles = Math.floor(Math.random() * 2) + 1;
             isRaining = true;
         }
         
         temp += (targetTemp - temp) * 0.4 + (Math.random() * 2 - 1);
         if (temp > 40) temp = 40; if (temp < 15) temp = 15;

         let targetHum = 100 - ((temp - 15) / 25) * 50; 
         if (isRaining) targetHum = 95;
         hum += (targetHum - hum) * 0.4 + (Math.random() * 4 - 2);
         if (hum > 100) hum = 100; if (hum < 30) hum = 30;

         let targetAqi = isDay ? 120 : 60;
         if (isRaining) targetAqi = 40; 
         let aqi = Math.floor(targetAqi + (Math.random() * 30 - 15));

         tempData.push(parseFloat(temp.toFixed(1)));
         humData.push(parseFloat(hum.toFixed(1)));
         aqiData.push(Math.max(10, Math.round(aqi)));
         rainData.push(isRaining ? 1 : 0);
         dayNightData.push(isDay ? 1 : 0);
      }
      
      // Update top live cards with the absolute latest point
      if(tempData.length > 0) {
          CUR.temp = parseFloat(tempData.at(-1)).toFixed(1);
          CUR.hum = parseFloat(humData.at(-1)).toFixed(1);
          CUR.aqi = Math.round(aqiData.at(-1));
          CUR.rain = rainData.at(-1);
          CUR.isNight = dayNightData.at(-1) === 0;
      }
      updateUI();
  }

  function updateUI() {
      populateCards();
      populateDerived();
      drawGauge();
      updateSparklines();
      buildLog();
      
      // Explicitly re-attach arrays in case Chart.js severed the reference
      mainChart.data.labels = timeLabels;
      mainChart.data.datasets[0].data = tempData;
      mainChart.data.datasets[1].data = humData;
      mainChart.update();
      
      rainChart.data.labels = timeLabels;
      rainChart.data.datasets[0].data = rainData;
      rainChart.update();

      aqiChart.data.labels = timeLabels;
      aqiChart.data.datasets[0].data = aqiData;
      aqiChart.update();
  }

  // Use localStorage to remember user's last preferred scale
  const savedScale = localStorage.getItem('preferredTimeScale') || 'hourly';
  $('#timeScale').val(savedScale);

  $('#timeScale').on('change', function() {
      const scale = $(this).val();
      localStorage.setItem('preferredTimeScale', scale); // Cache choice
      
      // Reset chart visuals quickly
      mainChart.data.labels.length = 0;
      mainChart.data.datasets.forEach(ds => ds.data.length = 0);
      mainChart.update();
      
      rainChart.data.labels.length = 0;
      rainChart.data.datasets.forEach(ds => ds.data.length = 0);
      rainChart.update();

      aqiChart.data.labels.length = 0;
      aqiChart.data.datasets.forEach(ds => ds.data.length = 0);
      aqiChart.update();
      
      fetchThingSpeakData(scale);
  });

  // Load environment variables before fetching
  if (typeof loadConfig === 'function') {
      loadConfig().then(() => {
          fetchThingSpeakData(savedScale);
      });
  } else {
      fetchThingSpeakData(savedScale);
  }
  
  // Auto-refresh every 5 mins
  setInterval(() => fetchThingSpeakData($('#timeScale').val()), 300000);

});