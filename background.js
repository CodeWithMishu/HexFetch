const STORAGE_KEYS = {
  LAST_SCAN: "hexfetchLastScan",
  INSPECTOR_BY_TAB: "hexfetchInspectorByTab"
};

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function sendToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

function isRestrictedUrl(url) {
  const value = (url || "").toLowerCase();
  return (
    value.startsWith("chrome://") ||
    value.startsWith("chrome-extension://") ||
    value.startsWith("edge://") ||
    value.startsWith("about:") ||
    value.startsWith("view-source:")
  );
}

async function ensureContentScriptReady(tab) {
  if (!tab || !tab.id) {
    throw new Error("No active tab");
  }

  if (isRestrictedUrl(tab.url)) {
    throw new Error("Restricted page");
  }

  try {
    const ping = await sendToTab(tab.id, { type: "HEXFETCH_PING" });
    if (ping && ping.ok) {
      return;
    }
  } catch {
    // Fallback to explicit script injection.
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
}

async function setBadgeText(text) {
  await chrome.action.setBadgeBackgroundColor({ color: "#13283f" });
  await chrome.action.setBadgeText({ text: text || "" });
}

async function runQuickScan() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    await setBadgeText("ERR");
    return;
  }

  try {
    await ensureContentScriptReady(tab);
    const response = await sendToTab(tab.id, { type: "HEXFETCH_EXTRACT_COLORS" });
    if (!response || !response.ok) {
      await setBadgeText("ERR");
      return;
    }

    const count = Array.isArray(response.payload.colors) ? response.payload.colors.length : 0;
    await chrome.storage.local.set({ [STORAGE_KEYS.LAST_SCAN]: response.payload });
    await setBadgeText(String(Math.min(count, 999)));
  } catch {
    await setBadgeText("ERR");
  }
}

async function getInspectorStateByTab() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.INSPECTOR_BY_TAB]);
  return data[STORAGE_KEYS.INSPECTOR_BY_TAB] || {};
}

async function toggleInspectorFromCommand() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    await setBadgeText("ERR");
    return;
  }

  try {
    await ensureContentScriptReady(tab);
    const stateByTab = await getInspectorStateByTab();
    const nextEnabled = !Boolean(stateByTab[tab.id]);

    const response = await sendToTab(tab.id, {
      type: "HEXFETCH_TOGGLE_INSPECTOR",
      enabled: nextEnabled
    });

    if (!response || !response.ok) {
      await setBadgeText("ERR");
      return;
    }

    const updated = { ...stateByTab, [tab.id]: response.payload.enabled };
    await chrome.storage.local.set({ [STORAGE_KEYS.INSPECTOR_BY_TAB]: updated });
    await setBadgeText(response.payload.enabled ? "INS" : "");
  } catch {
    await setBadgeText("ERR");
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "quick-scan") {
    runQuickScan();
    return;
  }

  if (command === "toggle-inspector") {
    toggleInspectorFromCommand();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  setBadgeText("");
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const stateByTab = await getInspectorStateByTab();
  if (!stateByTab[tabId]) {
    return;
  }

  const next = { ...stateByTab };
  delete next[tabId];
  await chrome.storage.local.set({ [STORAGE_KEYS.INSPECTOR_BY_TAB]: next });
});
