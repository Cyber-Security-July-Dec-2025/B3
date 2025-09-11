// options.js

async function load() {
  // load autolock from meta via background
  try {
    const themeObj = await chrome.storage.local.get(['theme']);
    const theme = themeObj.theme || 'system';
    document.getElementById('theme').value = theme;
    const metaObj = await chrome.storage.local.get(['meta']);
    const minutes = Math.max(1, Math.round((metaObj?.meta?.autolockMs || 5*60*1000) / 60000));
    document.getElementById('minutes').value = String(minutes);
  } catch (_) {}
}

async function saveSecurity() {
  let minutes = parseInt(document.getElementById('minutes').value || '5', 10);
  if (!Number.isFinite(minutes) || minutes < 1) {
    alert('Please enter a valid number of minutes (>= 1).');
    return;
  }
  const ms = Math.max(1, minutes) * 60 * 1000;
  const resp = await chrome.runtime.sendMessage({ type: 'SET_AUTOLOCK', ms });
  if (resp && resp.ok) {
    alert('Security settings saved');
  } else {
    alert('Failed to save: ' + ((resp && resp.error) || 'Unknown error'));
  }
}

async function saveTheme() {
  const theme = document.getElementById('theme').value;
  await chrome.storage.local.set({ theme });
  alert('Theme saved');
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  document.getElementById('saveSecurity').addEventListener('click', saveSecurity);
  document.getElementById('saveTheme').addEventListener('click', saveTheme);
});
