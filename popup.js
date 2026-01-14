// popup.js
function msToHms(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

async function loadToday() {
  const dateKey = new Date().toISOString().slice(0, 10);
  const { aggregates = {} } = await chrome.storage.local.get("aggregates");
  const day = aggregates[dateKey] || {
    totalMs: 0,
    productiveMs: 0,
    unproductiveMs: 0,
  };
  document.getElementById("prod").textContent = msToHms(day.productiveMs || 0);
  document.getElementById("unprod").textContent = msToHms(
    day.unproductiveMs || 0
  );
  document.getElementById("total").textContent = msToHms(day.totalMs || 0);
}

document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

document.getElementById("resetToday").addEventListener("click", async () => {
  const dateKey = new Date().toISOString().slice(0, 10);
  const { aggregates = {} } = await chrome.storage.local.get("aggregates");
  delete aggregates[dateKey];
  await chrome.storage.local.set({ aggregates });
  await loadToday();
});

loadToday();
