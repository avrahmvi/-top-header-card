# Top Header Card

כרטיס Lovelace מותאם אישית ל-Home Assistant: כותרת דינמית (ברכה לפי שעה, אייקון יום/לילה לפי `sun.sun`) ושורת תגים (badges) עם אייקון, צבע, תנאי הצגה ו-tap action — הכל דרך עורך גרפי מובנה, בלי YAML ידני.

## התקנה

### דרך HACS (מומלץ)
1. HACS → תפריט 3 הנקודות (⋮) → **Custom repositories**
2. הדבק את כתובת הריפו הזה, סוג: **Dashboard**
3. חפש "Top Header Card" ברשימת ה-Frontend של HACS → **Download**
4. רענן את הדפדפן (Ctrl+Shift+R)

### התקנה ידנית
1. הורד את `top-header-card.js` ושים ב-`/config/www/`
2. Settings → Dashboards → ⋮ → **Resources** → Add resource:
   - URL: `/local/top-header-card.js`
   - Type: JavaScript Module

## שימוש

הוסף כרטיס מסוג **Top Header Card** דרך עורך הדשבורד (Add Card → חפש בשם), או ב-YAML:

```yaml
type: custom:top-header-card
heading:
  mode: dynamic
  morning: בוקר טוב
  noon: צהריים טובים
  evening: ערב טוב
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

## אפשרויות קונפיגורציה

| שדה | תיאור |
|---|---|
| `heading.mode` | `static` או `dynamic` (ברכה לפי שעה) |
| `heading_style` | `title` או `subtitle` |
| `icon.mode` | `static` או `dynamic` (לפי `sun.sun`) |
| `subtitle_entity` | entity שהמצב שלו יוצג כתת-כותרת |
| `background.color` / `background.opacity` | צבע ושקיפות רקע הכרטיס |
| `badges[].condition` | הצגה מותנית לפי מצב entity |
| `badges[].tap_action` | `more-info` / `toggle` / `navigate` / `url` / `perform-action` |

## גרסאות

עדכונים מתפרסמים דרך GitHub Releases. HACS יתריע אוטומטית כשיש גרסה חדשה.
