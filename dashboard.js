// dashboard.js
function msToHms(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun ... 6 Sat
  const diff = (day + 6) % 7; // Monday as start
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

async function loadToday() {
  const todayKey = dateKey(new Date());
  const { aggregates = {} } = await chrome.storage.local.get("aggregates");
  const day = aggregates[todayKey] || {
    totalMs: 0,
    productiveMs: 0,
    unproductiveMs: 0,
    domains: {},
  };

  document.getElementById("todayProd").textContent = msToHms(
    day.productiveMs || 0
  );
  document.getElementById("todayUnprod").textContent = msToHms(
    day.unproductiveMs || 0
  );
  document.getElementById("todayTotal").textContent = msToHms(day.totalMs || 0);

  const score = day.totalMs
    ? Math.round((day.productiveMs / day.totalMs) * 100)
    : 0;
  document.getElementById("todayScore").textContent = `${score}%`;

  const top = Object.entries(day.domains || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const ul = document.getElementById("topSites");
  ul.innerHTML = "";
  top.forEach(([domain, ms]) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${domain}</span><strong>${msToHms(ms)}</strong>`;
    ul.appendChild(li);
  });
}

async function loadWeek() {
  const start = startOfWeek();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(dateKey(d));
  }

  const { aggregates = {} } = await chrome.storage.local.get("aggregates");
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const prod = [];
  const unprod = [];
  const total = [];

  let weekProd = 0,
    weekUnprod = 0,
    weekTotal = 0;

  days.forEach((k) => {
    const day = aggregates[k] || {
      totalMs: 0,
      productiveMs: 0,
      unproductiveMs: 0,
    };
    prod.push(Math.round(((day.productiveMs || 0) / 3600000) * 100) / 100); // hours
    unprod.push(Math.round(((day.unproductiveMs || 0) / 3600000) * 100) / 100);
    total.push(Math.round(((day.totalMs || 0) / 3600000) * 100) / 100);

    weekProd += day.productiveMs || 0;
    weekUnprod += day.unproductiveMs || 0;
    weekTotal += day.totalMs || 0;
  });

  // Bar chart
  const barCtx = document.getElementById("weeklyBar").getContext("2d");
  new Chart(barCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Productive (h)", data: prod, backgroundColor: "#2ecc71" },
        { label: "Unproductive (h)", data: unprod, backgroundColor: "#e74c3c" },
        { label: "Total (h)", data: total, backgroundColor: "#3498db" },
      ],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
    },
  });

  // Pie chart
  const pieCtx = document.getElementById("weeklyPie").getContext("2d");
  new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: ["Productive", "Unproductive", "Neutral"],
      datasets: [
        {
          data: [
            Math.round((weekProd / 3600000) * 100) / 100,
            Math.round((weekUnprod / 3600000) * 100) / 100,
            Math.round(((weekTotal - weekProd - weekUnprod) / 3600000) * 100) /
              100,
          ],
          backgroundColor: ["#2ecc71", "#e74c3c", "#95a5a6"],
        },
      ],
    },
  });

  // Weekly report
  const score = weekTotal ? Math.round((weekProd / weekTotal) * 100) : 0;
  const report = `
    <p><strong>Total time:</strong> ${msToHms(weekTotal)}</p>
    <p><strong>Productive time:</strong> ${msToHms(weekProd)}</p>
    <p><strong>Unproductive time:</strong> ${msToHms(weekUnprod)}</p>
    <p><strong>Focus score:</strong> ${score}%</p>
    <p><strong>Notes:</strong> Aim to increase productive time by 10–15% next week. Consider blocking or limiting top unproductive domains during work hours.</p>
  `;
  document.getElementById("weeklyReport").innerHTML = report;

  // Optional: push queued sessions to backend
  const {
    syncEnabled,
    backend,
    queue = [],
  } = await chrome.storage.local.get({
    syncEnabled: false,
    backend: null,
    queue: [],
  });
  if (syncEnabled && backend && queue.length) {
    try {
      if (backend.type === "rest") {
        await fetch(backend.url + "/sessions/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: backend.token
              ? `Bearer ${backend.token}`
              : undefined,
          },
          body: JSON.stringify(queue),
        });
        await chrome.storage.local.set({ queue: [] });
      } else if (backend.type === "firebase") {
        // In a real app, initialize Firebase here and write queue to Firestore
        // For demo, clear queue to avoid growth
        await chrome.storage.local.set({ queue: [] });
      }
    } catch (e) {
      // keep queue for retry
    }
  }
}

document.getElementById("refresh").addEventListener("click", (e) => {
  e.preventDefault();
  loadToday();
  loadWeek();
});

(async function init() {
  await loadToday();
  await loadWeek();
})();
