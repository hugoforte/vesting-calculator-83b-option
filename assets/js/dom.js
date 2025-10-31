(() => {
  const getElements = () => ({
    grantAmount: document.getElementById('grantAmount'),
    grantStart: document.getElementById('grantStart'),
    grantYears: document.getElementById('grantYears'),
    taxRate: document.getElementById('taxRate'),
    growthRate: document.getElementById('growthRate'),
    outTotalVested83b: document.getElementById('outTotalVested83b'),
    outTax83b: document.getElementById('outTax83b'),
    tableBody: document.querySelector('#tableNo83b tbody'),
    sumIncome: document.getElementById('sumIncome'),
    sumTax: document.getElementById('sumTax'),
    fmvStart: document.getElementById('fmvStart'),
  });

  window.calcDom = {
    getElements,
  };
})();
