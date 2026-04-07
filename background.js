// Youlysses — Background service worker
// Tracks active tab time per domain

let activeTabId = null;
let activeDomain = null;
let lastTimestamp = null;

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function flushTime() {
  if (!activeDomain || !lastTimestamp) return;

  const now = Date.now();
  const elapsed = Math.round((now - lastTimestamp) / 1000); // seconds
  lastTimestamp = now;

  if (elapsed <= 0 || elapsed > 300) return; // ignore gaps > 5 min (likely idle/away)

  const todayKey = getTodayKey();
  const data = await chrome.storage.local.get(todayKey);
  const dayData = data[todayKey] || {};
  dayData[activeDomain] = (dayData[activeDomain] || 0) + elapsed;

  await chrome.storage.local.set({ [todayKey]: dayData });
}

async function onTabChanged(tabId) {
  await flushTime();

  activeTabId = tabId;
  lastTimestamp = Date.now();

  try {
    const tab = await chrome.tabs.get(tabId);
    activeDomain = getDomain(tab.url);
  } catch {
    activeDomain = null;
  }
}

// Track tab switches
chrome.tabs.onActivated.addListener(({ tabId }) => {
  onTabChanged(tabId);
});

// Track URL changes within a tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === activeTabId && changeInfo.url) {
    flushTime().then(() => {
      activeDomain = getDomain(changeInfo.url);
      lastTimestamp = Date.now();
    });
  }
});

// Track window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    flushTime().then(() => {
      activeDomain = null;
      lastTimestamp = null;
    });
  } else {
    // Browser gained focus — find active tab
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs[0]) onTabChanged(tabs[0].id);
    });
  }
});

// Idle detection — pause tracking when away
chrome.idle.onStateChanged.addListener((state) => {
  if (state === "idle" || state === "locked") {
    flushTime().then(() => {
      activeDomain = null;
      lastTimestamp = null;
    });
  } else if (state === "active") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) onTabChanged(tabs[0].id);
    });
  }
});

// Periodic flush every 30s so we don't lose data if the service worker dies
chrome.alarms.create("flush", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flush") flushTime();
});
