(() => {
  const getElements = () => ({
    grantsList: document.getElementById('grantsList'),
    addGrantBtn: document.getElementById('addGrantBtn'),
    outTotalVested83b: document.getElementById('outTotalVested83b'),
    outTax83b: document.getElementById('outTax83b'),
    tableBody: document.querySelector('#tableNo83b tbody'),
    sumIncome: document.getElementById('sumIncome'),
    sumTax: document.getElementById('sumTax'),
    fmvStart: document.getElementById('fmvStart'),
    convLabel: document.getElementById('convLabel'),
    totalSharesConst: document.getElementById('totalSharesConst'),
    postMoneyConst: document.getElementById('postMoneyConst'),
  });

  window.calcDom = {
    getElements,
  };
})();
