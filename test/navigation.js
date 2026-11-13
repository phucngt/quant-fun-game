const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const Navigation = require('../src/navigation.js');
const data = require('../assets/navigation.json');
const nav = new Navigation(data);
const B = path.resolve(__dirname, '..');
const shots = path.join(B, 'shots');
fs.mkdirSync(shots, { recursive: true });
const roles = Object.keys(data.stations);

// Independent geometric oracle: floor polygon minus measured contact quads.
function inPolygon(p, poly) {
  let inside = false;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if ((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
function edgeDistance(p,a,b) {
  const scale=q=>[q[0]*data.width/100/data.tilePixels,q[1]*data.height/100/data.tilePixels];
  [p,a,b]=[p,a,b].map(scale);
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function geometryClear(p) {
  if (!inPolygon(p,data.floor)) return false;
  for (const { polygon } of data.obstacles) {
    if (inPolygon(p,polygon)) return false;
    for(let i=0;i<polygon.length;i++) if(edgeDistance(p,polygon[i],polygon[(i+1)%polygon.length])<data.paddingTiles-.07) return false;
  }
  return true;
}
function staticChecks() {
  assert.equal(new Set(roles.map(r=>data.stations[r].desk)).size,5);
  for(let i=0;i<roles.length;i++) for(let j=i+1;j<roles.length;j++) assert(nav.distance(data.stations[roles[i]].spot,data.stations[roles[j]].spot)>=1.5);
  for(const [key,p] of Object.entries({...nav.nodes,...data.spots})) assert(nav.contains(p)&&geometryClear(p),'bad floor node '+key);
  for(const [a,b] of nav.edges) {
    const from=nav.nodes[a],to=nav.nodes[b],n=Math.max(1,Math.ceil(nav.distance(from,to)/.25));
    for(let k=0;k<=n;k++) {
      const p=from.map((v,i)=>v+(to[i]-v)*k/n);
      assert(nav.contains(p)&&geometryClear(p),'bad edge '+a+' -> '+b);
    }
  }
  for(const r of roles) {
    const blocks=roles.filter(q=>q!==r).map(q=>({point:data.stations[q].spot,radius:.95}));
    for(const [id,dest] of Object.entries(data.spots)) {
      if(blocks.some(o=>nav.distance(o.point,dest)<o.radius))continue;
      const route=nav.path(data.stations[r].spot,dest,blocks);
      assert(route,`unreachable ${r} -> ${id}`);
      let prev=data.stations[r].spot;
      for(const p of route){assert(nav.segmentClear(prev,p,blocks));prev=p;}
    }
  }
  assert.equal(nav.path(data.stations.boss.spot,data.stations.quant.spot,[{point:data.stations.quant.spot,radius:2}]),null);
  console.log('Static floor: 5 distinct desks, '+Object.keys(nav.nodes).length+' nodes, '+nav.edges.length+' edges, all destinations reachable');
}
async function enter(browser, ambient, viewport={width:1440,height:900}) {
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  await page.addInitScript(({ambient})=>{
    window.QF_NOW=Date.parse('2026-11-13T10:00:00+07:00');
    window.QF_AMBIENT=ambient; window.QF_FAST=!ambient;
    let seed=1729; Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    localStorage.setItem('quantfun.settings.v1',JSON.stringify({speed:'fast',brain:false}));
  },{ambient});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.text());});
  page.on('request',r=>{if(!/^(file|data|blob):/.test(r.url()))errors.push('Network request: '+r.url());});
  await page.goto(pathToFileURL(path.join(B,'out/download/quant-fun.html')).href);
  await page.waitForSelector('#title:not([hidden])'); await page.click('#deploy');
  await page.waitForSelector('#messages .msg');
  return {context,page,errors};
}
async function stationShots(browser) {
  const {context,page,errors}=await enter(browser,false);
  await page.addStyleTag({content:'.bubble,.mini{display:none!important}'});
  for(const r of roles) for(const working of [false,true]) {
    await page.evaluate(([r,w])=>window.__qf.work(r,w),[r,working]);
    await page.waitForTimeout(180);
    const before=await page.evaluate(r=>{
      const a=document.getElementById('actor-'+r);
      return {point:[parseFloat(a.style.left),parseFloat(a.style.top)],face:a.dataset.facing,status:a.dataset.status,action:a.querySelector('.act').dataset.action,frame:a.querySelector('.act').dataset.frame};
    },r);
    assert(nav.distance(before.point,data.stations[r].spot)<.001,r+' moved at desk');
    if(working){
      const {spot,look}=data.stations[r];
      const expected=(look[1]>spot[1]?'front-':'rear-')+(look[0]<spot[0]?'left':'right');
      assert.equal(before.face,expected); assert.equal(before.action,'type-standing');
      const frames=new Set([before.frame]);
      for(let i=0;i<6;i++){await page.waitForTimeout(65);frames.add(await page.$eval('#actor-'+r+' .act',e=>e.dataset.frame));}
      assert(frames.size>1,r+' typing did not animate');
    } else assert.equal(before.status,'nhìn quanh');
    const box=await page.locator('#actor-'+r).boundingBox();
    await page.screenshot({path:path.join(shots,`station-${r}-${working?'working':'idle'}.png`),clip:{x:Math.max(0,box.x-90),y:Math.max(0,box.y-65),width:300,height:280}});
  }
  assert.deepEqual(errors,[]); await context.close();
  const mobile=await enter(browser,false,{width:400,height:860});
  await mobile.page.screenshot({path:path.join(shots,'navigation-400.png'),fullPage:true});
  assert.deepEqual(mobile.errors,[]);await mobile.context.close();
}
async function soak(browser) {
  const {context,page,errors}=await enter(browser,true);
  await page.evaluate(()=>{
    window.navigationSoak={samples:[], started:performance.now(),done:false};
    const timer=setInterval(()=>{
      const s={t:performance.now()-window.navigationSoak.started,actors:{}};
      for(const r of ['boss','quant','trader','risk','portfolio']){
        const a=document.getElementById('actor-'+r);
        s.actors[r]={p:[parseFloat(a.style.left),parseFloat(a.style.top)],status:a.dataset.status,walking:a.classList.contains('walking'),state:window.__qf.state(r)};
      }
      window.navigationSoak.samples.push(s);
      if(s.t>=120000){clearInterval(timer);window.navigationSoak.done=true;}
    },100);
  });
  // Exercise cancellation, Trader -> Boss, next-open fill, printer trip and reset
  // while the independent sampler watches every role throughout.
  const cmd=async t=>{await page.fill('#chat-input',t);await page.press('#chat-input','Enter');};
  await page.evaluate(()=>window.__qf.force('portfolio','printer'));
  await page.waitForTimeout(450);
  await cmd('/giao'); await page.waitForTimeout(1600);await cmd('/next 13');
  await page.waitForSelector('.mcard.decision.pass',{timeout:30000});
  await page.waitForFunction(()=>document.getElementById('actor-trader').dataset.status==='chờ Boss quyết',null,{timeout:20000});
  await cmd('/approve');
  await page.waitForTimeout(2200);await cmd('/next');
  await page.waitForSelector('.mcard.book');
  await page.waitForTimeout(12000);
  await cmd('/reset now');
  await page.waitForTimeout(6500);
  await page.evaluate(()=>window.__qf.force('quant','chat:portfolio'));
  for(let i=0;i<12;i++){
    const state=await page.evaluate(()=>({done:window.navigationSoak.done,count:window.navigationSoak.samples.length}));
    console.log('Soak samples:',state.count);
    if(state.done)break;
    await page.waitForTimeout(9000);
  }
  await page.waitForFunction(()=>window.navigationSoak.done,null,{timeout:20000});
  const samples=await page.evaluate(()=>window.navigationSoak.samples);
  assert(samples.length>=1100,'sampler missed too many 100ms intervals');
  const failures=[],visited=new Set(),left=new Set(),returned=new Set();let minimum=Infinity;
  for(const sample of samples){
    for(const r of roles){
      const a=sample.actors[r];visited.add(a.status);
      if(!nav.contains(a.p)||!geometryClear(a.p))failures.push([sample.t,r,'feet in furniture',a]);
      const away=nav.distance(a.p,data.stations[r].spot)>.3;
      if(away)left.add(r);else if(left.has(r))returned.add(r);
      if(a.status==='nhìn quanh' && away)failures.push([sample.t,r,'idle away from station',a]);
    }
    for(let i=0;i<roles.length;i++)for(let j=i+1;j<roles.length;j++){
      const a=sample.actors[roles[i]],b=sample.actors[roles[j]],distance=nav.distance(a.p,b.p);
      minimum=Math.min(minimum,distance);
      if(distance<.8-1e-5)failures.push([sample.t,roles[i],roles[j],'overlap',distance]);
    }
  }
  fs.writeFileSync(path.join(shots,'navigation-soak.json'),JSON.stringify({durationMs:samples.at(-1).t,samples:samples.length,minimumSeparationTiles:minimum,returned:[...returned],statuses:[...visited],failures:failures.slice(0,20),errors},null,2));
  assert.deepEqual(failures.slice(0,10),[]);assert.deepEqual(errors,[]);
  assert(returned.size>=3,'insufficient activity during soak');
  for(const text of ['trao đổi','lấy nước','pha cà phê','lấy bản in'])assert([...visited].some(v=>v.includes(text)),'missing routine '+text);
  await page.locator('#room').screenshot({path:path.join(shots,'navigation-soak-room.png')});
  console.log('120-second soak passed:',samples.length,'samples; closest feet',minimum.toFixed(3),'tiles; returned', [...returned]);
  await context.close();
}
(async()=>{
  staticChecks();
  if(process.argv.includes('--static'))return;
  const browser=await chromium.launch();
  try{await stationShots(browser);if(!process.argv.includes('--shots'))await soak(browser);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
