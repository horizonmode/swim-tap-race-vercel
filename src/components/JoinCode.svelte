<script>
  import { onMount } from 'svelte';
  import qrcode from 'qrcode-generator';
  export let room = '';
  let urls = [];
  let url = '';
  let hint = 'Open the camera on your phone.';
  let svg = '';
  $: if (url) {
    try {
      const code = qrcode(0, 'M');
      code.addData(url); code.make();
      svg = code.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
    } catch { svg = ''; hint = 'Open the link below on your phone to join.'; }
  }
  onMount(() => {
    const controller = new AbortController();
    async function load() {
      if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
        hint = 'Connect your phone to the same Wi-Fi as this computer.';
        try {
          const response = await fetch('/api/join-info', { signal: controller.signal });
          if (!response.ok) throw new Error('Unavailable');
          const info = await response.json();
          if (!info.urls?.length) throw new Error('No network');
          urls = info.urls;
        } catch {
          if (!controller.signal.aborted) hint = 'Connect this computer to Wi-Fi, then refresh to get a phone-accessible QR code.';
          return;
        }
      } else urls = [new URL('/', location.href).href];
      if (room) urls = urls.map(value => {
        const target = new URL(value);
        target.searchParams.set('room', room);
        return target.href;
      });
      url = urls[0];
      if (urls.length > 1) hint = 'Use the same Wi-Fi. If scanning fails, try another network address below.';
    }
    load();
    return () => controller.abort();
  });
</script>
<aside class="join-panel" aria-label="Join the race">
  <div class="join-qr" role="img" aria-label="QR code to join the race">{@html svg}</div>
  <div>
    <strong>Scan to join</strong>
    {#if room}<p class="lobby-code">Lobby code: <span>{room}</span></p>{/if}
    <p>{hint}</p>
    <a href={url || '/'} aria-label="Player join link">{url}</a>
    {#if urls.length > 1}
      <label>Network address<select bind:value={url} aria-label="Network address">{#each urls as address}<option value={address}>{address}</option>{/each}</select></label>
    {/if}
  </div>
</aside>

<style>

  .join-panel { grid-column: 2; grid-row: 1 / span 2; justify-self: end; display: flex; flex-direction: row-reverse; align-items: center; gap: var(--space-4); max-width: 540px; }
  .join-panel > div:last-child { min-width: 0; }
  .join-qr { flex: 0 0 240px; width: 240px; height: 240px; }
  .join-qr:empty { display: none; }
  .join-qr :global(svg) { display: block; width: 100%; height: 100%; background: white; border-radius: 8px; }
  strong { font-size: 22px; }
  p { color: var(--muted); margin: 0; }
  .lobby-code { margin: 6px 0; }
  .lobby-code span { color: var(--text); font-weight: 800; overflow-wrap: anywhere; }
  a { display: block; overflow-wrap: anywhere; margin-top: 6px; }
  label { display: block; margin-top: 8px; font-size: 12px; }
  select { margin-top: 4px; font-size: 14px; padding: 8px; }
  @media (max-width: 760px) { .join-panel { grid-column: 1; grid-row: auto; } .join-qr { flex-basis: 200px; width: 200px; height: 200px; } }
  @media (max-width: 400px) { .join-panel { flex-direction: column; align-items: flex-end; } .join-qr { flex-basis: auto; } }
</style>
