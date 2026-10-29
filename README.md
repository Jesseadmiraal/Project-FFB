# Project FFB

A static, browser-style website designed for GitHub Pages. Visitors see a
password prompt, choose a title and favicon, then use the search/address bar
and embedded web view.

## Important: demo password only

GitHub Pages serves static files and cannot verify passwords on a server. The
password check in this version runs in the visitor's browser. The password
hash is shipped with the website, can be inspected or cracked, and the check
can be bypassed. It does **not** make the site or its contents private. Do not
use it to protect sensitive information. For actual access control, use a
server-capable host with server-side authentication or a hosting provider's
access-control feature.

## Set the demo password

On a computer with Node.js, generate a SHA-256 hash in PowerShell (replace the
example text with your own password):

```powershell
node -e "console.log(require('node:crypto').createHash('sha256').update('your-demo-password').digest('hex'))"
```

Copy the printed hash into `config.js`, replacing the empty value:

```js
window.MYBROWSER_PASSWORD_SHA256 = "paste-the-64-character-hash-here";
```

This keeps the literal password out of the JavaScript, but **does not make the
gate secure**: anyone can inspect the shipped hash and bypass the check. Avoid
using a password you use anywhere else.

## Publish on GitHub Pages

The website's `index.html` and assets are in the repository root, so GitHub
Pages can use them as the homepage rather than displaying this README.

1. Push this project to a GitHub repository on the `main` branch.
2. In the repository, open **Settings → Pages** and set the build and
   deployment source to **GitHub Actions**.
3. Push a commit (or run **Deploy to GitHub Pages** from the Actions tab).
   The workflow stages the site files and deploys them.
4. Open the Pages URL shown in the workflow deployment.

Alternatively, to publish directly from a branch, select the `main` branch
and the `/ (root)` folder under **Settings → Pages**. Since `index.html` is
now at the root, it will be used as the homepage.

The site uses relative asset links, so it works both at a user/org Pages
domain and at a project URL such as `username.github.io/repository/`.

The chosen title and favicon are saved in that visitor's browser. Favicon
choices use `start.png` and `favicon1.png` through `favicon5.png` from the
repository root. Some sites block being embedded in the web view; use the
arrow next to the address bar to open those sites in a new tab.
