import { DEMO, validateFault, validateMoto, faultIdentity, catalogKey } from './model.js';
import { observeCloudSession } from './cloud-session.js';
const KEY = 'ecf-moto-demo-v1';
const FAULT_KEY = 'ecf-moto-faults-v1';
const HIDDEN_KEY = 'ecf-moto-hidden-faults-v1';
export function localStore(onData, onFaults = () => {}) {
  const readFaults = () => JSON.parse(localStorage.getItem(FAULT_KEY) || '[]');
  const readHidden = () => JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
  const notifyFaults = () => onFaults(readFaults(),readHidden());
  function read() {
    const value = localStorage.getItem(KEY);
    return value === null ? structuredClone(DEMO) : JSON.parse(value);
  }
  const initial = read();
  if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, JSON.stringify(initial));
  onData(initial);
  notifyFaults();
  window.addEventListener('storage', event => {
    if (event.key === KEY) onData(read());
    if (event.key === FAULT_KEY || event.key === HIDDEN_KEY) notifyFaults();
  });
  return {
    async rememberFault(value) {
      const fault = validateFault(value), faults = readFaults();
      if (!faults.some(item => faultIdentity(item) === faultIdentity(fault))) faults.push(fault);
      localStorage.setItem(FAULT_KEY,JSON.stringify(faults));
      localStorage.setItem(HIDDEN_KEY,JSON.stringify(readHidden().filter(item => faultIdentity(item) !== faultIdentity(fault))));
      notifyFaults();
    },
    async removeFault(value) {
      const fault = validateFault(value), hidden = readHidden();
      if (!hidden.some(item => faultIdentity(item) === faultIdentity(fault))) hidden.push(fault);
      localStorage.setItem(FAULT_KEY,JSON.stringify(readFaults().filter(item => faultIdentity(item) !== faultIdentity(fault))));
      localStorage.setItem(HIDDEN_KEY,JSON.stringify(hidden)); notifyFaults();
    },
    async save(id, data, create = false) {
      const records = read();
      if (create && records[id]) throw new Error('Cette immatriculation existe déjà.');
      if (!create && !records[id]) throw new Error('Cette moto a été supprimée.');
      const validated = validateMoto({...records[id], ...data});
      if (validated.plate !== id) throw new Error('L’immatriculation ne peut pas être modifiée.');
      records[id] = validated;
      localStorage.setItem(KEY, JSON.stringify(records));
      onData(records);
    },
    async remove(id) {
      const records = read(); delete records[id];
      localStorage.setItem(KEY, JSON.stringify(records)); onData(records);
    }
  };
}
export async function cloudStore(config, {onData, onFaults = () => {}, onConnection, onState, onError}) {
  const base = 'https://www.gstatic.com/firebasejs/12.5.0/';
  const [{initializeApp}, dbSDK] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-database.js')
  ]);
  const app = initializeApp(config), db = dbSDK.getDatabase(app);
  const session = observeCloudSession({db,dbSDK},{onData,onFaults,onConnection,onState,onError});
  function requireReady() {
    if (!session.canWrite()) throw new Error('La flotte n’est pas accessible. Vérifiez votre connexion et vos autorisations.');
  }
  return {
    async rememberFault(value) {
      requireReady();
      const fault = validateFault(value);
      const key = catalogKey(fault);
      await dbSDK.update(dbSDK.ref(db),{['faultTypes/' + key]:fault,['hiddenFaultTypes/' + key]:null});
    },
    async removeFault(value) {
      requireReady();
      const fault = validateFault(value), key = catalogKey(fault);
      await dbSDK.update(dbSDK.ref(db),{['faultTypes/' + key]:null,['hiddenFaultTypes/' + key]:fault});
    },
    async save(id, data, create = false) {
      requireReady();
      const result = await dbSDK.runTransaction(dbSDK.ref(db, 'motos/' + id), current => {
        if (create ? current !== null : current === null) return undefined;
        const validated = validateMoto({...current,...data});
        if (validated.plate !== id) throw new Error('L’immatriculation ne peut pas être modifiée.');
        return validated;
      }, {applyLocally:false});
      if (!result.committed) throw new Error(create ? 'Cette immatriculation existe déjà.' : 'Cette moto a été supprimée.');
    },
    remove(id) {requireReady(); return dbSDK.remove(dbSDK.ref(db, 'motos/' + id));}
  };
}
