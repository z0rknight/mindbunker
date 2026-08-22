const maintenancePage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#090b0f">
    <title>MindBunker maintenance</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 24px; background: #090b0f; color: #f7f4ed; }
      main { width: min(100%, 440px); padding: 28px; border: 1px solid #2d333d; border-radius: 24px; background: #12161d; box-shadow: 0 24px 80px rgb(0 0 0 / 35%); }
      p { margin: 10px 0 0; color: #aeb7c5; line-height: 1.55; }
      .mark { display: inline-grid; place-items: center; width: 42px; height: 42px; border-radius: 14px; background: #d6ff55; color: #090b0f; font-weight: 900; }
      h1 { margin: 22px 0 0; font-size: clamp(1.65rem, 8vw, 2.2rem); letter-spacing: -.04em; }
    </style>
  </head>
  <body>
    <main>
      <span class="mark">MB</span>
      <h1>The bunker is sealed for maintenance.</h1>
      <p>MindBunker will be back in a few minutes. No changes can be saved while this page is active.</p>
    </main>
  </body>
</html>`;

const maintenanceWorker = {
  fetch() {
    return new Response(maintenancePage, {
      status: 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "120",
        "X-MindBunker-Maintenance": "active",
      },
    });
  },
};

export default maintenanceWorker;
