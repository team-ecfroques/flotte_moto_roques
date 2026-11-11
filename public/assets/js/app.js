import { firebaseConfig } from './firebase-config.js';
import { COMMON_FAULTS, STATUSES, validateMoto, sortedFaults, faultIdentity } from './model.js';
import { localStore, cloudStore } from './store.js';
import { faultPicker } from './fault-picker.js';
const $ = selector => document.querySelector(selector);
const form = $('#moto-form');
let records = {}, faultTypes = [], store, editing = null, deleting = null, repairing = null, busy = false, ready = false;
let hiddenFaults = [];
const formFault = faultPicker($('#form-fault'));
const dialogFault = faultPicker($('#dialog-fault'));
const cloud = Boolean(firebaseConfig.apiKey);
function message(text, error = false) { $('#notice').textContent = text; $('#notice').classList.toggle('error', error); }
function failure(error) {
  const code = error.code || '';
  if (/permission|PERMISSION/.test(code + error.message)) return 'Accès refusé par Firebase. Publiez les règles du fichier firebase/database.rules.json, puis rechargez la page.';
  return error.message || 'Une erreur est survenue. Réessayez.';
}
function resetForm() {
  editing = null; form.reset(); form.elements.plate.readOnly = false;
  formFault.set(''); formFault.enable(false);
  $('#save').textContent = 'Ajouter la moto'; $('#cancel').hidden = true;
}
function lock() {
  $('#fields').disabled = busy || !ready;
  $('#repair-fields').disabled = busy || !ready;
  $('#list').querySelectorAll('button').forEach(button => button.disabled = busy || !ready);
  $('#repair-form').querySelectorAll('button').forEach(button => button.disabled = busy || !ready);
  $('#fault-list').querySelectorAll('button').forEach(button => button.disabled = busy || !ready);
  $('#repair-dialog').setAttribute('aria-busy',String(busy));
}
async function operation(action) {
  if (busy || !ready) return false;
  const origin = {...document.activeElement?.dataset};
  busy = true; lock(); message(cloud ? 'Enregistrement en cours…' : '');
  try { await action(); message(''); return true; } catch (error) {
    if ($('#repair-dialog').open) {$('#repair-error').textContent = failure(error); $('#repair-error').hidden = false; message('');}
    else message(failure(error), true);
    return false;
  }
  finally {
    busy = false; lock();
    if (origin.id) [...$('#list').querySelectorAll('button')].find(button => button.dataset.id === origin.id && button.dataset.status === origin.status && button.dataset.action === origin.action)?.focus({preventScroll:true});
  }
}
function node(tag, className, text) {const element = document.createElement(tag); if(className) element.className = className; if(text !== undefined) element.textContent = text; return element;}
function refreshFaults(values = faultTypes, hidden = hiddenFaults) {
  faultTypes = values; hiddenFaults = hidden;
  const all = sortedFaults(faultTypes,hiddenFaults);
  formFault.options(all); dialogFault.options(all);
  const list = $('#fault-list'); list.replaceChildren();
  $('#fault-count').textContent = `(${all.length})`;
  if (!all.length) list.append(node('p','hint','Aucune panne dans la liste. Vous pouvez en ajouter depuis le choix de réparation.'));
  for (const fault of all) {
    const row = node('div','fault-row'), description = node('div');
    description.append(node('span','',fault));
    const used = Object.values(records).filter(moto => moto.status === 'repair' && faultIdentity(moto.fault || '') === faultIdentity(fault)).length;
    if (used) description.append(node('small','',`Associée à ${used} moto${used > 1 ? 's' : ''}`));
    const button = node('button','', 'Supprimer'); button.type = 'button';
    button.setAttribute('aria-label',`Supprimer de la liste : ${fault}`);
    button.addEventListener('click',async () => {
      const saved = await operation(() => store.removeFault(fault));
      if (saved) $('#fault-manager summary').focus();
    });
    row.append(description,button); list.append(row);
  }
  lock();
}
async function rememberFault(fault, explicitlyNew = false) {
  const hidden = hiddenFaults.some(value => faultIdentity(value) === faultIdentity(fault));
  if (fault && (explicitlyNew || (!hidden && !COMMON_FAULTS.some(value => faultIdentity(value) === faultIdentity(fault))))) await store.rememberFault(fault);
}
function openRepair(id) {
  repairing = id; const moto = records[id];
  $('#repair-moto').textContent = [moto.model,moto.plate].filter(Boolean).join(' ');
  $('#repair-error').hidden = true; dialogFault.enable(true); dialogFault.set(moto.fault);
  $('#repair-dialog').showModal(); dialogFault.focus();
}
function render(data) {
  records = data;
  $('#list').setAttribute('aria-busy','false');
  refreshFaults();
  if (repairing && !records[repairing] && !busy) $('#repair-dialog').close();
  if (editing && !records[editing]) resetForm();
  const entries = Object.entries(records);
  $('#count').textContent = `${entries.filter(([,m]) => m.status === 'available').length} / ${entries.length} motos dispo`;
  const list = $('#list');
  const focused = document.activeElement?.dataset;
  const focusId = focused?.id, focusStatus = focused?.status, focusAction = focused?.action;
  list.replaceChildren();
  if (!entries.length) list.append(node('p','empty','Aucune moto pour le moment. Ajoutez la première avec le formulaire.'));
  for (const [id, moto] of entries) {
    const card = node('article','moto'), top = node('div','moto-top');
    const title = node('h3',moto.model ? '' : 'plate-only',moto.model ? `${moto.model} ` : '');
    title.append(node('span','moto-plate',moto.plate));
    const control = node('div','status-control'), lights = node('div','lights');
    lights.setAttribute('role','group'); lights.setAttribute('aria-label',`Statut de ${moto.plate}`);
    for (const [status,label] of Object.entries(STATUSES)) {
      const button = node('button','light'); button.type = 'button'; button.dataset.status = status; button.dataset.id = id;
      button.setAttribute('aria-label',`${label} — ${moto.plate}`); button.setAttribute('aria-pressed',String(moto.status === status)); button.title = label;
      button.addEventListener('click', () => {
        if (status === 'repair') openRepair(id);
        else operation(() => store.save(id,{status,fault:null}));
      }); lights.append(button);
    }
    control.append(node('span','status-label',STATUSES[moto.status] || 'Statut inconnu'),lights);
    top.append(title,control);
    const details = node('div','details');
    for (const [label,value] of [['Kilométrage',moto.mileage],['Dernière révision',moto.service]]) {
      const item = node('span','detail-item');
      item.append(node('span','detail-label',label),node('strong','',value == null ? '—' : `${Number(value).toLocaleString('fr-FR')} km`)); details.append(item);
    }
    const actions = node('div','actions');
    for (const [action,label] of [['edit','Modifier'],['delete','Supprimer']]) {
      const button = node('button','',label); button.dataset.id = id; button.dataset.action = action;
      button.setAttribute('aria-label',`${label} ${moto.plate}`);
      button.addEventListener('click', () => {
        if(action === 'edit') {
          editing = id;
          for(const key of ['plate','model','status','mileage','service']) form.elements[key].value = records[id][key] ?? '';
          formFault.set(records[id].fault); formFault.enable(records[id].status === 'repair');
          form.elements.plate.readOnly = true; $('#save').textContent = 'Enregistrer les modifications'; $('#cancel').hidden = false;
          form.scrollIntoView({behavior:'smooth',block:'start'}); form.elements.model.focus({preventScroll:true});
        } else {
          deleting = id; $('#delete-description').textContent = [moto.model,moto.plate].filter(Boolean).join(' '); $('#delete-dialog').showModal(); $('#delete-cancel').focus();
        }
      }); actions.append(button);
    }
    card.append(top);
    if (moto.status === 'repair') {
      const fault = node('div','repair-summary');
      const description = node('div'); description.append(node('span','repair-caption','Panne à réparer'),node('strong','',moto.fault || 'Panne à préciser'));
      const button = node('button','',moto.fault ? 'Modifier la panne' : 'Préciser la panne');
      button.dataset.id = id; button.dataset.action = 'fault'; button.setAttribute('aria-label',`${button.textContent} — ${moto.plate}`);
      button.addEventListener('click',() => openRepair(id)); fault.append(description,button); card.append(fault);
    }
    card.append(details,actions); list.append(card);
  }
  lock();
  if (focusId) [...list.querySelectorAll('button')].find(b => b.dataset.id === focusId && b.dataset.status === focusStatus && b.dataset.action === focusAction)?.focus({preventScroll:true});
}
form.addEventListener('submit', event => {
  event.preventDefault();
  let data;
  try {
    const raw = Object.fromEntries(new FormData(form));
    data = validateMoto({...raw,fault:raw.status === 'repair' ? formFault.get() : null});
  } catch(error) {message(error.message,true); return;}
  const id = editing || data.plate, create = !editing;
  const explicitlyNew = formFault.isNew();
  operation(async () => {await rememberFault(data.fault,explicitlyNew); await store.save(id,data,create); resetForm();});
});
form.elements.status.addEventListener('change',() => formFault.enable(form.elements.status.value === 'repair'));
$('#repair-cancel').addEventListener('click',() => $('#repair-dialog').close());
$('#repair-dialog').addEventListener('cancel',event => {if (busy) event.preventDefault();});
$('#repair-dialog').addEventListener('close',() => {repairing = null;});
$('#repair-form').addEventListener('submit',async event => {
  event.preventDefault(); if (busy || !ready) return;
  let fault;
  try {fault = dialogFault.get();} catch(error) {$('#repair-error').textContent = error.message; $('#repair-error').hidden = false; return;}
  const id = repairing;
  const explicitlyNew = dialogFault.isNew();
  const saved = await operation(async () => {await rememberFault(fault,explicitlyNew); await store.save(id,{status:'repair',fault});});
  if (saved) {
    $('#repair-dialog').close();
    [...$('#list').querySelectorAll('button')].find(button => button.dataset.id === id && button.dataset.status === 'repair')?.focus({preventScroll:true});
  }
});
$('#cancel').addEventListener('click',resetForm);
$('#delete-cancel').addEventListener('click',() => $('#delete-dialog').close());
$('#delete-confirm').addEventListener('click',() => {
  const id = deleting; $('#delete-dialog').close();
  if (id) operation(() => store.remove(id));
});
async function init() {
  try {
    if (!cloud) {
      ready = true; store = localStore(render,refreshFaults); $('#fleet').hidden = false;
      $('.connection').hidden = true;
    } else {
      $('.connection').hidden = false;
      $('#fleet').hidden = false; lock();
      $('#connection').textContent = 'Connexion à Firebase…';
      store = await cloudStore(firebaseConfig, {
        onData: render,
        onFaults: refreshFaults,
        onConnection(connected) {ready = connected; lock();},
        onState(state) {
          $('#connection').textContent = {loading:'Chargement de la flotte…',connected:'Firebase · connecté en temps réel',offline:'Hors connexion · modifications suspendues',error:'Connexion Firebase indisponible'}[state];
        },
        onError(error) {ready = false; lock(); $('#count').textContent = 'Flotte indisponible'; $('#list').replaceChildren(); $('#reload').hidden = false; message(failure(error),true);}
      });
    }
  } catch(error) {ready = false; lock(); $('#connection').textContent = 'Initialisation impossible'; $('#count').textContent = 'Flotte indisponible'; $('#list').replaceChildren(); $('#list').setAttribute('aria-busy','false'); $('#reload').hidden = false; message(failure(error),true);}
}
init();
