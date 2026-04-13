const SUPA_URL='https://sjvrugtlhvyvqkebjmka.supabase.co';
const SUPA_KEY='sb_publishable_6iKYw5qRwfEsF7g2XUZDEQ_et9RV8LS';

const db=window.supabase.createClient(SUPA_URL,SUPA_KEY);
let allData=[],mainChart=null,corrChart=null,currentField='suhu';
let adminOrang=0,adminAC=24,adminKondisi='AC Menyala',adminCatatan='-',presMode=true;

async function init(){await loadData();await loadConfig();setupRealtime();setInterval(updateClock,1000);}
function toast(m,t='info'){const e=document.getElementById('toast');e.textContent=m;e.className='toast show toast-'+t;setTimeout(()=>e.className='toast',3000);}
function msg(id,t,c){const m=document.getElementById(id);m.textContent=t;m.className='mg sh '+c;setTimeout(()=>m.className='mg',3000);}
function el(id,v){const e=document.getElementById(id);if(e&&v!==undefined)e.textContent=v;}

async function loadConfig(){const{data}=await db.from('admin_config').select('*').eq('id',1).single();
if(data){adminOrang=data.jumlah_orang||0;adminAC=data.setting_ac||24;adminKondisi=data.kondisi||'AC Menyala';adminCatatan=data.catatan||'-';
el('orgDisplay',adminOrang);el('acDisplay',adminAC);el('orgInfo',adminOrang);}}
async function saveConfig(){await db.from('admin_config').upsert({id:1,jumlah_orang:adminOrang,setting_ac:adminAC,kondisi:adminKondisi,catatan:adminCatatan});}

async function loadData(){const{data,error}=await db.from('sensor_data').select('*').order('created_at',{ascending:true});
if(error){el('dbStatus','Gagal');document.getElementById('dot').className='dt dt-er';toast('Error: '+error.message,'er');return;}
allData=data||[];el('dbStatus','Terhubung');document.getElementById('dot').className='dt dt-ok';el('totalRec',allData.length);toast(allData.length+' record dimuat','ok');updateDashboard();}

function setupRealtime(){db.channel('sc').on('postgres_changes',{event:'INSERT',schema:'public',table:'sensor_data'},(p)=>{
allData.push(p.new);el('totalRec',allData.length);updateDashboard();toast('📡 Data baru!','ok');}).subscribe();
db.channel('cc').on('postgres_changes',{event:'*',schema:'public',table:'admin_config'},(p)=>{const d=p.new;if(d){adminOrang=d.jumlah_orang||0;adminAC=d.setting_ac||24;adminKondisi=d.kondisi||'AC Menyala';adminCatatan=d.catatan||'-';el('orgDisplay',adminOrang);el('acDisplay',adminAC);el('orgInfo',adminOrang);}}).subscribe();}

async function setOrang(){const v=parseInt(document.getElementById('iOrg').value);if(isNaN(v)){msg('mOrg','Masukkan angka!','mg-er');return;}adminOrang=Math.max(0,v);document.getElementById('iOrg').value=adminOrang;await saveConfig();el('orgDisplay',adminOrang);el('orgInfo',adminOrang);msg('mOrg','✓ '+adminOrang+' orang','mg-ok');toast('Orang: '+adminOrang,'ok');}
async function setAC(){const v=parseInt(document.getElementById('iAC').value);if(isNaN(v)){msg('mAC','Masukkan angka!','mg-er');return;}adminAC=Math.min(30,Math.max(16,v));document.getElementById('iAC').value=adminAC;await saveConfig();el('acDisplay',adminAC);msg('mAC','✓ '+adminAC+'°C','mg-ok');toast('AC: '+adminAC+'°C','ok');}
async function setKondisi(){adminKondisi=document.getElementById('sKon').value;await saveConfig();msg('mKon','✓ '+adminKondisi,'mg-ok');}
async function setCatatan(){adminCatatan=document.getElementById('iCat').value||'-';await saveConfig();msg('mCat','✓ Tersimpan','mg-ok');}
async function kirimManual(){const L=allData[allData.length-1];if(!L){toast('Belum ada data!','er');return;}const{error}=await db.from('sensor_data').insert({tanggal:L.tanggal,waktu:new Date().toLocaleTimeString('id-ID'),suhu:L.suhu,kelembaban:L.kelembaban,heat_index:L.heat_index,deviasi:L.suhu-adminAC,comfort_index:L.comfort_index,jumlah_orang:adminOrang,setting_ac:adminAC,kondisi:adminKondisi,catatan:adminCatatan+'(m)',status:L.status});if(!error)toast('✅ Terkirim!','ok');else toast('Gagal','er');}
async function hapusData(){if(!confirm('Yakin hapus SEMUA data?'))return;await db.from('sensor_data').delete().neq('id',0);allData=[];updateDashboard();toast('Data dihapus','info');}
function exportCSV(){if(!allData.length){toast('Tidak ada data','er');return;}let c='No,Tanggal,Waktu,Suhu,Kelembaban,HeatIndex,Deviasi,CI,Orang,AC,Kondisi,Catatan,Status\n';allData.forEach((d,i)=>{c+=[i+1,d.tanggal,d.waktu,d.suhu,d.kelembaban,d.heat_index,d.deviasi,d.comfort_index,d.jumlah_orang,d.setting_ac,d.kondisi,d.catatan,d.status].join(',')+'\n';});const b=new Blob([c],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='data_'+new Date().toISOString().slice(0,10)+'.csv';a.click();toast('📊 CSV exported!','ok');}
function toggleMode(){presMode=!presMode;document.querySelectorAll('.pres-hide').forEach(e=>e.style.display=presMode?'none':'block');document.getElementById('modeBtn').textContent=presMode?'👁️ Mode Admin':'🎬 Mode Presentasi';}
document.addEventListener('DOMContentLoaded',()=>{['iOrg','iAC'].forEach(id=>{document.getElementById(id)?.addEventListener('keypress',e=>{if(e.key==='Enter'){id==='iOrg'?setOrang():setAC();}});});document.getElementById('iCat')?.addEventListener('keypress',e=>{if(e.key==='Enter')setCatatan();});});

function updateRing(val){const min=15,max=40,pct=Math.min(1,Math.max(0,(val-min)/(max-min)));const off=264-(pct*264);
const r=document.getElementById('suhuRing');r.style.strokeDashoffset=off;
r.style.stroke=val<=26?'#10b981':val<=32?'#f59e0b':'#ef4444';el('ringVal',val.toFixed(1));}

function fmtDate(ts){if(!ts)return'-';const d=new Date(ts);return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}
function fmtTime(ts){if(!ts)return'-';const d=new Date(ts);if(isNaN(d))return'-';return d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});}
function updateDashboard(){if(!allData.length){el('totalRec','0');return;}const L=allData[allData.length-1];
el('suhu',L.suhu?.toFixed(1));el('lem',L.kelembaban?.toFixed(1));el('hi',L.heat_index?.toFixed(1));el('ac',L.setting_ac);el('ci',L.comfort_index?.toFixed(0));el('lastUpdate',fmtDate(L.created_at)+' '+fmtTime(L.created_at));el('orgInfo',L.jumlah_orang??adminOrang);
if(L.suhu)updateRing(L.suhu);
const st=document.getElementById('sts');st.textContent=L.status;st.className='sb '+L.status;
const dv=document.getElementById('dev');const d=L.deviasi||0;dv.textContent=(d>=0?'+':'')+d.toFixed(1);dv.className=Math.abs(d)<=1?'dev-ok':d>0?'dev-pos':'dev-neg';
const ci=L.comfort_index||0,bar=document.getElementById('ciBar');bar.style.width=ci+'%';bar.className='ci-fill '+(ci>=70?'ci-good':ci>=40?'ci-mid':'ci-bad');
const sc=document.getElementById('suhuCard'),cc=document.getElementById('ciCard');
if(ci<40){sc.classList.add('alert-card');cc.classList.add('alert-card');}else{sc.classList.remove('alert-card');cc.classList.remove('alert-card');}
if(ci>=80)el('reko','✅ Kondisi ruangan memenuhi standar kenyamanan SNI 03-6572-2001 (24-27°C, 55-65% RH).');
else if(ci>=60)el('reko','⚠️ Cukup nyaman. Pertimbangkan turunkan AC 1-2 derajat untuk efisiensi energi.');
else if(ci>=40)el('reko','🟡 Kurang nyaman. Disarankan turunkan AC atau kurangi penghuni.');
else el('reko','🔴 TIDAK NYAMAN! AC tidak mampu mengkompensasi beban panas. Perlu unit AC tambahan.');
updateStats();updateGroupStats();updateLogTable();updateCharts();updateSummary();}

function updateStats(){const sa=allData.map(d=>d.suhu).filter(v=>v!=null),la=allData.map(d=>d.kelembaban).filter(v=>v!=null),da=allData.map(d=>d.deviasi).filter(v=>v!=null);
if(!sa.length)return;const av=a=>a.reduce((x,y)=>x+y,0)/a.length;
el('sMin',Math.min(...sa).toFixed(1));el('sMax',Math.max(...sa).toFixed(1));el('sAvg',av(sa).toFixed(1));
const dA=da.length?av(da):0;el('dAvg',(dA>=0?'+':'')+dA.toFixed(1));el('lMin',Math.min(...la).toFixed(1));el('lMax',Math.max(...la).toFixed(1));el('cnt',allData.length);
const gr={};allData.forEach(d=>{const o=d.jumlah_orang;if(o==null)return;if(!gr[o])gr[o]=[];gr[o].push(d.suhu);});const ks=Object.keys(gr).map(Number).sort((a,b)=>a-b);
if(ks.length>=2){const mn=ks[0],mx=ks[ks.length-1];if(mx>mn){const dt=(av(gr[mx])-av(gr[mn]))/(mx-mn);el('deltaT',(dt>=0?'+':'')+dt.toFixed(3));}}}

function updateGroupStats(){const gr={};allData.forEach(d=>{const o=d.jumlah_orang;if(o==null)return;if(!gr[o])gr[o]={s:[],l:[],d:[],c:[]};gr[o].s.push(d.suhu);gr[o].l.push(d.kelembaban);gr[o].d.push(d.deviasi);gr[o].c.push(d.comfort_index);});
const av=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length):0,ks=Object.keys(gr).map(Number).sort((a,b)=>a-b);let h='';
ks.forEach(o=>{const g=gr[o],ad=av(g.d);h+='<tr><td>'+o+'</td><td>'+av(g.s).toFixed(1)+'°</td><td>'+av(g.l).toFixed(1)+'%</td><td class="'+(ad>1?'dev-pos':ad<-1?'dev-neg':'dev-ok')+'">'+(ad>=0?'+':'')+ad.toFixed(1)+'°</td><td>'+av(g.c).toFixed(0)+'%</td><td>'+g.s.length+'</td></tr>';});
document.getElementById('grpTable').innerHTML=h||'<tr><td colspan="6" style="color:var(--muted)">Belum ada data</td></tr>';}

function updateLogTable(){const rc=allData.slice(-30).reverse();let h=''; // Increased to 30 rows since scrollable now
rc.forEach(d=>{const dv=d.deviasi||0;h+='<tr><td>'+fmtDate(d.created_at)+'</td><td>'+fmtTime(d.created_at)+'</td><td>'+(d.suhu?.toFixed(1)||'-')+'</td><td>'+(d.kelembaban?.toFixed(1)||'-')+'</td><td>'+(d.heat_index?.toFixed(1)||'-')+'</td><td>'+(d.jumlah_orang??'-')+'</td><td>'+(d.setting_ac??'-')+'</td><td class="'+(dv>1?'dev-pos':dv<-1?'dev-neg':'dev-ok')+'">'+(dv>=0?'+':'')+dv.toFixed(1)+'</td><td>'+(d.comfort_index?.toFixed(0)||'-')+'%</td><td><span class="sb '+d.status+'" style="font-size:9px;padding:3px 10px">'+(d.status||'-')+'</span></td></tr>';});
document.getElementById('logTable').innerHTML=h||'<tr><td colspan="10" style="color:var(--muted)">Belum ada data</td></tr>';}

function setChart(f,b){currentField=f;document.querySelectorAll('.tab').forEach(t=>t.classList.remove('act'));b.classList.add('act');updateCharts();}

function updateCharts(){const l30=allData.slice(-30),lb=l30.map(d=>fmtTime(d.created_at)),vl=l30.map(d=>d[currentField]||0);
const cl={suhu:'#8b7cf7',kelembaban:'#10b981',heat_index:'#ef4444',comfort_index:'#f59e0b'},cr=cl[currentField]||'#8b7cf7';
if(mainChart)mainChart.destroy();const ctx=document.getElementById('mainChart').getContext('2d');
const grd=ctx.createLinearGradient(0,0,0,320);grd.addColorStop(0,cr+'33');grd.addColorStop(1,cr+'00');
mainChart=new Chart(ctx,{type:'line',data:{labels:lb,datasets:[{data:vl,borderColor:cr,backgroundColor:grd,fill:true,tension:.45,pointRadius:3,pointBackgroundColor:cr,pointBorderColor:'rgba(255,255,255,.8)',pointBorderWidth:1.5,borderWidth:2.5,pointHoverRadius:6}]},options:{responsive:true,interaction:{intersect:false,mode:'index'},plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(18,18,40,.95)',titleFont:{family:'Inter',weight:'600'},bodyFont:{family:'JetBrains Mono',size:14,weight:'600'},padding:14,cornerRadius:12,borderColor:cr+'44',borderWidth:1,displayColors:false}},scales:{x:{ticks:{color:'#ffffff22',font:{size:8,family:'JetBrains Mono'},maxTicksLimit:6},grid:{color:'#ffffff04'}},y:{ticks:{color:'#ffffff22',font:{size:9,family:'JetBrains Mono'}},grid:{color:'#ffffff04'}}}}});
const gr={};allData.forEach(d=>{const o=d.jumlah_orang;if(o==null||d.suhu==null)return;if(!gr[o])gr[o]=[];gr[o].push(d.suhu);});
const av=a=>a.reduce((x,y)=>x+y,0)/a.length,ks=Object.keys(gr).map(Number).sort((a,b)=>a-b);
if(corrChart)corrChart.destroy();
corrChart=new Chart(document.getElementById('corrChart'),{type:'scatter',data:{datasets:[{data:ks.map(k=>({x:k,y:av(gr[k])})),backgroundColor:cr+'cc',pointRadius:8,pointHoverRadius:13,pointBorderColor:'#fff',pointBorderWidth:2}]},options:{responsive:true,plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(18,18,40,.95)',bodyFont:{family:'JetBrains Mono',size:14,weight:'600'},padding:14,cornerRadius:12,displayColors:false,callbacks:{label:c=>c.parsed.x+' orang → '+c.parsed.y.toFixed(1)+'°C'}}},scales:{x:{title:{display:true,text:'Jumlah Orang',color:'#ffffff44',font:{family:'Inter',size:11,weight:'600'}},ticks:{color:'#ffffff22',font:{family:'JetBrains Mono'}},grid:{color:'#ffffff04'}},y:{title:{display:true,text:'Rata-rata Suhu (°C)',color:'#ffffff44',font:{family:'Inter',size:11,weight:'600'}},ticks:{color:'#ffffff22',font:{family:'JetBrains Mono'}},grid:{color:'#ffffff04'}}}}});}

function updateSummary(){if(!allData.length)return;const f=allData[0],l=allData[allData.length-1];
const sa=allData.map(d=>d.suhu).filter(v=>v!=null),av=a=>a.reduce((x,y)=>x+y,0)/a.length;
document.getElementById('sumContent').innerHTML='📅 '+fmtDate(f.created_at)+'<br>⏱️ '+fmtTime(f.created_at)+' → '+fmtTime(l.created_at)+'<br>❄️ AC '+(l.setting_ac||'-')+'°C<br>───────────────<br>🌡️ '+Math.min(...sa).toFixed(1)+' / '+Math.max(...sa).toFixed(1)+' / '+av(sa).toFixed(1)+' °C<br>📊 '+allData.length+' record';}

function updateClock(){const n=new Date();el('clk',String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0')+' WIB');}
init();
