const DRINK_INTERVAL = 6 * 60 * 1000;

const DRINK_MAP = {
  morning: 'm-drink',
  midday:  'd-water',
  evening: 'e-water'
};

function getCurrentPeriod() {
  const h = new Date().getHours();
  if (h >= 6  && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'midday';
  if (h >= 17 && h < 22) return 'evening';
  return null;
}

function getDrinkItem(id) {
  if (typeof todoState === 'undefined') return null;
  for (const section of todoState) {
    const item = section.items.find(i => i.id === id);
    if (item) return item;
  }
  return null;
}

function checkDrinkReminder() {
  const period = getCurrentPeriod();
  if (!period) return;

  const item = getDrinkItem(DRINK_MAP[period]);
  if (!item || item.count >= item.target) return;

  pushNotification(
    '~ time to drink',
    `${item.count} / ${item.target} — ${period}`,
    10000
  );
}

setInterval(checkDrinkReminder, DRINK_INTERVAL);
