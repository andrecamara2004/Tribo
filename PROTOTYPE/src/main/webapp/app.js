// Tribo landing — fetches the live clan ranking from the Java backend
// and renders the preview list. Falls back to a static set if the API is down,
// so the landing page still looks complete in screenshots.

const FALLBACK = {
  clans: [
    { rank: 1, name: "Forest Runners",  members: 20, avgPace: "4:42", color: "#00B86B" },
    { rank: 2, name: "Trash Hunters",   members: 20, avgPace: "5:01", color: "#3A7BD5" },
    { rank: 3, name: "Sunday Striders", members: 20, avgPace: "4:55", color: "#FFB020" },
    { rank: 4, name: "Tribo do Tejo",   members: 19, avgPace: "5:14", color: "#D5398B" },
    { rank: 5, name: "Cascais Coastal", members: 16, avgPace: "5:21", color: "#7B5BD9" }
  ]
};

async function loadRanking() {
  const list = document.getElementById("ranking-list");
  if (!list) return;

  let data = FALLBACK;
  try {
    const r = await fetch("/api/clan-ranking");
    if (r.ok) data = await r.json();
  } catch (_) {
    // keep fallback
  }

  list.innerHTML = data.clans.map(c => `
    <li>
      <span class="rk rk-${c.rank}">${c.rank}</span>
      <div class="clan-line">
        <strong>
          <span class="clan-dot" style="background:${c.color}"></span>${c.name}
        </strong>
        <small>${c.members} members · ${c.weeklyKm ? c.weeklyKm.toFixed(0) + " km this week" : "active"}</small>
      </div>
      <span class="clan-pace">${c.avgPace}<small style="color:var(--muted);font-size:11px;font-weight:500">/km</small></span>
    </li>
  `).join("");
}

// smooth-scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener("click", e => {
    const id = a.getAttribute("href");
    if (id.length > 1) {
      const el = document.querySelector(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
});

// ranking tab switcher (purely visual for the prototype)
document.querySelectorAll(".ranking-tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".ranking-tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

loadRanking();
