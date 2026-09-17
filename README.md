# 🏷️ Top Header Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/avrahmvi/-top-header-card)](https://github.com/avrahmvi/-top-header-card/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A custom Lovelace card for Home Assistant that replaces the top-of-dashboard heading area with a dynamic greeting, a day/night icon, and a scrollable row of condition-aware badges — all configurable through a built-in visual editor, no YAML required.

![Top Header Card preview](docs/preview.png)

## ✨ Features

- **Dynamic heading** — greeting text that changes by time of day (morning / afternoon / evening), or a fixed static title
- **Dynamic icon** — switches automatically between day/night icons based on `sun.sun`, or use a fixed icon
- **Subtitle binding** — display the state of any entity as a subtitle (e.g. a date/time sensor)
- **Background styling** — configurable card background color and opacity
- **Condition-aware badges** — icon-only badges tied to any entity, shown or hidden based on entity state
- **Tap actions** — `more-info`, `toggle`, `navigate`, `url`, or `perform-action` per badge
- **Visual editor** — entities and icons are picked from native Home Assistant pickers, not typed by hand

## 📦 Installation

### HACS (recommended)

1. Go to **HACS → ⋮ (top-right menu) → Custom repositories**
2. Add this repository URL, category: **Dashboard**
3. Find **Top Header Card** in HACS → **Download**
4. Hard-refresh your browser (`Ctrl+Shift+R`)

### Manual

1. Download `top-header-card.js` from the [latest release](https://github.com/avrahmvi/-top-header-card/releases)
2. Copy it to `/config/www/`
3. Go to **Settings → Dashboards → ⋮ → Resources → Add Resource**
   - URL: `/local/top-header-card.js`
   - Resource type: **JavaScript Module**

## 🚀 Usage

Add a card of type **Top Header Card** via the dashboard editor's **Add Card** dialog, or use YAML:

```yaml
type: custom:top-header-card
heading:
  mode: dynamic
  morning: Good morning
  noon: Good afternoon
  evening: Good evening
heading_style: title
icon:
  mode: dynamic
  day: mdi:white-balance-sunny
  night: mdi:moon-waning-crescent
subtitle_entity: sensor.date_time_iso
background:
  color: "#1c1c1c"
  opacity: 100
badges:
  - entity: person.racheli
    icon: mdi:car
    color: red
    condition:
      entity: person.racheli
      state: not_home
    tap_action:
      action: more-info
  - entity: input_boolean.babysitter
    icon: mdi:baby-carriage
    color: amber
    condition:
      entity: input_boolean.babysitter
      state: "on"
    tap_action:
      action: toggle
```

## ⚙️ Configuration options

| Name | Type | Default | Description |
|---|---|---|---|
| `heading.mode` | string | `dynamic` | `static` or `dynamic` (time-based greeting) |
| `heading.static` | string | — | Fixed heading text when `mode: static` |
| `heading.morning` / `noon` / `evening` | string | — | Greeting per time slot when `mode: dynamic` |
| `heading_style` | string | `title` | `title` or `subtitle` (font weight) |
| `icon.mode` | string | `dynamic` | `static` or `dynamic` (based on `sun.sun`) |
| `icon.static` | string | `mdi:home` | Icon shown when `mode: static` |
| `icon.day` / `icon.night` | string | — | Icons shown when `mode: dynamic` |
| `subtitle_entity` | string | — | Entity whose state is shown as the subtitle |
| `background.color` | string | `#1c1c1c` | Card background color |
| `background.opacity` | number | `100` | Card background opacity (0–100) |
| `badges` | list | `[]` | List of badge objects (see below) |

### Badge object

| Name | Type | Description |
|---|---|---|
| `entity` | string | Entity this badge represents |
| `icon` | string | `mdi:` icon shown on the badge |
| `color` | string | `green` / `red` / `amber` / `blue` / `purple` / `teal` / `grey` |
| `condition.entity` / `condition.state` | string | Badge is hidden unless this entity equals this state |
| `tap_action.action` | string | `more-info` / `toggle` / `navigate` / `url` / `perform-action` |
| `tap_action.navigation_path` / `url_path` / `perform_action` | string | Target for the above action, when applicable |

## 🔄 Releases

Updates are published via GitHub Releases. HACS will notify you automatically when a new version is available.

## 🐛 Issues & contributions

Found a bug or have an idea? Open an [issue](https://github.com/avrahmvi/-top-header-card/issues) or a pull request.

## 📄 License

MIT
