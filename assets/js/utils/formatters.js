(() => {
  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });

  const integerFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  });

  const formatCurrency = (value) => currencyFormatter.format(value);
  const formatInteger = (value) => integerFormatter.format(value);

  window.calcFormatters = {
    formatCurrency,
    formatInteger,
  };
})();
