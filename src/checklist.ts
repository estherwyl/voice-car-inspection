export const SOURCE_URL = 'https://www.carsome.my/buy-car/subaru/xv/2022-subaru-xv-gt-edition-eyesight-2.0/ctnf600/full-report#Exterior';
export const VEHICLE = { id: 'subaru-xv-2022', name: 'Subaru XV', variant: 'GT Edition EyeSight 2.0', year: 2022, fuel: 'Petrol', transmission: 'Automatic', drive: 'AWD', color: 'White', sourceId: 'CTNF600' };
export type Section = 'Exterior' | 'Interior' | 'Road test' | 'Underbody' | 'Major';
export const SECTIONS: Section[] = ['Exterior','Interior','Underbody','Road test','Major'];
export type Part = { id:string; name:string; view:'Exterior'|'Interior'; kind:string; pos:[number,number,number]; size:[number,number,number] };
export const PARTS:Part[] = [
  ...(['left','right'] as const).flatMap((side,i)=> {const x=i===0?1:-1;return [
    {id:`${side}-front-door`,name:`${side} front door`,kind:'door',pos:[x,1.05,-.55],size:[.08,.85,1.1]},
    {id:`${side}-rear-door`,name:`${side} rear door`,kind:'door',pos:[x,1.05,.65],size:[.08,.85,1.08]},
    {id:`${side}-front-fender`,name:`${side} front fender`,kind:'fender',pos:[x,.9,-1.62],size:[.13,.7,.92]},
    {id:`${side}-rear-fender`,name:`${side} rear fender`,kind:'fender',pos:[x,.94,1.6],size:[.13,.78,.78]},
    {id:`${side}-mirror`,name:`${side} mirror`,kind:'mirror',pos:[x*1.18,1.55,-.99],size:[.28,.19,.36]},
    {id:`${side}-front-wheel`,name:`${side} front wheel`,kind:'wheel',pos:[x*1.03,.55,-1.45],size:[.44,.44,.26]},
    {id:`${side}-rear-wheel`,name:`${side} rear wheel`,kind:'wheel',pos:[x*1.03,.55,1.45],size:[.44,.44,.26]},
  ].map(p=>({...p,view:'Exterior' as const,pos:p.pos as [number,number,number],size:p.size as [number,number,number]}))}),
  {id:'bonnet',name:'Front bonnet',view:'Exterior',kind:'bonnet',pos:[0,1.16,-1.59],size:[1.85,.12,1.15]},
  {id:'boot',name:'Rear bonnet / boot',view:'Exterior',kind:'boot',pos:[0,1.12,2.03],size:[1.86,.77,.12]},
  {id:'front-bumper',name:'Front bumper',view:'Exterior',kind:'bumper',pos:[0,.68,-2.2],size:[2.04,.44,.26]},
  {id:'rear-bumper',name:'Rear bumper',view:'Exterior',kind:'bumper',pos:[0,.65,2.18],size:[2.04,.4,.24]},
  {id:'windshield',name:'Front windshield',view:'Exterior',kind:'windshield',pos:[0,1.59,-.93],size:[1.73,.08,.94]},
  {id:'rear-glass',name:'Rear window',view:'Exterior',kind:'rear-glass',pos:[0,1.65,1.54],size:[1.72,.08,.77]},
  {id:'roof',name:'Roof & structure',view:'Exterior',kind:'roof',pos:[0,1.94,.32],size:[1.65,.1,1.9]},
  {id:'lights',name:'Exterior lights',view:'Exterior',kind:'lights',pos:[0,1.02,-2.13],size:[1.9,.18,.08]},
  {id:'driver-seat',name:'Driver seat · right',view:'Interior',kind:'seat',pos:[-.48,.95,-.28],size:[.68,.8,.7]},
  {id:'passenger-seat',name:'Front passenger seat',view:'Interior',kind:'seat',pos:[.48,.95,-.28],size:[.68,.8,.7]},
  {id:'rear-seat',name:'Rear seats',view:'Interior',kind:'seat',pos:[0,.97,1.03],size:[1.66,.75,.7]},
  {id:'dashboard',name:'Dashboard & controls',view:'Interior',kind:'dash',pos:[0,1.12,-1.01],size:[1.75,.36,.45]},
  {id:'steering',name:'Steering & brakes',view:'Interior',kind:'steering',pos:[-.5,1.45,-.65],size:[.27,.27,.1]},
  {id:'console',name:'Center console',view:'Interior',kind:'console',pos:[0,.91,.08],size:[.25,.32,1.02]},
  {id:'belts',name:'Safety belts',view:'Interior',kind:'belts',pos:[.86,1.32,.13],size:[.06,.95,.12]},
  {id:'cabin-trim',name:'Cabin trim & headlining',view:'Interior',kind:'trim',pos:[.9,.95,.6],size:[.06,.55,2.5]},
  {id:'engine',name:'Engine & cooling',view:'Exterior',kind:'engine',pos:[0,.7,-1.53],size:[1.2,.6,.85]},
  {id:'underbody',name:'Underbody & drivetrain',view:'Exterior',kind:'underbody',pos:[0,.3,0],size:[1.65,.12,3.6]},
];
export const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
// Transcribed from the rendered report, including categories hidden by its tabs (13 Sep 2026).
const GROUPS: [Section,string,string][] = [
['Exterior','Body Panels & Bumpers',`Accident Vehicle Rear|Right Rear Door|Left Rear Fender|Left Front Door|Right Front Door|Right Rear Running Panel|Chassis Or Engine Number Tampered|Cut & Joint Vehicle Rear|Right Front Running Panel|Left Front Running Panel|Accident Vehicle Front|Accident Vehicle Rear Left|Flood Ridden Rear|Back Construction Use/off Road|Cut & Joint Vehicle Front|Cut & Joint Vehicle Rear Left|Flood Ridden Front|Right A-pillar|Front Construction Use/off Road|Flood Ridden Front Right|Left Rear Door|Left Rear Running Panel|Flood Ridden Front Left|Left B-pillar|Left A-pillar|Flood Ridden Rear Left|Right C-pillar|Rear Bonnet|Rear Left Construction Use/off Road|Front Bonnet Insulator|Front Bonnet|Front Bonnet Support|Rear Bumper|Left C-pillar|Right Rear Fender|Accident Vehicle Front Right|Cut & Joint Vehicle Front Right|Front Right Construction Use/off Road|Accident Vehicle Rear Right|Cut & Joint Vehicle Rear Right|Accident Vehicle Front Left|Flood Ridden Rear Right|Cut & Joint Vehicle Front Left|Rear Right Construction Use/off Road|Front Left Construction Use/off Road|Left Front Fender|Front Bumper|Right Front Fender|Right B-pillar|Chassis Or Motor Number Tampered`],
['Exterior','Doors, Hood & Boot','Rear Bonnet Release Mechanism|Spoiler|Roof|Front Bonnet Release Mechanism|Front Grille'],
['Exterior','Exterior Lights','Taillamp Rear Right|Taillamp Rear Left|Front Left Headlamp|Front Right Headlamp|Auto On/off Lights'],
['Exterior','Glass & Outside Mirrors','Left Side Mirror|Right Side Mirror|Rear Window/tailgate Glass|Front Left Electric Folding Mirror|Front Windshield|Front Right Electric Folding Mirror'],
['Interior','Audio & Alarm Systems','Alarm/theft-deterrent System|Reverse Camera|Audio/monitor Player'],
['Interior','Carpet, Trim & Mats','Driver Seat|Rear Right Door Trim & Door Panels|Front Passenger Seat|Dashboard Front Left|Headlining 2nd Row Right|Right A-pillar Trim|Headlining Front Left|Front Right Door Trim & Door Panels|Headlining Front Right|Parcel Shelf/speaker Board|Rear Seat 2nd Row|Front Left Door Trim & Door Panels|Folding Seats|Rear Left Door Trim & Door Panels|Headlining 2nd Row Left|Left B-pillar Trim|Left A-pillar Trim|Right C-pillar Trim|Left C-pillar Trim|Dashboard Front Right|Right B-pillar Trim'],
['Interior','Heat, Vent, Ac, Defog & Defrost','Front Left Aircond Vents|Rear Right Aircond Vents|Rear Center Aircond Vents|Rear Left Aircond Vents|Front Right Aircond Vents|Front Center Aircon Vents|Air Conditioning System|Air Conditioning Switch Panel|A/c Blower'],
['Interior','Interior Amenities','Warning Light|Tripmeter & Odometer|Multi Function Display|Multifunction Steering Wheel Switches|Indicator Lights|Instrument Cluster|I-drive System|Horn|Handbrake/footbrake Lever|Gear Knob|Front Parking Sensors / Camera|Back Parking Sensors / Camera|Center Armrest/console|Meter & Gauges Operation|Paddle Shifters|Steering Column Lock|Steering Wheel|Sun Visors, Vanity Mirror & Light|Windshield Wipers Switch'],
['Interior','Safety Belts','Safety Belts 2nd Row Right|Safety Belts 2nd Row Left|Safety Belts Front Left|Safety Belts Front Right'],
['Interior','Sunroof, Moonroof, Convertible Top','Sunshade / Rear Roller Blind Motor|Sunroof/moonroof'],
['Interior','Windows & Door Locks','Rear Right Power Window Controls|Central Locking System|Front Left Power Window Controls|Rear Left Power Window Controls|Push-button Start System|Front Right Power Window Controls|Remote Boot Release|Remote Entry System'],
['Road test','Engine','Engine Starting|Engine Idling|Engine Acceleration|Engine Noise|Motor Acceleration|Motor Mounts'],
['Road test','Steering & Brake','Steering Operation|Undercarriage Noise|Brake Operation|Regenerative Braking System'],
['Road test','Transmission, Transaxle & Clutch','Transmission / Transaxle Shift|Transmission / Transaxle Noise|Shift Interlock Operation|Drive Axle / Transfer Case Noise|Clutch Operation|Drive Axle Noise'],
['Underbody','Cooling System','Coolant Reservoir Tank|Radiator|Radiator Cap|Cooling Fans'],
['Underbody','Electrical System','Battery'],
['Underbody','Engine','Engine Mounts'],
['Underbody','Exhaust System','Exhaust Muffler'],
['Underbody','Fluids','Splash Cover|Coolant|Engine Oil|Transmission/transaxle Automatic Fluids'],
['Underbody','Steering And Alignment','Rack-and-pinion, Linkage & Boots'],
['Underbody','Suspension','Shock Absorber Rear Left|Shock Absorber Rear Right|Shock Absorber Front Left|Shock Absorber Front Right'],
['Underbody','Transmission, Transaxle & Differential','Transmission Mounts'],
['Major','Major condition overview','Major accident signs|Frame damage signs|Flood damage signs'],
['Exterior','Tyres · from report guidance','Left Front Tyre|Right Front Tyre|Left Rear Tyre|Right Rear Tyre'],
];
function mapPart(name:string,section:Section,group:string):string {
 const n=name.toLowerCase(); const side=n.includes('left')?'left':n.includes('right')?'right':null; const end=n.includes('rear')?'rear':'front';
 if(side&&(/door|power window/.test(n)))return `${side}-${end}-door`;
 if(side&&n.includes('fender'))return `${side}-${end}-fender`;
 if(side&&/tyre|shock absorber/.test(n))return `${side}-${end}-wheel`;
 if(side&&n.includes('mirror'))return `${side}-mirror`;
 if(n.includes('front bonnet'))return 'bonnet'; if(/rear bonnet|boot|spoiler/.test(n))return 'boot';
 if(n.includes('bumper')||n.includes('grille'))return n.includes('rear')?'rear-bumper':'front-bumper';
 if(n==='driver seat')return 'driver-seat';if(n==='front passenger seat')return 'passenger-seat';if(/rear seat|folding seat/.test(n))return 'rear-seat';
 if(n.includes('safety belt'))return 'belts'; if(n==='front windshield')return 'windshield';if(n.includes('tailgate glass'))return 'rear-glass';
 if(group==='Exterior Lights')return 'lights';
 if(/steering|brake|paddle|horn/.test(n))return 'steering';
 if(/gear knob|armrest/.test(n))return 'console';
 if(section==='Interior')return /trim|headlining|sunroof|sunshade|parcel/.test(n)?'cabin-trim':'dashboard';
 if(section==='Underbody'||section==='Road test')return /engine|motor|coolant|radiator|cooling|battery/.test(n)?'engine':'underbody';
 return 'roof';
}
export type Check = {id:string;name:string;section:Section;group:string;partId:string;source:'report-row'|'report-overview'|'report-guidance';kind:'cosmetic'|'functional'|'mechanical'|'structural';applicability?:string};
export const CHECKS:Check[] = GROUPS.flatMap(([section,group,names])=>names.split('|').map(name=>({id:slug(name),name,section,group,partId:mapPart(name,section,group),source:section==='Major'?'report-overview':group.startsWith('Tyres')?'report-guidance':'report-row',kind:section==='Major'||/Accident|Flood|Cut & Joint|Tampered|Construction/.test(name)?'structural':section==='Underbody'||section==='Road test'?'mechanical':group==='Body Panels & Bumpers'||group==='Carpet, Trim & Mats'||/Glass|Tyres/.test(group)?'cosmetic':'functional',applicability:/Motor Acceleration|Motor Mounts|Chassis Or Motor|Regenerative/.test(name)?'Electric-powertrain item: not applicable to this petrol vehicle. Confirm N/A manually.':/Clutch Operation/.test(name)?'Automatic vehicle: verify applicability before inspection.':/I-drive|Sunroof|Sunshade/.test(name)?'Equipment-dependent: confirm installed equipment.':undefined})));
export const checkById=(id:string)=>CHECKS.find(c=>c.id===id)!;
export const partById=(id:string)=>PARTS.find(p=>p.id===id)!;
