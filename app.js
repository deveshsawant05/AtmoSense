/* ══════════════════════════════════════════════════════
   AtmoSense — app.js  (fixed)
   Bugs fixed:
   1. Theme toggle: charts exist before applyTheme() is called
   2. Rain chart: added missing root `type:'bar'`
   3. Tooltips: CSS vars replaced with real hex colors
   4. Chart.defaults moved before chart creation
══════════════════════════════════════════════════════ */

$(function () {

  /* ══ 1. DATA ══ */
  const tempData  = [26,25,24,24,23,23,24,26,28,30,32,34,35,36,36,35,34,33,32,31,30,29,28,27];
  const humData   = [78,80,82,83,85,84,82,78,74,70,66,63,60,58,57,58,60,62,65,67,69,71,73,76];
  const rainData  = [5, 4, 3, 3, 2, 2, 2, 1, 1, 2, 3, 8,12, 8, 5, 4, 3, 5,20,48,30,15, 8, 6];
  const lightData = [0,  0,  0,  0,  0,  5,60,200,420,620,750,820,860,880,850,800,700,560,380,180,80,30,10, 0];

  const now = new Date();
  const hourLabels = Array.from({length: 24}, (_, i) => {
    const d = new Date(now - (23 - i) * 3600 * 1000);
    return String(d.getHours()).padStart(2,'0') + ':00';
  });

  const CUR = { temp: tempData.at(-1), hum: humData.at(-1), rain: rainData.at(-1), light: lightData.at(-1) };

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
  function conditionFromData(rain,light) {
    if(rain>40)   return {label:'Thunderstorm', cls:'pill-rainy',  icon:'⛈️'};
    if(rain>20)   return {label:'Rainy',         cls:'pill-rainy',  icon:'🌧️'};
    if(rain>5)    return {label:'Drizzle',        cls:'pill-rainy',  icon:'🌦️'};
    if(light>700) return {label:'Sunny',          cls:'pill-sunny',  icon:'☀️'};
    if(light>200) return {label:'Partly Cloudy',  cls:'pill-cloudy', icon:'⛅'};
    if(light>20)  return {label:'Overcast',       cls:'pill-cloudy', icon:'☁️'};
    return              {label:'Night',           cls:'pill-night',  icon:'🌙'};
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
    $('#val-temp').text(CUR.temp); $('#val-hum').text(CUR.hum);
    $('#val-rain').text(CUR.rain); $('#val-light').text(CUR.light);
    $('#avg-temp').text(avg(tempData)+'°C'); $('#avg-hum').text(avg(humData)+'%');
    $('#peak-rain').text(Math.max(...rainData)+'%');
    $('#avg-light').text(Math.round(avg(lightData))+' lx');
    $('#tag-temp').text(CUR.temp>35?'Hot':CUR.temp>30?'Warm':CUR.temp>20?'Comfortable':'Cool');
    $('#tag-hum').text(CUR.hum>80?'Very Humid':CUR.hum>60?'Moderate':'Low');
    $('#tag-rain').text(CUR.rain>50?'Heavy Rain':CUR.rain>20?'Drizzle':CUR.rain>5?'Light':'Dry');
    $('#tag-light').text(CUR.light>700?'Bright':CUR.light>200?'Moderate':CUR.light>20?'Dim':'Dark');
  }
  populateCards();

  /* ══ 6. DERIVED ══ */
  function populateDerived() {
    const hi=heatIndex(CUR.temp,CUR.hum), dp=dewPoint(CUR.temp,CUR.hum);
    const cond=conditionFromData(CUR.rain,CUR.light);
    $('#heatIdx').text(hi);
    const comfort=hi>40?'Dangerous':hi>37?'Very Hot':hi>32?'Uncomfortable':hi>27?'Warm':'Comfortable';
    const comCls=hi>40?'col-bad':hi>35?'col-warn':'col-good';
    const rainProb=Math.min(100,Math.round(CUR.rain*1.5+Math.max(0,CUR.hum-55)*0.4));
    const probCls=rainProb>60?'col-bad':rainProb>30?'col-warn':'col-good';
    const vis=CUR.rain>30?'< 1 km':CUR.rain>10?'2–5 km':'> 10 km';
    const visCls=CUR.rain>30?'col-bad':CUR.rain>10?'col-warn':'col-good';
    $('#dew').text(dp+'°C').attr('class',dp>24?'col-warn':'col-good');
    $('#comfort').text(comfort).attr('class',comCls);
    $('#rainProb').text(rainProb+'%').attr('class',probCls);
    $('#visibility').text(vis).attr('class',visCls);
    $('#cond-icon').text(cond.icon);
    $('#cond-name').text(CUR.rain>40?'Thunderstorm':CUR.rain>20?'Rainy':CUR.rain>5?'Light Drizzle':CUR.light>700?'Clear & Sunny':CUR.light>200?'Partly Cloudy':'Night / Overcast');
    $('#cond-desc').text(CUR.rain>40?'Heavy precipitation active. Seek shelter.':CUR.rain>20?'Moderate rainfall detected by sensor.':CUR.rain>5?'Intermittent light rain possible.':CUR.light>700?'Low rain probability. High LDR reading.':CUR.light>200?'Mixed cloud cover, partial sunlight.':'Low ambient light detected by LDR.');
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
  setTimeout(()=>{
    sparkline('spark-temp', tempData.slice(-12), '#ea580c');
    sparkline('spark-hum',  humData.slice(-12),  '#0088c7');
    sparkline('spark-rain', rainData.slice(-12), '#3b76d4');
    sparkline('spark-light',lightData.slice(-12),'#d97706');
  },150);

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
      labels:hourLabels,
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
        y:{ position:'left', min:18, max:42, border:{display:false}, grid:{color:c.grid},
            ticks:{...ticks, callback:v=>v+'°'} },
        y1:{ position:'right', min:40, max:100, border:{display:false}, grid:{display:false},
             ticks:{...ticks, callback:v=>v+'%'} }
      }
    };
  }

  /* ── RAIN + LIGHT CHART  (FIX: root type:'bar' was missing) ── */
  const rainCtx=document.getElementById('rainChart').getContext('2d');

  let rainChart=new Chart(rainCtx,{
    type:'bar',           /* ← THE FIX: mixed charts need a root type */
    data:{
      labels:hourLabels,
      datasets:[
        { /* inherits root type 'bar' */
          label:'Rain %', data:rainData,
          backgroundColor:'rgba(59,118,212,0.45)', borderColor:'#3b76d4',
          borderWidth:1, borderRadius:3, yAxisID:'y' },
        { type:'line',    /* overrides root type */
          label:'Light (×10 lx)', data:lightData.map(v=>+(v/10).toFixed(1)),
          borderColor:'#d97706', backgroundColor:'transparent',
          borderWidth:2, pointRadius:0, tension:0.4, yAxisID:'y1' }
      ]
    },
    options: buildRainOpts()
  });

  function buildRainOpts(){
    const c=tc();
    const ticks={color:c.text,font:{family:"'Space Mono',monospace",size:9}};
    return {
      responsive:true, maintainAspectRatio:true,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{ position:'bottom', labels:{color:c.text,usePointStyle:true,pointStyleWidth:8,padding:14,font:{family:"'Space Mono',monospace",size:9}} },
        tooltip: ttPlugin({ label:ctx=>ctx.dataset.label==='Light (×10 lx)'?'Light: '+(ctx.raw*10).toFixed(0)+' lx':'Rain: '+ctx.raw+'%' })
      },
      scales:{
        x:{ border:{display:false}, grid:{color:c.grid}, ticks:{...ticks,maxTicksLimit:8} },
        y:{ position:'left', min:0, max:100, border:{display:false}, grid:{color:c.grid},
            ticks:{...ticks, callback:v=>v+'%'} },
        y1:{ position:'right', min:0, max:90, border:{display:false}, grid:{display:false},
             ticks:{...ticks, callback:v=>(v*10)+'lx'} }
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

  /* ══ 12. HOURLY LOG TABLE ══ */
  function buildLog(){
    const rows=[];
    for(let i=tempData.length-1;i>=tempData.length-12;i--){
      const cond=conditionFromData(rainData[i],lightData[i]);
      const hi=heatIndex(tempData[i],humData[i]);
      const col=hi>38?'color:var(--red)':hi>34?'color:var(--amber)':'';
      rows.push('<tr><td>'+hourLabels[i]+'</td><td>'+tempData[i]+'</td><td>'+humData[i]+'</td><td>'+rainData[i]+'</td><td>'+lightData[i]+'</td><td><span class="pill '+cond.cls+'">'+cond.icon+' '+cond.label+'</span></td><td style="'+col+'">'+hi+'°C</td></tr>');
    }
    $('#logBody').html(rows.join(''));
  }
  buildLog();

  /* ══ 13. LIVE JITTER (replace with $.getJSON to ThingSpeak) ══ */
  function jitter(base,delta){ return +(base+(Math.random()*2-1)*delta).toFixed(1); }
  setInterval(()=>{
    CUR.temp =jitter(tempData.at(-1),0.4);
    CUR.hum  =Math.min(100,Math.max(0,Math.round(jitter(humData.at(-1),1.2))));
    CUR.rain =Math.max(0,Math.round(jitter(rainData.at(-1),1)));
    CUR.light=Math.max(0,Math.round(jitter(lightData.at(-1),18)));
    $('#val-temp').text(CUR.temp); $('#val-hum').text(CUR.hum);
    $('#val-rain').text(CUR.rain); $('#val-light').text(CUR.light);
    populateDerived(); drawGauge();
  },5000);

});