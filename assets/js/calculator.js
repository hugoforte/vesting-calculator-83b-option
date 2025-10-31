(() => {
  const { FMV_BASE, CONV_DATE } = window.calcConstants;
  const { formatCurrency, formatInteger } = window.calcFormatters;
  const { addYears } = window.calcDateUtils;
  const { getElements } = window.calcDom;

  const DEFAULT_START = '2024-01-01';
  const MAX_NAME_LENGTH = 60;
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => htmlEscapes[char]);
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

  const aggregateBuckets = (grants) => {
    const buckets = new Map();

    grants.forEach((grant) => {
      const events = buildEvents(grant.shares, grant.years, grant.start);
      if (!events.length) return;

      const growthRate = sanitizeGrowthRate(grant.growthRate) / 100;
      const taxRate = sanitizeTaxRate(grant.taxRate) / 100;

      events.forEach((event) => {
        const targetYear = event.date <= CONV_DATE ? 2025 : event.year;
        const stepsFrom2025 = Math.max(0, targetYear - 2025);
        const growthMultiplier = targetYear === 2025 ? 1 : Math.pow(1 + growthRate, stepsFrom2025);
        const fmv = FMV_BASE * growthMultiplier;
        const income = event.shares * fmv;
        const tax = income * taxRate;

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
    };

    const defaultGrantName = (index) => `Grant ${index + 1}`;

    const renderGrants = () => {
      if (!state.grants.length) {
        els.grantsList.innerHTML =
          '<div class="empty-state">Add a grant to begin modeling your tax exposure.</div>';
        return;
      }

      const markup = state.grants
        .map((grant, index) => {
          const displayName = grant.name.trim() ? grant.name : defaultGrantName(index);
          return `
            <div class="grant-card" data-grant-id="${grant.id}">
              <div class="grant-head">
                <h3 class="grant-title">${escapeHtml(displayName)}</h3>
                <button type="button" class="btn-ghost" data-action="remove" data-id="${grant.id}">Remove</button>
              </div>
              <div class="inputs-grid">
                <div>
                  <label for="grant-name-${grant.id}">Label</label>
                  <input id="grant-name-${grant.id}" type="text" maxlength="${MAX_NAME_LENGTH}" data-field="name" data-id="${grant.id}" value="${escapeHtml(grant.name)}" placeholder="${escapeHtml(defaultGrantName(index))}" />
                </div>
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
                <div>
                  <label for="grant-tax-${grant.id}">Total tax rate (%)</label>
                  <input id="grant-tax-${grant.id}" type="number" min="0" max="100" step="0.1" data-field="taxRate" data-id="${grant.id}" value="${grant.taxRate}" />
                </div>
                <div>
                  <label for="grant-growth-${grant.id}">Estimated growth per year (%)</label>
                  <input id="grant-growth-${grant.id}" type="number" min="-100" max="500" step="0.1" data-field="growthRate" data-id="${grant.id}" value="${grant.growthRate}" />
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      els.grantsList.innerHTML = markup;
    };

    const render83b = () => {
      const totalShares = state.grants.reduce((sum, grant) => sum + grant.shares, 0);
      els.outTotalVested83b.textContent = totalShares ? formatInteger(totalShares) : '—';
      els.outTax83b.textContent = totalShares ? '$0' : '—';
    };

    const renderTable = (buckets) => {
      els.tableBody.innerHTML = '';
      const years = Array.from(buckets.keys()).sort((a, b) => a - b);
      let totalIncome = 0;
      let totalTax = 0;

      years.forEach((year) => {
        const bucket = buckets.get(year);
        if (!bucket || bucket.shares <= 0) return;

        const avgFmv = bucket.shares ? bucket.income / bucket.shares : 0;
        totalIncome += bucket.income;
        totalTax += bucket.tax;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>Taxes for ${year}</td>
          <td>${formatInteger(bucket.shares)}</td>
          <td>${formatCurrency(avgFmv)}</td>
          <td>${formatCurrency(bucket.income)}</td>
          <td>${formatCurrency(bucket.tax)}</td>
        `;
        els.tableBody.appendChild(row);
      });

      if (!els.tableBody.children.length) {
        const message = state.grants.length
          ? 'No post-conversion vesting on or after 2025 based on the current grant dates.'
          : 'Add at least one grant to see tax projections.';
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="5" style="text-align:left;color:#8ea2c9">${message}</td>`;
        els.tableBody.appendChild(row);
      }

      els.sumIncome.textContent = formatCurrency(totalIncome);
      els.sumTax.textContent = formatCurrency(totalTax);
    };

    const calculate = () => {
      if (!state.grants.length) {
        render83b();
        renderTable(new Map());
        return;
      }

      const buckets = aggregateBuckets(state.grants);
      render83b();
      renderTable(buckets);
    };

    const createGrant = (overrides = {}) => {
      const grant = {
        id: state.nextId,
        name: typeof overrides.name === 'string' ? overrides.name.slice(0, MAX_NAME_LENGTH) : '',
        shares: sanitizeShares(overrides.shares ?? 70000),
        start: sanitizeDate(overrides.start ?? DEFAULT_START),
        years: sanitizeYears(overrides.years ?? 7),
        taxRate: sanitizeTaxRate(overrides.taxRate ?? 42),
        growthRate: sanitizeGrowthRate(overrides.growthRate ?? 35),
      };
      state.nextId += 1;
      return grant;
    };

    const addGrant = (overrides = {}) => {
      const grant = createGrant(overrides);
      state.grants.push(grant);
      renderGrants();
      calculate();
    };

    const removeGrant = (id) => {
      const index = state.grants.findIndex((grant) => grant.id === id);
      if (index === -1) return;
      state.grants.splice(index, 1);
      renderGrants();
      calculate();
    };

    const updateGrantField = (id, field, rawValue, target) => {
      const grant = state.grants.find((item) => item.id === id);
      if (!grant) return;

      const index = state.grants.indexOf(grant);
      let shouldRecalculate = false;

      switch (field) {
        case 'name': {
          const value = typeof rawValue === 'string' ? rawValue.slice(0, MAX_NAME_LENGTH) : '';
          grant.name = value;
          const card = target.closest('.grant-card');
          if (card) {
            const title = card.querySelector('.grant-title');
            if (title) title.textContent = value.trim() ? value : defaultGrantName(index);
          }
          break;
        }
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
        case 'taxRate': {
          const numeric = numberOrNull(rawValue);
          if (numeric === null) return;
          const sanitized = sanitizeTaxRate(numeric);
          if (sanitized !== grant.taxRate) {
            grant.taxRate = sanitized;
            shouldRecalculate = true;
          }
          target.value = String(grant.taxRate);
          break;
        }
        case 'growthRate': {
          const numeric = numberOrNull(rawValue);
          if (numeric === null) return;
          const sanitized = sanitizeGrowthRate(numeric);
          if (sanitized !== grant.growthRate) {
            grant.growthRate = sanitized;
            shouldRecalculate = true;
          }
          target.value = String(grant.growthRate);
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
          break;
        }
        default:
          return;
      }

      if (shouldRecalculate) {
        calculate();
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

    if (els.fmvStart) els.fmvStart.textContent = formatCurrency(FMV_BASE);
    if (els.convLabel) els.convLabel.textContent = dateFormatter.format(CONV_DATE);

    renderGrants();
    els.addGrantBtn.addEventListener('click', () => addGrant());
    els.grantsList.addEventListener('input', handleGrantInput);
    els.grantsList.addEventListener('change', handleGrantInput);
    els.grantsList.addEventListener('click', handleGrantClick);

    addGrant({
      shares: 70000,
      start: DEFAULT_START,
      years: 7,
      taxRate: 42,
      growthRate: 35,
    });
  });
})();
