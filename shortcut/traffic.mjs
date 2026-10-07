// A separate, inspectable model keeps the story's numbers honest.
// A=start, C=upper junction, D=lower junction, B=destination.
export const DEMAND = 4000;
export const FIXED_MINUTES = 45;
export const BOTTLENECK_DIVISOR = 100;
export const ROUTES = {upper:['AC','CB'],lower:['AD','DB'],shortcut:['AC','CD','DB']};
export function trafficState(shortcutShare = 0, open = false) {
  if(!Number.isFinite(shortcutShare)||shortcutShare<0||shortcutShare>1)throw new RangeError('Share must be within [0, 1]');
  const via=DEMAND*shortcutShare,upper=(DEMAND-via)/2,lower=upper;
  const loads={AC:upper+via,CB:upper,AD:lower,DB:lower+via,CD:via};
  const costs={AC:loads.AC/BOTTLENECK_DIVISOR,CB:FIXED_MINUTES,AD:FIXED_MINUTES,DB:loads.DB/BOTTLENECK_DIVISOR,CD:0};
  const routeCosts={upper:costs.AC+costs.CB,lower:costs.AD+costs.DB,shortcut:open?costs.AC+costs.CD+costs.DB:null};
  const average=(upper*routeCosts.upper+lower*routeCosts.lower+via*(costs.AC+costs.DB))/DEMAND;
  return {demand:DEMAND,open,shortcutShare,flow:{upper,lower,shortcut:via},loads,costs,routeCosts,average};
}
const smooth=(a,b,t)=>{const p=Math.max(0,Math.min(1,(t-a)/(b-a)));return p*p*(3-2*p);};
export function trafficAt(time) {
  const t=Math.max(0,Math.min(60,time));
  let share=0,phase='before',open=false;
  if(t>=15&&t<22.5){open=true;phase='available';}
  else if(t>=22.5&&t<30){open=true;share=smooth(22.5,30,t);phase='converging';}
  else if(t>=30&&t<41.25){open=true;share=1;phase='bad-equilibrium';}
  else if(t>=41.25&&t<45){share=1-smooth(41.25,45,t);phase='redistributing';}
  else if(t>=45){phase='restored';}
  return {...trafficState(share,open),phase,equilibrium:phase==='before'||phase==='bad-equilibrium'||phase==='restored'};
}
export function assertTrafficModel() {
  const before=trafficState(0,false),after=trafficState(1,true),restored=trafficAt(45);
  if(before.average!==65||after.average!==80||restored.average!==65)throw new Error('Braess equilibrium contract changed');
  if(after.routeCosts.upper!==85||after.routeCosts.lower!==85)throw new Error('A lone alternate-route choice must not become a faster escape');
  return {before,after,restored};
}