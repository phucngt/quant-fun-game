/* Room navigation. Build-time floor grid is the only source of walkable space. */
(() => {
  'use strict';
  class Navigation {
    constructor(data) {
      this.data = data; this.nodes = {}; this.edges = []; this.adj = {};
      for (let y = 0; y < data.rows; y++) for (let x = 0; x < data.cols; x++) {
        if (data.mask[y][x] === '1') this.nodes[y * data.cols + x] = this.point(x,y);
      }
      for (const [key,p] of Object.entries(this.nodes)) {
        const id = +key, x = id % data.cols, y = Math.floor(id / data.cols);
        this.adj[id] = [];
        for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
          const q = (y+dy)*data.cols+x+dx;
          if (!this.nodes[q] || x+dx < 0 || x+dx >= data.cols) continue;
          if (dx && dy && (!this.nodes[y*data.cols+x+dx] || !this.nodes[(y+dy)*data.cols+x])) continue;
          if (this.segmentClear(p,this.nodes[q])) {
            this.adj[id].push(q); if (id < q) this.edges.push([String(id),String(q)]);
          }
        }
      }
    }
    point(x,y) { const d=this.data; return [(x+.5)*d.stepPixels/d.width*100,(y+.5)*d.stepPixels/d.height*100]; }
    distance(a,b) { const d=this.data; return Math.hypot((a[0]-b[0])*d.width/100,(a[1]-b[1])*d.height/100)/d.tilePixels; }
    cell(p) { const d=this.data; return [Math.floor(p[0]*d.width/100/d.stepPixels),Math.floor(p[1]*d.height/100/d.stepPixels)]; }
    contains(p) { const [x,y]=this.cell(p),d=this.data; return x>=0 && y>=0 && x<d.cols && y<d.rows && d.mask[y][x]==='1'; }
    pointSegmentDistance(p,a,b) {
      const d=this.data, sx=d.width/100/d.tilePixels, sy=d.height/100/d.tilePixels;
      const dx=(b[0]-a[0])*sx,dy=(b[1]-a[1])*sy,px=(p[0]-a[0])*sx,py=(p[1]-a[1])*sy;
      const t=dx*dx+dy*dy ? Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy))) : 0;
      return Math.hypot(px-t*dx,py-t*dy);
    }
    segmentClear(a,b,blocks=[]) {
      const n=Math.max(1,Math.ceil(this.distance(a,b)/.125));
      for (let i=0;i<=n;i++) if (!this.contains([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n])) return false;
      return blocks.every(o=>this.pointSegmentDistance(o.point,a,b)>=o.radius);
    }
    path(start,goal,blocks=[]) {
      if (!this.contains(start) || !this.contains(goal)) return null;
      if (this.segmentClear(start,goal,blocks)) return [goal];
      const [gx,gy]=this.cell(goal),target=gy*this.data.cols+gx;
      const [sx,sy]=this.cell(start), candidates=[];
      // Connect an interrupted walk from its real feet, never via a hand waypoint.
      for (let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) {
        const x=sx+dx,y=sy+dy,k=y*this.data.cols+x,p=this.nodes[k];
        if(x>=0 && x<this.data.cols && p && this.segmentClear(start,p,blocks)) candidates.push(k);
      }
      const heap=[],cost=new Map(),prev=new Map(),closed=new Set();
      const push=(k,f)=>{let i=heap.length;heap.push({k,f});while(i){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]={k,f};};
      const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].f<heap[j].f)j++;if(heap[j].f>=last.f)break;heap[i]=heap[j];i=j;}heap[i]=last;}return first.k;};
      for(const k of candidates){const c=this.distance(start,this.nodes[k]);cost.set(k,c);prev.set(k,null);push(k,c+this.distance(this.nodes[k],goal));}
      const blocked=new Map();
      const allowed=k=>{if(!blocked.has(k))blocked.set(k,blocks.every(o=>this.distance(this.nodes[k],o.point)>=o.radius));return blocked.get(k);};
      while(heap.length){
        const k=pop(); if(closed.has(k))continue; closed.add(k);
        if(k===target){
          const raw=[goal];let n=k;while(n!=null){raw.unshift(this.nodes[n]);n=prev.get(n);}
          const out=[];let anchor=start,i=0;
          while(i<raw.length){let j=i;while(j+1<raw.length && this.segmentClear(anchor,raw[j+1],blocks))j++;if(!this.segmentClear(anchor,raw[j],blocks))return null;out.push(raw[j]);anchor=raw[j];i=j+1;}
          return out;
        }
        for(const n of this.adj[k]){
          if(closed.has(n)||!allowed(n)||!this.segmentClear(this.nodes[k],this.nodes[n],blocks))continue;
          const c=cost.get(k)+this.distance(this.nodes[k],this.nodes[n]);
          if(!cost.has(n)||c<cost.get(n)){cost.set(n,c);prev.set(n,k);push(n,c+this.distance(this.nodes[n],goal));}
        }
      }
      return null; // Unreachable means wait/replan; never cut across furniture.
    }
  }
  if(typeof module!=='undefined' && module.exports) module.exports=Navigation;
  else window.QFNavigation=Navigation;
})();
