// background.js
const STATE = {
  activeDomain: null,
  activeStart: null,
  isIdle: false,
  lastUpdate: Date.now(),
};

const IDLE_THRESHOLD_SEC = 60; // consider idle after 1 minute
const FLUSH_INTERVAL_MS = 30_000; // flush every 30s

// Utility
function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function getClassifications() {
  const { rules } = await chrome.storage.sync.get({ rules: defaultRules() });
  return rules;
}

function defaultRules() {
  return {
    productive: [
      "github.com",
      "gitlab.com",
      "stackoverflow.com",
      "leetcode.com",
      "codeforces.com",
      "docs.google.com",
      "notion.so",
      "figma.com",
    ],
    unproductive: [
      "facebook.com",
      "instagram.com",
      "twitter.com",
      "x.com",
      "reddit.com",
      "youtube.com",
      "tiktok.com",
      "netflix.com",
    ],
    neutral: [],
  };
}

function classifyDomain(domain, rules) {
  if (!domain) return "neutral";
  if (rules.productive.includes(domain)) return "productive";
  if (rules.unproductive.includes(domain)) return "unproductive";
  return "neutral";
}

async function recordTime(domain, durationMs) {
  if (!domain || durationMs <= 0) return;
  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { aggregates = {} } = await chrome.storage.local.get("aggregates");
  const rules = await getClassifications();
  const category = classifyDomain(domain, rules);

  aggregates[dateKey] = aggregates[dateKey] || {
    totalMs: 0,
    productiveMs: 0,
    unproductiveMs: 0,
    neutralMs: 0,
    domains: {},
  };
  const day = aggregates[dateKey];

  day.totalMs += durationMs;
  day[`${category}Ms`] += durationMs;
  day.domains[domain] = (day.domains[domain] || 0) + durationMs;

  await chrome.storage.local.set({ aggregates });
  await maybeSyncSession(domain, durationMs, dateKey, category);
}

async function maybeSyncSession(domain, durationMs, dateKey, category) {
  const { syncEnabled, backend } = await chrome.storage.local.get({
    syncEnabled: false,
    backend: null,
  });
  if (!syncEnabled || !backend) return;

  const payload = {
    domain,
    date: dateKey,
    durationSec: Math.round(durationMs / 1000),
    category,
    ts: Date.now(),
  };

  try {
    if (backend.type === "firebase") {
      // Firestore example via web SDK in offscreen doc or dashboard page
      // Here we queue to local storage; dashboard.js will push in batches
      const { queue = [] } = await chrome.storage.local.get({ queue: [] });
      queue.push(payload);
      await chrome.storage.local.set({ queue });
    } else if (backend.type === "rest") {
      await fetch(backend.url + "/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: backend.token ? `Bearer ${backend.token}` : undefined,
        },
        body: JSON.stringify(payload),
      });
    }
  } catch (e) {
    // keep silent; queue for retry
    const { queue = [] } = await chrome.storage.local.get({ queue: [] });
    queue.push(payload);
    await chrome.storage.local.set({ queue });
  }
}

async function flushActive() {
  if (!STATE.activeDomain || !STATE.activeStart || STATE.isIdle) return;
  const now = Date.now();
  const duration = now - STATE.activeStart;
  STATE.activeStart = now;
  await recordTime(STATE.activeDomain, duration);
}

async function updateActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = tab ? getDomain(tab.url) : null;

  await flushActive();

  STATE.activeDomain = domain;
  STATE.activeStart = Date.now();
}

chrome.tabs.onActivated.addListener(updateActiveTab);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) updateActiveTab();
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  STATE.isIdle = newState !== "active";
  if (STATE.isIdle) {
    await flushActive();
    STATE.activeDomain = null;
    STATE.activeStart = null;
  } else {
    await updateActiveTab();
  }
});

setInterval(() => flushActive(), FLUSH_INTERVAL_MS);

// Initialize
(async () => {
  await updateActiveTab();
})();
