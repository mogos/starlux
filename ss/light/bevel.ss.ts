// Binary64 coefficients for integer degrees 0 through 80, stored as round-trip literals.
// The scalar lookup avoids constructing a table in the generated native frame path.
function bevelCoefficient(index: number): number {
  if (index < 16) {
    if (index === 0) return 0.0;
    if (index === 1) return 1.0;
    if (index === 2) return 0.01745240643728351;
    if (index === 3) return 0.9998476951563913;
    if (index === 4) return 0.03489949670250097;
    if (index === 5) return 0.9993908270190958;
    if (index === 6) return 0.052335956242943835;
    if (index === 7) return 0.9986295347545738;
    if (index === 8) return 0.0697564737441253;
    if (index === 9) return 0.9975640502598242;
    if (index === 10) return 0.08715574274765817;
    if (index === 11) return 0.9961946980917455;
    if (index === 12) return 0.10452846326765347;
    if (index === 13) return 0.9945218953682733;
    if (index === 14) return 0.12186934340514748;
    return 0.992546151641322;
  }
  if (index < 32) {
    if (index === 16) return 0.13917310096006544;
    if (index === 17) return 0.9902680687415704;
    if (index === 18) return 0.15643446504023087;
    if (index === 19) return 0.9876883405951378;
    if (index === 20) return 0.17364817766693033;
    if (index === 21) return 0.984807753012208;
    if (index === 22) return 0.1908089953765448;
    if (index === 23) return 0.981627183447664;
    if (index === 24) return 0.20791169081775934;
    if (index === 25) return 0.9781476007338057;
    if (index === 26) return 0.224951054343865;
    if (index === 27) return 0.9743700647852352;
    if (index === 28) return 0.24192189559966773;
    if (index === 29) return 0.9702957262759965;
    if (index === 30) return 0.25881904510252074;
    return 0.9659258262890683;
  }
  if (index < 48) {
    if (index === 32) return 0.27563735581699916;
    if (index === 33) return 0.9612616959383189;
    if (index === 34) return 0.29237170472273677;
    if (index === 35) return 0.9563047559630354;
    if (index === 36) return 0.3090169943749474;
    if (index === 37) return 0.9510565162951535;
    if (index === 38) return 0.3255681544571567;
    if (index === 39) return 0.9455185755993168;
    if (index === 40) return 0.3420201433256687;
    if (index === 41) return 0.9396926207859084;
    if (index === 42) return 0.35836794954530027;
    if (index === 43) return 0.9335804264972017;
    if (index === 44) return 0.374606593415912;
    if (index === 45) return 0.9271838545667874;
    if (index === 46) return 0.39073112848927377;
    return 0.9205048534524404;
  }
  if (index < 64) {
    if (index === 48) return 0.4067366430758002;
    if (index === 49) return 0.9135454576426009;
    if (index === 50) return 0.42261826174069944;
    if (index === 51) return 0.9063077870366499;
    if (index === 52) return 0.4383711467890774;
    if (index === 53) return 0.898794046299167;
    if (index === 54) return 0.45399049973954675;
    if (index === 55) return 0.8910065241883679;
    if (index === 56) return 0.4694715627858908;
    if (index === 57) return 0.882947592858927;
    if (index === 58) return 0.48480962024633706;
    if (index === 59) return 0.8746197071393957;
    if (index === 60) return 0.49999999999999994;
    if (index === 61) return 0.8660254037844387;
    if (index === 62) return 0.5150380749100542;
    return 0.8571673007021123;
  }
  if (index < 80) {
    if (index === 64) return 0.5299192642332049;
    if (index === 65) return 0.848048096156426;
    if (index === 66) return 0.5446390350150271;
    if (index === 67) return 0.838670567945424;
    if (index === 68) return 0.5591929034707469;
    if (index === 69) return 0.8290375725550416;
    if (index === 70) return 0.573576436351046;
    if (index === 71) return 0.8191520442889918;
    if (index === 72) return 0.5877852522924731;
    if (index === 73) return 0.8090169943749475;
    if (index === 74) return 0.6018150231520483;
    if (index === 75) return 0.7986355100472928;
    if (index === 76) return 0.6156614753256583;
    if (index === 77) return 0.7880107536067219;
    if (index === 78) return 0.6293203910498374;
    return 0.7771459614569709;
  }
  if (index < 96) {
    if (index === 80) return 0.6427876096865393;
    if (index === 81) return 0.766044443118978;
    if (index === 82) return 0.6560590289905073;
    if (index === 83) return 0.754709580222772;
    if (index === 84) return 0.6691306063588582;
    if (index === 85) return 0.7431448254773942;
    if (index === 86) return 0.6819983600624985;
    if (index === 87) return 0.7313537016191705;
    if (index === 88) return 0.6946583704589973;
    if (index === 89) return 0.7193398003386512;
    if (index === 90) return 0.7071067811865475;
    if (index === 91) return 0.7071067811865476;
    if (index === 92) return 0.7193398003386511;
    if (index === 93) return 0.6946583704589973;
    if (index === 94) return 0.7313537016191705;
    return 0.6819983600624985;
  }
  if (index < 112) {
    if (index === 96) return 0.7431448254773942;
    if (index === 97) return 0.6691306063588582;
    if (index === 98) return 0.754709580222772;
    if (index === 99) return 0.6560590289905073;
    if (index === 100) return 0.766044443118978;
    if (index === 101) return 0.6427876096865394;
    if (index === 102) return 0.7771459614569709;
    if (index === 103) return 0.6293203910498375;
    if (index === 104) return 0.788010753606722;
    if (index === 105) return 0.6156614753256583;
    if (index === 106) return 0.7986355100472928;
    if (index === 107) return 0.6018150231520484;
    if (index === 108) return 0.8090169943749475;
    if (index === 109) return 0.5877852522924731;
    if (index === 110) return 0.8191520442889918;
    return 0.5735764363510462;
  }
  if (index < 128) {
    if (index === 112) return 0.8290375725550417;
    if (index === 113) return 0.5591929034707468;
    if (index === 114) return 0.838670567945424;
    if (index === 115) return 0.5446390350150271;
    if (index === 116) return 0.848048096156426;
    if (index === 117) return 0.5299192642332049;
    if (index === 118) return 0.8571673007021123;
    if (index === 119) return 0.5150380749100542;
    if (index === 120) return 0.8660254037844386;
    if (index === 121) return 0.5000000000000001;
    if (index === 122) return 0.8746197071393957;
    if (index === 123) return 0.4848096202463371;
    if (index === 124) return 0.8829475928589269;
    if (index === 125) return 0.46947156278589086;
    if (index === 126) return 0.8910065241883678;
    return 0.4539904997395468;
  }
  if (index < 144) {
    if (index === 128) return 0.898794046299167;
    if (index === 129) return 0.43837114678907746;
    if (index === 130) return 0.9063077870366499;
    if (index === 131) return 0.42261826174069944;
    if (index === 132) return 0.9135454576426009;
    if (index === 133) return 0.4067366430758002;
    if (index === 134) return 0.9205048534524404;
    if (index === 135) return 0.3907311284892737;
    if (index === 136) return 0.9271838545667874;
    if (index === 137) return 0.37460659341591196;
    if (index === 138) return 0.9335804264972017;
    if (index === 139) return 0.3583679495453004;
    if (index === 140) return 0.9396926207859083;
    if (index === 141) return 0.3420201433256688;
    if (index === 142) return 0.9455185755993167;
    return 0.32556815445715676;
  }
  if (index < 160) {
    if (index === 144) return 0.9510565162951535;
    if (index === 145) return 0.30901699437494745;
    if (index === 146) return 0.9563047559630354;
    if (index === 147) return 0.29237170472273677;
    if (index === 148) return 0.9612616959383189;
    if (index === 149) return 0.27563735581699916;
    if (index === 150) return 0.9659258262890683;
    if (index === 151) return 0.25881904510252074;
    if (index === 152) return 0.9702957262759965;
    if (index === 153) return 0.24192189559966767;
    if (index === 154) return 0.9743700647852352;
    if (index === 155) return 0.22495105434386492;
    if (index === 156) return 0.9781476007338056;
    if (index === 157) return 0.20791169081775945;
    if (index === 158) return 0.981627183447664;
    return 0.19080899537654492;
  }
  if (index < 162) {
    if (index === 160) return 0.984807753012208;
    return 0.17364817766693041;
  }
  return 0;
}

export function bevelSin(degrees: number): number { return bevelCoefficient(degrees * 2); }
export function bevelCos(degrees: number): number { return bevelCoefficient(degrees * 2 + 1); }
