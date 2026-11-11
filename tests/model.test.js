import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMoto, validateFault, sortedFaults, faultIdentity, catalogKey, DEMO} from '../public/assets/js/model.js';
const valid = {plate:' ab-123-cd ', model:'Test',status:'available',mileage:'12500',service:'10000'};
test('normalisation et conversion des champs',() => assert.deepEqual(validateMoto(valid),{plate:'AB-123-CD',model:'Test',status:'available',mileage:12500,service:10000,fault:null}));
test('révision absente et kilométrage zéro acceptés',() => {assert.equal(validateMoto({...valid,service:''}).service,null); assert.equal(validateMoto({...valid,mileage:'0',service:'0'}).service,0);});
test('valeurs incohérentes et clés Firebase interdites rejetées',() => {
  for(const patch of [{plate:'a/b'},{status:'unknown'},{mileage:''},{mileage:null},{mileage:true},{mileage:[]},{mileage:-1},{mileage:1.5},{service:true},{service:13000},{service:-1},{model:'x'.repeat(61)}]) assert.throws(() => validateMoto({...valid,...patch}));
});
test('anciennes motos : une panne doit être précisée à la prochaine sauvegarde en réparation',() => {
  for(const moto of Object.values(DEMO)) {
    if (moto.status === 'repair') assert.throws(() => validateMoto(moto),/panne/);
    else assert.deepEqual(validateMoto(moto),{...moto,fault:null});
  }
});
test('panne obligatoire en réparation, normalisée et limitée à 120 caractères',() => {
  assert.throws(() => validateMoto({...valid,status:'repair'}),/panne/);
  assert.throws(() => validateFault('  '),/panne/);
  assert.throws(() => validateFault('x'.repeat(121)),/panne/);
  assert.equal(validateMoto({...valid,status:'repair',fault:'  Pneu   crevé  '}).fault,'Pneu crevé');
});
test('le retour disponible ou indisponible efface la panne active',() => {
  for(const status of ['available','unavailable']) assert.equal(validateMoto({...valid,status,fault:'Freinage'}).fault,null);
});
test('catalogue trié en français, dédoublonné et nettoyé des pannes supprimées',() => {
  const faults = sortedFaults(['Zéro pression','Échappement','amortisseur',' Échappement ','MOTEUR'],['frein']);
  assert.deepEqual(faults,[...faults].sort((a,b) => a.localeCompare(b,'fr',{sensitivity:'base',numeric:true})));
  assert.equal(faults.filter(value => faultIdentity(value) === 'échappement').length,1);
  assert.equal(faults.filter(value => faultIdentity(value) === 'moteur').length,1);
  assert.ok(!faults.some(value => faultIdentity(value) === 'frein'));
  assert.ok(faults.includes('amortisseur'));
  assert.ok(faults.every(value => value.trim() === value));
});
test('identifiants de panne stables et compatibles Firebase sans WebCrypto',() => {
  assert.equal(catalogKey(' Pneu  crevé '),catalogKey('pneu crevé'));
  assert.equal(catalogKey('Éclairage'),catalogKey('E\u0301clairage'));
  assert.notEqual(catalogKey('Frein'),catalogKey('Moteur'));
  assert.match(catalogKey('Batterie / démarrage'),/^[0-9a-f]+$/);
  assert.ok(catalogKey('界'.repeat(120)).length <= 768);
});
