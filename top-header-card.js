// top-header-card.js
// כרטיס Lovelace מותאם אישית: כותרת דינמית + שורת תגים, עם עורך גרפי מובנה.
// התקנה: Settings > Dashboards > Resources > הוסף קובץ זה כ-JS module.
// שימוש בדשבורד: type: custom:top-header-card

// צבעים: שמות מרשימת הצבעים של HA (red, light-blue, primary...) או hex/rgb ישן
function cssColor(c, fallback = null) {
  if (!c || c === "none") return fallback;
  if (/^(#|rgb|hsl|var\()/.test(c)) return c;
  return `var(--${c}-color)`;
}

// icon_mode של תג:
//   icon    – אייקון שנבחר ידנית
//   entity  – האייקון של היישות (כמו שהוא מופיע ב-HA)
//   picture – התמונה של היישות (person וכו'), ואם אין – האייקון שלה
const ICON_MODES = ["icon", "entity", "picture"];

const norm = (s) => String(s ?? "").trim();

// מספר מהקונפיג; שדה ריק/לא תקין (למשל שנמחק בעורך) = ברירת המחדל
const num = (v, d) => (v === "" || v == null || !Number.isFinite(Number(v)) ? d : Number(v));

// הדגשה בפריסת 2C: [גודל הברכה, גודל השעה]
const EMPHASIS = { clock: ["1.44em", "2.5em"], greeting: ["2em", "1.6em"], balanced: ["1.6em", "2.1em"] };
const DOT_FINISHES = ["solid", "tint", "glass"];

// תאי מידע: כמה אפשר להגדיר, וכמה מוצגים לכל היותר בבת אחת
const MAX_CELLS = 9;
const MAX_VISIBLE_CELLS = 3;

// גופנים עם תמיכה בעברית מ-Google Fonts (נטענים לפי דרישה); ערך אחר = גופן מותקן במכשיר
const GOOGLE_FONTS = {
  "Heebo": "wght@400;500;600;700",
  "Rubik": "wght@400;500;600;700",
  "Assistant": "wght@400;500;600;700",
  "Noto Sans Hebrew": "wght@400;500;600;700",
  "Frank Ruhl Libre": "wght@400;500;700",
  "Alef": "wght@400;700",
  "Karantina": "wght@400;700",
  "Varela Round": "",
  "Secular One": "",
  "Suez One": ""
};

// גופנים בתוך shadow DOM צריכים @font-face במסמך הראשי – לכן ה-link נוסף ל-document.head
function ensureFont(name) {
  if (!(name in GOOGLE_FONTS)) return;
  const id = `the-font-${name.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const axis = GOOGLE_FONTS[name];
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, "+")}${axis ? `:${axis}` : ""}&display=swap`;
  document.head.appendChild(link);
}

// condition של תג: { match: all|any, rules: [...] }
//   כלל יישות:  { entity, operator, state }
//   כלל מיקום:  { type: location, operator, locations: [home | not_home | zone.xxx] } – כמו visibility של HA,
//               נבדק על ה-person שמקושר למשתמש המחובר
// תמיכה לאחור בפורמט הישן של תנאי יחיד: { entity, operator, state }
const isLocationRule = (r) => r?.type === "location";

function conditionRules(cond) {
  if (!cond) return [];
  if (Array.isArray(cond.rules)) return cond.rules.filter((r) => (isLocationRule(r) ? r.locations?.length : r?.entity));
  return cond.entity ? [cond] : [];
}

class TopHeaderCard extends HTMLElement {
  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    const subs = config.subtitle_entities || (config.subtitle_entity ? [config.subtitle_entity] : []);
    this.config = {
      heading: { mode: "dynamic", static: "", morning: "בוקר טוב {{user}}", noon: "צהריים טובים {{user}}", evening: "ערב טוב {{user}}", ...(config.heading || {}) },
      heading_style: config.heading_style || "title",
      icon: { mode: "dynamic", static: "mdi:home", day: "mdi:white-balance-sunny", night: "mdi:moon-waning-crescent", ...(config.icon || {}) },
      subtitle_entities: Array.isArray(subs) ? subs : [subs],
      subtitle_show_names: !!config.subtitle_show_names,
      background: { color: "#1c1c1c", opacity: 100, ...(config.background || {}) },
      badges: config.badges || [],
      // פריסת 2C ("טורים") – בלוק טיפוגרפי שטוח; classic = ההתנהגות הקיימת
      layout: config.layout === "columns" ? "columns" : "classic",
      kicker: { enabled: true, entity: "sensor.jewish_calendar_date", day_entity: "sensor.day_of_week", morning: "בוקר", noon: "צהריים", evening: "ערב", ...(config.kicker || {}) },
      clock: { enabled: true, entity: "sensor.time", ...(config.clock || {}) },
      cells: Array.isArray(config.cells) ? config.cells.slice(0, MAX_CELLS) : [],
      // כשמוגדרים יותר תאים ממה שמוצג – מתחלפים: sequential (לפי הסדר) או random
      rotation: { visible: MAX_VISIBLE_CELLS, mode: "sequential", interval: 10, ...(config.rotation || {}) },
      font_family: config.font_family || "",
      rule: { width: 2, opacity: 82, style: "solid", ...(config.rule || {}) },
      // קווים אנכיים בין התאים
      cells_rule: { width: 2, opacity: 28, style: "solid", ...(config.cells_rule || {}) },
      // טיפוגרפיה בפריסת 2C (לא "type" – זה המפתח של סוג הכרטיס)
      typography: { scale: 98, kicker_size: 13, emphasis: "clock", greet_weight: 700, clock_weight: 700, ...(config.typography || {}) },
      // גימור העיגול בתג: glass | tint | solid (ההתנהגות הישנה)
      badge_style: { dot_finish: "glass", dot_tint: 40, ...(config.badge_style || {}) },
      ink: config.ink || "none"
    };
    this._badgeKey = null;
    this._cellsKey = null;
    this._visibleIdx = null;
    this._rotationOffset = 0;
    this._templates = this._templates || new Map();
    this._buildDom();
    this._update();
    this._startRotation();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  connectedCallback() {
    this._update();
    this._startRotation();
  }

  disconnectedCallback() {
    this._syncTemplates();
    this._stopRotation();
  }

  getCardSize() { return this.config?.layout === "columns" ? 3 : 2; }

  static getConfigElement() { return document.createElement("top-header-card-editor"); }

  static getStubConfig() {
    return {
      type: "custom:top-header-card",
      layout: "classic",
      heading: { mode: "dynamic", morning: "בוקר טוב {{user}}", noon: "צהריים טובים {{user}}", evening: "ערב טוב {{user}}" },
      heading_style: "title",
      icon: { mode: "dynamic", day: "mdi:white-balance-sunny", night: "mdi:moon-waning-crescent" },
      background: { color: "none", opacity: 100 },
      badges: []
    };
  }

  _buildDom() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 16px 14px; border: none; box-shadow: none; }
        .heading-line { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
        .heading-line span { font-size:17px; font-weight:500; color:var(--primary-text-color); }
        .heading-line ha-icon { --mdc-icon-size:20px; }
        .subtitle { font-size:12px; color:var(--secondary-text-color); margin:0 0 12px 28px; }
        .subtitle .sep { opacity:.5; margin:0 6px; }
        .badge-row { display:flex; gap:10px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none; }
        .badge-row::-webkit-scrollbar { display:none; }
        .badge { flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:3px; cursor:pointer; min-width:44px; }
        .badge-dot { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-sizing:border-box; overflow:hidden; }
        .badge-dot ha-icon, .badge-dot ha-state-icon { --mdc-icon-size:20px; color:#111; }
        /* תמונה: הטבעת הצבעונית נשארת כמו קודם, בלי גימור */
        .badge-dot.picture { padding:2px; background:var(--the-badge-color); }
        .badge-dot img { width:100%; height:100%; border-radius:50%; object-fit:cover; display:block; }
        /* גימור העיגול. בלי color-mix/backdrop-filter (דפדפן ישן) החוק נופל ל-#111 / בלי blur – עדיין קריא */
        .badge-dot.solid { background:var(--the-badge-color); }
        .badge-dot.tint { background:color-mix(in srgb, var(--the-badge-color) var(--the-dot-tint, 40%), transparent);
                          border:1px solid color-mix(in srgb, var(--the-badge-color) 55%, transparent); }
        .badge-dot.glass {
          background:radial-gradient(circle at 34% 24%, rgba(255,255,255,.55), rgba(255,255,255,.12) 58%),
                     color-mix(in srgb, var(--the-badge-color) var(--the-dot-glass, 14%), transparent);
          border:1px solid rgba(255,255,255,.62);
          box-shadow:inset 0 1px 1px rgba(255,255,255,.65), inset 0 -2px 6px rgba(0,0,0,.08);
          -webkit-backdrop-filter:blur(8px) saturate(1.4);
          backdrop-filter:blur(8px) saturate(1.4);
        }
        /* האייקון נושא את הצבע; 50% מול כמעט-שחור שומר על ניגודיות גם בצבעים בהירים (amber/yellow) */
        .badge-dot.glass ha-icon, .badge-dot.glass ha-state-icon,
        .badge-dot.tint ha-icon, .badge-dot.tint ha-state-icon { color:color-mix(in srgb, var(--the-badge-color) 50%, #1a1a1a); }
        /* מצב כהה לפי ערכת הנושא של HA (לא לפי הגדרת המכשיר) */
        ha-card.dark .badge-dot.glass {
          background:radial-gradient(circle at 34% 24%, rgba(255,255,255,.18), rgba(255,255,255,.04) 58%),
                     color-mix(in srgb, var(--the-badge-color) var(--the-dot-glass, 14%), transparent);
          border-color:rgba(255,255,255,.22);
        }
        ha-card.dark .badge-dot.glass ha-icon, ha-card.dark .badge-dot.glass ha-state-icon,
        ha-card.dark .badge-dot.tint ha-icon, ha-card.dark .badge-dot.tint ha-state-icon { color:color-mix(in srgb, var(--the-badge-color) 75%, #fff); }
        /* תג אליפסה: עיגול + שם */
        .badge.pill { flex-direction:row; gap:8px; height:44px; border-radius:22px; padding-inline-end:14px; max-width:200px;
                      background:color-mix(in srgb, var(--the-badge-color) 18%, transparent); }
        .badge.pill .badge-dot { flex:0 0 auto; }
        .pill-text { display:flex; flex-direction:column; min-width:0; line-height:1.2; }
        .pill-name { font-size:14.5px; font-weight:600; color:var(--primary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pill-state { font-size:12px; font-weight:500; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .badge-label { font-size:10px; line-height:1.2; color:var(--secondary-text-color); white-space:nowrap; max-width:72px; overflow:hidden; text-overflow:ellipsis; }

        /* hidden חייב לגבור על display של המחלקות */
        [hidden] { display:none !important; }

        /* פריסת 2C */
        ha-card.flat { background:none !important; box-shadow:none; border:none; border-radius:0; padding:8px 4px 0; }
        /* כל המידות ב-em מול סקאלה אחת */
        .cols { color:var(--the-ink); font-size:calc(var(--the-scale, 1) * 16px); }
        .c-kicker { font-size:var(--the-small, .8125em); font-weight:600; letter-spacing:.04em; color:var(--the-kicker); margin-bottom:5px; }
        .c-head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; padding-bottom:9px;
                  border-bottom:var(--the-rule-width, 2px) var(--the-rule-style, solid) var(--the-rule); }
        .c-greet { font-size:var(--the-greet, 1.44em); font-weight:var(--the-greet-w, 700); line-height:1.1; min-width:0; overflow-wrap:anywhere; }
        .c-clock { flex:0 0 auto; font-size:var(--the-clock, 2.5em); font-weight:var(--the-clock-w, 700); line-height:.9; white-space:nowrap; direction:ltr;
                   font-variant-numeric:tabular-nums; letter-spacing:-.02em; }
        .c-cells { display:grid; grid-template-columns:repeat(var(--the-cols, 3), minmax(0, 1fr)); }
        .c-cell { display:flex; flex-direction:column; gap:2px; padding:9px; min-width:0; border-inline-end:var(--the-div-border, none); }
        .c-cell:first-child { padding-inline-start:0; }
        .c-cell:last-child { padding-inline-end:0; border-inline-end:none; }
        .c-cell .k { font-size:var(--the-small, .8125em); font-weight:600; letter-spacing:.03em; color:var(--the-soft); }
        .c-cell .v { font-size:1em; font-weight:600; overflow-wrap:anywhere; }
        ha-card.flat .badge-row { padding-top:10px; }
        .c-cells.swap { animation:the-swap .45s ease; }
        @keyframes the-swap { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:none; } }
      </style>
      <ha-card>
        <div class="classic" id="classic">
          <div class="heading-line"><ha-icon id="h-icon"></ha-icon><span id="h-text"></span></div>
          <div class="subtitle" id="h-sub"></div>
        </div>
        <div class="cols" id="cols" hidden>
          <div class="c-kicker" id="c-kicker"></div>
          <div class="c-head">
            <div class="c-greet" id="c-greet"></div>
            <div class="c-clock" id="c-clock"></div>
          </div>
          <div class="c-cells" id="c-cells"></div>
        </div>
        <div class="badge-row" id="badge-row"></div>
      </ha-card>
    `;
  }

  // חלק היום: morning | noon | evening
  _dayPart() {
    const hour = new Date().getHours();
    if (hour >= 18 || hour < 5) return "evening";
    if (hour < 12) return "morning";
    return "noon";
  }

  _computeHeading() {
    const h = this.config.heading;
    const text = h.mode === "static" ? h.static : h[this._dayPart()];
    // {{user}} – שם המשתמש המחובר
    return String(text ?? "").replace(/\{\{\s*user\s*\}\}/g, this._hass?.user?.name || "");
  }

  _computeIcon() {
    const ic = this.config.icon;
    if (ic.mode === "static") return ic.static;
    const sun = this._hass?.states?.["sun.sun"];
    return sun && sun.state === "above_horizon" ? ic.day : ic.night;
  }

  _checkVisible(badge) {
    // משתמשים: התג מוצג רק למשתמש המחובר שמקושר לאחד מה-person שנבחרו
    if (badge.users?.length) {
      const uid = this._hass?.user?.id;
      const allowed = badge.users.some((p) => this._hass?.states?.[p]?.attributes?.user_id === uid);
      if (!allowed) return false;
    }
    // תנאים: כמה כללים, עם "וגם" (all) או "או" (any)
    const rules = conditionRules(badge.condition);
    if (!rules.length) return true;
    const results = rules.map((r) => this._checkRule(r));
    return badge.condition.match === "any" ? results.some(Boolean) : results.every(Boolean);
  }

  _checkRule(rule) {
    if (isLocationRule(rule)) return this._checkLocation(rule);
    const st = this._hass?.states?.[rule.entity];
    if (!st) return false;
    const equal = norm(st.state) === norm(rule.state);
    return rule.operator === "is_not" ? !equal : equal;
  }

  // מיקום המשתמש המחובר: person עם user_id תואם; מצב ה-person בזון הוא שם הזון
  _checkLocation(rule) {
    const states = this._hass?.states || {};
    const uid = this._hass?.user?.id;
    const personId = Object.keys(states).find((id) => id.startsWith("person.") && states[id].attributes?.user_id === uid);
    if (!personId) return false;
    const where = norm(states[personId].state);
    const inside = rule.locations.some((loc) => {
      if (loc === "home" || loc === "not_home") return where === loc;
      return where === norm(states[loc]?.attributes?.friendly_name);
    });
    return rule.operator === "is_not" ? !inside : inside;
  }

  _formatState(stateObj) {
    if (!stateObj) return "";
    try { return this._hass.formatEntityState?.(stateObj) ?? stateObj.state; }
    catch (e) { return stateObj.state; }
  }

  _handleTap(badge) {
    if (!badge.entity) return;
    this.dispatchEvent(new CustomEvent("hass-action", {
      detail: { config: { entity: badge.entity, tap_action: badge.tap_action || { action: "more-info" } }, action: "tap" },
      bubbles: true, composed: true
    }));
  }

  _update() {
    if (!this._hass || !this.config || !this.shadowRoot) return;
    const root = this.shadowRoot;
    const columns = this.config.layout === "columns";

    root.getElementById("classic").hidden = columns;
    root.getElementById("cols").hidden = !columns;
    root.querySelector("ha-card").classList.toggle("flat", columns);
    root.querySelector("ha-card").classList.toggle("dark", !!this._hass.themes?.darkMode);
    this._applyFont();
    this._syncTemplates();

    if (columns) {
      root.querySelector("ha-card").style.background = "";
      this._renderColumns();
    } else {
      this._updateClassic();
    }

    this._renderBadges();
  }

  _updateClassic() {
    const root = this.shadowRoot;
    const bg = this.config.background;
    const base = cssColor(bg.color, "var(--ha-card-background, var(--card-background-color))");
    const op = bg.opacity ?? 100;
    root.querySelector("ha-card").style.background = op >= 100 ? base : `color-mix(in srgb, ${base} ${op}%, transparent)`;

    const hIcon = root.getElementById("h-icon");
    hIcon.setAttribute("icon", this._computeIcon());
    hIcon.style.color = cssColor(this.config.icon.color, "#f5d76e");
    root.getElementById("h-text").textContent = this._computeHeading();
    root.getElementById("h-text").style.fontWeight = this.config.heading_style === "subtitle" ? "400" : "500";

    const subEl = root.getElementById("h-sub");
    const parts = this.config.subtitle_entities
      .map((id) => this._hass.states[id])
      .filter(Boolean)
      .map((st) => {
        const val = this._formatState(st);
        return this.config.subtitle_show_names ? `${st.attributes.friendly_name || st.entity_id}: ${val}` : val;
      });
    if (parts.length) {
      subEl.replaceChildren(...parts.flatMap((p, i) => {
        const t = document.createTextNode(p);
        if (!i) return [t];
        const sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "|";
        return [sep, t];
      }));
      subEl.style.display = "block";
    } else {
      subEl.style.display = "none";
    }
  }

  // ---- פריסת 2C ----

  _renderColumns() {
    if (!this._hass || !this.shadowRoot) return;
    const root = this.shadowRoot;
    const c = this.config;
    const cols = root.getElementById("cols");

    // צבעים: ברירת המחדל נגזרת מערכת הנושא, כך שהטקסט קריא גם במצב בהיר וגם בכהה
    const ink = cssColor(c.ink, "var(--primary-text-color)");
    const soft = c.ink && c.ink !== "none" ? ink : "var(--secondary-text-color)";
    cols.style.setProperty("--the-ink", ink);
    cols.style.setProperty("--the-soft", soft);
    cols.style.setProperty("--the-kicker", cssColor(c.kicker.color, soft));
    // קווים: צבע מפורש גובר; אחרת צבע הטקסט באטימות שנבחרה (100% = בלי color-mix, תואם דפדפנים ישנים)
    const inkFor = (pct) => (pct >= 100 ? ink : `color-mix(in srgb, ${ink} ${pct}%, transparent)`);
    const lineStyle = (s, allowNone) => (["solid", "dashed", "dotted"].includes(s) || (allowNone && s === "none") ? s : "solid");
    cols.style.setProperty("--the-rule", cssColor(c.rule.color, inkFor(num(c.rule.opacity, 82))));
    cols.style.setProperty("--the-rule-width", `${num(c.rule.width, 2) || 2}px`);
    cols.style.setProperty("--the-rule-style", lineStyle(c.rule.style));
    const cr = c.cells_rule;
    const crStyle = lineStyle(cr.style, true);
    const crWidth = num(cr.width, 2);
    cols.style.setProperty("--the-div-border", crStyle === "none" || crWidth <= 0
      ? "none"
      : `${crWidth}px ${crStyle} ${cssColor(cr.color, inkFor(num(cr.opacity, 28)))}`);

    // טיפוגרפיה
    const t = c.typography;
    cols.style.setProperty("--the-scale", String(Math.min(Math.max(num(t.scale, 98), 50), 200) / 100));
    cols.style.setProperty("--the-small", `${(num(t.kicker_size, 13) / 16).toFixed(3)}em`);
    cols.style.setProperty("--the-greet-w", String(num(t.greet_weight, 700)));
    cols.style.setProperty("--the-clock-w", String(num(t.clock_weight, 700)));
    const [greetSize, clockSize] = EMPHASIS[t.emphasis] || EMPHASIS.clock;
    cols.style.setProperty("--the-greet", greetSize);
    cols.style.setProperty("--the-clock", clockSize);

    const kickerEl = root.getElementById("c-kicker");
    kickerEl.hidden = !c.kicker.enabled;
    if (c.kicker.enabled) {
      const date = this._hass.states[c.kicker.entity];
      const dateText = date && !["unknown", "unavailable"].includes(date.state) ? date.state : "";
      const day = c.kicker.day_entity && this._hass.states[c.kicker.day_entity];
      const dayText = day && !["unknown", "unavailable"].includes(day.state) ? day.state : c.kicker[this._dayPart()];
      kickerEl.textContent = [dayText, dateText].filter(Boolean).join(" · ");
    }

    root.getElementById("c-greet").textContent = this._computeHeading();

    const clockEl = root.getElementById("c-clock");
    clockEl.hidden = !c.clock.enabled;
    if (c.clock.enabled) clockEl.textContent = this._clockText();

    // תאים – נבנים מחדש רק כשתווית או ערך השתנו
    const cells = this._visibleCells().map((cell) => {
      const val = this._cellValue(cell);
      const name = typeof val === "object" ? val.name : "";
      const text = typeof val === "object" ? val.text : val;
      const textLines = String(text ?? "").split("\n");
      // שם היישות: בשורת התווית כשאין תווית; אחרת שורה ראשונה של הערך
      return cell.label ? [cell.label, [name, ...textLines].filter(Boolean)] : [name, textLines];
    });
    const key = JSON.stringify(cells);
    if (key === this._cellsKey) return;
    this._cellsKey = key;

    const cellsEl = root.getElementById("c-cells");
    // אנימציית החלפה רק כשהתחלפו התאים, לא כשערך השתנה
    if (this._swapPending) {
      this._swapPending = false;
      cellsEl.classList.remove("swap");
      void cellsEl.offsetWidth;
      cellsEl.classList.add("swap");
    }
    cellsEl.hidden = !cells.length;
    cellsEl.style.setProperty("--the-cols", String(Math.max(cells.length, 1)));
    cellsEl.replaceChildren(...cells.map(([label, lines]) => {
      const cell = document.createElement("div");
      cell.className = "c-cell";
      const k = document.createElement("div");
      k.className = "k";
      k.textContent = label;
      cell.append(k);
      lines.forEach((line) => {
        const v = document.createElement("div");
        v.className = "v";
        v.textContent = line;
        cell.append(v);
      });
      return cell;
    }));
  }

  _applyFont() {
    const font = norm(this.config.font_family);
    if (font === this._appliedFont) return;
    this._appliedFont = font;
    if (font) ensureFont(font);
    this.shadowRoot.querySelector("ha-card").style.fontFamily = font
      ? `"${font.replace(/"/g, "")}", var(--ha-font-family-body, Roboto), sans-serif`
      : "";
  }

  // ---- החלפת תאים ----

  _visibleCount() {
    const n = Number(this.config.rotation.visible);
    return Math.min(Math.max(Number.isFinite(n) ? Math.round(n) : MAX_VISIBLE_CELLS, 1), MAX_VISIBLE_CELLS);
  }

  _visibleCells() {
    const all = this.config.cells;
    const count = this._visibleCount();
    if (all.length <= count) return all;
    if (!this._visibleIdx || this._visibleIdx.some((i) => i >= all.length) || this._visibleIdx.length !== count) {
      this._visibleIdx = this._pickCells(0);
    }
    return this._visibleIdx.map((i) => all[i]);
  }

  _pickCells(offset) {
    const n = this.config.cells.length;
    const count = this._visibleCount();
    if (this.config.rotation.mode !== "random") {
      return Array.from({ length: count }, (_, k) => (offset + k) % n);
    }
    // אקראי: בוחרים סט שונה מהנוכחי (כשאפשר), ומציגים לפי הסדר שבהגדרות
    const current = JSON.stringify(this._visibleIdx || []);
    let pick;
    for (let tries = 0; tries < 6; tries++) {
      const idx = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      pick = idx.slice(0, count).sort((a, b) => a - b);
      if (JSON.stringify(pick) !== current) break;
    }
    return pick;
  }

  _startRotation() {
    this._stopRotation();
    const c = this.config;
    if (!c || !this.isConnected || c.layout !== "columns" || c.cells.length <= this._visibleCount()) return;
    const seconds = Math.max(Number(c.rotation.interval) || 10, 3);
    this._rotationTimer = setInterval(() => {
      const count = this._visibleCount();
      this._rotationOffset = (this._rotationOffset + count) % c.cells.length;
      this._visibleIdx = this._pickCells(this._rotationOffset);
      this._swapPending = true;
      this._renderColumns();
    }, seconds * 1000);
  }

  _stopRotation() {
    if (this._rotationTimer) clearInterval(this._rotationTimer);
    this._rotationTimer = null;
  }

  _clockText() {
    const st = this._hass.states[this.config.clock.entity];
    if (st && /^\d{1,2}:\d{2}$/.test(st.state)) return st.state;
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  _cellValue(cell) {
    const states = this._hass.states;
    const empty = cell.empty_text || "—";

    if (cell.source === "persons_home") {
      const names = Object.keys(states)
        .filter((id) => id.startsWith("person.") && states[id].state === "home")
        .map((id) => states[id].attributes?.friendly_name || id);
      return names.length ? names.join(", ") : (cell.empty_text || "אין אף אחד");
    }

    if (cell.source === "sun_next_setting") {
      const raw = states["sun.sun"]?.attributes?.next_setting || states["sensor.sun_next_setting"]?.state;
      const d = raw ? new Date(raw) : null;
      if (!d || isNaN(d)) return empty;
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }

    if (cell.source === "template") {
      // ירידת שורה בתוצאת התבנית = שורה חדשה בתא; כשיש כמה שורות, הראשונה מתנהגת כמו שם יישות
      const lines = String(this._templates.get(norm(cell.template))?.value ?? "")
        .split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return empty;
      if (lines.length === 1) return lines[0];
      return { name: lines[0], text: lines.slice(1).join("\n") };
    }

    // entity (ברירת מחדל)
    const st = states[cell.entity];
    if (!st) return empty;
    // show: אילו חלקים מהיישות להציג; ברירת מחדל = מצב בלבד
    const show = Array.isArray(cell.show) && cell.show.length ? cell.show : ["state"];
    const name = show.includes("name") ? (st.attributes?.friendly_name || cell.entity) : "";
    const parts = [];
    if (show.includes("state")) parts.push(this._cellState(st, cell));
    if (show.includes("last_changed")) parts.push(this._relativeTime(st.last_changed));
    if (show.includes("last_updated")) parts.push(this._relativeTime(st.last_updated));
    const text = parts.filter(Boolean).join(" · ");
    // השם מוחזר בנפרד – מוצג בשורה משלו, והמצב/הזמן בשורה שמתחתיו
    return { name, text: text || (name ? "" : empty) };
  }

  _cellState(st, cell) {
    const num = Number(st.state);
    if (st.state !== "" && !isNaN(num) && (cell.round != null && cell.round !== "" || cell.suffix)) {
      const text = cell.round != null && cell.round !== "" ? num.toFixed(Number(cell.round)) : st.state;
      return `${text}${cell.suffix || ""}`;
    }
    return this._formatState(st);
  }

  // "לפני 5 דקות" – לפי שפת המשתמש ב-HA
  _relativeTime(iso) {
    const t = iso ? new Date(iso).getTime() : NaN;
    if (isNaN(t)) return "";
    const sec = Math.round((t - Date.now()) / 1000);
    const abs = Math.abs(sec);
    const rtf = new Intl.RelativeTimeFormat(this._hass.locale?.language || "he", { numeric: "auto" });
    if (abs < 60) return rtf.format(0, "minute");
    if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
    return rtf.format(Math.round(sec / 86400), "day");
  }

  // מינויים ל-render_template (כמו כרטיס Markdown) – בלי eval; נפתחים/נסגרים לפי התאים הפעילים
  _syncTemplates() {
    if (!this._templates) return;
    const wanted = new Set(
      this.isConnected && this._hass && this.config?.layout === "columns"
        ? this.config.cells.filter((c) => c.source === "template" && norm(c.template)).map((c) => norm(c.template))
        : []
    );
    for (const [tpl, entry] of this._templates) {
      if (wanted.has(tpl)) continue;
      entry.dead = true;
      if (entry.unsub) Promise.resolve().then(entry.unsub).catch(() => {});
      this._templates.delete(tpl);
    }
    for (const tpl of wanted) {
      if (this._templates.has(tpl)) continue;
      const entry = { value: "", unsub: null, dead: false };
      this._templates.set(tpl, entry);
      this._hass.connection.subscribeMessage((msg) => {
        if (entry.dead) return;
        entry.value = msg.error ? "" : String(msg.result ?? "");
        this._renderColumns();
      }, {
        type: "render_template",
        template: tpl,
        variables: { user: this._hass.user?.name },
        strict: false
      }).then((unsub) => {
        if (entry.dead) unsub().catch?.(() => {});
        else entry.unsub = unsub;
      }).catch(() => {
        entry.value = "";
      });
    }
  }

  // מחשב איך תג ייראה עכשיו: צבע/אייקון/תווית לפי המצב שהוגדר, אחרת ברירת המחדל של התג
  _badgeView(b) {
    const stateObj = this._hass.states[b.entity];
    const match = stateObj && (b.states || []).find((s) => norm(s.state) === norm(stateObj.state));
    const mode = ICON_MODES.includes(b.icon_mode) ? b.icon_mode : "icon";
    const pic = mode === "picture" && stateObj?.attributes?.entity_picture
      ? this._hass.hassUrl(stateObj.attributes.entity_picture) : null;
    return {
      stateObj,
      mode,
      pic,
      icon: match?.icon || (mode === "icon" ? b.icon : null),
      color: cssColor(match?.color || b.color, "var(--grey-color)"),
      label: b.show_state ? (match?.label || this._formatState(stateObj)) : "",
      title: stateObj?.attributes?.friendly_name || b.entity || "",
      // display: circle (עיגול בלבד) | pill (עיגול + שם)
      pill: b.display === "pill",
      name: norm(b.name) || stateObj?.attributes?.friendly_name || b.entity || ""
    };
  }

  _renderBadges() {
    const row = this.shadowRoot.getElementById("badge-row");
    const items = (this.config.badges || []).filter((b) => this._checkVisible(b)).map((b) => [b, this._badgeView(b)]);
    const bs = this.config.badge_style;
    const finish = DOT_FINISHES.includes(bs.dot_finish) ? bs.dot_finish : "glass";
    const tint = Math.min(Math.max(num(bs.dot_tint, 40), 0), 100);

    // בונים מחדש רק כשמשהו שמשפיע על התצוגה השתנה – מונע הבהוב של תמונות
    const key = JSON.stringify([finish, tint, items.map(([b, v]) => [b.entity, v.mode, v.pic, v.icon, v.color, v.label, v.pill, v.pill && v.name, v.stateObj?.state, v.stateObj?.attributes?.icon])]);
    if (key === this._badgeKey) {
      row.querySelectorAll("ha-state-icon").forEach((el) => { el.hass = this._hass; });
      return;
    }
    this._badgeKey = key;

    row.innerHTML = "";
    items.forEach(([b, v]) => {
      const wrap = document.createElement("div");
      wrap.className = v.pill ? "badge pill" : "badge";
      wrap.title = v.title;
      wrap.style.setProperty("--the-badge-color", v.color);
      wrap.style.setProperty("--the-dot-tint", `${tint}%`);
      // בזכוכית הצבע רק נרמז – האייקון נושא אותו
      wrap.style.setProperty("--the-dot-glass", `${Math.round(tint * 0.35)}%`);

      const dot = document.createElement("div");
      dot.className = "badge-dot";
      // תמונה מקבלת מחלקת picture במקום גימור
      if (!v.pic) dot.classList.add(finish);

      if (v.pic) {
        dot.classList.add("picture");
        const img = document.createElement("img");
        img.src = v.pic;
        img.alt = v.title;
        dot.appendChild(img);
      } else if (!v.icon && v.stateObj && customElements.get("ha-state-icon")) {
        const icon = document.createElement("ha-state-icon");
        icon.hass = this._hass;
        icon.stateObj = v.stateObj;
        dot.appendChild(icon);
      } else {
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", v.icon || v.stateObj?.attributes?.icon || b.icon || "mdi:help-circle");
        dot.appendChild(icon);
      }
      wrap.appendChild(dot);

      if (v.pill) {
        // באליפסה השם והמצב נמצאים בתוך התג, ליד העיגול
        const text = document.createElement("div");
        text.className = "pill-text";
        const name = document.createElement("div");
        name.className = "pill-name";
        name.textContent = v.name;
        text.appendChild(name);
        if (v.label) {
          const st = document.createElement("div");
          st.className = "pill-state";
          st.textContent = v.label;
          text.appendChild(st);
        }
        wrap.appendChild(text);
      } else if (v.label) {
        const lbl = document.createElement("div");
        lbl.className = "badge-label";
        lbl.textContent = v.label;
        wrap.appendChild(lbl);
      }

      wrap.addEventListener("click", () => this._handleTap(b));
      row.appendChild(wrap);
    });
  }
}

// ---------------------------------------------------------------------------
// עורך גרפי – מבוסס ha-form, כך שהבוררים (אייקונים, יישויות, צבעים, פעולות) הם של HA עצמו
// ---------------------------------------------------------------------------

// ha-form והבוררים נטענים ב-HA רק לפי דרישה; טעינת עורך של כרטיס מובנה מבטיחה שהם זמינים
async function ensureHaForm() {
  if (customElements.get("ha-form") && customElements.get("hui-action-editor")) return;
  try {
    const helpers = await window.loadCardHelpers?.();
    const card = await helpers?.createCardElement({ type: "button", entity: "sun.sun" });
    await card?.constructor?.getConfigElement?.();
  } catch (e) { /* ממשיכים גם אם לא הצליח */ }
  await customElements.whenDefined("ha-form");
}

// תרגום העורך: תוויות, אפשרויות, כותרות ועזרה. מפתחות ה-YAML וערכי האפשרויות נשארים באנגלית בכל שפה.
// מפתחות בלי תחילית = שם שדה ב-ha-form; opt_ = אפשרות בבורר; sec_ = כותרת מקטע.
// שפה חדשה = אובייקט נוסף כאן; מפתח חסר נופל חזרה לאנגלית.
const I18N = {
  en: {
    mode: "Mode",
    static: "Static",
    morning: "Morning",
    noon: "Afternoon",
    evening: "Evening",
    heading_style: "Heading style",
    day: "Day icon",
    night: "Night icon",
    subtitle_entities: "Subtitle entities (separated by |)",
    subtitle_show_names: "Show entity name before the value",
    color: "Color",
    opacity: "Opacity",
    entity: "Entity",
    icon_mode: "Icon source",
    icon: "Icon",
    state: "State",
    label: "Label",
    show_state: "Show state text (below the circle / inside the pill)",
    operator: "Condition",
    users: "Show only to users (empty = everyone)",
    tap_action: "Tap action",
    layout: "Layout",
    cells: "Info cells",
    source: "Value source",
    round: "Decimal places",
    suffix: "Suffix",
    empty_text: "Text when empty",
    template: "Template (Jinja)",
    kicker: "Kicker line",
    day_entity: "Day-of-week sensor (empty = morning/afternoon/evening)",
    clock: "Clock",
    rule: "Divider line",
    ink: "Text color (empty = theme)",
    enabled: "Show",
    width: "Width",
    match: "How to combine conditions",
    type: "Condition type",
    locations: "Locations",
    font_family: "Font",
    display: "Badge display",
    name: "Name (empty = entity name)",
    visible: "Cells shown at once",
    interval: "Rotate every (seconds)",
    show: "What to show (in order: name · state · time)",
    typography: "Typography",
    scale: "Overall size",
    kicker_size: "Kicker & label size",
    emphasis: "Emphasis",
    greet_weight: "Greeting weight",
    clock_weight: "Clock weight",
    cells_rule: "Cell dividers",
    style: "Line style",
    badge_style: "Badge circle style",
    dot_finish: "Finish",
    dot_tint: "Color intensity",

    opt_dynamic: "Dynamic (by time of day)",
    opt_static: "Static",
    opt_font_theme: "Theme default",
    opt_layout_classic: "Classic (icon + subtitle)",
    opt_layout_columns: "Columns (2C)",
    opt_line_solid: "Solid",
    opt_line_dashed: "Dashed",
    opt_line_dotted: "Dotted",
    opt_line_none: "No line",
    opt_finish_glass: "Frosted glass",
    opt_finish_tint: "Translucent color",
    opt_finish_solid: "Solid color (classic)",
    opt_emph_clock: "Clock stands out",
    opt_emph_greeting: "Greeting stands out",
    opt_emph_balanced: "Balanced",
    opt_style_title: "Title",
    opt_style_subtitle: "Subtitle",
    opt_display_circle: "Circle only",
    opt_display_pill: "Circle + name (pill)",
    opt_icon_icon: "Custom icon",
    opt_icon_entity: "Entity icon",
    opt_icon_picture: "Entity picture",
    opt_match_all: "All conditions are met (AND)",
    opt_match_any: "At least one condition is met (OR)",
    opt_op_is: "is",
    opt_op_is_not: "is not",
    opt_rule_entity: "Entity state",
    opt_rule_location: "Logged-in user's location",
    opt_loc_home: "Home",
    opt_loc_not_home: "Away",
    opt_rot_sequential: "In order",
    opt_rot_random: "Random",
    opt_src_entity: "Entity",
    opt_src_persons_home: "Who's home",
    opt_src_sun_next_setting: "Next sunset",
    opt_src_template: "Template",
    opt_show_name: "Name",
    opt_show_state: "State",
    opt_show_last_changed: "Last changed",
    opt_show_last_updated: "Last updated",
    unit_seconds: "s",

    sec_heading: "Heading",
    sec_icon: "Heading icon",
    sec_subtitle: "Subtitle",
    sec_background: "Background",
    sec_badge_style: "Badge circle style",
    sec_clock: "Clock",
    sec_typography: "Typography",
    sec_kicker: "Kicker line (weekday · date)",
    sec_colors: "Colors & lines",
    sec_rule: "Main divider",
    sec_cells_rule: "Cell dividers",

    // עזרה מתחת לשדות: help_<שם השדה>, או מפתח מפורש (helper) כששם השדה חוזר בכמה מקומות
    help_layout: "Classic: icon, heading and a subtitle row. Columns (2C): greeting, clock and info cells.",
    help_font_family: "Google fonts with Hebrew support load automatically. You can also type the name of a font installed on the device.",
    help_mode_heading: "Dynamic: morning 05:00–12:00, afternoon 12:00–18:00, evening 18:00–05:00.",
    help_mode_icon: "Dynamic: the day icon while the sun is above the horizon (sun.sun), otherwise the night icon.",
    help_clock_entity: "A sensor with an HH:MM value (e.g. sensor.time). If unavailable, the device time is used.",
    help_kicker_entity: "Date text shown after the weekday (e.g. sensor.jewish_calendar_date).",
    help_day_entity: "If empty or unavailable, the morning/afternoon/evening text below is shown instead.",
    help_scale: "Scales all text in the header together.",
    help_emphasis: "Which one is larger: the greeting or the clock.",
    help_greet_weight: "400 = regular · 700 = bold",
    help_clock_weight: "400 = regular · 700 = bold",
    help_rule_opacity: "Used when no color is chosen: the text color at this opacity.",
    help_cells_rule_width: "0 = no lines between cells.",
    help_dot_finish: "How the badge circle is filled. Does not apply to entity pictures.",
    help_dot_tint: "How strong the badge color is inside the circle.",
    help_display: "Pill: the name (and state) appear next to the circle.",
    help_icon_mode: "Entity picture: e.g. a person's photo. If there is no picture, the entity icon is shown.",
    help_badge_color: "Circle and icon color. A color set for a state overrides it.",
    help_users: "The badge is shown only to HA users linked to the selected people.",
    help_locations: "Checked against the person linked to the logged-in user. Zones are matched by name.",
    help_state_row_state: "When the entity is in this state, the styling below replaces the badge defaults.",
    help_state_row_label: "Replaces the state text (requires \"Show state text\").",
    help_interval: "Minimum 3 seconds.",
    help_cell_label: "Small title above the value. Empty = entity name (when \"Name\" is shown).",
    help_source: "Who's home: names of people currently home. Next sunset: time from sun.sun.",
    help_show: "Nothing selected = state only.",
    help_round: "Numeric states only. Empty = HA's own formatting.",
    help_suffix: "Added after the number, e.g. ° or %. Numeric states only.",
    help_empty_text: "Shown when there is no value: missing entity, empty template or nobody home.",
    help_user_tokens: "You can use {{user}} – replaced with the logged-in user's name",
    help_template: "e.g. {{ states('sensor.x') }} – the user variable is available. Several lines: the first one is shown as the name.",
    cells_title: "Info cells (up to {max})",
    cells_help: "Up to {visible} cells are shown. When more are configured, they rotate.",
    add_cell: "Add cell",
    remove_cell: "Remove cell",
    cell_n: "Cell {n}",
    badges_title: "Badges",
    add_badge: "Add badge",
    remove_badge: "Remove badge",
    badge_n: "Badge {n}",
    move_up: "Move up",
    move_down: "Move down",
    conditions_title: "Visibility conditions",
    conditions_help: "The badge is shown only when the conditions are met. No conditions = always shown.",
    add_condition: "Add condition",
    remove_condition: "Remove condition",
    states_title: "Styling by state",
    states_help: "When the entity is in this state, its color, icon and label override the badge defaults. Empty field = default.",
    add_state: "Add state",
    remove_state: "Remove state",
    card_description: "Dynamic header with a badge row and a visual editor"
  },
  he: {
    mode: "מצב",
    static: "קבוע",
    morning: "בוקר",
    noon: "צהריים",
    evening: "ערב",
    heading_style: "סגנון כותרת",
    day: "אייקון ביום",
    night: "אייקון בלילה",
    subtitle_entities: "יישויות לשורת משנה (מופרדות ב-|)",
    subtitle_show_names: "להציג שם יישות לפני הערך",
    color: "צבע",
    opacity: "אטימות",
    entity: "יישות",
    icon_mode: "מקור האייקון",
    icon: "אייקון",
    state: "מצב",
    label: "תווית",
    show_state: "להציג טקסט מצב (מתחת לעיגול / בתוך האליפסה)",
    operator: "תנאי",
    users: "להציג רק למשתמשים (ריק = לכולם)",
    tap_action: "פעולה בלחיצה",
    layout: "פריסה",
    cells: "תאי מידע",
    source: "מקור הערך",
    round: "עיגול לספרות",
    suffix: "סיומת",
    empty_text: "טקסט כשאין ערך",
    template: "תבנית (Jinja)",
    kicker: "שורת קיקר",
    day_entity: "חיישן יום בשבוע (ריק = בוקר/צהריים/ערב)",
    clock: "שעה",
    rule: "קו מפריד",
    ink: "צבע טקסט (ריק = לפי ערכת הנושא)",
    enabled: "להציג",
    width: "עובי",
    match: "איך לשלב תנאים",
    type: "סוג תנאי",
    locations: "מיקומים",
    font_family: "גופן",
    display: "תצוגת התג",
    name: "שם (ריק = שם היישות)",
    visible: "כמה תאים להציג בבת אחת",
    interval: "החלפה כל (שניות)",
    show: "מה להציג (לפי הסדר: שם · מצב · זמן)",
    typography: "טיפוגרפיה",
    scale: "גודל כללי",
    kicker_size: "גודל קיקר ותוויות",
    emphasis: "מה בולט",
    greet_weight: "עובי הברכה",
    clock_weight: "עובי השעה",
    cells_rule: "קווי התאים",
    style: "סגנון הקו",
    badge_style: "עיצוב העיגול בתג",
    dot_finish: "גימור",
    dot_tint: "עוצמת צבע",

    opt_dynamic: "דינמי (לפי שעה)",
    opt_static: "קבוע",
    opt_font_theme: "לפי ערכת הנושא",
    opt_layout_classic: "קלאסי (אייקון + שורת משנה)",
    opt_layout_columns: "טורים (2C)",
    opt_line_solid: "מלא",
    opt_line_dashed: "מקווקו",
    opt_line_dotted: "מנוקד",
    opt_line_none: "בלי קו",
    opt_finish_glass: "זכוכית שקופה",
    opt_finish_tint: "צבע שקוף",
    opt_finish_solid: "צבע מלא (כמו קודם)",
    opt_emph_clock: "השעה בולטת",
    opt_emph_greeting: "הברכה בולטת",
    opt_emph_balanced: "מאוזן",
    opt_style_title: "כותרת",
    opt_style_subtitle: "כותרת משנה",
    opt_display_circle: "עיגול בלבד",
    opt_display_pill: "עיגול + שם (אליפסה)",
    opt_icon_icon: "אייקון לבחירה",
    opt_icon_entity: "אייקון היישות",
    opt_icon_picture: "תמונת היישות",
    opt_match_all: "כל התנאים מתקיימים (וגם)",
    opt_match_any: "לפחות תנאי אחד מתקיים (או)",
    opt_op_is: "הוא",
    opt_op_is_not: "לא",
    opt_rule_entity: "מצב של יישות",
    opt_rule_location: "מיקום המשתמש המחובר",
    opt_loc_home: "בבית",
    opt_loc_not_home: "מחוץ לבית",
    opt_rot_sequential: "לפי הסדר",
    opt_rot_random: "אקראי",
    opt_src_entity: "יישות",
    opt_src_persons_home: "מי בבית",
    opt_src_sun_next_setting: "שקיעה הבאה",
    opt_src_template: "תבנית",
    opt_show_name: "שם",
    opt_show_state: "מצב",
    opt_show_last_changed: "שונה לאחרונה",
    opt_show_last_updated: "עודכן לאחרונה",
    unit_seconds: "שנ׳",

    sec_heading: "כותרת",
    sec_icon: "אייקון כותרת",
    sec_subtitle: "שורת משנה",
    sec_background: "רקע",
    sec_badge_style: "עיצוב העיגול בתג",
    sec_clock: "שעה",
    sec_typography: "טיפוגרפיה",
    sec_kicker: "שורת קיקר (יום בשבוע · תאריך)",
    sec_colors: "צבעים וקווים",
    sec_rule: "קו מרכזי",
    sec_cells_rule: "קווי התאים",

    help_layout: "קלאסי: אייקון, כותרת ושורת משנה. טורים (2C): ברכה, שעה ותאי מידע.",
    help_font_family: "גופני Google עם תמיכה בעברית נטענים אוטומטית. אפשר גם להקליד שם של גופן שמותקן במכשיר.",
    help_mode_heading: "דינמי: בוקר 05:00–12:00, צהריים 12:00–18:00, ערב 18:00–05:00.",
    help_mode_icon: "דינמי: אייקון היום כשהשמש מעל האופק (sun.sun), אחרת אייקון הלילה.",
    help_clock_entity: "חיישן עם ערך HH:MM (למשל sensor.time). אם אינו זמין – מוצגת שעת המכשיר.",
    help_kicker_entity: "טקסט התאריך שמוצג אחרי היום בשבוע (למשל sensor.jewish_calendar_date).",
    help_day_entity: "אם ריק או לא זמין – מוצג במקומו טקסט הבוקר/צהריים/ערב שלמטה.",
    help_scale: "משנה את גודל כל הטקסט בכותרת יחד.",
    help_emphasis: "מה גדול יותר: הברכה או השעה.",
    help_greet_weight: "400 = רגיל · 700 = מודגש",
    help_clock_weight: "400 = רגיל · 700 = מודגש",
    help_rule_opacity: "חל כשלא נבחר צבע: צבע הטקסט באטימות הזו.",
    help_cells_rule_width: "0 = בלי קווים בין התאים.",
    help_dot_finish: "איך העיגול של התג ממולא. לא חל על תמונות של יישויות.",
    help_dot_tint: "כמה חזק צבע התג בתוך העיגול.",
    help_display: "אליפסה: השם (והמצב) מוצגים ליד העיגול.",
    help_icon_mode: "תמונת היישות: למשל תמונה של person. אם אין תמונה – מוצג אייקון היישות.",
    help_badge_color: "צבע העיגול והאייקון. צבע שהוגדר למצב מסוים גובר עליו.",
    help_users: "התג יוצג רק למשתמשי HA שמקושרים לאנשים שנבחרו.",
    help_locations: "נבדק לפי ה-person שמקושר למשתמש המחובר. זונים מזוהים לפי השם.",
    help_state_row_state: "כשהיישות במצב הזה – העיצוב שמתחת מחליף את ברירת המחדל של התג.",
    help_state_row_label: "מחליף את טקסט המצב (צריך ש\"להציג טקסט מצב\" יהיה פעיל).",
    help_interval: "מינימום 3 שניות.",
    help_cell_label: "כותרת קטנה מעל הערך. ריק = שם היישות (כש\"שם\" מסומן).",
    help_source: "מי בבית: שמות האנשים שבבית כרגע. שקיעה הבאה: השעה לפי sun.sun.",
    help_show: "בלי סימון = מצב בלבד.",
    help_round: "רק למצבים מספריים. ריק = העיצוב של HA.",
    help_suffix: "נוסף אחרי המספר, למשל ° או %. רק למצבים מספריים.",
    help_empty_text: "מוצג כשאין ערך: יישות חסרה, תבנית ריקה או שאין אף אחד בבית.",
    help_user_tokens: "אפשר לכתוב {{user}} – יוחלף בשם המשתמש המחובר",
    help_template: "למשל: {{ states('sensor.x') }} – המשתנה user זמין. כמה שורות: הראשונה מוצגת כשם.",
    cells_title: "תאי מידע (עד {max})",
    cells_help: "מוצגים עד {visible} תאים. כשמוגדרים יותר – הם מתחלפים ביניהם.",
    add_cell: "הוסף תא",
    remove_cell: "הסר תא",
    cell_n: "תא {n}",
    badges_title: "תגים",
    add_badge: "הוסף תג",
    remove_badge: "הסר תג",
    badge_n: "תג {n}",
    move_up: "למעלה",
    move_down: "למטה",
    conditions_title: "תנאי הצגה",
    conditions_help: "התג יוצג רק כשהתנאים מתקיימים. בלי תנאים = תמיד.",
    add_condition: "הוסף תנאי",
    remove_condition: "הסר תנאי",
    states_title: "עיצוב לפי מצב",
    states_help: "כשהיישות במצב הזה – הצבע, האייקון והתווית שלו גוברים על ברירת המחדל של התג. שדה ריק = ברירת המחדל.",
    add_state: "הוסף מצב",
    remove_state: "הסר מצב",
    card_description: "כותרת דינמית + שורת תגים עם עורך גרפי"
  }
};

// "he-IL" -> he; שפה לא נתמכת -> en. {x} בטקסט מוחלף ב-vars.x ({{user}} נשאר כמו שהוא)
function translator(language) {
  const dict = I18N[String(language || "en").split("-")[0]] || I18N.en;
  return (key, vars) => (dict[key] ?? I18N.en[key] ?? key)
    .replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));
}


const modeSelector = (t) => ({ select: { mode: "dropdown", options: [
  { value: "dynamic", label: t("opt_dynamic") },
  { value: "static", label: t("opt_static") }
] } });

function mainSchema(config, t) {
  const headingStatic = config.heading?.mode === "static";
  const iconStatic = config.icon?.mode === "static";
  const fontField = { name: "font_family", selector: { select: { mode: "dropdown", custom_value: true, options: [
    { value: "", label: t("opt_font_theme") },
    ...Object.keys(GOOGLE_FONTS).map((f) => ({ value: f, label: f }))
  ] } } };
  const layoutField = { name: "layout", selector: { select: { mode: "dropdown", options: [
    { value: "classic", label: t("opt_layout_classic") },
    { value: "columns", label: t("opt_layout_columns") }
  ] } } };
  const headingSection = { type: "expandable", name: "heading", title: t("sec_heading"), icon: "mdi:format-title", expanded: true, schema: [
    { name: "mode", helper: "help_mode_heading", selector: modeSelector(t) },
    ...(headingStatic
      ? [{ name: "static", user_tokens: true, selector: { text: {} } }]
      : [{ type: "grid", name: "", schema: [
          { name: "morning", user_tokens: true, selector: { text: {} } },
          { name: "noon", user_tokens: true, selector: { text: {} } },
          { name: "evening", user_tokens: true, selector: { text: {} } }
        ] }])
  ] };

  const lineStyleOptions = (withNone) => [
    { value: "solid", label: t("opt_line_solid") }, { value: "dashed", label: t("opt_line_dashed") }, { value: "dotted", label: t("opt_line_dotted") },
    ...(withNone ? [{ value: "none", label: t("opt_line_none") }] : [])
  ];
  const badgeStyleSection = { type: "expandable", name: "badge_style", title: t("sec_badge_style"), icon: "mdi:circle-opacity", schema: [
    { name: "dot_finish", selector: { select: { mode: "dropdown", options: [
      { value: "glass", label: t("opt_finish_glass") },
      { value: "tint", label: t("opt_finish_tint") },
      { value: "solid", label: t("opt_finish_solid") }
    ] } } },
    { name: "dot_tint", selector: { number: { min: 0, max: 70, mode: "slider", unit_of_measurement: "%" } } }
  ] };

  if (config.layout === "columns") {
    return [
      layoutField,
      fontField,
      headingSection,
      { type: "expandable", name: "clock", title: t("sec_clock"), icon: "mdi:clock-outline", schema: [
        { name: "enabled", selector: { boolean: {} } },
        { name: "entity", helper: "help_clock_entity", selector: { entity: { filter: { domain: "sensor" } } } }
      ] },
      { type: "expandable", name: "typography", title: t("sec_typography"), icon: "mdi:format-size", schema: [
        { name: "scale", selector: { number: { min: 90, max: 130, mode: "slider", unit_of_measurement: "%" } } },
        { name: "kicker_size", selector: { number: { min: 11, max: 17, step: 0.5, mode: "slider", unit_of_measurement: "px" } } },
        { name: "emphasis", selector: { select: { mode: "dropdown", options: [
          { value: "clock", label: t("opt_emph_clock") },
          { value: "greeting", label: t("opt_emph_greeting") },
          { value: "balanced", label: t("opt_emph_balanced") }
        ] } } },
        { type: "grid", name: "", schema: [
          { name: "greet_weight", selector: { number: { min: 500, max: 800, step: 100, mode: "box" } } },
          { name: "clock_weight", selector: { number: { min: 500, max: 800, step: 100, mode: "box" } } }
        ] }
      ] },
      { type: "expandable", name: "kicker", title: t("sec_kicker"), icon: "mdi:calendar-text", schema: [
        { name: "enabled", selector: { boolean: {} } },
        { name: "day_entity", selector: { entity: { filter: { domain: "sensor" } } } },
        { name: "entity", helper: "help_kicker_entity", selector: { entity: {} } },
        { type: "grid", name: "", schema: [
          { name: "morning", selector: { text: {} } },
          { name: "noon", selector: { text: {} } },
          { name: "evening", selector: { text: {} } }
        ] },
        { name: "color", selector: { ui_color: { include_none: true, default_color: "none" } } }
      ] },
      { type: "expandable", name: "", flatten: true, title: t("sec_colors"), icon: "mdi:palette", schema: [
        { name: "ink", selector: { ui_color: { include_none: true, default_color: "none" } } },
        { type: "expandable", name: "rule", title: t("sec_rule"), icon: "mdi:minus", schema: [
          { name: "color", selector: { ui_color: { include_none: true, default_color: "none" } } },
          { type: "grid", name: "", schema: [
            { name: "width", selector: { number: { min: 1, max: 5, mode: "slider", unit_of_measurement: "px" } } },
            { name: "opacity", helper: "help_rule_opacity", selector: { number: { min: 20, max: 100, step: 2, mode: "slider", unit_of_measurement: "%" } } }
          ] },
          { name: "style", selector: { select: { mode: "dropdown", options: lineStyleOptions(false) } } }
        ] },
        { type: "expandable", name: "cells_rule", title: t("sec_cells_rule"), icon: "mdi:table-column", schema: [
          { name: "color", selector: { ui_color: { include_none: true, default_color: "none" } } },
          { type: "grid", name: "", schema: [
            { name: "width", helper: "help_cells_rule_width", selector: { number: { min: 0, max: 4, mode: "slider", unit_of_measurement: "px" } } },
            { name: "opacity", selector: { number: { min: 0, max: 70, step: 2, mode: "slider", unit_of_measurement: "%" } } }
          ] },
          { name: "style", selector: { select: { mode: "dropdown", options: lineStyleOptions(true) } } }
        ] }
      ] },
      badgeStyleSection
    ];
  }

  return [
    layoutField,
    fontField,
    headingSection,
    { name: "heading_style", selector: { select: { mode: "dropdown", options: [
      { value: "title", label: t("opt_style_title") }, { value: "subtitle", label: t("opt_style_subtitle") }
    ] } } },
    { type: "expandable", name: "icon", title: t("sec_icon"), icon: "mdi:emoticon-outline", schema: [
      { name: "mode", helper: "help_mode_icon", selector: modeSelector(t) },
      ...(iconStatic
        ? [{ name: "static", selector: { icon: {} } }]
        : [{ type: "grid", name: "", schema: [
            { name: "day", selector: { icon: {} } },
            { name: "night", selector: { icon: {} } }
          ] }]),
      { name: "color", selector: { ui_color: { default_color: "amber" } } }
    ] },
    { type: "expandable", name: "", flatten: true, title: t("sec_subtitle"), icon: "mdi:text-short", schema: [
      { name: "subtitle_entities", selector: { entity: { multiple: true } } },
      { name: "subtitle_show_names", selector: { boolean: {} } }
    ] },
    { type: "expandable", name: "background", title: t("sec_background"), icon: "mdi:palette", schema: [
      { name: "color", selector: { ui_color: { include_none: true, default_color: "none" } } },
      { name: "opacity", selector: { number: { min: 0, max: 100, mode: "slider", unit_of_measurement: "%" } } }
    ] },
    badgeStyleSection
  ];
}

function badgeSchema(badge, t) {
  const mode = badge.icon_mode || "icon";
  const pill = badge.display === "pill";
  return [
    { name: "entity", selector: { entity: {} } },
    { type: "grid", name: "", schema: [
      { name: "display", selector: { select: { mode: "dropdown", options: [
        { value: "circle", label: t("opt_display_circle") },
        { value: "pill", label: t("opt_display_pill") }
      ] } } },
      ...(pill ? [{ name: "name", selector: { text: {} } }] : [])
    ] },
    { type: "grid", name: "", schema: [
      { name: "icon_mode", selector: { select: { mode: "dropdown", options: [
        { value: "icon", label: t("opt_icon_icon") },
        { value: "entity", label: t("opt_icon_entity") },
        { value: "picture", label: t("opt_icon_picture") }
      ] } } },
      { name: "color", helper: "help_badge_color", selector: { ui_color: {} } }
    ] },
    ...(mode === "icon" ? [{ name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } }] : []),
    { name: "show_state", selector: { boolean: {} } },
    { name: "users", selector: { entity: { multiple: true, filter: { domain: "person" } } } },
    { name: "tap_action", selector: { ui_action: { default_action: "more-info" } } }
  ];
}

const matchSchema = (t) => [
  { name: "match", selector: { select: { mode: "dropdown", options: [
    { value: "all", label: t("opt_match_all") },
    { value: "any", label: t("opt_match_any") }
  ] } } }
];

function ruleSchema(rule, hass, t) {
  const operatorField = { name: "operator", selector: { select: { mode: "dropdown", options: [
    { value: "is", label: t("opt_op_is") },
    { value: "is_not", label: t("opt_op_is_not") }
  ] } } };
  const typeField = { name: "type", selector: { select: { mode: "dropdown", options: [
    { value: "entity", label: t("opt_rule_entity") },
    { value: "location", label: t("opt_rule_location") }
  ] } } };

  if (isLocationRule(rule)) {
    const zones = Object.keys(hass?.states || {})
      .filter((id) => id.startsWith("zone.") && id !== "zone.home")
      .map((id) => ({ value: id, label: norm(hass.states[id].attributes?.friendly_name) || id }));
    return [
      { type: "grid", name: "", schema: [typeField, operatorField] },
      { name: "locations", selector: { select: { multiple: true, mode: "list", options: [
        { value: "home", label: t("opt_loc_home") },
        { value: "not_home", label: t("opt_loc_not_home") },
        ...zones
      ] } } }
    ];
  }

  return [
    { type: "grid", name: "", schema: [typeField, { name: "entity", selector: { entity: {} } }] },
    { type: "grid", name: "", schema: [
      operatorField,
      { name: "state", selector: { state: {} }, context: { filter_entity: "entity" } }
    ] }
  ];
}

const stateRowSchema = [
  { type: "grid", name: "", schema: [
    { name: "state", helper: "help_state_row_state", selector: { state: {} }, context: { filter_entity: "entity" } },
    { name: "label", helper: "help_state_row_label", selector: { text: {} } }
  ] },
  { type: "grid", name: "", schema: [
    { name: "color", selector: { ui_color: {} } },
    { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } }
  ] }
];

const rotationSchema = (t) => [
  { name: "visible", selector: { number: { min: 1, max: MAX_VISIBLE_CELLS, mode: "slider" } } },
  { type: "grid", name: "", schema: [
    { name: "mode", selector: { select: { mode: "dropdown", options: [
      { value: "sequential", label: t("opt_rot_sequential") },
      { value: "random", label: t("opt_rot_random") }
    ] } } },
    { name: "interval", selector: { number: { min: 3, max: 3600, mode: "box", unit_of_measurement: t("unit_seconds") } } }
  ] }
];

function cellSchema(cell, t) {
  const source = cell.source || "entity";
  return [
    { type: "grid", name: "", schema: [
      { name: "label", helper: "help_cell_label", selector: { text: {} } },
      { name: "source", selector: { select: { mode: "dropdown", options: [
        { value: "entity", label: t("opt_src_entity") },
        { value: "persons_home", label: t("opt_src_persons_home") },
        { value: "sun_next_setting", label: t("opt_src_sun_next_setting") },
        { value: "template", label: t("opt_src_template") }
      ] } } }
    ] },
    ...(source === "entity" ? [
      { name: "entity", selector: { entity: {} } },
      { name: "show", selector: { select: { multiple: true, mode: "list", options: [
        { value: "name", label: t("opt_show_name") },
        { value: "state", label: t("opt_show_state") },
        { value: "last_changed", label: t("opt_show_last_changed") },
        { value: "last_updated", label: t("opt_show_last_updated") }
      ] } } },
      { type: "grid", name: "", schema: [
        { name: "round", selector: { number: { min: 0, max: 3, mode: "box" } } },
        { name: "suffix", selector: { text: {} } }
      ] }
    ] : []),
    ...(source === "template" ? [{ name: "template", selector: { template: {} } }] : []),
    { name: "empty_text", selector: { text: {} } }
  ];
}

// שדות שרלוונטיים לכל מקור – השאר נמחקים כדי שה-YAML יישאר נקי
const CELL_FIELDS = {
  entity: ["entity", "show", "round", "suffix"],
  persons_home: [],
  sun_next_setting: [],
  template: ["template"]
};

const clone = (o) => JSON.parse(JSON.stringify(o ?? {}));

class TopHeaderCardEditor extends HTMLElement {
  constructor() {
    super();
    this._open = new Set();
    this._t = translator();
    ensureHaForm().then(() => this._render());
  }

  setConfig(config) {
    this.config = clone(config);
    this.config.badges = this.config.badges || [];
    // המרה מהגדרה ישנה של יישות אחת
    if (!this.config.subtitle_entities && this.config.subtitle_entity) {
      this.config.subtitle_entities = [this.config.subtitle_entity];
    }
    delete this.config.subtitle_entity;
    // המרה מתנאי יחיד לרשימת תנאים
    this.config.badges.forEach((b) => {
      if (b.condition && !Array.isArray(b.condition.rules)) {
        const rules = conditionRules(b.condition);
        if (rules.length) b.condition = { match: "all", rules };
        else delete b.condition;
      }
    });
    this._render();
  }

  set hass(hass) {
    const langChanged = hass?.language !== this._hass?.language;
    this._hass = hass;
    this._t = translator(hass?.language);
    this.querySelectorAll("ha-form").forEach((f) => { f.hass = hass; });
    // שפה השתנתה – בונים את העורך מחדש עם התוויות החדשות
    if (langChanged && this._built) { this._built = null; this._render(); }
  }

  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: clone(this.config) }, bubbles: true, composed: true }));
  }

  _mainData() {
    const c = this.config;
    return {
      heading: { mode: "dynamic", morning: "בוקר טוב {{user}}", noon: "צהריים טובים {{user}}", evening: "ערב טוב {{user}}", ...(c.heading || {}) },
      heading_style: c.heading_style || "title",
      icon: { mode: "dynamic", day: "mdi:white-balance-sunny", night: "mdi:moon-waning-crescent", ...(c.icon || {}) },
      subtitle_entities: c.subtitle_entities || [],
      subtitle_show_names: !!c.subtitle_show_names,
      background: { color: "none", opacity: 100, ...(c.background || {}) },
      layout: c.layout === "columns" ? "columns" : "classic",
      font_family: c.font_family || "",
      clock: { enabled: true, entity: "sensor.time", ...(c.clock || {}) },
      kicker: { enabled: true, entity: "sensor.jewish_calendar_date", day_entity: "sensor.day_of_week", morning: "בוקר", noon: "צהריים", evening: "ערב", color: "none", ...(c.kicker || {}) },
      ink: c.ink || "none",
      rule: { color: "none", width: 2, opacity: 82, style: "solid", ...(c.rule || {}) },
      cells_rule: { color: "none", width: 2, opacity: 28, style: "solid", ...(c.cells_rule || {}) },
      typography: { scale: 98, kicker_size: 13, emphasis: "clock", greet_weight: 700, clock_weight: 700, ...(c.typography || {}) },
      badge_style: { dot_finish: "glass", dot_tint: 40, ...(c.badge_style || {}) }
    };
  }

  _badgeData(b) {
    return { display: "circle", icon_mode: "icon", color: "grey", show_state: false, users: [], ...b };
  }

  _computeLabel = (s) => this._t(s.name);

  _computeHelper = (s) => {
    const key = s.helper || (s.user_tokens ? "help_user_tokens" : `help_${s.name}`);
    return key in I18N.en ? this._t(key) : undefined;
  };

  _makeForm(data, schema, onChange) {
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.computeLabel = this._computeLabel;
    form.computeHelper = this._computeHelper;
    form.data = data;
    form.schema = schema;
    form.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      onChange({ ...e.detail.value });
      this._render();
      this._emit();
    });
    return form;
  }

  // מבנה העורך (כמה תגים, כמה מצבים בכל תג) – כשהוא לא משתנה, לא בונים DOM מחדש
  _structure() {
    const cells = this.config.layout === "columns" ? (this.config.cells?.length ?? 0) : "-";
    return this.config.badges.map((b) => `${(b.states || []).length}:${b.condition?.rules?.length ?? 0}`).join(",")
      + "/" + this.config.badges.length + "/" + cells;
  }

  _render() {
    if (!this.config || !customElements.get("ha-form")) return;

    if (this._built === this._structure() && this._mainForm) {
      this._mainForm.data = this._mainData();
      this._mainForm.schema = mainSchema(this.config, this._t);
      this.querySelectorAll("ha-form[data-badge]").forEach((f) => {
        const b = this.config.badges[Number(f.dataset.badge)];
        f.data = this._badgeData(b);
        f.schema = badgeSchema(b, this._t);
      });
      this.querySelectorAll("ha-form[data-state]").forEach((f) => {
        const [i, j] = f.dataset.state.split(":").map(Number);
        const b = this.config.badges[i];
        f.data = { ...b.states[j], entity: b.entity };
      });
      this.querySelectorAll("ha-form[data-match]").forEach((f) => {
        const b = this.config.badges[Number(f.dataset.match)];
        f.data = { match: b.condition?.match || "all" };
      });
      this.querySelectorAll("ha-form[data-rule]").forEach((f) => {
        const [i, j] = f.dataset.rule.split(":").map(Number);
        const r = this.config.badges[i].condition.rules[j];
        f.data = { operator: "is", type: "entity", ...r };
        f.schema = ruleSchema(r, this._hass, this._t);
      });
      this.querySelectorAll("[data-badge-title]").forEach((el) => {
        el.textContent = this._badgeTitle(Number(el.dataset.badgeTitle));
      });
      if (this._rotationForm) this._rotationForm.data = this._rotationData();
      this.querySelectorAll("ha-form[data-cell]").forEach((f) => {
        const cell = this.config.cells[Number(f.dataset.cell)];
        f.data = { source: "entity", ...cell };
        f.schema = cellSchema(cell, this._t);
      });
      this.querySelectorAll("[data-cell-title]").forEach((el) => {
        el.textContent = this._cellTitle(Number(el.dataset.cellTitle));
      });
      return;
    }
    this._built = this._structure();
    const count = this.config.badges.length;
    const t = this._t;

    this.innerHTML = `
      <style>
        .the-editor { display:flex; flex-direction:column; gap:12px; }
        .the-section-title { font-weight:500; margin:8px 0 0; }
        .the-badge { border:1px solid var(--divider-color); border-radius:12px; overflow:hidden; }
        .the-badge > summary { display:flex; align-items:center; gap:8px; padding:10px 12px; cursor:pointer; list-style:none; }
        .the-badge > summary::-webkit-details-marker { display:none; }
        .the-badge > summary .title { flex:1; }
        .the-badge .body { padding:0 12px 12px; display:flex; flex-direction:column; gap:12px; }
        .the-states-title { font-size:14px; font-weight:500; margin-top:4px; }
        .the-states-help { font-size:12px; color:var(--secondary-text-color); }
        .the-state { border:1px dashed var(--divider-color); border-radius:8px; padding:8px; display:flex; gap:4px; align-items:flex-start; }
        .the-state ha-form { flex:1; }
        .the-btn { background:none; border:none; color:var(--secondary-text-color); cursor:pointer; padding:4px; border-radius:50%; display:inline-flex; }
        .the-btn:hover { background:var(--secondary-background-color); }
        .the-btn[disabled] { opacity:.3; cursor:default; }
        .the-add { align-self:flex-start; display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:18px;
                   border:1px solid var(--primary-color); color:var(--primary-color); background:none; cursor:pointer; font:inherit; }
        .the-add[disabled] { opacity:.4; cursor:default; }
        [hidden] { display:none !important; }
      </style>
      <div class="the-editor">
        <div id="main"></div>
        <div id="cells-section" ${this.config.layout === "columns" ? "" : "hidden"} style="display:flex; flex-direction:column; gap:8px;">
          <div class="the-section-title">${t("cells_title", { max: MAX_CELLS })}</div>
          <div class="the-states-help">${t("cells_help", { visible: MAX_VISIBLE_CELLS })}</div>
          <div id="rotation-form"></div>
          <div id="cells" style="display:flex; flex-direction:column; gap:8px;"></div>
          <button class="the-add" id="add-cell" ${(this.config.cells?.length ?? 0) >= MAX_CELLS ? "disabled" : ""}><ha-icon icon="mdi:plus"></ha-icon>${t("add_cell")}</button>
        </div>
        <div class="the-section-title">${t("badges_title")}</div>
        <div id="badges" style="display:flex; flex-direction:column; gap:8px;"></div>
        <button class="the-add" id="add-badge"><ha-icon icon="mdi:plus"></ha-icon>${t("add_badge")}</button>
      </div>
    `;

    this._rotationForm = null;
    this._mainForm = this._makeForm(this._mainData(), mainSchema(this.config, this._t), (v) => {
      // בפריסה הקלאסית לא כותבים ל-YAML ברירות מחדל של 2C (ערכים קיימים נשמרים למעבר חזרה)
      if (v.layout !== "columns") ["clock", "kicker", "ink", "rule", "cells_rule", "typography"].forEach((k) => delete v[k]);
      if (!norm(v.font_family)) { delete v.font_family; delete this.config.font_family; }
      Object.assign(this.config, v);
    });
    this.querySelector("#main").appendChild(this._mainForm);

    if (this.config.layout === "columns") this._renderCells();

    const list = this.querySelector("#badges");
    this.config.badges.forEach((b, i) => {
      const det = document.createElement("details");
      det.className = "the-badge";
      det.open = this._open.has(i);
      det.addEventListener("toggle", () => { det.open ? this._open.add(i) : this._open.delete(i); });
      det.innerHTML = `
        <summary>
          <ha-icon icon="mdi:chevron-down"></ha-icon>
          <span class="title" data-badge-title="${i}"></span>
          <button class="the-btn" data-move="-1" ${i === 0 ? "disabled" : ""} title="${t("move_up")}"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
          <button class="the-btn" data-move="1" ${i === count - 1 ? "disabled" : ""} title="${t("move_down")}"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
          <button class="the-btn" data-remove title="${t("remove_badge")}"><ha-icon icon="mdi:delete-outline"></ha-icon></button>
        </summary>
        <div class="body">
          <div class="main-form"></div>
          <div class="the-states-title">${t("conditions_title")}</div>
          <div class="the-states-help">${t("conditions_help")}</div>
          <div class="match-form"></div>
          <div class="rules" style="display:flex; flex-direction:column; gap:8px;"></div>
          <button class="the-add" data-add-rule><ha-icon icon="mdi:plus"></ha-icon>${t("add_condition")}</button>
          <div class="the-states-title">${t("states_title")}</div>
          <div class="the-states-help">${t("states_help")}</div>
          <div class="states" style="display:flex; flex-direction:column; gap:8px;"></div>
          <button class="the-add" data-add-state><ha-icon icon="mdi:plus"></ha-icon>${t("add_state")}</button>
        </div>`;
      det.querySelector("[data-badge-title]").textContent = this._badgeTitle(i);

      const form = this._makeForm(this._badgeData(b), badgeSchema(b, this._t), (v) => {
        if (v.icon_mode !== "icon") delete v.icon;
        if (v.display !== "pill") { delete v.display; delete v.name; }
        if (!norm(v.name)) delete v.name;
        if (!v.show_state) delete v.show_state;
        if (!v.users?.length) delete v.users;
        v.condition = this.config.badges[i].condition;
        if (!v.condition) delete v.condition;
        v.states = this.config.badges[i].states;
        if (!v.states?.length) delete v.states;
        this.config.badges[i] = v;
      });
      form.dataset.badge = String(i);
      det.querySelector(".main-form").appendChild(form);

      // תנאי הצגה
      const rules = b.condition?.rules || [];
      const matchEl = det.querySelector(".match-form");
      matchEl.hidden = rules.length < 2;
      const mf = this._makeForm({ match: b.condition?.match || "all" }, matchSchema(this._t), (v) => {
        const cond = this.config.badges[i].condition;
        if (cond) cond.match = v.match || "all";
      });
      mf.dataset.match = String(i);
      matchEl.appendChild(mf);

      const rulesEl = det.querySelector(".rules");
      rules.forEach((r, j) => {
        const rowEl = document.createElement("div");
        rowEl.className = "the-state";
        const rf = this._makeForm({ operator: "is", type: "entity", ...r }, ruleSchema(r, this._hass, this._t), (v) => {
          if (v.operator === "is") delete v.operator;
          // משאירים רק שדות של סוג הכלל
          const keep = isLocationRule(v) ? ["type", "operator", "locations"] : ["entity", "operator", "state"];
          Object.keys(v).forEach((k) => {
            if (!keep.includes(k) || v[k] === "" || v[k] == null || (Array.isArray(v[k]) && !v[k].length)) delete v[k];
          });
          this.config.badges[i].condition.rules[j] = v;
        });
        rf.dataset.rule = `${i}:${j}`;
        rowEl.appendChild(rf);
        const del = document.createElement("button");
        del.className = "the-btn";
        del.title = t("remove_condition");
        del.innerHTML = `<ha-icon icon="mdi:close"></ha-icon>`;
        del.addEventListener("click", () => {
          const bb = this.config.badges[i];
          bb.condition.rules.splice(j, 1);
          if (!bb.condition.rules.length) delete bb.condition;
          this._render();
          this._emit();
        });
        rowEl.appendChild(del);
        rulesEl.appendChild(rowEl);
      });

      det.querySelector("[data-add-rule]").addEventListener("click", () => {
        const bb = this.config.badges[i];
        bb.condition = bb.condition || { match: "all", rules: [] };
        bb.condition.rules.push({ entity: "", state: "" });
        this._render();
        this._emit();
      });

      const statesEl = det.querySelector(".states");
      (b.states || []).forEach((s, j) => {
        const rowEl = document.createElement("div");
        rowEl.className = "the-state";
        const sf = this._makeForm({ ...s, entity: b.entity }, stateRowSchema, (v) => {
          delete v.entity;
          Object.keys(v).forEach((k) => { if (v[k] === "" || v[k] == null) delete v[k]; });
          this.config.badges[i].states[j] = v;
        });
        sf.dataset.state = `${i}:${j}`;
        rowEl.appendChild(sf);
        const del = document.createElement("button");
        del.className = "the-btn";
        del.title = t("remove_state");
        del.innerHTML = `<ha-icon icon="mdi:close"></ha-icon>`;
        del.addEventListener("click", () => {
          const st = this.config.badges[i].states;
          st.splice(j, 1);
          if (!st.length) delete this.config.badges[i].states;
          this._render();
          this._emit();
        });
        rowEl.appendChild(del);
        statesEl.appendChild(rowEl);
      });

      det.querySelector("[data-add-state]").addEventListener("click", () => {
        const bb = this.config.badges[i];
        bb.states = bb.states || [];
        bb.states.push({ state: "" });
        this._render();
        this._emit();
      });

      det.querySelectorAll("[data-move]").forEach((btn) => btn.addEventListener("click", (e) => {
        e.preventDefault();
        const j = i + Number(btn.dataset.move);
        if (j < 0 || j >= count) return;
        const arr = this.config.badges;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        const wasI = this._open.has(i), wasJ = this._open.has(j);
        wasJ ? this._open.add(i) : this._open.delete(i);
        wasI ? this._open.add(j) : this._open.delete(j);
        this._built = null;
        this._render();
        this._emit();
      }));
      det.querySelector("[data-remove]").addEventListener("click", (e) => {
        e.preventDefault();
        this.config.badges.splice(i, 1);
        this._open = new Set([...this._open].filter((k) => k !== i).map((k) => (k > i ? k - 1 : k)));
        this._render();
        this._emit();
      });

      list.appendChild(det);
    });

    this.querySelector("#add-badge").addEventListener("click", () => {
      this.config.badges.push({ entity: "", icon_mode: "icon", icon: "mdi:help-circle", color: "grey", tap_action: { action: "more-info" } });
      this._open.add(this.config.badges.length - 1);
      this._render();
      this._emit();
    });
  }

  _rotationData() {
    return { visible: MAX_VISIBLE_CELLS, mode: "sequential", interval: 10, ...(this.config.rotation || {}) };
  }

  _renderCells() {
    this._rotationForm = this._makeForm(this._rotationData(), rotationSchema(this._t), (v) => {
      this.config.rotation = { visible: v.visible, mode: v.mode, interval: v.interval };
    });
    this.querySelector("#rotation-form").appendChild(this._rotationForm);

    this._openCells = this._openCells || new Set();
    const cells = this.config.cells = this.config.cells || [];
    const count = cells.length;
    const list = this.querySelector("#cells");
    const t = this._t;

    cells.forEach((cell, i) => {
      const det = document.createElement("details");
      det.className = "the-badge";
      det.open = this._openCells.has(i);
      det.addEventListener("toggle", () => { det.open ? this._openCells.add(i) : this._openCells.delete(i); });
      det.innerHTML = `
        <summary>
          <ha-icon icon="mdi:chevron-down"></ha-icon>
          <span class="title" data-cell-title="${i}"></span>
          <button class="the-btn" data-move="-1" ${i === 0 ? "disabled" : ""} title="${t("move_up")}"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
          <button class="the-btn" data-move="1" ${i === count - 1 ? "disabled" : ""} title="${t("move_down")}"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
          <button class="the-btn" data-remove title="${t("remove_cell")}"><ha-icon icon="mdi:delete-outline"></ha-icon></button>
        </summary>
        <div class="body"></div>`;
      det.querySelector("[data-cell-title]").textContent = this._cellTitle(i);

      const form = this._makeForm({ source: "entity", ...cell }, cellSchema(cell, this._t), (v) => {
        const source = v.source || "entity";
        const keep = new Set(["label", "source", "empty_text", ...CELL_FIELDS[source]]);
        Object.keys(v).forEach((k) => { if (!keep.has(k) || v[k] === "" || v[k] == null) delete v[k]; });
        this.config.cells[i] = v;
      });
      form.dataset.cell = String(i);
      det.querySelector(".body").appendChild(form);

      det.querySelectorAll("[data-move]").forEach((btn) => btn.addEventListener("click", (e) => {
        e.preventDefault();
        const j = i + Number(btn.dataset.move);
        if (j < 0 || j >= count) return;
        [cells[i], cells[j]] = [cells[j], cells[i]];
        const wasI = this._openCells.has(i), wasJ = this._openCells.has(j);
        wasJ ? this._openCells.add(i) : this._openCells.delete(i);
        wasI ? this._openCells.add(j) : this._openCells.delete(j);
        this._built = null;
        this._render();
        this._emit();
      }));
      det.querySelector("[data-remove]").addEventListener("click", (e) => {
        e.preventDefault();
        cells.splice(i, 1);
        this._openCells = new Set([...this._openCells].filter((k) => k !== i).map((k) => (k > i ? k - 1 : k)));
        this._render();
        this._emit();
      });

      list.appendChild(det);
    });

    this.querySelector("#add-cell").addEventListener("click", () => {
      if (cells.length >= MAX_CELLS) return;
      cells.push({ label: "", source: "entity" });
      this._openCells.add(cells.length - 1);
      this._render();
      this._emit();
    });
  }

  _cellTitle(i) {
    const cell = this.config.cells[i];
    return cell.label || this._t("cell_n", { n: i + 1 });
  }

  _badgeTitle(i) {
    const b = this.config.badges[i];
    const st = b.entity && this._hass?.states?.[b.entity];
    return st?.attributes?.friendly_name || b.entity || this._t("badge_n", { n: i + 1 });
  }
}

if (!customElements.get("top-header-card")) customElements.define("top-header-card", TopHeaderCard);
if (!customElements.get("top-header-card-editor")) customElements.define("top-header-card-editor", TopHeaderCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "top-header-card")) {
  window.customCards.push({
    type: "top-header-card",
    name: "Top Header Card",
    // HA מגדיר את lang של הדף לפי שפת המשתמש
    description: translator(document.documentElement.lang)("card_description"),
    preview: true
  });
}
