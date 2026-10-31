
(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Reading progress + active chapter ---------- */
  var progressEl = $("#progress");
  var readoutEl = $("#readout");
  var railLinks = $$("#rail-list a");
  var sections = $$(".chapter[id]");
  var maxScroll = 1;

  function recalcMax() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  function updateScrollUI() {
    var y = window.scrollY || window.pageYOffset || 0;
    var pct = Math.round(Math.min(1, Math.max(0, y / maxScroll)) * 100);
    if (progressEl) progressEl.style.width = pct + "%";
    if (readoutEl) readoutEl.textContent = "已读 " + pct + "%";

    var current = sections[0] || null;
    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= 140) current = section;
    });
    railLinks.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      if (current && id === current.id) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      updateScrollUI();
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { recalcMax(); onScroll(); });
  recalcMax();
  updateScrollUI();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { recalcMax(); updateScrollUI(); });
  }
  window.addEventListener("load", function () { recalcMax(); updateScrollUI(); });

  /* ---------- Mobile table of contents ---------- */
  var dialog = $("#toc-dialog");
  var tocOpen = $("#toc-open");
  var tocClose = $("#toc-close");

  if (dialog && tocOpen) {
    tocOpen.addEventListener("click", function () {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
    if (tocClose) {
      tocClose.addEventListener("click", function () {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      });
    }
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    $$(".dialog-list a", dialog).forEach(function (link) {
      link.addEventListener("click", function () { dialog.close(); });
    });
  }

  /* ---------- Print ---------- */
  ["#print-btn", "#print-btn-mobile"].forEach(function (sel) {
    var btn = $(sel);
    if (btn) {
      btn.addEventListener("click", function () {
        if (dialog && dialog.open) dialog.close();
        window.print();
      });
    }
  });

  /* ---------- Copy suggested microcopy ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-2000px";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      area.setSelectionRange(0, area.value.length);
      var ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch (err) {
      return false;
    }
  }

  $$(".copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.closest(".copycard");
      var quote = card ? card.querySelector("blockquote") : null;
      if (!quote) return;
      var label = btn.textContent;
      copyText(quote.textContent.trim()).then(function (ok) {
        var selected = false;
        if (!ok) selected = selectContents(quote);
        btn.textContent = ok ? "已复制" : (selected ? "已选中，按 Ctrl+C" : "复制失败");
        btn.classList.toggle("is-done", ok);
        window.clearTimeout(btn._copyTimer);
        btn._copyTimer = window.setTimeout(function () {
          btn.textContent = label;
          btn.classList.remove("is-done");
        }, 2600);
      });
    });
  });

  function selectContents(element) {
    try {
      var range = document.createRange();
      range.selectNodeContents(element);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch (err) {
      return false;
    }
  }

  /* ---------- CER / missed-line calculator ---------- */
  var calcFields = ["sub", "del", "ins", "chars", "miss", "lines"];
  var calcInputs = {};
  calcFields.forEach(function (key) { calcInputs[key] = $("#calc-" + key); });

  var calcCer = $("#calc-cer");
  var calcCerFormula = $("#calc-cer-formula");
  var calcMiss = $("#calc-miss-rate");
  var calcMissFormula = $("#calc-miss-formula");
  var calcNote = $("#calc-note");
  var calcReady = calcCer && calcMiss && calcCerFormula && calcMissFormula && calcNote &&
    calcFields.every(function (key) { return !!calcInputs[key]; });

  function readCount(input) {
    var raw = input.value.trim();
    if (raw === "") return null;
    var value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) return NaN;
    return value;
  }

  function formatPercent(value) {
    var rounded = Math.round(value * 10) / 10;
    return String(rounded) + "%";
  }

  function updateCalculator() {
    if (!calcReady) return;
    var values = {};
    var invalid = false;

    calcFields.forEach(function (key) {
      var value = readCount(calcInputs[key]);
      if (Number.isNaN(value)) invalid = true;
      values[key] = Number.isNaN(value) ? null : value;
    });

    var parts = [values.sub, values.del, values.ins];
    var cerReady = !invalid && parts.every(function (value) { return value !== null; }) &&
      values.chars !== null && values.chars > 0;
    var missReady = !invalid && values.miss !== null && values.lines !== null && values.lines > 0;

    if (cerReady) {
      var total = parts.reduce(function (sum, value) { return sum + value; }, 0);
      calcCer.textContent = formatPercent((total / values.chars) * 100);
      calcCerFormula.textContent = "(" + parts.join(" + ") + ") / " + values.chars;
    } else {
      calcCer.textContent = "—";
      calcCerFormula.textContent = "（替换 + 漏字 + 多字） / 标注字符数";
    }

    if (missReady) {
      calcMiss.textContent = formatPercent((values.miss / values.lines) * 100);
      calcMissFormula.textContent = values.miss + " / " + values.lines;
    } else {
      calcMiss.textContent = "—";
      calcMissFormula.textContent = "漏检文字行数 / 标注文字行数";
    }

    if (invalid) {
      calcNote.textContent = "请填写 0 或正整数；小数与负数不参与计算。";
    } else if (cerReady && missReady) {
      calcNote.textContent = "按原文公式计算，数值只代表你填写的样本。";
    } else {
      calcNote.textContent = "每项各自的分母需大于 0；留空的指标显示为 —。";
    }
  }

  if (calcReady) {
    calcFields.forEach(function (key) {
      calcInputs[key].addEventListener("input", updateCalculator);
    });

    var exampleBtn = $("#calc-example");
    var resetBtn = $("#calc-reset");
    if (exampleBtn) {
      exampleBtn.addEventListener("click", function () {
        var example = { sub: 3, del: 1, ins: 1, chars: 200, miss: 2, lines: 120 };
        calcFields.forEach(function (key) { calcInputs[key].value = example[key]; });
        updateCalculator();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        calcFields.forEach(function (key) { calcInputs[key].value = ""; });
        updateCalculator();
      });
    }
    updateCalculator();
  }

  /* ---------- Self-check quiz ---------- */
  var quizData = [
    {
      q: "用户说“轻便”。按第 2 章，哪一项最接近把它变成可验收要求？",
      options: [
        "安装包、安装占用、待命与峰值内存、投屏待命耗电都有测量方法，并按需 OCR",
        "安装包小于某个数字就算达标，不必测内存",
        "只保留一个主按钮，界面越少就越轻便",
        "模型参数量越小，产品就越轻便"
      ],
      answer: 0,
      why: "“轻便”要落到安装负担、常驻占用与学习成本，并分别测 APK、安装占用、待命 / 峰值内存、投屏待命耗电。只看包体或按钮数量都不够。",
      ref: "#wishes",
      refLabel: "第 2 章"
    },
    {
      q: "用户反馈“翻译很慢”。按文中的做法，第一步应该做什么？",
      options: [
        "换一个更快的模型",
        "把截图、框选、OCR、确认、网络五段分别记录耗时",
        "提高 OCR 线程数",
        "先关闭流式输出"
      ],
      answer: 1,
      why: "总耗时包含截图、用户框选、OCR、用户确认和网络翻译。每一段都记录，才知道应该优化哪里。",
      ref: "#wishes",
      refLabel: "第 2 章"
    },
    {
      q: "用户拒绝了屏幕捕获授权。产品应该怎么处理？",
      options: [
        "循环弹窗，直到用户同意",
        "返回首页，清楚说明当前少哪项能力，之后由用户主动开启",
        "静默沿用上一次的授权继续截图",
        "提示用户重启手机后再试"
      ],
      answer: 1,
      why: "用户拒绝权限时，应清楚说明当前少哪项能力；返回首页，之后主动开启，不循环弹窗。",
      ref: "#limits",
      refLabel: "第 5 章"
    },
    {
      q: "框选时冻结了截图，底下的游戏会怎样？",
      options: [
        "暂停，直到关闭结果卡片",
        "继续正常运行，冻结的只是截图",
        "自动降低画质",
        "退出全屏"
      ],
      answer: 1,
      why: "冻结的是截图，底下的游戏仍继续运行。需要准确取字时用户应先等待对话稳定，不宣传暂停游戏的能力。",
      ref: "#limits",
      refLabel: "第 5 章"
    },
    {
      q: "下面哪一项属于“首版暂缓”？",
      options: [
        "复制译文",
        "原文手动修正",
        "云同步与词库",
        "单个翻译服务配置"
      ],
      answer: 2,
      why: "账号、云同步、历史库、词库等属于首版暂缓；复制、原文修正、单个服务配置属于首版必须有。",
      ref: "#scope",
      refLabel: "第 6 章"
    },
    {
      q: "“置信分 0.99”能说明什么？",
      options: [
        "字符错误率一定低于 1%",
        "译文一定准确",
        "不能代替 CER、漏行率等真实指标，也可能掩盖关键人名或数字错误",
        "可以据此跳过固定样本验收"
      ],
      answer: 2,
      why: "文中明确“置信分 0.99”不能代替这些真实指标；准确率还要结合可用样本比例观察，防止关键错误被平均值掩盖。",
      ref: "#metrics",
      refLabel: "第 7 章"
    }
  ];

  var quizList = $("#quiz-list");
  var quizScore = $("#quiz-score");
  var quizReset = $("#quiz-reset");
  var answeredCount = 0;
  var correctCount = 0;

  function renderQuiz() {
    if (!quizList) return;
    answeredCount = 0;
    correctCount = 0;
    quizList.innerHTML = quizData.map(function (item, qi) {
      var options = item.options.map(function (option, oi) {
        return '<label class="option">' +
          '<input type="radio" name="q' + qi + '" value="' + oi + '">' +
          '<span class="option-text">' + option + '</span>' +
          '</label>';
      }).join("");
      return '<div class="quiz-item" data-q="' + qi + '">' +
        '<fieldset><legend>' +
        '<span class="q-index">' + (qi + 1) + '</span>' + item.q +
        '</legend><div class="options">' + options + '</div></fieldset>' +
        '<div class="q-feedback" aria-live="polite"></div>' +
        '</div>';
    }).join("");
    if (quizScore) quizScore.textContent = "已答 0 / " + quizData.length + "，答对 0";
  }

  if (quizList) {
    renderQuiz();

    quizList.addEventListener("change", function (event) {
      var input = event.target;
      if (!input || input.type !== "radio") return;
      var item = input.closest(".quiz-item");
      if (!item || item.dataset.answered === "1") return;
      item.dataset.answered = "1";

      var index = Number(item.getAttribute("data-q"));
      var data = quizData[index];
      var chosen = Number(input.value);
      var optionLabels = $$(".option", item);
      var correct = chosen === data.answer;

      optionLabels.forEach(function (label, oi) {
        var radio = label.querySelector("input");
        if (radio) radio.disabled = true;
        label.classList.add("is-locked");
        if (oi === data.answer) label.classList.add("is-correct");
        if (oi === chosen && !correct) label.classList.add("is-wrong");
      });

      var feedback = item.querySelector(".q-feedback");
      if (feedback) {
        feedback.innerHTML =
          "<p><strong>" + (correct ? "答对了。" : "还差一点。正确答案是“" + data.options[data.answer] + "”。") + "</strong></p>" +
          "<p>" + data.why + ' <a href="' + data.ref + '">回看' + data.refLabel + "</a></p>";
        feedback.setAttribute("tabindex", "-1");
        feedback.focus({ preventScroll: true });
      }

      answeredCount += 1;
      if (correct) correctCount += 1;
      if (quizScore) {
        quizScore.textContent = "已答 " + answeredCount + " / " + quizData.length + "，答对 " + correctCount;
      }
    });

    if (quizReset) {
      quizReset.addEventListener("click", function () {
        renderQuiz();
        quizReset.focus();
      });
    }
  }
})();
