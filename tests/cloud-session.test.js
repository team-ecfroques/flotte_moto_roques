import test from 'node:test';
import assert from 'node:assert/strict';
import { observeCloudSession } from '../public/assets/js/cloud-session.js';

// Simulation des événements du SDK, sans compte ni accès à une vraie base.
function setup() {
  const listeners = new Map(), state = {connected:false, data:{}, faults:[], hidden:[], errors:[],renders:0,phase:null};
  const dbSDK = {
    ref: (_db,path) => path,
    onValue(path,receive,error) {
      const listener = {receive,error,stopped:false}; listeners.set(path,listener);
      return () => {listener.stopped = true;};
    }
  };
  const session = observeCloudSession({db:{},dbSDK},{
    onData: value => {state.data = value; state.renders++;},
    onFaults: (faults,hidden) => {state.faults = faults; state.hidden = hidden;},
    onConnection: value => {state.connected = value;},
    onState: phase => {state.phase = phase;},
    onError: error => state.errors.push(error)
  });
  const emit = (path,value) => listeners.get(path).receive({val:() => value});
  const load = () => {
    emit('motos',{'AA-123-BB':{plate:'AA-123-BB'}});
    emit('faultTypes',{one:'Frein'}); emit('hiddenFaultTypes',null);
  };
  return {state,session,listeners,emit,load};
}
test('sans compte : les flux sont écoutés immédiatement, écriture après chargement complet',() => {
  const r = setup(); assert.equal(r.session.canWrite(),false);
  assert.equal(r.listeners.size,4); r.emit('.info/connected',true);
  assert.equal(r.session.canWrite(),false);
  r.emit('motos',{}); r.emit('faultTypes',{});
  assert.equal(r.session.canWrite(),false);
  r.emit('hiddenFaultTypes',{});
  assert.equal(r.session.canWrite(),true);
});
test('perte et retour du réseau verrouillent puis rétablissent une session autorisée',() => {
  const r = setup(); r.load(); r.emit('.info/connected',true);
  assert.equal(r.session.canWrite(),true);
  r.emit('.info/connected',false); assert.equal(r.session.canWrite(),false);
  r.emit('.info/connected',true); assert.equal(r.session.canWrite(),true);
});
test('un refus d’accès efface les données et ne peut pas être annulé par un retour réseau',() => {
  const r = setup(); r.load(); r.emit('.info/connected',true);
  r.listeners.get('faultTypes').error(new Error('PERMISSION_DENIED'));
  assert.deepEqual(r.state.data,{}); assert.deepEqual(r.state.faults,[]);
  assert.equal(r.session.canWrite(),false);
  r.emit('.info/connected',true); r.load();
  assert.equal(r.session.canWrite(),false); assert.deepEqual(r.state.data,{});
  assert.equal(r.state.errors.length,1);
});
test('arrêt de la session : les abonnements sont retirés et les anciens événements ignorés',() => {
  const r = setup(); r.load(); r.emit('.info/connected',true);
  const previous = r.listeners.get('motos');
  r.session.stop(); assert.equal(previous.stopped,true);
  previous.receive({val:() => ({secret:'old'})});
  assert.equal(r.state.data.secret,undefined); assert.equal(r.session.canWrite(),false);
  assert.ok([...r.listeners.values()].every(listener => listener.stopped));
});
test('premier affichage : aucune flotte partielle avant les motos, les catalogues et le réseau',() => {
  for (const paths of [
    ['motos','faultTypes','hiddenFaultTypes','.info/connected'],
    ['.info/connected','hiddenFaultTypes','motos','faultTypes']
  ]) {
    const r = setup();
    const values = {motos:{'AA-123-BB':{plate:'AA-123-BB'}},faultTypes:{one:'Frein'},hiddenFaultTypes:{one:'Moteur'},'.info/connected':true};
    for(const path of paths.slice(0,-1)) r.emit(path,values[path]);
    assert.equal(r.state.renders,0); assert.equal(r.state.phase,'loading');
    const last = paths.at(-1); r.emit(last,values[last]);
    assert.equal(r.state.renders,1); assert.equal(r.state.phase,'connected');
    assert.equal(r.state.data['AA-123-BB'].plate,'AA-123-BB');
    assert.deepEqual(r.state.faults,['Frein']); assert.deepEqual(r.state.hidden,['Moteur']);
  }
});
test('base vide : le premier résultat vide est publié seulement après réception complète',() => {
  const r = setup(); r.emit('.info/connected',true); r.emit('motos',null);
  r.emit('faultTypes',null); assert.equal(r.state.renders,0);
  r.emit('hiddenFaultTypes',null);
  assert.equal(r.state.renders,1); assert.deepEqual(r.state.data,{});
  assert.equal(r.session.canWrite(),true);
});
