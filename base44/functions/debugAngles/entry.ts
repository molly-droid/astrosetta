import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const D2R=Math.PI/180,R2D=180/Math.PI;
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const KE={Earth:[[1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0.0],[0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0.0]]};
function n360(d){return((d%360)+360)%360;}
function sd(d){return Math.sin(d*D2R);}
function cd(d){return Math.cos(d*D2R);}
function td(d){return Math.tan(d*D2R);}
function at2(y,x){return Math.atan2(y,x)*R2D;}
function r4(n){return Math.round(n*10000)/10000;}
function si(lon){const l=n360(lon);return{sign:SIGNS[Math.floor(l/30)],degree:r4(l%30),longitude:r4(l)};}
function jd(y,mo,d,hut){let yr=y,m=mo;if(m<=2){yr--;m+=12;}const A=Math.floor(yr/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(yr+4716))+Math.floor(30.6001*(m+1))+d+hut/24+B-1524.5;}
function dT(yr){if(yr<2005){const t=yr-2000;return 63.86+0.3345*t-0.060374*t*t+0.0017275*t*t*t+0.000651814*Math.pow(t,4);}const t=yr-2000;return 62.92+0.32217*t+0.005589*t*t;}
function obliq(T){const U=T/100;return 23+26/60+21.448/3600+(-4680.93*U-1.55*U*U+1999.25*U*U*U-51.38*Math.pow(U,4)-249.67*Math.pow(U,5)-39.05*Math.pow(U,6)+7.12*Math.pow(U,7)+27.87*Math.pow(U,8)+5.79*Math.pow(U,9)+2.45*Math.pow(U,10))/3600;}
function nutat(T){const om=n360(125.04452-1934.136261*T+0.0020708*T*T),L0=n360(280.4665+36000.7698*T),Lp=n360(218.3165+481267.8813*T);return{dpsi:((-17.20-0.01742*T)*sd(om)-1.32*sd(2*L0)-0.23*sd(2*Lp)+0.21*sd(2*om))/3600,deps:((9.20+0.00089*T)*cd(om)+0.57*cd(2*L0)+0.10*cd(2*Lp)-0.09*cd(2*om))/3600};}
function gmst(JD){const T=(JD-2451545)/36525;return n360(280.46061837+360.98564736629*(JD-2451545)+0.000387933*T*T-T*T*T/38710000);}

function debugAngles(jde, lat, lon) {
  const T=(jde-2451545)/36525;
  const {dpsi,deps}=nutat(T);
  const ob=obliq(T)+deps;
  const RAMC=n360(gmst(jde)+lon+dpsi*cd(ob));

  // MC candidates
  const mcRaw=n360(at2(sd(RAMC),cd(RAMC)*cd(ob)));
  const mcAlt=n360(mcRaw+180);

  const decl1=Math.asin(Math.max(-1,Math.min(1,sd(ob)*sd(mcRaw))))*R2D;
  const decl2=Math.asin(Math.max(-1,Math.min(1,sd(ob)*sd(mcAlt))))*R2D;
  const alt1=Math.asin(Math.max(-1,Math.min(1,sd(lat)*sd(decl1)+cd(lat)*cd(decl1))))*R2D;
  const alt2=Math.asin(Math.max(-1,Math.min(1,sd(lat)*sd(decl2)+cd(lat)*cd(decl2))))*R2D;

  const MC = alt1 > alt2 ? mcRaw : mcAlt;
  const IC = n360(MC+180);

  // ASC candidates
  const ascRaw=n360(at2(cd(RAMC),-(sd(ob)*td(lat)+cd(ob)*sd(RAMC))));
  const ascAlt=n360(ascRaw+180);
  const diff0=n360(ascRaw-MC);
  const ASC=(diff0>=90&&diff0<=270)?ascRaw:ascAlt;
  const DSC=n360(ASC+180);

  return {
    RAMC: r4(RAMC),
    obliquity: r4(ob),
    MC: { ...si(MC), raw: r4(MC) },
    IC: { ...si(IC), raw: r4(IC) },
    ASC: { ...si(ASC), raw: r4(ASC) },
    DSC: { ...si(DSC), raw: r4(DSC) },
    mcRaw: r4(mcRaw), mcAlt: r4(mcAlt),
    alt_mcRaw: r4(alt1), alt_mcAlt: r4(alt2),
    mcChosen: alt1>alt2 ? 'mcRaw' : 'mcAlt',
    ascRaw: r4(ascRaw), ascAlt: r4(ascAlt),
    diff_ascRaw_minus_MC: r4(diff0),
    ascChosen: (diff0>=90&&diff0<=270) ? 'ascRaw' : 'ascAlt',
  };
}

function toJDE(ds,ts,tz){const[y,mo,d]=ds.split('-').map(Number);const[h,mi,s]=(ts||'12:00:00').split(':').map(n=>parseInt(n)||0);const utH=(h+mi/60+s/3600)-tz;const J=jd(y,mo,d,utH);return J+dT(y+(mo-1)/12)/86400;}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { birth_date, birth_time, latitude, longitude, utc_offset } = body;
    const jde = toJDE(birth_date, birth_time, utc_offset);
    const result = debugAngles(jde, latitude, longitude);
    return Response.json({ jde: r4(jde), ...result });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});