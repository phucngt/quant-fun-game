const { chromium } = require('playwright'); const path=require('path');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.addInitScript(()=>{window.QF_FAST=true});
await p.goto('file://'+path.resolve(__dirname,'../out/download/quant-fun.html'));
await p.waitForSelector('#title:not([hidden])');await p.click('#deploy');await p.waitForSelector('#messages .msg');
await p.evaluate(()=>{const r=document.getElementById('room');
 for(let x=0;x<=100;x+=5){const l=document.createElement('div');l.style.cssText=`position:absolute;left:${x}%;top:0;bottom:0;border-left:1px solid ${x%10?'rgba(255,0,0,.3)':'rgba(255,255,0,.7)'};z-index:999;color:#fff;font:10px sans-serif`;if(x%10==0)l.textContent=x;r.append(l)}
 for(let y=0;y<=100;y+=5){const l=document.createElement('div');l.style.cssText=`position:absolute;top:${y}%;left:0;right:0;border-top:1px solid ${y%10?'rgba(255,0,0,.3)':'rgba(255,255,0,.7)'};z-index:999;color:#fff;font:10px sans-serif`;if(y%10==0)l.textContent=y;r.append(l)}
 document.querySelectorAll('.label,.actor').forEach(e=>e.style.display='none')});
await p.locator('#room').screenshot({path:path.resolve(__dirname,'../shots/grid.png')});await b.close()})()
