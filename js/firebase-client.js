let analyticsInitialized = false;

export async function initFirebaseAnalytics() {
  if (analyticsInitialized) return;
  analyticsInitialized = true;

  try {
    const res = await fetch('/api/firebase-config', {
      credentials: 'same-origin',
    });
    if (!res.ok) return;
    const payload = await res.json();
    const firebaseConfig = payload && payload.config;
    if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.appId) {
      return;
    }

    const [{ initializeApp, getApps, getApp }, analyticsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js'),
    ]);

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    if (firebaseConfig.measurementId && (await analyticsMod.isSupported())) {
      analyticsMod.getAnalytics(app);
    }
  } catch {
    // Non-fatal if analytics is blocked by browser privacy settings or offline
  }
}
