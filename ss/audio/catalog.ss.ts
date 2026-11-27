// Starlux 250 Semantic Interface Audio Catalog (10 families x 25 effects, 18 exact M3 X-scores).
// Pure scalar/record functions: 0 module aggregate literals, 100% 4-target Starscript admissible.

import type { AudioCue, AudioHit } from "./format.ss.ts";

function mkHit(
  startFrames: number, frames: number, hz10: number, endRatioQ16: number,
  gainQ15: number, brightQ15: number, noiseQ15: number, material: number,
  noiseKind: number, attackFrames: number, noiseDecayFrames: number,
  noiseStopFrames: number, decayFactorQ15: number, exactDetune: boolean,
): AudioHit {
  return {
    startFrames, frames, hz10, endRatioQ16, gainQ15, brightQ15, noiseQ15,
    material, noiseKind, attackFrames, noiseDecayFrames, noiseStopFrames,
    decayFactorQ15, exactDetune,
  };
}

function mkCue(
  id: number, slug: string, family: number, description: string, recipe: string,
  durationMs: number, peakDbfs: number, peakQ15: number, cooldownMs: number,
  classId: number, triggerKind: string, triggerTransition: string, isKinetic: boolean,
  hits: readonly AudioHit[],
): AudioCue {
  return {
    id, slug, family, description, recipe, durationMs, peakDbfs, peakQ15,
    cooldownMs, cooldownFrames: cooldownMs * 48, classId, triggerKind,
    triggerTransition, isKinetic, hits,
  };
}

function familyCue0(id: number): AudioCue {
  if (id === 1) return mkCue(1,"nav.forward",0,"Enter the next route in browsing history","A520/650 p",125,-23,2319,100,0,"OS_STATE_CHANGE","historyForward",false,[mkHit(0,6000,5200,65536,962,10486,1311,1,0,0,576,1920,32768,false),mkHit(1500,4500,6500,65536,769,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 2) return mkCue(2,"nav.back",0,"Return to the previous route","A650/520 p",125,-23,2319,100,0,"OS_STATE_CHANGE","historyBack",false,[mkHit(0,6000,6500,65536,962,10486,1311,1,0,0,576,1920,32768,false),mkHit(1500,4500,5200,65536,769,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 3) return mkCue(3,"nav.up",0,"Ascend one parent directory","C480/720 p",145,-23,2319,100,0,"OS_STATE_CHANGE","parentEntered",false,[mkHit(0,6960,4800,65536,989,9175,1311,5,0,0,576,1920,32768,false),mkHit(1740,5220,7200,65536,791,9175,1311,5,0,0,576,1920,32768,false)]);
  if (id === 4) return mkCue(4,"nav.home",0,"Arrive at the personal home surface","P392/588 s",230,-22,2602,250,0,"OS_STATE_CHANGE","homeEntered",false,[mkHit(0,11040,3920,65536,1255,5308,0,4,0,384,576,1920,32768,false),mkHit(2760,8280,5880,65536,1004,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 5) return mkCue(5,"nav.root",0,"Reach the top of a navigable hierarchy","C392 b",105,-24,2067,220,0,"SETTLE","rootReached",false,[mkHit(0,5040,3920,65536,1576,3211,7209,5,1,0,576,1920,49152,false)]);
  if (id === 6) return mkCue(6,"nav.tab-next",0,"Move keyboard focus one tab to the right","T740 t",42,-29,1162,70,0,"IMPULSE","tabNext",false,[mkHit(0,2016,7400,65536,730,3932,15729,2,1,0,192,384,32768,false)]);
  if (id === 7) return mkCue(7,"nav.tab-prev",0,"Move keyboard focus one tab to the left","T622 t",42,-29,1162,70,0,"IMPULSE","tabPrevious",false,[mkHit(0,2016,6220,65536,730,3932,15729,2,1,0,192,384,32768,false)]);
  if (id === 8) return mkCue(8,"nav.breadcrumb",0,"Jump to a chosen ancestor in the path","A784/588 p",130,-25,1842,120,0,"OS_STATE_CHANGE","crumbEntered",false,[mkHit(0,6240,7840,65536,764,10486,1311,1,0,0,576,1920,32768,false),mkHit(1560,4680,5880,65536,611,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 9) return mkCue(9,"nav.menu-open",0,"Reveal an application command menu","V415 u",100,-25,1842,110,0,"OS_STATE_CHANGE","menuOpened",false,[mkHit(0,4800,4150,81920,1509,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 10) return mkCue(10,"nav.menu-close",0,"Dismiss a command menu without executing","V415 d",82,-27,1463,110,0,"OS_STATE_CHANGE","menuDismissed",false,[mkHit(0,3936,4150,49152,1199,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 11) return mkCue(11,"nav.submenu-in",0,"Open a nested command branch","A660 u",85,-27,1463,90,0,"OS_STATE_CHANGE","submenuEntered",false,[mkHit(0,4080,6600,81920,1060,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 12) return mkCue(12,"nav.submenu-out",0,"Return from a nested command branch","A660 d",85,-27,1463,90,0,"OS_STATE_CHANGE","submenuExited",false,[mkHit(0,4080,6600,49152,1060,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 13) return mkCue(13,"nav.combo-open",0,"Reveal selectable values below a field","G880 u",105,-25,1842,110,0,"OS_STATE_CHANGE","comboOpen",false,[mkHit(0,5040,8800,81920,1190,16384,2621,0,0,0,576,1920,32768,false)]);
  if (id === 14) return mkCue(14,"nav.combo-select",0,"Commit an option and return to its field","C990/1320 p",135,-22,2602,110,0,"OS_STATE_CHANGE","comboSelect",false,[mkHit(0,6480,9900,65536,1110,9175,1311,5,0,0,576,1920,32768,false),mkHit(1620,4860,13200,65536,888,9175,1311,5,0,0,576,1920,32768,false)]);
  if (id === 15) return mkCue(15,"nav.combo-empty",0,"Filtering removes the last available option","V247 b",95,-27,1463,300,0,"OS_STATE_CHANGE","optionsBecameEmpty",false,[mkHit(0,4560,2470,65536,1153,1720,7209,3,1,0,576,1920,49152,false)]);
  if (id === 16) return mkCue(16,"nav.search-start",0,"Open the search surface with input focus","P494 u",130,-25,1842,220,0,"OS_STATE_CHANGE","searchEntered",false,[mkHit(0,6240,4940,81920,1300,11796,2621,4,0,0,576,1920,32768,false)]);
  if (id === 17) return mkCue(17,"nav.result-step",0,"Move to another search result","V880 t",36,-31,923,70,2,"IMPULSE","resultAdvanced",false,[mkHit(0,1728,8800,65536,612,983,15729,3,1,0,192,384,32768,false)]);
  if (id === 18) return mkCue(18,"nav.result-wrap",0,"Search selection wraps from last to first","A660/990 p",110,-27,1463,160,0,"BOUNDARY_HIT","resultWrapped",false,[mkHit(0,5280,6600,65536,607,10486,1311,1,0,0,576,1920,32768,false),mkHit(1320,3960,9900,65536,485,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 19) return mkCue(19,"nav.page-next",0,"Advance one paginated content page","V560 w",105,-25,1842,150,0,"OS_STATE_CHANGE","pageAdvanced",false,[mkHit(0,5040,5600,65536,1057,1475,22938,3,1,0,1152,1920,32768,false)]);
  if (id === 20) return mkCue(20,"nav.page-prev",0,"Return one paginated content page","V420 w",105,-25,1842,150,0,"OS_STATE_CHANGE","pageRetreated",false,[mkHit(0,5040,4200,65536,1057,1475,22938,3,1,0,1152,1920,32768,false)]);
  if (id === 21) return mkCue(21,"nav.anchor",0,"Land at an in-document heading","C784 p",90,-26,1642,130,0,"SETTLE","anchorReached",false,[mkHit(0,4320,7840,65536,1261,9175,1311,5,0,0,576,1920,32768,false)]);
  if (id === 22) return mkCue(22,"nav.jump-return",0,"Return to the saved reading location","P660/495 s",160,-25,1842,180,0,"SETTLE","readingAnchorRestored",false,[mkHit(0,7680,6600,65536,889,5308,0,4,0,384,576,1920,32768,false),mkHit(1920,5760,4950,65536,711,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 23) return mkCue(23,"nav.landmark",0,"Screen navigation enters a new landmark","A587 p",115,-27,1463,180,0,"OS_STATE_CHANGE","landmarkEntered",false,[mkHit(0,5520,5870,65536,1092,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 24) return mkCue(24,"nav.workspace-switch",0,"Activate another named workspace","T392/587 u",210,-23,2319,250,0,"OS_STATE_CHANGE","workspaceChanged",false,[mkHit(0,10080,3920,81920,785,19661,2621,2,0,0,576,1920,32768,false),mkHit(2520,7560,5870,81920,628,19661,2621,2,0,0,576,1920,32768,false)]);
  return mkCue(25,"nav.history-end",0,"Back or forward has no further entry","V196 t",52,-28,1304,260,0,"BOUNDARY_HIT","historyExhausted",false,[mkHit(0,2496,1960,65536,865,983,15729,3,1,0,192,384,32768,false)]);
}

function familyCue1(id: number): AudioCue {
  if (id === 26) return mkCue(26,"control.hover",1,"Pointer enters a different eligible target","G3400 Xhover",50,-31,923,70,1,"IMPULSE","hoverEnter",true,[mkHit(0,2400,34000,65536,590,8192,0,0,0,0,576,1920,32768,true)]);
  if (id === 27) return mkCue(27,"control.press",1,"Cap compresses on pointer or key down","G1250 Xpress",70,-23,2319,24,3,"IMPULSE","down",false,[mkHit(0,3360,12500,65536,1802,8192,16384,0,0,0,576,1920,32768,true)]);
  if (id === 28) return mkCue(28,"control.release",1,"Activated cap springs back on release inside","G2350 Xrelease",160,-21,2920,24,3,"SNAP_RELEASE","upInside",false,[mkHit(0,7680,23500,65536,2130,18022,7209,0,0,0,576,1920,32768,true)]);
  if (id === 29) return mkCue(29,"control.check",1,"A checkbox becomes checked","C880 k",68,-24,2067,75,0,"OS_STATE_CHANGE","checked",false,[mkHit(0,3264,8800,65536,1363,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 30) return mkCue(30,"control.uncheck",1,"A checked box becomes clear","C587 b",60,-26,1642,75,0,"OS_STATE_CHANGE","unchecked",false,[mkHit(0,2880,5870,65536,1252,3211,7209,5,1,0,576,1920,49152,false)]);
  if (id === 31) return mkCue(31,"control.mixed",1,"A parent checkbox gains mixed selection","T523/659 t",85,-26,1642,110,0,"OS_STATE_CHANGE","checkMixed",false,[mkHit(0,4080,5230,65536,573,3932,15729,2,1,0,192,384,32768,false),mkHit(1020,3060,6590,65536,458,3932,15729,2,1,0,192,384,32768,false)]);
  if (id === 32) return mkCue(32,"control.radio-on",1,"Commit the exclusive choice in a group","A988 p",85,-24,2067,75,0,"OS_STATE_CHANGE","radioSelected",false,[mkHit(0,4080,9880,65536,1543,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 33) return mkCue(33,"control.latch",1,"A physical-style switch engages","T450/900 k",105,-22,2602,90,0,"SNAP_ENGAGE","switchLatched",false,[mkHit(0,5040,4500,65536,830,14746,10486,2,0,0,576,1920,32768,false),mkHit(1260,3780,9000,65536,664,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 34) return mkCue(34,"control.unlatch",1,"Release an engaged physical-style switch","T900/450 b",105,-24,2067,90,0,"SNAP_RELEASE","switchReleased",false,[mkHit(0,5040,9000,65536,811,6881,7209,2,1,0,576,1920,49152,false),mkHit(1260,3780,4500,65536,648,6881,7209,2,1,0,576,1920,49152,false)]);
  if (id === 35) return mkCue(35,"control.slider-step",1,"Slider crosses one discrete value","V740 t",32,-30,1036,65,2,"IMPULSE","sliderIncrement",true,[mkHit(0,1536,7400,65536,687,983,15729,3,1,0,192,384,32768,false)]);
  if (id === 36) return mkCue(36,"control.slider-zero",1,"Bipolar slider crosses its neutral point","C1046 k",68,-25,1842,100,0,"SNAP_ENGAGE","neutralCrossed",false,[mkHit(0,3264,10460,65536,1215,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 37) return mkCue(37,"control.slider-end",1,"Slider reaches its travel stop","V311 b",64,-24,2067,150,0,"BOUNDARY_HIT","sliderStop",false,[mkHit(0,3072,3110,65536,1629,1720,7209,3,1,0,576,1920,49152,false)]);
  if (id === 38) return mkCue(38,"control.knob-detent",1,"Rotary encoder engages a physical detent","T660 t",36,-29,1162,65,2,"SNAP_ENGAGE","rotaryDetent",true,[mkHit(0,1728,6600,65536,730,3932,15729,2,1,0,192,384,32768,false)]);
  if (id === 39) return mkCue(39,"control.knob-wrap",1,"Cyclic knob crosses its displayed origin","T660/990 k",90,-25,1842,130,0,"OS_STATE_CHANGE","rotaryWrapped",false,[mkHit(0,4320,6600,65536,588,14746,10486,2,0,0,576,1920,32768,false),mkHit(1080,3240,9900,65536,470,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 40) return mkCue(40,"control.field-focus",1,"Text field acquires editing focus","V554 s",70,-30,1036,100,0,"OS_STATE_CHANGE","editFocusIn",false,[mkHit(0,3360,5540,65536,974,2212,0,3,0,384,576,1920,32768,false)]);
  if (id === 41) return mkCue(41,"control.field-blur",1,"Editing focus leaves an unchanged field","V415 s",65,-31,923,100,0,"OS_STATE_CHANGE","editFocusOut",false,[mkHit(0,3120,4150,65536,868,2212,0,3,0,384,576,1920,32768,false)]);
  if (id === 42) return mkCue(42,"control.field-valid",1,"Previously invalid input becomes valid","A659/824 p",135,-25,1842,230,0,"OS_STATE_CHANGE","fieldValidated",false,[mkHit(0,6480,6590,65536,764,10486,1311,1,0,0,576,1920,32768,false),mkHit(1620,4860,8240,65536,611,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 43) return mkCue(43,"control.field-invalid",1,"Committed input fails field validation","V330/294 b",135,-24,2067,350,0,"OS_STATE_CHANGE","fieldRejected",false,[mkHit(0,6480,3300,65536,905,1720,7209,3,1,0,576,1920,49152,false),mkHit(1620,4860,2940,65536,724,1720,7209,3,1,0,576,1920,49152,false)]);
  if (id === 44) return mkCue(44,"control.drag-arm",1,"Held handle becomes draggable","T494 u",85,-25,1842,130,0,"SNAP_ENGAGE","dragArmed",true,[mkHit(0,4080,4940,81920,1122,19661,2621,2,0,0,576,1920,32768,false)]);
  if (id === 45) return mkCue(45,"control.long-press",1,"Hold crosses the alternate-action threshold","P392/784 u",160,-23,2319,260,0,"OS_STATE_CHANGE","holdQualified",false,[mkHit(0,7680,3920,81920,909,11796,2621,4,0,0,576,1920,32768,false),mkHit(1920,5760,7840,81920,727,11796,2621,4,0,0,576,1920,32768,false)]);
  if (id === 46) return mkCue(46,"control.cancel-press",1,"Pointer leaves while a cap is still down","V370 d",62,-30,1036,90,3,"SNAP_RELEASE","pressCancelled",false,[mkHit(0,2976,3700,49152,849,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 47) return mkCue(47,"control.chip-add",1,"Add a token to a multivalue field","C1175 p",78,-25,1842,90,0,"OS_STATE_CHANGE","chipInserted",false,[mkHit(0,3744,11750,65536,1415,9175,1311,5,0,0,576,1920,32768,false)]);
  if (id === 48) return mkCue(48,"control.chip-remove",1,"Remove one token from a multivalue field","C784 d",75,-26,1642,90,0,"OS_STATE_CHANGE","chipRemoved",false,[mkHit(0,3600,7840,49152,1223,9175,2621,5,0,0,576,1920,32768,false)]);
  if (id === 49) return mkCue(49,"control.segment",1,"Commit a different segmented-control mode","A830 k",74,-25,1842,85,0,"OS_STATE_CHANGE","segmentChanged",false,[mkHit(0,3552,8300,65536,1192,7864,10486,1,0,0,576,1920,32768,false)]);
  return mkCue(50,"control.reset",1,"Restore one control's declared default","P784/523 s",155,-25,1842,220,0,"OS_STATE_CHANGE","controlDefaulted",false,[mkHit(0,7440,7840,65536,889,5308,0,4,0,384,576,1920,32768,false),mkHit(1860,5580,5230,65536,711,5308,0,4,0,384,576,1920,32768,false)]);
}

function familyCue2(id: number): AudioCue {
  if (id === 51) return mkCue(51,"window.create",2,"A new top-level pane becomes available","A440/660 u",225,-22,2602,200,0,"OS_STATE_CHANGE","windowCreated",false,[mkHit(0,10800,4400,81920,1048,10486,2621,1,0,0,576,1920,32768,false),mkHit(2700,8100,6600,81920,838,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 52) return mkCue(52,"window.focus",2,"Input focus enters an existing pane","G830 p",100,-26,1642,130,0,"OS_STATE_CHANGE","windowFocused",false,[mkHit(0,4800,8300,65536,1089,16384,1311,0,0,0,576,1920,32768,false)]);
  if (id === 53) return mkCue(53,"window.raise",2,"Bring a pane forward without changing focus","T622 u",110,-27,1463,140,0,"OS_STATE_CHANGE","zOrderRaised",false,[mkHit(0,5280,6220,81920,891,19661,2621,2,0,0,576,1920,32768,false)]);
  if (id === 54) return mkCue(54,"window.lower",2,"Send a visible pane behind its sibling","T622 d",110,-27,1463,140,0,"OS_STATE_CHANGE","zOrderLowered",false,[mkHit(0,5280,6220,49152,891,19661,2621,2,0,0,576,1920,32768,false)]);
  if (id === 55) return mkCue(55,"window.min",2,"Empty pane starts its trip to the dock","G1760/1318.5 Xmin",270,-22,2602,160,0,"OS_STATE_CHANGE","min",false,[mkHit(0,6720,17600,65536,1301,16384,9830,0,0,0,576,1920,32768,true),mkHit(3360,9600,13185,65536,1301,16384,9830,0,0,0,576,1920,32768,true)]);
  if (id === 56) return mkCue(56,"window.restore",2,"Docked pane starts returning to the desk","G1318.5/1760 Xrestore",270,-22,2602,160,0,"OS_STATE_CHANGE","restore",false,[mkHit(0,6720,13185,65536,1301,16384,9830,0,0,0,576,1920,32768,true),mkHit(3360,9600,17600,65536,1301,16384,9830,0,0,0,576,1920,32768,true)]);
  if (id === 57) return mkCue(57,"window.max",2,"Expand a pane to its workspace bounds","G1568/2093 Xmax",260,-22,2602,160,0,"OS_STATE_CHANGE","maximize",false,[mkHit(0,5760,15680,65536,1301,16384,9830,0,0,0,576,1920,32768,true),mkHit(2880,9600,20930,65536,1301,16384,9830,0,0,0,576,1920,32768,true)]);
  if (id === 58) return mkCue(58,"window.unmax",2,"Return a maximized pane to saved bounds","G2093/1568 Xunmax",260,-22,2602,160,0,"OS_STATE_CHANGE","unmaximize",false,[mkHit(0,5760,20930,65536,1301,16384,9830,0,0,0,576,1920,32768,true),mkHit(2880,9600,15680,65536,1301,16384,9830,0,0,0,576,1920,32768,true)]);
  if (id === 59) return mkCue(59,"window.close",2,"A pane accepts its close operation","G990 Xclose",140,-23,2319,180,0,"OS_STATE_CHANGE","windowClosed",false,[mkHit(0,6720,9900,65536,1966,9830,9830,0,0,0,576,1920,32768,true)]);
  if (id === 60) return mkCue(60,"window.resize-start",2,"A resize handle takes pointer capture","T370 k",65,-27,1463,120,0,"IMPULSE","resizeBegin",true,[mkHit(0,3120,3700,65536,840,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 61) return mkCue(61,"window.resize-step",2,"Stepped resize crosses a size increment","V466 t",35,-31,923,80,2,"IMPULSE","sizeIncrement",true,[mkHit(0,1680,4660,65536,612,983,15729,3,1,0,192,384,32768,false)]);
  if (id === 62) return mkCue(62,"window.resize-end",2,"A changed pane size is committed","A554 p",100,-25,1842,140,0,"SETTLE","resizeCommitted",false,[mkHit(0,4800,5540,65536,1375,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 63) return mkCue(63,"window.lock-size",2,"Fix a pane's current extent","C370 k",85,-24,2067,160,0,"SNAP_ENGAGE","sizeLocked",false,[mkHit(0,4080,3700,65536,1363,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 64) return mkCue(64,"window.unlock-size",2,"Permit free resizing again","C555 u",90,-25,1842,160,0,"SNAP_RELEASE","sizeUnlocked",false,[mkHit(0,4320,5550,81920,1372,9175,2621,5,0,0,576,1920,32768,false)]);
  if (id === 65) return mkCue(65,"window.split-view",2,"Create two views of one document","T440/880 p",155,-24,2067,200,0,"OS_STATE_CHANGE","viewSplit",false,[mkHit(0,7440,4400,65536,717,19661,1311,2,0,0,576,1920,32768,false),mkHit(1860,5580,8800,65536,574,19661,1311,2,0,0,576,1920,32768,false)]);
  if (id === 66) return mkCue(66,"window.join-view",2,"Merge two views of one document","T880/440 p",155,-24,2067,200,0,"OS_STATE_CHANGE","viewsJoined",false,[mkHit(0,7440,8800,65536,717,19661,1311,2,0,0,576,1920,32768,false),mkHit(1860,5580,4400,65536,574,19661,1311,2,0,0,576,1920,32768,false)]);
  if (id === 67) return mkCue(67,"window.picture-in",2,"Detach media into a floating mini-player","A740/1110 u",180,-25,1842,200,0,"OS_STATE_CHANGE","pictureDetached",false,[mkHit(0,8640,7400,81920,742,10486,2621,1,0,0,576,1920,32768,false),mkHit(2160,6480,11100,81920,593,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 68) return mkCue(68,"window.picture-out",2,"Return floating media to its owner","A1110/740 d",180,-25,1842,200,0,"OS_STATE_CHANGE","pictureReturned",false,[mkHit(0,8640,11100,49152,742,10486,2621,1,0,0,576,1920,32768,false),mkHit(2160,6480,7400,49152,593,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 69) return mkCue(69,"window.shade",2,"Roll content up to the title bar","V698 d",130,-26,1642,170,0,"OS_STATE_CHANGE","paneShaded",false,[mkHit(0,6240,6980,49152,1345,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 70) return mkCue(70,"window.unshade",2,"Reveal content under the title bar","V698 u",130,-26,1642,170,0,"OS_STATE_CHANGE","paneUnshaded",false,[mkHit(0,6240,6980,81920,1345,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 71) return mkCue(71,"window.fullscreen",2,"Enter exclusive display presentation","P392/784 s",245,-23,2319,300,0,"OS_STATE_CHANGE","fullscreenEntered",false,[mkHit(0,11760,3920,65536,1119,5308,0,4,0,384,576,1920,32768,false),mkHit(2940,8820,7840,65536,895,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 72) return mkCue(72,"window.fullscreen-exit",2,"Leave exclusive display presentation","P784/392 s",225,-24,2067,300,0,"OS_STATE_CHANGE","fullscreenExited",false,[mkHit(0,10800,7840,65536,997,5308,0,4,0,384,576,1920,32768,false),mkHit(2700,8100,3920,65536,798,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 73) return mkCue(73,"window.move-display",2,"Transfer ownership to another display","T494/740 p",175,-24,2067,220,0,"OS_STATE_CHANGE","displayTransferred",false,[mkHit(0,8400,4940,65536,717,19661,1311,2,0,0,576,1920,32768,false),mkHit(2100,6300,7400,65536,574,19661,1311,2,0,0,576,1920,32768,false)]);
  if (id === 74) return mkCue(74,"window.modal-block",2,"A modal intercepts input to its parent","V233/311 b",115,-24,2067,260,0,"BOUNDARY_HIT","modalIntercept",false,[mkHit(0,5520,2330,65536,905,1720,7209,3,1,0,576,1920,49152,false),mkHit(1380,4140,3110,65536,724,1720,7209,3,1,0,576,1920,49152,false)]);
  return mkCue(75,"window.last-window",2,"Closing a pane leaves the workspace empty","A392/294 s",260,-26,1642,350,0,"OS_STATE_CHANGE","workspaceEmpty",false,[mkHit(0,12480,3920,65536,804,4719,0,1,0,384,576,1920,32768,false),mkHit(3120,9360,2940,65536,643,4719,0,1,0,384,576,1920,32768,false)]);
}

function familyCue3(id: number): AudioCue {
  if (id === 76) return mkCue(76,"magnetic.enter",3,"Dragged body enters an attractor's radius","T330 s",75,-30,1036,100,0,"IMPULSE","fieldEntered",true,[mkHit(0,3600,3300,65536,827,8847,0,2,0,384,576,1920,32768,false)]);
  if (id === 77) return mkCue(77,"magnetic.engage",3,"Attraction crosses the latch threshold","T588 k",105,-22,2602,100,0,"SNAP_ENGAGE","latch",false,[mkHit(0,5040,5880,65536,1494,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 78) return mkCue(78,"magnetic.release",3,"Body leaves a latched target normally","T588 d",85,-26,1642,100,0,"SNAP_RELEASE","unlatch",false,[mkHit(0,4080,5880,49152,1000,19661,2621,2,0,0,576,1920,32768,false)]);
  if (id === 79) return mkCue(79,"magnetic.corner",3,"A corner target wins capture","C660/990 k",120,-24,2067,130,0,"SNAP_ENGAGE","cornerCaptured",false,[mkHit(0,5760,6600,65536,757,6881,10486,5,0,0,576,1920,32768,false),mkHit(1440,4320,9900,65536,606,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 80) return mkCue(80,"magnetic.edge",3,"A screen edge wins capture","T524 k",85,-25,1842,120,0,"SNAP_ENGAGE","edgeCaptured",false,[mkHit(0,4080,5240,65536,1058,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 81) return mkCue(81,"magnetic.center",3,"Body locks to a target's center point","A784 p",100,-25,1842,140,0,"SNAP_ENGAGE","centerCaptured",false,[mkHit(0,4800,7840,65536,1375,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 82) return mkCue(82,"magnetic.repel",3,"Incompatible targets push apart","V277 d",96,-25,1842,150,0,"BOUNDARY_HIT","repulsion",false,[mkHit(0,4608,2770,49152,1509,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 83) return mkCue(83,"magnetic.push",3,"A moving tile first displaces a neighbor","V392 b",85,-27,1463,110,0,"IMPULSE","neighborDisplaced",true,[mkHit(0,4080,3920,65536,1153,1720,7209,3,1,0,576,1920,49152,false)]);
  if (id === 84) return mkCue(84,"magnetic.return",3,"A displaced neighbor returns to its slot","A494 s",130,-28,1304,150,0,"SETTLE","neighborReturned",false,[mkHit(0,6240,4940,65536,1149,4719,0,1,0,384,576,1920,32768,false)]);
  if (id === 85) return mkCue(85,"magnetic.ghost",3,"Dwell reveals a valid placement preview","G1109 s",75,-31,923,150,0,"OS_STATE_CHANGE","previewQualified",true,[mkHit(0,3600,11090,65536,762,7373,0,0,0,384,576,1920,32768,false)]);
  if (id === 86) return mkCue(86,"magnetic.swap",3,"Two panes commit exchanged slots","T494/740 k",155,-23,2319,180,0,"OS_STATE_CHANGE","slotsSwapped",false,[mkHit(0,7440,4940,65536,740,14746,10486,2,0,0,576,1920,32768,false),mkHit(1860,5580,7400,65536,592,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 87) return mkCue(87,"magnetic.split",3,"Docking divides a neighbor's occupied slot","C523/784 k",150,-24,2067,180,0,"OS_STATE_CHANGE","slotDivided",false,[mkHit(0,7200,5230,65536,757,6881,10486,5,0,0,576,1920,32768,false),mkHit(1800,5400,7840,65536,606,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 88) return mkCue(88,"magnetic.stack",3,"Drop groups panes in one stack","V349/523 b",130,-25,1842,170,0,"SNAP_ENGAGE","stackFormed",false,[mkHit(0,6240,3490,65536,806,1720,7209,3,1,0,576,1920,49152,false),mkHit(1560,4680,5230,65536,645,1720,7209,3,1,0,576,1920,49152,false)]);
  if (id === 89) return mkCue(89,"magnetic.unstack",3,"Pull an item free from a tile stack","V523/698 u",140,-25,1842,170,0,"SNAP_RELEASE","stackDetached",false,[mkHit(0,6720,5230,81920,838,4915,2621,3,0,0,576,1920,32768,false),mkHit(1680,5040,6980,81920,671,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 90) return mkCue(90,"magnetic.align-x",3,"Left or right edges become collinear","T880 t",48,-28,1304,90,2,"SNAP_ENGAGE","xAligned",false,[mkHit(0,2304,8800,65536,819,3932,15729,2,1,0,192,384,32768,false)]);
  if (id === 91) return mkCue(91,"magnetic.align-y",3,"Top or bottom edges become collinear","T1046 t",48,-28,1304,90,2,"SNAP_ENGAGE","yAligned",false,[mkHit(0,2304,10460,65536,819,3932,15729,2,1,0,192,384,32768,false)]);
  if (id === 92) return mkCue(92,"magnetic.grid",3,"Item snaps to a grid intersection","C932 t",50,-28,1304,90,2,"SNAP_ENGAGE","gridPoint",false,[mkHit(0,2400,9320,65536,851,1835,15729,5,1,0,192,384,32768,false)]);
  if (id === 93) return mkCue(93,"magnetic.guide-on",3,"A persistent alignment guide catches","G1046 p",80,-28,1304,120,0,"SNAP_ENGAGE","guideCaught",false,[mkHit(0,3840,10460,65536,865,16384,1311,0,0,0,576,1920,32768,false)]);
  if (id === 94) return mkCue(94,"magnetic.guide-off",3,"Release a persistent alignment guide","G698 d",68,-29,1162,120,0,"SNAP_RELEASE","guideReleased",false,[mkHit(0,3264,6980,49152,751,16384,2621,0,0,0,576,1920,32768,false)]);
  if (id === 95) return mkCue(95,"magnetic.flush",3,"Two exterior edges meet flush","C440 k",85,-25,1842,130,0,"SNAP_ENGAGE","flushContact",false,[mkHit(0,4080,4400,65536,1215,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 96) return mkCue(96,"magnetic.gap",3,"Drag reaches the prescribed gutter","A587 t",58,-27,1463,110,0,"SNAP_ENGAGE","gutterMatched",false,[mkHit(0,2784,5870,65536,950,2097,15729,1,1,0,192,384,32768,false)]);
  if (id === 97) return mkCue(97,"magnetic.equalize",3,"Three or more objects reach equal spacing","A523/659/784 p",175,-25,1842,200,0,"SNAP_ENGAGE","equalSpacing",false,[mkHit(0,8400,5230,65536,554,10486,1311,1,0,0,576,1920,32768,false),mkHit(1400,7000,6590,65536,444,10486,1311,1,0,0,576,1920,32768,false),mkHit(2800,5600,7840,65536,377,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 98) return mkCue(98,"magnetic.breakaway",3,"A fast flick overcomes magnetic capture","T740 w",105,-24,2067,170,0,"SNAP_RELEASE","velocityBreakaway",false,[mkHit(0,5040,7400,65536,1106,5898,22938,2,1,0,1152,1920,32768,false)]);
  if (id === 99) return mkCue(99,"magnetic.reject",3,"Proposed tile cannot fit the available space","V247/196 b",130,-24,2067,250,0,"BOUNDARY_HIT","slotTooSmall",false,[mkHit(0,6240,2470,65536,905,1720,7209,3,1,0,576,1920,49152,false),mkHit(1560,4680,1960,65536,724,1720,7209,3,1,0,576,1920,49152,false)]);
  return mkCue(100,"magnetic.settle",3,"Coupled layout reaches its shared target","T392 s",110,-28,1304,180,0,"SETTLE","neighborsHome",false,[mkHit(0,5280,3920,65536,1041,8847,0,2,0,384,576,1920,32768,false)]);
}

function familyCue4(id: number): AudioCue {
  if (id === 101) return mkCue(101,"dock.ignite",4,"First launch lights the application's ember","G740/2960 Xignite",610,-22,2602,400,0,"OS_STATE_CHANGE","appFirstLaunch",false,[mkHit(0,24000,7400,131072,1904,13107,9830,0,0,0,576,1920,32768,true),mkHit(2880,26400,29600,65536,698,9830,0,0,0,0,576,1920,32768,true)]);
  if (id === 102) return mkCue(102,"dock.rekindle",4,"Running app regains focus from its dock item","G1480 Xrekindle",220,-24,2067,200,0,"OS_STATE_CHANGE","appReactivated",false,[mkHit(0,10560,14800,65536,1475,13107,6554,0,0,0,576,1920,32768,true)]);
  if (id === 103) return mkCue(103,"dock.cool",4,"Focus leaves an app that stays running","G1175 Xcool",200,-28,1304,240,0,"OS_STATE_CHANGE","runningAppBlurred",false,[mkHit(0,9600,11750,45875,983,6554,0,0,0,0,576,1920,32768,true)]);
  if (id === 104) return mkCue(104,"dock.out",4,"Last app instance quits and its ember goes out","G1480 Xout",260,-25,1842,300,0,"OS_STATE_CHANGE","appExtinguished",false,[mkHit(0,12480,14800,32768,1311,9830,3277,0,0,0,576,1920,32768,true)]);
  if (id === 105) return mkCue(105,"dock.land",4,"Arriving pane transfers its impulse into the dock","G1975.5 Xland",220,-24,2067,160,0,"SETTLE","dockContact",false,[mkHit(0,10560,19755,65536,1475,14746,4915,0,0,0,576,1920,32768,true)]);
  if (id === 106) return mkCue(106,"dock.launch",4,"Dock accepts a launch request before app readiness","V392 u",90,-27,1463,180,0,"IMPULSE","launchRequested",false,[mkHit(0,4320,3920,81920,1199,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 107) return mkCue(107,"dock.pin",4,"Keep an application after it exits","C740 k",82,-25,1842,150,0,"SNAP_ENGAGE","itemPinned",false,[mkHit(0,3936,7400,65536,1215,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 108) return mkCue(108,"dock.unpin",4,"Remove an application's persistent pin","C494 d",78,-26,1642,150,0,"SNAP_RELEASE","itemUnpinned",false,[mkHit(0,3744,4940,49152,1223,9175,2621,5,0,0,576,1920,32768,false)]);
  if (id === 109) return mkCue(109,"dock.pick",4,"Lift a dock item for reordering","T554 u",88,-26,1642,110,0,"IMPULSE","dockLift",true,[mkHit(0,4224,5540,81920,1000,19661,2621,2,0,0,576,1920,32768,false)]);
  if (id === 110) return mkCue(110,"dock.reorder",4,"Drag crosses a new insertion index","V622 t",36,-29,1162,70,2,"IMPULSE","dockIndexChanged",true,[mkHit(0,1728,6220,65536,771,983,15729,3,1,0,192,384,32768,false)]);
  if (id === 111) return mkCue(111,"dock.insert",4,"Drop an external item into the dock","A659/988 p",145,-24,2067,150,0,"SNAP_ENGAGE","externalItemInserted",false,[mkHit(0,6960,6590,65536,857,10486,1311,1,0,0,576,1920,32768,false),mkHit(1740,5220,9880,65536,686,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 112) return mkCue(112,"dock.eject",4,"Drop a removable item outside its dock","V440 w",105,-25,1842,180,0,"SNAP_RELEASE","itemEjected",false,[mkHit(0,5040,4400,65536,1057,1475,22938,3,1,0,1152,1920,32768,false)]);
  if (id === 113) return mkCue(113,"dock.folder-open",4,"Expand a dock folder into its contents","A523/784 u",170,-25,1842,160,0,"OS_STATE_CHANGE","dockFolderOpened",false,[mkHit(0,8160,5230,81920,742,10486,2621,1,0,0,576,1920,32768,false),mkHit(2040,6120,7840,81920,593,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 114) return mkCue(114,"dock.folder-close",4,"Fold contents back into the folder","A784/523 d",150,-26,1642,160,0,"OS_STATE_CHANGE","dockFolderClosed",false,[mkHit(0,7200,7840,49152,661,10486,2621,1,0,0,576,1920,32768,false),mkHit(1800,5400,5230,49152,529,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 115) return mkCue(115,"dock.stack-peek",4,"Preview the windows behind one app icon","G988 s",105,-28,1304,170,0,"OS_STATE_CHANGE","stackPreviewed",false,[mkHit(0,5040,9880,65536,1077,7373,0,0,0,384,576,1920,32768,false)]);
  if (id === 116) return mkCue(116,"dock.stack-collapse",4,"Dismiss that preview without selecting","G659 s",90,-30,1036,170,0,"OS_STATE_CHANGE","stackPreviewDismissed",false,[mkHit(0,4320,6590,65536,856,7373,0,0,0,384,576,1920,32768,false)]);
  if (id === 117) return mkCue(117,"dock.overflow",4,"Reveal items beyond dock capacity","T494/659 p",130,-25,1842,170,0,"OS_STATE_CHANGE","dockOverflowOpened",false,[mkHit(0,6240,4940,65536,639,19661,1311,2,0,0,576,1920,32768,false),mkHit(1560,4680,6590,65536,511,19661,1311,2,0,0,576,1920,32768,false)]);
  if (id === 118) return mkCue(118,"dock.reveal",4,"An autohidden dock becomes reachable","V494 u",95,-29,1162,250,0,"OS_STATE_CHANGE","dockRevealed",false,[mkHit(0,4560,4940,81920,952,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 119) return mkCue(119,"dock.hide",4,"Autohide retracts the dock after departure","V494 d",95,-30,1036,250,0,"OS_STATE_CHANGE","dockHidden",false,[mkHit(0,4560,4940,49152,849,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 120) return mkCue(120,"dock.magnify",4,"Enter magnification for the first item in a sweep","G1319 s",65,-32,823,200,1,"SNAP_ENGAGE","magnifierEntered",true,[mkHit(0,3120,13190,65536,680,7373,0,0,0,384,576,1920,32768,false)]);
  if (id === 121) return mkCue(121,"dock.favorite",4,"Add a document to dock favorites","P784/988 p",160,-24,2067,180,0,"OS_STATE_CHANGE","favoriteSaved",false,[mkHit(0,7680,7840,65536,834,11796,1311,4,0,0,576,1920,32768,false),mkHit(1920,5760,9880,65536,667,11796,1311,4,0,0,576,1920,32768,false)]);
  if (id === 122) return mkCue(122,"dock.badge",4,"A background app first gains an unread badge","G1175 p",100,-28,1304,500,0,"OS_STATE_CHANGE","badgeAppeared",false,[mkHit(0,4800,11750,65536,865,16384,1311,0,0,0,576,1920,32768,false)]);
  if (id === 123) return mkCue(123,"dock.clear-badge",4,"Reading the final item clears its badge","V660 s",80,-30,1036,300,0,"OS_STATE_CHANGE","badgeCleared",false,[mkHit(0,3840,6600,65536,974,2212,0,3,0,384,576,1920,32768,false)]);
  if (id === 124) return mkCue(124,"dock.bounce",4,"Background app explicitly requests attention","P523/784 k",180,-25,1842,1200,0,"IMPULSE","appAttention",false,[mkHit(0,8640,5230,65536,651,8847,10486,4,0,0,576,1920,32768,false),mkHit(2160,6480,7840,65536,521,8847,10486,4,0,0,576,1920,32768,false)]);
  return mkCue(125,"dock.empty",4,"Removing the final item reveals the empty shelf","A330 s",195,-28,1304,300,0,"OS_STATE_CHANGE","dockBecameEmpty",false,[mkHit(0,9360,3300,65536,1149,4719,0,1,0,384,576,1920,32768,false)]);
}

function familyCue5(id: number): AudioCue {
  if (id === 126) return mkCue(126,"star.listen",5,"Star has entered listening for this turn","G1046.5 Xlisten",320,-24,2067,300,0,"OS_STATE_CHANGE","listening",false,[mkHit(0,15360,10465,65536,1638,6554,1638,0,0,0,576,1920,32768,true)]);
  if (id === 127) return mkCue(127,"star.think",5,"Captured turn has entered reasoning","G1174.7 Xthink",300,-27,1463,350,0,"OS_STATE_CHANGE","thinking",false,[mkHit(0,14400,11747,65536,1147,6554,0,0,0,0,576,1920,32768,true)]);
  if (id === 128) return mkCue(128,"star.tick",5,"A distinct tool step finishes inside a turn","G1568 Xtick",90,-27,1463,140,0,"SETTLE","turnStep",false,[mkHit(0,4320,15680,65536,1311,9830,3277,0,0,0,576,1920,32768,true)]);
  if (id === 129) return mkCue(129,"star.done",5,"The turn and its final action have completed","G1046.5/1318.5/1568/2093 Xdone",835,-21,2920,650,0,"OS_STATE_CHANGE","completed",false,[mkHit(0,33600,10465,65536,730,11469,3277,0,0,0,576,1920,32768,true),mkHit(2160,33600,13185,65536,730,11469,0,0,0,0,576,1920,32768,true),mkHit(4320,33600,15680,65536,730,11469,0,0,0,0,576,1920,32768,true),mkHit(6480,33600,20930,65536,730,11469,0,0,0,0,576,1920,32768,true)]);
  if (id === 130) return mkCue(130,"star.wakeword",5,"Wake detector accepts the addressed phrase","P523/1046 u",190,-24,2067,500,0,"OS_STATE_CHANGE","wakewordAccepted",false,[mkHit(0,9120,5230,81920,810,11796,2621,4,0,0,576,1920,32768,false),mkHit(2280,6840,10460,81920,648,11796,2621,4,0,0,576,1920,32768,false)]);
  if (id === 131) return mkCue(131,"star.partial",5,"First provisional transcript becomes visible","V698 s",70,-31,923,400,0,"OS_STATE_CHANGE","firstPartial",false,[mkHit(0,3360,6980,65536,868,2212,0,3,0,384,576,1920,32768,false)]);
  if (id === 132) return mkCue(132,"star.transcript",5,"Final transcript replaces provisional words","A698/880 p",135,-26,1642,230,0,"OS_STATE_CHANGE","transcriptFinal",false,[mkHit(0,6480,6980,65536,681,10486,1311,1,0,0,576,1920,32768,false),mkHit(1620,4860,8800,65536,545,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 133) return mkCue(133,"star.endpoint",5,"Debounced speech end closes the input segment","V392 d",95,-29,1162,300,0,"VOICE_LEVEL","endpoint",false,[mkHit(0,4560,3920,49152,952,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 134) return mkCue(134,"star.interrupt",5,"User interrupts Star's spoken response","T587 t",55,-25,1842,150,0,"IMPULSE","bargeIn",false,[mkHit(0,2640,5870,65536,1157,3932,15729,2,1,0,192,384,32768,false)]);
  if (id === 135) return mkCue(135,"star.resume",5,"Continue a previously interrupted answer","P494/659 u",175,-26,1642,240,0,"OS_STATE_CHANGE","answerResumed",false,[mkHit(0,8400,4940,81920,644,11796,2621,4,0,0,576,1920,32768,false),mkHit(2100,6300,6590,81920,515,11796,2621,4,0,0,576,1920,32768,false)]);
  if (id === 136) return mkCue(136,"star.speak",5,"First audible response is ready","P659 s",115,-29,1162,300,0,"OS_STATE_CHANGE","speechStarted",false,[mkHit(0,5520,6590,65536,1009,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 137) return mkCue(137,"star.hush",5,"User silences speech while retaining the text","V440 d",85,-29,1162,180,0,"OS_STATE_CHANGE","speechSuppressed",false,[mkHit(0,4080,4400,49152,952,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 138) return mkCue(138,"star.tool-start",5,"An external tool accepts the assistant's call","T415 k",76,-27,1463,170,0,"OS_STATE_CHANGE","toolAccepted",false,[mkHit(0,3648,4150,65536,840,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 139) return mkCue(139,"star.tool-result",5,"Tool returns data that enters turn context","A554/740 p",140,-26,1642,180,0,"OS_STATE_CHANGE","toolResultBound",false,[mkHit(0,6720,5540,65536,681,10486,1311,1,0,0,576,1920,32768,false),mkHit(1680,5040,7400,65536,545,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 140) return mkCue(140,"star.tool-fail",5,"Tool failure requires a change of course","V370/277 b",150,-24,2067,350,4,"OS_STATE_CHANGE","toolFailed",false,[mkHit(0,7200,3700,65536,905,1720,7209,3,1,0,576,1920,49152,false),mkHit(1800,5400,2770,65536,724,1720,7209,3,1,0,576,1920,49152,false)]);
  if (id === 141) return mkCue(141,"star.clarify",5,"Star yields for a required clarification","P587/784 u",190,-24,2067,350,0,"OS_STATE_CHANGE","clarificationRequested",false,[mkHit(0,9120,5870,81920,810,11796,2621,4,0,0,576,1920,32768,false),mkHit(2280,6840,7840,81920,648,11796,2621,4,0,0,576,1920,32768,false)]);
  if (id === 142) return mkCue(142,"star.handoff",5,"Another agent accepts ownership of the turn","T494/659/988 p",225,-24,2067,380,0,"OS_STATE_CHANGE","agentAccepted",false,[mkHit(0,10800,4940,65536,520,19661,1311,2,0,0,576,1920,32768,false),mkHit(1800,9000,6590,65536,416,19661,1311,2,0,0,576,1920,32768,false),mkHit(3600,7200,9880,65536,354,19661,1311,2,0,0,576,1920,32768,false)]);
  if (id === 143) return mkCue(143,"star.mic-lost",5,"The active input device disappears mid-turn","V311/207 d",220,-22,2602,600,0,"OS_STATE_CHANGE","micDisconnected",false,[mkHit(0,10560,3110,49152,1184,4915,2621,3,0,0,576,1920,32768,false),mkHit(2640,7920,2070,49152,948,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 144) return mkCue(144,"star.offline",5,"Star switches to its local capability set","C392/330 b",150,-26,1642,500,0,"OS_STATE_CHANGE","localMode",false,[mkHit(0,7200,3920,65536,695,3211,7209,5,1,0,576,1920,49152,false),mkHit(1800,5400,3300,65536,556,3211,7209,5,1,0,576,1920,49152,false)]);
  if (id === 145) return mkCue(145,"star.retry",5,"User starts a fresh attempt at the same turn","P440/554 u",145,-25,1842,250,0,"IMPULSE","turnRetried",false,[mkHit(0,6960,4400,81920,722,11796,2621,4,0,0,576,1920,32768,false),mkHit(1740,5220,5540,81920,578,11796,2621,4,0,0,576,1920,32768,false)]);
  if (id === 146) return mkCue(146,"star.context",5,"A user-provided file enters turn context","A830 k",74,-27,1463,150,0,"OS_STATE_CHANGE","contextAttached",false,[mkHit(0,3552,8300,65536,947,7864,10486,1,0,0,576,1920,32768,false)]);
  if (id === 147) return mkCue(147,"star.recall",5,"Requested prior context becomes available","P784/659 s",190,-27,1463,260,0,"OS_STATE_CHANGE","memoryRetrieved",false,[mkHit(0,9120,7840,65536,706,5308,0,4,0,384,576,1920,32768,false),mkHit(2280,6840,6590,65536,565,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 148) return mkCue(148,"star.branch",5,"Fork the conversation from a selected turn","T523/784/1046 p",210,-25,1842,270,0,"OS_STATE_CHANGE","orbitForked",false,[mkHit(0,10080,5230,65536,464,19661,1311,2,0,0,576,1920,32768,false),mkHit(1680,8400,7840,65536,371,19661,1311,2,0,0,576,1920,32768,false),mkHit(3360,6720,10460,65536,315,19661,1311,2,0,0,576,1920,32768,false)]);
  if (id === 149) return mkCue(149,"star.accept",5,"User applies Star's proposed artifact change","C660/990 k",145,-23,2319,200,0,"OS_STATE_CHANGE","proposalApplied",false,[mkHit(0,6960,6600,65536,849,6881,10486,5,0,0,576,1920,32768,false),mkHit(1740,5220,9900,65536,680,6881,10486,5,0,0,576,1920,32768,false)]);
  return mkCue(150,"star.dismiss",5,"User dismisses a proposal without applying it","V330 s",105,-29,1162,200,0,"OS_STATE_CHANGE","proposalDismissed",false,[mkHit(0,5040,3300,65536,1093,2212,0,3,0,384,576,1920,32768,false)]);
}

function familyCue6(id: number): AudioCue {
  if (id === 151) return mkCue(151,"canvas.stroke",6,"Stylus first contacts a writable surface","V330 w",55,-30,1036,65,0,"IMPULSE","penContact",true,[mkHit(0,2640,3300,65536,595,1475,22938,3,1,0,1152,1920,32768,false)]);
  if (id === 152) return mkCue(152,"canvas.lift",6,"A nonempty stroke is committed at pen lift","V466 p",45,-31,923,65,0,"SNAP_RELEASE","strokeCommitted",false,[mkHit(0,2160,4660,65536,782,4915,1311,3,0,0,576,1920,32768,false)]);
  if (id === 153) return mkCue(153,"canvas.erase",6,"First eraser contact removes marked content","V277 w",82,-28,1304,110,0,"IMPULSE","eraserContact",true,[mkHit(0,3936,2770,65536,749,1475,22938,3,1,0,1152,1920,32768,false)]);
  if (id === 154) return mkCue(154,"canvas.fill",6,"Flood fill commits a contiguous region","P349 u",145,-26,1642,150,0,"OS_STATE_CHANGE","regionFilled",false,[mkHit(0,6960,3490,81920,1159,11796,2621,4,0,0,576,1920,32768,false)]);
  if (id === 155) return mkCue(155,"canvas.sample",6,"Eyedropper commits a sampled color","G1175 k",65,-26,1642,90,0,"IMPULSE","colorSampled",false,[mkHit(0,3120,11750,65536,983,12288,10486,0,0,0,576,1920,32768,false)]);
  if (id === 156) return mkCue(156,"canvas.mask",6,"Enter editable mask inspection","V523 s",115,-28,1304,150,0,"OS_STATE_CHANGE","maskEditing",false,[mkHit(0,5520,5230,65536,1226,2212,0,3,0,384,576,1920,32768,false)]);
  if (id === 157) return mkCue(157,"canvas.invert",6,"Invert the active selection or mask","T740/554 p",125,-26,1642,160,0,"OS_STATE_CHANGE","maskInverted",false,[mkHit(0,6000,7400,65536,569,19661,1311,2,0,0,576,1920,32768,false),mkHit(1500,4500,5540,65536,456,19661,1311,2,0,0,576,1920,32768,false)]);
  if (id === 158) return mkCue(158,"canvas.layer-new",6,"Insert an empty editable layer","A660/880 p",135,-25,1842,150,0,"OS_STATE_CHANGE","layerCreated",false,[mkHit(0,6480,6600,65536,764,10486,1311,1,0,0,576,1920,32768,false),mkHit(1620,4860,8800,65536,611,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 159) return mkCue(159,"canvas.layer-hide",6,"Eye control removes a layer from composite","V440 b",78,-28,1304,110,0,"OS_STATE_CHANGE","layerHidden",false,[mkHit(0,3744,4400,65536,1027,1720,7209,3,1,0,576,1920,49152,false)]);
  if (id === 160) return mkCue(160,"canvas.layer-show",6,"Eye control restores a hidden layer","A660 p",80,-27,1463,110,0,"OS_STATE_CHANGE","layerShown",false,[mkHit(0,3840,6600,65536,1092,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 161) return mkCue(161,"canvas.layer-merge",6,"Commit two layers into one raster","C660/440 k",155,-24,2067,220,0,"OS_STATE_CHANGE","layersMerged",false,[mkHit(0,7440,6600,65536,757,6881,10486,5,0,0,576,1920,32768,false),mkHit(1860,5580,4400,65536,606,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 162) return mkCue(162,"canvas.layer-lock",6,"Prevent edits to a layer","T370 t",65,-26,1642,140,0,"SNAP_ENGAGE","layerLocked",false,[mkHit(0,3120,3700,65536,1031,3932,15729,2,1,0,192,384,32768,false)]);
  if (id === 163) return mkCue(163,"canvas.blend",6,"A different compositing operator takes effect","P494/622 s",140,-28,1304,130,0,"OS_STATE_CHANGE","blendChanged",false,[mkHit(0,6720,4940,65536,629,5308,0,4,0,384,576,1920,32768,false),mkHit(1680,5040,6220,65536,503,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 164) return mkCue(164,"canvas.opacity",6,"Layer opacity crosses a marked quarter step","V830 t",32,-32,823,80,2,"IMPULSE","opacityMark",true,[mkHit(0,1536,8300,65536,546,983,15729,3,1,0,192,384,32768,false)]);
  if (id === 165) return mkCue(165,"canvas.crop",6,"Commit the new image boundary","C523 k",95,-24,2067,180,0,"OS_STATE_CHANGE","cropApplied",false,[mkHit(0,4560,5230,65536,1363,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 166) return mkCue(166,"canvas.straighten",6,"Rotation captures the horizon detent","T988 t",60,-26,1642,100,0,"SNAP_ENGAGE","horizonAligned",false,[mkHit(0,2880,9880,65536,1031,3932,15729,2,1,0,192,384,32768,false)]);
  if (id === 167) return mkCue(167,"canvas.zoom-in",6,"User crosses one higher zoom stop","A740 u",75,-28,1304,85,0,"IMPULSE","zoomStepIn",false,[mkHit(0,3600,7400,81920,945,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 168) return mkCue(168,"canvas.zoom-out",6,"User crosses one lower zoom stop","A740 d",75,-28,1304,85,0,"IMPULSE","zoomStepOut",false,[mkHit(0,3600,7400,49152,945,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 169) return mkCue(169,"canvas.fit",6,"All artwork fits the viewport again","P440/660 s",155,-26,1642,180,0,"SETTLE","artworkFit",false,[mkHit(0,7440,4400,65536,792,5308,0,4,0,384,576,1920,32768,false),mkHit(1860,5580,6600,65536,634,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 170) return mkCue(170,"canvas.actual",6,"Zoom engages the one-image-pixel scale","C1046 k",85,-26,1642,140,0,"SNAP_ENGAGE","oneToOne",false,[mkHit(0,4080,10460,65536,1083,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 171) return mkCue(171,"canvas.before",6,"Enter original-image comparison","V392 s",78,-29,1162,110,0,"OS_STATE_CHANGE","beforeRevealed",false,[mkHit(0,3744,3920,65536,1093,2212,0,3,0,384,576,1920,32768,false)]);
  if (id === 172) return mkCue(172,"canvas.after",6,"Return from comparison to the graded image","A587 s",82,-28,1304,110,0,"OS_STATE_CHANGE","afterRevealed",false,[mkHit(0,3936,5870,65536,1149,4719,0,1,0,384,576,1920,32768,false)]);
  if (id === 173) return mkCue(173,"canvas.look",6,"Apply a chosen LUT to the current frame","P554/698 p",155,-26,1642,160,0,"OS_STATE_CHANGE","lookApplied",false,[mkHit(0,7440,5540,65536,662,11796,1311,4,0,0,576,1920,32768,false),mkHit(1860,5580,6980,65536,530,11796,1311,4,0,0,576,1920,32768,false)]);
  if (id === 174) return mkCue(174,"canvas.frame",6,"Filmstrip switches to a different graded frame","V622 w",80,-29,1162,100,0,"OS_STATE_CHANGE","filmFrameChanged",false,[mkHit(0,3840,6220,65536,667,1475,22938,3,1,0,1152,1920,32768,false)]);
  return mkCue(175,"canvas.export",6,"Encoded image becomes available to save","G784/988/1175 p",245,-24,2067,300,0,"OS_STATE_CHANGE","imageEncoded",false,[mkHit(0,11760,7840,65536,553,16384,1311,0,0,0,576,1920,32768,false),mkHit(1960,9800,9880,65536,442,16384,1311,0,0,0,576,1920,32768,false),mkHit(3920,7840,11750,65536,376,16384,1311,0,0,0,576,1920,32768,false)]);
}

function familyCue7(id: number): AudioCue {
  if (id === 176) return mkCue(176,"notify.message",7,"A new unread conversation receives a message","A784/988 p",190,-24,2067,900,4,"OS_STATE_CHANGE","messageUnread",false,[mkHit(0,9120,7840,65536,857,10486,1311,1,0,0,576,1920,32768,false),mkHit(2280,6840,9880,65536,686,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 177) return mkCue(177,"notify.mention",7,"A message directly names the current user","G988/1482 p",235,-22,2602,1000,4,"OS_STATE_CHANGE","userMentioned",false,[mkHit(0,11280,9880,65536,958,16384,1311,0,0,0,576,1920,32768,false),mkHit(2820,8460,14820,65536,767,16384,1311,0,0,0,576,1920,32768,false)]);
  if (id === 178) return mkCue(178,"notify.reply",7,"A watched discussion receives a direct reply","A880/740 p",180,-24,2067,850,4,"OS_STATE_CHANGE","threadReply",false,[mkHit(0,8640,8800,65536,857,10486,1311,1,0,0,576,1920,32768,false),mkHit(2160,6480,7400,65536,686,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 179) return mkCue(179,"notify.invite",7,"A collaboration invitation is available","P523/659/784 s",290,-23,2319,1200,4,"OS_STATE_CHANGE","inviteReceived",false,[mkHit(0,13920,5230,65536,812,5308,0,4,0,384,576,1920,32768,false),mkHit(2320,11600,6590,65536,650,5308,0,4,0,384,576,1920,32768,false),mkHit(4640,9280,7840,65536,552,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 180) return mkCue(180,"notify.reminder",7,"A scheduled personal reminder becomes due","C659/659 p",230,-22,2602,1200,4,"OS_STATE_CHANGE","reminderFired",false,[mkHit(0,11040,6590,65536,1110,9175,1311,5,0,0,576,1920,32768,false),mkHit(2760,8280,6590,65536,888,9175,1311,5,0,0,576,1920,32768,false)]);
  if (id === 181) return mkCue(181,"notify.due",7,"A tracked task reaches its deadline","T523/698 k",200,-23,2319,1400,4,"OS_STATE_CHANGE","deadlineReached",false,[mkHit(0,9600,5230,65536,740,14746,10486,2,0,0,576,1920,32768,false),mkHit(2400,7200,6980,65536,592,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 182) return mkCue(182,"notify.overdue",7,"An unacknowledged task becomes overdue","T698/523/392 b",275,-23,2319,2000,4,"OS_STATE_CHANGE","taskOverdue",false,[mkHit(0,13200,6980,65536,660,6881,7209,2,1,0,576,1920,49152,false),mkHit(2200,11000,5230,65536,528,6881,7209,2,1,0,576,1920,49152,false),mkHit(4400,8800,3920,65536,449,6881,7209,2,1,0,576,1920,49152,false)]);
  if (id === 183) return mkCue(183,"notify.warning",7,"A recoverable condition needs attention","V392/349 k",175,-22,2602,750,4,"OS_STATE_CHANGE","warningRaised",false,[mkHit(0,8400,3920,65536,1014,3686,10486,3,0,0,576,1920,32768,false),mkHit(2100,6300,3490,65536,811,3686,10486,3,0,0,576,1920,32768,false)]);
  if (id === 184) return mkCue(184,"notify.error",7,"A requested operation failed and stopped","C370/247 b",200,-21,2920,750,4,"OS_STATE_CHANGE","actionFailed",false,[mkHit(0,9600,3700,65536,1237,3211,7209,5,1,0,576,1920,49152,false),mkHit(2400,7200,2470,65536,989,3211,7209,5,1,0,576,1920,49152,false)]);
  if (id === 185) return mkCue(185,"notify.fatal",7,"Session cannot continue without recovery","T392/311/196 b",335,-20,3276,2500,4,"OS_STATE_CHANGE","sessionHalted",false,[mkHit(0,16080,3920,65536,932,6881,7209,2,1,0,576,1920,49152,false),mkHit(2680,13400,3110,65536,746,6881,7209,2,1,0,576,1920,49152,false),mkHit(5360,10720,1960,65536,634,6881,7209,2,1,0,576,1920,49152,false)]);
  if (id === 186) return mkCue(186,"notify.success",7,"A user-requested action explicitly succeeds","A659/988 p",175,-23,2319,550,4,"OS_STATE_CHANGE","actionSucceeded",false,[mkHit(0,8400,6590,65536,962,10486,1311,1,0,0,576,1920,32768,false),mkHit(2100,6300,9880,65536,769,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 187) return mkCue(187,"notify.info",7,"A user-subscribed information notice arrives","V698 p",100,-28,1304,700,4,"OS_STATE_CHANGE","infoPosted",false,[mkHit(0,4800,6980,65536,1105,4915,1311,3,0,0,576,1920,32768,false)]);
  if (id === 188) return mkCue(188,"notify.muted-summary",7,"Present accumulated notices when quiet mode ends","P392/494/588 s",275,-26,1642,1500,4,"OS_STATE_CHANGE","digestReady",false,[mkHit(0,13200,3920,65536,575,5308,0,4,0,384,576,1920,32768,false),mkHit(2200,11000,4940,65536,460,5308,0,4,0,384,576,1920,32768,false),mkHit(4400,8800,5880,65536,391,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 189) return mkCue(189,"notify.queued",7,"An outbound message enters the outbox","V494 t",65,-28,1304,350,4,"OS_STATE_CHANGE","messageQueued",false,[mkHit(0,3120,4940,65536,865,983,15729,3,1,0,192,384,32768,false)]);
  if (id === 190) return mkCue(190,"notify.delivered",7,"Recipient service acknowledges message delivery","G830 p",115,-27,1463,500,4,"OS_STATE_CHANGE","deliveryAcknowledged",false,[mkHit(0,5520,8300,65536,970,16384,1311,0,0,0,576,1920,32768,false)]);
  if (id === 191) return mkCue(191,"notify.bounced",7,"Outbound delivery is permanently rejected","V415/277 d",195,-23,2319,750,4,"OS_STATE_CHANGE","deliveryRejected",false,[mkHit(0,9360,4150,49152,1056,4915,2621,3,0,0,576,1920,32768,false),mkHit(2340,7020,2770,49152,844,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 192) return mkCue(192,"notify.conflict",7,"Two document revisions need reconciliation","T440/466 k",160,-24,2067,650,4,"OS_STATE_CHANGE","revisionConflict",false,[mkHit(0,7680,4400,65536,659,14746,10486,2,0,0,576,1920,32768,false),mkHit(1920,5760,4660,65536,528,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 193) return mkCue(193,"notify.resolved",7,"A previously reported conflict is reconciled","A466/698 p",190,-25,1842,600,4,"OS_STATE_CHANGE","conflictResolved",false,[mkHit(0,9120,4660,65536,764,10486,1311,1,0,0,576,1920,32768,false),mkHit(2280,6840,6980,65536,611,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 194) return mkCue(194,"notify.reconnect",7,"A watched collaboration session is reachable again","P494/740 u",180,-26,1642,900,4,"OS_STATE_CHANGE","sessionRejoined",false,[mkHit(0,8640,4940,81920,644,11796,2621,4,0,0,576,1920,32768,false),mkHit(2160,6480,7400,81920,515,11796,2621,4,0,0,576,1920,32768,false)]);
  if (id === 195) return mkCue(195,"notify.available",7,"A subscribed resource becomes available","G880/1175 p",195,-25,1842,1100,4,"OS_STATE_CHANGE","resourceAvailable",false,[mkHit(0,9360,8800,65536,679,16384,1311,0,0,0,576,1920,32768,false),mkHit(2340,7020,11750,65536,543,16384,1311,0,0,0,576,1920,32768,false)]);
  if (id === 196) return mkCue(196,"notify.battery-low",7,"Device charge first crosses its low threshold","V311/247 b",200,-24,2067,5000,4,"OS_STATE_CHANGE","lowChargeEdge",false,[mkHit(0,9600,3110,65536,905,1720,7209,3,1,0,576,1920,49152,false),mkHit(2400,7200,2470,65536,724,1720,7209,3,1,0,576,1920,49152,false)]);
  if (id === 197) return mkCue(197,"notify.charge-ready",7,"Charging reaches the selected target","P523/784 s",230,-26,1642,5000,4,"OS_STATE_CHANGE","chargeTarget",false,[mkHit(0,11040,5230,65536,792,5308,0,4,0,384,576,1920,32768,false),mkHit(2760,8280,7840,65536,634,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 198) return mkCue(198,"notify.permission",7,"An operation is waiting for permission","C587/784 p",210,-23,2319,1000,4,"OS_STATE_CHANGE","permissionRequested",false,[mkHit(0,10080,5870,65536,989,9175,1311,5,0,0,576,1920,32768,false),mkHit(2520,7560,7840,65536,791,9175,1311,5,0,0,576,1920,32768,false)]);
  if (id === 199) return mkCue(199,"notify.approval",7,"Another participant approves a pending request","A698/1046 p",205,-24,2067,850,4,"OS_STATE_CHANGE","approvalReceived",false,[mkHit(0,9840,6980,65536,857,10486,1311,1,0,0,576,1920,32768,false),mkHit(2460,7380,10460,65536,686,10486,1311,1,0,0,576,1920,32768,false)]);
  return mkCue(200,"notify.revoked",7,"Access to a watched resource is withdrawn","T622/415 d",205,-23,2319,1000,4,"OS_STATE_CHANGE","accessRevoked",false,[mkHit(0,9840,6220,49152,785,19661,2621,2,0,0,576,1920,32768,false),mkHit(2460,7380,4150,49152,628,19661,2621,2,0,0,576,1920,32768,false)]);
}

function familyCue8(id: number): AudioCue {
  if (id === 201) return mkCue(201,"system.on",8,"Trusted opt-in enables interface sound","G2093/3136 Xon",350,-22,2602,400,0,"OS_STATE_CHANGE","audioEnabled",false,[mkHit(0,9600,20930,65536,1735,16384,6554,0,0,0,576,1920,32768,true),mkHit(2400,14400,31360,65536,867,16384,0,0,0,0,576,1920,32768,true)]);
  if (id === 202) return mkCue(202,"system.lock",8,"The session enters its locked state","C392/262 k",155,-24,2067,350,0,"OS_STATE_CHANGE","sessionLocked",false,[mkHit(0,7440,3920,65536,757,6881,10486,5,0,0,576,1920,32768,false),mkHit(1860,5580,2620,65536,606,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 203) return mkCue(203,"system.unlock",8,"Authenticated session becomes interactive","A523/784 p",200,-23,2319,350,0,"OS_STATE_CHANGE","sessionUnlocked",false,[mkHit(0,9600,5230,65536,962,10486,1311,1,0,0,576,1920,32768,false),mkHit(2400,7200,7840,65536,769,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 204) return mkCue(204,"system.sleep",8,"User initiates an orderly system sleep","P494/330 s",225,-27,1463,500,0,"OS_STATE_CHANGE","sleepAccepted",false,[mkHit(0,10800,4940,65536,706,5308,0,4,0,384,576,1920,32768,false),mkHit(2700,8100,3300,65536,565,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 205) return mkCue(205,"system.wake",8,"Interactive shell becomes available after wake","P330/494/659 s",285,-25,1842,500,0,"OS_STATE_CHANGE","shellAwake",false,[mkHit(0,13680,3300,65536,645,5308,0,4,0,384,576,1920,32768,false),mkHit(2280,11400,4940,65536,516,5308,0,4,0,384,576,1920,32768,false),mkHit(4560,9120,6590,65536,439,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 206) return mkCue(206,"system.shutdown",8,"Shell commits an orderly power-down","A523/392/262 s",330,-25,1842,800,0,"OS_STATE_CHANGE","powerDownCommitted",false,[mkHit(0,15840,5230,65536,654,4719,0,1,0,384,576,1920,32768,false),mkHit(2640,13200,3920,65536,524,4719,0,1,0,384,576,1920,32768,false),mkHit(5280,10560,2620,65536,445,4719,0,1,0,384,576,1920,32768,false)]);
  if (id === 207) return mkCue(207,"system.restart",8,"Restart is accepted and current session will end","T392/523/392 p",245,-25,1842,800,0,"OS_STATE_CHANGE","restartAccepted",false,[mkHit(0,11760,3920,65536,464,19661,1311,2,0,0,576,1920,32768,false),mkHit(1960,9800,5230,65536,371,19661,1311,2,0,0,576,1920,32768,false),mkHit(3920,7840,3920,65536,315,19661,1311,2,0,0,576,1920,32768,false)]);
  if (id === 208) return mkCue(208,"system.online",8,"Default network path becomes usable","A440/660 u",160,-26,1642,600,0,"OS_STATE_CHANGE","networkOnline",false,[mkHit(0,7680,4400,81920,661,10486,2621,1,0,0,576,1920,32768,false),mkHit(1920,5760,6600,81920,529,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 209) return mkCue(209,"system.offline",8,"Default network path is lost","V440/294 d",170,-25,1842,600,0,"OS_STATE_CHANGE","networkOffline",false,[mkHit(0,8160,4400,49152,838,4915,2621,3,0,0,576,1920,32768,false),mkHit(2040,6120,2940,49152,671,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 210) return mkCue(210,"system.pair",8,"A requested peripheral pairing succeeds","T659/988 k",165,-24,2067,400,0,"OS_STATE_CHANGE","devicePaired",false,[mkHit(0,7920,6590,65536,659,14746,10486,2,0,0,576,1920,32768,false),mkHit(1980,5940,9880,65536,528,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 211) return mkCue(211,"system.unpair",8,"A paired peripheral is deliberately forgotten","T659/440 d",150,-26,1642,400,0,"OS_STATE_CHANGE","deviceUnpaired",false,[mkHit(0,7200,6590,49152,556,19661,2621,2,0,0,576,1920,32768,false),mkHit(1800,5400,4400,49152,444,19661,2621,2,0,0,576,1920,32768,false)]);
  if (id === 212) return mkCue(212,"system.mount",8,"A storage volume becomes browsable","C494/740 p",160,-25,1842,400,0,"OS_STATE_CHANGE","volumeMounted",false,[mkHit(0,7680,4940,65536,786,9175,1311,5,0,0,576,1920,32768,false),mkHit(1920,5760,7400,65536,629,9175,1311,5,0,0,576,1920,32768,false)]);
  if (id === 213) return mkCue(213,"system.unmount",8,"It is safe to remove a storage volume","C740/494 p",155,-25,1842,400,0,"OS_STATE_CHANGE","volumeUnmounted",false,[mkHit(0,7440,7400,65536,786,9175,1311,5,0,0,576,1920,32768,false),mkHit(1860,5580,4940,65536,629,9175,1311,5,0,0,576,1920,32768,false)]);
  if (id === 214) return mkCue(214,"system.sync-on",8,"User enables background synchronization","P587/740 u",140,-26,1642,300,0,"OS_STATE_CHANGE","syncEnabled",false,[mkHit(0,6720,5870,81920,644,11796,2621,4,0,0,576,1920,32768,false),mkHit(1680,5040,7400,81920,515,11796,2621,4,0,0,576,1920,32768,false)]);
  if (id === 215) return mkCue(215,"system.sync-off",8,"User pauses background synchronization","P587/440 d",140,-27,1463,300,0,"OS_STATE_CHANGE","syncDisabled",false,[mkHit(0,6720,5870,49152,574,11796,2621,4,0,0,576,1920,32768,false),mkHit(1680,5040,4400,49152,459,11796,2621,4,0,0,576,1920,32768,false)]);
  if (id === 216) return mkCue(216,"system.profile",8,"Active personal profile changes","A440/554/659 p",230,-25,1842,350,0,"OS_STATE_CHANGE","profileChanged",false,[mkHit(0,11040,4400,65536,554,10486,1311,1,0,0,576,1920,32768,false),mkHit(1840,9200,5540,65536,444,10486,1311,1,0,0,576,1920,32768,false),mkHit(3680,7360,6590,65536,377,10486,1311,1,0,0,576,1920,32768,false)]);
  if (id === 217) return mkCue(217,"system.guest",8,"Enter an isolated guest workspace","V554/740 s",195,-26,1642,400,0,"OS_STATE_CHANGE","guestEntered",false,[mkHit(0,9360,5540,65536,858,2212,0,3,0,384,576,1920,32768,false),mkHit(2340,7020,7400,65536,686,2212,0,3,0,384,576,1920,32768,false)]);
  if (id === 218) return mkCue(218,"system.privacy-on",8,"A privacy shield starts protecting the session","C349/523 b",140,-25,1842,350,0,"SNAP_ENGAGE","privacyShield",false,[mkHit(0,6720,3490,65536,780,3211,7209,5,1,0,576,1920,49152,false),mkHit(1680,5040,5230,65536,624,3211,7209,5,1,0,576,1920,49152,false)]);
  if (id === 219) return mkCue(219,"system.privacy-off",8,"User releases the privacy shield","C523/698 p",145,-26,1642,350,0,"SNAP_RELEASE","privacyShield",false,[mkHit(0,6960,5230,65536,701,9175,1311,5,0,0,576,1920,32768,false),mkHit(1740,5220,6980,65536,560,9175,1311,5,0,0,576,1920,32768,false)]);
  if (id === 220) return mkCue(220,"system.dnd-on",8,"Quiet mode takes effect after acknowledgment","V466/311 s",160,-28,1304,400,0,"OS_STATE_CHANGE","quietEnabled",false,[mkHit(0,7680,4660,65536,681,2212,0,3,0,384,576,1920,32768,false),mkHit(1920,5760,3110,65536,545,2212,0,3,0,384,576,1920,32768,false)]);
  if (id === 221) return mkCue(221,"system.dnd-off",8,"User restores normal notification delivery","A466/698 s",160,-27,1463,400,0,"OS_STATE_CHANGE","quietDisabled",false,[mkHit(0,7680,4660,65536,716,4719,0,1,0,384,576,1920,32768,false),mkHit(1920,5760,6980,65536,573,4719,0,1,0,384,576,1920,32768,false)]);
  if (id === 222) return mkCue(222,"system.backup",8,"A requested backup snapshot is durable","T440/659/880 p",260,-25,1842,1000,0,"OS_STATE_CHANGE","backupDurable",false,[mkHit(0,12480,4400,65536,464,19661,1311,2,0,0,576,1920,32768,false),mkHit(2080,10400,6590,65536,371,19661,1311,2,0,0,576,1920,32768,false),mkHit(4160,8320,8800,65536,315,19661,1311,2,0,0,576,1920,32768,false)]);
  if (id === 223) return mkCue(223,"system.recovery",8,"Recovery environment is ready for input","P349/523/698 s",315,-24,2067,1000,0,"OS_STATE_CHANGE","recoveryReady",false,[mkHit(0,15120,3490,65536,724,5308,0,4,0,384,576,1920,32768,false),mkHit(2520,12600,5230,65536,579,5308,0,4,0,384,576,1920,32768,false),mkHit(5040,10080,6980,65536,492,5308,0,4,0,384,576,1920,32768,false)]);
  if (id === 224) return mkCue(224,"system.resource-low",8,"Runtime enters a constrained-resource tier","V277/220 b",160,-25,1842,3000,0,"OS_STATE_CHANGE","resourceTierLow",false,[mkHit(0,7680,2770,65536,806,1720,7209,3,1,0,576,1920,49152,false),mkHit(1920,5760,2200,65536,645,1720,7209,3,1,0,576,1920,49152,false)]);
  return mkCue(225,"system.update",8,"Installed update is ready for activation","G659/830/988 p",275,-24,2067,1200,0,"OS_STATE_CHANGE","updatePrepared",false,[mkHit(0,13200,6590,65536,553,16384,1311,0,0,0,576,1920,32768,false),mkHit(2200,11000,8300,65536,442,16384,1311,0,0,0,576,1920,32768,false),mkHit(4400,8800,9880,65536,376,16384,1311,0,0,0,576,1920,32768,false)]);
}

function familyCue9(id: number): AudioCue {
  if (id === 226) return mkCue(226,"progress.enqueue",9,"Scheduler accepts a new unit of work","V349 t",48,-29,1162,100,0,"OS_STATE_CHANGE","jobEnqueued",false,[mkHit(0,2304,3490,65536,771,983,15729,3,1,0,192,384,32768,false)]);
  if (id === 227) return mkCue(227,"progress.begin",9,"Worker takes ownership and starts execution","T440 k",80,-26,1642,130,0,"OS_STATE_CHANGE","jobStarted",false,[mkHit(0,3840,4400,65536,943,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 228) return mkCue(228,"progress.first-byte",9,"First useful response payload arrives","G988 t",55,-28,1304,150,0,"OS_STATE_CHANGE","firstPayload",false,[mkHit(0,2640,9880,65536,829,3277,15729,0,1,0,192,384,32768,false)]);
  if (id === 229) return mkCue(229,"progress.checkpoint",9,"A resumable checkpoint becomes durable","C587 p",85,-27,1463,250,0,"OS_STATE_CHANGE","checkpointWritten",false,[mkHit(0,4080,5870,65536,1123,9175,1311,5,0,0,576,1920,32768,false)]);
  if (id === 230) return mkCue(230,"progress.quarter",9,"Determinate work crosses 25% once","V440 p",65,-29,1162,250,0,"OS_STATE_CHANGE","quarterCrossed",false,[mkHit(0,3120,4400,65536,984,4915,1311,3,0,0,576,1920,32768,false)]);
  if (id === 231) return mkCue(231,"progress.half",9,"Determinate work crosses 50% once","V554 p",72,-28,1304,250,0,"OS_STATE_CHANGE","halfCrossed",false,[mkHit(0,3456,5540,65536,1105,4915,1311,3,0,0,576,1920,32768,false)]);
  if (id === 232) return mkCue(232,"progress.three-quarter",9,"Determinate work crosses 75% once","V659 p",78,-27,1463,250,0,"OS_STATE_CHANGE","threeQuarterCrossed",false,[mkHit(0,3744,6590,65536,1239,4915,1311,3,0,0,576,1920,32768,false)]);
  if (id === 233) return mkCue(233,"progress.final-step",9,"The last known work unit begins","A784 u",105,-26,1642,220,0,"OS_STATE_CHANGE","finalUnitStarted",false,[mkHit(0,5040,7840,81920,1190,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 234) return mkCue(234,"progress.complete",9,"All units of one tracked job succeed","P523/659/784 p",235,-23,2319,400,0,"SETTLE","jobComplete",false,[mkHit(0,11280,5230,65536,679,11796,1311,4,0,0,576,1920,32768,false),mkHit(1880,9400,6590,65536,543,11796,1311,4,0,0,576,1920,32768,false),mkHit(3760,7520,7840,65536,462,11796,1311,4,0,0,576,1920,32768,false)]);
  if (id === 235) return mkCue(235,"progress.pause",9,"Job reaches a safe paused boundary","V466/349 s",125,-27,1463,220,0,"OS_STATE_CHANGE","jobPaused",false,[mkHit(0,6000,4660,65536,764,2212,0,3,0,384,576,1920,32768,false),mkHit(1500,4500,3490,65536,612,2212,0,3,0,384,576,1920,32768,false)]);
  if (id === 236) return mkCue(236,"progress.resume",9,"Worker resumes at its saved position","A349/523 u",135,-26,1642,220,0,"OS_STATE_CHANGE","jobResumed",false,[mkHit(0,6480,3490,81920,661,10486,2621,1,0,0,576,1920,32768,false),mkHit(1620,4860,5230,81920,529,10486,2621,1,0,0,576,1920,32768,false)]);
  if (id === 237) return mkCue(237,"progress.cancel",9,"Cancellation is acknowledged by the worker","C392/294 b",140,-25,1842,250,0,"OS_STATE_CHANGE","jobCancelled",false,[mkHit(0,6720,3920,65536,780,3211,7209,5,1,0,576,1920,49152,false),mkHit(1680,5040,2940,65536,624,3211,7209,5,1,0,576,1920,49152,false)]);
  if (id === 238) return mkCue(238,"progress.retry",9,"Scheduler admits a fresh execution attempt","T494/622 k",115,-26,1642,300,0,"OS_STATE_CHANGE","attemptAdmitted",false,[mkHit(0,5520,4940,65536,524,14746,10486,2,0,0,576,1920,32768,false),mkHit(1380,4140,6220,65536,419,14746,10486,2,0,0,576,1920,32768,false)]);
  if (id === 239) return mkCue(239,"progress.backoff",9,"A failed attempt enters a timed retry delay","V370 d",120,-28,1304,650,0,"OS_STATE_CHANGE","backoffEntered",false,[mkHit(0,5760,3700,49152,1068,4915,2621,3,0,0,576,1920,32768,false)]);
  if (id === 240) return mkCue(240,"progress.stalled",9,"Watchdog first observes missing forward progress","T349/330 b",165,-24,2067,1500,0,"OS_STATE_CHANGE","stallDetected",false,[mkHit(0,7920,3490,65536,811,6881,7209,2,1,0,576,1920,49152,false),mkHit(1980,5940,3300,65536,648,6881,7209,2,1,0,576,1920,49152,false)]);
  if (id === 241) return mkCue(241,"progress.drain",9,"Input closes and remaining work begins draining","V392/330 w",155,-27,1463,300,0,"OS_STATE_CHANGE","drainStarted",false,[mkHit(0,7440,3920,65536,467,1475,22938,3,1,0,1152,1920,32768,false),mkHit(1860,5580,3300,65536,373,1475,22938,3,1,0,1152,1920,32768,false)]);
  if (id === 242) return mkCue(242,"progress.flush",9,"Buffered output has reached its destination","A740 k",95,-26,1642,200,0,"SETTLE","outputFlushed",false,[mkHit(0,4560,7400,65536,1063,7864,10486,1,0,0,576,1920,32768,false)]);
  if (id === 243) return mkCue(243,"progress.verify",9,"Independent output verification begins","T659 s",95,-28,1304,230,0,"OS_STATE_CHANGE","verificationStarted",false,[mkHit(0,4560,6590,65536,1041,8847,0,2,0,384,576,1920,32768,false)]);
  if (id === 244) return mkCue(244,"progress.hash-ok",9,"Computed and expected digests match","G880/1320 p",155,-25,1842,300,0,"OS_STATE_CHANGE","digestMatched",false,[mkHit(0,7440,8800,65536,679,16384,1311,0,0,0,576,1920,32768,false),mkHit(1860,5580,13200,65536,543,16384,1311,0,0,0,576,1920,32768,false)]);
  if (id === 245) return mkCue(245,"progress.hash-fail",9,"Integrity check finds a digest mismatch","C466/311 k",160,-23,2319,500,4,"OS_STATE_CHANGE","digestMismatch",false,[mkHit(0,7680,4660,65536,849,6881,10486,5,0,0,576,1920,32768,false),mkHit(1920,5760,3110,65536,680,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 246) return mkCue(246,"progress.rollback",9,"Prior transaction state has been restored","P659/494/330 d",225,-25,1842,350,0,"SETTLE","rollbackFinished",false,[mkHit(0,10800,6590,49152,524,11796,2621,4,0,0,576,1920,32768,false),mkHit(1800,9000,4940,49152,419,11796,2621,4,0,0,576,1920,32768,false),mkHit(3600,7200,3300,49152,356,11796,2621,4,0,0,576,1920,32768,false)]);
  if (id === 247) return mkCue(247,"progress.commit",9,"Transaction crosses its durable commit point","C523/784 k",145,-24,2067,280,0,"OS_STATE_CHANGE","transactionCommitted",false,[mkHit(0,6960,5230,65536,757,6881,10486,5,0,0,576,1920,32768,false),mkHit(1740,5220,7840,65536,606,6881,10486,5,0,0,576,1920,32768,false)]);
  if (id === 248) return mkCue(248,"progress.skip",9,"An already satisfied unit is explicitly skipped","V784 t",42,-30,1036,120,0,"OS_STATE_CHANGE","unitSkipped",false,[mkHit(0,2016,7840,65536,687,983,15729,3,1,0,192,384,32768,false)]);
  if (id === 249) return mkCue(249,"progress.indeterminate",9,"Estimate is lost and progress becomes indeterminate","P415 s",130,-29,1162,650,0,"OS_STATE_CHANGE","estimateLost",false,[mkHit(0,6240,4150,65536,1009,5308,0,4,0,384,576,1920,32768,false)]);
  return mkCue(250,"progress.batch-end",9,"Final job settles and the entire batch closes","A392/494/588/784 s",340,-23,2319,600,0,"SETTLE","batchClosed",false,[mkHit(0,16320,3920,65536,672,4719,0,1,0,384,576,1920,32768,false),mkHit(2040,14280,4940,65536,538,4719,0,1,0,384,576,1920,32768,false),mkHit(4080,12240,5880,65536,457,4719,0,1,0,384,576,1920,32768,false),mkHit(6120,10200,7840,65536,376,4719,0,1,0,384,576,1920,32768,false)]);
}

function familyHit0(id: number, hitIndex: number): AudioHit {
  if (id === 1) {
    if (hitIndex === 0) return mkHit(0,6000,5200,65536,962,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(1500,4500,6500,65536,769,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 2) {
    if (hitIndex === 0) return mkHit(0,6000,6500,65536,962,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(1500,4500,5200,65536,769,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 3) {
    if (hitIndex === 0) return mkHit(0,6960,4800,65536,989,9175,1311,5,0,0,576,1920,32768,false);
    return mkHit(1740,5220,7200,65536,791,9175,1311,5,0,0,576,1920,32768,false);
  }
  if (id === 4) {
    if (hitIndex === 0) return mkHit(0,11040,3920,65536,1255,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(2760,8280,5880,65536,1004,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 5) return mkHit(0,5040,3920,65536,1576,3211,7209,5,1,0,576,1920,49152,false);
  if (id === 6) return mkHit(0,2016,7400,65536,730,3932,15729,2,1,0,192,384,32768,false);
  if (id === 7) return mkHit(0,2016,6220,65536,730,3932,15729,2,1,0,192,384,32768,false);
  if (id === 8) {
    if (hitIndex === 0) return mkHit(0,6240,7840,65536,764,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(1560,4680,5880,65536,611,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 9) return mkHit(0,4800,4150,81920,1509,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 10) return mkHit(0,3936,4150,49152,1199,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 11) return mkHit(0,4080,6600,81920,1060,10486,2621,1,0,0,576,1920,32768,false);
  if (id === 12) return mkHit(0,4080,6600,49152,1060,10486,2621,1,0,0,576,1920,32768,false);
  if (id === 13) return mkHit(0,5040,8800,81920,1190,16384,2621,0,0,0,576,1920,32768,false);
  if (id === 14) {
    if (hitIndex === 0) return mkHit(0,6480,9900,65536,1110,9175,1311,5,0,0,576,1920,32768,false);
    return mkHit(1620,4860,13200,65536,888,9175,1311,5,0,0,576,1920,32768,false);
  }
  if (id === 15) return mkHit(0,4560,2470,65536,1153,1720,7209,3,1,0,576,1920,49152,false);
  if (id === 16) return mkHit(0,6240,4940,81920,1300,11796,2621,4,0,0,576,1920,32768,false);
  if (id === 17) return mkHit(0,1728,8800,65536,612,983,15729,3,1,0,192,384,32768,false);
  if (id === 18) {
    if (hitIndex === 0) return mkHit(0,5280,6600,65536,607,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(1320,3960,9900,65536,485,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 19) return mkHit(0,5040,5600,65536,1057,1475,22938,3,1,0,1152,1920,32768,false);
  if (id === 20) return mkHit(0,5040,4200,65536,1057,1475,22938,3,1,0,1152,1920,32768,false);
  if (id === 21) return mkHit(0,4320,7840,65536,1261,9175,1311,5,0,0,576,1920,32768,false);
  if (id === 22) {
    if (hitIndex === 0) return mkHit(0,7680,6600,65536,889,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(1920,5760,4950,65536,711,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 23) return mkHit(0,5520,5870,65536,1092,10486,1311,1,0,0,576,1920,32768,false);
  if (id === 24) {
    if (hitIndex === 0) return mkHit(0,10080,3920,81920,785,19661,2621,2,0,0,576,1920,32768,false);
    return mkHit(2520,7560,5870,81920,628,19661,2621,2,0,0,576,1920,32768,false);
  }
  return mkHit(0,2496,1960,65536,865,983,15729,3,1,0,192,384,32768,false);
}

function familyHit1(id: number, hitIndex: number): AudioHit {
  if (id === 26) return mkHit(0,2400,34000,65536,590,8192,0,0,0,0,576,1920,32768,true);
  if (id === 27) return mkHit(0,3360,12500,65536,1802,8192,16384,0,0,0,576,1920,32768,true);
  if (id === 28) return mkHit(0,7680,23500,65536,2130,18022,7209,0,0,0,576,1920,32768,true);
  if (id === 29) return mkHit(0,3264,8800,65536,1363,6881,10486,5,0,0,576,1920,32768,false);
  if (id === 30) return mkHit(0,2880,5870,65536,1252,3211,7209,5,1,0,576,1920,49152,false);
  if (id === 31) {
    if (hitIndex === 0) return mkHit(0,4080,5230,65536,573,3932,15729,2,1,0,192,384,32768,false);
    return mkHit(1020,3060,6590,65536,458,3932,15729,2,1,0,192,384,32768,false);
  }
  if (id === 32) return mkHit(0,4080,9880,65536,1543,10486,1311,1,0,0,576,1920,32768,false);
  if (id === 33) {
    if (hitIndex === 0) return mkHit(0,5040,4500,65536,830,14746,10486,2,0,0,576,1920,32768,false);
    return mkHit(1260,3780,9000,65536,664,14746,10486,2,0,0,576,1920,32768,false);
  }
  if (id === 34) {
    if (hitIndex === 0) return mkHit(0,5040,9000,65536,811,6881,7209,2,1,0,576,1920,49152,false);
    return mkHit(1260,3780,4500,65536,648,6881,7209,2,1,0,576,1920,49152,false);
  }
  if (id === 35) return mkHit(0,1536,7400,65536,687,983,15729,3,1,0,192,384,32768,false);
  if (id === 36) return mkHit(0,3264,10460,65536,1215,6881,10486,5,0,0,576,1920,32768,false);
  if (id === 37) return mkHit(0,3072,3110,65536,1629,1720,7209,3,1,0,576,1920,49152,false);
  if (id === 38) return mkHit(0,1728,6600,65536,730,3932,15729,2,1,0,192,384,32768,false);
  if (id === 39) {
    if (hitIndex === 0) return mkHit(0,4320,6600,65536,588,14746,10486,2,0,0,576,1920,32768,false);
    return mkHit(1080,3240,9900,65536,470,14746,10486,2,0,0,576,1920,32768,false);
  }
  if (id === 40) return mkHit(0,3360,5540,65536,974,2212,0,3,0,384,576,1920,32768,false);
  if (id === 41) return mkHit(0,3120,4150,65536,868,2212,0,3,0,384,576,1920,32768,false);
  if (id === 42) {
    if (hitIndex === 0) return mkHit(0,6480,6590,65536,764,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(1620,4860,8240,65536,611,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 43) {
    if (hitIndex === 0) return mkHit(0,6480,3300,65536,905,1720,7209,3,1,0,576,1920,49152,false);
    return mkHit(1620,4860,2940,65536,724,1720,7209,3,1,0,576,1920,49152,false);
  }
  if (id === 44) return mkHit(0,4080,4940,81920,1122,19661,2621,2,0,0,576,1920,32768,false);
  if (id === 45) {
    if (hitIndex === 0) return mkHit(0,7680,3920,81920,909,11796,2621,4,0,0,576,1920,32768,false);
    return mkHit(1920,5760,7840,81920,727,11796,2621,4,0,0,576,1920,32768,false);
  }
  if (id === 46) return mkHit(0,2976,3700,49152,849,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 47) return mkHit(0,3744,11750,65536,1415,9175,1311,5,0,0,576,1920,32768,false);
  if (id === 48) return mkHit(0,3600,7840,49152,1223,9175,2621,5,0,0,576,1920,32768,false);
  if (id === 49) return mkHit(0,3552,8300,65536,1192,7864,10486,1,0,0,576,1920,32768,false);
  if (hitIndex === 0) return mkHit(0,7440,7840,65536,889,5308,0,4,0,384,576,1920,32768,false);
  return mkHit(1860,5580,5230,65536,711,5308,0,4,0,384,576,1920,32768,false);
}

function familyHit2(id: number, hitIndex: number): AudioHit {
  if (id === 51) {
    if (hitIndex === 0) return mkHit(0,10800,4400,81920,1048,10486,2621,1,0,0,576,1920,32768,false);
    return mkHit(2700,8100,6600,81920,838,10486,2621,1,0,0,576,1920,32768,false);
  }
  if (id === 52) return mkHit(0,4800,8300,65536,1089,16384,1311,0,0,0,576,1920,32768,false);
  if (id === 53) return mkHit(0,5280,6220,81920,891,19661,2621,2,0,0,576,1920,32768,false);
  if (id === 54) return mkHit(0,5280,6220,49152,891,19661,2621,2,0,0,576,1920,32768,false);
  if (id === 55) {
    if (hitIndex === 0) return mkHit(0,6720,17600,65536,1301,16384,9830,0,0,0,576,1920,32768,true);
    return mkHit(3360,9600,13185,65536,1301,16384,9830,0,0,0,576,1920,32768,true);
  }
  if (id === 56) {
    if (hitIndex === 0) return mkHit(0,6720,13185,65536,1301,16384,9830,0,0,0,576,1920,32768,true);
    return mkHit(3360,9600,17600,65536,1301,16384,9830,0,0,0,576,1920,32768,true);
  }
  if (id === 57) {
    if (hitIndex === 0) return mkHit(0,5760,15680,65536,1301,16384,9830,0,0,0,576,1920,32768,true);
    return mkHit(2880,9600,20930,65536,1301,16384,9830,0,0,0,576,1920,32768,true);
  }
  if (id === 58) {
    if (hitIndex === 0) return mkHit(0,5760,20930,65536,1301,16384,9830,0,0,0,576,1920,32768,true);
    return mkHit(2880,9600,15680,65536,1301,16384,9830,0,0,0,576,1920,32768,true);
  }
  if (id === 59) return mkHit(0,6720,9900,65536,1966,9830,9830,0,0,0,576,1920,32768,true);
  if (id === 60) return mkHit(0,3120,3700,65536,840,14746,10486,2,0,0,576,1920,32768,false);
  if (id === 61) return mkHit(0,1680,4660,65536,612,983,15729,3,1,0,192,384,32768,false);
  if (id === 62) return mkHit(0,4800,5540,65536,1375,10486,1311,1,0,0,576,1920,32768,false);
  if (id === 63) return mkHit(0,4080,3700,65536,1363,6881,10486,5,0,0,576,1920,32768,false);
  if (id === 64) return mkHit(0,4320,5550,81920,1372,9175,2621,5,0,0,576,1920,32768,false);
  if (id === 65) {
    if (hitIndex === 0) return mkHit(0,7440,4400,65536,717,19661,1311,2,0,0,576,1920,32768,false);
    return mkHit(1860,5580,8800,65536,574,19661,1311,2,0,0,576,1920,32768,false);
  }
  if (id === 66) {
    if (hitIndex === 0) return mkHit(0,7440,8800,65536,717,19661,1311,2,0,0,576,1920,32768,false);
    return mkHit(1860,5580,4400,65536,574,19661,1311,2,0,0,576,1920,32768,false);
  }
  if (id === 67) {
    if (hitIndex === 0) return mkHit(0,8640,7400,81920,742,10486,2621,1,0,0,576,1920,32768,false);
    return mkHit(2160,6480,11100,81920,593,10486,2621,1,0,0,576,1920,32768,false);
  }
  if (id === 68) {
    if (hitIndex === 0) return mkHit(0,8640,11100,49152,742,10486,2621,1,0,0,576,1920,32768,false);
    return mkHit(2160,6480,7400,49152,593,10486,2621,1,0,0,576,1920,32768,false);
  }
  if (id === 69) return mkHit(0,6240,6980,49152,1345,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 70) return mkHit(0,6240,6980,81920,1345,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 71) {
    if (hitIndex === 0) return mkHit(0,11760,3920,65536,1119,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(2940,8820,7840,65536,895,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 72) {
    if (hitIndex === 0) return mkHit(0,10800,7840,65536,997,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(2700,8100,3920,65536,798,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 73) {
    if (hitIndex === 0) return mkHit(0,8400,4940,65536,717,19661,1311,2,0,0,576,1920,32768,false);
    return mkHit(2100,6300,7400,65536,574,19661,1311,2,0,0,576,1920,32768,false);
  }
  if (id === 74) {
    if (hitIndex === 0) return mkHit(0,5520,2330,65536,905,1720,7209,3,1,0,576,1920,49152,false);
    return mkHit(1380,4140,3110,65536,724,1720,7209,3,1,0,576,1920,49152,false);
  }
  if (hitIndex === 0) return mkHit(0,12480,3920,65536,804,4719,0,1,0,384,576,1920,32768,false);
  return mkHit(3120,9360,2940,65536,643,4719,0,1,0,384,576,1920,32768,false);
}

function familyHit3(id: number, hitIndex: number): AudioHit {
  if (id === 76) return mkHit(0,3600,3300,65536,827,8847,0,2,0,384,576,1920,32768,false);
  if (id === 77) return mkHit(0,5040,5880,65536,1494,14746,10486,2,0,0,576,1920,32768,false);
  if (id === 78) return mkHit(0,4080,5880,49152,1000,19661,2621,2,0,0,576,1920,32768,false);
  if (id === 79) {
    if (hitIndex === 0) return mkHit(0,5760,6600,65536,757,6881,10486,5,0,0,576,1920,32768,false);
    return mkHit(1440,4320,9900,65536,606,6881,10486,5,0,0,576,1920,32768,false);
  }
  if (id === 80) return mkHit(0,4080,5240,65536,1058,14746,10486,2,0,0,576,1920,32768,false);
  if (id === 81) return mkHit(0,4800,7840,65536,1375,10486,1311,1,0,0,576,1920,32768,false);
  if (id === 82) return mkHit(0,4608,2770,49152,1509,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 83) return mkHit(0,4080,3920,65536,1153,1720,7209,3,1,0,576,1920,49152,false);
  if (id === 84) return mkHit(0,6240,4940,65536,1149,4719,0,1,0,384,576,1920,32768,false);
  if (id === 85) return mkHit(0,3600,11090,65536,762,7373,0,0,0,384,576,1920,32768,false);
  if (id === 86) {
    if (hitIndex === 0) return mkHit(0,7440,4940,65536,740,14746,10486,2,0,0,576,1920,32768,false);
    return mkHit(1860,5580,7400,65536,592,14746,10486,2,0,0,576,1920,32768,false);
  }
  if (id === 87) {
    if (hitIndex === 0) return mkHit(0,7200,5230,65536,757,6881,10486,5,0,0,576,1920,32768,false);
    return mkHit(1800,5400,7840,65536,606,6881,10486,5,0,0,576,1920,32768,false);
  }
  if (id === 88) {
    if (hitIndex === 0) return mkHit(0,6240,3490,65536,806,1720,7209,3,1,0,576,1920,49152,false);
    return mkHit(1560,4680,5230,65536,645,1720,7209,3,1,0,576,1920,49152,false);
  }
  if (id === 89) {
    if (hitIndex === 0) return mkHit(0,6720,5230,81920,838,4915,2621,3,0,0,576,1920,32768,false);
    return mkHit(1680,5040,6980,81920,671,4915,2621,3,0,0,576,1920,32768,false);
  }
  if (id === 90) return mkHit(0,2304,8800,65536,819,3932,15729,2,1,0,192,384,32768,false);
  if (id === 91) return mkHit(0,2304,10460,65536,819,3932,15729,2,1,0,192,384,32768,false);
  if (id === 92) return mkHit(0,2400,9320,65536,851,1835,15729,5,1,0,192,384,32768,false);
  if (id === 93) return mkHit(0,3840,10460,65536,865,16384,1311,0,0,0,576,1920,32768,false);
  if (id === 94) return mkHit(0,3264,6980,49152,751,16384,2621,0,0,0,576,1920,32768,false);
  if (id === 95) return mkHit(0,4080,4400,65536,1215,6881,10486,5,0,0,576,1920,32768,false);
  if (id === 96) return mkHit(0,2784,5870,65536,950,2097,15729,1,1,0,192,384,32768,false);
  if (id === 97) {
    if (hitIndex === 0) return mkHit(0,8400,5230,65536,554,10486,1311,1,0,0,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(1400,7000,6590,65536,444,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(2800,5600,7840,65536,377,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 98) return mkHit(0,5040,7400,65536,1106,5898,22938,2,1,0,1152,1920,32768,false);
  if (id === 99) {
    if (hitIndex === 0) return mkHit(0,6240,2470,65536,905,1720,7209,3,1,0,576,1920,49152,false);
    return mkHit(1560,4680,1960,65536,724,1720,7209,3,1,0,576,1920,49152,false);
  }
  return mkHit(0,5280,3920,65536,1041,8847,0,2,0,384,576,1920,32768,false);
}

function familyHit4(id: number, hitIndex: number): AudioHit {
  if (id === 101) {
    if (hitIndex === 0) return mkHit(0,24000,7400,131072,1904,13107,9830,0,0,0,576,1920,32768,true);
    return mkHit(2880,26400,29600,65536,698,9830,0,0,0,0,576,1920,32768,true);
  }
  if (id === 102) return mkHit(0,10560,14800,65536,1475,13107,6554,0,0,0,576,1920,32768,true);
  if (id === 103) return mkHit(0,9600,11750,45875,983,6554,0,0,0,0,576,1920,32768,true);
  if (id === 104) return mkHit(0,12480,14800,32768,1311,9830,3277,0,0,0,576,1920,32768,true);
  if (id === 105) return mkHit(0,10560,19755,65536,1475,14746,4915,0,0,0,576,1920,32768,true);
  if (id === 106) return mkHit(0,4320,3920,81920,1199,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 107) return mkHit(0,3936,7400,65536,1215,6881,10486,5,0,0,576,1920,32768,false);
  if (id === 108) return mkHit(0,3744,4940,49152,1223,9175,2621,5,0,0,576,1920,32768,false);
  if (id === 109) return mkHit(0,4224,5540,81920,1000,19661,2621,2,0,0,576,1920,32768,false);
  if (id === 110) return mkHit(0,1728,6220,65536,771,983,15729,3,1,0,192,384,32768,false);
  if (id === 111) {
    if (hitIndex === 0) return mkHit(0,6960,6590,65536,857,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(1740,5220,9880,65536,686,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 112) return mkHit(0,5040,4400,65536,1057,1475,22938,3,1,0,1152,1920,32768,false);
  if (id === 113) {
    if (hitIndex === 0) return mkHit(0,8160,5230,81920,742,10486,2621,1,0,0,576,1920,32768,false);
    return mkHit(2040,6120,7840,81920,593,10486,2621,1,0,0,576,1920,32768,false);
  }
  if (id === 114) {
    if (hitIndex === 0) return mkHit(0,7200,7840,49152,661,10486,2621,1,0,0,576,1920,32768,false);
    return mkHit(1800,5400,5230,49152,529,10486,2621,1,0,0,576,1920,32768,false);
  }
  if (id === 115) return mkHit(0,5040,9880,65536,1077,7373,0,0,0,384,576,1920,32768,false);
  if (id === 116) return mkHit(0,4320,6590,65536,856,7373,0,0,0,384,576,1920,32768,false);
  if (id === 117) {
    if (hitIndex === 0) return mkHit(0,6240,4940,65536,639,19661,1311,2,0,0,576,1920,32768,false);
    return mkHit(1560,4680,6590,65536,511,19661,1311,2,0,0,576,1920,32768,false);
  }
  if (id === 118) return mkHit(0,4560,4940,81920,952,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 119) return mkHit(0,4560,4940,49152,849,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 120) return mkHit(0,3120,13190,65536,680,7373,0,0,0,384,576,1920,32768,false);
  if (id === 121) {
    if (hitIndex === 0) return mkHit(0,7680,7840,65536,834,11796,1311,4,0,0,576,1920,32768,false);
    return mkHit(1920,5760,9880,65536,667,11796,1311,4,0,0,576,1920,32768,false);
  }
  if (id === 122) return mkHit(0,4800,11750,65536,865,16384,1311,0,0,0,576,1920,32768,false);
  if (id === 123) return mkHit(0,3840,6600,65536,974,2212,0,3,0,384,576,1920,32768,false);
  if (id === 124) {
    if (hitIndex === 0) return mkHit(0,8640,5230,65536,651,8847,10486,4,0,0,576,1920,32768,false);
    return mkHit(2160,6480,7840,65536,521,8847,10486,4,0,0,576,1920,32768,false);
  }
  return mkHit(0,9360,3300,65536,1149,4719,0,1,0,384,576,1920,32768,false);
}

function familyHit5(id: number, hitIndex: number): AudioHit {
  if (id === 126) return mkHit(0,15360,10465,65536,1638,6554,1638,0,0,0,576,1920,32768,true);
  if (id === 127) return mkHit(0,14400,11747,65536,1147,6554,0,0,0,0,576,1920,32768,true);
  if (id === 128) return mkHit(0,4320,15680,65536,1311,9830,3277,0,0,0,576,1920,32768,true);
  if (id === 129) {
    if (hitIndex === 0) return mkHit(0,33600,10465,65536,730,11469,3277,0,0,0,576,1920,32768,true);
    if (hitIndex === 1) return mkHit(2160,33600,13185,65536,730,11469,0,0,0,0,576,1920,32768,true);
    if (hitIndex === 2) return mkHit(4320,33600,15680,65536,730,11469,0,0,0,0,576,1920,32768,true);
    return mkHit(6480,33600,20930,65536,730,11469,0,0,0,0,576,1920,32768,true);
  }
  if (id === 130) {
    if (hitIndex === 0) return mkHit(0,9120,5230,81920,810,11796,2621,4,0,0,576,1920,32768,false);
    return mkHit(2280,6840,10460,81920,648,11796,2621,4,0,0,576,1920,32768,false);
  }
  if (id === 131) return mkHit(0,3360,6980,65536,868,2212,0,3,0,384,576,1920,32768,false);
  if (id === 132) {
    if (hitIndex === 0) return mkHit(0,6480,6980,65536,681,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(1620,4860,8800,65536,545,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 133) return mkHit(0,4560,3920,49152,952,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 134) return mkHit(0,2640,5870,65536,1157,3932,15729,2,1,0,192,384,32768,false);
  if (id === 135) {
    if (hitIndex === 0) return mkHit(0,8400,4940,81920,644,11796,2621,4,0,0,576,1920,32768,false);
    return mkHit(2100,6300,6590,81920,515,11796,2621,4,0,0,576,1920,32768,false);
  }
  if (id === 136) return mkHit(0,5520,6590,65536,1009,5308,0,4,0,384,576,1920,32768,false);
  if (id === 137) return mkHit(0,4080,4400,49152,952,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 138) return mkHit(0,3648,4150,65536,840,14746,10486,2,0,0,576,1920,32768,false);
  if (id === 139) {
    if (hitIndex === 0) return mkHit(0,6720,5540,65536,681,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(1680,5040,7400,65536,545,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 140) {
    if (hitIndex === 0) return mkHit(0,7200,3700,65536,905,1720,7209,3,1,0,576,1920,49152,false);
    return mkHit(1800,5400,2770,65536,724,1720,7209,3,1,0,576,1920,49152,false);
  }
  if (id === 141) {
    if (hitIndex === 0) return mkHit(0,9120,5870,81920,810,11796,2621,4,0,0,576,1920,32768,false);
    return mkHit(2280,6840,7840,81920,648,11796,2621,4,0,0,576,1920,32768,false);
  }
  if (id === 142) {
    if (hitIndex === 0) return mkHit(0,10800,4940,65536,520,19661,1311,2,0,0,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(1800,9000,6590,65536,416,19661,1311,2,0,0,576,1920,32768,false);
    return mkHit(3600,7200,9880,65536,354,19661,1311,2,0,0,576,1920,32768,false);
  }
  if (id === 143) {
    if (hitIndex === 0) return mkHit(0,10560,3110,49152,1184,4915,2621,3,0,0,576,1920,32768,false);
    return mkHit(2640,7920,2070,49152,948,4915,2621,3,0,0,576,1920,32768,false);
  }
  if (id === 144) {
    if (hitIndex === 0) return mkHit(0,7200,3920,65536,695,3211,7209,5,1,0,576,1920,49152,false);
    return mkHit(1800,5400,3300,65536,556,3211,7209,5,1,0,576,1920,49152,false);
  }
  if (id === 145) {
    if (hitIndex === 0) return mkHit(0,6960,4400,81920,722,11796,2621,4,0,0,576,1920,32768,false);
    return mkHit(1740,5220,5540,81920,578,11796,2621,4,0,0,576,1920,32768,false);
  }
  if (id === 146) return mkHit(0,3552,8300,65536,947,7864,10486,1,0,0,576,1920,32768,false);
  if (id === 147) {
    if (hitIndex === 0) return mkHit(0,9120,7840,65536,706,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(2280,6840,6590,65536,565,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 148) {
    if (hitIndex === 0) return mkHit(0,10080,5230,65536,464,19661,1311,2,0,0,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(1680,8400,7840,65536,371,19661,1311,2,0,0,576,1920,32768,false);
    return mkHit(3360,6720,10460,65536,315,19661,1311,2,0,0,576,1920,32768,false);
  }
  if (id === 149) {
    if (hitIndex === 0) return mkHit(0,6960,6600,65536,849,6881,10486,5,0,0,576,1920,32768,false);
    return mkHit(1740,5220,9900,65536,680,6881,10486,5,0,0,576,1920,32768,false);
  }
  return mkHit(0,5040,3300,65536,1093,2212,0,3,0,384,576,1920,32768,false);
}

function familyHit6(id: number, hitIndex: number): AudioHit {
  if (id === 151) return mkHit(0,2640,3300,65536,595,1475,22938,3,1,0,1152,1920,32768,false);
  if (id === 152) return mkHit(0,2160,4660,65536,782,4915,1311,3,0,0,576,1920,32768,false);
  if (id === 153) return mkHit(0,3936,2770,65536,749,1475,22938,3,1,0,1152,1920,32768,false);
  if (id === 154) return mkHit(0,6960,3490,81920,1159,11796,2621,4,0,0,576,1920,32768,false);
  if (id === 155) return mkHit(0,3120,11750,65536,983,12288,10486,0,0,0,576,1920,32768,false);
  if (id === 156) return mkHit(0,5520,5230,65536,1226,2212,0,3,0,384,576,1920,32768,false);
  if (id === 157) {
    if (hitIndex === 0) return mkHit(0,6000,7400,65536,569,19661,1311,2,0,0,576,1920,32768,false);
    return mkHit(1500,4500,5540,65536,456,19661,1311,2,0,0,576,1920,32768,false);
  }
  if (id === 158) {
    if (hitIndex === 0) return mkHit(0,6480,6600,65536,764,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(1620,4860,8800,65536,611,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 159) return mkHit(0,3744,4400,65536,1027,1720,7209,3,1,0,576,1920,49152,false);
  if (id === 160) return mkHit(0,3840,6600,65536,1092,10486,1311,1,0,0,576,1920,32768,false);
  if (id === 161) {
    if (hitIndex === 0) return mkHit(0,7440,6600,65536,757,6881,10486,5,0,0,576,1920,32768,false);
    return mkHit(1860,5580,4400,65536,606,6881,10486,5,0,0,576,1920,32768,false);
  }
  if (id === 162) return mkHit(0,3120,3700,65536,1031,3932,15729,2,1,0,192,384,32768,false);
  if (id === 163) {
    if (hitIndex === 0) return mkHit(0,6720,4940,65536,629,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(1680,5040,6220,65536,503,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 164) return mkHit(0,1536,8300,65536,546,983,15729,3,1,0,192,384,32768,false);
  if (id === 165) return mkHit(0,4560,5230,65536,1363,6881,10486,5,0,0,576,1920,32768,false);
  if (id === 166) return mkHit(0,2880,9880,65536,1031,3932,15729,2,1,0,192,384,32768,false);
  if (id === 167) return mkHit(0,3600,7400,81920,945,10486,2621,1,0,0,576,1920,32768,false);
  if (id === 168) return mkHit(0,3600,7400,49152,945,10486,2621,1,0,0,576,1920,32768,false);
  if (id === 169) {
    if (hitIndex === 0) return mkHit(0,7440,4400,65536,792,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(1860,5580,6600,65536,634,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 170) return mkHit(0,4080,10460,65536,1083,6881,10486,5,0,0,576,1920,32768,false);
  if (id === 171) return mkHit(0,3744,3920,65536,1093,2212,0,3,0,384,576,1920,32768,false);
  if (id === 172) return mkHit(0,3936,5870,65536,1149,4719,0,1,0,384,576,1920,32768,false);
  if (id === 173) {
    if (hitIndex === 0) return mkHit(0,7440,5540,65536,662,11796,1311,4,0,0,576,1920,32768,false);
    return mkHit(1860,5580,6980,65536,530,11796,1311,4,0,0,576,1920,32768,false);
  }
  if (id === 174) return mkHit(0,3840,6220,65536,667,1475,22938,3,1,0,1152,1920,32768,false);
  if (hitIndex === 0) return mkHit(0,11760,7840,65536,553,16384,1311,0,0,0,576,1920,32768,false);
  if (hitIndex === 1) return mkHit(1960,9800,9880,65536,442,16384,1311,0,0,0,576,1920,32768,false);
  return mkHit(3920,7840,11750,65536,376,16384,1311,0,0,0,576,1920,32768,false);
}

function familyHit7(id: number, hitIndex: number): AudioHit {
  if (id === 176) {
    if (hitIndex === 0) return mkHit(0,9120,7840,65536,857,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(2280,6840,9880,65536,686,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 177) {
    if (hitIndex === 0) return mkHit(0,11280,9880,65536,958,16384,1311,0,0,0,576,1920,32768,false);
    return mkHit(2820,8460,14820,65536,767,16384,1311,0,0,0,576,1920,32768,false);
  }
  if (id === 178) {
    if (hitIndex === 0) return mkHit(0,8640,8800,65536,857,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(2160,6480,7400,65536,686,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 179) {
    if (hitIndex === 0) return mkHit(0,13920,5230,65536,812,5308,0,4,0,384,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(2320,11600,6590,65536,650,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(4640,9280,7840,65536,552,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 180) {
    if (hitIndex === 0) return mkHit(0,11040,6590,65536,1110,9175,1311,5,0,0,576,1920,32768,false);
    return mkHit(2760,8280,6590,65536,888,9175,1311,5,0,0,576,1920,32768,false);
  }
  if (id === 181) {
    if (hitIndex === 0) return mkHit(0,9600,5230,65536,740,14746,10486,2,0,0,576,1920,32768,false);
    return mkHit(2400,7200,6980,65536,592,14746,10486,2,0,0,576,1920,32768,false);
  }
  if (id === 182) {
    if (hitIndex === 0) return mkHit(0,13200,6980,65536,660,6881,7209,2,1,0,576,1920,49152,false);
    if (hitIndex === 1) return mkHit(2200,11000,5230,65536,528,6881,7209,2,1,0,576,1920,49152,false);
    return mkHit(4400,8800,3920,65536,449,6881,7209,2,1,0,576,1920,49152,false);
  }
  if (id === 183) {
    if (hitIndex === 0) return mkHit(0,8400,3920,65536,1014,3686,10486,3,0,0,576,1920,32768,false);
    return mkHit(2100,6300,3490,65536,811,3686,10486,3,0,0,576,1920,32768,false);
  }
  if (id === 184) {
    if (hitIndex === 0) return mkHit(0,9600,3700,65536,1237,3211,7209,5,1,0,576,1920,49152,false);
    return mkHit(2400,7200,2470,65536,989,3211,7209,5,1,0,576,1920,49152,false);
  }
  if (id === 185) {
    if (hitIndex === 0) return mkHit(0,16080,3920,65536,932,6881,7209,2,1,0,576,1920,49152,false);
    if (hitIndex === 1) return mkHit(2680,13400,3110,65536,746,6881,7209,2,1,0,576,1920,49152,false);
    return mkHit(5360,10720,1960,65536,634,6881,7209,2,1,0,576,1920,49152,false);
  }
  if (id === 186) {
    if (hitIndex === 0) return mkHit(0,8400,6590,65536,962,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(2100,6300,9880,65536,769,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 187) return mkHit(0,4800,6980,65536,1105,4915,1311,3,0,0,576,1920,32768,false);
  if (id === 188) {
    if (hitIndex === 0) return mkHit(0,13200,3920,65536,575,5308,0,4,0,384,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(2200,11000,4940,65536,460,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(4400,8800,5880,65536,391,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 189) return mkHit(0,3120,4940,65536,865,983,15729,3,1,0,192,384,32768,false);
  if (id === 190) return mkHit(0,5520,8300,65536,970,16384,1311,0,0,0,576,1920,32768,false);
  if (id === 191) {
    if (hitIndex === 0) return mkHit(0,9360,4150,49152,1056,4915,2621,3,0,0,576,1920,32768,false);
    return mkHit(2340,7020,2770,49152,844,4915,2621,3,0,0,576,1920,32768,false);
  }
  if (id === 192) {
    if (hitIndex === 0) return mkHit(0,7680,4400,65536,659,14746,10486,2,0,0,576,1920,32768,false);
    return mkHit(1920,5760,4660,65536,528,14746,10486,2,0,0,576,1920,32768,false);
  }
  if (id === 193) {
    if (hitIndex === 0) return mkHit(0,9120,4660,65536,764,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(2280,6840,6980,65536,611,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 194) {
    if (hitIndex === 0) return mkHit(0,8640,4940,81920,644,11796,2621,4,0,0,576,1920,32768,false);
    return mkHit(2160,6480,7400,81920,515,11796,2621,4,0,0,576,1920,32768,false);
  }
  if (id === 195) {
    if (hitIndex === 0) return mkHit(0,9360,8800,65536,679,16384,1311,0,0,0,576,1920,32768,false);
    return mkHit(2340,7020,11750,65536,543,16384,1311,0,0,0,576,1920,32768,false);
  }
  if (id === 196) {
    if (hitIndex === 0) return mkHit(0,9600,3110,65536,905,1720,7209,3,1,0,576,1920,49152,false);
    return mkHit(2400,7200,2470,65536,724,1720,7209,3,1,0,576,1920,49152,false);
  }
  if (id === 197) {
    if (hitIndex === 0) return mkHit(0,11040,5230,65536,792,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(2760,8280,7840,65536,634,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 198) {
    if (hitIndex === 0) return mkHit(0,10080,5870,65536,989,9175,1311,5,0,0,576,1920,32768,false);
    return mkHit(2520,7560,7840,65536,791,9175,1311,5,0,0,576,1920,32768,false);
  }
  if (id === 199) {
    if (hitIndex === 0) return mkHit(0,9840,6980,65536,857,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(2460,7380,10460,65536,686,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (hitIndex === 0) return mkHit(0,9840,6220,49152,785,19661,2621,2,0,0,576,1920,32768,false);
  return mkHit(2460,7380,4150,49152,628,19661,2621,2,0,0,576,1920,32768,false);
}

function familyHit8(id: number, hitIndex: number): AudioHit {
  if (id === 201) {
    if (hitIndex === 0) return mkHit(0,9600,20930,65536,1735,16384,6554,0,0,0,576,1920,32768,true);
    return mkHit(2400,14400,31360,65536,867,16384,0,0,0,0,576,1920,32768,true);
  }
  if (id === 202) {
    if (hitIndex === 0) return mkHit(0,7440,3920,65536,757,6881,10486,5,0,0,576,1920,32768,false);
    return mkHit(1860,5580,2620,65536,606,6881,10486,5,0,0,576,1920,32768,false);
  }
  if (id === 203) {
    if (hitIndex === 0) return mkHit(0,9600,5230,65536,962,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(2400,7200,7840,65536,769,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 204) {
    if (hitIndex === 0) return mkHit(0,10800,4940,65536,706,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(2700,8100,3300,65536,565,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 205) {
    if (hitIndex === 0) return mkHit(0,13680,3300,65536,645,5308,0,4,0,384,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(2280,11400,4940,65536,516,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(4560,9120,6590,65536,439,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 206) {
    if (hitIndex === 0) return mkHit(0,15840,5230,65536,654,4719,0,1,0,384,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(2640,13200,3920,65536,524,4719,0,1,0,384,576,1920,32768,false);
    return mkHit(5280,10560,2620,65536,445,4719,0,1,0,384,576,1920,32768,false);
  }
  if (id === 207) {
    if (hitIndex === 0) return mkHit(0,11760,3920,65536,464,19661,1311,2,0,0,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(1960,9800,5230,65536,371,19661,1311,2,0,0,576,1920,32768,false);
    return mkHit(3920,7840,3920,65536,315,19661,1311,2,0,0,576,1920,32768,false);
  }
  if (id === 208) {
    if (hitIndex === 0) return mkHit(0,7680,4400,81920,661,10486,2621,1,0,0,576,1920,32768,false);
    return mkHit(1920,5760,6600,81920,529,10486,2621,1,0,0,576,1920,32768,false);
  }
  if (id === 209) {
    if (hitIndex === 0) return mkHit(0,8160,4400,49152,838,4915,2621,3,0,0,576,1920,32768,false);
    return mkHit(2040,6120,2940,49152,671,4915,2621,3,0,0,576,1920,32768,false);
  }
  if (id === 210) {
    if (hitIndex === 0) return mkHit(0,7920,6590,65536,659,14746,10486,2,0,0,576,1920,32768,false);
    return mkHit(1980,5940,9880,65536,528,14746,10486,2,0,0,576,1920,32768,false);
  }
  if (id === 211) {
    if (hitIndex === 0) return mkHit(0,7200,6590,49152,556,19661,2621,2,0,0,576,1920,32768,false);
    return mkHit(1800,5400,4400,49152,444,19661,2621,2,0,0,576,1920,32768,false);
  }
  if (id === 212) {
    if (hitIndex === 0) return mkHit(0,7680,4940,65536,786,9175,1311,5,0,0,576,1920,32768,false);
    return mkHit(1920,5760,7400,65536,629,9175,1311,5,0,0,576,1920,32768,false);
  }
  if (id === 213) {
    if (hitIndex === 0) return mkHit(0,7440,7400,65536,786,9175,1311,5,0,0,576,1920,32768,false);
    return mkHit(1860,5580,4940,65536,629,9175,1311,5,0,0,576,1920,32768,false);
  }
  if (id === 214) {
    if (hitIndex === 0) return mkHit(0,6720,5870,81920,644,11796,2621,4,0,0,576,1920,32768,false);
    return mkHit(1680,5040,7400,81920,515,11796,2621,4,0,0,576,1920,32768,false);
  }
  if (id === 215) {
    if (hitIndex === 0) return mkHit(0,6720,5870,49152,574,11796,2621,4,0,0,576,1920,32768,false);
    return mkHit(1680,5040,4400,49152,459,11796,2621,4,0,0,576,1920,32768,false);
  }
  if (id === 216) {
    if (hitIndex === 0) return mkHit(0,11040,4400,65536,554,10486,1311,1,0,0,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(1840,9200,5540,65536,444,10486,1311,1,0,0,576,1920,32768,false);
    return mkHit(3680,7360,6590,65536,377,10486,1311,1,0,0,576,1920,32768,false);
  }
  if (id === 217) {
    if (hitIndex === 0) return mkHit(0,9360,5540,65536,858,2212,0,3,0,384,576,1920,32768,false);
    return mkHit(2340,7020,7400,65536,686,2212,0,3,0,384,576,1920,32768,false);
  }
  if (id === 218) {
    if (hitIndex === 0) return mkHit(0,6720,3490,65536,780,3211,7209,5,1,0,576,1920,49152,false);
    return mkHit(1680,5040,5230,65536,624,3211,7209,5,1,0,576,1920,49152,false);
  }
  if (id === 219) {
    if (hitIndex === 0) return mkHit(0,6960,5230,65536,701,9175,1311,5,0,0,576,1920,32768,false);
    return mkHit(1740,5220,6980,65536,560,9175,1311,5,0,0,576,1920,32768,false);
  }
  if (id === 220) {
    if (hitIndex === 0) return mkHit(0,7680,4660,65536,681,2212,0,3,0,384,576,1920,32768,false);
    return mkHit(1920,5760,3110,65536,545,2212,0,3,0,384,576,1920,32768,false);
  }
  if (id === 221) {
    if (hitIndex === 0) return mkHit(0,7680,4660,65536,716,4719,0,1,0,384,576,1920,32768,false);
    return mkHit(1920,5760,6980,65536,573,4719,0,1,0,384,576,1920,32768,false);
  }
  if (id === 222) {
    if (hitIndex === 0) return mkHit(0,12480,4400,65536,464,19661,1311,2,0,0,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(2080,10400,6590,65536,371,19661,1311,2,0,0,576,1920,32768,false);
    return mkHit(4160,8320,8800,65536,315,19661,1311,2,0,0,576,1920,32768,false);
  }
  if (id === 223) {
    if (hitIndex === 0) return mkHit(0,15120,3490,65536,724,5308,0,4,0,384,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(2520,12600,5230,65536,579,5308,0,4,0,384,576,1920,32768,false);
    return mkHit(5040,10080,6980,65536,492,5308,0,4,0,384,576,1920,32768,false);
  }
  if (id === 224) {
    if (hitIndex === 0) return mkHit(0,7680,2770,65536,806,1720,7209,3,1,0,576,1920,49152,false);
    return mkHit(1920,5760,2200,65536,645,1720,7209,3,1,0,576,1920,49152,false);
  }
  if (hitIndex === 0) return mkHit(0,13200,6590,65536,553,16384,1311,0,0,0,576,1920,32768,false);
  if (hitIndex === 1) return mkHit(2200,11000,8300,65536,442,16384,1311,0,0,0,576,1920,32768,false);
  return mkHit(4400,8800,9880,65536,376,16384,1311,0,0,0,576,1920,32768,false);
}

function familyHit9(id: number, hitIndex: number): AudioHit {
  if (id === 226) return mkHit(0,2304,3490,65536,771,983,15729,3,1,0,192,384,32768,false);
  if (id === 227) return mkHit(0,3840,4400,65536,943,14746,10486,2,0,0,576,1920,32768,false);
  if (id === 228) return mkHit(0,2640,9880,65536,829,3277,15729,0,1,0,192,384,32768,false);
  if (id === 229) return mkHit(0,4080,5870,65536,1123,9175,1311,5,0,0,576,1920,32768,false);
  if (id === 230) return mkHit(0,3120,4400,65536,984,4915,1311,3,0,0,576,1920,32768,false);
  if (id === 231) return mkHit(0,3456,5540,65536,1105,4915,1311,3,0,0,576,1920,32768,false);
  if (id === 232) return mkHit(0,3744,6590,65536,1239,4915,1311,3,0,0,576,1920,32768,false);
  if (id === 233) return mkHit(0,5040,7840,81920,1190,10486,2621,1,0,0,576,1920,32768,false);
  if (id === 234) {
    if (hitIndex === 0) return mkHit(0,11280,5230,65536,679,11796,1311,4,0,0,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(1880,9400,6590,65536,543,11796,1311,4,0,0,576,1920,32768,false);
    return mkHit(3760,7520,7840,65536,462,11796,1311,4,0,0,576,1920,32768,false);
  }
  if (id === 235) {
    if (hitIndex === 0) return mkHit(0,6000,4660,65536,764,2212,0,3,0,384,576,1920,32768,false);
    return mkHit(1500,4500,3490,65536,612,2212,0,3,0,384,576,1920,32768,false);
  }
  if (id === 236) {
    if (hitIndex === 0) return mkHit(0,6480,3490,81920,661,10486,2621,1,0,0,576,1920,32768,false);
    return mkHit(1620,4860,5230,81920,529,10486,2621,1,0,0,576,1920,32768,false);
  }
  if (id === 237) {
    if (hitIndex === 0) return mkHit(0,6720,3920,65536,780,3211,7209,5,1,0,576,1920,49152,false);
    return mkHit(1680,5040,2940,65536,624,3211,7209,5,1,0,576,1920,49152,false);
  }
  if (id === 238) {
    if (hitIndex === 0) return mkHit(0,5520,4940,65536,524,14746,10486,2,0,0,576,1920,32768,false);
    return mkHit(1380,4140,6220,65536,419,14746,10486,2,0,0,576,1920,32768,false);
  }
  if (id === 239) return mkHit(0,5760,3700,49152,1068,4915,2621,3,0,0,576,1920,32768,false);
  if (id === 240) {
    if (hitIndex === 0) return mkHit(0,7920,3490,65536,811,6881,7209,2,1,0,576,1920,49152,false);
    return mkHit(1980,5940,3300,65536,648,6881,7209,2,1,0,576,1920,49152,false);
  }
  if (id === 241) {
    if (hitIndex === 0) return mkHit(0,7440,3920,65536,467,1475,22938,3,1,0,1152,1920,32768,false);
    return mkHit(1860,5580,3300,65536,373,1475,22938,3,1,0,1152,1920,32768,false);
  }
  if (id === 242) return mkHit(0,4560,7400,65536,1063,7864,10486,1,0,0,576,1920,32768,false);
  if (id === 243) return mkHit(0,4560,6590,65536,1041,8847,0,2,0,384,576,1920,32768,false);
  if (id === 244) {
    if (hitIndex === 0) return mkHit(0,7440,8800,65536,679,16384,1311,0,0,0,576,1920,32768,false);
    return mkHit(1860,5580,13200,65536,543,16384,1311,0,0,0,576,1920,32768,false);
  }
  if (id === 245) {
    if (hitIndex === 0) return mkHit(0,7680,4660,65536,849,6881,10486,5,0,0,576,1920,32768,false);
    return mkHit(1920,5760,3110,65536,680,6881,10486,5,0,0,576,1920,32768,false);
  }
  if (id === 246) {
    if (hitIndex === 0) return mkHit(0,10800,6590,49152,524,11796,2621,4,0,0,576,1920,32768,false);
    if (hitIndex === 1) return mkHit(1800,9000,4940,49152,419,11796,2621,4,0,0,576,1920,32768,false);
    return mkHit(3600,7200,3300,49152,356,11796,2621,4,0,0,576,1920,32768,false);
  }
  if (id === 247) {
    if (hitIndex === 0) return mkHit(0,6960,5230,65536,757,6881,10486,5,0,0,576,1920,32768,false);
    return mkHit(1740,5220,7840,65536,606,6881,10486,5,0,0,576,1920,32768,false);
  }
  if (id === 248) return mkHit(0,2016,7840,65536,687,983,15729,3,1,0,192,384,32768,false);
  if (id === 249) return mkHit(0,6240,4150,65536,1009,5308,0,4,0,384,576,1920,32768,false);
  if (hitIndex === 0) return mkHit(0,16320,3920,65536,672,4719,0,1,0,384,576,1920,32768,false);
  if (hitIndex === 1) return mkHit(2040,14280,4940,65536,538,4719,0,1,0,384,576,1920,32768,false);
  if (hitIndex === 2) return mkHit(4080,12240,5880,65536,457,4719,0,1,0,384,576,1920,32768,false);
  return mkHit(6120,10200,7840,65536,376,4719,0,1,0,384,576,1920,32768,false);
}

export function catalogSize(): number { return 250; }

export function catalogFamilyName(family: number): string {
  if (family === 0) return "Navigation";
  if (family === 1) return "Controls";
  if (family === 2) return "Windows";
  if (family === 3) return "Magnetic layout";
  if (family === 4) return "Dock";
  if (family === 5) return "Star and voice";
  if (family === 6) return "Canvas and creative tools";
  if (family === 7) return "Notifications";
  if (family === 8) return "System";
  if (family === 9) return "Progress and transactions";
  return "unknown";
}

export function getAudioCue(id: number): AudioCue {
  const safe = id >= 1 && id <= 250 ? id : 1;
  if (safe <= 25) return familyCue0(safe);
  if (safe <= 50) return familyCue1(safe);
  if (safe <= 75) return familyCue2(safe);
  if (safe <= 100) return familyCue3(safe);
  if (safe <= 125) return familyCue4(safe);
  if (safe <= 150) return familyCue5(safe);
  if (safe <= 175) return familyCue6(safe);
  if (safe <= 200) return familyCue7(safe);
  if (safe <= 225) return familyCue8(safe);
  return familyCue9(safe);
}

export function resolveCatalogHit(cueId: number, hitIndex: number): AudioHit {
  const safe = cueId >= 1 && cueId <= 250 ? cueId : 1;
  if (safe <= 25) return familyHit0(safe, hitIndex);
  if (safe <= 50) return familyHit1(safe, hitIndex);
  if (safe <= 75) return familyHit2(safe, hitIndex);
  if (safe <= 100) return familyHit3(safe, hitIndex);
  if (safe <= 125) return familyHit4(safe, hitIndex);
  if (safe <= 150) return familyHit5(safe, hitIndex);
  if (safe <= 175) return familyHit6(safe, hitIndex);
  if (safe <= 200) return familyHit7(safe, hitIndex);
  if (safe <= 225) return familyHit8(safe, hitIndex);
  return familyHit9(safe, hitIndex);
}

export function cueSlug(id: number): string {
  if (id < 1 || id > 250) return "";
  return getAudioCue(id).slug;
}

export function cueIdBySlug(slug: string): number {
  if (slug === "nav.forward") return 1;
  if (slug === "nav.back") return 2;
  if (slug === "nav.up") return 3;
  if (slug === "nav.home") return 4;
  if (slug === "nav.root") return 5;
  if (slug === "nav.tab-next") return 6;
  if (slug === "nav.tab-prev") return 7;
  if (slug === "nav.breadcrumb") return 8;
  if (slug === "nav.menu-open") return 9;
  if (slug === "nav.menu-close") return 10;
  if (slug === "nav.submenu-in") return 11;
  if (slug === "nav.submenu-out") return 12;
  if (slug === "nav.combo-open") return 13;
  if (slug === "nav.combo-select") return 14;
  if (slug === "nav.combo-empty") return 15;
  if (slug === "nav.search-start") return 16;
  if (slug === "nav.result-step") return 17;
  if (slug === "nav.result-wrap") return 18;
  if (slug === "nav.page-next") return 19;
  if (slug === "nav.page-prev") return 20;
  if (slug === "nav.anchor") return 21;
  if (slug === "nav.jump-return") return 22;
  if (slug === "nav.landmark") return 23;
  if (slug === "nav.workspace-switch") return 24;
  if (slug === "nav.history-end") return 25;
  if (slug === "control.hover") return 26;
  if (slug === "control.press") return 27;
  if (slug === "control.release") return 28;
  if (slug === "control.check") return 29;
  if (slug === "control.uncheck") return 30;
  if (slug === "control.mixed") return 31;
  if (slug === "control.radio-on") return 32;
  if (slug === "control.latch") return 33;
  if (slug === "control.unlatch") return 34;
  if (slug === "control.slider-step") return 35;
  if (slug === "control.slider-zero") return 36;
  if (slug === "control.slider-end") return 37;
  if (slug === "control.knob-detent") return 38;
  if (slug === "control.knob-wrap") return 39;
  if (slug === "control.field-focus") return 40;
  if (slug === "control.field-blur") return 41;
  if (slug === "control.field-valid") return 42;
  if (slug === "control.field-invalid") return 43;
  if (slug === "control.drag-arm") return 44;
  if (slug === "control.long-press") return 45;
  if (slug === "control.cancel-press") return 46;
  if (slug === "control.chip-add") return 47;
  if (slug === "control.chip-remove") return 48;
  if (slug === "control.segment") return 49;
  if (slug === "control.reset") return 50;
  if (slug === "window.create") return 51;
  if (slug === "window.focus") return 52;
  if (slug === "window.raise") return 53;
  if (slug === "window.lower") return 54;
  if (slug === "window.min") return 55;
  if (slug === "window.restore") return 56;
  if (slug === "window.max") return 57;
  if (slug === "window.unmax") return 58;
  if (slug === "window.close") return 59;
  if (slug === "window.resize-start") return 60;
  if (slug === "window.resize-step") return 61;
  if (slug === "window.resize-end") return 62;
  if (slug === "window.lock-size") return 63;
  if (slug === "window.unlock-size") return 64;
  if (slug === "window.split-view") return 65;
  if (slug === "window.join-view") return 66;
  if (slug === "window.picture-in") return 67;
  if (slug === "window.picture-out") return 68;
  if (slug === "window.shade") return 69;
  if (slug === "window.unshade") return 70;
  if (slug === "window.fullscreen") return 71;
  if (slug === "window.fullscreen-exit") return 72;
  if (slug === "window.move-display") return 73;
  if (slug === "window.modal-block") return 74;
  if (slug === "window.last-window") return 75;
  if (slug === "magnetic.enter") return 76;
  if (slug === "magnetic.engage") return 77;
  if (slug === "magnetic.release") return 78;
  if (slug === "magnetic.corner") return 79;
  if (slug === "magnetic.edge") return 80;
  if (slug === "magnetic.center") return 81;
  if (slug === "magnetic.repel") return 82;
  if (slug === "magnetic.push") return 83;
  if (slug === "magnetic.return") return 84;
  if (slug === "magnetic.ghost") return 85;
  if (slug === "magnetic.swap") return 86;
  if (slug === "magnetic.split") return 87;
  if (slug === "magnetic.stack") return 88;
  if (slug === "magnetic.unstack") return 89;
  if (slug === "magnetic.align-x") return 90;
  if (slug === "magnetic.align-y") return 91;
  if (slug === "magnetic.grid") return 92;
  if (slug === "magnetic.guide-on") return 93;
  if (slug === "magnetic.guide-off") return 94;
  if (slug === "magnetic.flush") return 95;
  if (slug === "magnetic.gap") return 96;
  if (slug === "magnetic.equalize") return 97;
  if (slug === "magnetic.breakaway") return 98;
  if (slug === "magnetic.reject") return 99;
  if (slug === "magnetic.settle") return 100;
  if (slug === "dock.ignite") return 101;
  if (slug === "dock.rekindle") return 102;
  if (slug === "dock.cool") return 103;
  if (slug === "dock.out") return 104;
  if (slug === "dock.land") return 105;
  if (slug === "dock.launch") return 106;
  if (slug === "dock.pin") return 107;
  if (slug === "dock.unpin") return 108;
  if (slug === "dock.pick") return 109;
  if (slug === "dock.reorder") return 110;
  if (slug === "dock.insert") return 111;
  if (slug === "dock.eject") return 112;
  if (slug === "dock.folder-open") return 113;
  if (slug === "dock.folder-close") return 114;
  if (slug === "dock.stack-peek") return 115;
  if (slug === "dock.stack-collapse") return 116;
  if (slug === "dock.overflow") return 117;
  if (slug === "dock.reveal") return 118;
  if (slug === "dock.hide") return 119;
  if (slug === "dock.magnify") return 120;
  if (slug === "dock.favorite") return 121;
  if (slug === "dock.badge") return 122;
  if (slug === "dock.clear-badge") return 123;
  if (slug === "dock.bounce") return 124;
  if (slug === "dock.empty") return 125;
  if (slug === "star.listen") return 126;
  if (slug === "star.think") return 127;
  if (slug === "star.tick") return 128;
  if (slug === "star.done") return 129;
  if (slug === "star.wakeword") return 130;
  if (slug === "star.partial") return 131;
  if (slug === "star.transcript") return 132;
  if (slug === "star.endpoint") return 133;
  if (slug === "star.interrupt") return 134;
  if (slug === "star.resume") return 135;
  if (slug === "star.speak") return 136;
  if (slug === "star.hush") return 137;
  if (slug === "star.tool-start") return 138;
  if (slug === "star.tool-result") return 139;
  if (slug === "star.tool-fail") return 140;
  if (slug === "star.clarify") return 141;
  if (slug === "star.handoff") return 142;
  if (slug === "star.mic-lost") return 143;
  if (slug === "star.offline") return 144;
  if (slug === "star.retry") return 145;
  if (slug === "star.context") return 146;
  if (slug === "star.recall") return 147;
  if (slug === "star.branch") return 148;
  if (slug === "star.accept") return 149;
  if (slug === "star.dismiss") return 150;
  if (slug === "canvas.stroke") return 151;
  if (slug === "canvas.lift") return 152;
  if (slug === "canvas.erase") return 153;
  if (slug === "canvas.fill") return 154;
  if (slug === "canvas.sample") return 155;
  if (slug === "canvas.mask") return 156;
  if (slug === "canvas.invert") return 157;
  if (slug === "canvas.layer-new") return 158;
  if (slug === "canvas.layer-hide") return 159;
  if (slug === "canvas.layer-show") return 160;
  if (slug === "canvas.layer-merge") return 161;
  if (slug === "canvas.layer-lock") return 162;
  if (slug === "canvas.blend") return 163;
  if (slug === "canvas.opacity") return 164;
  if (slug === "canvas.crop") return 165;
  if (slug === "canvas.straighten") return 166;
  if (slug === "canvas.zoom-in") return 167;
  if (slug === "canvas.zoom-out") return 168;
  if (slug === "canvas.fit") return 169;
  if (slug === "canvas.actual") return 170;
  if (slug === "canvas.before") return 171;
  if (slug === "canvas.after") return 172;
  if (slug === "canvas.look") return 173;
  if (slug === "canvas.frame") return 174;
  if (slug === "canvas.export") return 175;
  if (slug === "notify.message") return 176;
  if (slug === "notify.mention") return 177;
  if (slug === "notify.reply") return 178;
  if (slug === "notify.invite") return 179;
  if (slug === "notify.reminder") return 180;
  if (slug === "notify.due") return 181;
  if (slug === "notify.overdue") return 182;
  if (slug === "notify.warning") return 183;
  if (slug === "notify.error") return 184;
  if (slug === "notify.fatal") return 185;
  if (slug === "notify.success") return 186;
  if (slug === "notify.info") return 187;
  if (slug === "notify.muted-summary") return 188;
  if (slug === "notify.queued") return 189;
  if (slug === "notify.delivered") return 190;
  if (slug === "notify.bounced") return 191;
  if (slug === "notify.conflict") return 192;
  if (slug === "notify.resolved") return 193;
  if (slug === "notify.reconnect") return 194;
  if (slug === "notify.available") return 195;
  if (slug === "notify.battery-low") return 196;
  if (slug === "notify.charge-ready") return 197;
  if (slug === "notify.permission") return 198;
  if (slug === "notify.approval") return 199;
  if (slug === "notify.revoked") return 200;
  if (slug === "system.on") return 201;
  if (slug === "system.lock") return 202;
  if (slug === "system.unlock") return 203;
  if (slug === "system.sleep") return 204;
  if (slug === "system.wake") return 205;
  if (slug === "system.shutdown") return 206;
  if (slug === "system.restart") return 207;
  if (slug === "system.online") return 208;
  if (slug === "system.offline") return 209;
  if (slug === "system.pair") return 210;
  if (slug === "system.unpair") return 211;
  if (slug === "system.mount") return 212;
  if (slug === "system.unmount") return 213;
  if (slug === "system.sync-on") return 214;
  if (slug === "system.sync-off") return 215;
  if (slug === "system.profile") return 216;
  if (slug === "system.guest") return 217;
  if (slug === "system.privacy-on") return 218;
  if (slug === "system.privacy-off") return 219;
  if (slug === "system.dnd-on") return 220;
  if (slug === "system.dnd-off") return 221;
  if (slug === "system.backup") return 222;
  if (slug === "system.recovery") return 223;
  if (slug === "system.resource-low") return 224;
  if (slug === "system.update") return 225;
  if (slug === "progress.enqueue") return 226;
  if (slug === "progress.begin") return 227;
  if (slug === "progress.first-byte") return 228;
  if (slug === "progress.checkpoint") return 229;
  if (slug === "progress.quarter") return 230;
  if (slug === "progress.half") return 231;
  if (slug === "progress.three-quarter") return 232;
  if (slug === "progress.final-step") return 233;
  if (slug === "progress.complete") return 234;
  if (slug === "progress.pause") return 235;
  if (slug === "progress.resume") return 236;
  if (slug === "progress.cancel") return 237;
  if (slug === "progress.retry") return 238;
  if (slug === "progress.backoff") return 239;
  if (slug === "progress.stalled") return 240;
  if (slug === "progress.drain") return 241;
  if (slug === "progress.flush") return 242;
  if (slug === "progress.verify") return 243;
  if (slug === "progress.hash-ok") return 244;
  if (slug === "progress.hash-fail") return 245;
  if (slug === "progress.rollback") return 246;
  if (slug === "progress.commit") return 247;
  if (slug === "progress.skip") return 248;
  if (slug === "progress.indeterminate") return 249;
  if (slug === "progress.batch-end") return 250;
  return 0;
}

export function findCueByTrigger(kind: string, transition: string): number {
  if (kind === "OS_STATE_CHANGE" && transition === "historyForward") return 1;
  if (kind === "OS_STATE_CHANGE" && transition === "historyBack") return 2;
  if (kind === "OS_STATE_CHANGE" && transition === "parentEntered") return 3;
  if (kind === "OS_STATE_CHANGE" && transition === "homeEntered") return 4;
  if (kind === "SETTLE" && transition === "rootReached") return 5;
  if (kind === "IMPULSE" && transition === "tabNext") return 6;
  if (kind === "IMPULSE" && transition === "tabPrevious") return 7;
  if (kind === "OS_STATE_CHANGE" && transition === "crumbEntered") return 8;
  if (kind === "OS_STATE_CHANGE" && transition === "menuOpened") return 9;
  if (kind === "OS_STATE_CHANGE" && transition === "menuDismissed") return 10;
  if (kind === "OS_STATE_CHANGE" && transition === "submenuEntered") return 11;
  if (kind === "OS_STATE_CHANGE" && transition === "submenuExited") return 12;
  if (kind === "OS_STATE_CHANGE" && transition === "comboOpen") return 13;
  if (kind === "OS_STATE_CHANGE" && transition === "comboSelect") return 14;
  if (kind === "OS_STATE_CHANGE" && transition === "optionsBecameEmpty") return 15;
  if (kind === "OS_STATE_CHANGE" && transition === "searchEntered") return 16;
  if (kind === "IMPULSE" && transition === "resultAdvanced") return 17;
  if (kind === "BOUNDARY_HIT" && transition === "resultWrapped") return 18;
  if (kind === "OS_STATE_CHANGE" && transition === "pageAdvanced") return 19;
  if (kind === "OS_STATE_CHANGE" && transition === "pageRetreated") return 20;
  if (kind === "SETTLE" && transition === "anchorReached") return 21;
  if (kind === "SETTLE" && transition === "readingAnchorRestored") return 22;
  if (kind === "OS_STATE_CHANGE" && transition === "landmarkEntered") return 23;
  if (kind === "OS_STATE_CHANGE" && transition === "workspaceChanged") return 24;
  if (kind === "BOUNDARY_HIT" && transition === "historyExhausted") return 25;
  if (kind === "IMPULSE" && transition === "hoverEnter") return 26;
  if (kind === "IMPULSE" && transition === "down") return 27;
  if (kind === "SNAP_RELEASE" && transition === "upInside") return 28;
  if (kind === "OS_STATE_CHANGE" && transition === "checked") return 29;
  if (kind === "OS_STATE_CHANGE" && transition === "unchecked") return 30;
  if (kind === "OS_STATE_CHANGE" && transition === "checkMixed") return 31;
  if (kind === "OS_STATE_CHANGE" && transition === "radioSelected") return 32;
  if (kind === "SNAP_ENGAGE" && transition === "switchLatched") return 33;
  if (kind === "SNAP_RELEASE" && transition === "switchReleased") return 34;
  if (kind === "IMPULSE" && transition === "sliderIncrement") return 35;
  if (kind === "SNAP_ENGAGE" && transition === "neutralCrossed") return 36;
  if (kind === "BOUNDARY_HIT" && transition === "sliderStop") return 37;
  if (kind === "SNAP_ENGAGE" && transition === "rotaryDetent") return 38;
  if (kind === "OS_STATE_CHANGE" && transition === "rotaryWrapped") return 39;
  if (kind === "OS_STATE_CHANGE" && transition === "editFocusIn") return 40;
  if (kind === "OS_STATE_CHANGE" && transition === "editFocusOut") return 41;
  if (kind === "OS_STATE_CHANGE" && transition === "fieldValidated") return 42;
  if (kind === "OS_STATE_CHANGE" && transition === "fieldRejected") return 43;
  if (kind === "SNAP_ENGAGE" && transition === "dragArmed") return 44;
  if (kind === "OS_STATE_CHANGE" && transition === "holdQualified") return 45;
  if (kind === "SNAP_RELEASE" && transition === "pressCancelled") return 46;
  if (kind === "OS_STATE_CHANGE" && transition === "chipInserted") return 47;
  if (kind === "OS_STATE_CHANGE" && transition === "chipRemoved") return 48;
  if (kind === "OS_STATE_CHANGE" && transition === "segmentChanged") return 49;
  if (kind === "OS_STATE_CHANGE" && transition === "controlDefaulted") return 50;
  if (kind === "OS_STATE_CHANGE" && transition === "windowCreated") return 51;
  if (kind === "OS_STATE_CHANGE" && transition === "windowFocused") return 52;
  if (kind === "OS_STATE_CHANGE" && transition === "zOrderRaised") return 53;
  if (kind === "OS_STATE_CHANGE" && transition === "zOrderLowered") return 54;
  if (kind === "OS_STATE_CHANGE" && transition === "min") return 55;
  if (kind === "OS_STATE_CHANGE" && transition === "restore") return 56;
  if (kind === "OS_STATE_CHANGE" && transition === "maximize") return 57;
  if (kind === "OS_STATE_CHANGE" && transition === "unmaximize") return 58;
  if (kind === "OS_STATE_CHANGE" && transition === "windowClosed") return 59;
  if (kind === "IMPULSE" && transition === "resizeBegin") return 60;
  if (kind === "IMPULSE" && transition === "sizeIncrement") return 61;
  if (kind === "SETTLE" && transition === "resizeCommitted") return 62;
  if (kind === "SNAP_ENGAGE" && transition === "sizeLocked") return 63;
  if (kind === "SNAP_RELEASE" && transition === "sizeUnlocked") return 64;
  if (kind === "OS_STATE_CHANGE" && transition === "viewSplit") return 65;
  if (kind === "OS_STATE_CHANGE" && transition === "viewsJoined") return 66;
  if (kind === "OS_STATE_CHANGE" && transition === "pictureDetached") return 67;
  if (kind === "OS_STATE_CHANGE" && transition === "pictureReturned") return 68;
  if (kind === "OS_STATE_CHANGE" && transition === "paneShaded") return 69;
  if (kind === "OS_STATE_CHANGE" && transition === "paneUnshaded") return 70;
  if (kind === "OS_STATE_CHANGE" && transition === "fullscreenEntered") return 71;
  if (kind === "OS_STATE_CHANGE" && transition === "fullscreenExited") return 72;
  if (kind === "OS_STATE_CHANGE" && transition === "displayTransferred") return 73;
  if (kind === "BOUNDARY_HIT" && transition === "modalIntercept") return 74;
  if (kind === "OS_STATE_CHANGE" && transition === "workspaceEmpty") return 75;
  if (kind === "IMPULSE" && transition === "fieldEntered") return 76;
  if (kind === "SNAP_ENGAGE" && transition === "latch") return 77;
  if (kind === "SNAP_RELEASE" && transition === "unlatch") return 78;
  if (kind === "SNAP_ENGAGE" && transition === "cornerCaptured") return 79;
  if (kind === "SNAP_ENGAGE" && transition === "edgeCaptured") return 80;
  if (kind === "SNAP_ENGAGE" && transition === "centerCaptured") return 81;
  if (kind === "BOUNDARY_HIT" && transition === "repulsion") return 82;
  if (kind === "IMPULSE" && transition === "neighborDisplaced") return 83;
  if (kind === "SETTLE" && transition === "neighborReturned") return 84;
  if (kind === "OS_STATE_CHANGE" && transition === "previewQualified") return 85;
  if (kind === "OS_STATE_CHANGE" && transition === "slotsSwapped") return 86;
  if (kind === "OS_STATE_CHANGE" && transition === "slotDivided") return 87;
  if (kind === "SNAP_ENGAGE" && transition === "stackFormed") return 88;
  if (kind === "SNAP_RELEASE" && transition === "stackDetached") return 89;
  if (kind === "SNAP_ENGAGE" && transition === "xAligned") return 90;
  if (kind === "SNAP_ENGAGE" && transition === "yAligned") return 91;
  if (kind === "SNAP_ENGAGE" && transition === "gridPoint") return 92;
  if (kind === "SNAP_ENGAGE" && transition === "guideCaught") return 93;
  if (kind === "SNAP_RELEASE" && transition === "guideReleased") return 94;
  if (kind === "SNAP_ENGAGE" && transition === "flushContact") return 95;
  if (kind === "SNAP_ENGAGE" && transition === "gutterMatched") return 96;
  if (kind === "SNAP_ENGAGE" && transition === "equalSpacing") return 97;
  if (kind === "SNAP_RELEASE" && transition === "velocityBreakaway") return 98;
  if (kind === "BOUNDARY_HIT" && transition === "slotTooSmall") return 99;
  if (kind === "SETTLE" && transition === "neighborsHome") return 100;
  if (kind === "OS_STATE_CHANGE" && transition === "appFirstLaunch") return 101;
  if (kind === "OS_STATE_CHANGE" && transition === "appReactivated") return 102;
  if (kind === "OS_STATE_CHANGE" && transition === "runningAppBlurred") return 103;
  if (kind === "OS_STATE_CHANGE" && transition === "appExtinguished") return 104;
  if (kind === "SETTLE" && transition === "dockContact") return 105;
  if (kind === "IMPULSE" && transition === "launchRequested") return 106;
  if (kind === "SNAP_ENGAGE" && transition === "itemPinned") return 107;
  if (kind === "SNAP_RELEASE" && transition === "itemUnpinned") return 108;
  if (kind === "IMPULSE" && transition === "dockLift") return 109;
  if (kind === "IMPULSE" && transition === "dockIndexChanged") return 110;
  if (kind === "SNAP_ENGAGE" && transition === "externalItemInserted") return 111;
  if (kind === "SNAP_RELEASE" && transition === "itemEjected") return 112;
  if (kind === "OS_STATE_CHANGE" && transition === "dockFolderOpened") return 113;
  if (kind === "OS_STATE_CHANGE" && transition === "dockFolderClosed") return 114;
  if (kind === "OS_STATE_CHANGE" && transition === "stackPreviewed") return 115;
  if (kind === "OS_STATE_CHANGE" && transition === "stackPreviewDismissed") return 116;
  if (kind === "OS_STATE_CHANGE" && transition === "dockOverflowOpened") return 117;
  if (kind === "OS_STATE_CHANGE" && transition === "dockRevealed") return 118;
  if (kind === "OS_STATE_CHANGE" && transition === "dockHidden") return 119;
  if (kind === "SNAP_ENGAGE" && transition === "magnifierEntered") return 120;
  if (kind === "OS_STATE_CHANGE" && transition === "favoriteSaved") return 121;
  if (kind === "OS_STATE_CHANGE" && transition === "badgeAppeared") return 122;
  if (kind === "OS_STATE_CHANGE" && transition === "badgeCleared") return 123;
  if (kind === "IMPULSE" && transition === "appAttention") return 124;
  if (kind === "OS_STATE_CHANGE" && transition === "dockBecameEmpty") return 125;
  if (kind === "OS_STATE_CHANGE" && transition === "listening") return 126;
  if (kind === "OS_STATE_CHANGE" && transition === "thinking") return 127;
  if (kind === "SETTLE" && transition === "turnStep") return 128;
  if (kind === "OS_STATE_CHANGE" && transition === "completed") return 129;
  if (kind === "OS_STATE_CHANGE" && transition === "wakewordAccepted") return 130;
  if (kind === "OS_STATE_CHANGE" && transition === "firstPartial") return 131;
  if (kind === "OS_STATE_CHANGE" && transition === "transcriptFinal") return 132;
  if (kind === "VOICE_LEVEL" && transition === "endpoint") return 133;
  if (kind === "IMPULSE" && transition === "bargeIn") return 134;
  if (kind === "OS_STATE_CHANGE" && transition === "answerResumed") return 135;
  if (kind === "OS_STATE_CHANGE" && transition === "speechStarted") return 136;
  if (kind === "OS_STATE_CHANGE" && transition === "speechSuppressed") return 137;
  if (kind === "OS_STATE_CHANGE" && transition === "toolAccepted") return 138;
  if (kind === "OS_STATE_CHANGE" && transition === "toolResultBound") return 139;
  if (kind === "OS_STATE_CHANGE" && transition === "toolFailed") return 140;
  if (kind === "OS_STATE_CHANGE" && transition === "clarificationRequested") return 141;
  if (kind === "OS_STATE_CHANGE" && transition === "agentAccepted") return 142;
  if (kind === "OS_STATE_CHANGE" && transition === "micDisconnected") return 143;
  if (kind === "OS_STATE_CHANGE" && transition === "localMode") return 144;
  if (kind === "IMPULSE" && transition === "turnRetried") return 145;
  if (kind === "OS_STATE_CHANGE" && transition === "contextAttached") return 146;
  if (kind === "OS_STATE_CHANGE" && transition === "memoryRetrieved") return 147;
  if (kind === "OS_STATE_CHANGE" && transition === "orbitForked") return 148;
  if (kind === "OS_STATE_CHANGE" && transition === "proposalApplied") return 149;
  if (kind === "OS_STATE_CHANGE" && transition === "proposalDismissed") return 150;
  if (kind === "IMPULSE" && transition === "penContact") return 151;
  if (kind === "SNAP_RELEASE" && transition === "strokeCommitted") return 152;
  if (kind === "IMPULSE" && transition === "eraserContact") return 153;
  if (kind === "OS_STATE_CHANGE" && transition === "regionFilled") return 154;
  if (kind === "IMPULSE" && transition === "colorSampled") return 155;
  if (kind === "OS_STATE_CHANGE" && transition === "maskEditing") return 156;
  if (kind === "OS_STATE_CHANGE" && transition === "maskInverted") return 157;
  if (kind === "OS_STATE_CHANGE" && transition === "layerCreated") return 158;
  if (kind === "OS_STATE_CHANGE" && transition === "layerHidden") return 159;
  if (kind === "OS_STATE_CHANGE" && transition === "layerShown") return 160;
  if (kind === "OS_STATE_CHANGE" && transition === "layersMerged") return 161;
  if (kind === "SNAP_ENGAGE" && transition === "layerLocked") return 162;
  if (kind === "OS_STATE_CHANGE" && transition === "blendChanged") return 163;
  if (kind === "IMPULSE" && transition === "opacityMark") return 164;
  if (kind === "OS_STATE_CHANGE" && transition === "cropApplied") return 165;
  if (kind === "SNAP_ENGAGE" && transition === "horizonAligned") return 166;
  if (kind === "IMPULSE" && transition === "zoomStepIn") return 167;
  if (kind === "IMPULSE" && transition === "zoomStepOut") return 168;
  if (kind === "SETTLE" && transition === "artworkFit") return 169;
  if (kind === "SNAP_ENGAGE" && transition === "oneToOne") return 170;
  if (kind === "OS_STATE_CHANGE" && transition === "beforeRevealed") return 171;
  if (kind === "OS_STATE_CHANGE" && transition === "afterRevealed") return 172;
  if (kind === "OS_STATE_CHANGE" && transition === "lookApplied") return 173;
  if (kind === "OS_STATE_CHANGE" && transition === "filmFrameChanged") return 174;
  if (kind === "OS_STATE_CHANGE" && transition === "imageEncoded") return 175;
  if (kind === "OS_STATE_CHANGE" && transition === "messageUnread") return 176;
  if (kind === "OS_STATE_CHANGE" && transition === "userMentioned") return 177;
  if (kind === "OS_STATE_CHANGE" && transition === "threadReply") return 178;
  if (kind === "OS_STATE_CHANGE" && transition === "inviteReceived") return 179;
  if (kind === "OS_STATE_CHANGE" && transition === "reminderFired") return 180;
  if (kind === "OS_STATE_CHANGE" && transition === "deadlineReached") return 181;
  if (kind === "OS_STATE_CHANGE" && transition === "taskOverdue") return 182;
  if (kind === "OS_STATE_CHANGE" && transition === "warningRaised") return 183;
  if (kind === "OS_STATE_CHANGE" && transition === "actionFailed") return 184;
  if (kind === "OS_STATE_CHANGE" && transition === "sessionHalted") return 185;
  if (kind === "OS_STATE_CHANGE" && transition === "actionSucceeded") return 186;
  if (kind === "OS_STATE_CHANGE" && transition === "infoPosted") return 187;
  if (kind === "OS_STATE_CHANGE" && transition === "digestReady") return 188;
  if (kind === "OS_STATE_CHANGE" && transition === "messageQueued") return 189;
  if (kind === "OS_STATE_CHANGE" && transition === "deliveryAcknowledged") return 190;
  if (kind === "OS_STATE_CHANGE" && transition === "deliveryRejected") return 191;
  if (kind === "OS_STATE_CHANGE" && transition === "revisionConflict") return 192;
  if (kind === "OS_STATE_CHANGE" && transition === "conflictResolved") return 193;
  if (kind === "OS_STATE_CHANGE" && transition === "sessionRejoined") return 194;
  if (kind === "OS_STATE_CHANGE" && transition === "resourceAvailable") return 195;
  if (kind === "OS_STATE_CHANGE" && transition === "lowChargeEdge") return 196;
  if (kind === "OS_STATE_CHANGE" && transition === "chargeTarget") return 197;
  if (kind === "OS_STATE_CHANGE" && transition === "permissionRequested") return 198;
  if (kind === "OS_STATE_CHANGE" && transition === "approvalReceived") return 199;
  if (kind === "OS_STATE_CHANGE" && transition === "accessRevoked") return 200;
  if (kind === "OS_STATE_CHANGE" && transition === "audioEnabled") return 201;
  if (kind === "OS_STATE_CHANGE" && transition === "sessionLocked") return 202;
  if (kind === "OS_STATE_CHANGE" && transition === "sessionUnlocked") return 203;
  if (kind === "OS_STATE_CHANGE" && transition === "sleepAccepted") return 204;
  if (kind === "OS_STATE_CHANGE" && transition === "shellAwake") return 205;
  if (kind === "OS_STATE_CHANGE" && transition === "powerDownCommitted") return 206;
  if (kind === "OS_STATE_CHANGE" && transition === "restartAccepted") return 207;
  if (kind === "OS_STATE_CHANGE" && transition === "networkOnline") return 208;
  if (kind === "OS_STATE_CHANGE" && transition === "networkOffline") return 209;
  if (kind === "OS_STATE_CHANGE" && transition === "devicePaired") return 210;
  if (kind === "OS_STATE_CHANGE" && transition === "deviceUnpaired") return 211;
  if (kind === "OS_STATE_CHANGE" && transition === "volumeMounted") return 212;
  if (kind === "OS_STATE_CHANGE" && transition === "volumeUnmounted") return 213;
  if (kind === "OS_STATE_CHANGE" && transition === "syncEnabled") return 214;
  if (kind === "OS_STATE_CHANGE" && transition === "syncDisabled") return 215;
  if (kind === "OS_STATE_CHANGE" && transition === "profileChanged") return 216;
  if (kind === "OS_STATE_CHANGE" && transition === "guestEntered") return 217;
  if (kind === "SNAP_ENGAGE" && transition === "privacyShield") return 218;
  if (kind === "SNAP_RELEASE" && transition === "privacyShield") return 219;
  if (kind === "OS_STATE_CHANGE" && transition === "quietEnabled") return 220;
  if (kind === "OS_STATE_CHANGE" && transition === "quietDisabled") return 221;
  if (kind === "OS_STATE_CHANGE" && transition === "backupDurable") return 222;
  if (kind === "OS_STATE_CHANGE" && transition === "recoveryReady") return 223;
  if (kind === "OS_STATE_CHANGE" && transition === "resourceTierLow") return 224;
  if (kind === "OS_STATE_CHANGE" && transition === "updatePrepared") return 225;
  if (kind === "OS_STATE_CHANGE" && transition === "jobEnqueued") return 226;
  if (kind === "OS_STATE_CHANGE" && transition === "jobStarted") return 227;
  if (kind === "OS_STATE_CHANGE" && transition === "firstPayload") return 228;
  if (kind === "OS_STATE_CHANGE" && transition === "checkpointWritten") return 229;
  if (kind === "OS_STATE_CHANGE" && transition === "quarterCrossed") return 230;
  if (kind === "OS_STATE_CHANGE" && transition === "halfCrossed") return 231;
  if (kind === "OS_STATE_CHANGE" && transition === "threeQuarterCrossed") return 232;
  if (kind === "OS_STATE_CHANGE" && transition === "finalUnitStarted") return 233;
  if (kind === "SETTLE" && transition === "jobComplete") return 234;
  if (kind === "OS_STATE_CHANGE" && transition === "jobPaused") return 235;
  if (kind === "OS_STATE_CHANGE" && transition === "jobResumed") return 236;
  if (kind === "OS_STATE_CHANGE" && transition === "jobCancelled") return 237;
  if (kind === "OS_STATE_CHANGE" && transition === "attemptAdmitted") return 238;
  if (kind === "OS_STATE_CHANGE" && transition === "backoffEntered") return 239;
  if (kind === "OS_STATE_CHANGE" && transition === "stallDetected") return 240;
  if (kind === "OS_STATE_CHANGE" && transition === "drainStarted") return 241;
  if (kind === "SETTLE" && transition === "outputFlushed") return 242;
  if (kind === "OS_STATE_CHANGE" && transition === "verificationStarted") return 243;
  if (kind === "OS_STATE_CHANGE" && transition === "digestMatched") return 244;
  if (kind === "OS_STATE_CHANGE" && transition === "digestMismatch") return 245;
  if (kind === "SETTLE" && transition === "rollbackFinished") return 246;
  if (kind === "OS_STATE_CHANGE" && transition === "transactionCommitted") return 247;
  if (kind === "OS_STATE_CHANGE" && transition === "unitSkipped") return 248;
  if (kind === "OS_STATE_CHANGE" && transition === "estimateLost") return 249;
  if (kind === "SETTLE" && transition === "batchClosed") return 250;
  return 0;
}

export function getAudioCueBySlug(slug: string): AudioCue {
  const id = cueIdBySlug(slug);
  return getAudioCue(id > 0 ? id : 1);
}
