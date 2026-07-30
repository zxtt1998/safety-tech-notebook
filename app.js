const state = {
  data: null,
  section: "all",
  kind: "all",
  query: "",
  progress: JSON.parse(localStorage.getItem("safetyNotebookProgress") || "{}"),
};

const $ = (selector) => document.querySelector(selector);
const cards = $("#cards");
const tabs = $("#sectionTabs");
const template = $("#cardTemplate");

const saveProgress = () => {
  localStorage.setItem("safetyNotebookProgress", JSON.stringify(state.progress));
};

const itemProgress = (id) => {
  state.progress[id] ||= { review: 0, mastered: false };
  return state.progress[id];
};

const filteredItems = () => {
  const query = state.query.trim().toLowerCase();
  return state.data.items.filter((item) => {
    const sectionMatch = state.section === "all" || item.section === state.section;
    const kindMatch = state.kind === "all" || item.kind === state.kind;
    const queryMatch = !query || [item.text, item.section, item.domain, item.kind].join(" ").toLowerCase().includes(query);
    return sectionMatch && kindMatch && queryMatch;
  });
};

const renderSummary = () => {
  const mastered = state.data.items.filter((item) => itemProgress(item.id).mastered).length;
  $("#totalCount").textContent = state.data.items.length;
  $("#sectionCount").textContent = state.data.sections.length;
  $("#masteredCount").textContent = mastered;
  $("#updatedAt").textContent = `已同步 ${state.data.items.length} 条`;
};

const renderTabs = () => {
  tabs.innerHTML = "";
  const all = document.createElement("button");
  all.type = "button";
  all.className = state.section === "all" ? "active" : "";
  all.innerHTML = `<strong>全部错题</strong><span>${state.data.items.length} 条</span>`;
  all.addEventListener("click", () => {
    state.section = "all";
    render();
  });
  tabs.appendChild(all);

  state.data.sections.forEach((section) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = state.section === section.section ? "active" : "";
    btn.innerHTML = `<strong>${section.section}</strong><span>${section.items.length} 条</span>`;
    btn.addEventListener("click", () => {
      state.section = section.section;
      render();
    });
    tabs.appendChild(btn);
  });
};

const renderCards = () => {
  cards.innerHTML = "";
  const items = filteredItems();
  const section = state.data.sections.find((entry) => entry.section === state.section);
  $("#domainName").textContent = section?.domain || "全部章节";
  $("#sectionName").textContent = section?.section || "错题总览";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "没有找到匹配的错题";
    cards.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const progress = itemProgress(item.id);
    const node = template.content.firstElementChild.cloneNode(true);
    node.classList.toggle("mastered", progress.mastered);
    node.querySelector("strong").textContent = item.id;
    node.querySelector(".card-meta span").textContent = `${item.section} · ${item.kind} · 复习 ${progress.review} 次`;
    node.querySelector(".question").textContent = item.text;
    node.querySelector(".memory").textContent = item.memory;
    node.querySelector(".review-btn").addEventListener("click", () => {
      progress.review += 1;
      saveProgress();
      render();
    });
    node.querySelector(".master-btn").textContent = progress.mastered ? "取消掌握" : "标记掌握";
    node.querySelector(".master-btn").addEventListener("click", () => {
      progress.mastered = !progress.mastered;
      saveProgress();
      render();
    });
    cards.appendChild(node);
  });
};

const render = () => {
  renderSummary();
  renderTabs();
  renderCards();
};

document.querySelectorAll(".segments button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segments button").forEach((entry) => entry.classList.remove("active"));
    button.classList.add("active");
    state.kind = button.dataset.kind;
    render();
  });
});

$("#searchInput").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderCards();
});

$("#shuffleBtn").addEventListener("click", () => {
  const items = filteredItems();
  if (!items.length) return;
  const pick = items[Math.floor(Math.random() * items.length)];
  state.query = pick.text.slice(0, 8);
  $("#searchInput").value = state.query;
  renderCards();
  cards.firstElementChild?.scrollIntoView({ behavior: "smooth", block: "start" });
});

fetch("data.json")
  .then((response) => response.json())
  .then((data) => {
    state.data = data;
    render();
  })
  .catch(() => {
    cards.innerHTML = '<div class="empty">data.json 读取失败</div>';
  });
