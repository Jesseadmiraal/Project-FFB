# mybrowser

A small, password-protected browser-style website. After unlocking it, visitors
choose the title and favicon shown in the real browser tab and in the app's tab
bar, then search or open sites in an embedded web view.

## Run locally

Requires Node.js 20 or newer. In PowerShell, set the shared password and start
the server:

```powershell
$env:SITE_PASSWORD = "choose-a-long-unique-password"
node server.js
```

Open [http://localhost:3000](http://localhost:3000). Set `PORT` to use a
different port. The server refuses to start if `SITE_PASSWORD` is missing or
shorter than eight characters.

## Deployment notes

- Set `SITE_PASSWORD` in the hosting provider's environment settings; do not
  put the real password in source control.
- Use HTTPS in production. When `NODE_ENV=production`, the login cookie is
  marked `Secure`.
- Sessions are held in server memory and expire after eight hours. Restarting
  the server signs everyone out; run a single server instance unless you add a
  shared session store.
- The title and favicon are saved in each visitor's browser storage, so they
  are personal to that browser rather than shared site-wide.
- This is a web page with an embedded frame, not a full browser. Some sites
  block embedding; use the arrow button beside the address bar to open those
  sites in a new tab.
