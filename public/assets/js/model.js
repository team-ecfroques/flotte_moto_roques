export const STATUSES = {available: 'Dispo', repair: 'Réparation à prévoir', unavailable: 'Pas dispo'};
export const COMMON_FAULTS = ['Batterie / démarrage', 'Joint-spie', 'Pneu ', 'Frein', 'Embrayage', 'Moteur'];
export const faultIdentity = value => String(value).trim().replace(/\s+/g, ' ').normalize('NFC').toLocaleLowerCase('fr');
export function sortedFaults(custom = [], hidden = []) {
  const excluded = new Set(hidden.map(faultIdentity));
  const values = new Map();
  for (const value of [...COMMON_FAULTS,...custom]) {
    const fault = String(value || '').trim().replace(/\s+/g, ' ');
    if (fault && !excluded.has(faultIdentity(fault))) values.set(faultIdentity(fault),fault);
  }
  return [...values.values()].sort((a,b) => a.localeCompare(b,'fr',{sensitivity:'base',numeric:true}));
}
export function validateFault(value) {
  const fault = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!fault || fault.length > 120) throw new Error('Choisissez une panne ou indiquez-en une nouvelle (120 caractères maximum).');
  return fault;
}
// Identifiant de catalogue déterministe, compatible aussi avec HTTP sur le Wi-Fi.
// Ce nom n'est pas un secret ; l'API WebCrypto n'est pas nécessaire.
export function catalogKey(value) {
  const bytes = new TextEncoder().encode(faultIdentity(validateFault(value)));
  return Array.from(bytes,byte => byte.toString(16).padStart(2,'0')).join('');
}
export function validateMoto(raw) {
  const plate = String(raw.plate ?? '').trim().toUpperCase().replace(/\s+/g, '-');
  if (!/^[A-Z0-9-]{2,20}$/.test(plate)) throw new Error('Immatriculation : 2 à 20 lettres, chiffres ou tirets.');
  const model = String(raw.model ?? '').trim();
  if (model.length > 60) throw new Error('Le modèle est limité à 60 caractères.');
  if (!Object.hasOwn(STATUSES, raw.status)) throw new Error('Statut invalide.');
  const mileage = Number(raw.mileage);
  const service = raw.service === '' || raw.service == null ? null : Number(raw.service);
  if (!['string','number'].includes(typeof raw.mileage) || String(raw.mileage).trim() === '' || !Number.isInteger(mileage) || mileage < 0 || mileage > 9999999) throw new Error('Saisissez un kilométrage entier positif ou nul.');
  if (raw.service != null && !['string','number'].includes(typeof raw.service)) throw new Error('Le kilométrage de révision doit être un nombre.');
  if (service !== null && (!Number.isInteger(service) || service < 0 || service > mileage)) throw new Error('La dernière révision doit être comprise entre 0 et le kilométrage actuel.');
  return {plate, model, status: raw.status, mileage, service, fault: raw.status === 'repair' ? validateFault(raw.fault) : null};
}
export const DEMO = {
  'GW-727-DT': {plate:'GW-727-DT',model:'8S',status:'available',mileage:17523,service:null},
  'GV-772-DE': {plate:'GV-772-DE',model:'GSX-S 125',status:'repair',mileage:9512,service:null},
  'HF-061-AV': {plate:'HF-061-AV',model:'HORNET',status:'unavailable',mileage:17202,service:null}
};
