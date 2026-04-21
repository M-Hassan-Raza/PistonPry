import { state, dom } from './state.js';
import { showToast } from './toast.js';

function getHealthCheckOrigins(urls) {
  const origins = new Set();

  urls.forEach((url) => {
    try {
      const parsed = new URL(url);
      origins.add(`${parsed.protocol}//${parsed.host}/*`);
    } catch {
      // Skip invalid URLs. The caller already filters for HTTP(S).
    }
  });

  return [...origins];
}

async function ensureHealthCheckAccess(origins) {
  if (origins.length === 0) {
    return true;
  }

  if (await chrome.permissions.contains({ origins })) {
    return true;
  }

  showToast('info', 'Site access needed', 'Grant host access to check link health on these sites.');

  try {
    return await chrome.permissions.request({ origins });
  } catch (err) {
    showToast('error', 'Permission request failed', err.message || 'Chrome rejected the request');
    return false;
  }
}

export async function checkAllLinks(renderCurrentView) {
  const urls = [...new Set(state.allLinks.map(l => l.url).filter(u => u.startsWith('http')))];
  if (urls.length === 0) {
    showToast('warning', 'No HTTP links to check');
    return;
  }

  const origins = getHealthCheckOrigins(urls);
  const hasAccess = await ensureHealthCheckAccess(origins);
  if (!hasAccess) {
    showToast('warning', 'Health check cancelled', 'Site access is required to fetch remote link targets.');
    return;
  }

  dom.checkLinksBtn.disabled = true;
  dom.checkLinksBtn.textContent = 'Checking...';
  showToast('info', 'Checking links', `Testing ${urls.length} URL(s)...`);

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'checkLinks', urls }, (res) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(res);
      });
    });

    state.healthResults = response.results || {};

    let alive = 0, broken = 0, redirect = 0, errors = 0;
    Object.values(state.healthResults).forEach(r => {
      if (r.health === 'alive') alive++;
      else if (r.health === 'broken') broken++;
      else if (r.health === 'redirect') redirect++;
      else errors++;
    });

    dom.healthSummary.hidden = false;
    dom.healthSummary.innerHTML = '';
    const parts = [];
    if (alive) parts.push(`<span class="pp-health-stat pp-health-alive">${alive} alive</span>`);
    if (redirect) parts.push(`<span class="pp-health-stat pp-health-redirect">${redirect} redirect</span>`);
    if (broken) parts.push(`<span class="pp-health-stat pp-health-broken">${broken} broken</span>`);
    if (errors) parts.push(`<span class="pp-health-stat pp-health-error">${errors} unknown</span>`);
    dom.healthSummary.innerHTML = 'Link Health: ' + parts.join(' ');

    renderCurrentView();
    showToast('success', 'Health check complete', `${alive} alive, ${broken} broken, ${redirect} redirect`);
  } catch (err) {
    showToast('error', 'Health check failed', err.message || 'Unknown error');
  } finally {
    dom.checkLinksBtn.disabled = false;
    dom.checkLinksBtn.textContent = 'Check Links';
  }
}
