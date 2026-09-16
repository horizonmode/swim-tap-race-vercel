<script>
  export let titleId = undefined;

  const facts = [
    ['🏊', 'Full-body workout', 'Every stroke puts muscles across your whole body to work.'],
    ['😊', 'General wellbeing', 'Regular swimming can help you stay fit and support a positive outlook.'],
    ['😌', 'Stress relief', 'Even a light swim can help you relax and may support better sleep.'],
    ['🔥', 'Burns calories', 'Gentle and faster swims both offer an effective way to use energy.'],
    ['❤️', 'Supports long-term health', 'As cardiovascular exercise, swimming can help protect against heart disease, stroke and type 2 diabetes.'],
    ['💧', 'Water supports you', 'Water carries much of your body weight, helping you stay active with less load on your body.'],
    ['⚡', 'More energy', 'Swimming regularly can raise your energy levels by increasing your metabolic rate.'],
    ['❄️', 'Keeps you cool', 'The surrounding water cools you while you exercise—however hard you work.']
  ];
</script>

<div class="eyebrow">SWIMMING WELLBEING</div>
<h2 id={titleId}>8 benefits of swimming</h2>
<p class="summary">Whatever your fitness level, time in the pool can support your body and mind in plenty of ways.</p>
<div class="facts">
  {#each facts as fact, index}
    <article>
      <span aria-hidden="true">{fact[0]}</span>
      <div><h3>{index + 1}. {fact[1]}</h3><p>{fact[2]}</p></div>
    </article>
  {/each}
</div>
<p class="source">Summarised from <a href="https://www.swimming.org/justswim/8-benefits-of-swimming/" target="_blank" rel="noreferrer">Swim England’s “8 benefits of swimming”</a>.</p>

<style>
  h2 { margin: 10px 44px 12px 0; font-size: clamp(24px, 5vw, 36px); }
  .summary, .source, article p { color: var(--muted); line-height: 1.5; }
  .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  article { display: flex; align-items: start; gap: 14px; padding: 16px; background: #16496a; border-radius: 14px; }
  article > span { font-size: 28px; }
  h3 { margin: 0 0 6px; font-size: 18px; }
  article p { margin: 0; }
  .source { font-size: 13px; }
  @media (max-width: 620px) { .facts { grid-template-columns: 1fr; } }
</style>
