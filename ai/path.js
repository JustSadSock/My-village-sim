export function pathStep(sx, sy, tx, ty, world) {
  const { MAP_W, MAP_H, tiles } = world;
  const visited = new Set();
  const queue = [];
  queue.push({x:sx,y:sy,prev:null});
  visited.add(sx+","+sy);
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  function passable(x,y){
    if(x<0||x>=MAP_W||y<0||y>=MAP_H) return false;
    return tiles[y*MAP_W+x]!==1;
  }
  let end=null;
  let idx=0;
  while(idx<queue.length){
    const cur=queue[idx++];
    if(cur.x===tx&&cur.y===ty){end=cur;break;}
    for(const[dx,dy]of dirs){
      const nx=cur.x+dx, ny=cur.y+dy;
      const key=nx+","+ny;
      if(!passable(nx,ny)||visited.has(key)) continue;
      visited.add(key);
      queue.push({x:nx,y:ny,prev:idx-1});
    }
  }
  if(!end) return {x:sx,y:sy};
  let node=end;
  while(node.prev!==null&&!(queue[node.prev].x===sx&&queue[node.prev].y===sy)){
    node=queue[node.prev];
  }
  return {x:node.x,y:node.y};
}
