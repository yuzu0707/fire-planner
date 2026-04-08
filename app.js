(() => {
  const LOCAL_STORAGE_KEYS = ["fire-plans-local-v5", "fire-plans-v5", "fire-plans-v4"];
  const LOCAL_STORAGE_KEY = LOCAL_STORAGE_KEYS[0];
  const FM = window.FireModel;
  const Cloud = window.FireCloud;

  const form = document.getElementById("plannerForm");
  const principalWrap = document.getElementById("principalWrap");
  const savedPlansHost = document.getElementById("savedPlans");
  const principalPlansHost = document.getElementById("principalPlans");
  const loginButton = document.getElementById("loginButton");
  const logoutButton = document.getElementById("logoutButton");
  const accountMenu = document.getElementById("accountMenu");
  const accountPopover = document.getElementById("accountPopover");
  const avatarButton = document.getElementById("avatarButton");
  const avatarInitial = document.getElementById("avatarInitial");
  const accountMenuName = document.getElementById("accountMenuName");
  const authFeedback = document.getElementById("authFeedback");
  const stepPanels = Array.from(document.querySelectorAll(".step-panel"));
  const stepNav = document.getElementById("stepNav");
  const resultsPanel = document.getElementById("resultsPanel");
  const backToEditorButton = document.getElementById("backToEditorButton");
  const saveResultButton = document.getElementById("saveResultButton");
  const layout = document.querySelector(".layout");

  const state = {
    currentRecordId: null,
    selectedPlanViewId: null,
    session: null,
    records: [],
    recalcTimer: null,
    currentStep: 0,
    hasGenerated: false,
    accountMenuOpen: false,
  };

  const UNTITLED_PLAN = "未命名方案";
  const EMPTY_FORM_VALUES = Object.freeze({
    planName: "",
    retireAgeMode: FM.DEFAULTS.retireAgeMode,
    mortgageMode: FM.DEFAULTS.mortgageMode,
    withdrawalMode: FM.DEFAULTS.withdrawalMode,
    ...Object.fromEntries(FM.NUMERIC_FIELDS.map((field) => [field, ""])),
  });

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  }

  function setAuthFeedback(message = "", tone = "") {
    if (!authFeedback) {
      return;
    }

    authFeedback.textContent = message;
    authFeedback.hidden = !message;
    authFeedback.classList.toggle("is-error", tone === "error");
    authFeedback.classList.toggle("is-success", tone === "success");
  }

  function getAccountName() {
    const user = state.session?.user;
    return (
      user?.displayName ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      "已登录账号"
    );
  }

  function getAvatarText(name) {
    const text = String(name || "").trim();
    return text ? text[0].toUpperCase() : "余";
  }

  function setAccountMenuOpen(open) {
    const next = Boolean(open && state.session?.user);
    state.accountMenuOpen = next;

    if (accountPopover) {
      accountPopover.hidden = !next;
    }

    if (avatarButton) {
      avatarButton.setAttribute("aria-expanded", next ? "true" : "false");
    }

    if (accountMenu) {
      accountMenu.classList.toggle("open", next);
    }
  }

  function getRetireAgeNoun(values) {
    return values.retireAgeMode === "estimate" ? "建议退休年龄" : "目标退休年龄";
  }

  function getRetireAgeContext(values, retireAge) {
    if (!Number.isFinite(retireAge)) {
      return values.retireAgeMode === "estimate" ? "按系统建议退休年龄测算" : "按目标退休年龄测算";
    }

    return values.retireAgeMode === "estimate"
      ? `按建议退休年龄 ${FM.ageText(retireAge)} 测算`
      : `按目标退休年龄 ${FM.ageText(retireAge)} 测算`;
  }

  function withLegacyFormFields(snapshot = {}) {
    const next = { ...snapshot };
    const hasCommercialMonthly = next.commercialMonthly !== undefined && next.commercialMonthly !== "";
    const hasLegacyCommercialAnnual = next.commercialAnnual !== undefined && next.commercialAnnual !== "";

    if (!hasCommercialMonthly && hasLegacyCommercialAnnual) {
      const legacyAnnual = Number(next.commercialAnnual);
      next.commercialMonthly = Number.isFinite(legacyAnnual) ? legacyAnnual / 12 : "";
    }

    return next;
  }

  function getRadioValue(name, fallback) {
    const field = form.elements.namedItem(name);
    if (field instanceof RadioNodeList) {
      return field.value || fallback;
    }
    return field && field.value ? field.value : fallback;
  }

  function makeId() {
    return globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `plan-${Date.now()}`;
  }

  function loadLocalRecords() {
    for (const key of LOCAL_STORAGE_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) {
          continue;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // ignore broken storage and continue
      }
    }
    return [];
  }

  function saveLocalRecords(records) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  function isCloudMode() {
    return Boolean(state.session?.user && Cloud.isConfigured);
  }

  function getRawSnapshot() {
    const values = {
      planName: form.elements.namedItem("planName").value.trim(),
      retireAgeMode: getRadioValue("retireAgeMode", EMPTY_FORM_VALUES.retireAgeMode),
      mortgageMode: form.elements.namedItem("mortgageMode").value || EMPTY_FORM_VALUES.mortgageMode,
      withdrawalMode: getRadioValue("withdrawalMode", EMPTY_FORM_VALUES.withdrawalMode),
    };

    FM.NUMERIC_FIELDS.forEach((field) => {
      const input = form.elements.namedItem(field);
      values[field] = input ? input.value : "";
    });

    return values;
  }

  function applySnapshot(snapshot) {
    const values = { ...EMPTY_FORM_VALUES, ...withLegacyFormFields(snapshot) };

    Object.entries(values).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (!field) {
        return;
      }

      if (field instanceof RadioNodeList) {
        field.value = value || EMPTY_FORM_VALUES[key] || "";
        return;
      }

      field.value = value ?? "";
    });

    updateModeUI();
  }

  function updateModeUI() {
    const retireAgeMode = getRadioValue("retireAgeMode", FM.DEFAULTS.retireAgeMode);
    const mode = getRadioValue("withdrawalMode", FM.DEFAULTS.withdrawalMode);

    document.querySelectorAll(".choice").forEach((choice) => {
      const input = choice.querySelector('input[type="radio"]');
      choice.classList.toggle("active", !!input && input.checked);
    });

    const estimatingRetireAge = retireAgeMode === "estimate";
    const desiredRetireAgeField = document.getElementById("desiredRetireAgeField");
    const desiredRetireAgeLabel = document.getElementById("desiredRetireAgeLabel");
    const desiredRetireAgeHint = document.getElementById("desiredRetireAgeHint");
    const desiredRetireAgeInput = form.elements.namedItem("desiredRetireAge");
    const retireAgeEstimateNote = document.getElementById("retireAgeEstimateNote");
    const targetAgeField = document.getElementById("targetEndAgeField");
    const targetBalanceField = document.getElementById("targetEndBalanceField");
    const targetAgeInput = form.elements.namedItem("targetEndAge");
    const targetBalanceInput = form.elements.namedItem("targetEndBalance");

    desiredRetireAgeField.classList.toggle("disabled", estimatingRetireAge);
    desiredRetireAgeLabel.textContent = estimatingRetireAge ? "建议退休年龄" : "目标退休年龄";
    desiredRetireAgeInput.disabled = estimatingRetireAge;
    desiredRetireAgeInput.placeholder = estimatingRetireAge
      ? "无需填写，系统会自动生成建议退休年龄"
      : "如果你已经有明确退休时间，就在这里填写";
    desiredRetireAgeHint.textContent = estimatingRetireAge
      ? "这里不用填。等后面的资产、支出和退休后收入都填完后，系统会自动生成更稳妥的建议退休年龄。"
      : "如果你已经有明确退休时间，就在这里填写；如果还不确定，可以切到“请帮我估算退休时间”。";
    retireAgeEstimateNote.hidden = !estimatingRetireAge;
    principalWrap.classList.remove("disabled");
    targetAgeField.classList.remove("disabled");
    targetBalanceField.classList.remove("disabled");
    targetAgeInput.disabled = false;
    targetBalanceInput.disabled = false;
  }

  function renderAuthUI() {
    const loggedIn = Boolean(state.session?.user);

    if (loggedIn) {
      const accountName = getAccountName();
      accountMenuName.textContent = accountName;
      avatarInitial.textContent = getAvatarText(accountName);
      loginButton.hidden = true;
      accountMenu.hidden = false;
      return;
    }

    setAccountMenuOpen(false);
    accountMenu.hidden = true;
    loginButton.hidden = false;
  }

  async function refreshRecords() {
    if (isCloudMode()) {
      const { data, error } = await Cloud.listPlans(state.session.user.id);
      state.records = error ? [] : data;
      if (error) {
        setAuthFeedback(`云端读取失败：${error.message}`, "error");
      }
    } else {
      state.records = loadLocalRecords();
    }

    renderSavedPlans();
  }

  function renderSavedPlans() {
    if (!state.session?.user) {
      savedPlansHost.innerHTML = "";
      return;
    }

    if (!state.records.length) {
      savedPlansHost.innerHTML = '<div class="saved-item copy">还没有已保存的方案。</div>';
      return;
    }

    savedPlansHost.innerHTML = state.records
      .sort((left, right) => new Date(right.savedAt) - new Date(left.savedAt))
      .map((record) => {
        const values = FM.normalize(record.values);
        const pack = FM.computePack(values);
        const retireAgeMeta =
          values.retireAgeMode === "estimate"
            ? pack.analysisRetireAge
              ? `建议 ${escapeHtml(FM.ageText(pack.analysisRetireAge))}`
              : "建议年龄待测算"
            : `目标 ${escapeHtml(FM.ageText(values.desiredRetireAge))}`;
        return `
          <article class="saved-item">
            <strong>${escapeHtml(record.values.planName || UNTITLED_PLAN)}</strong>
            <div class="saved-meta">${retireAgeMeta} · 存款 ${escapeHtml(
              FM.money(values.currentSavings, true)
            )}</div>
            <div class="saved-meta">${escapeHtml(new Date(record.savedAt).toLocaleString("zh-CN"))}</div>
            <div class="saved-actions">
              <button type="button" data-load="${record.id}">载入</button>
              <button type="button" data-delete="${record.id}">删除</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function updateWizardUI() {
    const total = stepPanels.length;
    const step = Math.min(Math.max(state.currentStep, 0), total - 1);
    const stepLabels = stepPanels.map((panel) => panel.dataset.stepLabel || "未命名步骤");
    const stepCopies = [
      "先确认你是已经知道退休年龄，还是想让系统根据后面的资产、支出和退休后收入来帮你估算退休时间。",
      "这里确认资产积累速度、投资收益和通胀口径，系统会自动折算成真实购买力。",
      "把真正会影响 FIRE 的硬支出都填进去，房贷、车贷和保险都单独算。",
      "养老金、商业保险和退休后兼职收入会按年龄节点逐年加入现金流。",
      "最后告诉系统：你想活到几岁，那时本金还想剩多少，结果区就会开始分析。",
    ];

    state.currentStep = step;

    stepPanels.forEach((panel, index) => {
      panel.classList.toggle("active", index === step);
    });

    stepNav.innerHTML = stepLabels
      .map(
        (label, index) => `
          <button type="button" class="step-chip${index === step ? " active" : ""}${index < step ? " done" : ""}" data-step-go="${index}">
            <strong>第 ${index + 1} 步</strong>
            <small>${escapeHtml(label)}</small>
          </button>
        `
      )
      .join("");

    setText("wizardTitle", `第 ${step + 1} 步：${stepLabels[step]}`);
    setText("wizardCopy", stepCopies[step] || "一步一步填写，最后统一生成结果分析。");

    const prevButton = document.getElementById("prevStepButton");
    const nextButton = document.getElementById("nextStepButton");
    const submitButton = document.getElementById("submitButton");

    prevButton.hidden = step === 0;
    nextButton.hidden = step === total - 1;
    submitButton.hidden = step !== total - 1;
  }

  function updateResultsGate() {
    resultsPanel.classList.toggle("pending", !state.hasGenerated);
    resultsPanel.hidden = !state.hasGenerated;
    if (layout) {
      layout.classList.toggle("with-results", state.hasGenerated);
    }
  }

  function renderModeCards(values, pack) {
    if (!state.hasGenerated) {
      setText("modeGrowthAge", "--");
      setText("modeGrowthCopy", "点击“生成结果”后显示");
      setText("modePrincipalAge", "--");
      setText("modePrincipalCopy", "点击“生成结果”后显示");

      document.querySelectorAll("[data-mode-pick]").forEach((button) => {
        button.classList.toggle("active", button.dataset.modePick === values.withdrawalMode);
      });
      return;
    }

    setText("modeGrowthAge", pack.growth ? FM.ageText(pack.growth.retireAge) : "不可达");
    setText(
      "modeGrowthCopy",
      pack.growth ? FM.yearsText(pack.growth.retireAge - values.currentAge) : "当前条件下这套退休方案还不够稳妥"
    );

    setText("modePrincipalAge", pack.principal ? FM.ageText(pack.principal.retireAge) : "不可达");
    setText(
      "modePrincipalCopy",
      pack.principal
        ? `${FM.yearsText(pack.principal.retireAge - values.currentAge)} · ${pack.selectedObjective.label}`
        : `当前条件下无法满足“${pack.selectedObjective.label}”`
    );

    document.querySelectorAll("[data-mode-pick]").forEach((button) => {
      button.classList.toggle("active", button.dataset.modePick === values.withdrawalMode);
    });
  }

  function renderInflationNote(values) {
    if (values.inflationRate <= 0) {
      setText("inflationNote", "当前按名义收益率计算，页面金额与输入口径一致。");
      return;
    }

    setText(
      "inflationNote",
      `按 ${FM.percentText(values.inflationRate * 100)} 通胀折算后，退休前实际收益率约 ${FM.percentText(
        values.realPreReturn * 100
      )}，FIRE 后实际收益率约 ${FM.percentText(values.realPostReturn * 100)}。`
    );
  }

  function renderPension(values) {
    setText("pensionPreview", FM.money(values.pension.monthly, true));
  }

  function renderSideIncome(values) {
    setText("sideAnnualPreview", FM.money(values.sideAnnual, true));
  }

  function renderMortgage(values) {
    const firstYear = values.mortgageSchedule[0] || 0;
    const secondYear = values.mortgageSchedule[1] || 0;
    const modeLabel = values.mortgageMode === "equalPayment" ? "等额本息" : "等额本金";

    if (values.mortgageYearsEffective === 0 || firstYear <= 0) {
      setText("mortgageNote", "当前没有有效房贷数据，房贷支出按 0 处理。");
      return;
    }

    setText(
      "mortgageNote",
      `${modeLabel}下按当前账单推算，首年房贷约 ${FM.money(firstYear, true)}${secondYear > 0 ? `，第二年约 ${FM.money(
        secondYear,
        true
      )}` : ""}。`
    );
  }

  function renderStrategyNote(values) {
    setText(
      "strategyNote",
      `这里会按“活到 ${FM.ageText(values.targetEndAge)}、那时本金还剩 ${FM.money(values.targetEndBalance, true)}”来反推年度总预算。不论你上面选的是哪种主结果展示方式，这里的本金目标都会一起参与测算。`
    );
  }

  function renderHeadline(values, pack) {
    const modeLabel =
      values.withdrawalMode === "growth" ? "当前退休方案的合理性和详细规划" : `按“${pack.selectedObjective.label}”`;
    const fallback = values.withdrawalMode === "growth" ? pack.growth : pack.principal;

    if (values.retireAgeMode === "estimate") {
      if (!fallback) {
        setText("headlineTitle", "暂时推不出建议退休年龄");
        setText("headlineCopy", `按 ${modeLabel} 测算，这组参数下暂时推不出稳妥的退休时间。`);
        return;
      }

      setText(
        "headlineTitle",
        fallback.retireAge <= values.currentAge ? "你现在就可以 FIRE" : `建议 ${fallback.retireAge} 岁开始 FIRE`
      );
      setText(
        "headlineCopy",
        `按 ${modeLabel} 测算，结合你填写的资产、支出和退休后收入，更稳妥的退休时间大约是 ${FM.ageText(fallback.retireAge)}。`
      );
      return;
    }

    if (!fallback) {
      setText("headlineTitle", "当前条件下难以稳定退休");
      setText("headlineCopy", `即使放宽到更晚退休，这组参数下也很难满足“${modeLabel}”这条路径。`);
      return;
    }

    setText(
      "headlineTitle",
      fallback.retireAge <= values.currentAge ? "你现在就可以 FIRE" : `预计 ${fallback.retireAge} 岁可以 FIRE`
    );

    if (pack.target.sustainable) {
      if (fallback.retireAge < values.desiredRetireAge) {
        setText(
          "headlineCopy",
          `按 ${modeLabel} 测算，你的目标 ${FM.ageText(values.desiredRetireAge)} 可达，而且理论上最早可以提前到 ${FM.ageText(
            fallback.retireAge
          )}。`
        );
      } else {
        setText("headlineCopy", `按 ${modeLabel} 测算，你的目标退休年龄可达。`);
      }
    } else {
      setText(
        "headlineCopy",
        `如果坚持 ${FM.ageText(values.desiredRetireAge)} 退休并采用 ${modeLabel}，现金流还不够稳妥；更稳妥的年龄约是 ${FM.ageText(
          fallback.retireAge
        )}。`
      );
    }
  }

  function renderMetrics(values, pack) {
    const scenario = pack.display || (values.withdrawalMode === "growth" ? pack.growth : pack.principal);
    const finalLabel =
      values.withdrawalMode === "growth"
        ? "寿命末剩余本金"
        : scenario && scenario.objective
          ? `${FM.ageText(scenario.horizonAge)}时剩余本金`
          : "终点剩余本金";

    setText("metricYearsLabel", values.retireAgeMode === "estimate" ? "距离建议退休" : "距离最早 FIRE");
    setText(
      "metricTargetGapLabel",
      values.retireAgeMode === "estimate" ? "建议年龄资金缺口 / 富余" : "目标年龄资金缺口 / 富余"
    );
    setText("metricFinalLabel", finalLabel);
    setText("metricYears", scenario ? FM.yearsText(scenario.retireAge - values.currentAge) : "不可达");
    setText("metricRetireBalance", scenario ? FM.money(scenario.balanceAtRetire, true) : "--");
    setText(
      "metricTargetGap",
      pack.gap === null ? "--" : pack.gap >= 0 ? `富余 ${FM.money(pack.gap, true)}` : `缺口 ${FM.money(Math.abs(pack.gap), true)}`
    );
    setText("metricFinalBalance", scenario ? FM.money(scenario.finalBalance, true) : "--");
  }

  function chartMarkup(values, scenario) {
    const points = scenario.points;

    if (!points || points.length < 2) {
      return '<div class="copy">暂无可展示曲线。</div>';
    }

    const width = 700;
    const height = 240;
    const padding = { top: 16, right: 18, bottom: 34, left: 18 };
    const maxBalance = Math.max(...points.map((point) => point.balance), 1);
    const ageStart = points[0].age;
    const ageEnd = points[points.length - 1].age;
    const xRange = Math.max(ageEnd - ageStart, 1);

    const getX = (age) => padding.left + ((age - ageStart) / xRange) * (width - padding.left - padding.right);
    const getY = (balance) => height - padding.bottom - (balance / maxBalance) * (height - padding.top - padding.bottom);

    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${getX(point.age).toFixed(2)} ${getY(point.balance).toFixed(2)}`)
      .join(" ");
    const area = `${path} L ${getX(points[points.length - 1].age).toFixed(2)} ${height - padding.bottom} L ${getX(
      points[0].age
    ).toFixed(2)} ${height - padding.bottom} Z`;

    const grid = [0, 0.33, 0.66, 1]
      .map((ratio) => {
        const value = maxBalance * ratio;
        const y = getY(value);
        return `
          <line class="gridline" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>
          <text class="tick" x="${width - padding.right}" y="${y - 6}" text-anchor="end">${escapeHtml(
            FM.money(value, true)
          )}</text>
        `;
      })
      .join("");

    const markers = [
      { age: values.currentAge, label: "现在" },
      { age: scenario.retireAge, label: "FIRE" },
      { age: values.pensionStartAge, label: "养老金" },
    ].filter((marker) => marker.age >= ageStart && marker.age <= ageEnd);

    const markerSvg = markers
      .map((marker) => {
        const x = getX(marker.age);
        const point =
          points.find((item) => item.age === marker.age) ||
          points.reduce((closest, current) =>
            Math.abs(current.age - marker.age) < Math.abs(closest.age - marker.age) ? current : closest
          );
        const y = getY(point.balance);

        return `
          <line class="mark-line" x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}"></line>
          <circle class="mark-dot" cx="${x}" cy="${y}" r="6"></circle>
          <text class="label" x="${x}" y="${height - 12}" text-anchor="middle">${escapeHtml(marker.label)}</text>
        `;
      })
      .join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="本金轨迹图">
        <defs>
          <linearGradient id="curveFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(255,122,26,0.32)"></stop>
            <stop offset="100%" stop-color="rgba(255,122,26,0.02)"></stop>
          </linearGradient>
        </defs>
        <line class="axis" x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${
          height - padding.bottom
        }"></line>
        ${grid}
        <path class="area" d="${area}"></path>
        <path class="line" d="${path}"></path>
        ${markerSvg}
        <text class="tick" x="${padding.left}" y="${height - 12}">${escapeHtml(FM.ageText(ageStart))}</text>
        <text class="tick" x="${width - padding.right}" y="${height - 12}" text-anchor="end">${escapeHtml(
          FM.ageText(ageEnd)
        )}</text>
      </svg>
    `;
  }

  function deltaCopy(plan) {
    if (!plan || plan.delta === null) {
      return "";
    }
    if (plan.delta > 1000) {
      return `比你当前填写的退休首年支出多 ${FM.money(plan.delta, true)}。`;
    }
    if (plan.delta < -1000) {
      return `比你当前填写的退休首年支出少 ${FM.money(Math.abs(plan.delta), true)}。`;
    }
    return "和你当前填写的退休首年支出差不多。";
  }

  function objectiveCardCopy(plan, values, retireAge) {
    if (!plan.budget) {
      return `如果目标是“${plan.label}”，${getRetireAgeContext(values, retireAge)}，这组参数下暂时还推不出可行的年度预算。`;
    }

    const rule = plan.budget.objective;
    const targetCopy =
      rule.kind === "reserve"
        ? `目标是活到 ${FM.ageText(rule.endAge)} 时仍保留 ${FM.money(rule.reserveBalance, true)}`
        : rule.kind === "forever"
          ? "目标是活到 120 岁时尽量保住退休时本金"
          : `目标是到 ${FM.ageText(rule.endAge)} 时把本金大致安排完`;

    return `${targetCopy}。${getRetireAgeContext(values, retireAge)}，从退休开始每年总可花约 ${FM.money(
      plan.budget.spendReal,
      true
    )}。${deltaCopy(plan)}`;
  }

  function renderPrincipalPlans(values, pack) {
    if (!pack.principalPlans.length) {
      principalPlansHost.innerHTML = '<div class="saved-item copy">当前模式下暂时还推不出可用的本金使用方案。</div>';
      return;
    }

    principalPlansHost.innerHTML = pack.principalPlans
      .map((plan) => {
        const active = plan.id === state.selectedPlanViewId ? " active" : "";
        const amount = plan.budget ? `每年可花约 ${FM.money(plan.budget.spendReal, true)}` : "暂时不可达";

        return `
          <button type="button" class="plan-card${active}" data-plan-view="${escapeHtml(plan.id)}">
            <span>${escapeHtml(`目标：${plan.label}`)}</span>
            <strong>${escapeHtml(amount)}</strong>
            <small>${escapeHtml(objectiveCardCopy(plan, values, pack.analysisRetireAge))}</small>
          </button>
        `;
      })
      .join("");
  }

  function renderAdvice(pack) {
    const host = document.getElementById("adviceList");
    const advice = pack.advice.length ? pack.advice : ["当前参数下没有额外建议。"];

    host.innerHTML = advice.map((item) => `<div class="advice-item">${escapeHtml(item)}</div>`).join("");
  }

  function renderYearlyRows(values, selectedPlan, retireAge) {
    const title = document.getElementById("yearlyPlanTitle");
    const copy = document.getElementById("yearlyPlanCopy");
    const body = document.getElementById("yearlyRows");

    if (!selectedPlan) {
      title.textContent = "年度本金明细";
      copy.textContent = "还没有选中本金方案。";
      body.innerHTML = '<tr><td colspan="8">请先选择一个本金方案。</td></tr>';
      return;
    }

    title.textContent = `目标：${selectedPlan.label}｜年度本金明细`;

    if (!selectedPlan.budget) {
      copy.textContent = `${getRetireAgeContext(values, retireAge)}，这个目标下暂时还没有可行预算。`;
      body.innerHTML = `<tr><td colspan="8">${escapeHtml(
        `${getRetireAgeContext(values, retireAge)}，“${selectedPlan.label}”暂时还生成不了年度明细。`
      )}</td></tr>`;
      return;
    }

    copy.textContent = `${getRetireAgeContext(values, retireAge)}。前两列金额是按今天购买力折算，后两列是换算成对应年份的名义金额。${selectedPlan.budget.objective.description}`;
    body.innerHTML = selectedPlan.budget.rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(FM.ageText(row.age))}</td>
            <td>${escapeHtml(FM.percentText((row.inflationFactor - 1) * 100))}</td>
            <td><strong>${escapeHtml(FM.money(row.startBalance, true))}</strong></td>
            <td>${escapeHtml(FM.money(row.externalIncomeReal, true))}</td>
            <td>${escapeHtml(FM.money(row.spendReal, true))}</td>
            <td>${escapeHtml(FM.money(row.externalIncomeNominal, true))}</td>
            <td>${escapeHtml(FM.money(row.spendNominal, true))}</td>
            <td><strong>${escapeHtml(FM.money(row.endBalance, true))}</strong></td>
          </tr>
        `
      )
      .join("");
  }

  function recalculate() {
    const values = FM.normalize(getRawSnapshot());
    const pack = FM.computePack(values, state.selectedPlanViewId);
    const scenario = pack.display || (values.withdrawalMode === "growth" ? pack.growth : pack.principal);

    state.selectedPlanViewId = pack.selectedPlanId;

    renderModeCards(values, pack);
    renderInflationNote(values);
    renderPension(values);
    renderSideIncome(values);
    renderMortgage(values);
    renderStrategyNote(values);
    renderHeadline(values, pack);
    renderMetrics(values, pack);
    renderAdvice(pack);
    renderPrincipalPlans(values, pack);
    renderYearlyRows(values, pack.selectedPlan, pack.analysisRetireAge);

    document.getElementById("chartHost").innerHTML = scenario
      ? chartMarkup(values, scenario)
      : '<div class="copy">当前参数下没有可持续退休曲线。</div>';

    setText(
      "chartCaption",
      scenario
        ? values.withdrawalMode === "growth"
          ? `当前显示的是 ${FM.ageText(scenario.retireAge)} 退休后的本金轨迹，终点按 ${FM.ageText(values.lifeExpectancy)} 寿命展示。`
          : `当前显示的是 ${FM.ageText(scenario.retireAge)} 退休后的本金轨迹，终点按“${scenario.objective.label}”处理。`
        : "请调整参数后再试。"
    );

    updateResultsGate();
  }

  function scheduleRecalc() {
    clearTimeout(state.recalcTimer);
    state.recalcTimer = setTimeout(recalculate, 120);
  }

  async function saveCurrentPlan() {
    const values = getRawSnapshot();
    const record = {
      id: state.currentRecordId || makeId(),
      savedAt: new Date().toISOString(),
      values,
    };

    if (isCloudMode()) {
      const { error } = await Cloud.savePlan(record, state.session.user.id);
      if (error) {
        setAuthFeedback(`云端保存失败：${error.message}`, "error");
        return;
      }
    } else {
      const records = loadLocalRecords();
      const index = records.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        records[index] = record;
      } else {
        records.push(record);
      }
      const { error } = saveLocalRecords(records);
      if (error) {
        setAuthFeedback(`本地保存失败：${error.message}`, "error");
        return;
      }
    }

    state.currentRecordId = record.id;
    await refreshRecords();
    setAuthFeedback(isCloudMode() ? "已保存到云端账号。" : "已保存到本地浏览器。", "success");
  }

  function resetDefaults() {
    state.currentRecordId = null;
    state.selectedPlanViewId = null;
    state.currentStep = 0;
    state.hasGenerated = false;
    applySnapshot(EMPTY_FORM_VALUES);
    updateWizardUI();
    recalculate();
  }

  function returnToEditor() {
    state.hasGenerated = false;
    updateResultsGate();
    recalculate();
  }

  async function handleSavedActions(event) {
    const loadTarget = event.target.closest("[data-load]");
    const deleteTarget = event.target.closest("[data-delete]");

    if (loadTarget) {
      const record = state.records.find((item) => item.id === loadTarget.getAttribute("data-load"));
      if (!record) {
        return;
      }
      setAccountMenuOpen(false);
      state.currentRecordId = record.id;
      state.selectedPlanViewId = null;
      state.hasGenerated = true;
      applySnapshot(record.values);
      updateWizardUI();
      recalculate();
      return;
    }

    if (deleteTarget) {
      const id = deleteTarget.getAttribute("data-delete");
      if (isCloudMode()) {
        const { error } = await Cloud.deletePlan(id, state.session.user.id);
        if (error) {
          setAuthFeedback(`云端删除失败：${error.message}`, "error");
          return;
        }
      } else {
        const next = loadLocalRecords().filter((item) => item.id !== id);
        const { error } = saveLocalRecords(next);
        if (error) {
          setAuthFeedback(`本地删除失败：${error.message}`, "error");
          return;
        }
      }

      if (state.currentRecordId === id) {
        state.currentRecordId = null;
      }
      await refreshRecords();
    }
  }

  function handlePlanSelection(event) {
    const button = event.target.closest("[data-plan-view]");
    if (!button) {
      return;
    }
    state.selectedPlanViewId = button.getAttribute("data-plan-view");
    recalculate();
  }

  function handleStepNavigation(event) {
    const button = event.target.closest("[data-step-go]");
    if (!button) {
      return;
    }
    state.currentStep = Number(button.getAttribute("data-step-go")) || 0;
    updateWizardUI();
  }

  function handleAvatarToggle(event) {
    event.stopPropagation();
    setAccountMenuOpen(!state.accountMenuOpen);
  }

  function handleDocumentClick(event) {
    if (!state.accountMenuOpen || accountMenu?.contains(event.target)) {
      return;
    }
    setAccountMenuOpen(false);
  }

  function handleDocumentKeydown(event) {
    if (event.key === "Escape") {
      setAccountMenuOpen(false);
    }
  }

  async function handleLogin() {
    if (!Cloud.isConfigured) {
      setAuthFeedback("请先在 config.js 里填好 Firebase Web 配置，再启用 Google 登录。", "error");
      return;
    }

    const { error } = await Cloud.signInWithGoogle();
    if (error) {
      setAuthFeedback(`登录启动失败：${error.message}`, "error");
    }
  }

  async function handleLogout() {
    const { error } = await Cloud.signOut();
    if (error) {
      setAuthFeedback(`退出失败：${error.message}`, "error");
      return;
    }

    setAccountMenuOpen(false);
    setAuthFeedback("");
  }

  async function refreshSession() {
    if (!Cloud.isConfigured) {
      state.session = null;
      renderAuthUI();
      await refreshRecords();
      return;
    }

    const { session, error } = await Cloud.getSession();
    state.session = session;

    if (error) {
      setAuthFeedback(`会话读取失败：${error.message}`, "error");
    }

    renderAuthUI();
    await refreshRecords();
  }

  function bindEvents() {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      state.hasGenerated = true;
      recalculate();
    });

    form.addEventListener("input", scheduleRecalc);
    form.addEventListener("change", () => {
      updateModeUI();
      scheduleRecalc();
    });

    document.querySelectorAll("[data-mode-pick]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.modePick;
        const radio = form.querySelector(`input[name="withdrawalMode"][value="${mode}"]`);
        if (!radio) {
          return;
        }
        radio.checked = true;
        updateModeUI();
        recalculate();
      });
    });

    document.getElementById("saveButton").addEventListener("click", saveCurrentPlan);
    document.getElementById("resetButton").addEventListener("click", resetDefaults);
    backToEditorButton.addEventListener("click", returnToEditor);
    saveResultButton.addEventListener("click", saveCurrentPlan);
    document.getElementById("prevStepButton").addEventListener("click", () => {
      state.currentStep = Math.max(state.currentStep - 1, 0);
      updateWizardUI();
    });
    document.getElementById("nextStepButton").addEventListener("click", () => {
      state.currentStep = Math.min(state.currentStep + 1, stepPanels.length - 1);
      updateWizardUI();
    });
    loginButton.addEventListener("click", handleLogin);
    logoutButton.addEventListener("click", handleLogout);
    avatarButton.addEventListener("click", handleAvatarToggle);
    savedPlansHost.addEventListener("click", handleSavedActions);
    principalPlansHost.addEventListener("click", handlePlanSelection);
    stepNav.addEventListener("click", handleStepNavigation);
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeydown);
  }

  async function init() {
    applySnapshot(EMPTY_FORM_VALUES);
    updateModeUI();
    updateWizardUI();
    renderAuthUI();
    renderSavedPlans();
    recalculate();
    bindEvents();
    await refreshSession();

    if (Cloud.isConfigured) {
      Cloud.onAuthChange(async (session) => {
        state.session = session;
        renderAuthUI();
        await refreshRecords();
      });
    }
  }

  init();
})();
