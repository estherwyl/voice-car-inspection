import { VEHICLE, SOURCE_URL } from './checklist';
export const VEHICLES = [
 {id:'bmw-330i-2021',name:'BMW 330i',variant:'M Sport 2.0 AT',year:2021,fuel:'Petrol',transmission:'Automatic',drive:'RWD',color:'Black',sourceId:'J4W6XW8V4O',sourceUrl:'https://carro.co/my/en/buy/bmw/best/2021-bmw-330i-m-sport-2-0-at/J4W6XW8V4O#inspection',model:'/models/bmw-330i-inspection.glb',image:'/models/bmw-330i-studio.png'},
 {...VEHICLE,sourceUrl:SOURCE_URL,model:'/models/subaru-xv-inspection.glb',image:'/models/subaru-xv-studio.png'}
];
export function vehicleById(id:string){const vehicle=VEHICLES.find(v=>v.id===id);if(!vehicle)throw new Error('Unknown vehicle: '+id);return vehicle;}
