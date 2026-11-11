import { sortedFaults, validateFault } from './model.js';

// Même sélecteur dans le formulaire principal et dans la fenêtre de réparation.
export function faultPicker(root) {
  const label = document.createElement('label'); label.textContent = 'Panne à réparer';
  const select = document.createElement('select'); label.append(select);
  const customLabel = document.createElement('label'); customLabel.textContent = 'Nouvelle panne';
  const custom = document.createElement('input'); custom.maxLength = 120;
  custom.placeholder = 'Ex. Béquille latérale endommagée'; customLabel.append(custom);
  const hint = document.createElement('p'); hint.className = 'hint';
  hint.textContent = 'Une nouvelle panne sera ajoutée à la liste pour les prochaines fois.';
  customLabel.append(hint); root.append(label, customLabel);
  let enabled = false;
  function update() {
    select.disabled = !enabled; select.required = enabled;
    const other = select.value === '__other__';
    customLabel.hidden = !other; custom.disabled = !enabled || !other; custom.required = enabled && other;
  }
  select.addEventListener('change', () => {update(); if (enabled && select.value === '__other__') custom.focus();});
  function options(values = sortedFaults()) {
    const previous = select.value;
    select.replaceChildren(new Option('Choisir une panne…', ''));
    for (const value of values) select.add(new Option(value,value));
    if (previous && previous !== '__other__' && !values.includes(previous)) select.add(new Option(`${previous} (sélection actuelle)`,previous));
    select.add(new Option('+ Ajouter une autre panne', '__other__'));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
    update();
  }
  options();
  return {
    options,
    enable(value) {enabled = value; root.hidden = !value; update();},
    set(value) {
      if (value && ![...select.options].some(option => option.value === value)) select.add(new Option(value,value),select.options.length - 1);
      select.value = value || ''; custom.value = ''; update();
    },
    get() {return validateFault(select.value === '__other__' ? custom.value : select.value);},
    isNew() {return select.value === '__other__';},
    focus() {select.focus();}
  };
}
