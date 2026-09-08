// Height is shared by geometry, actors, camera and sight tests.
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
function boundary(points,u){
  if(u<=points[0][0])return points[0][1];
  for(let i=1;i<points.length;i++)if(u<=points[i][0]){
    const [a,av]=points[i-1],[b,bv]=points[i];return av+(bv-av)*smooth((u-a)/(b-a));
  }
  return points.at(-1)[1];
}
export function elevationFor(maze){
  const e=maze.presentation?.elevation;
  if(e?.profile==='plateau-descent'){
    // Borders use original drawing coordinates: u runs along the diagonal,
    // v crosses from the raised office floor towards the fallen buildings.
    const sample=(px,pz)=>{
      const sx=(px/maze.cellSize+maze.width/2)*maze.sourceStep,sy=(pz/maze.cellSize+maze.height/2)*maze.sourceStep,u=sx-sy,v=sx+sy;
      const red=boundary(e.upperBoundary,u),blue=boundary(e.lowerBoundary,u),t=(v-red)/(blue-red);
      const tail=Math.max(0,v-blue)*maze.cellSize/maze.sourceStep/Math.SQRT2;
      return {height:e.upperHeight-e.drop*smooth(t)-e.lowerGrade*tail*smooth(tail/4),progress:clamp(t)};
    };
    return {x:0,z:0,offset:e.upperHeight,nonlinear:true,heightAt:(x,z)=>sample(x,z).height,progressAt:(x,z)=>sample(x,z).progress};
  }
  const x=e?-(e.drop*e.direction[0])/(maze.width*maze.cellSize):0;
  const z=e?-(e.drop*e.direction[1])/(maze.height*maze.cellSize):0;
  const offset=e?.offset||0;
  return {x,z,offset,nonlinear:false,heightAt:(px,pz)=>offset+x*px+z*pz};
}
export function inPolygon(x,y,points){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [ax,ay]=points[i],[bx,by]=points[j];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}
export function propAt(maze,x,y){
  return (maze.presentation?.solidProps||[]).findIndex(p=>inPolygon((x+.5)*maze.sourceStep,(y+.5)*maze.sourceStep,p.polygon));
}
