(() => {
  const getElements = () => ({
    grantsList: document.getElementById('grantsList'),
    addGrantBtn: document.getElementById('addGrantBtn'),
    resetAssumptionsBtn: document.getElementById('resetAssumptionsBtn'),
    assumptions: {
      totalShares: document.getElementById('assumptionTotalShares'),
      postMoney: document.getElementById('assumptionPostMoney'),
      fmv: document.getElementById('assumptionFmv'),
      conversionDate: document.getElementById('assumptionConversionDate'),
      taxRate: document.getElementById('assumptionTaxRate'),
      growthRate: document.getElementById('assumptionGrowthRate'),
    },
    outTotalVested83b: document.getElementById('outTotalVested83b'),
    outTax83b: document.getElementById('outTax83b'),
  outTaxNo83b: document.getElementById('outTaxNo83b'),
    tableBody: document.querySelector('#tableNo83b tbody'),
    sumIncome: document.getElementById('sumIncome'),
    sumTax: document.getElementById('sumTax'),
    sumNewShares: document.getElementById('sumNewShares'),
    sumTotalShares: document.getElementById('sumTotalShares'),
    sumTotalValue: document.getElementById('sumTotalValue'),
    outShareValue83b: document.getElementById('outShareValue83b'),
  });

  window.calcDom = {
    getElements,
  };
})();
