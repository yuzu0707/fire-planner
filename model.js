(() => {
  const PLAN_AGES = [65, 75, 90, 100, 110, 120];

  const DEFAULTS = {
    planName: "我的 FIRE 方案",
    retireAgeMode: "known",
    currentAge: 32,
    desiredRetireAge: 45,
    lifeExpectancy: 90,
    currentSavings: 900000,
    annualSavings: 260000,
    annualSavingsGrowth: 0,
    preReturn: 6,
    postReturn: 4,
    inflationRate: 2.5,
    livingExpense: 180000,
    otherExpense: 24000,
    commercialProtectionAnnual: 18000,
    commercialProtectionYears: 18,
    residentTopupAnnual: 6000,
    residentTopupYears: 15,
    mortgageMode: "equalPayment",
    mortgageYears: 10,
    mortgagePeriodsPerYear: 12,
    mortgageRate: 3.2,
    mortgageCurrentPrincipal: 3100,
    mortgageCurrentInterest: 3500,
    mortgageNextPrincipal: 3110,
    mortgageNextInterest: 3490,
    carAnnual: 18000,
    carYears: 3,
    pensionStartAge: 60,
    pensionBalanceAtRetire: 160000,
    pensionYearsAtRetire: 15,
    pensionTopupYears: 3,
    pensionTopupCost: 12000,
    commercialStartAge: 58,
    commercialMonthly: 4200,
    commercialDuration: 20,
    sideStartAge: 45,
    sideHourly: 60,
    sideWeeklyHours: 8,
    sideWeeks: 40,
    sideDuration: 10,
    withdrawalMode: "growth",
    targetEndAge: 90,
    targetEndBalance: 0,
  };

  const NUMERIC_FIELDS = [
    "currentAge",
    "desiredRetireAge",
    "lifeExpectancy",
    "currentSavings",
    "annualSavings",
    "annualSavingsGrowth",
    "preReturn",
    "postReturn",
    "inflationRate",
    "livingExpense",
    "otherExpense",
    "commercialProtectionAnnual",
    "commercialProtectionYears",
    "residentTopupAnnual",
    "residentTopupYears",
    "mortgageYears",
    "mortgagePeriodsPerYear",
    "mortgageRate",
    "mortgageCurrentPrincipal",
    "mortgageCurrentInterest",
    "mortgageNextPrincipal",
    "mortgageNextInterest",
    "carAnnual",
    "carYears",
    "pensionStartAge",
    "pensionBalanceAtRetire",
    "pensionYearsAtRetire",
    "pensionTopupYears",
    "pensionTopupCost",
    "commercialStartAge",
    "commercialMonthly",
    "commercialDuration",
    "sideStartAge",
    "sideHourly",
    "sideWeeklyHours",
    "sideWeeks",
    "sideDuration",
    "targetEndAge",
    "targetEndBalance",
  ];

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function numberOrZero(value) {
    if (value === "" || value === null || value === undefined) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function average(values) {
    const valid = values.filter((value) => Number.isFinite(value) && value > 0);
    if (!valid.length) {
      return 0;
    }
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  function realRate(nominalRate, inflationRate) {
    return (1 + nominalRate) / (1 + inflationRate) - 1;
  }

  function inflationFactorAt(values, yearsFromNow) {
    return Math.pow(1 + values.inflationRate, Math.max(0, yearsFromNow));
  }

  function money(value, compact = false) {
    if (!Number.isFinite(value)) {
      return "--";
    }

    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";

    if (compact) {
      if (abs >= 100000000) {
        return `${sign}${(abs / 100000000).toFixed(abs >= 1000000000 ? 1 : 2)} 亿元`;
      }
      if (abs >= 10000) {
        return `${sign}${(abs / 10000).toFixed(abs >= 1000000 ? 1 : 2)} 万元`;
      }
    }

    return `${sign}${new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 0,
    }).format(abs)}`;
  }

  function ageText(age) {
    return Number.isFinite(age) ? `${Math.round(age)} 岁` : "--";
  }

  function percentText(value) {
    return Number.isFinite(value) ? `${value.toFixed(1)}%` : "--";
  }

  function yearsText(years) {
    if (!Number.isFinite(years)) {
      return "--";
    }
    return years <= 0 ? "现在可退休" : `还需 ${years} 年`;
  }

  function estimatePension(values) {
    const adjustedBalance = values.pensionBalanceAtRetire + (values.pensionTopupYears * values.pensionTopupCost) / 3;
    const adjustedYears = values.pensionYearsAtRetire + values.pensionTopupYears;
    const monthly = adjustedBalance / 100 + adjustedYears * 100;

    return {
      adjustedBalance,
      adjustedYears,
      monthly,
      annual: monthly * 12,
    };
  }

  function buildMortgageSchedule(values) {
    const years = Math.max(0, Math.round(values.mortgageYears));
    const periodsPerYear = clamp(Math.round(values.mortgagePeriodsPerYear), 1, 24);
    const totalPeriods = years * periodsPerYear;

    if (years === 0 || totalPeriods === 0) {
      return [];
    }

    const currentPrincipal = Math.max(0, values.mortgageCurrentPrincipal);
    const currentInterest = Math.max(0, values.mortgageCurrentInterest);
    const nextPrincipal = Math.max(0, values.mortgageNextPrincipal);
    const nextInterest = Math.max(0, values.mortgageNextInterest);
    const currentPayment = currentPrincipal + currentInterest;
    const nextPayment = nextPrincipal + nextInterest;
    const ratePerPeriod = values.mortgageRate / periodsPerYear;
    const yearly = new Array(years).fill(0);

    if (currentPayment <= 0 && nextPayment <= 0) {
      return yearly;
    }

    if (values.mortgageMode === "equalPrincipal") {
      const principalFromDiff =
        ratePerPeriod > 0 && currentInterest > nextInterest ? (currentInterest - nextInterest) / ratePerPeriod : 0;
      const principalPerPeriod = average([currentPrincipal, nextPrincipal, principalFromDiff]);
      let balance =
        ratePerPeriod > 0 && currentInterest > 0 ? currentInterest / ratePerPeriod : principalPerPeriod * totalPeriods;

      for (let period = 0; period < totalPeriods && balance > 0.01; period += 1) {
        const fallbackInterest = Math.max(currentInterest - period * Math.max(currentInterest - nextInterest, 0), 0);
        const interest = ratePerPeriod > 0 ? balance * ratePerPeriod : fallbackInterest;
        const principal = Math.min(principalPerPeriod || currentPrincipal || nextPrincipal || currentPayment, balance);
        yearly[Math.floor(period / periodsPerYear)] += principal + interest;
        balance = Math.max(balance - principal, 0);
      }

      return yearly;
    }

    const paymentPerPeriod = average([currentPayment, nextPayment]);
    const fallbackPrincipal = average([currentPrincipal, nextPrincipal]);
    let balance =
      ratePerPeriod > 0 && currentInterest > 0
        ? currentInterest / ratePerPeriod
        : ratePerPeriod > 0
          ? (paymentPerPeriod * (1 - Math.pow(1 + ratePerPeriod, -totalPeriods))) / ratePerPeriod
          : paymentPerPeriod * totalPeriods;

    for (let period = 0; period < totalPeriods && balance > 0.01; period += 1) {
      const interest = ratePerPeriod > 0 ? balance * ratePerPeriod : 0;
      let principal = paymentPerPeriod - interest;

      if (principal <= 0.01) {
        principal = fallbackPrincipal > 0 ? fallbackPrincipal : paymentPerPeriod;
      }

      principal = Math.min(principal, balance);
      yearly[Math.floor(period / periodsPerYear)] += principal + interest;
      balance = Math.max(balance - principal, 0);
    }

    return yearly;
  }

  function normalize(raw) {
    const source = raw || {};
    const values = { ...source };
    const hasCommercialMonthly = source.commercialMonthly !== undefined && source.commercialMonthly !== "";
    const hasLegacyCommercialAnnual = source.commercialAnnual !== undefined && source.commercialAnnual !== "";

    values.planName = typeof source.planName === "string" ? source.planName.trim() : "";
    values.retireAgeMode = values.retireAgeMode === "estimate" ? "estimate" : "known";
    values.mortgageMode = values.mortgageMode === "equalPrincipal" ? "equalPrincipal" : "equalPayment";
    values.withdrawalMode = values.withdrawalMode === "principal" ? "principal" : "growth";

    const hasTargetEndAge = source.targetEndAge !== "" && source.targetEndAge !== null && source.targetEndAge !== undefined;

    values.currentAge = clamp(Math.round(numberOrZero(values.currentAge)), 18, 100);
    values.lifeExpectancy = clamp(Math.round(numberOrZero(values.lifeExpectancy)), values.currentAge + 1, 120);
    values.desiredRetireAge = clamp(Math.round(numberOrZero(values.desiredRetireAge)), values.currentAge, values.lifeExpectancy - 1);
    values.targetEndAge = clamp(
      Math.round(hasTargetEndAge ? numberOrZero(values.targetEndAge) : values.lifeExpectancy),
      values.currentAge + 1,
      120
    );

    [
      "commercialProtectionYears",
      "residentTopupYears",
      "mortgageYears",
      "mortgagePeriodsPerYear",
      "carYears",
      "pensionStartAge",
      "pensionYearsAtRetire",
      "pensionTopupYears",
      "commercialStartAge",
      "commercialDuration",
      "sideStartAge",
      "sideDuration",
    ].forEach((field) => {
      const caps = {
        commercialProtectionYears: 60,
        residentTopupYears: 60,
        mortgageYears: 60,
        mortgagePeriodsPerYear: 24,
        carYears: 20,
        pensionStartAge: 100,
        pensionYearsAtRetire: 60,
        pensionTopupYears: 20,
        commercialStartAge: 100,
        commercialDuration: 80,
        sideStartAge: 100,
        sideDuration: 60,
      };
      values[field] = clamp(Math.round(numberOrZero(values[field])), 0, caps[field]);
    });

    [
      "currentSavings",
      "annualSavings",
      "livingExpense",
      "otherExpense",
      "commercialProtectionAnnual",
      "residentTopupAnnual",
      "mortgageCurrentPrincipal",
      "mortgageCurrentInterest",
      "mortgageNextPrincipal",
      "mortgageNextInterest",
      "carAnnual",
      "pensionBalanceAtRetire",
      "pensionTopupCost",
      "commercialMonthly",
      "sideHourly",
      "sideWeeklyHours",
      "targetEndBalance",
    ].forEach((field) => {
      values[field] = Math.max(0, numberOrZero(values[field]));
    });

    if (!hasCommercialMonthly && hasLegacyCommercialAnnual) {
      values.commercialMonthly = Math.max(0, numberOrZero(source.commercialAnnual)) / 12;
    }

    values.sideWeeks = clamp(Math.round(numberOrZero(values.sideWeeks)), 0, 52);
    values.annualSavingsGrowth = clamp(numberOrZero(values.annualSavingsGrowth), 0, 30) / 100;
    values.preReturn = clamp(numberOrZero(values.preReturn), 0, 20) / 100;
    values.postReturn = clamp(numberOrZero(values.postReturn), 0, 20) / 100;
    values.inflationRate = clamp(numberOrZero(values.inflationRate), 0, 15) / 100;
    values.mortgageRate = clamp(numberOrZero(values.mortgageRate), 0, 20) / 100;

    values.realPreReturn = realRate(values.preReturn, values.inflationRate);
    values.realPostReturn = realRate(values.postReturn, values.inflationRate);
    values.commercialAnnual = values.commercialMonthly * 12;
    values.sideAnnual = values.sideHourly * values.sideWeeklyHours * values.sideWeeks;
    values.pension = estimatePension(values);
    values.mortgageSchedule = buildMortgageSchedule(values);
    values.mortgageYearsEffective = values.mortgageSchedule.reduceRight(
      (lastYear, annual, index) => (annual > 0 ? index + 1 : lastYear),
      0
    );

    return values;
  }

  function expenseAt(values, yearsFromNow, retireAge = values.desiredRetireAge) {
    const age = values.currentAge + yearsFromNow;
    const living = values.livingExpense;
    const commercialProtection = yearsFromNow < values.commercialProtectionYears ? values.commercialProtectionAnnual : 0;
    const residentTopup =
      age >= retireAge && age < retireAge + values.residentTopupYears ? values.residentTopupAnnual : 0;
    const mortgage = values.mortgageSchedule[yearsFromNow] || 0;
    const car = yearsFromNow < values.carYears ? values.carAnnual : 0;
    const other = values.otherExpense;

    return {
      living,
      commercialProtection,
      residentTopup,
      mortgage,
      car,
      other,
      total: living + commercialProtection + residentTopup + mortgage + car + other,
    };
  }

  function incomeAt(values, age) {
    const pension = age >= values.pensionStartAge ? values.pension.annual : 0;
    const commercial =
      values.commercialAnnual > 0 &&
      age >= values.commercialStartAge &&
      (values.commercialDuration === 0 || age < values.commercialStartAge + values.commercialDuration)
        ? values.commercialAnnual
        : 0;
    const side =
      values.sideAnnual > 0 &&
      age >= values.sideStartAge &&
      (values.sideDuration === 0 || age < values.sideStartAge + values.sideDuration)
        ? values.sideAnnual
        : 0;

    return {
      pension,
      commercial,
      side,
      total: pension + commercial + side,
    };
  }

  function accumulate(values, annualSavings = values.annualSavings, retireAge = values.desiredRetireAge) {
    let balance = values.currentSavings;
    let annualContribution = annualSavings;
    const points = [{ age: values.currentAge, balance }];
    const years = Math.max(0, retireAge - values.currentAge);

    for (let year = 0; year < years; year += 1) {
      balance = balance * (1 + values.realPreReturn) + annualContribution;
      points.push({ age: values.currentAge + year + 1, balance });
      annualContribution *= 1 + values.annualSavingsGrowth;
    }

    return { balance, points };
  }

  function makeDepleteObjective(age) {
    return {
      id: `deplete-${age}`,
      kind: "deplete",
      endAge: age,
      reserveBalance: 0,
      label: `${age} 岁花完`,
      shortLabel: `${age} 岁花完`,
    };
  }

  function makeForeverObjective() {
    return {
      id: "forever",
      kind: "forever",
      endAge: 120,
      reserveMode: "retireBalance",
      label: "永远花不完",
      shortLabel: "永远花不完",
    };
  }

  function makeCustomObjective(values) {
    return {
      id: "custom",
      kind: "reserve",
      endAge: values.targetEndAge,
      reserveBalance: values.targetEndBalance,
      label: `活到 ${values.targetEndAge} 岁还剩 ${money(values.targetEndBalance, true)}`,
      shortLabel: "自定义目标",
    };
  }

  function objectiveFromValues(values) {
    return makeCustomObjective(values);
  }

  function resolveObjective(objective, balanceAtRetire, values) {
    const reserveBalance = objective.reserveMode === "retireBalance" ? balanceAtRetire : objective.reserveBalance || 0;

    return {
      ...objective,
      endAge: objective.kind === "reserve" ? values.lifeExpectancy : objective.endAge,
      reserveBalance,
      description:
        objective.kind === "reserve"
          ? `按活到 ${ageText(objective.endAge)} 时仍保留 ${money(reserveBalance, true)} 测算`
          : objective.kind === "forever"
            ? "按活到 120 岁且尽量保住退休时本金测算"
            : `按 ${ageText(objective.endAge)} 前把本金基本用完测算`,
    };
  }

  function simulateExpenseScenario(values, retireAge, mode = values.withdrawalMode, objective = objectiveFromValues(values)) {
    const accumulation = accumulate(values, values.annualSavings, retireAge);
    const rule = resolveObjective(objective, accumulation.balance, values);
    const horizonAge = mode === "growth" ? values.lifeExpectancy : rule.endAge;

    if (horizonAge <= retireAge) {
      return {
        sustainable: false,
        retireAge,
        yearsToRetire: Math.max(0, retireAge - values.currentAge),
        balanceAtRetire: accumulation.balance,
        finalBalance: accumulation.balance,
        rows: [],
        points: accumulation.points,
        failureAge: retireAge,
        failureReason: "退休年龄已经不早于你设定的本金终点年龄。",
        objective: rule,
        horizonAge,
      };
    }

    let balance = accumulation.balance;
    const points = [...accumulation.points];
    const rows = [];
    let sustainable = true;
    let failureAge = null;
    let failureReason = "";

    for (let age = retireAge; age < horizonAge; age += 1) {
      const yearsFromNow = age - values.currentAge;
      const expense = expenseAt(values, yearsFromNow, retireAge);
      const income = incomeAt(values, age);
      const growth = balance * values.realPostReturn;
      const inflationFactor = inflationFactorAt(values, yearsFromNow);
      const endBalanceRaw = balance + growth + income.total - expense.total;
      const shortfall = Math.max(0, expense.total - income.total - growth);

      if (mode === "growth" && shortfall > 0.0001 && sustainable) {
        sustainable = false;
        failureAge = age;
        failureReason = "这一年开始，外部收入加投资收益盖不住你的年度支出。";
      }

      if (mode === "principal" && rule.kind === "forever" && endBalanceRaw + 0.0001 < rule.reserveBalance && sustainable) {
        sustainable = false;
        failureAge = age;
        failureReason = "这会开始动到你想长期保住的退休本金。";
      }

      if (endBalanceRaw < -0.0001 && sustainable) {
        sustainable = false;
        failureAge = age;
        failureReason = "资产会在目标年龄之前耗尽。";
      }

      const endBalance = Math.max(endBalanceRaw, 0);

      rows.push({
        age,
        inflationFactor,
        startBalance: balance,
        income,
        growth,
        expense,
        incomeNominal: income.total * inflationFactor,
        expenseNominal: expense.total * inflationFactor,
        endBalance,
      });

      balance = endBalance;
      points.push({ age: age + 1, balance });

      if (!sustainable) {
        break;
      }
    }

    if (sustainable && mode === "principal" && balance + 0.0001 < rule.reserveBalance) {
      sustainable = false;
      failureAge = horizonAge;
      failureReason =
        rule.kind === "reserve"
          ? `到 ${ageText(rule.endAge)} 时还达不到你想保留的 ${money(rule.reserveBalance, true)}。`
          : rule.kind === "forever"
            ? "到 120 岁时保不住退休时本金。"
            : `到 ${ageText(rule.endAge)} 之前资产会提前耗尽。`;
    }

    return {
      sustainable,
      retireAge,
      yearsToRetire: Math.max(0, retireAge - values.currentAge),
      balanceAtRetire: accumulation.balance,
      finalBalance: balance,
      rows,
      points,
      failureAge,
      failureReason,
      objective: rule,
      horizonAge,
    };
  }

  function simulateBudgetPlan(values, retireAge, objective, spendReal) {
    const accumulation = accumulate(values, values.annualSavings, retireAge);
    const rule = resolveObjective(objective, accumulation.balance, values);

    if (rule.endAge <= retireAge) {
      return null;
    }

    let balance = accumulation.balance;
    const rows = [];

    for (let age = retireAge; age < rule.endAge; age += 1) {
      const yearsFromNow = age - values.currentAge;
      const income = incomeAt(values, age);
      const growth = balance * values.realPostReturn;
      const inflationFactor = inflationFactorAt(values, yearsFromNow);
      const endBalanceRaw = balance + growth + income.total - spendReal;

      rows.push({
        age,
        inflationFactor,
        startBalance: balance,
        startBalanceNominal: balance * inflationFactor,
        externalIncomeReal: income.total,
        externalIncomeNominal: income.total * inflationFactor,
        spendReal,
        spendNominal: spendReal * inflationFactor,
        endBalance: Math.max(endBalanceRaw, 0),
        endBalanceNominal: Math.max(endBalanceRaw, 0) * inflationFactor,
      });

      if (endBalanceRaw < -0.0001) {
        return {
          sustainable: false,
          finalBalance: endBalanceRaw,
          rows,
          spendReal,
          objective: rule,
          balanceAtRetire: accumulation.balance,
        };
      }

      if (rule.kind === "forever" && endBalanceRaw + 0.0001 < rule.reserveBalance) {
        return {
          sustainable: false,
          finalBalance: endBalanceRaw,
          rows,
          spendReal,
          objective: rule,
          balanceAtRetire: accumulation.balance,
        };
      }

      balance = endBalanceRaw;
    }

    if (balance + 0.0001 < rule.reserveBalance) {
      return {
        sustainable: false,
        finalBalance: balance,
        rows,
        spendReal,
        objective: rule,
        balanceAtRetire: accumulation.balance,
      };
    }

    return {
      sustainable: true,
      finalBalance: balance,
      rows,
      spendReal,
      objective: rule,
      balanceAtRetire: accumulation.balance,
    };
  }

  function maxSpendForObjective(values, retireAge, objective) {
    const zeroPlan = simulateBudgetPlan(values, retireAge, objective, 0);
    if (!zeroPlan || !zeroPlan.sustainable) {
      return null;
    }

    let low = 0;
    let high = Math.max(
      expenseAt(values, Math.max(0, retireAge - values.currentAge), retireAge).total,
      zeroPlan.balanceAtRetire * Math.max(values.realPostReturn, 0.02),
      100000
    );
    let test = simulateBudgetPlan(values, retireAge, objective, high);

    while (test && test.sustainable && high < 100000000) {
      low = high;
      high *= 1.6;
      test = simulateBudgetPlan(values, retireAge, objective, high);
    }

    for (let step = 0; step < 56; step += 1) {
      const mid = (low + high) / 2;
      const midPlan = simulateBudgetPlan(values, retireAge, objective, mid);
      if (midPlan && midPlan.sustainable) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return simulateBudgetPlan(values, retireAge, objective, low);
  }

  function earliest(values, mode = values.withdrawalMode, objective = objectiveFromValues(values)) {
    const limitAge = mode === "growth" ? values.lifeExpectancy - 1 : Math.min(resolveObjective(objective, 0, values).endAge - 1, 119);

    if (limitAge < values.currentAge) {
      return null;
    }

    for (let age = values.currentAge; age <= limitAge; age += 1) {
      const scenario = simulateExpenseScenario(values, age, mode, objective);
      if (scenario.sustainable) {
        return scenario;
      }
    }

    return null;
  }

  function requiredCorpus(values, retireAge, mode = values.withdrawalMode, objective = objectiveFromValues(values)) {
    const probe = simulateExpenseScenario(values, retireAge, mode, objective);
    if (probe.sustainable) {
      return values.currentSavings;
    }

    let low = 0;
    let high = Math.max(
      expenseAt(values, Math.max(0, retireAge - values.currentAge), retireAge).total * 12,
      values.currentSavings,
      100000
    );

    while (high < 100000000000) {
      const test = simulateExpenseScenario({ ...values, currentSavings: high }, retireAge, mode, objective);
      if (test.sustainable) {
        break;
      }
      high *= 2;
    }

    if (high >= 100000000000) {
      return null;
    }

    for (let step = 0; step < 56; step += 1) {
      const mid = (low + high) / 2;
      const test = simulateExpenseScenario({ ...values, currentSavings: mid }, retireAge, mode, objective);
      if (test.sustainable) {
        high = mid;
      } else {
        low = mid;
      }
    }

    return high;
  }

  function requiredAnnualSavings(values, retireAge, mode = values.withdrawalMode, objective = objectiveFromValues(values)) {
    if (retireAge <= values.currentAge) {
      return values.annualSavings;
    }

    if (simulateExpenseScenario(values, retireAge, mode, objective).sustainable) {
      return values.annualSavings;
    }

    let low = values.annualSavings;
    let high = Math.max(values.annualSavings + 50000, values.annualSavings * 1.5 || 50000);

    while (high < 100000000) {
      const test = simulateExpenseScenario({ ...values, annualSavings: high }, retireAge, mode, objective);
      if (test.sustainable) {
        break;
      }
      high *= 1.5;
    }

    if (high >= 100000000) {
      return null;
    }

    for (let step = 0; step < 52; step += 1) {
      const mid = (low + high) / 2;
      const test = simulateExpenseScenario({ ...values, annualSavings: mid }, retireAge, mode, objective);
      if (test.sustainable) {
        high = mid;
      } else {
        low = mid;
      }
    }

    return high;
  }

  function buildPlanCards(values, retireAge) {
    const baselineExpense = expenseAt(values, Math.max(0, retireAge - values.currentAge), retireAge).total;
    const objectives = [makeCustomObjective(values)]
      .concat(PLAN_AGES.map((age) => makeDepleteObjective(age)))
      .concat([makeForeverObjective()]);

    return objectives.map((objective) => {
      const budget = maxSpendForObjective(values, retireAge, objective);
      return {
        id: objective.id,
        label: objective.label,
        objective,
        budget,
        baselineExpense,
        delta: budget ? budget.spendReal - baselineExpense : null,
      };
    });
  }

  function buildAdvice(values, pack) {
    const advice = [];
    const retireAge = pack.analysisRetireAge;
    const retireAgeNoun = values.retireAgeMode === "estimate" ? "建议退休年龄" : "目标退休年龄";
    const selectedPlan = pack.selectedPlan;

    if (!Number.isFinite(retireAge)) {
      advice.push("按你当前选择的退休方式测算，这组参数下暂时还推不出稳妥的退休时间。");
      return advice;
    }

    const targetYears = Math.max(0, retireAge - values.currentAge);
    const firstExpense = expenseAt(values, targetYears, retireAge).total;
    const firstExternalIncome = incomeAt(values, retireAge).total;

    if (selectedPlan && selectedPlan.budget) {
      const gap = selectedPlan.budget.spendReal - firstExpense;
      if (gap < -1000) {
        advice.push(
          `按${retireAgeNoun} ${ageText(retireAge)}和“${selectedPlan.label}”测算，你现在填写的退休首年总支出约 ${money(firstExpense, true)}，但更稳妥的年度总可花约 ${money(selectedPlan.budget.spendReal, true)}，还差 ${money(Math.abs(gap), true)}。`
        );
      } else if (gap > 1000) {
        advice.push(
          `按${retireAgeNoun} ${ageText(retireAge)}和“${selectedPlan.label}”测算，你当前填写的退休支出还有余量，今天购买力口径下每年大约还能多花 ${money(gap, true)}。`
        );
      } else {
        advice.push(`按“${selectedPlan.label}”测算，你现在填写的退休支出和可持续年度预算已经比较接近。`);
      }
    } else {
      advice.push(`按${retireAgeNoun} ${ageText(retireAge)}测算，“${selectedPlan ? selectedPlan.label : "当前本金方案"}”暂时还生成不了可行预算。`);
    }

    if (firstExpense - firstExternalIncome > 1000) {
      advice.push(
        `你在目标退休首年的外部收入约 ${money(firstExternalIncome, true)}，固定支出约 ${money(firstExpense, true)}，仍需要投资收益或本金覆盖 ${money(firstExpense - firstExternalIncome, true)}。`
      );
    }

    if (values.retireAgeMode === "estimate") {
      if (pack.display) {
        advice.push(
          `按当前模式测算，更稳妥的退休时间大约是 ${ageText(pack.display.retireAge)}。如果你想更早退休，可以继续增加退休前新增储蓄，或下调退休后的年度支出。`
        );
      }
    } else if (!pack.targetSustainable) {
      const fallback = values.withdrawalMode === "growth" ? pack.growth : pack.principal;
      if (fallback) {
        advice.push(
          `如果想维持当前模式，更稳妥的 FIRE 年龄大约是 ${ageText(fallback.retireAge)}。如果你坚持 ${ageText(values.desiredRetireAge)} 退休，退休前每年可新增储蓄大约还要多 ${money(Math.max((pack.saveNeed || values.annualSavings) - values.annualSavings, 0), true)}。`
        );
      } else if (pack.saveNeed !== null) {
        advice.push(
          `当前参数比较吃紧。如果你想守住 ${ageText(values.desiredRetireAge)}，退休前每年可新增储蓄大约还要增加到 ${money(pack.saveNeed, true)}。`
        );
      } else {
        advice.push("当前这组参数下，即使明显增加储蓄也很难稳定满足目标，建议同时下调退休支出或延后退休年龄。");
      }
    }

    if (pack.selectedObjective.endAge < values.lifeExpectancy && pack.selectedObjective.reserveBalance === 0) {
      advice.push(
        `你现在选的是“${pack.selectedObjective.label}”，它更适合做激进消费测试，因为它早于你填写的预计寿命 ${ageText(values.lifeExpectancy)}。建议同时看看 100 / 110 / 120 岁和“保留底仓”方案。`
      );
    }

    return advice.slice(0, 4);
  }

  function computePack(values, selectedPlanViewId = null) {
    const selectedObjective = objectiveFromValues(values);
    const target =
      values.retireAgeMode === "known"
        ? simulateExpenseScenario(values, values.desiredRetireAge, values.withdrawalMode, selectedObjective)
        : null;
    const growth = earliest(values, "growth", selectedObjective);
    const principal = earliest(values, "principal", selectedObjective);
    const currentModeFirst = values.withdrawalMode === "growth" ? growth : principal;
    const analysisRetireAge = values.retireAgeMode === "estimate" ? currentModeFirst?.retireAge ?? null : values.desiredRetireAge;
    const targetSustainable = values.retireAgeMode === "estimate" ? Boolean(currentModeFirst?.sustainable) : Boolean(target?.sustainable);
    const display = values.retireAgeMode === "estimate" ? currentModeFirst : target && target.sustainable ? target : currentModeFirst;
    const projected = Number.isFinite(analysisRetireAge)
      ? accumulate(values, values.annualSavings, analysisRetireAge).balance
      : null;
    const corpus = Number.isFinite(analysisRetireAge)
      ? requiredCorpus(values, analysisRetireAge, values.withdrawalMode, selectedObjective)
      : null;
    const gap = projected === null || corpus === null ? null : projected - corpus;
    const saveNeed = !Number.isFinite(analysisRetireAge)
      ? null
      : targetSustainable
        ? values.annualSavings
        : requiredAnnualSavings(values, analysisRetireAge, values.withdrawalMode, selectedObjective);
    const principalPlans = Number.isFinite(analysisRetireAge) ? buildPlanCards(values, analysisRetireAge) : [];
    const planMap = Object.fromEntries(principalPlans.map((plan) => [plan.id, plan]));
    const activePlanId = planMap[selectedPlanViewId]
      ? selectedPlanViewId
      : planMap[selectedObjective.id]
        ? selectedObjective.id
        : principalPlans.find((plan) => plan.budget)?.id || principalPlans[0]?.id || null;
    const selectedPlan = activePlanId ? planMap[activePlanId] : null;
    const advice = buildAdvice(values, {
      target,
      growth,
      principal,
      selectedObjective,
      selectedPlan,
      saveNeed,
      analysisRetireAge,
      display,
      targetSustainable,
    });

    return {
      target,
      growth,
      principal,
      display,
      analysisRetireAge,
      targetSustainable,
      projected,
      corpus,
      gap,
      saveNeed,
      selectedObjective,
      principalPlans,
      selectedPlan,
      selectedPlanId: activePlanId,
      advice,
    };
  }

  window.FireModel = {
    PLAN_AGES,
    DEFAULTS,
    NUMERIC_FIELDS,
    normalize,
    money,
    ageText,
    percentText,
    yearsText,
    expenseAt,
    incomeAt,
    accumulate,
    estimatePension,
    objectiveFromValues,
    computePack,
  };
})();
