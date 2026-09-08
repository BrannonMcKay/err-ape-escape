import {propAt} from './elevation.js';
export const GRAFFITI_STYLE=32, GRAFFITI_WALL_HEIGHT=2.8;
// Appearance is independent of navigation: low stone and glass remain solid obstacles.
const inRegion=(x,y,[rx,ry,w,h])=>x>=rx&&y>=ry&&x<rx+w&&y<ry+h;
export function createWallStyles(maze){
  const {width:w,height:h,rows}=maze,p=maze.presentation||{},styles=new Uint8Array(w*h);
  const open=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&rows[y][x]==='.';
  function passage(x,y,dx,dy){for(let d=1;d<=8;d++)if(open(x+dx*d,y+dy*d))return true;return false;}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(rows[y][x]!=='#')continue;
    if(maze.id==='pound-town'){
      const prop=propAt(maze,x,y);
      const paintedWall=p.graffiti?.some(g=>x===g.cell[0]&&Math.abs(y-g.cell[1])<=7);
      styles[y*w+x]=prop>=0?3+prop:paintedWall?GRAFFITI_STYLE:p.windowRegions?.some(r=>inRegion(x,y,r))?2:1;continue;
    }
    const thin=(passage(x,y,-1,0)&&passage(x,y,1,0))||(passage(x,y,0,-1)&&passage(x,y,0,1));
    if(!thin)continue;
    if(p.lowWallRegions?.some(r=>inRegion(x,y,r)))styles[y*w+x]=1;
    if(p.windowRegions?.some(r=>inRegion(x,y,r)))styles[y*w+x]=2;
    if(p.graffiti?.some(g=>Math.abs(x-g.cell[0])<2&&Math.abs(y-g.cell[1])<4))styles[y*w+x]=0;
  }
  return styles;
}
export function opaqueAt(maze,styles,x,y,z){
  const i=maze.index(x,z);if(i<0)return true;
  if(maze.rows[Math.floor(i/maze.width)][i%maze.width]===' ')return false;
  if(y<(maze.heightAt?.(x,z)||0)-.08)return true;
  if(maze.walk[i])return false;
  const heights=maze.presentation?.wallHeights||{tall:3.4,low:1.05,sill:.65,lintel:2.75};
  y-=maze.heightAt?.(x,z)||0;
  if(styles[i]===GRAFFITI_STYLE)return y<=GRAFFITI_WALL_HEIGHT;
  if(styles[i]>=3)return y<=maze.presentation.solidProps[styles[i]-3].height;
  if(styles[i]===1)return y<=heights.low;
  if(styles[i]===2)return y<=heights.sill||(y>=heights.lintel&&y<=heights.tall);
  return y<=heights.tall;
}
export function sightClear(maze,styles,a,b,eyeHeight=1.6){
  const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.12));
  const ay=(maze.heightAt?.(a.x,a.z)||0)+eyeHeight,by=(maze.heightAt?.(b.x,b.z)||0)+eyeHeight;
  for(let i=0;i<=steps;i++){const t=i/steps;if(opaqueAt(maze,styles,a.x+(b.x-a.x)*t,ay+(by-ay)*t,a.z+(b.z-a.z)*t))return false;}
  return true;
}
