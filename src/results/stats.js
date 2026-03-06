import { dom } from './state.js';
import { getProcessedLinks, applyFilters } from './filters.js';

export function renderDomainStats() {
  const links = getProcessedLinks().filter(l => l.domain);
  if (links.length === 0) {
    dom.domainStatsBar.hidden = true;
    return;
  }

  const freq = {};
  links.forEach(l => { freq[l.domain] = (freq[l.domain] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const top5 = sorted.slice(0, 5);
  const otherCount = sorted.slice(5).reduce((sum, [, c]) => sum + c, 0);

  const colors = [
    'var(--pp-accent)', 'var(--pp-success)', 'var(--pp-warning)',
    'var(--pp-error)', 'var(--pp-info)',
  ];

  dom.domainStatsBar.hidden = false;
  dom.domainStatsBar.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'pp-stats-bar-inner';

  top5.forEach(([domain, count], i) => {
    const pct = (count / links.length) * 100;
    const seg = document.createElement('div');
    seg.className = 'pp-stats-segment';
    seg.style.width = pct + '%';
    seg.style.background = colors[i];
    seg.title = `${domain}: ${count} (${Math.round(pct)}%)`;
    seg.addEventListener('mouseenter', () => highlightDomain(domain));
    seg.addEventListener('mouseleave', clearDomainHighlight);
    seg.addEventListener('click', () => {
      dom.patternInput.value = '*' + domain + '*';
      applyFilters();
    });
    bar.appendChild(seg);
  });

  if (otherCount > 0) {
    const pct = (otherCount / links.length) * 100;
    const seg = document.createElement('div');
    seg.className = 'pp-stats-segment';
    seg.style.width = pct + '%';
    seg.style.background = 'var(--pp-text-tertiary)';
    seg.title = `Other: ${otherCount} (${Math.round(pct)}%)`;
    bar.appendChild(seg);
  }

  dom.domainStatsBar.appendChild(bar);

  const legend = document.createElement('div');
  legend.className = 'pp-stats-legend';
  top5.forEach(([domain, count], i) => {
    const item = document.createElement('span');
    item.className = 'pp-stats-legend-item';
    const dot = document.createElement('span');
    dot.className = 'pp-stats-legend-dot';
    dot.style.background = colors[i];
    item.appendChild(dot);
    item.appendChild(document.createTextNode(domain + ' (' + count + ')'));
    legend.appendChild(item);
  });
  if (otherCount > 0) {
    const item = document.createElement('span');
    item.className = 'pp-stats-legend-item';
    const dot = document.createElement('span');
    dot.className = 'pp-stats-legend-dot';
    dot.style.background = 'var(--pp-text-tertiary)';
    item.appendChild(dot);
    item.appendChild(document.createTextNode('Other (' + otherCount + ')'));
    legend.appendChild(item);
  }
  dom.domainStatsBar.appendChild(legend);
}

function highlightDomain(domain) {
  dom.linksList.querySelectorAll('.pp-link-item').forEach(li => {
    if (li.dataset.domain !== domain) {
      li.style.opacity = '0.3';
    }
  });
}

function clearDomainHighlight() {
  dom.linksList.querySelectorAll('.pp-link-item').forEach(li => {
    li.style.opacity = '';
  });
}

export function renderSuggestions() {
  const links = getProcessedLinks().filter(l => l.url.startsWith('http'));
  if (links.length < 5) {
    dom.suggestionsBar.hidden = true;
    return;
  }

  const pathSegments = {};
  links.forEach(l => {
    try {
      const parsed = new URL(l.url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 1) {
        const prefix = '/' + parts[0] + '/*';
        pathSegments[prefix] = (pathSegments[prefix] || 0) + 1;
      }
      if (parts.length >= 2) {
        const prefix = '/' + parts[0] + '/' + parts[1] + '/*';
        pathSegments[prefix] = (pathSegments[prefix] || 0) + 1;
      }
    } catch { /* skip */ }
  });

  const suggestions = Object.entries(pathSegments)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (suggestions.length === 0) {
    dom.suggestionsBar.hidden = true;
    return;
  }

  dom.suggestionsBar.hidden = false;
  dom.suggestionsBar.innerHTML = '<span class="pp-suggestions-label">Patterns:</span>';
  suggestions.forEach(([pattern, count]) => {
    const chip = document.createElement('button');
    chip.className = 'pp-suggestion-chip';
    chip.textContent = `${count} match ${pattern}`;
    chip.addEventListener('click', () => {
      dom.patternInput.value = '*' + pattern;
      applyFilters();
    });
    dom.suggestionsBar.appendChild(chip);
  });
}
