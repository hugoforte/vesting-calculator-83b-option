(() => {
  const currencyFormatterPrecise = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const currencyFormatterNoDecimals = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const integerFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  });

  const formatCurrency = (value) => {
    if (!Number.isFinite(value)) return '—';
    if (value === 0) return currencyFormatterNoDecimals.format(0);

    const negative = value < 0;
    const abs = Math.abs(value);
    let core;

    if (abs >= 1_000_000) {
      const millions = Math.round(abs / 1_000_000);
      core = `$${integerFormatter.format(millions)}M`;
    } else if (abs >= 10_000) {
      const thousands = Math.round(abs / 1_000);
      core = `$${integerFormatter.format(thousands)}K`;
    } else if (abs >= 1_000) {
      core = currencyFormatterNoDecimals.format(abs);
    } else if (abs >= 1) {
      core = Number.isInteger(abs)
        ? currencyFormatterNoDecimals.format(abs)
        : currencyFormatterPrecise.format(abs);
    } else {
      core = currencyFormatterPrecise.format(abs);
    }

    return negative ? `-${core}` : core;
  };

  const formatInteger = (value) => integerFormatter.format(value);

  window.calcFormatters = {
    formatCurrency,
    formatInteger,
  };
})();
