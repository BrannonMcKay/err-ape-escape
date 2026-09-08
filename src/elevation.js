// A continuous incline, shared by rendering, actors, camera and sight tests.
export function elevationFor(maze){
  const e=maze.presentation?.elevation;
  const x=e?-(e.drop*e.direction[0])/(maze.width*maze.cellSize):0;
  const z=e?-(e.drop*e.direction[1])/(maze.height*maze.cellSize):0;
  const offset=e?.offset||0;
  return {x,z,offset,heightAt:(px,pz)=>offset+x*px+z*pz};
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
