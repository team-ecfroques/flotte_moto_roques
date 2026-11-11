// Mode partagé public, sans compte ni authentification anonyme.
// Les écritures attendent la connexion et le chargement des trois flux.
export function observeCloudSession({db, dbSDK}, {onData, onFaults, onConnection, onState = () => {}, onError}) {
  let active = false, connected = false, failed = false, stopped = false;
  let motos = {}, faults = [], hidden = [], hasConnected = false;
  let pendingData = false, pendingFaults = false;
  const loaded = new Set(), stops = [];
  const live = () => !stopped && !failed;
  const notify = () => {
    active = live() && connected && loaded.size === 3;
    // Le premier rendu attend les motos ET les deux catalogues, dans tout ordre.
    if (active) {
      if (pendingFaults) {onFaults(faults,hidden); pendingFaults = false;}
      if (pendingData) {onData(motos); pendingData = false;}
    }
    onConnection(active);
    onState(active ? 'connected' : !connected && hasConnected ? 'offline' : 'loading');
  };
  const fail = error => {
    if (!live()) return;
    failed = true; active = false;
    onConnection(false); onData({}); onFaults([],[]); onState('error'); onError(error);
  };
  function listen(path, receive) {
    stops.push(dbSDK.onValue(dbSDK.ref(db,path), snapshot => {
      if (!live()) return;
      receive(snapshot); notify();
    },fail));
  }
  onConnection(false);
  onState('loading');
  listen('motos', snapshot => {motos = snapshot.val() || {}; pendingData = true; loaded.add('motos');});
  listen('faultTypes', snapshot => {faults = Object.values(snapshot.val() || {}); pendingFaults = true; loaded.add('faultTypes');});
  listen('hiddenFaultTypes', snapshot => {hidden = Object.values(snapshot.val() || {}); pendingFaults = true; loaded.add('hiddenFaultTypes');});
  listen('.info/connected', snapshot => {connected = snapshot.val() === true; hasConnected ||= connected;});
  return {
    canWrite: () => active,
    stop() {stopped = true; active = false; stops.forEach(stop => stop()); onConnection(false);}
  };
}
