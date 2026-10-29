const views = {
  login: document.querySelector("#login-view"),
  setup: document.querySelector("#setup-view"),
  browser: document.querySelector("#browser-view"),
};

const allowedFavicons = ["🌐", "✨", "🍒", "🪴", "🌙", "🦋"];
const storageKey = "mybrowser.preferences";
let preferences = null;
let selectedSetupIcon = "🌐";
let selectedSettingsIcon = "🌐";
let currentUrl = "";

function showView(name) {
  for (const [viewName, element] of Object.entries(views)) {
    element.hidden = viewName !== name;
  }
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function clearError(element) {
  element.textContent = "";
  element.hidden = true;
}

function readPreferences() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved);
    if (typeof parsed.title !== "string" || !parsed.title.trim() || !allowedFavicons.includes(parsed.icon)) return null;
    return { title: parsed.title.slice(0, 32), icon: parsed.icon };
  } catch (error) {
    console.error("Could not read browser preferences:", error);
    localStorage.removeItem(storageKey);
    return null;
  }
}

function applyPreferences(nextPreferences) {
  preferences = nextPreferences;
  document.title = preferences.title;
  document.querySelector("#tab-title").textContent = preferences.title;
  document.querySelector("#tab-favicon").textContent = preferences.icon;
  document.querySelector("#preview-title").textContent = preferences.title;
  document.querySelector("#preview-favicon").textContent = preferences.icon;

  const favicon = document.querySelector('link[rel="icon"]');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="88">${preferences.icon}</text></svg>`;
  favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function selectFavicon(container, icon) {
  for (const button of container.querySelectorAll(".favicon-option")) {
    const selected = button.dataset.icon === icon;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

function openBrowser() {
  applyPreferences(preferences);
  showView("browser");
}

function normalizeAddress(value) {
  const address = value.trim();
  if (!address) return null;
  const candidate = /\s/.test(address)
    ? `https://www.google.com/search?q=${encodeURIComponent(address)}`
    : /^[a-z][a-z\d+.-]*:\/\//i.test(address)
      ? address
      : `https://${address}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function navigateTo(value) {
  const url = normalizeAddress(value);
  if (!url) {
    document.querySelector("#address-bar").setCustomValidity("Enter a valid web address or search.");
    document.querySelector("#address-bar").reportValidity();
    return;
  }
  const addressBar = document.querySelector("#address-bar");
  addressBar.setCustomValidity("");
  addressBar.value = url;
  currentUrl = url;
  document.querySelector("#start-page").hidden = true;
  const frame = document.querySelector("#browser-frame");
  frame.hidden = false;
  frame.src = url;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    credentials: "same-origin",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorElement = document.querySelector("#login-error");
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  clearError(errorElement);
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Checking…";

  try {
    await requestJson("/api/login", {
      method: "POST",
      body: JSON.stringify({ password: document.querySelector("#password").value }),
    });
    preferences = readPreferences();
    if (preferences) openBrowser();
    else showView("setup");
  } catch (error) {
    showError(errorElement, error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Unlock browser";
  }
});

document.querySelector("#toggle-password").addEventListener("click", (event) => {
  const input = document.querySelector("#password");
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  event.currentTarget.textContent = showing ? "Show" : "Hide";
  event.currentTarget.setAttribute("aria-label", showing ? "Show password" : "Hide password");
});

document.querySelector("#browser-title").addEventListener("input", (event) => {
  document.querySelector("#preview-title").textContent = event.currentTarget.value || "mybrowser.lol";
});

document.querySelector("#favicon-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-icon]");
  if (!button) return;
  selectedSetupIcon = button.dataset.icon;
  selectFavicon(event.currentTarget, selectedSetupIcon);
  document.querySelector("#preview-favicon").textContent = selectedSetupIcon;
});

document.querySelector("#setup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = document.querySelector("#browser-title").value.trim();
  const errorElement = document.querySelector("#setup-error");
  if (!title) {
    showError(errorElement, "Give your browser a title first.");
    return;
  }
  clearError(errorElement);
  preferences = { title, icon: selectedSetupIcon };
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch (error) {
    showError(errorElement, "Your browser couldn't save these settings. Check your browser's storage settings and try again.");
    console.error("Could not save browser preferences:", error);
    return;
  }
  openBrowser();
});

document.querySelector("#settings-button").addEventListener("click", () => {
  selectedSettingsIcon = preferences.icon;
  document.querySelector("#settings-title").value = preferences.title;
  selectFavicon(document.querySelector("#settings-favicon-options"), selectedSettingsIcon);
  document.querySelector("#settings-panel").hidden = false;
  document.querySelector("#settings-title").focus();
});

document.querySelector("#settings-close").addEventListener("click", () => {
  document.querySelector("#settings-panel").hidden = true;
});

document.querySelector("#settings-panel").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.hidden = true;
});

document.querySelector("#settings-favicon-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-icon]");
  if (!button) return;
  selectedSettingsIcon = button.dataset.icon;
  selectFavicon(event.currentTarget, selectedSettingsIcon);
});

document.querySelector("#settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = document.querySelector("#settings-title").value.trim();
  const errorElement = document.querySelector("#settings-error");
  if (!title) {
    showError(errorElement, "Enter a title for your browser.");
    return;
  }
  clearError(errorElement);
  const nextPreferences = { title, icon: selectedSettingsIcon };
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextPreferences));
  } catch (error) {
    console.error("Could not save browser preferences:", error);
    showError(errorElement, "Your browser couldn't save these settings. Check your browser's storage settings and try again.");
    return;
  }
  applyPreferences(nextPreferences);
  document.querySelector("#settings-panel").hidden = true;
});

document.querySelector("#settings-title").addEventListener("input", () => {
  clearError(document.querySelector("#settings-error"));
});

document.querySelector("#address-form").addEventListener("submit", (event) => {
  event.preventDefault();
  navigateTo(document.querySelector("#address-bar").value);
});

document.querySelectorAll(".quick-link").forEach((link) => {
  link.addEventListener("click", () => navigateTo(link.dataset.url));
});

document.querySelector("#open-external").addEventListener("click", () => {
  if (currentUrl) window.open(currentUrl, "_blank", "noopener,noreferrer");
});

document.querySelector("#reload-button").addEventListener("click", () => {
  if (currentUrl) document.querySelector("#browser-frame").src = currentUrl;
});

document.querySelector("#back-button").addEventListener("click", () => {
  document.querySelector("#browser-frame").contentWindow?.history.back();
});

document.querySelector("#forward-button").addEventListener("click", () => {
  document.querySelector("#browser-frame").contentWindow?.history.forward();
});

document.querySelector("#new-tab").addEventListener("click", () => {
  currentUrl = "";
  document.querySelector("#address-bar").value = "";
  document.querySelector("#browser-frame").removeAttribute("src");
  document.querySelector("#browser-frame").hidden = true;
  document.querySelector("#start-page").hidden = false;
});

document.querySelector("#close-tab").addEventListener("click", () => {
  document.querySelector("#new-tab").click();
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await requestJson("/api/logout", { method: "POST", body: "{}" });
    document.querySelector("#password").value = "";
    showView("login");
  } catch (error) {
    console.error("Could not lock browser:", error);
    window.alert(error.message);
  }
});

async function initialize() {
  try {
    const session = await requestJson("/api/session");
    if (!session.authenticated) {
      showView("login");
      return;
    }
    preferences = readPreferences();
    if (preferences) openBrowser();
    else showView("setup");
  } catch (error) {
    showView("login");
    showError(document.querySelector("#login-error"), `Couldn't connect to the server. ${error.message}`);
  }
}

initialize();
