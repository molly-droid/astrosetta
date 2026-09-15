import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';

const D2R=Math.PI/180,R2D=180/Math.PI;
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
function n360(d){return((d%360)+360)%360;}
function sd(d){return Math.sin(d*D2R);}
function cd(d){return Math.cos(d*D2R);}
function at2(y,x){return Math.atan2(y,x)*R2D;}
function si(lon){const l=n360(lon),sg=SIGNS[Math.floor(l/30)];return{sign:sg,degree:Math.round((l%30)*1000)/1000,longitude:Math.round(l*1000)/1000};}
function dT(yr){if(yr<1986){const t=yr-1975;return 45.45+1.067*t-t*t/260-t*t*t/718;}if(yr<2005){const t=yr-2000;return 63.86+0.3345*t-0.060374*t*t+0.0017275*t*t*t+0.000651814*Math.pow(t,4);}const t=yr-2000;return 62.92+0.32217*t+0.005589*t*t;}
function jd(y,mo,d,hut){let yr=y,m=mo;if(m<=2){yr--;m+=12;}const A=Math.floor(yr/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(yr+4716))+Math.floor(30.6001*(m+1))+d+hut/24+B-1524.5;}

const KE={Mercury:[[0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593],[0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081]],Venus:[[0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255],[0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418]],Earth:[[1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0.0],[0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0.0]],Mars:[[1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],[0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343]],Jupiter:[[5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909],[-0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106]],Saturn:[[9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448],[-0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794]],Uranus:[[19.18916464,0.04725744,0.77263783,313.23810451,170.95427630,74.01692503],[-0.00196176,-0.00004397,-0.00242939,428.48202785,0.40805281,0.04240589]],Neptune:[[30.06992276,0.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],[0.00026291,0.00005105,0.00035372,218.45945325,-0.32241464,-0.00508664]],Pluto:[[39.48211675,0.24882730,17.14001206,238.92903833,224.06891629,110.30393684],[-0.00031596,0.00005170,0.00004818,145.20780515,-0.04062942,-0.01183482]]};
const KE_EX={Jupiter:[-0.00012452,0.06064060,-0.35635438,38.35125000],Saturn:[0.00025899,-0.13434469,0.87320147,38.35125000],Uranus:[0.00058331,-0.97731848,0.17689245,7.67025000],Neptune:[-0.00041348,0.68346318,-0.10162547,7.67025000],Pluto:[-0.01262724,0,0,0]};

function kepH(nm,T){const[els,rates]=KE[nm],[a,e,I,L,wb,Om]=els.map((v,i)=>v+rates[i]*T);let M=L-wb;const ex=KE_EX[nm];if(ex){const[b,c,s,f]=ex;M+=b*T*T+c*cd(f*T)+s*sd(f*T);}M=((M%360)+360)%360;if(M>180)M-=360;const w=wb-Om;let E=M+R2D*e*sd(M);for(let i=0;i<15;i++){const dM=M-(E-R2D*e*sd(E)),dE=dM/(1-e*cd(E));E+=dE;if(Math.abs(dE)<1e-8)break;}const xp=a*(cd(E)-e),yp=a*Math.sqrt(1-e*e)*sd(E),cw=cd(w),sw=sd(w),cO=cd(Om),sO=sd(Om),cI=cd(I);return{x:(cw*cO-sw*sO*cI)*xp+(-sw*cO-cw*sO*cI)*yp,y:(cw*sO+sw*cO*cI)*xp+(-sw*sO+cw*cO*cI)*yp};}
function kepGeo(nm,T){const p=kepH(nm,T),e=kepH('Earth',T);return n360(at2(p.y-e.y,p.x-e.x));}

function chironLon(jde) {
  const T = (jde - 2451545.0) / 36525.0;
  const a = 13.648;
  const e = 0.38307 - 0.000007 * T;
  const I = 6.9313 + 0.0007 * T;
  const Om = 339.321 - 0.0097 * T;
  const w  = 339.295 - 0.0053 * T;
  const wb = n360(Om + w);
  const n = 0.019600;
  const tp = 2450128.5;
  let M = n360(n * (jde - tp));
  if (M > 180) M -= 360;
  let E = M + R2D * e * sd(M);
  for (let i = 0; i < 30; i++) {
    const dM = M - (E - R2D * e * sd(E));
    const dE = dM / (1 - e * cd(E));
    E += dE;
    if (Math.abs(dE) < 1e-9) break;
  }
  const xp = a * (cd(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * sd(E);
  const cw2 = cd(w), sw2 = sd(w), cO = cd(Om), sO = sd(Om), cI = cd(I);
  const xh = (cw2*cO - sw2*sO*cI)*xp + (-sw2*cO - cw2*sO*cI)*yp;
  const yh = (cw2*sO + sw2*cO*cI)*xp + (-sw2*sO + cw2*cO*cI)*yp;
  const earth = kepH('Earth', T);
  return n360(at2(yh - earth.y, xh - earth.x));
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    // Birth date: 1990-07-03 17:35 MDT = UTC-6
    const birthJD = jd(1990, 7, 3, 17.583333 + 6) + dT(1990 + 6/12) / 86400;
    const natalT = (birthJD - 2451545) / 36525;
    const natalChironLon = chironLon(birthJD);
    const natalChironSI = si(natalChironLon);

    // Transit date: 2026-06-02 12:00 UTC
    const transitJD = jd(2026, 6, 2, 12) + dT(2026.42) / 86400;
    const transitT = (transitJD - 2451545) / 36525;
    const transitJupiterLon = kepGeo('Jupiter', transitT);
    const transitJupiterSI = si(transitJupiterLon);

    const diff = Math.abs(natalChironLon - transitJupiterLon);
    const angularDiff = diff > 180 ? 360 - diff : diff;

    return json({
      natal_chiron: { longitude: natalChironLon, ...natalChironSI },
      transit_jupiter: { longitude: transitJupiterLon, ...transitJupiterSI },
      angular_diff: Math.round(angularDiff * 100) / 100,
      expected_aspect: angularDiff < 8 ? 'conjunction' : angularDiff > 172 ? 'opposition' : `${Math.round(angularDiff)}° — check manually`,
      birth_jde: birthJD,
      transit_jde: transitJD,
    });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
});