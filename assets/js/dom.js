(() => {
  const getElements = () => ({
    grantsList: document.getElementById('grantsList'),
    addGrantBtn: document.getElementById('addGrantBtn'),
    outTotalVested83b: document.getElementById('outTotalVested83b'),
    outTax83b: document.getElementById('outTax83b'),
    tableBody: document.querySelector('#tableNo83b tbody'),
    sumIncome: document.getElementById('sumIncome'),
    sumTax: document.getElementById('sumTax'),
    sumNewShares: document.getElementById('sumNewShares'),
    sumTotalShares: document.getElementById('sumTotalShares'),
    sumTotalValue: document.getElementById('sumTotalValue'),
    fmvStart: document.getElementById('fmvStart'),
    convLabel: document.getElementById('convLabel'),
    totalSharesConst: document.getElementById('totalSharesConst'),
    postMoneyConst: document.getElementById('postMoneyConst'),
    totalValueConst: document.getElementById('totalValueConst'),
    outShareValue83b: document.getElementById('outShareValue83b'),
  });

  window.calcDom = {
    getElements,
  };
})();
