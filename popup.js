// Youlysses — Popup UI

let dayOffset = 0; // 0 = today, -1 = yesterday, etc.

function getDateKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDateLabel(offset) {
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

async function render() {
  const dateKey = getDateKey(dayOffset);
  const data = await chrome.storage.local.get(dateKey);
  const dayData = data[dateKey] || {};

  // Date label
  document.getElementById("date-label").textContent = formatDateLabel(dayOffset);
  document.getElementById("next-day").disabled = dayOffset >= 0;

  // Sort by time descending
  const entries = Object.entries(dayData).sort((a, b) => b[1] - a[1]);

  // Total
  const totalSeconds = entries.reduce((sum, [, s]) => sum + s, 0);
  document.getElementById("total-time").textContent = formatTime(totalSeconds);

  const list = document.getElementById("site-list");

  if (entries.length === 0) {
    list.innerHTML = '<li class="empty">No data for this day</li>';
    return;
  }

  const maxTime = entries[0][1];

  list.innerHTML = entries
    .map(([domain, seconds], i) => {
      const pct = Math.round((seconds / maxTime) * 100);
      return `
        <li class="site-item">
          <span class="site-rank">${i + 1}</span>
          <div class="site-info">
            <div class="site-domain">${domain}</div>
            <div class="site-bar-container">
              <div class="site-bar" style="width: ${pct}%"></div>
            </div>
          </div>
          <span class="site-time">${formatTime(seconds)}</span>
        </li>`;
    })
    .join("");
}

document.getElementById("prev-day").addEventListener("click", () => {
  dayOffset--;
  render();
});

document.getElementById("next-day").addEventListener("click", () => {
  if (dayOffset < 0) {
    dayOffset++;
    render();
  }
});

render();
