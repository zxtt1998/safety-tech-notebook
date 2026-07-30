const state = {
  data: null,
  mode: "review",
  section: "all",
  kind: "all",
  query: "",
  quizPage: 0,
  pageSize: 10,
  appTitle: localStorage.getItem("safetyNotebookTitle") || "安全技术错题本",
  progress: JSON.parse(localStorage.getItem("safetyNotebookProgress") || "{}"),
  quiz: JSON.parse(localStorage.getItem("safetyNotebookQuiz") || '{"right":0,"wrong":0}'),
};

const $ = (selector) => document.querySelector(selector);
const cards = $("#cards");
const tabs = $("#sectionTabs");
const template = $("#cardTemplate");
const quizTemplate = $("#quizTemplate");
const quizPagers = document.querySelectorAll("[data-quiz-pager]");
const titleInput = $("#titleInput");
const titleSyncStatus = $("#titleSyncStatus");

state.quiz.sectionStats ||= {};

const saveProgress = () => {
  localStorage.setItem("safetyNotebookProgress", JSON.stringify(state.progress));
};

const saveQuiz = () => {
  localStorage.setItem("safetyNotebookQuiz", JSON.stringify(state.quiz));
};

const saveTitleLocal = (title) => {
  state.appTitle = title.trim() || "安全技术错题本";
  localStorage.setItem("safetyNotebookTitle", state.appTitle);
  document.title = state.appTitle;
  titleInput.value = state.appTitle;
};

const setTitleStatus = (text, tone = "") => {
  titleSyncStatus.textContent = text;
  titleSyncStatus.dataset.tone = tone;
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

const sectionInsight = () =>
  state.data.sections
    .map((section) => {
      const items = state.data.items.filter((item) => item.section === section.section);
      const stats = state.quiz.sectionStats[section.section] || { right: 0, wrong: 0 };
      const mastered = items.filter((item) => itemProgress(item.id).mastered).length;
      const reviewed = items.reduce((sum, item) => sum + itemProgress(item.id).review, 0);
      const unmastered = items.length - mastered;
      const weakness = unmastered + stats.wrong * 2 - stats.right * 0.6;
      return {
        section: section.section,
        total: items.length,
        mastered,
        reviewed,
        right: stats.right || 0,
        wrong: stats.wrong || 0,
        weakness: Math.max(0, weakness),
      };
    })
    .sort((a, b) => b.weakness - a.weakness);

const renderAnalysis = () => {
  const insights = sectionInsight();
  const top = insights.slice(0, 6);
  const max = Math.max(...top.map((item) => item.weakness), 1);
  const mastered = state.data.items.filter((item) => itemProgress(item.id).mastered).length;
  const reviewed = state.data.items.filter((item) => itemProgress(item.id).review > 0 && !itemProgress(item.id).mastered).length;
  const untouched = Math.max(0, state.data.items.length - mastered - reviewed);
  const total = Math.max(1, state.data.items.length);
  const masteredDeg = (mastered / total) * 360;
  const reviewedDeg = ((mastered + reviewed) / total) * 360;
  const weakest = top[0];

  $("#analysisSignal").textContent = weakest
    ? `当前最需巩固：${weakest.section} · ${Math.round(weakest.weakness)}`
    : "等待学习记录";

  $("#barChart").innerHTML = top
    .map((item) => {
      const width = Math.max(8, Math.round((item.weakness / max) * 100));
      return `
        <div class="bar-row">
          <div class="bar-label">
            <strong>${escapeHtml(item.section)}</strong>
            <span>${item.mastered}/${item.total} 掌握 · 错 ${item.wrong}</span>
          </div>
          <div class="bar-track"><span style="width: ${width}%"></span></div>
        </div>
      `;
    })
    .join("");

  $("#pieChart").style.background = `conic-gradient(#078b7f 0 ${masteredDeg}deg, #1d63d8 ${masteredDeg}deg ${reviewedDeg}deg, #d92d36 ${reviewedDeg}deg 360deg)`;
  $("#pieLegend").innerHTML = [
    ["已掌握", mastered, "#078b7f"],
    ["待巩固", reviewed, "#1d63d8"],
    ["需攻克", untouched, "#d92d36"],
  ]
    .map(([label, value, color]) => `<span><i style="background:${color}"></i>${label} ${value} 题</span>`)
    .join("");
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
  quizPagers.forEach((pager) => {
    pager.hidden = state.mode !== "quiz";
  });

  if (!items.length) {
    quizPagers.forEach((pager) => {
      pager.innerHTML = "";
    });
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
      const stats = (state.quiz.sectionStats[item.section] ||= { right: 0, wrong: 0 });
      stats.wrong += 1;
      saveQuiz();
      renderSummary();
      renderAnalysis();
      node.classList.add("wrong");
      lockQuizCard(node);
    });
    node.querySelector(".right-btn").addEventListener("click", () => {
      state.quiz.right += 1;
      const stats = (state.quiz.sectionStats[item.section] ||= { right: 0, wrong: 0 });
      stats.right += 1;
      const progress = itemProgress(item.id);
      progress.review += 1;
      saveProgress();
      saveQuiz();
      renderSummary();
      renderAnalysis();
      node.classList.add("right");
      lockQuizCard(node);
    });
    cards.appendChild(node);
  });
};

const renderQuizPager = (count, totalPages) => {
  quizPagers.forEach((pager) => {
    pager.innerHTML = "";

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

    pager.append(prev, page, next);
  });
};

const lockQuizCard = (node) => {
  node.querySelectorAll(".quiz-actions button").forEach((button) => {
    button.disabled = true;
  });
};

const makeQuiz = (item) => {
  if (item.kind === "数值题") {
    const numericPattern = /\d+(?:\.\d+)?\s*(?:dB\(A\)|dB|kN|mm|ms|min|米|伏|千伏|千欧|%|度)?/gi;
    const answers = item.text.match(numericPattern) || [];
    return {
      prompt: `填空：${item.text.replace(numericPattern, "____")}`,
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
  renderAnalysis();
  renderTabs();
  renderCards();
};

const loadCloudTitle = () => {
  saveTitleLocal(state.appTitle);
  fetch(`title-config.json?_=${Date.now()}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((config) => {
      if (config?.title) {
        saveTitleLocal(config.title);
        setTitleStatus("云标题已加载", "ok");
      } else {
        setTitleStatus("使用本地标题", "");
      }
    })
    .catch(() => setTitleStatus("使用本地标题", ""));
};

const syncTitleToGithub = async () => {
  const title = titleInput.value.trim() || "安全技术错题本";
  saveTitleLocal(title);
  let token = localStorage.getItem("safetyNotebookGithubToken") || "";
  if (!token) {
    token = window.prompt("粘贴 GitHub Token，需要 repo contents 写入权限。Token 只保存在本机浏览器。") || "";
    if (!token.trim()) {
      setTitleStatus("已本地保存", "");
      return;
    }
    localStorage.setItem("safetyNotebookGithubToken", token.trim());
  }

  setTitleStatus("云同步中...", "");
  const api = "https://api.github.com/repos/zxtt1998/safety-tech-notebook/contents/title-config.json";
  const headers = {
    Authorization: `Bearer ${token.trim()}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  try {
    const current = await fetch(api, { headers }).then((response) => response.json());
    const content = `${JSON.stringify({ title, updated: new Date().toISOString() }, null, 2)}\n`;
    const encoded = btoa(unescape(encodeURIComponent(content)));
    const response = await fetch(api, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `Update notebook title to ${title}`,
        content: encoded,
        sha: current.sha,
      }),
    });
    if (!response.ok) throw new Error("GitHub API failed");
    setTitleStatus("标题已云同步", "ok");
  } catch (error) {
    setTitleStatus("云同步失败，已本地保存", "warn");
  }
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

$("#saveTitleBtn").addEventListener("click", () => {
  saveTitleLocal(titleInput.value);
  setTitleStatus("已本地保存", "ok");
});

$("#syncTitleBtn").addEventListener("click", syncTitleToGithub);

titleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    titleInput.blur();
    saveTitleLocal(titleInput.value);
    setTitleStatus("已本地保存", "ok");
  }
});

loadCloudTitle();

fetch("data.json")
  .then((response) => response.json())
  .then((data) => {
    state.data = data;
    render();
  })
  .catch(() => {
    cards.innerHTML = '<div class="empty">data.json 读取失败</div>';
  });
