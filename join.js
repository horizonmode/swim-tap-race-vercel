async function showJoinCode() {
  const qrContainer = document.getElementById("joinQr");
  const link = document.getElementById("joinLink");
  const hint = document.getElementById("joinHint");
  const network = document.getElementById("joinNetwork");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  let urls = [new URL("/", location.href).href];

  if (loopback) {
    hint.textContent = "Connect your phone to the same Wi-Fi as this computer.";
    try {
      const response = await fetch("/api/join-info");
      if (!response.ok) throw new Error("Network address unavailable");
      const info = await response.json();
      if (!info.urls?.length) throw new Error("No network connection");
      urls = info.urls;
    } catch {
      hint.textContent = "Connect this computer to Wi-Fi, then refresh to get a phone-accessible QR code.";
      return;
    }
  }

  function render(url) {
    link.href = url;
    link.textContent = url;
    try {
      const code = qrcode(0, "M");
      code.addData(url);
      code.make();
      qrContainer.innerHTML = code.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
    } catch {
      hint.textContent = "Open the link below on your phone to join.";
    }
  }

  urls.forEach(url => network.add(new Option(url, url)));
  if (urls.length > 1) {
    document.getElementById("networkChoice").classList.remove("hidden");
    hint.textContent = "Use the same Wi-Fi. If scanning fails, try another network address below.";
  }
  network.addEventListener("change", () => render(network.value));
  render(urls[0]);
}

showJoinCode();
