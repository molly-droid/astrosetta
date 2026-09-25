/**
 * chartCalculator — Single source of truth for all astrological chart calculations.
 *
 * ARCHITECTURE NOTE: All chart math lives in this function.
 * recalcAllCharts calls this via base44.asServiceRole.functions.invoke('chartCalculator').
 * Never duplicate houseCusps / buildChart logic in other functions.
 *
 * ASC disambiguation: RA-based (pick candidate whose RA ≈ RAMC+90°).
 * MC disambiguation: pick candidate whose RA ≈ RAMC (upper meridian).
 */
import { json, handleOptions, getAuthUser, isServiceRole } from '../_shared/edge.ts';
import { trueNode } from '../_shared/lunarNode.ts';

const D2R=Math.PI/180,R2D=180/Math.PI;
const LOT_NAMES=new Set(['Part of Fortune','Part of Spirit','Part of Eros','Part of Necessity','Tyche','Juno','Pallas','Vesta']);
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const ELEMENTS={Aries:'Fire',Leo:'Fire',Sagittarius:'Fire',Taurus:'Earth',Virgo:'Earth',Capricorn:'Earth',Gemini:'Air',Libra:'Air',Aquarius:'Air',Cancer:'Water',Scorpio:'Water',Pisces:'Water'};
const MODALITIES={Aries:'Cardinal',Cancer:'Cardinal',Libra:'Cardinal',Capricorn:'Cardinal',Taurus:'Fixed',Leo:'Fixed',Scorpio:'Fixed',Aquarius:'Fixed',Gemini:'Mutable',Virgo:'Mutable',Sagittarius:'Mutable',Pisces:'Mutable'};
const ASPECTS=[{name:'conjunction',angle:0,orb:8},{name:'opposition',angle:180,orb:8},{name:'trine',angle:120,orb:7},{name:'square',angle:90,orb:7},{name:'sextile',angle:60,orb:5},{name:'quincunx',angle:150,orb:3},{name:'semisextile',angle:30,orb:2},{name:'semisquare',angle:45,orb:2},{name:'sesquisquare',angle:135,orb:2}];
const TZ={'UTC':0,'GMT':0,'America/New_York':-5,'America/Chicago':-6,'America/Denver':-7,'America/Los_Angeles':-8,'America/Anchorage':-9,'America/Honolulu':-10,'America/Sao_Paulo':-3,'America/Toronto':-5,'America/Mexico_City':-6,'America/Vancouver':-8,'Europe/London':0,'Europe/Paris':1,'Europe/Berlin':1,'Europe/Rome':1,'Europe/Madrid':1,'Europe/Amsterdam':1,'Europe/Zurich':1,'Europe/Helsinki':2,'Europe/Athens':2,'Europe/Istanbul':3,'Europe/Moscow':3,'Asia/Jerusalem':2,'Asia/Dubai':4,'Asia/Kolkata':5.5,'Asia/Bangkok':7,'Asia/Singapore':8,'Asia/Shanghai':8,'Asia/Tokyo':9,'Asia/Seoul':9,'Australia/Sydney':10,'Pacific/Auckland':12,'Africa/Cairo':2,'Africa/Johannesburg':2};
const KE={Mercury:[[0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593],[0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081]],Venus:[[0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255],[0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418]],Earth:[[1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0.0],[0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0.0]],Mars:[[1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],[0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343]],Jupiter:[[5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909],[-0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106]],Saturn:[[9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448],[-0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794]],Uranus:[[19.18916464,0.04725744,0.77263783,313.23810451,170.95427630,74.01692503],[-0.00196176,-0.00004397,-0.00242939,428.48202785,0.40805281,0.04240589]],Neptune:[[30.06992276,0.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],[0.00026291,0.00005105,0.00035372,218.45945325,-0.32241464,-0.00508664]],Pluto:[[39.48211675,0.24882730,17.14001206,238.92903833,224.06891629,110.30393684],[-0.00031596,0.00005170,0.00004818,145.20780515,-0.04062942,-0.01183482]]};
const KE_EX={Jupiter:[-0.00012452,0.06064060,-0.35635438,38.35125000],Saturn:[0.00025899,-0.13434469,0.87320147,38.35125000],Uranus:[0.00058331,-0.97731848,0.17689245,7.67025000],Neptune:[-0.00041348,0.68346318,-0.10162547,7.67025000],Pluto:[-0.01262724,0,0,0]};
const MOON_L=[[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],[0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],[2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],[2,0,-1,2,-2602],[2,-1,-2,0,2390],[1,0,1,0,-2348],[2,-2,0,0,2236],[0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],[2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],[3,0,-1,0,-892],[2,1,1,0,-810],[4,-1,-2,0,759],[0,2,-1,0,-713],[2,2,-1,0,-700],[2,1,-2,0,691],[2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],[4,-1,0,0,520],[1,0,-2,0,-487],[2,1,0,-2,-399],[0,0,2,-2,-381],[1,1,1,0,351],[3,0,-2,0,-340],[4,0,-3,0,330],[2,-1,2,0,327],[0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294],[2,0,-1,-2,0]];

// ── Math helpers ──────────────────────────────────────────────────────────────
function n360(d){return((d%360)+360)%360;}
function sd(d){return Math.sin(d*D2R);}
function cd(d){return Math.cos(d*D2R);}
function td(d){return Math.tan(d*D2R);}
function at2(y,x){return Math.atan2(y,x)*R2D;}
function r4(n){return Math.round(n*10000)/10000;}
function si(lon){const l=n360(lon),sg=SIGNS[Math.floor(l/30)];return{sign:sg,degree:r4(l%30),longitude:r4(l),element:ELEMENTS[sg],modality:MODALITIES[sg]};}

// ── Time ──────────────────────────────────────────────────────────────────────
function jd(y,mo,d,hut){let yr=y,m=mo;if(m<=2){yr--;m+=12;}const A=Math.floor(yr/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(yr+4716))+Math.floor(30.6001*(m+1))+d+hut/24+B-1524.5;}
function dT(yr){if(yr<1986){const t=yr-1975;return 45.45+1.067*t-t*t/260-t*t*t/718;}if(yr<2005){const t=yr-2000;return 63.86+0.3345*t-0.060374*t*t+0.0017275*t*t*t+0.000651814*Math.pow(t,4);}const t=yr-2000;return 62.92+0.32217*t+0.005589*t*t;}
function toJDE(ds,ts,tz){const[y,mo,d]=ds.split('-').map(Number);const[h,mi,s]=(ts||'12:00:00').split(':').map(n=>parseInt(n)||0);const utH=(h+mi/60+s/3600)-tz;const J=jd(y,mo,d,utH);return J+dT(y+(mo-1)/12)/86400;}
function isoToJDE(iso){const dt=new Date(iso);const JD=dt.getTime()/86400000+2440587.5;const yr=dt.getUTCFullYear()+dt.getUTCMonth()/12;return JD+dT(yr)/86400;}

// ── Astronomy ─────────────────────────────────────────────────────────────────
function obliq(T){const U=T/100;return 23+26/60+21.448/3600+(-4680.93*U-1.55*U*U+1999.25*U*U*U-51.38*Math.pow(U,4)-249.67*Math.pow(U,5)-39.05*Math.pow(U,6)+7.12*Math.pow(U,7)+27.87*Math.pow(U,8)+5.79*Math.pow(U,9)+2.45*Math.pow(U,10))/3600;}
function nutat(T){const om=n360(125.04452-1934.136261*T+0.0020708*T*T),L0=n360(280.4665+36000.7698*T),Lp=n360(218.3165+481267.8813*T);return{dpsi:((-17.20-0.01742*T)*sd(om)-1.32*sd(2*L0)-0.23*sd(2*Lp)+0.21*sd(2*om))/3600,deps:((9.20+0.00089*T)*cd(om)+0.57*cd(2*L0)+0.10*cd(2*Lp)-0.09*cd(2*om))/3600};}
function gmst(JD){const T=(JD-2451545)/36525;return n360(280.46061837+360.98564736629*(JD-2451545)+0.000387933*T*T-T*T*T/38710000);}
function sunLon(T){const L0=n360(280.46646+36000.76983*T+0.0003032*T*T),M=n360(357.52911+35999.05029*T-0.0001537*T*T+T*T*T/24490000),C=(1.914602-0.004817*T-0.000014*T*T)*sd(M)+(0.019993-0.000101*T)*sd(2*M)+0.000289*sd(3*M);return n360(L0+C+nutat(T).dpsi-0.00569);}
function moonLon(T){const Lp=n360(218.3164477+481267.88123421*T-0.0015786*T*T+T*T*T/538841-Math.pow(T,4)/65194000),D=n360(297.8501921+445267.1114034*T-0.0018819*T*T+T*T*T/545868-Math.pow(T,4)/113065000),M=n360(357.5291092+35999.0502909*T-0.0001536*T*T+T*T*T/24490000),Mp=n360(134.9633964+477198.8675055*T+0.0087414*T*T+T*T*T/69699-Math.pow(T,4)/14712000),F=n360(93.2720950+483202.0175233*T-0.0036539*T*T-T*T*T/3526000+Math.pow(T,4)/863310000),E=1-0.002516*T-0.0000074*T*T,A1=n360(119.75+131.849*T),A2=n360(53.09+479264.290*T);let sL=0;for(const[td2,tm,tmp,tf,cl]of MOON_L){let e=1;if(Math.abs(tm)===1)e=E;if(Math.abs(tm)===2)e=E*E;sL+=e*cl*sd(td2*D+tm*M+tmp*Mp+tf*F);}sL+=3958*sd(A1)+1962*sd(Lp-F)+318*sd(A2);return n360(Lp+sL/1000000+nutat(T).dpsi);}
function kepH(nm,T){const[els,rates]=KE[nm],[a,e,I,L,wb,Om]=els.map((v,i)=>v+rates[i]*T);let M=L-wb;const ex=KE_EX[nm];if(ex){const[b,c,s,f]=ex;M+=b*T*T+c*cd(f*T)+s*sd(f*T);}M=((M%360)+360)%360;if(M>180)M-=360;const w=wb-Om;let E=M+R2D*e*sd(M);for(let i=0;i<15;i++){const dM=M-(E-R2D*e*sd(E)),dE=dM/(1-e*cd(E));E+=dE;if(Math.abs(dE)<1e-8)break;}const xp=a*(cd(E)-e),yp=a*Math.sqrt(1-e*e)*sd(E),cw=cd(w),sw=sd(w),cO=cd(Om),sO=sd(Om),cI=cd(I);return{x:(cw*cO-sw*sO*cI)*xp+(-sw*cO-cw*sO*cI)*yp,y:(cw*sO+sw*cO*cI)*xp+(-sw*sO+cw*cO*cI)*yp};}
function kepGeo(nm,T){const p=kepH(nm,T),e=kepH('Earth',T);return n360(at2(p.y-e.y,p.x-e.x));}
function chironLon(jde) {
  const T = (jde - 2451545.0) / 36525.0;
  const a  = 13.648;
  const e  = 0.3833;
  const I  = 6.928;
  const Om = 209.354;  // longitude of ascending node (J2000)
  const w  = 339.169;  // argument of perihelion (J2000)
  const M0 = 27.68;    // mean anomaly at J2000 (from JPL osculating elements)
  const n  = 0.019547; // mean daily motion (°/day)

  let M = n360(M0 + n * (jde - 2451545.0));

  let E = M + R2D * e * sd(M);
  for (let i = 0; i < 50; i++) {
    const dM = M - (E - R2D * e * sd(E));
    const dE = dM / (1 - e * cd(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }

  const xp = a * (cd(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * sd(E);

  const cw = cd(w), sw = sd(w), cO = cd(Om), sO = sd(Om), cI = cd(I);
  const xh = (cw*cO - sw*sO*cI)*xp + (-sw*cO - cw*sO*cI)*yp;
  const yh = (cw*sO + sw*cO*cI)*xp + (-sw*sO + cw*cO*cI)*yp;

  const earth = kepH('Earth', T);
  return n360(at2(yh - earth.y, xh - earth.x));
}
function bmlLon(T) {
  // Mean Black Moon Lilith = mean lunar apogee (Meeus, Astronomical Algorithms ch.22)
  const D  = n360(297.8501921 + 445267.1114034*T - 0.0018819*T*T + T*T*T/545868);
  const M  = n360(357.5291092 + 35999.0502909*T  - 0.0001536*T*T);
  const Mp = n360(134.9633964 + 477198.8675055*T  + 0.0087414*T*T + T*T*T/69699);
  const F  = n360(93.2720950  + 483202.0175233*T  - 0.0036539*T*T - T*T*T/3526000);
  const meanPerigee = n360(83.3532465 + 4069.0137287*T - 0.0103200*T*T - T*T*T/80053 + T*T*T*T/18999000);
  const corr =
    + 0.4392 * sd(Mp)
    + 0.0684 * sd(2*Mp)
    - 0.0456 * sd(D)
    + 0.0426 * sd(2*D - Mp)
    - 0.0312 * sd(2*D)
    + 0.0212 * sd(2*Mp - 2*D)
    - 0.0190 * sd(M)
    + 0.0176 * sd(Mp + M)
    - 0.0133 * sd(Mp - 2*D)
    - 0.0112 * sd(2*D + Mp)
    + 0.0100 * sd(2*D - M - Mp)
    + 0.0089 * sd(2*D - 2*Mp)
    - 0.0076 * sd(Mp - M)
    - 0.0069 * sd(2*F)
    + 0.0063 * sd(2*D + M - Mp);
  // BML = apogee = perigee + 180°
  return n360(meanPerigee + corr + 180);
}
function tycheLon(jde) {
  // Asteroid 258 Tyche — osculating elements (JPL, epoch 2026-Jun-09, J2000 ecliptic),
  // propagated with mean daily motion (same approximation approach as chironLon).
  const T = (jde - 2451545.0) / 36525.0;
  const a  = 2.614922417994044;
  const e  = 0.2047456339452305;
  const I  = 14.32517158673729;
  const Om = 207.5339974603896;                       // longitude of ascending node
  const w  = 155.3126023696044 - 207.5339974603896;   // argument of perihelion = ϖ − Ω
  const n  = 0.2330858241839263;                      // mean daily motion (°/day)
  const M0 = 276.5438822372059;                       // mean anomaly at epoch JD 2461200.5
  const EPOCH = 2461200.5;
  let M = n360(M0 + n * (jde - EPOCH));
  let E = M + R2D * e * sd(M);
  for (let i = 0; i < 50; i++) {
    const dM = M - (E - R2D * e * sd(E));
    const dE = dM / (1 - e * cd(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  const xp = a * (cd(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * sd(E);
  const cw = cd(w), sw = sd(w), cO = cd(Om), sO = sd(Om), cI = cd(I);
  const xh = (cw*cO - sw*sO*cI)*xp + (-sw*cO - cw*sO*cI)*yp;
  const yh = (cw*sO + sw*cO*cI)*xp + (-sw*sO + cw*cO*cI)*yp;
  const earth = kepH('Earth', T);
  return n360(at2(yh - earth.y, xh - earth.x));
}

// ── Asteroids (JPL osculating elements, epoch JD 2461200.5, J2000 ecliptic) ──
const ASTEROIDS = {
  Juno:   { a: 2.670989527103278, e: 0.2556999836681878, I: 12.98659236598085, Om: 169.8115953492418, w: 247.8950743075613, M0: 262.7322944883855, n: 0.2257853690721904 },
  Pallas: { a: 2.769559010737709, e: 0.2307000995648547, I: 34.93279321851542, Om: 172.8866193357694, w: 310.9699161652136, M0: 254.2496521742734, n: 0.2138396029251949 },
  Vesta:  { a: 2.361365965127599, e: 0.09020374382834395, I: 7.143925545058711, Om: 103.701293265032, w: 151.4686478221564, M0: 81.19015607686903, n: 0.2716183613599909 },
};
const ASTEROID_EPOCH = 2461200.5;
function asteroidLon(jde, els) {
  const T = (jde - 2451545.0) / 36525.0;
  const { a, e, I, Om, w, M0, n } = els;
  let M = n360(M0 + n * (jde - ASTEROID_EPOCH));
  let E = M + R2D * e * sd(M);
  for (let i = 0; i < 50; i++) {
    const dM = M - (E - R2D * e * sd(E));
    const dE = dM / (1 - e * cd(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  const xp = a * (cd(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * sd(E);
  const cw = cd(w), sw = sd(w), cO = cd(Om), sO = sd(Om), cI = cd(I);
  const xh = (cw*cO - sw*sO*cI)*xp + (-sw*cO - cw*sO*cI)*yp;
  const yh = (cw*sO + sw*cO*cI)*xp + (-sw*sO + cw*cO*cI)*yp;
  const earth = kepH('Earth', T);
  return n360(at2(yh - earth.y, xh - earth.x));
}
// General precession in ecliptic longitude (IAU 2006) — converts J2000 ecliptic
// longitudes to equinox-of-date. Sun, Moon, and BML formulas already produce
// equinox-of-date positions, so this is only applied to Keplerian-element planets.
function precessionPA(T){return(5028.796195*T+1.1054348*T*T+0.00007964*T*T*T)/3600;}
function pLon(nm,T,jde){let lon;if(nm==='Sun')lon=sunLon(T);else if(nm==='Moon')lon=moonLon(T);else if(nm==='Chiron')lon=chironLon(jde);else if(nm==='Black Moon Lilith')lon=bmlLon(T);else if(nm==='Tyche')lon=tycheLon(jde);else if(nm==='Juno')lon=asteroidLon(jde,ASTEROIDS.Juno);else if(nm==='Pallas')lon=asteroidLon(jde,ASTEROIDS.Pallas);else if(nm==='Vesta')lon=asteroidLon(jde,ASTEROIDS.Vesta);else lon=kepGeo(nm,T);if(nm!=='Sun'&&nm!=='Moon'&&nm!=='Black Moon Lilith')lon=n360(lon+precessionPA(T));return lon;}
function isRetro(nm,jde){if(nm==='Sun'||nm==='Moon')return false;const T1=(jde+0.5-2451545)/36525,T0=(jde-0.5-2451545)/36525;let d=pLon(nm,T1,jde+0.5)-pLon(nm,T0,jde-0.5);if(d>180)d-=360;if(d<-180)d+=360;return d<0;}
// Direction of motion at a specific instant (positive=direct, negative=retrograde).
// Uses a ±3h window — small enough to localize the station within the day,
// large enough to produce a stable sign for slow outer planets.
function motionDir(nm,jde){if(nm==='Sun'||nm==='Moon')return 1;const dt=0.125,T1=(jde+dt-2451545)/36525,T0=(jde-dt-2451545)/36525;let d=pLon(nm,T1,jde+dt)-pLon(nm,T0,jde-dt);if(d>180)d-=360;if(d<-180)d+=360;return d;}

// ── Tradition / zodiac support ────────────────────────────────────────────────
// modern → tropical + Placidus; hellenistic → tropical + Whole Sign;
// vedic → sidereal (Lahiri ayanamsa) + Whole Sign.
function traditionDefaultHouseSystem(tradition){ if(tradition==='hellenistic'||tradition==='vedic') return 'whole_sign'; return 'placidus'; }
function lahiriAyanamsa(jde){ const T=(jde-2451545)/36525; return 23.85 + (50.2719/3600)*(T*100); }
// Convert a tropical buildChart result to sidereal by subtracting the Lahiri
// ayanamsa from every longitude. Aspect differences and house memberships are
// invariant under a uniform shift, so only sign/degree/element/modality labels
// are recomputed.
function toSidereal(chart,jde){
  const a=lahiriAyanamsa(jde);
  const off=(lon)=>n360(lon-a);
  chart.planets=chart.planets.map(p=>({...p,...si(off(p.longitude))}));
  if(chart.nodes){
    chart.nodes.north_node={...chart.nodes.north_node,...si(off(chart.nodes.north_node.longitude)),house:chart.nodes.north_node.house};
    chart.nodes.south_node={...chart.nodes.south_node,...si(off(chart.nodes.south_node.longitude)),house:chart.nodes.south_node.house};
  }
  if(chart.angles){ for(const k of Object.keys(chart.angles)){ if(chart.angles[k]) chart.angles[k]={...chart.angles[k],...si(off(chart.angles[k].longitude))}; } }
  chart.houses=chart.houses.map(h=>({...h,...si(off(h.longitude))}));
  const el={Fire:0,Earth:0,Air:0,Water:0},mod={Cardinal:0,Fixed:0,Mutable:0};
  const sk2=new Set(['North Node','South Node','Part of Fortune','Part of Spirit','Part of Eros','Part of Necessity','Tyche','Juno','Pallas','Vesta']);
  for(const p of chart.planets){ if(sk2.has(p.name))continue; if(p.element)el[p.element]++; if(p.modality)mod[p.modality]++; }
  chart.element_distribution=el; chart.modality_distribution=mod;
  return chart;
}

// ── Houses — canonical ASC/MC logic (RA-based disambiguation) ────────────────
function houseCusps(jde,lat,lon){
  const T=(jde-2451545)/36525,{dpsi,deps}=nutat(T),ob=obliq(T)+deps;
  const RAMC=n360(gmst(jde)+lon+dpsi*cd(ob));

// MC: upper meridian = RA closest to RAMC
  const mcRaw = n360(at2(sd(RAMC), cd(RAMC) * cd(ob)));
  const mcAlt = n360(mcRaw + 180);
  const mcDiff1 = Math.abs(n360(mcRaw - RAMC + 180) - 180);
  const mcDiff2 = Math.abs(n360(mcAlt - RAMC + 180) - 180);
  const MC = mcDiff1 <= mcDiff2 ? mcRaw : mcAlt;
  const IC = n360(MC + 180);
  function ra2ecl(RA){const sinDec=Math.max(-1,Math.min(1,sd(ob)*sd(RA)));const decl=Math.asin(sinDec)*R2D;return n360(at2(sd(RA)*cd(ob)+td(decl)*sd(ob),cd(RA)));}

  // ASC: pick the candidate whose RA is closest to RAMC+90° (eastern horizon)
  const ascRaw=n360(at2(cd(RAMC),-(sd(ob)*td(lat)+cd(ob)*sd(RAMC))));
  const ascAlt=n360(ascRaw+180);
  const raEast=n360(RAMC+90);
  const ra0=n360(at2(sd(ascRaw)*cd(ob),cd(ascRaw)));
  const ra1=n360(at2(sd(ascAlt)*cd(ob),cd(ascAlt)));
  const d0=Math.abs(n360(ra0-raEast+180)-180);
  const d1=Math.abs(n360(ra1-raEast+180)-180);
  const ASC=d0<=d1?ascRaw:ascAlt;
  const DSC=n360(ASC+180);

  function pRA(off,F,above){let RA=n360(RAMC+off);for(let i=0;i<60;i++){const arg=above?-sd(RA)*td(ob)*td(lat):sd(RA)*td(ob)*td(lat);const cl=Math.max(-1,Math.min(1,arg)),ac=Math.acos(cl)*R2D;const nRA=above?n360(RAMC+ac/F):n360(RAMC+180-ac/F);if(Math.abs(nRA-RA)<0.00001){RA=nRA;break;}RA=nRA;}return RA;}

  let H11,H12,H2,H3;
  if(Math.abs(lat)>65){H11=n360(MC+30);H12=n360(MC+60);H2=n360(IC+30);H3=n360(IC+60);}
  else{H11=ra2ecl(pRA(30,3,true));H12=ra2ecl(pRA(60,1.5,true));H2=ra2ecl(pRA(120,1.5,false));H3=ra2ecl(pRA(150,3,false));}

  const cusps=[ASC,H2,H3,IC,n360(H11+180),n360(H12+180),DSC,n360(H2+180),n360(H3+180),MC,H11,H12];
  return{cusps,ASC,MC,IC,DSC};
}

// ── Core chart builder ────────────────────────────────────────────────────────
function getHouse(lon,cusps){const l=n360(lon);for(let i=0;i<12;i++){const c1=n360(cusps[i]),c2=n360(cusps[(i+1)%12]);if(c2<c1){if(l>=c1||l<c2)return i+1;}else{if(l>=c1&&l<c2)return i+1;}}return 1;}

function wholeSignCusps(ascLon){
  // House 1 = entire sign containing the ASC; each subsequent house is the next full sign
  const ascSignStart=Math.floor(n360(ascLon)/30)*30;
  const cusps=[];
  for(let i=0;i<12;i++)cusps.push(n360(ascSignStart+i*30));
  return cusps;
}
function buildChart(jde,lat,lon,houseSystem){
  const T=(jde-2451545)/36525,PNAMES=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','Black Moon Lilith'];
  const planets=PNAMES.map(nm=>({name:nm,...si(pLon(nm,T,jde)),retrograde:isRetro(nm,jde),house:null}));
  const nn=trueNode(jde);
  planets.push({name:'North Node',...si(nn),retrograde:true,house:null});
  planets.push({name:'South Node',...si(n360(nn+180)),retrograde:true,house:null});
  const hc=houseCusps(jde,lat,lon);
  const ASC=hc.ASC,MC=hc.MC,IC=hc.IC,DSC=hc.DSC;
  const cusps=houseSystem==='whole_sign'?wholeSignCusps(ASC):hc.cusps;
  // ── Lots & asteroid (premium-gated, computed for all charts) ──
  // Part of Fortune — modern fixed formula: ASC + Moon − Sun
  const sunP=planets.find(p=>p.name==='Sun'),moonP=planets.find(p=>p.name==='Moon');
  const pofLon=n360(ASC+moonP.longitude-sunP.longitude);
  planets.push({name:'Part of Fortune',...si(pofLon),retrograde:false,house:null});
  planets.push({name:'Part of Spirit',...si(n360(ASC+sunP.longitude-moonP.longitude)),retrograde:false,house:null});
  const venusP=planets.find(p=>p.name==='Venus'),saturnP=planets.find(p=>p.name==='Saturn');
  planets.push({name:'Part of Eros',...si(n360(ASC+venusP.longitude-sunP.longitude)),retrograde:false,house:null});
  planets.push({name:'Part of Necessity',...si(n360(ASC+saturnP.longitude-sunP.longitude)),retrograde:false,house:null});
  planets.push({name:'Tyche',...si(pLon('Tyche',T,jde)),retrograde:false,house:null});
  planets.push({name:'Juno',...si(pLon('Juno',T,jde)),retrograde:isRetro('Juno',jde),house:null});
  planets.push({name:'Pallas',...si(pLon('Pallas',T,jde)),retrograde:isRetro('Pallas',jde),house:null});
  planets.push({name:'Vesta',...si(pLon('Vesta',T,jde)),retrograde:isRetro('Vesta',jde),house:null});
  for(const p of planets)p.house=getHouse(p.longitude,cusps);
  const houses=cusps.map((c,i)=>({number:i+1,...si(c)}));
  const angles={ascendant:si(ASC),midheaven:si(MC),descendant:si(DSC),ic:si(IC)};
  const skip=new Set(['South Node']);
  const aList=planets.filter(p=>!skip.has(p.name));
  const aspects=[];
  for(let i=0;i<aList.length;i++)for(let j=i+1;j<aList.length;j++){let d=Math.abs(aList[i].longitude-aList[j].longitude);if(d>180)d=360-d;for(const ad of ASPECTS){const orb=Math.abs(d-ad.angle);if(orb<=ad.orb){aspects.push({planet1:aList[i].name,planet2:aList[j].name,aspect:ad.name,angle:ad.angle,orb:r4(orb),strength:orb<1?'exact':orb<ad.orb*0.33?'strong':orb<ad.orb*0.66?'moderate':'wide'});break;}}}
  const el={Fire:0,Earth:0,Air:0,Water:0},mod={Cardinal:0,Fixed:0,Mutable:0},sk2=new Set(['North Node','South Node','Part of Fortune','Tyche','Juno','Pallas','Vesta']);
  for(const p of planets){if(sk2.has(p.name))continue;if(p.element)el[p.element]++;if(p.modality)mod[p.modality]++;}
  const nnPlanet = planets.find(p => p.name === 'North Node');
  const snPlanet = planets.find(p => p.name === 'South Node');
  const nodes={
    north_node: { ...si(nn), house: nnPlanet?.house ?? null },
    south_node: { ...si(n360(nn+180)), house: snPlanet?.house ?? null },
  };
  return{julian_day:r4(jde),planets:planets.filter(p=>p.name!=='North Node'&&p.name!=='South Node'),nodes,houses,angles,aspects,element_distribution:el,modality_distribution:mod};
}

// ── HTTP handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    // Original gate: base44.auth.me(). Service-role callers (recalc-all-charts,
    // scheduled jobs) are also authorized, matching Base44's asServiceRole path.
    const user = await getAuthUser(req);
    if (!user && !isServiceRole(req)) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const ct = body.chart_type ?? 'natal';

    if (ct === 'natal') {
      const { birth_date, birth_time, birth_location } = body;
      if (!birth_date || birth_location?.latitude == null || birth_location?.longitude == null) {
        return json({ error: 'Missing birth_date or birth_location' }, { status: 400 });
      }
      const tradition = body.tradition || 'modern';
      const houseSystem = body.house_system ?? traditionDefaultHouseSystem(tradition);
      const tz = typeof body.utc_offset === 'number' ? body.utc_offset : (TZ[birth_location.timezone] ?? 0);
      const natalJDE = toJDE(birth_date, birth_time, tz);
      let chart = buildChart(natalJDE, birth_location.latitude, birth_location.longitude, houseSystem);
      if (tradition === 'vedic') chart = toSidereal(chart, natalJDE);
      chart.zodiac = tradition === 'vedic' ? 'sidereal' : 'tropical';
      chart.tradition = tradition;
      return json({ chart_type: 'natal', birth_date, birth_time: birth_time ?? '12:00:00', birth_location, utc_offset: tz, house_system: houseSystem, ...chart });
    }

    if (ct === 'transit') {
      const { birth_date, birth_time, birth_location, transit_date, transit_time, natal_planets_override } = body;
      if (!birth_date || birth_location?.latitude == null) {
        return json({ error: 'Missing birth_date or birth_location' }, { status: 400 });
      }
      const tradition = body.tradition || 'modern';
      const houseSystem = body.house_system ?? traditionDefaultHouseSystem(tradition);
      const tz = typeof body.utc_offset === 'number' ? body.utc_offset : (TZ[birth_location.timezone] ?? 0);
      const natalJDE = toJDE(birth_date, birth_time, tz);
      const natal = buildChart(natalJDE, birth_location.latitude, birth_location.longitude, houseSystem);
      if (tradition === 'vedic') toSidereal(natal, natalJDE);
      let natalPlanets = (natal_planets_override && natal_planets_override.length > 0) ? natal_planets_override : natal.planets;
      // Keep natal lots (Part of Fortune, Tyche) as transit targets so transits
      // to these calculated points are computed; transit-side lots are excluded
      // by construction (tPlanets is built from the fixed planet list only).
      // Include angles (Ascendant, DC, MC, IC) so transits to them are calculated
      if (natal.angles) {
        if (natal.angles.ascendant) natalPlanets.push({ name: 'Ascendant', longitude: natal.angles.ascendant.longitude, sign: natal.angles.ascendant.sign, degree: natal.angles.ascendant.degree, house: 1 });
        if (natal.angles.midheaven) natalPlanets.push({ name: 'Midheaven', longitude: natal.angles.midheaven.longitude, sign: natal.angles.midheaven.sign, degree: natal.angles.midheaven.degree, house: 10 });
        if (natal.angles.descendant) natalPlanets.push({ name: 'Descendant', longitude: natal.angles.descendant.longitude, sign: natal.angles.descendant.sign, degree: natal.angles.descendant.degree, house: 7 });
        if (natal.angles.ic) natalPlanets.push({ name: 'IC', longitude: natal.angles.ic.longitude, sign: natal.angles.ic.sign, degree: natal.angles.ic.degree, house: 4 });
      }
      // Include natal nodes as transit aspect targets
      if (natal.nodes?.north_node) natalPlanets.push({ name: 'North Node', longitude: natal.nodes.north_node.longitude, sign: natal.nodes.north_node.sign, degree: natal.nodes.north_node.degree, house: natal.nodes.north_node.house });
      if (natal.nodes?.south_node) natalPlanets.push({ name: 'South Node', longitude: natal.nodes.south_node.longitude, sign: natal.nodes.south_node.sign, degree: natal.nodes.south_node.degree, house: natal.nodes.south_node.house });
      // Re-assign natal houses using the freshly calculated cusps — the override
      // may carry stale house assignments from a different house system or an
      // outdated chart recalculation, which would make every transit description
      // reference the wrong natal house.
      const freshCusps = natal.houses.map(h => h.longitude);
      for (const np of natalPlanets) {
        if (np.name !== 'Ascendant' && np.name !== 'Midheaven' && np.name !== 'Descendant' && np.name !== 'IC' && np.longitude != null) {
          np.house = getHouse(np.longitude, freshCusps);
        }
      }
      const tDate = transit_date ?? new Date().toISOString().slice(0, 10);
      const tzOffset = typeof body.utc_offset === 'number' ? body.utc_offset : 0;
      const tJDE = toJDE(tDate, transit_time ?? '12:00:00', tzOffset);
      const Tt = (tJDE - 2451545) / 36525;
      const tPlanets = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','Black Moon Lilith'].map(nm => ({
        name: nm, ...si(pLon(nm, Tt, tJDE)), retrograde: isRetro(nm, tJDE), house: null
      }));
      // Transit nodes — true (osculating) lunar nodes (always retrograde)
      const trnn = trueNode(tJDE);
      tPlanets.push({ name: 'North Node', ...si(trnn), retrograde: true, house: null });
      tPlanets.push({ name: 'South Node', ...si(n360(trnn + 180)), retrograde: true, house: null });
      // Siderealize transit planets for Vedic so transit-to-natal aspects are
      // computed on a consistent (sidereal) frame with the sidereal natal chart.
      if (tradition === 'vedic') {
        const aV = lahiriAyanamsa(tJDE);
        for (const tp of tPlanets) { const s = si(n360(tp.longitude - aV)); tp.sign = s.sign; tp.degree = s.degree; tp.longitude = s.longitude; tp.element = s.element; tp.modality = s.modality; }
      }
      // Transit orbs: much tighter than natal — only aspects actively perfecting
      const TRANSIT_ORBS = { conjunction: 2.0, opposition: 2.0, trine: 2.0, square: 2.0, sextile: 1.5 };
      // Moon moves ~12°/day — wider conjunction orb so sign-passage conjunctions show all day
      const MOON_ORBS = { conjunction: 8.0, opposition: 2.0, trine: 2.0, square: 2.0, sextile: 1.5 };
      const TRANSIT_ANGLES = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60 };
      // Angles (ASC/DC/MC/IC) are sensitive points — give them a wider transit orb
      const ANGLE_NAMES = new Set(['Ascendant', 'Descendant', 'Midheaven', 'IC']);
      const ANGLE_ORB_BOOST = 1.0;
      const tAspects = [];
      for (const tp of tPlanets) {
        const isMoon = tp.name === 'Moon';
        for (const np of natalPlanets) {
          let d = Math.abs(tp.longitude - np.longitude);
          if (d > 180) d = 360 - d;
          const isAngle = ANGLE_NAMES.has(np.name);
          for (const [aspName, aspAngle] of Object.entries(TRANSIT_ANGLES)) {
            let maxOrb = isMoon ? (MOON_ORBS[aspName] ?? TRANSIT_ORBS[aspName]) : TRANSIT_ORBS[aspName];
            if (isAngle) maxOrb += ANGLE_ORB_BOOST;
            const orb = Math.abs(d - aspAngle);
            if (orb <= maxOrb) {
              tAspects.push({ transit_planet: tp.name, natal_planet: np.name, aspect: aspName, orb: r4(orb) });
              break;
            }
          }
        }
      }
      // Detect stations (planets changing direction) on this transit day.
      // Compare the direction of motion at the start of the day (midnight) vs
      // the end of the day (next midnight). If the sign flips, a station occurred
      // during this calendar day — regardless of where noon falls relative to it.
      const stations = [];
      for (const tp of tPlanets) {
        if (tp.name === 'Sun' || tp.name === 'Moon' || tp.name === 'North Node' || tp.name === 'South Node') continue;
        const dirStart = motionDir(tp.name, tJDE - 0.5);
        const dirEnd = motionDir(tp.name, tJDE + 0.5);
        if (dirStart > 0 && dirEnd < 0) {
          stations.push({ planet: tp.name, type: 'retrograde', sign: tp.sign, degree: tp.degree });
          tp.retrograde = true;  // reflect post-station direction for display
        } else if (dirStart < 0 && dirEnd > 0) {
          stations.push({ planet: tp.name, type: 'direct', sign: tp.sign, degree: tp.degree });
          tp.retrograde = false; // reflect post-station direction for display
        }
      }
      // Detect approaching stations — planets that will station within the next 5 days.
      // Compare current direction with direction at +1d, +2d, ... +5d. If the sign
      // flips, the planet stations on that day.
      const STATION_LOOKAHEAD = 5;
      for (const tp of tPlanets) {
        if (tp.name === 'Sun' || tp.name === 'Moon' || tp.name === 'North Node' || tp.name === 'South Node' || tp.name === 'Black Moon Lilith') continue;
        // Skip if already stationing today (exact station already detected above)
        if (stations.some(s => s.planet === tp.name)) continue;
        const currentDir = motionDir(tp.name, tJDE);
        if (currentDir === 0) continue;
        for (let d = 1; d <= STATION_LOOKAHEAD; d++) {
          const futureJDE = tJDE + d;
          const futureDir = motionDir(tp.name, futureJDE);
          if (currentDir > 0 && futureDir < 0) {
            const expectedMs = (futureJDE - 2440587.5) * 86400000;
            stations.push({ planet: tp.name, type: 'retrograde', sign: tp.sign, degree: tp.degree, approaching: true, days_until: d, expected_date: new Date(expectedMs).toISOString().slice(0, 10) });
            break;
          } else if (currentDir < 0 && futureDir > 0) {
            const expectedMs = (futureJDE - 2440587.5) * 86400000;
            stations.push({ planet: tp.name, type: 'direct', sign: tp.sign, degree: tp.degree, approaching: true, days_until: d, expected_date: new Date(expectedMs).toISOString().slice(0, 10) });
            break;
          }
        }
      }
      // Detect sign ingresses — exact (today), approaching (within 3° of boundary), or recent (within 3° of entry)
      const ingresses = [];
      for (const tp of tPlanets) {
        if (tp.name === 'Moon' || tp.name === 'Chiron' || tp.name === 'Black Moon Lilith' || tp.name === 'North Node' || tp.name === 'South Node') continue;
        const lonStart = pLon(tp.name, (tJDE - 0.5 - 2451545) / 36525, tJDE - 0.5);
        const lonEnd = pLon(tp.name, (tJDE + 0.5 - 2451545) / 36525, tJDE + 0.5);
        const signStart = Math.floor(n360(lonStart) / 30);
        const signEnd = Math.floor(n360(lonEnd) / 30);
        if (signStart !== signEnd) {
          ingresses.push({ planet: tp.name, from_sign: SIGNS[signStart], to_sign: SIGNS[signEnd], degree: tp.degree, exact: true });
        } else {
          // Degree within the current sign (0–30)
          const degInSign = n360(tp.longitude) % 30;
          // Approaching — within 3° of the next sign boundary (27°+), not retrograde
          if (!tp.retrograde && degInSign >= 27) {
            const nextSignIdx = (signEnd + 1) % 12;
            // Estimate the date the planet will cross into the next sign.
            // dailyMotion = degrees the planet advances per day (lonEnd - lonStart).
            const dailyMotion = lonEnd - lonStart;
            let expected_date = null;
            let days_until = null;
            if (dailyMotion > 0) {
              const remaining = 30 - degInSign;
              days_until = remaining / dailyMotion;
              const expectedMs = (tJDE + days_until - 2440587.5) * 86400000;
              expected_date = new Date(expectedMs).toISOString().slice(0, 10);
            }
            ingresses.push({ planet: tp.name, from_sign: tp.sign, to_sign: SIGNS[nextSignIdx], degree: tp.degree, approaching: true, expected_date, days_until });
          }
          // Recent — within 3° of having entered this sign (0°–3°)
          if (degInSign <= 3) {
            const prevSignIdx = (signEnd + 11) % 12;
            ingresses.push({ planet: tp.name, from_sign: SIGNS[prevSignIdx], to_sign: tp.sign, degree: tp.degree, recent: true });
          }
        }
      }
      // ── Moon "now" override ──
      // The Moon moves ~0.55°/h, so a noon snapshot can be several degrees off
      // by evening. When a specific instant is requested for today's view
      // (body.moon_instant, ISO 8601), recompute the Moon and its aspects to
      // natal at that instant. Only the Moon is touched — ingress/station/
      // mundane detection already exclude the Moon, and every other body is
      // slow enough that the noon snapshot stays valid all day.
      if (body.moon_instant) {
        try {
          const mJDE = isoToJDE(body.moon_instant);
          const mT = (mJDE - 2451545) / 36525;
          let moonLong = pLon('Moon', mT, mJDE);
          if (tradition === 'vedic') moonLong = n360(moonLong - lahiriAyanamsa(tJDE));
          const moonObj = { name: 'Moon', ...si(moonLong), retrograde: false, house: null };
          const mi = tPlanets.findIndex(p => p.name === 'Moon');
          if (mi >= 0) tPlanets[mi] = moonObj; else tPlanets.push(moonObj);
          // Recompute the Moon's transit-to-natal aspects at the new instant
          for (let i = tAspects.length - 1; i >= 0; i--) {
            if (tAspects[i].transit_planet === 'Moon') tAspects.splice(i, 1);
          }
          for (const np of natalPlanets) {
            let d = Math.abs(moonObj.longitude - np.longitude);
            if (d > 180) d = 360 - d;
            const isAngle = ANGLE_NAMES.has(np.name);
            for (const [aspName, aspAngle] of Object.entries(TRANSIT_ANGLES)) {
              let maxOrb = MOON_ORBS[aspName] ?? TRANSIT_ORBS[aspName];
              if (isAngle) maxOrb += ANGLE_ORB_BOOST;
              const orb = Math.abs(d - aspAngle);
              if (orb <= maxOrb) {
                tAspects.push({ transit_planet: 'Moon', natal_planet: np.name, aspect: aspName, orb: r4(orb) });
                break;
              }
            }
          }
        } catch { /* non-critical — fall back to noon Moon */ }
      }
      return json({ chart_type: 'transit', natal: { birth_date, birth_time, birth_location, ...natal }, transit_date: tDate, transit_planets: tPlanets, transit_aspects: tAspects, stations, ingresses, zodiac: tradition === 'vedic' ? 'sidereal' : 'tropical', tradition });
    }

    if (ct === 'synastry') {
      const { chart1, chart2 } = body;
      if (!chart1?.birth_date || !chart2?.birth_date) {
        return json({ error: 'synastry requires chart1 and chart2' }, { status: 400 });
      }
      const houseSystem = body.house_system ?? 'placidus';
      const bn = (c) => { const tz = typeof c.utc_offset === 'number' ? c.utc_offset : (TZ[c.birth_location?.timezone] ?? 0); return buildChart(toJDE(c.birth_date, c.birth_time, tz), c.birth_location.latitude, c.birth_location.longitude, houseSystem); };
      const c1 = bn(chart1), c2 = bn(chart2), ca = [];
      // Build points arrays including angles (ASC/DC/MC/IC) and nodes (NN/SN)
      // so cross-aspects cover the full axes, not just planets
      const synPoints = (chart) => {
        const pts = [...chart.planets].filter(p => !LOT_NAMES.has(p.name));
        if (chart.angles) {
          if (chart.angles.ascendant) pts.push({ name: 'Ascendant', longitude: chart.angles.ascendant.longitude, sign: chart.angles.ascendant.sign, degree: chart.angles.ascendant.degree, house: 1 });
          if (chart.angles.descendant) pts.push({ name: 'Descendant', longitude: chart.angles.descendant.longitude, sign: chart.angles.descendant.sign, degree: chart.angles.descendant.degree, house: 7 });
          if (chart.angles.midheaven) pts.push({ name: 'Midheaven', longitude: chart.angles.midheaven.longitude, sign: chart.angles.midheaven.sign, degree: chart.angles.midheaven.degree, house: 10 });
          if (chart.angles.ic) pts.push({ name: 'IC', longitude: chart.angles.ic.longitude, sign: chart.angles.ic.sign, degree: chart.angles.ic.degree, house: 4 });
        }
        if (chart.nodes) {
          if (chart.nodes.north_node) pts.push({ name: 'North Node', longitude: chart.nodes.north_node.longitude, sign: chart.nodes.north_node.sign, degree: chart.nodes.north_node.degree, house: chart.nodes.north_node.house });
          if (chart.nodes.south_node) pts.push({ name: 'South Node', longitude: chart.nodes.south_node.longitude, sign: chart.nodes.south_node.sign, degree: chart.nodes.south_node.degree, house: chart.nodes.south_node.house });
        }
        return pts;
      };
      const c1pts = synPoints(c1), c2pts = synPoints(c2);
      for (const p1 of c1pts) for (const p2 of c2pts) { let d = Math.abs(p1.longitude - p2.longitude); if (d > 180) d = 360 - d; for (const ad of ASPECTS) { const orb = Math.abs(d - ad.angle); if (orb <= ad.orb) { ca.push({ person1_planet: p1.name, person2_planet: p2.name, aspect: ad.name, orb: r4(orb) }); break; } } }
      return json({ chart_type: 'synastry', chart1: { ...chart1, ...c1 }, chart2: { ...chart2, ...c2 }, cross_aspects: ca });
    }

    return json({ error: `Unknown chart_type "${ct}"` }, { status: 400 });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
});