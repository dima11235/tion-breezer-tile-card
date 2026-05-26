# Tion Breezer Tile Card

Кастомная карточка для управления бризером [Tion](https://tion.ru/) в Home Assistant.  
Стилизована под стандартные tile-карточки HA.

![preview](https://raw.githubusercontent.com/dima11235/tion-breezer-tile-card/main/images/preview.png)

---

## Возможности

- Текущее состояние: CO₂, температура воздуха, скорость вентилятора
- Выбор диапазона скоростей (два клика — от и до)
- Настройка целевого CO₂ кнопками ±
- Настройка температуры нагрева (показывается только в режиме heat)
- Переключение режимов: выкл / нагрев / вентиляция
- Цветовая индикация состояния карточки
- Настраиваемый `tap_action` (по умолчанию — more-info климата)

---

## Установка через HACS

1. HACS → Меню (⋮) → Custom repositories
2. URL: `https://github.com/dima11235/tion-breezer-tile-card`, тип: **Lovelace**
3. Найти **Tion Breezer Tile Card** → Установить

---

## Установка вручную

Скопировать `tion-breezer-tile-card.js` в `www/community/tion-breezer-tile-card/`.

В ресурсах Lovelace добавить:
```yaml
url: /local/community/tion-breezer-tile-card/tion-breezer-tile-card.js
type: module
```

---

## Минимальная конфигурация

```yaml
type: custom:tion-breezer-tile-card
entity: climate.brizer_bedroom
```

Все связанные entity вычисляются автоматически по схеме именования ESPHome-пакета.

---

## Полная конфигурация

```yaml
type: custom:tion-breezer-tile-card
entity: climate.brizer_bedroom

# Опциональное имя (по умолчанию — friendly_name климата)
name: Бризер спальня

# Переопределение отдельных entity
# (нужно только если схема именования отличается от стандартной)
entities:
  climate: climate.brizer_bedroom
  power: switch.brizer_bedroom_power_mode
  heater: switch.brizer_bedroom_heater_mode
  heaterTemperature: number.brizer_bedroom_heater_temperature
  fanSpeed: sensor.brizer_bedroom_fan_speed
  minFanSpeed: number.brizer_bedroom_min_fan_speed
  maxFanSpeed: number.brizer_bedroom_max_fan_speed
  targetCo2: number.brizer_bedroom_target_co2
  currentCo2: sensor.brizer_bedroom_current_co2

# Действие при нажатии на заголовок карточки
# По умолчанию: more-info климата
tap_action:
  action: more-info          # more-info | fire-dom-event | navigate | call-service | url | none
```

### Пример с browser_mod popup

```yaml
type: custom:tion-breezer-tile-card
entity: climate.brizer_bedroom
tap_action:
  action: fire-dom-event
  browser_mod:
    service: browser_mod.popup
    data:
      title: Бризер спальня
      content:
        type: entities
        entities:
          - entity: switch.brizer_bedroom_power_mode
            name: Включение
          - entity: switch.brizer_bedroom_heater_mode
            name: Подогрев
```

---

## Схема именования entity

Карточка автоматически выводит entity из имени климата по схеме:  
`climate.{prefix}` → `switch.{prefix}_power_mode`, `sensor.{prefix}_fan_speed` и т.д.

Используется с ESPHome-пакетом из репозитория [esphome-tion-ha-lovelace](https://github.com/dima11235/esphome-tion-ha-lovelace).

---

## Совместимость

- Home Assistant 2023.0+
- Требует ESPHome-интеграцию Tion
