(() => {
  const { TOTAL_SHARES_OUTSTANDING, COMPANY_POST_MONEY_VALUATION, FMV_BASE, CONV_DATE } =
    window.calcConstants;
  const { formatCurrency, formatInteger } = window.calcFormatters;
  const { addYears } = window.calcDateUtils;
  const { getElements } = window.calcDom;

  const DEFAULT_START = '2024-01-01';
  const DEFAULT_TAX_RATE = 42;
  const DEFAULT_GROWTH_RATE = 35;
  const roundTo = (value, decimals = 6) => {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  };
  const COOKIE_NAME = 'vesting_calc_state_v1';
  const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // one year
  const STORAGE_KEY = COOKIE_NAME;

  const toInputDate = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const DEFAULT_CONVERSION_DATE_ISO = toInputDate(CONV_DATE) || '2025-12-01';

  const DEFAULT_ASSUMPTIONS = {
    totalShares: TOTAL_SHARES_OUTSTANDING,
    postMoney: COMPANY_POST_MONEY_VALUATION,
    fmv: roundTo(Number(FMV_BASE), 2),
    conversionDate: DEFAULT_CONVERSION_DATE_ISO,
    taxRate: DEFAULT_TAX_RATE,
    growthRate: DEFAULT_GROWTH_RATE,
  };

  const cloneDefaultAssumptions = () => ({ ...DEFAULT_ASSUMPTIONS });
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const numberOrNull = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  };

  const sanitizeShares = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return clamp(Math.floor(numeric), 1, Number.MAX_SAFE_INTEGER);
  };

  const sanitizeYears = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return clamp(Math.floor(numeric), 1, 100);
  };

  const sanitizeTaxRate = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return clamp(numeric, 0, 100);
  };

  const sanitizeGrowthRate = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return clamp(numeric, -100, 500);
  };

  const sanitizeDate = (value) =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : DEFAULT_START;

  const sanitizeTotalSharesAssumption = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_ASSUMPTIONS.totalShares;
    return clamp(Math.floor(numeric), 1, Number.MAX_SAFE_INTEGER);
  };

  const sanitizePostMoneyAssumption = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return DEFAULT_ASSUMPTIONS.postMoney;
    return Math.max(0, numeric);
  };

  const sanitizeFmvAssumption = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return DEFAULT_ASSUMPTIONS.fmv;
    return Math.max(0, roundTo(numeric, 2));
  };

  const sanitizeConversionAssumption = (value) =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value
      : DEFAULT_ASSUMPTIONS.conversionDate;

  const deriveFmvFromTotals = (postMoney, totalShares) => {
    if (!Number.isFinite(postMoney) || !Number.isFinite(totalShares) || totalShares <= 0) return null;
    return postMoney / totalShares;
  };
  const sanitizeGlobalTaxRate = (value) => {
    const numeric = numberOrNull(value);
    return sanitizeTaxRate(numeric === null ? DEFAULT_TAX_RATE : numeric);
  };

  const sanitizeGlobalGrowthRate = (value) => {
    const numeric = numberOrNull(value);
    return sanitizeGrowthRate(numeric === null ? DEFAULT_GROWTH_RATE : numeric);
  };

  const createDateFromISO = (iso) => {
    if (typeof iso !== 'string') return null;
    const parts = iso.split('-').map((part) => Number(part));
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return new Date(year, month - 1, day);
  };

  const buildEvents = (shares, years, startIso) => {
    const events = [];
    const baseDate = createDateFromISO(startIso) || createDateFromISO(DEFAULT_START);
    if (!baseDate) return events;

    const sharesPerYear = Math.floor(shares / years);
    const remainder = shares % years;

    for (let year = 1; year <= years; year += 1) {
      const vestDate = addYears(baseDate, year);
      const sharesThisYear = sharesPerYear + (year === years ? remainder : 0);
      events.push({ year: vestDate.getFullYear(), date: vestDate, shares: sharesThisYear });
    }

    return events;
  };

  const aggregateBuckets = (grants, assumptions) => {
    const buckets = new Map();
    const workingAssumptions = assumptions || DEFAULT_ASSUMPTIONS;
    const growthRate = Number.isFinite(workingAssumptions.growthRate)
      ? workingAssumptions.growthRate
      : DEFAULT_ASSUMPTIONS.growthRate;
    const taxRate = Number.isFinite(workingAssumptions.taxRate)
      ? workingAssumptions.taxRate
      : DEFAULT_ASSUMPTIONS.taxRate;
    const fmvBase = Number.isFinite(workingAssumptions.fmv)
      ? workingAssumptions.fmv
      : DEFAULT_ASSUMPTIONS.fmv;
    const conversionIso =
      typeof workingAssumptions.conversionDate === 'string'
        ? workingAssumptions.conversionDate
        : DEFAULT_ASSUMPTIONS.conversionDate;
    const conversionDate =
      createDateFromISO(conversionIso) || createDateFromISO(DEFAULT_ASSUMPTIONS.conversionDate);
    const conversionYear = conversionDate ? conversionDate.getFullYear() : null;

    const growthMultiplierBase = 1 + growthRate / 100;
    const taxMultiplier = taxRate / 100;

    grants.forEach((grant) => {
      const events = buildEvents(grant.shares, grant.years, grant.start);
      if (!events.length) return;

      events.forEach((event) => {
        const targetYear = conversionDate && event.date <= conversionDate ? conversionYear : event.year;
        const baseYear = conversionYear ?? event.year;
        const stepsFromBase = Math.max(0, targetYear - baseYear);
        const growthMultiplier = stepsFromBase === 0 ? 1 : Math.pow(growthMultiplierBase, stepsFromBase);
        const fmv = fmvBase * growthMultiplier;
        const income = event.shares * fmv;
        const tax = income * taxMultiplier;

        const bucket = buckets.get(targetYear) || { year: targetYear, shares: 0, income: 0, tax: 0 };
        bucket.shares += event.shares;
        bucket.income += income;
        bucket.tax += tax;
        buckets.set(targetYear, bucket);
      });
    });

    return buckets;
  };

  window.addEventListener('DOMContentLoaded', () => {
    const els = getElements();
    if (!els || !els.grantsList || !els.addGrantBtn) return;

    const state = {
      grants: [],
      nextId: 1,
      assumptions: cloneDefaultAssumptions(),
      meta: {
        fmvLocked: false,
      },
    };

    const escapeHtml = (value) =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const buildSerializableState = () => {
      const sanitizedAssumptions = {
        totalShares: sanitizeTotalSharesAssumption(state.assumptions.totalShares),
        postMoney: sanitizePostMoneyAssumption(state.assumptions.postMoney),
        fmv: sanitizeFmvAssumption(state.assumptions.fmv),
        conversionDate: sanitizeConversionAssumption(state.assumptions.conversionDate),
        taxRate: sanitizeGlobalTaxRate(state.assumptions.taxRate),
        growthRate: sanitizeGlobalGrowthRate(state.assumptions.growthRate),
      };
      state.assumptions = { ...sanitizedAssumptions };
      const meta = {
        fmvLocked: Boolean(state.meta.fmvLocked),
      };
      state.meta = { ...meta };

      return {
        assumptions: sanitizedAssumptions,
        grants: state.grants.map((grant) => ({
          id: grant.id,
          shares: grant.shares,
          start: grant.start,
          years: grant.years,
          title: grant.title ? grant.title.trim() : '',
        })),
        meta,
      };
    };

    const persistState = () => {
      try {
        if (!state.grants.length) {
          document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch (storageError) {
            console.warn('LocalStorage unavailable while clearing grants', storageError);
          }
          return;
        }

        const payload = buildSerializableState();
        const raw = JSON.stringify(payload);
        const serialized = encodeURIComponent(raw);
        const expires = new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000).toUTCString();
        document.cookie = `${COOKIE_NAME}=${serialized}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; expires=${expires}; samesite=lax`;
        try {
          window.localStorage.setItem(STORAGE_KEY, raw);
        } catch (storageError) {
          console.warn('LocalStorage unavailable, relying on cookie only', storageError);
        }
      } catch (error) {
        console.error('Failed to persist grants', error);
      }
    };

    const loadState = () => {
      const parsePayload = (raw) => {
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || !Array.isArray(parsed.grants)) return null;

          const grants = [];
          let maxId = 0;
          let legacyTaxRate = null;
          let legacyGrowthRate = null;

          parsed.grants.forEach((item) => {
            if (!item) return;
            const id = Number(item.id);
            if (!Number.isFinite(id) || id <= 0) return;
            const grant = {
              id,
              shares: sanitizeShares(item.shares),
              start: sanitizeDate(item.start),
              years: sanitizeYears(item.years),
              title: typeof item.title === 'string' ? item.title.trim() : '',
            };
            grants.push(grant);
            if (grant.id > maxId) maxId = grant.id;

            if (legacyTaxRate === null && Object.prototype.hasOwnProperty.call(item, 'taxRate')) {
              const numericTax = numberOrNull(item.taxRate);
              if (numericTax !== null) legacyTaxRate = sanitizeTaxRate(numericTax);
            }
            if (legacyGrowthRate === null && Object.prototype.hasOwnProperty.call(item, 'growthRate')) {
              const numericGrowth = numberOrNull(item.growthRate);
              if (numericGrowth !== null) legacyGrowthRate = sanitizeGrowthRate(numericGrowth);
            }
          });

          const assumptions = cloneDefaultAssumptions();

          if (parsed.assumptions && typeof parsed.assumptions === 'object') {
            const source = parsed.assumptions;
            if (Object.prototype.hasOwnProperty.call(source, 'totalShares')) {
              assumptions.totalShares = sanitizeTotalSharesAssumption(source.totalShares);
            }
            if (Object.prototype.hasOwnProperty.call(source, 'postMoney')) {
              assumptions.postMoney = sanitizePostMoneyAssumption(source.postMoney);
            }
            if (Object.prototype.hasOwnProperty.call(source, 'fmv')) {
              assumptions.fmv = sanitizeFmvAssumption(source.fmv);
            }
            if (Object.prototype.hasOwnProperty.call(source, 'conversionDate')) {
              assumptions.conversionDate = sanitizeConversionAssumption(source.conversionDate);
            }
            if (Object.prototype.hasOwnProperty.call(source, 'taxRate')) {
              assumptions.taxRate = sanitizeGlobalTaxRate(source.taxRate);
            }
            if (Object.prototype.hasOwnProperty.call(source, 'growthRate')) {
              assumptions.growthRate = sanitizeGlobalGrowthRate(source.growthRate);
            }
          }

          if (parsed.global && typeof parsed.global === 'object') {
            if (Object.prototype.hasOwnProperty.call(parsed.global, 'taxRate')) {
              assumptions.taxRate = sanitizeGlobalTaxRate(parsed.global.taxRate);
            }
            if (Object.prototype.hasOwnProperty.call(parsed.global, 'growthRate')) {
              assumptions.growthRate = sanitizeGlobalGrowthRate(parsed.global.growthRate);
            }
          } else {
            if (legacyTaxRate !== null) {
              assumptions.taxRate = sanitizeGlobalTaxRate(legacyTaxRate);
            }
            if (legacyGrowthRate !== null) {
              assumptions.growthRate = sanitizeGlobalGrowthRate(legacyGrowthRate);
            }
          }

          const derivedFmv = deriveFmvFromTotals(assumptions.postMoney, assumptions.totalShares);
          if (Number.isFinite(derivedFmv)) {
            assumptions.fmv = roundTo(derivedFmv, 2);
          }

          return {
            grants,
            nextId: maxId + 1,
            assumptions,
            meta: {
              fmvLocked: false,
            },
          };
        } catch (error) {
          console.error('Failed to parse saved grants', error);
          return null;
        }
      };

      const cookies = document.cookie ? document.cookie.split(';') : [];
      const entry = cookies
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
      if (entry) {
        const rawCookie = decodeURIComponent(entry.substring(COOKIE_NAME.length + 1));
        const fromCookie = parsePayload(rawCookie);
        if (fromCookie) return fromCookie;
      }

      try {
        const rawStorage = window.localStorage.getItem(STORAGE_KEY);
        const fromStorage = parsePayload(rawStorage);
        if (fromStorage) {
          // Rehydrate cookie for future sessions.
          const serialized = encodeURIComponent(rawStorage);
          const expires = new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000).toUTCString();
          document.cookie = `${COOKIE_NAME}=${serialized}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; expires=${expires}; samesite=lax`;
          return fromStorage;
        }
      } catch (storageError) {
        console.warn('Unable to read localStorage for grants', storageError);
      }

      return null;
    };

    const formatGrantHeading = (grant, index) => {
      if (grant.title && grant.title.trim()) return grant.title.trim();
      const base = `Grant ${index + 1}`;
      const startDate = createDateFromISO(grant.start);
      return startDate ? `${base} · ${dateFormatter.format(startDate)}` : base;
    };

    const renderGrants = () => {
      if (!state.grants.length) {
        els.grantsList.innerHTML =
          '<div class="empty-state">Add a grant to begin modeling your tax exposure.</div>';
        return;
      }

      const markup = state.grants
        .map((grant, index) => {
          const heading = formatGrantHeading(grant, index);
          return `
            <div class="grant-card" data-grant-id="${grant.id}">
              <div class="grant-head">
                <h3
                  class="grant-title"
                  contenteditable="true"
                  data-action="title"
                  data-id="${grant.id}"
                  role="textbox"
                  aria-label="Edit grant title"
                  spellcheck="false"
                >${escapeHtml(heading)}</h3>
                <button type="button" class="btn-ghost" data-action="remove" data-id="${grant.id}">Remove</button>
              </div>
              <div class="inputs-grid">
                <div>
                  <label for="grant-shares-${grant.id}">Grant amount (total shares)</label>
                  <input id="grant-shares-${grant.id}" type="number" min="1" step="1" data-field="shares" data-id="${grant.id}" value="${grant.shares}" />
                </div>
                <div>
                  <label for="grant-start-${grant.id}">Grant start date</label>
                  <input id="grant-start-${grant.id}" type="date" data-field="start" data-id="${grant.id}" value="${grant.start}" />
                </div>
                <div>
                  <label for="grant-years-${grant.id}">Vesting years</label>
                  <input id="grant-years-${grant.id}" type="number" min="1" max="100" step="1" data-field="years" data-id="${grant.id}" value="${grant.years}" />
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      els.grantsList.innerHTML = markup;
    };

    const renderAssumptions = () => {
      if (!els.assumptions) return;
      const { totalShares, postMoney, fmv, conversionDate, taxRate, growthRate } = els.assumptions;
      if (totalShares) totalShares.value = String(state.assumptions.totalShares);
      if (postMoney) postMoney.value = String(state.assumptions.postMoney);
      if (fmv) fmv.value = state.assumptions.fmv.toFixed(2);
      if (conversionDate) conversionDate.value = state.assumptions.conversionDate;
      if (taxRate) taxRate.value = String(state.assumptions.taxRate);
      if (growthRate) growthRate.value = String(state.assumptions.growthRate);
    };

    const maybeSyncDerivedFmv = ({ force = false } = {}) => {
      if (state.meta.fmvLocked && !force) return false;
      const derived = deriveFmvFromTotals(state.assumptions.postMoney, state.assumptions.totalShares);
      if (!Number.isFinite(derived)) return false;
      const normalized = sanitizeFmvAssumption(derived);
      if (!force && Math.abs(normalized - state.assumptions.fmv) < 1e-6) return false;
      state.assumptions.fmv = normalized;
      state.meta.fmvLocked = false;
      if (els.assumptions && els.assumptions.fmv) {
        els.assumptions.fmv.value = normalized.toFixed(2);
      }
      return true;
    };

    const renderWith83b = () => {
      const totalShares = state.grants.reduce((sum, grant) => sum + grant.shares, 0);
      els.outTotalVested83b.textContent = totalShares ? formatInteger(totalShares) : '—';
      els.outTax83b.textContent = totalShares ? formatCurrency(0) : '—';
      if (els.outShareValue83b) {
        const shareValue = totalShares ? totalShares * state.assumptions.fmv : 0;
        els.outShareValue83b.textContent = totalShares ? formatCurrency(shareValue) : '—';
      }
    };

    const renderTable = (buckets) => {
      els.tableBody.innerHTML = '';
      const years = Array.from(buckets.keys()).sort((a, b) => a - b);
      let totalIncome = 0;
      let totalTax = 0;
      let totalShares = 0;
      let runningShares = 0;
      let runningValue = 0;
      let rowsRendered = 0;

      years.forEach((year) => {
        const bucket = buckets.get(year);
        if (!bucket || bucket.shares <= 0) return;

        const avgFmv = bucket.shares ? bucket.income / bucket.shares : 0;
        totalIncome += bucket.income;
        totalTax += bucket.tax;
        totalShares += bucket.shares;
        runningShares += bucket.shares;
        runningValue += bucket.income;
        rowsRendered += 1;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>Taxes for ${year}</td>
          <td>${formatInteger(bucket.shares)}</td>
          <td>${formatCurrency(avgFmv)}</td>
          <td>${formatCurrency(bucket.income)}</td>
          <td>${formatCurrency(bucket.tax)}</td>
          <td>${formatInteger(runningShares)}</td>
          <td>${formatCurrency(runningValue)}</td>
        `;
        els.tableBody.appendChild(row);
      });

      if (!els.tableBody.children.length) {
        const conversionIso = state.assumptions.conversionDate || DEFAULT_ASSUMPTIONS.conversionDate;
        const conversion = createDateFromISO(conversionIso) || createDateFromISO(DEFAULT_ASSUMPTIONS.conversionDate);
        const conversionYear = conversion ? conversion.getFullYear() : 'the conversion year';
        const message = state.grants.length
          ? `No post-conversion vesting on or after ${conversionYear} based on the current grant dates.`
          : 'Add at least one grant to see tax projections.';
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="7" style="text-align:left;color:#8ea2c9">${message}</td>`;
        els.tableBody.appendChild(row);
      }

      if (rowsRendered > 0) {
        if (els.sumNewShares) els.sumNewShares.textContent = formatInteger(totalShares);
        els.sumIncome.textContent = formatCurrency(totalIncome);
        els.sumTax.textContent = formatCurrency(totalTax);
        if (els.sumTotalShares) els.sumTotalShares.textContent = formatInteger(runningShares);
        if (els.sumTotalValue) els.sumTotalValue.textContent = formatCurrency(runningValue);
      } else {
        if (els.sumNewShares) els.sumNewShares.textContent = '—';
        els.sumIncome.textContent = '—';
        els.sumTax.textContent = '—';
        if (els.sumTotalShares) els.sumTotalShares.textContent = '—';
        if (els.sumTotalValue) els.sumTotalValue.textContent = '—';
      }

      return {
        totalIncome,
        totalTax,
        rowsRendered,
      };
    };

  const renderWithout83bSummary = ({ totalTax, rowsRendered } = { totalTax: 0, rowsRendered: 0 }) => {
      if (!els.outTaxNo83b) return;
      if (!state.grants.length) {
        els.outTaxNo83b.textContent = '—';
        return;
      }

      if (rowsRendered > 0) {
        els.outTaxNo83b.textContent = formatCurrency(totalTax);
        return;
      }

      els.outTaxNo83b.textContent = formatCurrency(0);
    };

    const calculate = () => {
      if (!state.grants.length) {
        renderWith83b();
        const totals = renderTable(new Map());
        renderWithout83bSummary(totals);
        return;
      }

      const buckets = aggregateBuckets(state.grants, state.assumptions);
      renderWith83b();
      const totals = renderTable(buckets);
      renderWithout83bSummary(totals);
    };

    const createGrant = (overrides = {}) => {
      const explicitId = Number(overrides.id);
      const id = Number.isFinite(explicitId) && explicitId > 0 ? explicitId : state.nextId;
      if (id >= state.nextId) {
        state.nextId = id + 1;
      }

      const grant = {
        id,
        shares: sanitizeShares(overrides.shares ?? 10000),
        start: sanitizeDate(overrides.start ?? DEFAULT_START),
        years: sanitizeYears(overrides.years ?? 7),
        title: typeof overrides.title === 'string' ? overrides.title.trim() : '',
      };
      return grant;
    };

    const addGrant = (overrides = {}) => {
      const grant = createGrant(overrides);
      state.grants.push(grant);
      renderGrants();
      calculate();
      persistState();
    };

    const removeGrant = (id) => {
      const index = state.grants.findIndex((grant) => grant.id === id);
      if (index === -1) return;
      state.grants.splice(index, 1);
      if (!state.grants.length) {
        state.assumptions = cloneDefaultAssumptions();
        state.meta.fmvLocked = false;
        maybeSyncDerivedFmv({ force: true });
        renderAssumptions();
      }
      renderGrants();
      calculate();
      persistState();
    };

    const updateGrantField = (id, field, rawValue, target) => {
      const grant = state.grants.find((item) => item.id === id);
      if (!grant) return;

      let shouldRecalculate = false;

      switch (field) {
        case 'shares': {
          const numeric = numberOrNull(rawValue);
          if (numeric === null) return;
          const sanitized = sanitizeShares(numeric);
          if (sanitized !== grant.shares) {
            grant.shares = sanitized;
            shouldRecalculate = true;
          }
          target.value = String(grant.shares);
          break;
        }
        case 'years': {
          const numeric = numberOrNull(rawValue);
          if (numeric === null) return;
          const sanitized = sanitizeYears(numeric);
          if (sanitized !== grant.years) {
            grant.years = sanitized;
            shouldRecalculate = true;
          }
          target.value = String(grant.years);
          break;
        }
        case 'start': {
          if (!rawValue) return;
          const sanitized = sanitizeDate(rawValue);
          if (sanitized !== grant.start) {
            grant.start = sanitized;
            shouldRecalculate = true;
          }
          target.value = grant.start;
          const card = target.closest('.grant-card');
          if (card) {
            const heading = card.querySelector('.grant-title');
            if (heading) {
              const index = state.grants.indexOf(grant);
              heading.textContent = formatGrantHeading(grant, index);
            }
          }
          break;
        }
        default:
          return;
      }

      if (shouldRecalculate) {
        calculate();
        persistState();
      }
    };

    const handleGrantTitleInput = (event) => {
      const { target } = event;
      if (!target || target.dataset.action !== 'title') return;
      const id = Number(target.dataset.id);
      if (!Number.isFinite(id)) return;
      const grant = state.grants.find((item) => item.id === id);
      if (!grant) return;

      const nextRaw = target.textContent || '';
      if (grant.title !== nextRaw) {
        grant.title = nextRaw;
        persistState();
      }
    };

    const handleGrantTitleFocusOut = (event) => {
      const { target } = event;
      if (!target || target.dataset.action !== 'title') return;
      const id = Number(target.dataset.id);
      if (!Number.isFinite(id)) return;
      const grant = state.grants.find((item) => item.id === id);
      if (!grant) return;
      const index = state.grants.indexOf(grant);
      if (index === -1) return;

      const raw = target.textContent || '';
      const trimmed = raw.trim();
      const nextTitle = trimmed.length ? trimmed : '';
      if ((grant.title || '') !== nextTitle) {
        grant.title = nextTitle;
        target.textContent = formatGrantHeading(grant, index);
        persistState();
      } else if (!nextTitle) {
        target.textContent = formatGrantHeading(grant, index);
      }
    };

    const handleGrantTitleKeyDown = (event) => {
      const { target } = event;
      if (!target || target.dataset.action !== 'title') return;
      if (event.key === 'Enter') {
        event.preventDefault();
        target.blur();
      }
    };

    const handleGrantInput = (event) => {
      const { target } = event;
      if (!target || !target.dataset) return;
      const field = target.dataset.field;
      if (!field) return;
      const id = Number(target.dataset.id);
      if (!Number.isFinite(id)) return;
      updateGrantField(id, field, target.value, target);
    };

    const handleGrantClick = (event) => {
      const { target } = event;
      if (!target || !target.dataset) return;
      const action = target.dataset.action;
      if (action === 'remove') {
        event.preventDefault();
        const id = Number(target.dataset.id);
        if (!Number.isFinite(id)) return;
        removeGrant(id);
      }
    };

    const handleAssumptionInput = (event) => {
      const { target, type } = event;
      if (!target || !target.dataset) return;
      const field = target.dataset.assumptionField;
      if (!field) return;

      if (type === 'input' && target.value === '') return;

      let changed = false;

      switch (field) {
        case 'totalShares': {
          const sanitized = sanitizeTotalSharesAssumption(target.value);
          if (sanitized !== state.assumptions.totalShares) {
            state.assumptions.totalShares = sanitized;
            changed = true;
          }
          break;
        }
        case 'postMoney': {
          const sanitized = sanitizePostMoneyAssumption(target.value);
          if (sanitized !== state.assumptions.postMoney) {
            state.assumptions.postMoney = sanitized;
            changed = true;
          }
          break;
        }
        case 'fmv':
          return;
        case 'conversionDate': {
          const sanitized = sanitizeConversionAssumption(target.value);
          if (sanitized !== state.assumptions.conversionDate) {
            state.assumptions.conversionDate = sanitized;
            changed = true;
          }
          break;
        }
        case 'taxRate': {
          const sanitized = sanitizeGlobalTaxRate(target.value);
          if (sanitized !== state.assumptions.taxRate) {
            state.assumptions.taxRate = sanitized;
            changed = true;
          }
          break;
        }
        case 'growthRate': {
          const sanitized = sanitizeGlobalGrowthRate(target.value);
          if (sanitized !== state.assumptions.growthRate) {
            state.assumptions.growthRate = sanitized;
            changed = true;
          }
          break;
        }
        default:
          return;
      }

      if (field === 'totalShares' || field === 'postMoney') {
        const derivedUpdated = maybeSyncDerivedFmv({ force: type === 'change' });
        if (derivedUpdated) changed = true;
      }

      if (changed) {
        calculate();
        persistState();
      }

      if (type === 'change') {
        renderAssumptions();
      }
    };

    const handleResetAssumptions = () => {
      state.assumptions = cloneDefaultAssumptions();
      state.meta.fmvLocked = false;
      maybeSyncDerivedFmv({ force: true });
      renderAssumptions();
      calculate();
      persistState();
    };

    els.addGrantBtn.addEventListener('click', () => addGrant());
    els.grantsList.addEventListener('input', handleGrantInput);
    els.grantsList.addEventListener('input', handleGrantTitleInput);
    els.grantsList.addEventListener('change', handleGrantInput);
    els.grantsList.addEventListener('click', handleGrantClick);
    els.grantsList.addEventListener('focusout', handleGrantTitleFocusOut);
    els.grantsList.addEventListener('keydown', handleGrantTitleKeyDown);

    const assumptionInputs = els.assumptions
      ? Object.values(els.assumptions).filter((input) => input && !input.readOnly && !input.disabled)
      : [];
    assumptionInputs.forEach((input) => {
      input.addEventListener('input', handleAssumptionInput);
      input.addEventListener('change', handleAssumptionInput);
    });
    if (els.resetAssumptionsBtn) {
      els.resetAssumptionsBtn.addEventListener('click', handleResetAssumptions);
    }

    const saved = loadState();
    if (saved) {
      state.grants = saved.grants.map((grant) => ({ ...grant }));
      state.nextId = saved.nextId > 0 ? saved.nextId : state.grants.length + 1;
      state.assumptions = { ...saved.assumptions };
      state.meta = {
        fmvLocked: false,
      };
      maybeSyncDerivedFmv({ force: true });
      renderAssumptions();
      renderGrants();
      calculate();
      persistState();
    } else {
      state.grants = [];
      state.nextId = 1;
      state.assumptions = cloneDefaultAssumptions();
      state.meta = {
        fmvLocked: false,
      };
      maybeSyncDerivedFmv({ force: true });
      renderAssumptions();
      addGrant({
        shares: 10000,
        start: '2023-01-01',
        years: 7,
      });
      addGrant({
        shares: 5000,
        start: '2024-01-01',
        years: 7,
      });
    }
  });
})();
