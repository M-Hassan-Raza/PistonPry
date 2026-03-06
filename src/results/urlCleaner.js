import { state } from './state.js';
import { stripTracking } from '../shared/tracking.js';
import { showToast } from './toast.js';

export function cleanAllUrls(renderCurrentView, computeDuplicates) {
  let totalCleaned = 0;
  let urlsCleaned = 0;
  state.allLinks.forEach((link, i) => {
    const result = stripTracking(link.url);
    if (result.removedCount > 0) {
      totalCleaned += result.removedCount;
      urlsCleaned++;
      state.allLinks[i].url = result.cleaned;
    }
  });
  if (totalCleaned === 0) {
    showToast('info', 'URLs are clean', 'No tracking parameters found');
  } else {
    showToast('success', 'Cleaned URLs', `Stripped ${totalCleaned} tracking param(s) from ${urlsCleaned} URL(s)`);
  }
  computeDuplicates();
  renderCurrentView();
}
