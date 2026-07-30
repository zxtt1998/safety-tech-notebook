const state = {
  data: null,
  mode: "review",
  section: "all",
  kind: "all",
  query: "",
  quizPage: 0,
  pageSize: 10,
  progress: JSON.parse(localStorage.getItem("safetyNotebookProgress") || "{}"),
  quiz: JSON.parse(localStorage.getItem("safetyNotebookQuiz") || '{"right":0,"wrong":0}'),
};

const $ = (selector) => document.querySelector(selector);
const cards = $("#cards");
const tabs = $("#sectionTabs");
const template = $("#cardTemplate");
const quizTemplate = $("#quizTemplate");
const quizPager = $("#quizPager");

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
    state.quizPage = 0;
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
      state.quizPage = 0;
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
  $("#shuffleBtn").textContent = state.mode === "quiz" ? "下一页" : "随机背诵";
  $("#shuffleBtn").disabled = state.mode === "quiz" && state.quizPage >= Math.ceil(items.length / state.pageSize) - 1;
  quizPager.hidden = state.mode !== "quiz";

  if (!items.length) {
    quizPager.innerHTML = "";
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
  const totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
  state.quizPage = Math.min(state.quizPage, totalPages - 1);
  const start = state.quizPage * state.pageSize;
  return items.slice(start, start + state.pageSize);
};

const renderQuizCards = (items) => {
  const totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
  const pageItems = quizItems(items);
  renderQuizPager(items.length, totalPages);

  pageItems.forEach((item, index) => {
    const quiz = makeQuiz(item);
    const node = quizTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector("strong").textContent = `Q${state.quizPage * state.pageSize + index + 1}`;
    node.querySelector(".card-meta span").textContent = `${item.section} · ${item.kind}`;
    node.querySelector(".quiz-prompt").textContent = quiz.prompt;
    node.querySelector(".quiz-hint").textContent = quiz.hint;
    node.querySelector(".quiz-answer").innerHTML = `<strong>应填：</strong>${escapeHtml(quiz.answer)}<br><strong>完整句：</strong>${escapeHtml(item.text)}`;
    node.querySelector(".reveal-btn").addEventListener("click", () => {
      node.querySelector(".quiz-answer").hidden = false;
      node.querySelector(".quiz-actions").hidden = false;
    });
    node.querySelector(".wrong-btn").addEventListener("click", () => {
      state.quiz.wrong += 1;
      saveQuiz();
      renderSummary();
      node.classList.add("wrong");
      lockQuizCard(node);
    });
    node.querySelector(".right-btn").addEventListener("click", () => {
      state.quiz.right += 1;
      const progress = itemProgress(item.id);
      progress.review += 1;
      saveProgress();
      saveQuiz();
      renderSummary();
      node.classList.add("right");
      lockQuizCard(node);
    });
    cards.appendChild(node);
  });
};

const renderQuizPager = (count, totalPages) => {
  quizPager.innerHTML = "";

  const prev = document.createElement("button");
  prev.type = "button";
  prev.textContent = "上一页";
  prev.disabled = state.quizPage === 0;
  prev.addEventListener("click", () => {
    state.quizPage = Math.max(0, state.quizPage - 1);
    renderCards();
  });

  const page = document.createElement("span");
  page.textContent = `第 ${state.quizPage + 1} / ${totalPages} 页 · 共 ${count} 题`;

  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "下一页";
  next.disabled = state.quizPage >= totalPages - 1;
  next.addEventListener("click", () => {
    state.quizPage = Math.min(totalPages - 1, state.quizPage + 1);
    renderCards();
  });

  quizPager.append(prev, page, next);
};

const lockQuizCard = (node) => {
  node.querySelectorAll(".quiz-actions button").forEach((button) => {
    button.disabled = true;
  });
};

const makeQuiz = (item) => {
  if (item.kind === "数值题") {
    const answers = item.text.match(/\d+(?:\.\d+)?\s*(?:mm|ms|米|伏|千伏|千欧|%|度)?/gi) || [];
    return {
      prompt: `填空：${item.text.replace(/\d+(?:\.\d+)?\s*(?:mm|ms|米|伏|千伏|千欧|%|度)?/gi, "____")}`,
      answer: answers.join("、"),
      hint: "提示：重点核对数值、单位、上下限和适用对象。",
    };
  }
  const cloze = makeCloze(item.text);
  return {
    prompt: `填空：${cloze.prompt}`,
    answer: cloze.answer,
    hint: `提示：${item.memory}`,
  };
};

const makeCloze = (text) => {
  const rules = [
    /(不应|不得|不允许|不能|严禁)([^。，；]+)([。，；]?)/,
    /(属于)([^。，；]+)([。，；]?)/,
    /(是|为)([^。，；]+)([。，；]?)/,
    /(应当|应|要|必须)([^。，；]+)([。，；]?)/,
    /(采用|设置|安装)([^。，；]+)([。，；]?)/,
  ];

  for (const rule of rules) {
    const match = text.match(rule);
    if (match?.[2]?.trim().length >= 2) {
      return {
        prompt: text.replace(match[2], "____"),
        answer: `${match[1]}${match[2]}`,
      };
    }
  }

  const clean = text.replace(/[。.]$/, "");
  const keep = Math.max(8, Math.floor(clean.length * 0.58));
  return {
    prompt: `${clean.slice(0, keep)}____${text.endsWith("。") ? "。" : ""}`,
    answer: clean.slice(keep),
  };
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

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
    state.quizPage = 0;
    renderCards();
  });
});

$("#searchInput").addEventListener("input", (event) => {
  state.query = event.target.value;
  state.quizPage = 0;
  renderCards();
});

$("#shuffleBtn").addEventListener("click", () => {
  const items = filteredItems();
  if (!items.length) return;
  if (state.mode === "quiz") {
    const totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
    state.quizPage = Math.min(totalPages - 1, state.quizPage + 1);
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
