<script>
  import { onMount } from "svelte";
  let ws;
  let key = "";
  let authorized = false;
  let status = "";
  let lobbies = [];
  let lastUpdated = null;
  let refreshTimer;
  let filter = "all";
  $: activeCount = lobbies.filter(lobby => ["countdown", "racing"].includes(lobby.status)).length;
  $: playerCount = lobbies.reduce((total, lobby) => total + lobby.players, 0);
  $: filteredLobbies = lobbies.filter(lobby => filter === "all" ||
    (filter === "live" ? ["countdown", "racing"].includes(lobby.status) : lobby.status === filter));

  function connect() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocol}//${location.host}/api/ws`);
    ws.addEventListener("message", event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "adminAuth") {
        authorized = message.ok;
        status = message.message;
        if (authorized) refreshTimer = setInterval(refresh, 5000);
      } else if (message.type === "lobbyList") { lobbies = message.lobbies; lastUpdated = new Date(); }
      else if (message.type === "serverError") status = message.message;
    });
    ws.addEventListener("close", () => { clearInterval(refreshTimer); status = "Disconnected. Refresh to reconnect."; });
  }

  function authenticate() {
    if (ws?.readyState !== WebSocket.OPEN) { status = "Still connecting…"; return; }
    ws.send(JSON.stringify({ type: "admin:auth", key }));
    key = "";
  }

  function refresh() {
    if (authorized && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "admin:list" }));
  }

  onMount(() => {
    document.body.className = "race-page";
    connect();
    return () => { clearInterval(refreshTimer); ws?.close(); };
  });
</script>

<main class="admin-shell">
  <header>
    <div><div class="eyebrow">SWIM TAP RACE · ADMIN</div><h1>Lobby control</h1><p>Monitor every session from one place.</p></div>
    <a class="create-link" href="/race"><span aria-hidden="true">＋</span> Create lobby</a>
  </header>
  {#if !authorized}
    <section class="card login-card">
      <form on:submit|preventDefault={authenticate}>
        <label for="masterCode">Master code</label>
        <input id="masterCode" type="password" autocomplete="current-password" bind:value={key} required />
        <button class="primary" type="submit">Open admin</button>
        <p role="status">{status}</p>
      </form>
    </section>
  {:else}
    <section class="metrics" aria-label="Lobby summary">
      <article><span>Total lobbies</span><strong>{lobbies.length}</strong></article>
      <article><span>Live now</span><strong>{activeCount}</strong></article>
      <article><span>Swimmers</span><strong>{playerCount}</strong></article>
    </section>
    <section class="lobby-panel">
      <div class="toolbar"><div><h2>Lobby history</h2><p>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading…'}</p></div><button type="button" on:click={refresh}>↻ Refresh</button></div>
      <div class="filters" aria-label="Filter lobby history">
        {#each [["all", "All"], ["lobby", "Waiting"], ["live", "Live"], ["finished", "Finished"]] as option}
          <button type="button" class:active={filter === option[0]} on:click={() => filter = option[0]}>{option[1]}</button>
        {/each}
      </div>
      {#if lobbies.length}
        <div class="table-wrap"><table><thead><tr><th>Lobby</th><th>Status</th><th>Swimmers</th><th>Created</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
          {#each filteredLobbies as lobby}
            <tr><td data-label="Lobby"><strong>{lobby.name}</strong><small>{lobby.id}</small></td><td data-label="Status"><span class="status status-{lobby.status}"><i></i>{lobby.status}</span></td><td data-label="Swimmers"><strong>{lobby.players}</strong></td><td data-label="Created">{new Date(lobby.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td><td><a class="open-link" href={`/race?room=${encodeURIComponent(lobby.id)}`}>Open lobby <span aria-hidden="true">→</span></a></td></tr>
          {/each}
          {#if !filteredLobbies.length}<tr><td colspan="5" class="empty">No lobbies match this filter.</td></tr>{/if}
        </tbody></table></div>
      {:else}<p class="empty">No lobby history yet.</p>{/if}
    </section>
  {/if}
</main>

<style>
  .admin-shell { width: min(1160px, calc(100% - 40px)); margin: 0 auto; padding: 44px 0 72px; }
  header { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 32px; }
  h1 { margin: 6px 0 4px; font-size: clamp(40px, 6vw, 68px); letter-spacing: -.04em; }
  header p { margin: 0; color: var(--muted); font-size: 18px; }
  .create-link { display: inline-flex; align-items: center; gap: 8px; min-height: 46px; padding: 12px 18px; border-radius: 14px; background: var(--accent); color: #032033; font-weight: 900; text-decoration: none; white-space: nowrap; }
  .login-card { max-width: 480px; margin-top: 44px; }
  form { display: grid; gap: 12px; }
  form p { min-height: 1.5em; margin: 0; color: var(--muted); }
  .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
  .metrics article { position: relative; overflow: hidden; padding: 22px 24px; border: 1px solid #ffffff17; border-radius: 20px; background: linear-gradient(145deg, #103853, #0b2940); box-shadow: 0 12px 34px #00101d40; }
  .metrics article::after { content: ''; position: absolute; width: 90px; height: 90px; right: -30px; bottom: -50px; border-radius: 50%; background: #5dd7ff18; }
  .metrics span { display: block; color: var(--muted); font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .metrics strong { display: block; margin-top: 6px; font-size: 38px; }
  .lobby-panel { overflow: hidden; border: 1px solid #ffffff17; border-radius: 24px; background: #0b2940d9; box-shadow: 0 18px 60px #00000030; }
  .toolbar { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #ffffff17; }
  .toolbar h2 { margin: 0; font-size: 24px; }
  .toolbar p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
  .toolbar button { min-height: 38px; padding: 8px 12px; background: #ffffff12; color: var(--text); font-size: 14px; }
  .filters { display: flex; gap: 8px; padding: 14px 24px; border-bottom: 1px solid #ffffff12; overflow-x: auto; }
  .filters button { min-height: 34px; padding: 6px 13px; border: 1px solid #ffffff12; border-radius: 999px; background: transparent; color: var(--muted); font-size: 13px; }
  .filters button.active { border-color: #5dd7ff66; background: #5dd7ff18; color: var(--accent-2); }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; text-align: left; }
  th, td { padding: 16px 24px; border-bottom: 1px solid #ffffff12; }
  th { color: var(--muted); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
  tbody tr { transition: background .15s ease; } tbody tr:hover { background: #ffffff08; } tbody tr:last-child td { border-bottom: 0; }
  td small { display: block; margin-top: 5px; color: #789bb1; font-family: ui-monospace, monospace; font-size: 11px; }
  .status { display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px; border: 1px solid #ffffff12; border-radius: 999px; background: #ffffff0d; font-size: 13px; font-weight: 800; text-transform: capitalize; }
  .status i { width: 7px; height: 7px; border-radius: 50%; background: #82a4b8; }
  .status-racing i { background: #5de0a8; box-shadow: 0 0 0 4px #5de0a820; } .status-countdown i { background: #ffd166; } .status-finished i { background: #d894e8; }
  .open-link { font-weight: 800; white-space: nowrap; text-decoration: none; }
  .empty { margin: 0; padding: 56px 24px; color: var(--muted); text-align: center; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
  @media (max-width: 720px) {
    .admin-shell { width: min(100% - 24px, 1160px); padding-top: 24px; }
    header { align-items: start; flex-direction: column; } .create-link { width: 100%; justify-content: center; }
    .metrics { grid-template-columns: 1fr 1fr; } .metrics article:first-child { grid-column: 1 / -1; }
    .table-wrap { padding: 12px; } thead { display: none; } table, tbody, tr, td { display: block; width: 100%; }
    tr { margin-bottom: 12px; padding: 16px; border: 1px solid #ffffff17; border-radius: 16px; background: #0e3049; }
    td { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 8px 0; border: 0; text-align: right; }
    td::before { content: attr(data-label); color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; }
    td:first-child { display: block; text-align: left; } td:first-child::before, td:last-child::before { display: none; }
    td:last-child { padding-top: 14px; } .open-link { width: 100%; padding: 10px; border-radius: 10px; background: #ffffff0d; text-align: center; }
  }
</style>
