import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const D2R=Math.PI/180,R2D=180/Math.PI;
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
function n360(d){return((d%360)+360)%360;}
function sd(d){return Math.sin(d*D2R);}
function cd(d){return Math.cos(d*D2R);}
function td(d){return Math.tan(d*D2R);}
function at2(y,x){return Math.atan2(y,x)*R2D;}
function r2(n){return Math.round(n*100)/100;}
function signOf(lon){return SIGNS[Math.floor(n360(lon)/30)];}

function jd(y,mo,d,hut){let yr=y,m=mo;if(m<=2){yr--;m+=12;}const A=Math.floor(yr/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(yr+4716))+Math.floor(30.6001*(m+1))+d+hut/24+B-1524.5;}
function dT(yr){const t=yr-2000;return 62.92+0.32217*t+0.005589*t*t;}
function obliq(T){const U=T/100;return 23+26/60+21.448/3600+(-4680.93*U-1.55*U*U+1999.25*U*U*U-51.38*Math.pow(U,4)-249.67*Math.pow(U,5)-39.05*Math.pow(U,6)+7.12*Math.pow(U,7)+27.87*Math.pow(U,8)+5.79*Math.pow(U,9)+2.45*Math.pow(U,10))/3600;}
function nutat(T){const om=n360(125.04452-1934.136261*T+0.0020708*T*T),L0=n360(280.4665+36000.7698*T),Lp=n360(218.3165+481267.8813*T);return{dpsi:((-17.20-0.01742*T)*sd(om)-1.32*sd(2*L0)-0.23*sd(2*Lp)+0.21*sd(2*om))/3600,deps:((9.20+0.00089*T)*cd(om)+0.57*cd(2*L0)+0.10*cd(2*Lp)-0.09*cd(2*om))/3600};}
function gmst(JD){const T=(JD-2451545)/36525;return n360(280.46061837+360.98564736629*(JD-2451545)+0.000387933*T*T-T*T*T/38710000);}

Deno.serve(async(req)=>{
  try{
    const base44=createClientFromRequest(req),user=await base44.auth.me();
    if(!user)return Response.json({error:'Unauthorized'},{status:401});
    const{birth_date,birth_time,lat,lon,tz_offset}=await req.json();
    const[y,mo,d]=birth_date.split('-').map(Number);
    const[h,mi,s]=(birth_time||'12:00:00').split(':').map(n=>parseInt(n)||0);
    const utH=(h+mi/60+s/3600)-(tz_offset??0);
    const JD=jd(y,mo,d,utH);
    const JDE=JD+dT(y+(mo-1)/12)/86400;
    const T=(JDE-2451545)/36525;
    const{dpsi,deps}=nutat(T),ob=obliq(T)+deps;
    const RAMC=n360(gmst(JDE)+lon+dpsi*cd(ob));
    const MC=n360(at2(sd(RAMC),cd(RAMC)*cd(ob)));
    const ascRaw=at2(cd(RAMC),-(sd(ob)*td(lat)+cd(ob)*sd(RAMC)));
    const ASC=n360(ascRaw);
    const IC=n360(MC+180),DSC=n360(ASC+180);

    function ra2ecl(RA){
      const decl=Math.asin(Math.max(-1,Math.min(1,sd(ob)*sd(RA))))*R2D;
      return n360(at2(sd(RA)*cd(ob)+td(decl)*sd(ob),cd(RA)));
    }
    function pRA(off,F,above){
      let RA=n360(RAMC+off);
      for(let i=0;i<60;i++){
        const arg=above?-sd(RA)*td(ob)*td(lat):sd(RA)*td(ob)*td(lat);
        const cl=Math.max(-1,Math.min(1,arg)),ac=Math.acos(cl)*R2D;
        const nRA=above?n360(RAMC+ac/F):n360(RAMC+180-ac/F);
        if(Math.abs(nRA-RA)<0.00001){RA=nRA;break;}RA=nRA;
      }return RA;
    }
    const H11=ra2ecl(pRA(30,3,true));
    const H12=ra2ecl(pRA(60,1.5,true));
    const H2 =ra2ecl(pRA(120,1.5,false));
    const H3 =ra2ecl(pRA(150,3,false));
    const cusps=[ASC,H2,H3,IC,n360(H11+180),n360(H12+180),DSC,n360(H2+180),n360(H3+180),MC,H11,H12];

    return Response.json({
      JDE:r2(JDE), T:r2(T), ob:r2(ob), RAMC:r2(RAMC),
      MC:{lon:r2(MC),sign:signOf(MC)},
      ASC:{lon:r2(ASC),sign:signOf(ASC)},
      IC:{lon:r2(IC),sign:signOf(IC)},
      DSC:{lon:r2(DSC),sign:signOf(DSC)},
      cusps:cusps.map((c,i)=>({house:i+1,lon:r2(c),sign:signOf(c)})),
    });
  }catch(err){return Response.json({error:err.message},{status:500});}
});