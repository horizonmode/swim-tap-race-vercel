<script>
  import { onMount } from 'svelte';
  import qrcode from 'qrcode-generator';
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
    <strong>Scan to join</strong><p>{hint}</p>
    <a href={url || '/'} aria-label="Player join link">{url}</a>
    {#if urls.length > 1}
      <label>Network address<select bind:value={url} aria-label="Network address">{#each urls as address}<option value={address}>{address}</option>{/each}</select></label>
    {/if}
  </div>
</aside>
