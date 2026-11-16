/* Absolute-Max W2 — native CWV observers (no npm). Seals window.__EOS_CWV__. */
(function initEosCwv() {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;

  const state = {
    fcpMs: null,
    lcpMs: null,
    cls: 0,
    inpMs: null,
    ttfbMs: null,
    source: "PERFORMANCE_OBSERVER",
    measuredAt: null,
  };

  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav) state.ttfbMs = Math.round(nav.responseStart);
  } catch {
    /* ignore */
  }

  try {
    for (const paint of performance.getEntriesByType("paint")) {
      if (paint.name === "first-contentful-paint") state.fcpMs = Math.round(paint.startTime);
    }
  } catch {
    /* ignore */
  }

  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) state.lcpMs = Math.round(last.startTime);
      state.measuredAt = new Date().toISOString();
      window.__EOS_CWV__ = { ...state };
    });
    lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    /* unsupported */
  }

  try {
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) state.cls += entry.value;
      }
      state.measuredAt = new Date().toISOString();
      window.__EOS_CWV__ = { ...state };
    });
    clsObs.observe({ type: "layout-shift", buffered: true });
  } catch {
    /* unsupported */
  }

  try {
    const inpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const delay = entry.processingStart - entry.startTime;
        if (state.inpMs == null || delay > state.inpMs) state.inpMs = Math.round(delay);
      }
      state.measuredAt = new Date().toISOString();
      window.__EOS_CWV__ = { ...state };
    });
    inpObs.observe({ type: "event", buffered: true, durationThreshold: 16 });
  } catch {
    /* unsupported */
  }

  window.__EOS_CWV__ = state;
  window.addEventListener(
    "pagehide",
    () => {
      state.measuredAt = new Date().toISOString();
      window.__EOS_CWV__ = { ...state };
    },
    { capture: true },
  );
})();
