export async function handleCheckLinks(request, sender, sendResponse) {
  const urls = request.urls || [];
  const results = {};
  const concurrency = 5;
  let idx = 0;

  async function checkOne(url) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      const status = response.status;
      let health = 'unknown';
      if (status >= 200 && status < 300) health = 'alive';
      else if (status >= 300 && status < 400) health = 'redirect';
      else if (status >= 400) health = 'broken';
      results[url] = { status, health };
    } catch (err) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });
        const status = response.status;
        let health = 'unknown';
        if (status >= 200 && status < 300) health = 'alive';
        else if (status >= 300 && status < 400) health = 'redirect';
        else if (status >= 400) health = 'broken';
        results[url] = { status, health };
      } catch {
        results[url] = { status: 0, health: 'error' };
      }
    }
  }

  async function worker() {
    while (idx < urls.length) {
      const currentIdx = idx++;
      await checkOne(urls[currentIdx]);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(concurrency, urls.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  sendResponse({ results });
}
