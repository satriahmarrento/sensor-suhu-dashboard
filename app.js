const SUPA_URL='https://sjvrugtlhvyvqkebjmka.supabase.co';
const SUPA_KEY='sb_publishable_6iKYw5qRwfEsF7g2XUZDEQ_et9RV8LS';
const db=window.supabase.createClient(SUPA_URL,SUPA_KEY);

let allData=[], mainChart=null, corrChart=null, currentField='suhu';
let aOrg=0, aAC=24, aKon='AC Menyala', aCat='-', pMode=true;

// --- UTILS ---
const el = (id) => document.getElementById(id);
const fmtDate = d => new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
const fmtTime = d => { const t=new Date(d); return isNaN(t)?'-':t.toLocaleTimeString('id-ID',{hour12:false}); };
function toast(m,t='info'){ const e=el('toast'); e.textContent=m; e.className='toast show toast-'+t; setTimeout(()=>e.className='toast',3000); }
function msg(id,t,c){ const m=el(id); m.innerHTML=t; m.className='mg sh '+c; setTimeout(()=>m.className='mg',3000); }

// --- ANIMATION ENGINE ---
const countVals = new Map();
function animateValue(id, end, duration=1000, isFloat=false) {
    const obj = el(id); if(!obj) return;
    const start = countVals.get(id) || 0;
    if(start === end) return;
    countVals.set(id, end);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out
        const current = start + (end - start) * ease;
        obj.innerHTML = isFloat ? current.toFixed(1) : Math.floor(current);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

// --- 3D PHYSICS & AMBIENT OP ---
document.addEventListener('mousemove', (e) => {
    if (window.innerWidth <= 900) return; // Disable expensive 3D physics on mobile!
    
    const w = window.innerWidth, h = window.innerHeight;
    const glow = el('ambient-glow');
    // Move ambient glow slowly towards mouse
    if(glow) glow.style.transform = `translate(calc(-50% + ${(e.clientX - w/2) * 0.1}px), calc(-50% + ${(e.clientY - h/2) * 0.1}px))`;
    
    // 3D tilt cards
    document.querySelectorAll('.bento-grid .bento-item').forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left; // x position within the element.
        const y = e.clientY - rect.top;  // y position within the element.
        
        // Check if mouse is hovering this card
        if(x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -4; // Max rotation deg
            const rotateY = ((x - centerX) / centerX) * 4;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        } else {
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        }
    });
});

// --- CORE INIT ---
async function init(){
    await loadConfig();
    await loadData();
    setupRealtime();
    setInterval(updateClock,1000);
}

async function loadConfig(){
    const{data}=await db.from('admin_config').select('*').eq('id',1).single();
    if(data){
        aOrg=data.jumlah_orang||0; aAC=data.setting_ac||24; aKon=data.kondisi||'AC Menyala'; aCat=data.catatan||'-';
        el('orgDisplay').innerText=aOrg; el('acDisplay').innerText=aAC;
        // sync segments
        document.querySelectorAll('.seg-btn').forEach(b => {
            if(b.innerText.includes(aKon.split(' ')[0])) {
                document.querySelectorAll('.seg-btn').forEach(x=>x.classList.remove('act'));
                b.classList.add('act');
            }
        });
    }
}

async function loadData(){
    const{data,error}=await db.from('sensor_data').select('*').order('created_at',{ascending:true});
    if(error){ el('dbStatus').innerText='Gagal'; el('dot').className='dt dt-er'; toast('Error: '+error.message,'er'); return; }
    allData=data||[]; 
    el('dbStatus').innerText='Supabase Aktif'; el('dot').className='dt dt-ok'; 
    animateValue('totalRec', allData.length);
    toast(allData.length+' record dipulihkan','ok');
    updateDashboard();
}

function setupRealtime(){
    db.channel('sc').on('postgres_changes',{event:'INSERT',schema:'public',table:'sensor_data'},(p)=>{
        allData.push(p.new); animateValue('totalRec', allData.length); updateDashboard(); toast('📡 Telemetri masuk','ok');
    }).subscribe();
    db.channel('cc').on('postgres_changes',{event:'*',schema:'public',table:'admin_config'},(p)=>{
        const d=p.new; if(d){ aOrg=d.jumlah_orang||0; aAC=d.setting_ac||24; aKon=d.kondisi||'AC Menyala'; aCat=d.catatan||'-'; el('orgDisplay').innerText=aOrg; el('acDisplay').innerText=aAC; }
    }).subscribe();
}

// --- DASHBOARD RENDER ---
function updateRing(val){
    const min=15, max=40, pct=Math.min(1,Math.max(0,(val-min)/(max-min)));
    const off=264-(pct*264);
    const r=el('suhuRing'); r.style.strokeDashoffset=off;
    const c = val<=26?'#10b981':val<=32?'#f59e0b':'#ef4444';
    r.style.stroke=c;
    // Set ambient glow based on temp
    el('ambient-glow').style.background = `radial-gradient(circle, ${c}25 0%, transparent 60%)`;
    animateValue('ringVal', val, 1500, false);
}

function updateDashboard(){
    if(!allData.length) return;
    const L=allData[allData.length-1];
    
    // Hero Stats
    if(L.suhu!=null) { animateValue('suhu', L.suhu, 1500, true); updateRing(L.suhu); }
    if(L.kelembaban!=null) animateValue('lem', L.kelembaban, 1500, false);
    if(L.comfort_index!=null) animateValue('ci', L.comfort_index, 1500, false);
    
    el('hi').innerText = L.heat_index?.toFixed(1) || '--';
    el('ac').innerText = L.setting_ac || aAC;
    el('lastUpdate').innerText = fmtTime(L.created_at);
    
    // Status badges
    const st=el('sts'); st.innerText=L.status||'--';
    st.className = 'stat-badge bg-' + (L.comfort_index>=70?'good':L.comfort_index>=40?'warn':'bad');
    
    // Compute Dev
    const dv=el('dev'); const devVal = L.deviasi||0;
    dv.innerText = (devVal>=0?'+':'') + devVal.toFixed(1);
    dv.className = Math.abs(devVal)<=1?'st-good':devVal>0?'st-bad':'st-blue';
    
    // CI Bar
    const ci=L.comfort_index||0, bar=el('ciBar');
    bar.style.width=ci+'%';
    bar.style.background = ci>=70?'#10b981':ci>=40?'#f59e0b':'#ef4444';
    
    if(ci>=80) el('reko').innerHTML='<span style="color:#10b981">Optimal.</span> Profil termodinamika kelas sinkron dengan standar SNI 03-6572-2001 (24-27°C).';
    else if(ci>=60) el('reko').innerHTML='<span style="color:#f59e0b">Marginal.</span> Fluktuasi termal terdeteksi. Pertimbangan untuk kompensasi AC sebesar -1°C untuk beban penghuni saat ini.';
    else el('reko').innerHTML='<span style="color:#ef4444">Kritis.</span> Kinerja sistem pendingin gagal mengkompensasi beban termal penghuni. Deviasi >2°C divalidasi.';

    updateStats(); updateLogTable(); updateCharts();
}

function updateStats(){
    const sa=allData.filter(d=>d.suhu!=null).map(d=>d.suhu);
    if(!sa.length) return;
    const av=a=>a.reduce((x,y)=>x+y,0)/a.length;
    animateValue('sMin', Math.min(...sa), 1500, true);
    animateValue('sMax', Math.max(...sa), 1500, true);
    animateValue('sAvg', av(sa), 1500, true);
    
    const gr={}; allData.forEach(d=>{ if(d.jumlah_orang==null) return; (gr[d.jumlah_orang]=gr[d.jumlah_orang]||[]).push(d.suhu); });
    const ks=Object.keys(gr).map(Number).sort((a,b)=>a-b);
    if(ks.length>=2){ const dt=(av(gr[ks[ks.length-1]])-av(gr[ks[0]]))/(ks[ks.length-1]-ks[0]); el('deltaT').innerText=(dt>=0?'+':'')+dt.toFixed(3); }
}

function updateLogTable(){
    const rc=allData.slice(-30).reverse(); let h='';
    rc.forEach(d=>{
        const dv=d.deviasi||0;
        h+=`<tr>
            <td style="color:var(--tc-sub)">${fmtTime(d.created_at)}</td>
            <td style="color:var(--tc-main); font-weight:700;">${d.suhu?.toFixed(1)||'-'}°</td>
            <td>${d.kelembaban?.toFixed(1)||'-'}%</td>
            <td style="color:var(--tc-heat)">${d.heat_index?.toFixed(1)||'-'}°</td>
            <td class="${dv>1?'st-bad':dv<-1?'st-blue':'st-good'}">${(dv>=0?'+':'')+dv.toFixed(1)}°</td>
            <td class="${d.comfort_index>=70?'st-good':d.comfort_index>=40?'st-warn':'st-bad'}">${d.comfort_index?.toFixed(0)||'-'}%</td>
            <td style="color:var(--tc-org)">${d.jumlah_orang??'-'}</td>
            <td>${d.setting_ac??'-'}°</td>
            <td><span class="stat-badge bg-${d.comfort_index>=70?'good':d.comfort_index>=40?'warn':'bad'}" style="position:static;font-size:8px;padding:4px 8px">${(d.status||'-')}</span></td>
        </tr>`;
    });
    el('logTable').innerHTML=h||'<tr><td colspan="9" style="color:var(--text-sub)">N/A</td></tr>';
}

function setChart(f, btn){
    currentField=f; document.querySelectorAll('.tab-r .tab').forEach(t=>t.classList.remove('act')); btn.classList.add('act'); updateCharts();
}

function updateCharts(){
    const l40=allData.slice(-40), lb=l40.map(d=>fmtTime(d.created_at)), vl=l40.map(d=>d[currentField]||0);
    const cl={suhu:'#3b82f6', kelembaban:'#10b981', heat_index:'#ef4444', comfort_index:'#f59e0b'}, cr=cl[currentField]||'#fff';
    const isLight = document.body.classList.contains('light-mode');
    
    if(mainChart) mainChart.destroy();
    const ctx=el('mainChart').getContext('2d');
    const grd=ctx.createLinearGradient(0,0,0,300); grd.addColorStop(0,cr+'55'); grd.addColorStop(1,cr+'00');
    
    Chart.defaults.color = isLight ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.5)';
    Chart.defaults.font.family = "'JetBrains Mono', monospace";
    
    const gridX = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.02)';
    const gridY = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
    const tipBg = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(20,20,25,0.9)';
    const tipTitle = isLight ? '#1e293b' : '#fff';
    const tipBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)';
    const axisLabel = isLight ? 'rgba(30,41,59,0.7)' : 'rgba(255,255,255,0.5)';
    const tickCol = isLight ? 'rgba(30,41,59,0.6)' : 'rgba(255,255,255,0.4)';
    
    mainChart=new Chart(ctx,{
        type:'line', data:{labels:lb, datasets:[{data:vl, borderColor:cr, backgroundColor:grd, fill:true, tension:0.4, pointRadius:0, pointHoverRadius:6, borderWidth:3}]},
        options:{ responsive:true, maintainAspectRatio:false, interaction:{intersect:false,mode:'index'}, plugins:{legend:{display:false}, tooltip:{backgroundColor:tipBg, titleColor:tipTitle, bodyColor:cr, padding:12, borderColor:tipBorder, borderWidth:1}}, scales:{x:{ticks:{color:tickCol, maxTicksLimit:8},grid:{color:gridX}}, y:{ticks:{color:tickCol},grid:{color:gridY}}} }
    });
    
    const gr={}; allData.forEach(d=>{ if(d.jumlah_orang==null||d.suhu==null)return; (gr[d.jumlah_orang]=gr[d.jumlah_orang]||[]).push(d.suhu); });
    const av=a=>a.reduce((x,y)=>x+y,0)/a.length, ks=Object.keys(gr).map(Number).sort((a,b)=>a-b);
    
    if(corrChart) corrChart.destroy();
    corrChart=new Chart(el('corrChart'),{
        type:'line', data:{labels:ks, datasets:[{data:ks.map(k=>av(gr[k])), borderColor:'#8b7cf7', backgroundColor:'rgba(139,124,247,0.2)', borderWidth:3, tension:0.4, fill:true, pointBackgroundColor:isLight?'#6366f1':'#fff', pointRadius:4}]},
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{backgroundColor:tipBg, titleColor:tipTitle, padding:12, borderColor:tipBorder, borderWidth:1, callbacks:{label:c=>'Suhu rata-rata: '+c.parsed.y.toFixed(1)+'°C'}}}, scales:{x:{ticks:{color:tickCol},title:{display:true,text:'Kapasitas (Orang)',color:axisLabel},grid:{color:gridX}}, y:{ticks:{color:tickCol},title:{display:true,text:'Suhu (°C)',color:axisLabel},grid:{color:gridY}}} }
    });
}

function updateClock(){ const n=new Date(); el('clk').innerText=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0'); }

// --- ADMIN CONTROL ---
async function saveConfig(){await db.from('admin_config').upsert({id:1,jumlah_orang:aOrg,setting_ac:aAC,kondisi:aKon,catatan:aCat});}
async function adjOrg(val){ aOrg=Math.max(0,aOrg+val); el('orgDisplay').innerText=aOrg; await saveConfig(); msg('mOrg','✓','st-green'); }
async function adjAC(val){ aAC=Math.min(30,Math.max(16,aAC+val)); el('acDisplay').innerText=aAC; await saveConfig(); msg('mAC','✓','st-green'); }
async function setKon(k, btn){ aKon=k; document.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('act')); btn.classList.add('act'); await saveConfig(); msg('mKon','✓','st-green'); }

async function kirimManual(){
    const L=allData[allData.length-1]; if(!L){ toast('Dataset kosong.','er'); return; }
    aCat=el('iCat').value||'-'; await saveConfig();
    const{error}=await db.from('sensor_data').insert({tanggal:L.tanggal, waktu:new Date().toLocaleTimeString('id-ID'), suhu:L.suhu, kelembaban:L.kelembaban, heat_index:L.heat_index, deviasi:L.suhu-aAC, comfort_index:L.comfort_index, jumlah_orang:aOrg, setting_ac:aAC, kondisi:aKon, catatan:aCat+'(req)', status:L.status});
    if(!error){ toast('📦 Sync force sukses','ok'); el('iCat').value=''; } else toast('Gagal push','er');
}
function toggleMode(){ pMode=!pMode; document.querySelectorAll('.pres-hide').forEach(e=>e.style.display=pMode?'none':'block'); el('modeBtn').innerText=pMode?'Buka Panel Kendali':'Tutup Kendali'; }
function exportCSV(){
    if(!allData.length)return;
    let c='Tanggal,Waktu,Suhu,RH,HI,Deviasi,CI,Orang,Target,Status\n';
    allData.forEach(d=>c+=[d.tanggal,d.waktu,d.suhu,d.kelembaban,d.heat_index,d.deviasi,d.comfort_index,d.jumlah_orang,d.setting_ac,d.status].join(',')+'\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([c],{type:'text/csv'})); a.download='log_'+new Date().getTime()+'.csv'; a.click();
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    if(el('themeBtn')) el('themeBtn').innerText = isLight ? '🌙 Dark Mode' : '☀️ Light Mode';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    if(allData.length) updateCharts();
}

function toggleHistory() {
    el('historyModal').classList.toggle('active');
}

if(localStorage.getItem('theme') !== 'dark') {
    document.body.classList.add('light-mode');
    if(el('themeBtn')) el('themeBtn').innerText = '🌙 Dark Mode';
}

init();
