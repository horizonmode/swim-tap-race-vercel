export function rankPlayers(race, players) {
  const sorted = [...players].sort((a, b) => Number(b.id === race.winnerId) - Number(a.id === race.winnerId) ||
    b.distance - a.distance || (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity) || a.name.localeCompare(b.name));
  let rank = 0;
  return sorted.map((player, index) => {
    const previous = sorted[index - 1];
    if (!previous || player.distance !== previous.distance || player.finishedAt !== previous.finishedAt || previous.id === race.winnerId) rank = index + 1;
    return { ...player, rank: player.id === race.winnerId ? 1 : rank,
      result: player.finishedAt != null && race.startedAt != null
        ? `${((player.finishedAt - race.startedAt) / 1000).toFixed(2)}s`
        : `${Math.min(100, Math.max(0, player.distance)).toFixed(1)}%` };
  });
}

export function resultsLifecycle(dialog, onDismiss) {
  let finished = false;
  let dismissEnabled = false;
  return {
    update(state) {
      if (state !== 'finished') {
        finished = false;
        dismissEnabled = false;
        if (dialog.open) dialog.close();
      } else if (!finished) {
        dialog.showModal();
        finished = true;
        dismissEnabled = true;
      }
    },
    reopen() { dismissEnabled = true; dialog.showModal(); },
    dismiss() {
      if (dismissEnabled) { dismissEnabled = false; onDismiss?.(); }
    }
  };
}
