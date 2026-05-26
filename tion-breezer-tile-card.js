const TION_BREEZER_TILE_CARD_VERSION = "0.8.5";
const TION_BREEZER_TILE_CARD_TAG = "tion-breezer-tile-card";

console.info(`[${TION_BREEZER_TILE_CARD_TAG}] loaded`, {
  version: TION_BREEZER_TILE_CARD_VERSION,
});

class TionBreezerTileCard extends HTMLElement {
  setConfig(config) {
    if (typeof config?.entity !== "string" || !config.entity.startsWith("climate.")) {
      throw new Error("Tion Breezer Tile Card: укажите climate entity, например climate.brizer_masha");
    }

    this._clearPendingNumbers();
    this.config = {
      name: null,
      ...config,
    };
    this._breezerPrefix = this._normalizePrefix(this.config.prefix || this.config.entity);
    this._entities = {
      climate: this._configValue("climate", "entity", this.config.entity),
      power: this._configValue("power", "power_entity", `switch.${this._breezerPrefix}_power_mode`),
      heater: this._configValue("heater", "heater_entity", `switch.${this._breezerPrefix}_heater_mode`),
      heaterTemperature: this._configValue("heaterTemperature", "heater_temperature_entity", `number.${this._breezerPrefix}_heater_temperature`),
      fanSpeed: this._configValue("fanSpeed", "fan_speed_entity", `sensor.${this._breezerPrefix}_fan_speed`),
      minFanSpeed: this._configValue("minFanSpeed", "min_fan_speed_entity", `number.${this._breezerPrefix}_min_fan_speed`),
      maxFanSpeed: this._configValue("maxFanSpeed", "max_fan_speed_entity", `number.${this._breezerPrefix}_max_fan_speed`),
      targetCo2: this._configValue("targetCo2", "target_co2_entity", `number.${this._breezerPrefix}_target_co2`),
      currentCo2: this._configValue("currentCo2", "current_co2_entity", `sensor.${this._breezerPrefix}_current_co2`),
    };
    this._requiredEntities = [
      ["climate", this._entities.climate],
      ["power", this._entities.power],
      ["heater", this._entities.heater],
      ["heaterTemperature", this._entities.heaterTemperature],
      ["fanSpeed", this._entities.fanSpeed],
      ["minFanSpeed", this._entities.minFanSpeed],
      ["maxFanSpeed", this._entities.maxFanSpeed],
      ["targetCo2", this._entities.targetCo2],
      ["currentCo2", this._entities.currentCo2],
    ];

    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("pointerup", (event) => this._handlePointerUp(event));
      this.shadowRoot.addEventListener("click", (event) => this._handleClick(event));
      this.shadowRoot.addEventListener("keydown", (event) => this._handleKeyDown(event));
    }

    this._render();
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;
    if (!oldHass || !this._entities || Object.values(this._entities).some(
      id => id && oldHass.states[id] !== hass.states[id]
    )) {
      this._render();
    }
  }

  getCardSize() {
    return 3;
  }

  static getStubConfig() {
    return { entity: "climate.brizer_example" };
  }

  disconnectedCallback() {
    this._clearPendingSpeed();
    this._clearPendingNumbers();
  }

  _normalizePrefix(value) {
    return String(value).replace(/^climate\./, "").replace(/_climate$/, "");
  }

  _configValue(entityKey, legacyKey, fallback) {
    return this.config.entities?.[entityKey] || this.config[legacyKey] || fallback;
  }

  _state(entityId) {
    return entityId && this._hass ? this._hass.states[entityId] : null;
  }

  _stateValue(entityId, fallback = "-") {
    const state = this._state(entityId)?.state;
    return state === undefined || state === "unknown" || state === "unavailable" ? fallback : state;
  }

  _num(entityId) {
    const value = Number(this._stateValue(entityId, NaN));
    return Number.isFinite(value) ? value : null;
  }

  _name() {
    return this.config.name || this._state(this._entities.climate)?.attributes?.friendly_name || this._entities.climate || "Tion Breezer";
  }

  _targetCo2Text() {
    const pending = this._pendingNumbers?.[this._entities.targetCo2];
    const value = pending !== undefined ? pending.value : this._num(this._entities.targetCo2);
    const unit = this._state(this._entities.targetCo2)?.attributes?.unit_of_measurement || "ppm";
    return value === null ? "-" : `${Math.round(value)}${unit}`;
  }

  _heaterTemperatureText() {
    const pending = this._pendingNumbers?.[this._entities.heaterTemperature];
    const value = pending !== undefined ? pending.value : this._num(this._entities.heaterTemperature);
    const unit = this._state(this._entities.heaterTemperature)?.attributes?.unit_of_measurement || "°C";
    return value === null ? "-" : `${Math.round(value)}${unit}`;
  }

  _fanSpeedText() {
    const value = this._num(this._entities.fanSpeed);
    return value === null ? "0" : String(Math.round(value));
  }

  _render() {
    if (!this.shadowRoot || !this.config) return;
    this._ensureDom();
    this._updateDom();
  }

  _ensureDom() {
    if (this._els) return;

    const speedButtons = [0, 1, 2, 3, 4, 5, 6].map((speed) => `
      <button
        type="button"
        class="speed-button"
        data-action="speed"
        data-speed="${speed}"
        aria-pressed="false"
      >
        <span>${speed}</span>
      </button>
    `).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --breezer-chip: var(--secondary-background-color);
          --breezer-muted: var(--secondary-text-color);
          --breezer-card-background: var(--ha-card-background, var(--card-background-color));
          --breezer-card-border: var(--ha-card-border-color, var(--divider-color));
          --breezer-vent-color: var(--state-fan-active-color, var(--state-icon-active-color, var(--primary-color)));
          --breezer-state-color: var(--state-icon-color);
        }

        [hidden] {
          display: none !important;
        }

        ha-card {
          border-width: var(--ha-card-border-width, 1px);
          border-style: solid;
          border-color: var(--breezer-card-border);
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: var(--ha-card-box-shadow, none);
          background: var(--breezer-card-background);
          color: var(--primary-text-color);
          overflow: hidden;
          position: relative;
          z-index: 0;
          --ha-ripple-color: var(--breezer-state-color);
          --ha-ripple-hover-opacity: 0.08;
          --ha-ripple-pressed-opacity: 0.16;
        }

        ha-ripple {
          z-index: 2;
        }

        ha-card.off {
          --breezer-state-color: var(--grey-color, var(--state-inactive-color, var(--state-icon-color)));
        }

        ha-card.fan {
          --breezer-state-color: var(--breezer-vent-color);
        }

        ha-card.heat {
          --breezer-state-color: var(--state-climate-heat-color, #ff8c00);
        }

        ha-card.fan:hover,
        ha-card.heat:hover {
          border-color: var(--breezer-hover-border-color, color-mix(in srgb, var(--breezer-state-color) 18%, var(--breezer-card-border)));
        }

        ha-card.unavailable {
          opacity: 0.7;
        }

        ha-card.config-error {
          border-color: var(--error-color);
        }

        .card {
          display: grid;
          gap: 8px;
          padding: 12px;
          background: transparent;
          position: relative;
          z-index: 1;
        }

        .error {
          display: grid;
          gap: 6px;
          padding: 12px;
          color: var(--primary-text-color);
        }

        .error-title {
          color: var(--error-color);
          font-size: 14px;
          font-weight: 700;
          line-height: 18px;
        }

        .error-message {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 16px;
          word-break: break-word;
        }

        .header {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          gap: 9px;
          align-items: center;
          min-width: 0;
          border-radius: 12px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        .icon-wrap {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--breezer-chip);
          background: color-mix(in srgb, var(--breezer-state-color) 18%, var(--breezer-chip));
          color: var(--breezer-state-color);
          line-height: 1;
        }

        .icon-wrap ha-icon {
          --mdc-icon-size: 22px;
        }

        .badge {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 16px;
          min-width: 16px;
          height: 16px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          padding: 0;
          background: var(--breezer-state-color);
          color: var(--text-primary-color, #fff);
          font-size: 10px;
          font-weight: 800;
          line-height: 16px;
        }

        .title {
          min-width: 0;
        }

        .name {
          font-size: 14px;
          line-height: 18px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .secondary {
          color: var(--breezer-muted);
          font-size: 12px;
          line-height: 15px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .secondary-part {
          border: 0;
          border-radius: 7px;
          margin: 0;
          padding: 0 2px;
          background: transparent;
          color: inherit;
          font: inherit;
          line-height: inherit;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        .secondary-part:hover {
          color: var(--primary-text-color);
        }

        .secondary-separator,
        .secondary-fallback {
          pointer-events: none;
        }

        .co2-row,
        .temperature-row,
        .speed-row,
        .mode-row {
          display: grid;
          overflow: hidden;
          border-radius: 12px;
          background: var(--breezer-chip);
        }

        .co2-row {
          grid-template-columns: 1fr 2fr 1fr;
          height: 40px;
          margin-top: 3px;
        }

        .temperature-row {
          grid-template-columns: 1fr 2fr 1fr;
          height: 40px;
        }

        .speed-row {
          grid-template-columns: repeat(7, minmax(0, 1fr));
          height: 42px;
          gap: 2px;
        }

        .mode-row {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          height: 40px;
          gap: 0;
          padding: 0;
        }

        button {
          appearance: none;
          border: 0;
          min-width: 0;
          margin: 0;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--breezer-chip);
          color: var(--primary-text-color);
          font: inherit;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
          position: relative;
          overflow: hidden;
          z-index: 0;
        }

        button:disabled {
          cursor: default;
          opacity: 0.4;
        }

        button::before {
          position: absolute;
          content: "";
          inset: 0;
          background-color: var(--breezer-state-color);
          opacity: 0;
          border-radius: inherit;
          pointer-events: none;
          transition: background-color ease-in-out 180ms, opacity ease-in-out 80ms;
        }

        button:not(.active):not(:disabled):hover::before {
          opacity: 0.2;
        }

        button > * {
          position: relative;
          z-index: 1;
          pointer-events: none;
        }

        .value-info {
          min-width: 0;
          margin: 0;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--primary-text-color);
          font-size: 14px;
          font-weight: 400;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        .co2-row button,
        .temperature-row button {
          border-radius: 12px;
        }

        .speed-button {
          border-radius: 12px;
          font-size: 11px;
        }

        .speed-button.active,
        .mode-button.active {
          background: var(--breezer-chip);
          color: var(--text-primary-color, #ffffff);
        }

        .speed-button.active::before,
        .mode-button.active::before {
          opacity: 1;
        }

        .mode-button {
          font-size: 19px;
          border-radius: 12px;
        }

        .mode-button ha-icon {
          --mdc-icon-size: 19px;
        }

        .co2-row ha-icon,
        .temperature-row ha-icon {
          --mdc-icon-size: 18px;
        }
      </style>
      <ha-card>
        <ha-ripple></ha-ripple>
        <div class="error" hidden>
          <div class="error-title">Ошибка конфигурации бризера</div>
          <div class="error-message"></div>
        </div>
        <div class="card">
          <div class="header" data-action="breezer-popup" role="button" tabindex="0">
            <div class="icon-wrap">
              <ha-icon icon="mdi:air-filter"></ha-icon>
              <div class="badge"></div>
            </div>
            <div class="title">
              <div class="name"></div>
              <div class="secondary">
                <span class="secondary-part secondary-co2" data-action="header-co2-info" role="button" tabindex="0" aria-label="История CO2"></span>
                <span class="secondary-separator separator-co2-temperature"> • </span>
                <span class="secondary-part secondary-temperature" data-action="header-temperature-info" role="button" tabindex="0" aria-label="История температуры"></span>
                <span class="secondary-separator separator-temperature-speed"> • </span>
                <span class="secondary-part secondary-speed" data-action="header-speed-info" role="button" tabindex="0" aria-label="История скорости"></span>
                <span class="secondary-fallback"></span>
              </div>
            </div>
          </div>

          <div class="co2-row">
            <button type="button" data-action="co2-down" aria-label="Уменьшить целевой CO2"><ha-icon icon="mdi:minus"></ha-icon></button>
            <div class="value-info co2-info" data-action="co2-info" role="button" tabindex="0">
              <span class="co2-value"></span>
            </div>
            <button type="button" data-action="co2-up" aria-label="Увеличить целевой CO2"><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>

          <div class="speed-row">
            ${speedButtons}
          </div>

          <div class="temperature-row" hidden>
            <button type="button" data-action="temperature-down" aria-label="Уменьшить температуру нагрева"><ha-icon icon="mdi:minus"></ha-icon></button>
            <div class="value-info temperature-info" data-action="temperature-info" role="button" tabindex="0">
              <span class="temperature-value"></span>
            </div>
            <button type="button" data-action="temperature-up" aria-label="Увеличить температуру нагрева"><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>

          <div class="mode-row">
            <button type="button" class="mode-button" data-action="power" aria-label="Выключить бризер" aria-pressed="false">
              <ha-icon icon="mdi:fan-off"></ha-icon>
            </button>
            <button type="button" class="mode-button" data-action="heat" aria-label="Режим нагрева" aria-pressed="false">
              <ha-icon icon="mdi:fire"></ha-icon>
            </button>
            <button type="button" class="mode-button" data-action="fan" aria-label="Режим вентиляции" aria-pressed="false">
              <ha-icon icon="mdi:fan"></ha-icon>
            </button>
          </div>
        </div>
      </ha-card>
    `;

    const $ = (selector) => this.shadowRoot.querySelector(selector);
    this._els = {
      card: $("ha-card"),
      ripple: $("ha-ripple"),
      content: $(".card"),
      error: $(".error"),
      errorMessage: $(".error-message"),
      name: $(".name"),
      secondaryCo2: $(".secondary-co2"),
      secondaryTemperature: $(".secondary-temperature"),
      secondarySpeed: $(".secondary-speed"),
      secondaryFallback: $(".secondary-fallback"),
      separatorCo2Temperature: $(".separator-co2-temperature"),
      separatorTemperatureSpeed: $(".separator-temperature-speed"),
      badge: $(".badge"),
      co2Value: $(".co2-value"),
      co2Down: $('[data-action="co2-down"]'),
      co2Up: $('[data-action="co2-up"]'),
      temperatureRow: $(".temperature-row"),
      temperatureValue: $(".temperature-value"),
      temperatureDown: $('[data-action="temperature-down"]'),
      temperatureUp: $('[data-action="temperature-up"]'),
      speedButtons: Array.from(this.shadowRoot.querySelectorAll(".speed-button")),
      powerButton: $('[data-action="power"]'),
      heatButton: $('[data-action="heat"]'),
      fanButton: $('[data-action="fan"]'),
    };
  }

  _updateDom() {
    if (!this._els) return;

    const configError = this._configError();
    this._showConfigError(configError);
    if (configError) {
      this._els.ripple.disabled = true;
      return;
    }

    const climateState = this._state(this._entities.climate)?.state;
    const available = Boolean(climateState && climateState !== "unknown" && climateState !== "unavailable");
    const powerOn = this._state(this._entities.power)?.state === "on";
    const heaterOn = this._state(this._entities.heater)?.state === "on";
    const minFanSpeed = this._num(this._entities.minFanSpeed);
    const maxFanSpeed = this._num(this._entities.maxFanSpeed);
    const disabled = !available;
    const stateClass = !available ? "unavailable" : powerOn && heaterOn ? "heat" : powerOn ? "fan" : "off";

    this._els.card.className = stateClass;
    this._els.ripple.disabled = stateClass !== "fan" && stateClass !== "heat";
    this._els.name.textContent = this._name();
    this._updateSecondary();
    this._els.badge.textContent = this._fanSpeedText();
    this._els.co2Value.textContent = this._targetCo2Text();

    this._setDisabled(this._els.co2Down, disabled);
    this._setDisabled(this._els.co2Up, disabled);

    this._els.speedButtons.forEach((button) => {
      const speed = Number(button.dataset.speed);
      const active = minFanSpeed !== null && maxFanSpeed !== null && minFanSpeed <= speed && speed <= maxFanSpeed;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      this._setDisabled(button, disabled);
    });

    const showTemperature = powerOn && heaterOn;
    this._els.temperatureRow.hidden = !showTemperature;
    this._els.temperatureValue.textContent = this._heaterTemperatureText();
    this._setDisabled(this._els.temperatureDown, disabled);
    this._setDisabled(this._els.temperatureUp, disabled);

    this._updateModeButton(this._els.powerButton, !powerOn, disabled);
    this._updateModeButton(this._els.heatButton, powerOn && heaterOn, disabled);
    this._updateModeButton(this._els.fanButton, powerOn && !heaterOn, disabled);
  }

  _configError() {
    if (!this._hass) return null;

    for (const [name, entityId] of this._requiredEntities) {
      if (!entityId || !this._hass.states[entityId]) {
        return `Не найден entity "${name}": ${entityId || "не задан"}`;
      }
    }

    return null;
  }

  _showConfigError(message) {
    const hasError = Boolean(message);
    this._els.card.classList.toggle("config-error", hasError);
    this._els.error.hidden = !hasError;
    this._els.content.hidden = hasError;
    this._els.errorMessage.textContent = message || "";
  }

  _setDisabled(element, disabled) {
    if (!element) return;
    element.disabled = disabled;
  }

  _updateModeButton(button, active, disabled) {
    if (!button) return;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.disabled = disabled;
  }

  _updateSecondary() {
    const co2 = this._num(this._entities.currentCo2);
    const currentTemperature = Number(this._state(this._entities.climate)?.attributes?.current_temperature);
    const speed = this._num(this._entities.fanSpeed);
    const hasCo2 = co2 !== null;
    const hasTemperature = Number.isFinite(currentTemperature);
    const hasSpeed = speed !== null;
    const hasAny = hasCo2 || hasTemperature || hasSpeed;

    this._updateSecondaryPart(this._els.secondaryCo2, hasCo2, hasCo2 ? `${Math.round(co2)} ppm` : "");
    this._updateSecondaryPart(this._els.secondaryTemperature, hasTemperature, hasTemperature ? `${Math.round(currentTemperature)} °C` : "");
    this._updateSecondaryPart(this._els.secondarySpeed, hasSpeed, hasSpeed ? `${Math.round(speed)} скорость` : "");

    this._els.separatorCo2Temperature.hidden = !(hasCo2 && hasTemperature);
    this._els.separatorTemperatureSpeed.hidden = !((hasCo2 || hasTemperature) && hasSpeed);
    this._els.secondaryFallback.hidden = hasAny;
    if (!hasAny) {
      const STATE_LABELS = { off: "выкл.", heat: "нагрев", fan_only: "вентиляция", cool: "охлаждение", heat_cool: "авто" };
      const raw = this._stateValue(this._entities.climate, "");
      this._els.secondaryFallback.textContent = STATE_LABELS[raw] ?? raw;
    }
  }

  _updateSecondaryPart(element, visible, text) {
    element.hidden = !visible;
    element.textContent = text;
  }

  _handleClick(event) {
    if (this._lastPointerActivation && performance.now() - this._lastPointerActivation < 500) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this._activateFromEvent(event);
  }

  _handlePointerUp(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    this._lastPointerActivation = performance.now();
    this._activateFromEvent(event);
  }

  _handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    this._activateFromEvent(event);
  }

  _activateFromEvent(event) {
    const target = event.composedPath().find((node) => node?.dataset?.action);
    if (!target || target.disabled || !this._hass) return;
    event.preventDefault();
    event.stopPropagation();

    const action = target.dataset.action;
    if (action === "header-co2-info") {
      this._openMoreInfo(this._entities.currentCo2);
      return;
    }

    if (action === "header-temperature-info") {
      this._openMoreInfo(this._entities.climate);
      return;
    }

    if (action === "header-speed-info") {
      this._openMoreInfo(this._entities.fanSpeed);
      return;
    }

    if (action === "co2-info") {
      this._openMoreInfo(this._entities.targetCo2);
      return;
    }

    if (action === "breezer-popup") {
      this._executeTapAction();
      return;
    }

    if (action === "co2-down" || action === "co2-up") {
      this._changeTargetCo2(action === "co2-up" ? 1 : -1);
      return;
    }

    if (action === "temperature-info") {
      this._openMoreInfo(this._entities.heaterTemperature);
      return;
    }

    if (action === "temperature-down" || action === "temperature-up") {
      this._changeNumber(this._entities.heaterTemperature, action === "temperature-up" ? 1 : -1, 20, 1);
      return;
    }

    if (action === "speed") {
      this._handleSpeedSelection(Number(target.dataset.speed));
      return;
    }

    if (action === "power") {
      this._hass.callService("switch", "turn_off", { entity_id: this._entities.power });
      return;
    }

    if (action === "fan") {
      this._hass.callService("switch", "turn_off", { entity_id: this._entities.heater });
      return;
    }

    if (action === "heat") {
      this._hass.callService("switch", "turn_on", { entity_id: this._entities.heater });
    }
  }

  _handleSpeedSelection(speed) {
    if (!Number.isFinite(speed)) return;

    if (this._pendingSpeed !== undefined) {
      const min = Math.min(this._pendingSpeed, speed);
      const max = Math.max(this._pendingSpeed, speed);
      this._clearPendingSpeed();
      this._setFanSpeedRange(min, max);
      return;
    }

    this._setFanSpeedRange(speed, speed);
    this._pendingSpeed = speed;
    this._pendingSpeedTimer = window.setTimeout(() => this._clearPendingSpeed(), 2000);
  }

  _setFanSpeedRange(min, max) {
    this._hass.callService("number", "set_value", {
      entity_id: this._entities.minFanSpeed,
      value: min,
    });
    this._hass.callService("number", "set_value", {
      entity_id: this._entities.maxFanSpeed,
      value: max,
    });
  }

  _clearPendingSpeed() {
    if (this._pendingSpeedTimer) {
      window.clearTimeout(this._pendingSpeedTimer);
      this._pendingSpeedTimer = null;
    }
    this._pendingSpeed = undefined;
  }

  _executeTapAction() {
    const action = this.config.tap_action;
    if (!action || action.action === "more-info") {
      this._openMoreInfo(this._entities.climate);
      return;
    }
    if (action.action === "fire-dom-event") {
      const { action: _, ...detail } = action;
      this.dispatchEvent(new CustomEvent("ll-custom", {
        bubbles: true,
        composed: true,
        detail,
      }));
      return;
    }
    if (action.action === "navigate") {
      window.history.pushState(null, "", action.navigation_path);
      this.dispatchEvent(new CustomEvent("location-changed", {
        bubbles: true,
        composed: true,
        detail: { replace: false },
      }));
      return;
    }
    if (action.action === "call-service") {
      const [domain, service] = (action.service || "").split(".", 2);
      if (domain && service) {
        this._hass.callService(domain, service, action.service_data ?? {});
      }
      return;
    }
    if (action.action === "url") {
      window.open(action.url_path ?? action.url, "_blank");
      return;
    }
    // action: none или неизвестное — ничего не делаем
  }

  _openMoreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId },
    }));
  }

  _changeTargetCo2(direction) {
    this._changeNumber(this._entities.targetCo2, direction, 750, 50);
  }

  _changeNumber(entityId, direction, fallback, fallbackStep) {
    const target = this._state(entityId);
    const committed = Number(target?.state);

    const pending = this._pendingNumbers?.[entityId];
    const base = pending !== undefined
      ? pending.value
      : (Number.isFinite(committed) ? committed : fallback);

    const rawStep = Number(target?.attributes?.step);
    const step = rawStep > 0 ? rawStep : fallbackStep;
    const min = Number(target?.attributes?.min);
    const max = Number(target?.attributes?.max);
    let value = base + direction * step;
    if (Number.isFinite(min)) value = Math.max(min, value);
    if (Number.isFinite(max)) value = Math.min(max, value);

    if (!this._pendingNumbers) this._pendingNumbers = {};
    if (this._pendingNumbers[entityId]?.timer) {
      clearTimeout(this._pendingNumbers[entityId].timer);
    }
    this._pendingNumbers[entityId] = {
      value,
      timer: setTimeout(() => {
        this._hass.callService("number", "set_value", { entity_id: entityId, value });
        delete this._pendingNumbers[entityId];
      }, 300),
    };
    this._render();
  }

  _clearPendingNumbers() {
    if (!this._pendingNumbers) return;
    for (const { timer } of Object.values(this._pendingNumbers)) {
      clearTimeout(timer);
    }
    this._pendingNumbers = {};
  }
}

if (!customElements.get(TION_BREEZER_TILE_CARD_TAG)) {
  customElements.define(TION_BREEZER_TILE_CARD_TAG, TionBreezerTileCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: TION_BREEZER_TILE_CARD_TAG,
  name: "Tion Breezer Tile Card",
  description: "Tile-like card for Tion breezers",
});
