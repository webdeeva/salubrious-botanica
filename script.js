const hero=document.querySelector('.hero');
const stage=document.querySelector('.hero-stage');
const layers=[...document.querySelectorAll('.layer')];
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
const ns='http://www.w3.org/2000/svg';
const wires=document.createElementNS(ns,'svg');wires.classList.add('hero-wires');wires.setAttribute('aria-hidden','true');stage.prepend(wires);
const attachments=[...stage.querySelectorAll('.shell')].map(shell=>{const anchor=document.createElement('span');anchor.className='wire-anchor';shell.append(anchor);const line=document.createElementNS(ns,'line');wires.append(line);return {shell,anchor,line};});
function syncWires(){const rect=stage.getBoundingClientRect();const mobile=window.matchMedia('(max-width: 700px)').matches;const heroGap=rect.top-hero.getBoundingClientRect().top;stage.style.setProperty('--hero-gap',heroGap+'px');wires.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);attachments.forEach(({shell,anchor,line})=>{const tip=anchor.getBoundingClientRect();line.setAttribute('x1',shell.offsetLeft+shell.offsetWidth*.5777);line.setAttribute('y1',mobile?-heroGap:0);line.setAttribute('x2',tip.left-rect.left);line.setAttribute('y2',tip.top-rect.top+1);line.style.opacity=shell.style.opacity||'1';});}
const finePointer=window.matchMedia('(hover: hover) and (pointer: fine)');
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const depthMap={palm:.25,column:.3,slab:.2,pedestal:.35,vase:.5,ring:.65,monstera:.9,'trailing-plant':.6,orb:.75,'gold-sphere':1,bottle:.55,journal:.6,shell:.8};
const depth=layers.map(el=>Object.entries(depthMap).find(([name])=>el.classList.contains(name))?.[1]??.5);
let frame=0,lastTime=0,assemblyStart=null;
const target={x:0,y:0,scroll:0},current={x:0,y:0,scroll:0};
function setLayer(el,x,y,r){el.style.setProperty('--tx',x+'px');el.style.setProperty('--ty',y+'px');el.style.setProperty('--rot',r+'deg');}
function requestMotion(){if(!frame&&!reduce.matches)frame=requestAnimationFrame(renderMotion);}
function resetMotion(){cancelAnimationFrame(frame);frame=0;lastTime=0;assemblyStart=null;target.x=target.y=target.scroll=current.x=current.y=current.scroll=0;layers.forEach(el=>{setLayer(el,0,0,0);el.style.opacity=1;});syncWires();}
function readScroll(){target.scroll=clamp(-hero.getBoundingClientRect().top/hero.offsetHeight,0,1);requestMotion();}
function renderMotion(time){frame=0;if(reduce.matches){resetMotion();return;}const dt=lastTime?Math.min(time-lastTime,64):16.7;lastTime=time;const blend=1-Math.exp(-dt/95);for(const axis of ['x','y','scroll'])current[axis]+=(target[axis]-current[axis])*blend;
 const spread=clamp((current.scroll-.45)/.55,0,1);let assembling=false;
 layers.forEach((el,i)=>{const d=depth[i];let remaining=0;if(assemblyStart!==null){const p=clamp((time-assemblyStart-i*45)/850,0,1);remaining=Math.pow(1-p,3);if(p<1)assembling=true;el.style.opacity=1-remaining;}else el.style.opacity=1;
 const size=Math.min(1,stage.clientWidth/700);
 const x=Number(el.dataset.x)*(remaining+spread*.22)+current.x*22*d*size;
 const y=Number(el.dataset.y)*(remaining+spread*.24)+current.y*15*d*size-current.scroll*32*d*size;
 const rotation=Number(el.dataset.r)*(remaining+spread*.16)+current.x*d*1.5;
 setLayer(el,x,y,rotation);});syncWires();if(!assembling)assemblyStart=null;
 const settling=['x','y','scroll'].some(k=>Math.abs(target[k]-current[k])>.001);
 if(assembling||settling)requestMotion();else lastTime=0;
}
function assembly(){if(reduce.matches){resetMotion();return;}assemblyStart=performance.now();readScroll();requestMotion();}
hero.addEventListener('pointermove',event=>{if(reduce.matches||!finePointer.matches||event.pointerType==='touch')return;const rect=hero.getBoundingClientRect();target.x=clamp((event.clientX-rect.left)/rect.width*2-1,-1,1);target.y=clamp((event.clientY-rect.top)/rect.height*2-1,-1,1);requestMotion();},{passive:true});
function centerPointer(){target.x=target.y=0;requestMotion();}
hero.addEventListener('pointerleave',centerPointer);
hero.addEventListener('pointercancel',centerPointer);
finePointer.addEventListener('change',centerPointer);
window.addEventListener('blur',centerPointer);
window.addEventListener('scroll',readScroll,{passive:true});
new ResizeObserver(()=>{syncWires();readScroll();}).observe(stage);
window.addEventListener('resize',()=>{syncWires();readScroll();});
document.querySelector('.replay').addEventListener('click',assembly);

Promise.all([...stage.querySelectorAll('img')].map(img=>img.decode().catch(()=>{}))).then(()=>{syncWires();assembly();});
reduce.addEventListener('change',()=>{if(reduce.matches)resetMotion();else readScroll();});
