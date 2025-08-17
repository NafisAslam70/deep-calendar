export const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export const toMinutes = (t) => { const [h,m] = String(t).split(":").map(Number); return h*60 + m; };
export const fromMinutes = (m) => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
export const overlaps = (aS,aE,bS,bE) => Math.max(aS,bS) < Math.min(aE,bE);

export const ymd = (d) => {
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yy}-${mm}-${dd}`;
};
