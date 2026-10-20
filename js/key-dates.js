// Key dates of the sports content year (Halloween, Black Friday…), shown in the Content Plan calendars
// (js/content-plan.js and the library's side panel, js/plan-panel.js). Each one can open its posts in the library.
(() => {
  const LIST = [
    { m: 1, d: 1, icon: "party-popper", name: "New Year", q: "new year" },
    { m: 2, d: 14, icon: "heart", name: "Valentine’s Day", q: "valentine" },
    { m: 3, d: 8, icon: "sparkles", name: "Women’s Day", q: "women's day" },
    { m: 4, d: 1, icon: "drama", name: "April Fools", q: "april fools" },
    { m: 4, d: 22, icon: "earth", name: "Earth Day", q: "earth day" },
    { m: 6, d: 28, icon: "rainbow", name: "Pride", q: "pride" },
    { m: 7, d: 15, icon: "plane", name: "Pre-season", q: "preseason" },
    { m: 8, d: 15, icon: "calendar-days", name: "Fixture release", q: "fixtures" },
    { m: 10, d: 31, icon: "ghost", name: "Halloween", q: "halloween" },
    { m: 11, d: 0, icon: "shopping-bag", name: "Black Friday", q: "black friday" }, // 4th Friday of November
    { m: 12, d: 25, icon: "tree-pine", name: "Christmas", q: "christmas" },
    { m: 12, d: 28, icon: "drama", name: "Inocentes", q: "inocentes" },
  ];
  const day = (k, y) => {
    if (k.d) return new Date(y, k.m - 1, k.d);
    const first = new Date(y, 10, 1);
    return new Date(y, 10, 1 + ((5 - first.getDay() + 7) % 7) + 21);
  };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  window.SCP_KEY_DATES = {
    list: LIST,
    // the key date on a day ("YYYY-MM-DD"), if any
    on: (date) => { const y = Number(String(date).slice(0, 4)); return LIST.find((k) => iso(day(k, y)) === date) || null; },
    // the library showing that date's posts
    href: (k) => `content-library.html?topic=${encodeURIComponent(k.q)}`,
  };
})();
