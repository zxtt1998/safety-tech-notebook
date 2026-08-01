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
  customQuiz: JSON.parse(localStorage.getItem("safetyNotebookCustomQuiz") || "{}"),
  deletedItems: JSON.parse(localStorage.getItem("safetyNotebookDeletedItems") || "{}"),
  analysisCollapsed: localStorage.getItem("safetyNotebookAnalysisCollapsed") !== "false",
  referenceTexts: [],
};

const $ = (selector) => document.querySelector(selector);
const cards = $("#cards");
const tabs = $("#sectionTabs");
const template = $("#cardTemplate");
const quizTemplate = $("#quizTemplate");
const quizPagers = document.querySelectorAll("[data-quiz-pager]");
const titleInput = $("#titleInput");
const titleSyncStatus = $("#titleSyncStatus");
const analysisPanel = $("#analysisPanel");
const analysisBody = $("#analysisBody");
const analysisToggle = $("#analysisToggle");

state.quiz.sectionStats ||= {};

const REVIEW_INTERVALS = [
  { label: "20 分钟", ms: 20 * 60 * 1000 },
  { label: "1 小时", ms: 60 * 60 * 1000 },
  { label: "9 小时", ms: 9 * 60 * 60 * 1000 },
  { label: "1 天", ms: 24 * 60 * 60 * 1000 },
  { label: "2 天", ms: 2 * 24 * 60 * 60 * 1000 },
  { label: "6 天", ms: 6 * 24 * 60 * 60 * 1000 },
  { label: "31 天", ms: 31 * 24 * 60 * 60 * 1000 },
];

const FORGETTING_POINTS = [
  ["刚学", 100],
  ["20分", 55],
  ["1时", 40],
  ["9时", 37],
  ["1天", 30],
  ["2天", 25],
  ["6天", 20],
  ["31天", 10],
];

const isTestMode = () => state.mode === "quiz" || state.mode === "liyutian";

const saveProgress = () => {
  localStorage.setItem("safetyNotebookProgress", JSON.stringify(state.progress));
};

const saveQuiz = () => {
  localStorage.setItem("safetyNotebookQuiz", JSON.stringify(state.quiz));
};

const saveCustomQuiz = () => {
  localStorage.setItem("safetyNotebookCustomQuiz", JSON.stringify(state.customQuiz));
};

const saveDeletedItems = () => {
  localStorage.setItem("safetyNotebookDeletedItems", JSON.stringify(state.deletedItems));
};

const saveAllLocal = () => {
  saveProgress();
  saveQuiz();
  saveCustomQuiz();
  saveDeletedItems();
  localStorage.setItem("safetyNotebookTitle", state.appTitle);
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

const scheduleMemory = (item, result) => {
  const progress = itemProgress(item.id);
  const now = Date.now();
  progress.lastTestedAt = new Date(now).toISOString();
  progress.lastResult = result;
  progress.testAttempts = (progress.testAttempts || 0) + 1;
  progress.testWrong = (progress.testWrong || 0) + (result === "wrong" ? 1 : 0);

  if (result === "wrong") {
    progress.memoryStage = -1;
    progress.nextReviewAt = new Date(now).toISOString();
    return progress;
  }

  const nextStage = Math.min((progress.memoryStage ?? -1) + 1, REVIEW_INTERVALS.length - 1);
  progress.memoryStage = nextStage;
  progress.nextReviewAt = new Date(now + REVIEW_INTERVALS[nextStage].ms).toISOString();
  return progress;
};

const dueLabel = (iso) => {
  if (!iso) return "未安排";
  const due = Date.parse(iso);
  if (Number.isNaN(due)) return "未安排";
  const diff = due - Date.now();
  if (diff <= 0) return "现在巩固";
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `${minutes} 分钟后`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} 小时后`;
  return `${Math.ceil(hours / 24)} 天后`;
};

const memoryQueue = () =>
  activeItems()
    .map((item) => ({ item, progress: itemProgress(item.id), due: Date.parse(itemProgress(item.id).nextReviewAt || "") }))
    .filter((entry) => entry.progress.nextReviewAt && !Number.isNaN(entry.due))
    .sort((a, b) => a.due - b.due);

const isDeleted = (id) => Boolean(state.deletedItems[id]);

const activeItems = () => (state.mode === "liyutian" ? state.data.highFrequencyItems || [] : state.data.items)
  .filter((item) => !isDeleted(item.id));

const activeSections = () => {
  const source = state.mode === "liyutian" ? state.data.highFrequencySections || [] : state.data.sections;
  const visibleItems = activeItems();
  return source
    .map((section) => ({
      ...section,
      items: visibleItems.filter((item) => item.section === section.section).map((item) => item.id),
    }))
    .filter((section) => section.items.length > 0);
};

const filteredItems = () => {
  const query = state.query.trim().toLowerCase();
  return activeItems().filter((item) => {
    const sectionMatch = state.section === "all" || item.section === state.section;
    const kindMatch = state.kind === "all" || item.kind === state.kind;
    const queryMatch = !query || [item.text, item.section, item.domain, item.kind].join(" ").toLowerCase().includes(query);
    return sectionMatch && kindMatch && queryMatch;
  });
};

const buildReferenceTexts = (extra = []) => {
  const base = [...state.data.items, ...(state.data.highFrequencyItems || [])].map((item) => item.text);
  state.referenceTexts = [...new Set([...base, ...extra].filter(Boolean))];
};

const renderSummary = () => {
  const items = activeItems();
  const sections = activeSections();
  const mastered = items.filter((item) => itemProgress(item.id).mastered).length;
  const attempts = state.quiz.right + state.quiz.wrong;
  $("#totalCount").textContent = items.length;
  $("#sectionCount").textContent = sections.length;
  $("#masteredCount").textContent = mastered;
  $("#quizScore").textContent = attempts ? `${Math.round((state.quiz.right / attempts) * 100)}%` : "0%";
  $("#updatedAt").textContent = `已同步 ${items.length} 条`;
};

const quizInsight = () =>
  activeSections()
    .map((section) => {
      const stats = state.quiz.sectionStats[section.section] || { right: 0, wrong: 0 };
      const attempts = (stats.right || 0) + (stats.wrong || 0);
      const wrongRate = attempts ? (stats.wrong || 0) / attempts : 0;
      const weakness = attempts ? wrongRate * 100 : 0;
      return {
        section: section.section,
        attempts,
        right: stats.right || 0,
        wrong: stats.wrong || 0,
        wrongRate,
        weakness: Math.max(0, weakness),
      };
    })
    .sort((a, b) => b.weakness - a.weakness || b.wrong - a.wrong);

const renderBarChart = (target, rows, max, formatter) => {
  target.innerHTML = rows
    .map((item) => {
      const width = Math.max(8, Math.round((item.weakness / max) * 100));
      return `
        <div class="bar-row">
          <div class="bar-label">
            <strong>${escapeHtml(item.section)}</strong>
            <span>${escapeHtml(formatter(item))}</span>
          </div>
          <div class="bar-track"><span style="width: ${width}%"></span></div>
        </div>
      `;
    })
    .join("");
};

const renderForgettingCurve = () => {
  const width = 520;
  const height = 172;
  const left = 26;
  const top = 18;
  const plotWidth = 470;
  const plotHeight = 104;
  const points = FORGETTING_POINTS.map(([, retention], index) => {
    const x = left + (index / (FORGETTING_POINTS.length - 1)) * plotWidth;
    const y = top + (1 - retention / 100) * plotHeight;
    return [x, y];
  });

  $("#forgettingCurve").innerHTML = `
    <svg class="curve-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="遗忘曲线">
      <path d="M ${left} ${top} V ${top + plotHeight} H ${left + plotWidth}" class="curve-axis"></path>
      <polyline points="${points.map(([x, y]) => `${x},${y}`).join(" ")}" class="curve-line"></polyline>
      ${points.map(([x, y], index) => `
        <g>
          <circle cx="${x}" cy="${y}" r="4.5" class="curve-dot"></circle>
          <text x="${x}" y="${top + plotHeight + 24}" text-anchor="middle">${FORGETTING_POINTS[index][0]}</text>
          <text x="${x}" y="${y - 10}" text-anchor="middle">${FORGETTING_POINTS[index][1]}%</text>
        </g>
      `).join("")}
    </svg>
  `;
};

const focusQuizItem = (item) => {
  state.mode = "quiz";
  state.section = item.section;
  state.kind = "all";
  state.query = item.text.slice(0, 12);
  state.quizPage = 0;
  $("#searchInput").value = state.query;
  document.querySelectorAll(".mode-switch button").forEach((entry) => {
    entry.classList.toggle("active", entry.dataset.mode === "quiz");
  });
  document.querySelectorAll(".segments button").forEach((entry) => {
    entry.classList.toggle("active", entry.dataset.kind === "all");
  });
  render();
  scrollToFirstQuiz();
};

const renderReviewQueue = () => {
  const queue = memoryQueue();
  const dueNow = queue.filter((entry) => entry.due <= Date.now());
  const target = $("#reviewQueue");
  const list = [...dueNow, ...queue.filter((entry) => entry.due > Date.now())].slice(0, 8);

  if (!list.length) {
    target.innerHTML = '<div class="empty mini">暂无巩固任务。测试答错后，会自动把题目放到这里。</div>';
    return;
  }

  target.innerHTML = "";
  const summary = document.createElement("div");
  summary.className = "queue-summary";
  summary.textContent = `现在需巩固 ${dueNow.length} 题 · 已安排 ${queue.length} 题`;
  target.appendChild(summary);

  list.forEach(({ item, progress, due }) => {
    const row = document.createElement("div");
    row.className = `queue-item${due <= Date.now() ? " due" : ""}`;
    const stage = Math.max(0, Math.min(progress.memoryStage || 0, REVIEW_INTERVALS.length - 1));
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.id)} · ${escapeHtml(item.section)}</strong>
        <p>${escapeHtml(item.text)}</p>
        <span>${escapeHtml(dueLabel(progress.nextReviewAt))} · 第 ${stage + 1} 阶段 · 上次${progress.lastResult === "wrong" ? "答错" : "答对"}</span>
      </div>
    `;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = due <= Date.now() ? "开始巩固" : "查看";
    button.addEventListener("click", () => focusQuizItem(item));
    row.appendChild(button);
    target.appendChild(row);
  });
};

const renderAnalysis = () => {
  if (!isTestMode()) {
    analysisPanel.hidden = true;
    return;
  }
  analysisPanel.hidden = false;
  const quizRows = quizInsight().filter((item) => item.attempts > 0).slice(0, 6);
  const quizMax = Math.max(...quizRows.map((item) => item.weakness), 1);
  const quizWeakest = quizRows[0];

  $("#analysisSignal").textContent = quizWeakest
    ? `${quizWeakest.section} · 错误率 ${Math.round(quizWeakest.wrongRate * 100)}%`
    : "等待测试记录";

  if (quizRows.length) {
    renderBarChart($("#quizBarChart"), quizRows, quizMax, (item) =>
      `错 ${item.wrong}/${item.attempts} · 正确 ${item.right} · 薄弱 ${Math.round(item.weakness)}`,
    );
  } else {
    $("#quizBarChart").innerHTML = '<div class="empty mini">还没有测试记录，答题后会生成测试雷达。</div>';
  }

  renderForgettingCurve();
  renderReviewQueue();
};

const renderTabs = () => {
  tabs.innerHTML = "";
  const items = activeItems();
  const sections = activeSections();
  const all = document.createElement("button");
  all.type = "button";
  all.className = state.section === "all" ? "active" : "";
  all.innerHTML = `<strong>${state.mode === "liyutian" ? "全部高频" : "全部错题"}</strong><span>${items.length} 条</span>`;
  all.addEventListener("click", () => {
    state.section = "all";
    state.quizPage = 0;
    render();
  });
  tabs.appendChild(all);

  sections.forEach((section) => {
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
  const section = activeSections().find((entry) => entry.section === state.section);
  $("#domainName").textContent = section?.domain || (state.mode === "liyutian" ? "李天宇高频" : "全部章节");
  $("#sectionName").textContent = isTestMode()
    ? (state.mode === "liyutian" ? "李天宇高频模块测试" : "测试模式")
    : section?.section || "错题总览";
  $("#shuffleBtn").textContent = isTestMode() ? "下一页" : "随机背诵";
  $("#shuffleBtn").disabled = isTestMode() && state.quizPage >= Math.ceil(items.length / state.pageSize) - 1;
  quizPagers.forEach((pager) => {
    pager.hidden = !isTestMode();
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

  if (isTestMode()) {
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
    node.style.setProperty("--card-index", index);
    node.querySelector("strong").textContent = `Q${state.quizPage * state.pageSize + index + 1}`;
    node.querySelector(".card-meta span").textContent = `${item.section} · ${item.kind}`;
    node.querySelector(".quiz-prompt").textContent = quiz.prompt;
    node.querySelector(".quiz-hint").textContent = quiz.hint;
    node.querySelector(".quiz-answer").innerHTML = `<strong>应填：</strong>${escapeHtml(quiz.answer)}<br><strong>完整句：</strong>${escapeHtml(item.text)}`;
    const editBtn = document.createElement("button");
    editBtn.className = "edit-quiz-btn";
    editBtn.type = "button";
    editBtn.textContent = state.customQuiz[item.id] ? "已自定义" : "编辑命题";
    editBtn.addEventListener("click", () => openQuizEditor(item, node, quiz));
    node.querySelector(".card-meta").appendChild(editBtn);
    node.querySelector(".reveal-btn").addEventListener("click", () => {
      node.querySelector(".quiz-answer").hidden = false;
      node.querySelector(".quiz-actions").hidden = false;
    });
    node.querySelector(".wrong-btn").addEventListener("click", () => {
      state.quiz.wrong += 1;
      const stats = (state.quiz.sectionStats[item.section] ||= { right: 0, wrong: 0 });
      stats.wrong += 1;
      scheduleMemory(item, "wrong");
      saveProgress();
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
      scheduleMemory(item, "right");
      saveProgress();
      saveQuiz();
      renderSummary();
      renderAnalysis();
      node.classList.add("right");
      lockQuizCard(node);
    });
    cards.appendChild(node);
  });
  cards.classList.remove("page-enter");
  void cards.offsetWidth;
  cards.classList.add("page-enter");
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
      scrollToFirstQuiz();
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
      scrollToFirstQuiz();
    });

    pager.append(prev, page, next);
  });
};

const scrollToFirstQuiz = () => {
  window.setTimeout(() => {
    const first = cards.firstElementChild;
    if (!first) return;
    const top = first.getBoundingClientRect().top + window.scrollY - 14;
    window.scrollTo({ top, behavior: "auto" });
  }, 50);
};

const lockQuizCard = (node) => {
  node.querySelectorAll(".quiz-actions button").forEach((button) => {
    button.disabled = true;
  });
};

const makeQuiz = (item) => {
  const custom = state.customQuiz[item.id];
  if (custom?.prompt) {
    return {
      prompt: custom.prompt,
      answer: custom.answer || item.text,
      hint: custom.hint || "自定义命题",
    };
  }
  if (item.quiz?.prompt) return item.quiz;
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

const makeDefaultQuiz = (text, memory = "自定义命题") => {
  const kind = /\d/.test(text) ? "数值题" : "概念题";
  if (kind === "数值题") {
    const numericPattern = /\d+(?:\.\d+)?\s*(?:dB\(A\)|dB|kN|mm|ms|min|米|伏|千伏|千欧|%|度)?/gi;
    const answers = text.match(numericPattern) || [];
    return {
      prompt: `填空：${text.replace(numericPattern, "____")}`,
      answer: answers.join("、"),
      hint: "提示：重点核对数值、单位、上下限和适用对象。",
    };
  }
  const cloze = makeCloze(text);
  return {
    prompt: `填空：${cloze.prompt}`,
    answer: cloze.answer,
    hint: `提示：${memory}`,
  };
};

const normalizeForMatch = (value) => String(value)
  .replace(/^填空[:：]\s*/, "")
  .replace(/_{2,}|＿{2,}|（\s*）|\(\s*\)/g, "")
  .replace(/[押微]/g, "")
  .replace(/[，。；：、,.!?！？;:\s"'“”‘’（）()【】《》\-—]/g, "")
  .toLowerCase();

const normalizeWithMap = (value) => {
  let text = "";
  const map = [];
  [...String(value)].forEach((char, index) => {
    const normalized = normalizeForMatch(char);
    if (!normalized) return;
    text += normalized;
    map.push(index);
  });
  return { text, map };
};

const cleanInferredAnswer = (value) => String(value)
  .replace(/^[:：，。,；;\s]+|[:：，。,；;\s]+$/g, "")
  .replace(/([\u4e00-\u9fa5])\1/g, "$1")
  .trim();

const matchingNgrams = (value) => {
  const normalized = normalizeForMatch(value);
  const grams = new Set();
  for (let size = Math.min(12, normalized.length); size >= 4; size -= 1) {
    for (let index = 0; index <= normalized.length - size; index += 1) {
      grams.add(normalized.slice(index, index + size));
    }
  }
  return [...grams].sort((a, b) => b.length - a.length);
};

const inferBlankFromReference = (prompt, referenceText) => {
  const cleaned = prompt.replace(/^填空[:：]\s*/, "").trim();
  const blankPattern = /_{2,}|＿{2,}|（\s*）|\(\s*\)/;
  if (!blankPattern.test(cleaned)) return "";

  const [before = "", after = ""] = cleaned.split(blankPattern);
  const beforeNorm = normalizeForMatch(before);
  const afterNorm = normalizeForMatch(after);
  if (!beforeNorm && !afterNorm) return "";

  const ref = normalizeWithMap(referenceText);
  let start = beforeNorm ? ref.text.indexOf(beforeNorm) : 0;
  if (start < 0 && beforeNorm.length > 8) start = ref.text.indexOf(beforeNorm.slice(-8));
  let matchedBeforeLength = beforeNorm.length;
  if (start < 0 && beforeNorm) {
    const gram = matchingNgrams(before).find((entry) => ref.text.includes(entry));
    if (gram) {
      start = ref.text.indexOf(gram);
      matchedBeforeLength = gram.length;
    }
  }
  if (start < 0) return "";

  const answerStartNorm = start + (beforeNorm && ref.text.startsWith(beforeNorm, start) ? beforeNorm.length : matchedBeforeLength);
  let answerEndNorm = afterNorm ? ref.text.indexOf(afterNorm, answerStartNorm) : ref.text.length;
  if (answerEndNorm < 0 && afterNorm.length > 8) answerEndNorm = ref.text.indexOf(afterNorm.slice(0, 8), answerStartNorm);
  if (answerEndNorm < answerStartNorm) return "";

  const rawStart = ref.map[answerStartNorm] ?? 0;
  const rawEnd = ref.map[answerEndNorm] ?? String(referenceText).length;
  const answer = cleanInferredAnswer(String(referenceText).slice(rawStart, rawEnd));
  return answer.length <= 80 ? answer : "";
};

const referenceScore = (prompt, referenceText) => {
  const query = normalizeForMatch(prompt);
  const ref = normalizeForMatch(referenceText);
  if (!query || !ref) return 0;
  const grams = matchingNgrams(prompt).filter((part) => part.length >= 4).slice(0, 80);
  return grams.reduce((score, part) => score + (ref.includes(part) ? Math.min(part.length, 10) : 0), 0);
};

const sortedReferencesForPrompt = (prompt, item) =>
  [item.text, ...state.referenceTexts]
    .filter(Boolean)
    .map((text) => ({ text, score: referenceScore(prompt, text) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.text);

const inferQuizFromPrompt = (prompt, item, fallback) => {
  const cleaned = prompt.replace(/^填空[:：]\s*/, "").trim();
  const blankPattern = /_{2,}|＿{2,}|（\s*）|\(\s*\)/;
  const blankMatch = cleaned.match(blankPattern);

  if (blankMatch) {
    for (const referenceText of sortedReferencesForPrompt(prompt, item).slice(0, 80)) {
      const answer = inferBlankFromReference(prompt, referenceText);
      if (answer) {
        return {
          answer,
          hint: referenceText === item.text ? "提示：根据原始错题自动反推空格内容。" : "提示：根据题库/PDF参考内容自动匹配。",
        };
      }
    }
  }

  const regenerated = makeDefaultQuiz(cleaned || item.text, item.memory);
  return {
    answer: regenerated.answer || fallback.answer,
    hint: regenerated.hint || fallback.hint,
  };
};

const openQuizEditor = (item, node, quiz) => {
  const existing = node.querySelector(".quiz-editor");
  if (existing) {
    existing.remove();
    return;
  }

  const editor = document.createElement("div");
  editor.className = "quiz-editor";
  editor.innerHTML = `
    <label>题干<textarea data-edit-field="prompt">${escapeHtml(quiz.prompt)}</textarea></label>
    <label>答案<textarea data-edit-field="answer">${escapeHtml(quiz.answer)}</textarea></label>
    <label>提示<textarea data-edit-field="hint">${escapeHtml(quiz.hint)}</textarea></label>
    <div class="quiz-editor-actions">
      <button type="button" data-editor-save>保存命题</button>
      <button type="button" data-editor-auto>重新生成答案</button>
      <button type="button" data-editor-reset>恢复默认</button>
      <button type="button" data-editor-delete>删除题目</button>
      <button type="button" data-editor-close>收起</button>
    </div>
  `;

  const promptField = editor.querySelector('[data-edit-field="prompt"]');
  const answerField = editor.querySelector('[data-edit-field="answer"]');
  const hintField = editor.querySelector('[data-edit-field="hint"]');
  let answerTouched = false;
  let hintTouched = false;

  const applyAutoAnswer = ({ force = false } = {}) => {
    const inferred = inferQuizFromPrompt(promptField.value, item, quiz);
    if (force || !answerTouched) answerField.value = inferred.answer;
    if (force || !hintTouched) hintField.value = inferred.hint;
  };

  promptField.addEventListener("input", () => applyAutoAnswer());
  answerField.addEventListener("input", () => {
    answerTouched = true;
  });
  hintField.addEventListener("input", () => {
    hintTouched = true;
  });

  editor.querySelector("[data-editor-save]").addEventListener("click", () => {
    state.customQuiz[item.id] = {
      prompt: promptField.value.trim() || quiz.prompt,
      answer: answerField.value.trim() || quiz.answer,
      hint: hintField.value.trim() || quiz.hint,
      updated: new Date().toISOString(),
    };
    saveCustomQuiz();
    renderCards();
    setTitleStatus("命题已本地保存，可云同步", "ok");
  });

  editor.querySelector("[data-editor-auto]").addEventListener("click", () => {
    answerTouched = false;
    hintTouched = false;
    applyAutoAnswer({ force: true });
    setTitleStatus("答案已按题干重新生成", "ok");
  });

  editor.querySelector("[data-editor-reset]").addEventListener("click", () => {
    delete state.customQuiz[item.id];
    saveCustomQuiz();
    renderCards();
    setTitleStatus("已恢复默认命题，可云同步", "ok");
  });

  editor.querySelector("[data-editor-delete]").addEventListener("click", () => {
    const ok = window.confirm(`确定删除这道题吗？\n${item.id} · ${item.text}\n\n删除后会从当前题库隐藏，并可通过“云同步全部”同步到其他设备。`);
    if (!ok) return;
    state.deletedItems[item.id] = new Date().toISOString();
    delete state.customQuiz[item.id];
    saveDeletedItems();
    saveCustomQuiz();
    state.quizPage = Math.max(0, state.quizPage);
    render();
    setTitleStatus("题目已删除，可云同步", "ok");
  });

  editor.querySelector("[data-editor-close]").addEventListener("click", () => editor.remove());
  node.querySelector(".quiz-hint").after(editor);
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

const cloudPayload = () => ({
  title: state.appTitle,
  progress: state.progress,
  quiz: state.quiz,
  customQuiz: state.customQuiz,
  deletedItems: state.deletedItems,
  updated: new Date().toISOString(),
});

const applyCloudPayload = (payload) => {
  if (!payload || typeof payload !== "object") return;
  if (payload.title) saveTitleLocal(payload.title);
  const cloudProgress = payload.progress || {};
  const mergedProgress = {};
  new Set([...Object.keys(cloudProgress), ...Object.keys(state.progress || {})]).forEach((id) => {
    const cloud = cloudProgress[id] || {};
    const local = state.progress[id] || {};
    const cloudDue = Date.parse(cloud.nextReviewAt || "");
    const localDue = Date.parse(local.nextReviewAt || "");
    const validDueDates = [cloudDue, localDue].filter((date) => !Number.isNaN(date));
    const cloudTested = Date.parse(cloud.lastTestedAt || "");
    const localTested = Date.parse(local.lastTestedAt || "");
    const cloudIsLatest = !Number.isNaN(cloudTested) && (Number.isNaN(localTested) || cloudTested >= localTested);
    mergedProgress[id] = {
      review: Math.max(cloud.review || 0, local.review || 0),
      mastered: Boolean(cloud.mastered || local.mastered),
      memoryStage: cloudIsLatest ? (cloud.memoryStage ?? local.memoryStage ?? -1) : (local.memoryStage ?? cloud.memoryStage ?? -1),
      nextReviewAt: validDueDates.length ? new Date(Math.min(...validDueDates)).toISOString() : undefined,
      lastTestedAt: cloudIsLatest ? cloud.lastTestedAt : local.lastTestedAt,
      lastResult: cloudIsLatest ? cloud.lastResult : local.lastResult,
      testAttempts: Math.max(cloud.testAttempts || 0, local.testAttempts || 0),
      testWrong: Math.max(cloud.testWrong || 0, local.testWrong || 0),
    };
  });
  const cloudStats = payload.quiz?.sectionStats || {};
  const localStats = state.quiz.sectionStats || {};
  const mergedStats = {};
  new Set([...Object.keys(cloudStats), ...Object.keys(localStats)]).forEach((section) => {
    mergedStats[section] = {
      right: Math.max(cloudStats[section]?.right || 0, localStats[section]?.right || 0),
      wrong: Math.max(cloudStats[section]?.wrong || 0, localStats[section]?.wrong || 0),
    };
  });
  const cloudCustom = payload.customQuiz || {};
  const mergedCustom = { ...state.customQuiz };
  Object.entries(cloudCustom).forEach(([id, value]) => {
    const localUpdated = Date.parse(mergedCustom[id]?.updated || "");
    const cloudUpdated = Date.parse(value?.updated || "");
    if (!mergedCustom[id] || cloudUpdated >= localUpdated || Number.isNaN(localUpdated)) {
      mergedCustom[id] = value;
    }
  });
  const cloudDeleted = payload.deletedItems || {};
  const mergedDeleted = { ...state.deletedItems };
  Object.entries(cloudDeleted).forEach(([id, value]) => {
    const localDeletedAt = Date.parse(mergedDeleted[id] || "");
    const cloudDeletedAt = Date.parse(value || "");
    if (!mergedDeleted[id] || cloudDeletedAt >= localDeletedAt || Number.isNaN(localDeletedAt)) {
      mergedDeleted[id] = value || new Date().toISOString();
    }
  });
  state.progress = mergedProgress;
  state.quiz = {
    right: Math.max(state.quiz.right || 0, payload.quiz?.right || 0),
    wrong: Math.max(state.quiz.wrong || 0, payload.quiz?.wrong || 0),
    sectionStats: mergedStats,
  };
  state.customQuiz = mergedCustom;
  state.deletedItems = mergedDeleted;
  state.quiz.sectionStats ||= {};
  saveAllLocal();
};

const loadCloudData = async ({ rerender = true } = {}) => {
  saveTitleLocal(state.appTitle);
  try {
    const response = await fetch(`user-data.json?_=${Date.now()}`);
    if (response.ok) {
      applyCloudPayload(await response.json());
      setTitleStatus("云端学习数据已加载", "ok");
    } else {
      setTitleStatus("使用本地学习数据", "");
    }
  } catch (error) {
    setTitleStatus("使用本地学习数据", "");
  }
  if (rerender && state.data) render();
};

const loadOptionalPdfReference = async () => {
  try {
    const response = await fetch(`pdf-reference.json?_=${Date.now()}`);
    if (!response.ok) return [];
    const reference = await response.json();
    return (reference.chunks || []).map((chunk) => chunk.text).filter(Boolean);
  } catch (error) {
    return [];
  }
};

const githubToken = () => {
  let token = localStorage.getItem("safetyNotebookGithubToken") || "";
  if (!token) {
    token = window.prompt("粘贴你在 GitHub 生成的 Personal access token。权限选 Repository contents: Read and write，只授权 zxtt1998/safety-tech-notebook。Token 只保存在本机浏览器。") || "";
    if (!token.trim()) return "";
    localStorage.setItem("safetyNotebookGithubToken", token.trim());
  }
  return token.trim();
};

const putGithubJson = async (path, payload, message, token) => {
  const api = `https://api.github.com/repos/zxtt1998/safety-tech-notebook/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  const current = await fetch(api, { headers }).then((response) => (response.ok ? response.json() : null));
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const body = {
    message,
    content: encoded,
  };
  if (current?.sha) body.sha = current.sha;
  const response = await fetch(api, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`GitHub API failed: ${path}`);
};

const syncAllToGithub = async () => {
  saveTitleLocal(titleInput.value);
  saveAllLocal();
  const token = githubToken();
  if (!token) {
    setTitleStatus("已本地保存，未云同步", "warn");
    return;
  }

  setTitleStatus("云同步中...", "");
  try {
    const payload = cloudPayload();
    await putGithubJson("user-data.json", payload, "Sync notebook learning data", token);
    await putGithubJson("title-config.json", { title: state.appTitle, updated: payload.updated }, `Update notebook title to ${state.appTitle}`, token);
    setTitleStatus("学习数据已云同步", "ok");
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
    state.section = "all";
    state.query = "";
    state.quizPage = 0;
    $("#searchInput").value = "";
    render();
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
  if (isTestMode()) {
    const totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
    state.quizPage = Math.min(totalPages - 1, state.quizPage + 1);
    renderCards();
    scrollToFirstQuiz();
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

$("#syncDataBtn").addEventListener("click", syncAllToGithub);

$("#loadCloudBtn").addEventListener("click", () => loadCloudData());

analysisToggle.addEventListener("click", () => {
  state.analysisCollapsed = !state.analysisCollapsed;
  localStorage.setItem("safetyNotebookAnalysisCollapsed", String(state.analysisCollapsed));
  renderAnalysisCollapse();
});

titleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    titleInput.blur();
    saveTitleLocal(titleInput.value);
    setTitleStatus("已本地保存", "ok");
  }
});

const renderAnalysisCollapse = () => {
  analysisPanel.classList.toggle("collapsed", state.analysisCollapsed);
  analysisBody.hidden = state.analysisCollapsed;
  analysisToggle.setAttribute("aria-expanded", String(!state.analysisCollapsed));
};

renderAnalysisCollapse();

fetch("data.json")
  .then((response) => response.json())
  .then(async (data) => {
    state.data = data;
    buildReferenceTexts(await loadOptionalPdfReference());
    loadCloudData({ rerender: false }).finally(render);
  })
  .catch(() => {
    cards.innerHTML = '<div class="empty">data.json 读取失败</div>';
  });
