// options.js
function defaultRules() {
  return {
    productive: [
      "github.com",
      "stackoverflow.com",
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

async function load() {
  const {
    rules = defaultRules(),
    syncEnabled = false,
    backend = null,
  } = await chrome.storage.sync.get(["rules", "syncEnabled", "backend"]);
  document.getElementById("productive").value = rules.productive.join("\n");
  document.getElementById("unproductive").value = rules.unproductive.join("\n");
  document.getElementById("neutral").value = rules.neutral.join("\n");
  document.getElementById("syncEnabled").checked = !!syncEnabled;

  const type = backend?.type || "";
  document.getElementById("backendType").value = type;
  document.getElementById("restUrl").value = backend?.url || "";
  document.getElementById("restToken").value = backend?.token || "";
}

document.getElementById("save").addEventListener("click", async () => {
  const rules = {
    productive: document
      .getElementById("productive")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    unproductive: document
      .getElementById("unproductive")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    neutral: document
      .getElementById("neutral")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
  const syncEnabled = document.getElementById("syncEnabled").checked;
  const backendType = document.getElementById("backendType").value;
  const backend = backendType
    ? {
        type: backendType,
        url: document.getElementById("restUrl").value.trim(),
        token: document.getElementById("restToken").value.trim(),
      }
    : null;

  await chrome.storage.sync.set({ rules, syncEnabled, backend });
  alert("Saved!");
});

load();
