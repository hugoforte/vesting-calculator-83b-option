(() => {
  const { FMV_BASE, CONV_DATE } = window.calcConstants;
  const { formatCurrency, formatInteger } = window.calcFormatters;
  const { addYears } = window.calcDateUtils;
  const { getElements } = window.calcDom;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const buildEvents = (totalShares, years, startDate) => {
    const events = [];
    const sharesPerYear = Math.floor(totalShares / years);
    const remainder = totalShares % years;

    for (let year = 1; year <= years; year += 1) {
      const vestDate = addYears(startDate, year);
      const shares = sharesPerYear + (year === years ? remainder : 0);
      events.push({ year: vestDate.getFullYear(), date: vestDate, shares });
    }

    return events;
  };

  const bucketEvents = (events, growthRate) => {
    const buckets = new Map();

    const pushTo = (year, shares, fmv) => {
      const bucket = buckets.get(year) || { year, shares: 0, income: 0 };
      bucket.shares += shares;
      bucket.income += shares * fmv;
      buckets.set(year, bucket);
    };

    for (const event of events) {
      const targetYear = event.date <= CONV_DATE ? 2025 : event.year;
      const stepsFrom2025 = Math.max(0, targetYear - 2025);
      const fmvUsed = targetYear === 2025
        ? FMV_BASE
        : FMV_BASE * Math.pow(1 + growthRate, stepsFrom2025);

      pushTo(targetYear, event.shares, fmvUsed);
    }

    return buckets;
  };

  const render83b = (totalShares, els) => {
    els.outTotalVested83b.textContent = formatInteger(totalShares);
    els.outTax83b.textContent = '$0';
  };

  const renderTable = (buckets, taxRate, els) => {
    els.tableBody.innerHTML = '';
    let totalIncome = 0;
    let totalTax = 0;
    let rowsRendered = 0;

    const sortedYears = Array.from(buckets.keys()).sort((a, b) => a - b);

    for (const year of sortedYears) {
      if (year < 2025) continue;

      const bucket = buckets.get(year);
      const avgFmv = bucket.shares ? bucket.income / bucket.shares : 0;
      const tax = bucket.income * taxRate;

      totalIncome += bucket.income;
      totalTax += tax;
      rowsRendered += 1;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>Taxes for ${year}</td>
        <td>${formatInteger(bucket.shares)}</td>
        <td>${formatCurrency(avgFmv)}</td>
        <td>${formatCurrency(bucket.income)}</td>
        <td>${formatCurrency(tax)}</td>
      `;

      els.tableBody.appendChild(row);
    }

    if (rowsRendered === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="5" style="text-align:left;color:#8ea2c9">No post-conversion vesting on or after 2025 based on the current grant start date.</td>';
      els.tableBody.appendChild(emptyRow);
    }

    els.sumIncome.textContent = formatCurrency(totalIncome);
    els.sumTax.textContent = formatCurrency(totalTax);
  };

  const calculate = (els) => {
    const totalShares = clamp(Math.floor(Number(els.grantAmount.value) || 0), 1, Number.MAX_SAFE_INTEGER);
    const years = clamp(Math.floor(Number(els.grantYears.value) || 0), 1, 100);
    const startDate = new Date(els.grantStart.value || '2024-01-01');
    const taxRate = clamp(Number(els.taxRate.value) || 0, 0, 100) / 100;
    const growthRate = clamp((Number(els.growthRate.value) || 0) / 100, -1, 5);

    render83b(totalShares, els);

    const events = buildEvents(totalShares, years, startDate);
    const buckets = bucketEvents(events, growthRate);
    renderTable(buckets, taxRate, els);
  };

  const attachListeners = (els) => {
    ['grantAmount', 'grantStart', 'grantYears', 'taxRate', 'growthRate'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      ['input', 'change'].forEach((eventName) => el.addEventListener(eventName, () => calculate(els)));
    });
  };

  const init = () => {
    const els = getElements();
    els.fmvStart.textContent = formatCurrency(FMV_BASE);
    attachListeners(els);
    calculate(els);
  };

  window.addEventListener('DOMContentLoaded', init);
})();
