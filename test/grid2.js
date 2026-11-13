const { chromium } = require('playwright'); const path=require('path');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1700,height:1300},deviceScaleFactor:1.5})).newPage();
await p.addInitScript(()=>{window.QF_FAST=true});
await p.goto('file://'+path.resolve(__dirname,'../out/download/quant-fun.html'));
await p.waitForSelector('#title:not([hidden])');await p.click('#deploy');await p.waitForSelector('#messages .msg');
await p.evaluate(()=>{document.getElementById('game').style.gridTemplateColumns='1fr 0px';
 const r=document.getElementById('room');
 for(let x=0;x<=100;x+=2){const l=document.createElement('div');l.style.cssText=`position:absolute;left:${x}%;top:0;bottom:0;border-left:1px solid ${x%10?'rgba(255,0,0,.35)':'rgba(255,255,0,.9)'};z-index:999;color:#fff;font:11px sans-serif`;if(x%10==0)l.textContent=x;r.append(l)}
 for(let y=0;y<=100;y+=2){const l=document.createElement('div');l.style.cssText=`position:absolute;top:${y}%;left:0;right:0;border-top:1px solid ${y%10?'rgba(255,0,0,.35)':'rgba(255,255,0,.9)'};z-index:999;color:#fff;font:11px sans-serif`;if(y%10==0)l.textContent=y;r.append(l)}
 document.querySelectorAll('.label,.actor,.flick').forEach(e=>e.style.display='none');document.querySelector('.overlays').style.display='none'});
await p.waitForTimeout(300);
const bb=await p.$eval('#room',e=>{const q=e.getBoundingClientRect();return {x:q.x,y:q.y,w:q.width,h:q.height}});console.log(bb);
await p.screenshot({path:path.resolve(__dirname,'../shots/gridL.png'),clip:{x:bb.x,y:bb.y,width:bb.w*0.52,height:bb.h*0.66}});
await p.screenshot({path:path.resolve(__dirname,'../shots/gridR.png'),clip:{x:bb.x+bb.w*0.3,y:bb.y,width:bb.w*0.5,height:bb.h*0.6}});
await b.close()})()
