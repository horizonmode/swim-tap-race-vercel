export const swimmerOptions = [
  { id: "human", name: "Man" },
  { id: "woman", name: "Woman" },
  { id: "cat", name: "Cat" },
  { id: "cat-bw", name: "Cat 2" },
  { id: "dog", name: "Dog" },
  { id: "frog", name: "Frog" },
  { id: "duck", name: "Duck" }
];
export function normalizeSwimmer(value) {
  return swimmerOptions.some(option => option.id === value) ? value : "human";
}
export function swimmerMarkup(value) {
  const kind = normalizeSwimmer(value);
  if (kind === "human" || kind === "woman") return `<svg class="pixel-swimmer" viewBox="0 0 64 48" shape-rendering="crispEdges">
            <g class="swim-leg leg-top"><path fill="#efb083" d="M5 18h21v6H5zM1 16h8v6H1z"/></g>
            <g class="swim-leg leg-bottom"><path fill="#ffd1a3" d="M5 25h21v6H5zM1 28h8v6H1z"/></g>
            <path fill="#182c55" d="M20 18h12v14H20z"/>
            <path fill="#efb083" d="M30 17h15v16H30z"/>
            ${kind === "woman" ? '<path fill="#9567db" d="M23 18h14v14H23zM37 17h5v5h-5z"/><path fill="#d7b9ff" d="M26 20h5v10h-5z"/><path fill="#603d2b" d="M42 18h5v13h-5zM37 29h9v5h-9zM33 32h8v4h-8z"/>' : ""}
            <g class="swim-arm arm-top"><path fill="#ffd1a3" d="M37 18v-8h10V6h13v6H47v12h-10z"/></g>
            <g class="swim-arm arm-bottom"><path fill="#efb083" d="M37 27v11H25v5H14v-6h17V27z"/></g>
            <path fill="#ffd1a3" d="M44 19h13v13H44zM54 23h6v5h-6z"/>
            <path fill="var(--cap-color)" d="M43 16h12v4h3v5H43z"/>
            <path fill="#142d4c" d="M52 24h7v3h-7z"/>
            <path fill="#fff" d="M53 24h3v2h-3z"/>
          </svg>`;
  if (kind === "cat") return `<svg class="pixel-swimmer cat-swimmer" viewBox="0 0 64 48" shape-rendering="crispEdges" aria-hidden="true">
    <!-- Curled tail and striped tabby body. -->
    <path fill="#93491f" d="M20 25H8v-4H4V9h4V5h9v4h4v9h-5v-8h-5v10h9z"/>
    <path fill="#ffb45f" d="M20 23H9v-4H7V10h4v9h9z"/>
    <g class="swim-leg leg-top"><path fill="#e98b39" d="M17 19h13v7H17z"/><path fill="#fff0cd" d="M13 18h8v8h-8z"/></g>
    <g class="swim-leg leg-bottom"><path fill="#e98b39" d="M17 29h14v7H17z"/><path fill="#fff0cd" d="M13 30h8v8h-8z"/></g>
    <path fill="#93491f" d="M22 17h20v4h4v13h-4v4H22v-4h-4V21h4z"/>
    <path fill="#ffb45f" d="M23 20h19v14H23z"/>
    <path fill="#ffe3ad" d="M25 28h16v6H25z"/>
    <path fill="#b85e25" d="M25 20h4v7h-4zM33 20h4v7h-4z"/>
    <g class="swim-arm arm-top"><path fill="#e98b39" d="M35 21h7V11h-7z"/><path fill="#fff0cd" d="M33 9h11v7H33z"/></g>
    <g class="swim-arm arm-bottom"><path fill="#e98b39" d="M35 29h7v10h-7z"/><path fill="#fff0cd" d="M33 36h11v7H33z"/></g>
    <path fill="var(--cap-color, #5dd7ff)" d="M39 30h17v5H39z"/>
    <!-- Oversized face with stepped pointed ears, two eyes, and a white muzzle. -->
    <path fill="#93491f" d="M36 20V5h3v3h3v3h10V8h3V5h3v15h3v10h-4v4H40v-4h-4z"/>
    <path fill="#ffb45f" d="M39 18v-7h3v4h10v-4h3v7h3v11h-4v3H42v-3h-3z"/>
    <path fill="#f69aa0" d="M39 11h3v6h-3zM52 11h3v6h-3z"/>
    <path fill="#b85e25" d="M44 15h3v5h-3zM49 15h3v5h-3z"/>
    <path fill="#315034" d="M41 21h5v4h-5zM51 21h5v4h-5z"/>
    <path fill="#d9f59c" d="M41 21h2v3h-2zM51 21h2v3h-2z"/>
    <path fill="#fff0cd" d="M43 26h12v5H43z"/>
    <path fill="#e77689" d="M47 25h4v3h-4z"/>
    <path fill="#633e32" d="M48 28h2v3h-2z"/>
    <path fill="#fff0cd" d="M33 24h7v2h-7zM32 29h9v2h-9zM57 24h7v2h-7zM57 29h7v2h-7z"/>
  </svg>`;
  if (kind === "cat-bw") return `<svg class="pixel-swimmer cat-swimmer" viewBox="0 0 64 48" shape-rendering="crispEdges" aria-hidden="true">
    <path fill="#171717" d="M20 25H8v-4H4V9h4V5h9v4h4v9h-5v-8h-5v10h9z"/>
    <path fill="#f4f4f4" d="M20 23H9v-4H7V10h4v9h9z"/>
    <g class="swim-leg leg-top"><path fill="#171717" d="M17 19h13v7H17z"/><path fill="#f4f4f4" d="M13 18h8v8h-8z"/></g>
    <g class="swim-leg leg-bottom"><path fill="#171717" d="M17 29h14v7H17z"/><path fill="#f4f4f4" d="M13 30h8v8h-8z"/></g>
    <path fill="#171717" d="M22 17h20v4h4v13h-4v4H22v-4h-4V21h4z"/>
    <path fill="#f4f4f4" d="M23 20h19v14H23z"/>
    <path fill="#d9d9d9" d="M25 28h16v6H25z"/>
    <path fill="#333" d="M25 20h4v7h-4zM33 20h4v7h-4z"/>
    <g class="swim-arm arm-top"><path fill="#171717" d="M35 21h7V11h-7z"/><path fill="#f4f4f4" d="M33 9h11v7H33z"/></g>
    <g class="swim-arm arm-bottom"><path fill="#171717" d="M35 29h7v10h-7z"/><path fill="#f4f4f4" d="M33 36h11v7H33z"/></g>
    <path fill="var(--cap-color, #5dd7ff)" d="M39 30h17v5H39z"/>
    <path fill="#171717" d="M36 20V5h3v3h3v3h10V8h3V5h3v15h3v10h-4v4H40v-4h-4z"/>
    <path fill="#f4f4f4" d="M39 18v-7h3v4h10v-4h3v7h3v11h-4v3H42v-3h-3z"/>
    <path fill="#f2a3b0" d="M39 11h3v6h-3zM52 11h3v6h-3z"/>
    <path fill="#333" d="M44 15h3v5h-3zM49 15h3v5h-3z"/>
    <path fill="#171717" d="M41 21h5v4h-5zM51 21h5v4h-5z"/>
    <path fill="#d9f59c" d="M41 21h2v3h-2zM51 21h2v3h-2z"/>
    <path fill="#fff" d="M43 26h12v5H43z"/>
    <path fill="#e77689" d="M47 25h4v3h-4z"/>
    <path fill="#333" d="M48 28h2v3h-2z"/>
    <path fill="#f4f4f4" d="M33 24h7v2h-7zM32 29h9v2h-9zM57 24h7v2h-7zM57 29h7v2h-7z"/>
  </svg>`;
  const color = { dog: "#bc8154", frog: "#82d96b", duck: "#f4c542" }[kind];
  const head = {
    dog: '<path fill="#bc8154" d="M42 15h15v6h6v11H42z"/><path fill="#684737" d="M41 14h7v17h-7z"/><path fill="#efd3a3" d="M53 23h10v9H53z"/><path fill="#263954" d="M53 18h3v3h-3zM60 23h4v4h-4z"/><path fill="#ff8e98" d="M58 32h4v5h-4z"/>',
    frog: '<path fill="#82d96b" d="M42 14h16v6h5v13H42zM46 9h9v9h-9z"/><path fill="#fffbe2" d="M48 10h6v6h-6z"/><path fill="#263954" d="M51 11h3v4h-3zM52 28h11v3H52z"/>',
    duck: '<path fill="#f4c542" d="M40 15h4V9h5V5h12v4h3v5h-3v5h3v4h-4v9H43v-4h-5v-8h2z"/><path fill="#fff1a8" d="M45 20h13v9H45z"/><path fill="#263954" d="M53 13h4v4h-4z"/><path fill="#fff" d="M54 13h2v2h-2z"/><path fill="#f28c28" d="M57 20h7v4h-4v5h-7v-5h4z"/><path fill="#d98a20" d="M57 24h7v3h-7z"/><path fill="#e7ad2f" d="M28 22h10v9H28z"/>'
  }[kind];
  return `<svg class="pixel-swimmer animal-swimmer" viewBox="0 0 64 48" shape-rendering="crispEdges" aria-hidden="true">
    <path fill="${color}" d="M19 21H9v-9H5v14h14z"/>
    <g class="swim-leg leg-top"><path fill="${color}" d="M12 15h17v7H12z"/></g>
    <g class="swim-leg leg-bottom"><path fill="${color}" d="M12 29h17v7H12z"/></g>
    <path fill="${color}" d="M22 17h24v17H22z"/>
    <path fill="#fff0d1" d="M27 23h16v7H27z"/>
    <path fill="var(--cap-color, #5dd7ff)" d="M36 17h5v17h-5z"/>
    <g class="swim-arm arm-top"><path fill="${color}" d="M37 18V9h13v6h-7v9h-6z"/></g>
    <g class="swim-arm arm-bottom"><path fill="${color}" d="M37 27v12H25v-6h12z"/></g>
    ${head}
  </svg>`;
}
