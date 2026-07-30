const state = {
  data: null,
  mode: "review",
  section: "all",
  kind: "all",
  query: "",
  progress: JSON.parse(localStorage.getItem("safetyNotebookProgress") || "{}"),
  quiz: JSON.parse(localStorage.getItem("safetyNotebookQuiz") || '{"right":0,"wrong":0}'),
};

const $ = (selector) => document.querySelector(selector);
const cards = $("#cards");
const tabs = $("#sectionTabs");
const template = $("#cardTemplate");
const quizTemplate = $("#quizTemplate");

const saveProgress = () => {
  localStorage.setItem("safetyNotebookProgress", JSON.stringify(state.progress));
};

const saveQuiz = () => {
  localStorage.setItem("safetyNotebookQuiz", JSON.stringify(state.quiz));
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
  const attempts = state.quiz.right + state.quiz.wrong;
  $("#totalCount").textContent = state.data.items.length;
  $("#sectionCount").textContent = state.data.sections.length;
  $("#masteredCount").textContent = mastered;
  $("#quizScore").textContent = attempts ? `${Math.round((state.quiz.right / attempts) * 100)}%` : "0%";
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
  $("#sectionName").textContent = state.mode === "quiz" ? "测试模式" : section?.section || "错题总览";
  $("#shuffleBtn").textContent = state.mode === "quiz" ? "换一组题" : "随机背诵";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "没有找到匹配的错题";
    cards.appendChild(empty);
    return;
  }

  if (state.mode === "quiz") {
    renderQuizCards(items);
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

const quizItems = (items) => {
  const source = [...items];
  for (let i = source.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [source[i], source[j]] = [source[j], source[i]];
  }
  return source.slice(0, Math.min(8, source.length));
};

const renderQuizCards = (items) => {
  quizItems(items).forEach((item, index) => {
    const node = quizTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector("strong").textContent = `Q${index + 1}`;
    node.querySelector(".card-meta span").textContent = `${item.section} · ${item.kind}`;
    node.querySelector(".quiz-prompt").textContent = makePrompt(item);
    node.querySelector(".quiz-answer").textContent = item.text;
    node.querySelector(".reveal-btn").addEventListener("click", () => {
      node.querySelector(".quiz-answer").hidden = false;
      node.querySelector(".quiz-actions").hidden = false;
    });
    node.querySelector(".wrong-btn").addEventListener("click", () => {
      state.quiz.wrong += 1;
      saveQuiz();
      renderSummary();
      node.classList.add("wrong");
    });
    node.querySelector(".right-btn").addEventListener("click", () => {
      state.quiz.right += 1;
      const progress = itemProgress(item.id);
      progress.review += 1;
      saveProgress();
      saveQuiz();
      renderSummary();
      node.classList.add("right");
    });
    cards.appendChild(node);
  });
};

const makePrompt = (item) => {
  if (item.kind === "数值题") {
    return item.text.replace(/\d+(?:\.\d+)?\s*(?:mm|ms|米|伏|千伏|千欧|%|度)?/gi, "____");
  }
  const text = item.text.replace(/[。.]$/, "");
  return `请复述：${text.slice(0, Math.max(12, Math.floor(text.length * 0.45)))}……`;
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

document.querySelectorAll(".mode-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode-switch button").forEach((entry) => entry.classList.remove("active"));
    button.classList.add("active");
    state.mode = button.dataset.mode;
    renderCards();
  });
});

$("#searchInput").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderCards();
});

$("#shuffleBtn").addEventListener("click", () => {
  const items = filteredItems();
  if (!items.length) return;
  if (state.mode === "quiz") {
    renderCards();
    return;
  }
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
