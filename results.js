import { swimmerMarkup } from './swimmers.js';

export function createResults(container, { onDismiss } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'race-results';
  dialog.setAttribute('aria-labelledby', 'resultsTitle');
  dialog.innerHTML = `<button class="results-close" type="button" aria-label="Close scoreboard">×</button>
    <div class="eyebrow">RACE COMPLETE</div><h2 id="resultsTitle">Final scoreboard</h2>
    <p class="results-summary"></p>
    <div class="results-table-wrap"><table><thead><tr><th scope="col">Place</th><th scope="col">Swimmer</th><th scope="col">Result</th></tr></thead><tbody></tbody></table></div>`;
  document.body.appendChild(dialog);
  const reopen = document.createElement('button');
  reopen.type = 'button';
  reopen.className = 'results-open hidden';
  reopen.textContent = 'View scoreboard';
  container.appendChild(reopen);
  reopen.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('.results-close').addEventListener('click', () => dialog.close());
  let finished = false;
  dialog.addEventListener('close', () => {
    // State-driven closes must not trigger another reset on connected screens.
    if (finished) onDismiss?.();
  });

  return ({ race, players }, myId) => {
    if (race.state !== 'finished') {
      finished = false;
      if (dialog.open) dialog.close();
      reopen.classList.add('hidden');
      return;
    }
    const sorted = [...players].sort((a, b) =>
      Number(b.id === race.winnerId) - Number(a.id === race.winnerId) ||
      b.distance - a.distance || (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity) ||
      a.name.localeCompare(b.name));
    const winner = sorted.find(player => player.id === race.winnerId);
    dialog.querySelector('.results-summary').textContent = winner
      ? `${winner.name} wins! The race ended when the winner reached the finish.`
      : 'Final positions when the race ended.';
    const body = dialog.querySelector('tbody');
    body.replaceChildren();
    let rank = 0;
    sorted.forEach((player, index) => {
      const previous = sorted[index - 1];
      if (!previous || player.distance !== previous.distance || player.finishedAt !== previous.finishedAt || previous.id === race.winnerId) rank = index + 1;
      const row = document.createElement('tr');
      if (player.id === myId) row.classList.add('results-you');
      const place = document.createElement('td');
      place.textContent = player.id === race.winnerId ? '🏆 1' : String(rank);
      const name = document.createElement('td');
      const identity = document.createElement('div');
      identity.className = 'results-identity';
      const sprite = document.createElement('span');
      sprite.setAttribute('aria-hidden', 'true');
      sprite.innerHTML = swimmerMarkup(player.swimmer);
      const label = document.createElement('span');
      label.textContent = player.name + (player.id === myId ? ' (you)' : '');
      identity.append(sprite, label);
      name.appendChild(identity);
      const result = document.createElement('td');
      result.textContent = player.finishedAt != null && race.startedAt != null
        ? `${((player.finishedAt - race.startedAt) / 1000).toFixed(2)}s`
        : `${Math.min(100, Math.max(0, player.distance)).toFixed(1)}%`;
      row.append(place, name, result);
      body.appendChild(row);
    });
    reopen.classList.remove('hidden');
    if (!finished) dialog.showModal();
    finished = true;
  };
}
