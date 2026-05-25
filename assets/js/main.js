(function () {
  const menuButton = document.querySelector("[data-menu-button]");
  const menuPanel = document.querySelector("[data-menu-panel]");
  const header = document.querySelector(".site-header");

  function setMenu(open) {
    if (!menuButton || !menuPanel) return;
    menuButton.setAttribute("aria-expanded", String(open));
    menuPanel.classList.toggle("is-open", open);
  }

  if (menuButton && menuPanel) {
    menuButton.addEventListener("click", () => {
      const isOpen = menuButton.getAttribute("aria-expanded") === "true";
      setMenu(!isOpen);
    });

    document.addEventListener("click", (event) => {
      if (!header || !header.contains(event.target)) {
        setMenu(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setMenu(false);
        menuButton.focus();
      }
    });
  }

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage) {
      link.setAttribute("aria-current", "page");
    }
  });

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const normalize = (value) => String(value ?? "").toLowerCase();

  function textForSearch(item) {
    return normalize([
      item.title,
      item.subtitle,
      item.issuer,
      item.publisher,
      item.author,
      item.summary,
      item.scope,
      item.type,
      item.category,
      item.sourceType,
      item.sourceNote,
      ...(item.themes || []),
      ...(item.keyPoints || [])
    ].join(" "));
  }

  function metaParts(item) {
    return [item.issuer, item.publisher, item.author, item.date, item.lawNumber]
      .filter(Boolean)
      .map((part) => `<span>${escapeHtml(part)}</span>`)
      .join("");
  }

  function tagMarkup(tags) {
    return (tags || [])
      .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join("");
  }

  function cardMarkup(item, collection) {
    const href = escapeHtml(item.url || "#");
    const externalAttrs = item.url && item.url !== "#" ? ' target="_blank" rel="noopener noreferrer"' : "";
    const fallbackSourceType = {
      documents: "行政資料・自治体資料・公的資料",
      laws: "法令・一次資料",
      articles: "論考・記事・参考資料"
    }[collection] || collection;
    const sourceType = item.sourceType || fallbackSourceType;
    const typeLabel = item.type || item.category || item.format;
    const typeTag = typeLabel ? `<span class="tag">${escapeHtml(typeLabel)}</span>` : "";
    const meta = metaParts(item);
    const keyPoints = item.keyPoints && item.keyPoints.length
      ? `<ul class="card-list">${item.keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>`
      : "";
    const format = item.format ? `形式: ${item.format}` : "";
    const verified = item.verifiedAt ? `確認日: ${item.verifiedAt}` : "";
    const note = [format, verified].filter(Boolean).join(" / ");

    return `
      <article class="resource-card">
        <div class="card-meta"><span class="tag primary">${escapeHtml(sourceType)}</span>${typeTag}${meta}</div>
        <h3><a href="${href}"${externalAttrs}>${escapeHtml(item.title)}</a></h3>
        <p>${escapeHtml(item.summary || item.description || "")}</p>
        ${item.sourceNote ? `<p class="source-note">${escapeHtml(item.sourceNote)}</p>` : ""}
        ${keyPoints}
        <div class="tag-list">${tagMarkup(item.themes)}</div>
        ${note ? `<p class="resource-note">${escapeHtml(note)}</p>` : ""}
      </article>
    `;
  }

  function uniqueSorted(items, key) {
    const values = new Set();
    items.forEach((item) => {
      const source = key === "themes" ? item.themes || [] : [item[key]];
      source.filter(Boolean).forEach((value) => values.add(value));
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "ja"));
  }

  function buildFilterChips(group, values, label) {
    if (!group) return;
    const chips = [`<button class="filter-chip" type="button" data-filter-value="all" aria-pressed="true">すべて</button>`]
      .concat(values.map((value) => `<button class="filter-chip" type="button" data-filter-value="${escapeHtml(value)}" aria-pressed="false">${escapeHtml(value)}</button>`));
    group.innerHTML = chips.join("");
    group.setAttribute("aria-label", label);
  }

  async function initResourceList(list) {
    const source = list.dataset.source;
    const collection = list.dataset.collection;
    const section = list.closest("[data-resource-section]") || document;
    const searchInput = section.querySelector("[data-resource-search]");
    const themeGroup = section.querySelector('[data-filter-group="theme"]');
    const typeGroup = section.querySelector('[data-filter-group="type"]');
    const countEl = section.querySelector("[data-resource-count]");
    const state = {
      query: "",
      theme: "all",
      type: "all"
    };

    let items = [];

    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      items = Array.isArray(data[collection]) ? data[collection] : [];
    } catch (error) {
      list.innerHTML = '<div class="empty-state">データを読み込めませんでした。GitHub Pages上ではJSONが読み込まれます。ローカル確認時は簡易サーバーから開いてください。</div>';
      return;
    }

    const fixedScope = list.dataset.filterScope;
    const fixedTheme = list.dataset.filterTheme;
    const fixedType = list.dataset.filterType;

    if (themeGroup) buildFilterChips(themeGroup, uniqueSorted(items, "themes"), "テーマで絞り込む");
    if (typeGroup) buildFilterChips(typeGroup, uniqueSorted(items, "type"), "種別で絞り込む");

    function filteredItems() {
      return items.filter((item) => {
        const queryOk = !state.query || textForSearch(item).includes(state.query);
        const scopeOk = !fixedScope || item.scope === fixedScope;
        const fixedThemeOk = !fixedTheme || (item.themes || []).includes(fixedTheme);
        const fixedTypeOk = !fixedType || item.type === fixedType || item.category === fixedType;
        const themeOk = state.theme === "all" || (item.themes || []).includes(state.theme);
        const typeOk = state.type === "all" || item.type === state.type || item.category === state.type;
        return queryOk && scopeOk && fixedThemeOk && fixedTypeOk && themeOk && typeOk;
      });
    }

    function render() {
      const shown = filteredItems();
      if (countEl) countEl.textContent = `${shown.length}件`;
      list.innerHTML = shown.length
        ? shown.map((item) => cardMarkup(item, collection)).join("")
        : `<div class="empty-state">${escapeHtml(list.dataset.empty || "該当する項目はありません。")}</div>`;
    }

    searchInput?.addEventListener("input", (event) => {
      state.query = normalize(event.target.value.trim());
      render();
    });

    [themeGroup, typeGroup].forEach((group) => {
      group?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-filter-value]");
        if (!button) return;
        const value = button.dataset.filterValue;
        const groupType = group.dataset.filterGroup;
        state[groupType] = value;
        group.querySelectorAll("[data-filter-value]").forEach((chip) => {
          chip.setAttribute("aria-pressed", String(chip === button));
        });
        render();
      });
    });

    render();
  }

  document.querySelectorAll("[data-resource-list]").forEach(initResourceList);
})();
