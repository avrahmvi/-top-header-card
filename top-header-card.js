// top-header-card.js
// כרטיס Lovelace מותאם אישית: כותרת דינמית + שורת תגים, עם עורך גרפי מובנה.
// התקנה: Settings > Dashboards > Resources > הוסף קובץ זה כ-JS module.
// שימוש בדשבורד: type: custom:top-header-card

const COLOR_HEX = {
  green: "#7fb069", red: "#e07a5f", amber: "#e0c05f",
  blue: "#7d9fd8", purple: "#a892d8", teal: "#6bbfae", grey: "#9a988f"
};

class TopHeaderCard extends HTMLElement {
  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this.config = {
      heading: { mode: "dynamic", static: "", morning: "בוקר טוב", noon: "צהריים טובים", evening: "ערב טוב", ...(config.heading || {}) },
      heading_style: config.heading_style || "title",
      icon: { mode: "dynamic", static: "mdi:home", day: "mdi:white-balance-sunny", night: "mdi:moon-waning-crescent", ...(config.icon || {}) },
      subtitle_entity: config.subtitle_entity || "",
      background: { color: "#1c1c1c", opacity: 100, ...(config.background || {}) },
      badges: config.badges || []
    };
    this._buildDom();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() { return 2; }

  static getConfigElement() { return document.createElement("top-header-card-editor"); }

  static getStubConfig() {
    return {
      type: "custom:top-header-card",
      heading: { mode: "dynamic", morning: "בוקר טוב", noon: "צהריים טובים", evening: "ערב טוב" },
      heading_style: "title",
      icon: { mode: "dynamic", day: "mdi:white-balance-sunny", night: "mdi:moon-waning-crescent" },
      background: { color: "#1c1c1c", opacity: 100 },
      badges: []
    };
  }

  _buildDom() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { background: var(--card-bg, #1c1c1c); padding: 16px 14px; border: none; box-shadow: none; }
        .heading-line { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
        .heading-line span { font-size:17px; font-weight:500; color:#fff; }
        .heading-line ha-icon { color:#f5d76e; --mdc-icon-size:20px; }
        .subtitle { font-size:12px; color:#aaa; margin:0 0 12px 28px; }
        .badge-row { display:flex; gap:10px; overflow-x:auto; padding-bottom:2px; }
        .badge-dot { flex:0 0 auto; width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .badge-dot ha-icon { --mdc-icon-size:20px; color:#111; }
      </style>
      <ha-card>
        <div class="heading-line"><ha-icon id="h-icon"></ha-icon><span id="h-text"></span></div>
        <div class="subtitle" id="h-sub"></div>
        <div class="badge-row" id="badge-row"></div>
      </ha-card>
    `;
  }

  _computeHeading() {
    const h = this.config.heading;
    if (h.mode === "static") return h.static;
    const hour = new Date().getHours();
    if (hour >= 18 || hour < 5) return h.evening;
    if (hour < 12) return h.morning;
    return h.noon;
  }

  _computeIcon() {
    const ic = this.config.icon;
    if (ic.mode === "static") return ic.static;
    const sun = this._hass?.states?.["sun.sun"];
    return sun && sun.state === "above_horizon" ? ic.day : ic.night;
  }

  _checkVisible(badge) {
    if (!badge.condition || !badge.condition.entity) return true;
    const st = this._hass?.states?.[badge.condition.entity];
    return st ? st.state === badge.condition.state : false;
  }

  _handleTap(badge) {
    const action = badge.tap_action || { action: "more-info" };
    if (action.action === "more-info") {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: badge.entity }, bubbles: true, composed: true }));
    } else if (action.action === "toggle") {
      const domain = badge.entity.split(".")[0];
      this._hass.callService(domain, "toggle", { entity_id: badge.entity });
    } else if (action.action === "navigate" && action.navigation_path) {
      history.pushState(null, "", action.navigation_path);
      this.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
    } else if (action.action === "url" && action.url_path) {
      window.open(action.url_path, "_blank");
    } else if (action.action === "perform-action" && action.perform_action) {
      const [domain, service] = action.perform_action.split(".");
      if (domain && service) this._hass.callService(domain, service, { entity_id: badge.entity });
    }
  }

  _update() {
    if (!this._hass || !this.config) return;
    const root = this.shadowRoot;

    const bg = this.config.background;
    const hex = (bg.color || "#1c1c1c").replace("#", "");
    const r = parseInt(hex.substring(0, 2) || "1c", 16);
    const g = parseInt(hex.substring(2, 4) || "1c", 16);
    const b = parseInt(hex.substring(4, 6) || "1c", 16);
    root.querySelector("ha-card").style.background = `rgba(${r},${g},${b},${(bg.opacity ?? 100) / 100})`;

    root.getElementById("h-icon").setAttribute("icon", this._computeIcon());
    root.getElementById("h-text").textContent = this._computeHeading();
    root.getElementById("h-text").style.fontWeight = this.config.heading_style === "subtitle" ? "400" : "500";

    const subEl = root.getElementById("h-sub");
    if (this.config.subtitle_entity && this._hass.states[this.config.subtitle_entity]) {
      subEl.textContent = this._hass.states[this.config.subtitle_entity].state;
      subEl.style.display = "block";
    } else {
      subEl.style.display = "none";
    }

    const row = root.getElementById("badge-row");
    row.innerHTML = "";
    (this.config.badges || []).forEach((b) => {
      if (!this._checkVisible(b)) return;
      const dot = document.createElement("div");
      dot.className = "badge-dot";
      dot.style.background = COLOR_HEX[b.color] || COLOR_HEX.grey;
      dot.title = b.entity;
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", b.icon || "mdi:help-circle");
      dot.appendChild(icon);
      dot.addEventListener("click", () => this._handleTap(b));
      row.appendChild(dot);
    });
  }
}

class TopHeaderCardEditor extends HTMLElement {
  setConfig(config) { this.config = config; this._render(); }
  set hass(hass) {
    this._hass = hass;
    this.querySelectorAll("ha-entity-picker[data-entity-picker]").forEach((el) => { el.hass = hass; });
    this.querySelectorAll("ha-icon-picker[data-icon-bind]").forEach((el) => { el.hass = hass; });
  }

  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
  }

  _field(label, value, onInput, type = "text") {
    return `<div style="margin-bottom:10px"><label style="display:block;font-size:12px;color:var(--secondary-text-color);margin-bottom:2px">${label}</label>
      <input type="${type}" value="${value ?? ""}" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--divider-color);border-radius:4px;background:var(--card-background-color);color:var(--primary-text-color)" data-bind="${onInput}"></div>`;
  }

  _select(label, value, onInput, options) {
    const opts = options.map(o => `<option value="${o}" ${o === value ? "selected" : ""}>${o}</option>`).join("");
    return `<div style="margin-bottom:10px"><label style="display:block;font-size:12px;color:var(--secondary-text-color);margin-bottom:2px">${label}</label>
      <select style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--divider-color);border-radius:4px;background:var(--card-background-color);color:var(--primary-text-color)" data-bind="${onInput}">${opts}</select></div>`;
  }

  _iconField(label, onInput) {
    return `<div style="margin-bottom:10px"><label style="display:block;font-size:12px;color:var(--secondary-text-color);margin-bottom:2px">${label}</label>
      <ha-icon-picker data-icon-bind="${onInput}"></ha-icon-picker></div>`;
  }

  _getPath(path) {
    if (path[0] === "badge") return this.config.badges[Number(path[1])][path[2]];
    if (path.length === 2) return this.config[path[0]][path[1]];
    return this.config[path[0]];
  }

  _render() {
    if (!this.config) return;
    const c = this.config;
    const badgesHtml = (c.badges || []).map((b, i) => `
      <div style="border:1px solid var(--divider-color);border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="margin-bottom:10px"><label style="display:block;font-size:12px;color:var(--secondary-text-color);margin-bottom:2px">entity</label>
        <ha-entity-picker data-entity-picker="${i}"></ha-entity-picker></div>
        ${this._iconField("mdi icon", `badge:${i}:icon`)}
        ${this._select("color", b.color, `badge:${i}:color`, ["green","red","amber","blue","purple","teal","grey"])}
        ${this._field("תנאי — entity", b.condition?.entity, `badge:${i}:cond_entity`)}
        ${this._field("תנאי — state", b.condition?.state, `badge:${i}:cond_state`)}
        ${this._select("tap_action", b.tap_action?.action || "more-info", `badge:${i}:tap_action`, ["more-info","toggle","navigate","url","perform-action"])}
        <button data-remove="${i}">הסר תג</button>
      </div>`).join("");

    this.innerHTML = `
      <div style="padding:8px">
        <h3>כותרת</h3>
        ${this._field("mode (static/dynamic)", c.heading.mode, "heading:mode")}
        ${this._field("static", c.heading.static, "heading:static")}
        ${this._field("morning", c.heading.morning, "heading:morning")}
        ${this._field("noon", c.heading.noon, "heading:noon")}
        ${this._field("evening", c.heading.evening, "heading:evening")}
        ${this._field("heading_style (title/subtitle)", c.heading_style, "heading_style")}
        <h3>אייקון</h3>
        ${this._field("mode (static/dynamic)", c.icon.mode, "icon:mode")}
        ${this._iconField("static mdi", "icon:static")}
        ${this._iconField("יום", "icon:day")}
        ${this._iconField("לילה", "icon:night")}
        ${this._field("subtitle_entity", c.subtitle_entity, "subtitle_entity")}
        <h3>רקע</h3>
        ${this._field("color", c.background.color, "background:color")}
        ${this._field("opacity 0-100", c.background.opacity, "background:opacity", "number")}
        <h3>תגים</h3>
        ${badgesHtml}
        <button id="add-badge">+ הוסף תג</button>
      </div>
    `;

    this.querySelectorAll("input[data-bind]").forEach((el) => {
      el.addEventListener("input", (e) => {
        const path = e.target.getAttribute("data-bind").split(":");
        this._setPath(path, e.target.value);
        this._emit();
      });
    });
    this.querySelectorAll("select[data-bind]").forEach((el) => {
      el.addEventListener("change", (e) => {
        const path = e.target.getAttribute("data-bind").split(":");
        this._setPath(path, e.target.value);
        this._emit();
      });
    });
    this.querySelectorAll("ha-entity-picker[data-entity-picker]").forEach((el) => {
      const i = Number(el.getAttribute("data-entity-picker"));
      el.hass = this._hass;
      el.value = this.config.badges[i].entity || "";
      el.addEventListener("value-changed", (e) => {
        this.config.badges[i].entity = e.detail.value;
        this._emit();
      });
    });
    this.querySelectorAll("ha-icon-picker[data-icon-bind]").forEach((el) => {
      const path = el.getAttribute("data-icon-bind").split(":");
      el.hass = this._hass;
      el.value = this._getPath(path) || "";
      el.addEventListener("value-changed", (e) => {
        this._setPath(path, e.detail.value);
        this._emit();
      });
    });
    this.querySelectorAll("button[data-remove]").forEach((el) => {
      el.addEventListener("click", () => {
        this.config.badges.splice(Number(el.getAttribute("data-remove")), 1);
        this._render(); this._emit();
      });
    });
    const addBtn = this.querySelector("#add-badge");
    if (addBtn) addBtn.addEventListener("click", () => {
      this.config.badges = this.config.badges || [];
      this.config.badges.push({ entity: "", icon: "mdi:help-circle", color: "grey", condition: null, tap_action: { action: "more-info" } });
      this._render(); this._emit();
    });
  }

  _setPath(path, value) {
    if (path[0] === "badge") {
      const i = Number(path[1]); const key = path[2];
      const b = this.config.badges[i];
      if (key === "cond_entity") { b.condition = b.condition || {}; b.condition.entity = value; }
      else if (key === "cond_state") { b.condition = b.condition || {}; b.condition.state = value; }
      else if (key === "tap_action") { b.tap_action = { action: value }; }
      else b[key] = value;
    } else if (path.length === 2) {
      this.config[path[0]][path[1]] = path[1] === "opacity" ? Number(value) : value;
    } else {
      this.config[path[0]] = value;
    }
  }
}

customElements.define("top-header-card", TopHeaderCard);
customElements.define("top-header-card-editor", TopHeaderCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "top-header-card",
  name: "Top Header Card",
  description: "כותרת דינמית + שורת תגים עם עורך גרפי"
});
