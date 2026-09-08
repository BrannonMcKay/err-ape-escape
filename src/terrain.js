const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function mountainWeights(u,v,theme){
  let snow=0;
  for(const [center,line,width] of theme.snowCaps){
    const edge=line+Math.sin(u*85)*.004+Math.sin(u*33)*.007;
    snow=Math.max(snow,(1-smooth(edge-.015,edge+.015,v))*(1-smooth(width-.025,width,Math.abs(u-center))));
  }
  const green=smooth(...theme.greenTransition,v);
  return {snow,green,autumn:1-green};
}
export function terrainAt(maze,x,z){
  const theme=maze.presentation?.theme;
  if(theme?.id==='snowman-winter')return winterWeights(x/(maze.width*maze.cellSize)+.5,z/(maze.height*maze.cellSize)+.5,theme);
  if(theme?.id!=='mountain-seasons')return {name:maze.name,snow:0,green:0,autumn:0};
  const w=mountainWeights(x/(maze.width*maze.cellSize)+.5,z/(maze.height*maze.cellSize)+.5,theme);
  return {...w,name:w.snow>.5?'Snowy summits':w.green>.7?'Green foothills':w.green>.2?'Turning woodland':'Autumn heights'};
}
export function winterWeights(u,v,theme){
  let closest=Infinity,ball=0;
  theme.snowballs.forEach(([x,y,rx,ry],i)=>{const d=Math.hypot((u-x)/rx,(v-y)/ry);if(d<closest){closest=d;ball=i;}});
  const ice=1-smooth(.18,.79,closest);
  const carrot=u>.493&&v<.327;
  return {ice:carrot?0:ice,snow:carrot?0:1-ice,carrot,name:carrot?'Carrot point':`${['Snowman’s head','Middle snowball','Lower snowball'][ball]} · ${ice>.5?'blue ice':'snow'}`};
}
