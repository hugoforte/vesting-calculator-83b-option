(() => {
  const addYears = (date, years) => {
    const newDate = new Date(date.getTime());
    newDate.setFullYear(newDate.getFullYear() + years);
    return newDate;
  };

  window.calcDateUtils = {
    addYears,
  };
})();
