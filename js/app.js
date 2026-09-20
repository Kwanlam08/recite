/**
 * App: 阶梯式背诵核心控制器与页面路由调度器
 * 严格使用 ES5 规范，全兼容 iOS 9.3.5 / iPod touch 5
 */
(function(window) {
  'use strict';

  var App = {
    currentView: 'home',
    activeTextId: 'quanxue',
    activeLevel: 0,
    activeParaIdx: 0, // 0: 全篇, 1+: 第N段 (1-indexed)
    showTranslation: true,
    showAnswer: false,
    randomSeed: 1,

    init: function() {
      var self = this;

      if (window.SafeStorage) window.SafeStorage.init();
      if (window.Pomodoro) window.Pomodoro.init();

      // 恢复全局用户设置
      var userSettings = window.SafeStorage ? window.SafeStorage.getItem('user_settings') : null;
      if (userSettings && typeof userSettings.showTranslation === 'boolean') {
        this.showTranslation = userSettings.showTranslation;
      }

      this.bindNavEvents();
      this.bindGlobalEvents();
      this.showView('home');
    },

    // 切换主视图
    showView: function(viewName, params) {
      this.currentView = viewName;

      var views = document.querySelectorAll('.app-view');
      for (var i = 0; i < views.length; i++) {
        views[i].style.display = 'none';
      }

      var navItems = document.querySelectorAll('.bottom-nav-item');
      for (var j = 0; j < navItems.length; j++) {
        var tab = navItems[j].getAttribute('data-view');
        if (tab === viewName) {
          navItems[j].className = 'bottom-nav-item active';
        } else {
          navItems[j].className = 'bottom-nav-item';
        }
      }

      var target = document.getElementById('view-' + viewName);
      if (target) {
        target.style.display = 'block';
      }

      window.scrollTo(0, 0);

      if (viewName === 'home') {
        this.renderHome();
      } else if (viewName === 'texts') {
        this.renderTexts(params ? params.category : null);
      } else if (viewName === 'recite') {
        if (params && params.textId) {
          this.activeTextId = params.textId;
          var prog = window.SafeStorage.getTextProgress(this.activeTextId);
          this.activeLevel = prog.level || 0;
        }
        this.renderRecite();
      } else if (viewName === 'stats') {
        this.renderStats();
      }
    },

    bindNavEvents: function() {
      var self = this;
      var navItems = document.querySelectorAll('.bottom-nav-item');
      for (var i = 0; i < navItems.length; i++) {
        (function(btn) {
          btn.onclick = function() {
            var view = btn.getAttribute('data-view');
            if (view) {
              self.showView(view);
            }
          };
        })(navItems[i]);
      }
    },

    bindGlobalEvents: function() {
      // 顶部番茄钟交互
      var pomoBtn = document.getElementById('header-pomo-btn');
      var pomoModal = document.getElementById('pomo-modal');
      var pomoClose = document.getElementById('pomo-modal-close');

      if (pomoBtn && pomoModal) {
        pomoBtn.onclick = function() {
          pomoModal.style.display = 'block';
        };
      }
      if (pomoClose && pomoModal) {
        pomoClose.onclick = function() {
          pomoModal.style.display = 'none';
        };
      }

      var pomoToggle = document.getElementById('pomo-toggle-btn');
      if (pomoToggle) {
        pomoToggle.onclick = function() {
          if (window.Pomodoro.isRunning) {
            window.Pomodoro.pause();
          } else {
            window.Pomodoro.start();
          }
        };
      }
      var pomoReset = document.getElementById('pomo-reset-btn');
      if (pomoReset) {
        pomoReset.onclick = function() {
          window.Pomodoro.reset();
        };
      }
      var pomoWork25 = document.getElementById('pomo-mode-work');
      if (pomoWork25) {
        pomoWork25.onclick = function() {
          window.Pomodoro.reset('work');
        };
      }
      var pomoBreak5 = document.getElementById('pomo-mode-break5');
      if (pomoBreak5) {
        pomoBreak5.onclick = function() {
          window.Pomodoro.reset('shortBreak');
        };
      }
      var pomoBreak10 = document.getElementById('pomo-mode-break10');
      if (pomoBreak10) {
        pomoBreak10.onclick = function() {
          window.Pomodoro.reset('longBreak');
        };
      }
    },

    /* ====================================================================
       1. 首页 (Home)
       ==================================================================== */
    renderHome: function() {
      var allTexts = window.RECITATION_TEXTS || [];
      var progressMap = window.SafeStorage.getItem('progress') || {};

      var masteredCount = 0;
      var learningCount = 0;
      var unlearnedCount = 0;
      var recentText = null;

      for (var i = 0; i < allTexts.length; i++) {
        var t = allTexts[i];
        var p = progressMap[t.id];
        if (p && p.status === 'mastered') {
          masteredCount++;
        } else if (p && p.lastStudied > 0) {
          learningCount++;
          if (!recentText || p.lastStudied > (progressMap[recentText.id] ? progressMap[recentText.id].lastStudied : 0)) {
            recentText = t;
          }
        } else {
          unlearnedCount++;
        }
      }

      if (!recentText && allTexts.length > 0) {
        recentText = allTexts[0];
      }

      // 掌握度看板
      var mEl = document.getElementById('home-count-mastered');
      var lEl = document.getElementById('home-count-learning');
      var uEl = document.getElementById('home-count-unlearned');
      if (mEl) mEl.innerHTML = masteredCount;
      if (lEl) lEl.innerHTML = learningCount;
      if (uEl) uEl.innerHTML = unlearnedCount;

      // 正在继续背诵卡片
      var recentContainer = document.getElementById('home-continue-card');
      if (recentContainer && recentText) {
        var rProg = window.SafeStorage.getTextProgress(recentText.id);
        var levelNames = ['Level 0 完整原文', 'Level 1 少量挖空', 'Level 2 中度挖空', 'Level 3 大量挖空', 'Level 4 骨架背诵', 'Level 5 🌟Emoji锚点'];
        var currentLevelName = levelNames[rProg.level || 0] || 'Level 0';

        recentContainer.innerHTML =
          '<div class="card highlight-card">' +
            '<div class="card-title">📖 继续阶梯背诵</div>' +
            '<div style="font-size: 1.15rem; font-weight: 700; color: #1e3a8a; margin-bottom: 4px;">《' + recentText.title + '》</div>' +
            '<div class="card-desc">' + recentText.author + ' · ' + recentText.dynasty + ' (' + currentLevelName + ')</div>' +
            '<button class="btn btn-primary btn-block" id="btn-home-continue">进入阶梯背诵</button>' +
          '</div>';

        document.getElementById('btn-home-continue').onclick = function() {
          App.showView('recite', { textId: recentText.id });
        };
      }

      // 最近篇目列表快速入口
      var listContainer = document.getElementById('home-recent-list');
      if (listContainer) {
        var html = '';
        var maxShow = Math.min(allTexts.length, 4);
        for (var j = 0; j < maxShow; j++) {
          var item = allTexts[j];
          var itemProg = window.SafeStorage.getTextProgress(item.id);
          var statusTag = itemProg.status === 'mastered' ? '<span class="badge badge-success">已掌握</span>' : (itemProg.status === 'learning' ? '<span class="badge badge-warning">L' + itemProg.level + ' 学习中</span>' : '<span class="badge">未开始</span>');
          html +=
            '<div class="wrong-item-row" style="cursor: pointer;" data-action="open-text" data-tid="' + item.id + '">' +
              '<div class="wrong-item-info">' +
                '<strong>《' + item.title + '》</strong> ' +
                '<span class="text-muted" style="font-size:0.8rem;">' + item.author + ' · ' + item.dynasty + '</span>' +
              '</div>' +
              '<div>' + statusTag + '</div>' +
            '</div>';
        }
        listContainer.innerHTML = html;

        var rows = listContainer.querySelectorAll('[data-action="open-text"]');
        for (var r = 0; r < rows.length; r++) {
          (function(el) {
            el.onclick = function() {
              var tid = el.getAttribute('data-tid');
              App.showView('recite', { textId: tid });
            };
          })(rows[r]);
        }
      }
    },

    /* ====================================================================
       2. 篇目库 (Texts)
       ==================================================================== */
    renderTexts: function() {
      var container = document.getElementById('texts-list-container');
      if (!container) return;

      var allTexts = window.RECITATION_TEXTS || [];
      var html = '';

      for (var i = 0; i < allTexts.length; i++) {
        var t = allTexts[i];
        var p = window.SafeStorage.getTextProgress(t.id);
        var levelNames = ['L0 原文', 'L1 少量', 'L2 中度', 'L3 大量', 'L4 骨架', 'L5 Emoji'];
        var lName = levelNames[p.level || 0] || 'L0';

        var badgeClass = p.status === 'mastered' ? 'badge-success' : (p.status === 'learning' ? 'badge-warning' : '');
        var badgeText = p.status === 'mastered' ? '已掌握' : (p.status === 'learning' ? '进行中 (' + lName + ')' : '未开始');

        html +=
          '<div class="card text-card">' +
            '<div class="text-card-header">' +
              '<div class="text-card-title">《' + t.title + '》</div>' +
              '<span class="badge ' + badgeClass + '">' + badgeText + '</span>' +
            '</div>' +
            '<div class="text-card-meta" style="margin-bottom: 8px;">' + t.author + ' · ' + t.dynasty + ' (' + t.category + ')</div>' +
            '<div class="text-card-actions">' +
              '<button class="btn btn-primary btn-sm" data-action="start-recite" data-tid="' + t.id + '">阶梯背诵</button> ' +
              (p.status !== 'mastered' ? '<button class="btn btn-outline btn-sm" data-action="mark-master" data-tid="' + t.id + '">标记已掌握</button>' : '<button class="btn btn-text btn-sm" data-action="unmark-master" data-tid="' + t.id + '">重置为学习中</button>') +
            '</div>' +
          '</div>';
      }

      container.innerHTML = html;

      var startBtns = container.querySelectorAll('[data-action="start-recite"]');
      for (var s = 0; s < startBtns.length; s++) {
        (function(btn) {
          btn.onclick = function() {
            var tid = btn.getAttribute('data-tid');
            App.showView('recite', { textId: tid });
          };
        })(startBtns[s]);
      }

      var masterBtns = container.querySelectorAll('[data-action="mark-master"]');
      for (var m = 0; m < masterBtns.length; m++) {
        (function(btn) {
          btn.onclick = function() {
            var tid = btn.getAttribute('data-tid');
            var prog = window.SafeStorage.getTextProgress(tid);
            prog.status = 'mastered';
            prog.level = 5;
            prog.lastStudied = new Date().getTime();
            window.SafeStorage.saveTextProgress(tid, prog);
            App.renderTexts();
          };
        })(masterBtns[m]);
      }

      var unmasterBtns = container.querySelectorAll('[data-action="unmark-master"]');
      for (var u = 0; u < unmasterBtns.length; u++) {
        (function(btn) {
          btn.onclick = function() {
            var tid = btn.getAttribute('data-tid');
            var prog = window.SafeStorage.getTextProgress(tid);
            prog.status = 'learning';
            window.SafeStorage.saveTextProgress(tid, prog);
            App.renderTexts();
          };
        })(unmasterBtns[u]);
      }
    },

    /* ====================================================================
       3. 核心：阶梯式背诵视图 (Recite)
       ==================================================================== */
    renderRecite: function() {
      var self = this;
      var textObj = this.getTextById(this.activeTextId);
      if (!textObj) return;

      var prog = window.SafeStorage.getTextProgress(this.activeTextId);
      prog.lastStudied = new Date().getTime();
      if (prog.status === 'unlearned') prog.status = 'learning';
      prog.level = this.activeLevel;
      window.SafeStorage.saveTextProgress(this.activeTextId, prog);

      // 标题与作者元信息
      var titleEl = document.getElementById('recite-text-title');
      var metaEl = document.getElementById('recite-text-meta');
      if (titleEl) titleEl.innerHTML = '《' + textObj.title + '》';
      if (metaEl) metaEl.innerHTML = textObj.author + ' · ' + textObj.dynasty;

      // 渲染阶梯等级导航条
      this.renderLevelBar();

      // 渲染段落 Tab
      this.renderParagraphTabs(textObj);

      // 渲染控制按钮状态（译文显示/隐藏、看答案）
      this.updateControlButtons();

      // 渲染正文内容
      this.renderReciteContent(textObj, prog);

      // 渲染底部推进按钮
      this.renderBottomAdvanceBtn();
    },

    getTextById: function(tid) {
      var all = window.RECITATION_TEXTS || [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === tid) return all[i];
      }
      return all[0] || null;
    },

    renderLevelBar: function() {
      var self = this;
      var levelBtns = document.querySelectorAll('.ladder-level-bar .level-btn');
      for (var i = 0; i < levelBtns.length; i++) {
        (function(btn) {
          var lvl = parseInt(btn.getAttribute('data-level'), 10);
          if (lvl === self.activeLevel) {
            btn.className = 'level-btn active';
          } else {
            btn.className = 'level-btn';
          }
          btn.onclick = function() {
            self.activeLevel = lvl;
            self.showAnswer = false;
            self.randomSeed++;
            self.renderRecite();
          };
        })(levelBtns[i]);
      }
    },

    renderParagraphTabs: function(textObj) {
      var self = this;
      var container = document.getElementById('recite-para-tabs');
      if (!container) return;

      var paras = textObj.paragraphs || [];
      var html = '<div class="para-tab ' + (this.activeParaIdx === 0 ? 'active' : '') + '" data-pidx="0">全篇</div>';

      for (var p = 0; p < paras.length; p++) {
        var num = p + 1;
        var pActive = this.activeParaIdx === num ? 'active' : '';
        html += '<div class="para-tab ' + pActive + '" data-pidx="' + num + '">第' + num + '段</div>';
      }

      container.innerHTML = html;

      var tabs = container.querySelectorAll('.para-tab');
      for (var t = 0; t < tabs.length; t++) {
        (function(tab) {
          tab.onclick = function() {
            var pidx = parseInt(tab.getAttribute('data-pidx'), 10);
            self.activeParaIdx = pidx;
            self.renderRecite();
          };
        })(tabs[t]);
      }
    },

    updateControlButtons: function() {
      var self = this;

      // 译文开关按钮
      var transBtn = document.getElementById('recite-btn-toggle-trans');
      if (transBtn) {
        if (this.showTranslation) {
          transBtn.className = 'ctrl-btn active';
          transBtn.innerHTML = '文 译文开启';
        } else {
          transBtn.className = 'ctrl-btn';
          transBtn.innerHTML = '文 译文隐藏';
        }
        transBtn.onclick = function() {
          self.showTranslation = !self.showTranslation;
          if (window.SafeStorage) {
            var s = window.SafeStorage.getItem('user_settings') || {};
            s.showTranslation = self.showTranslation;
            window.SafeStorage.setItem('user_settings', s);
          }
          self.renderRecite();
        };
      }

      // 偷看答案按钮
      var peekBtn = document.getElementById('recite-btn-peek-answer');
      if (peekBtn) {
        if (this.showAnswer) {
          peekBtn.className = 'ctrl-btn active';
          peekBtn.innerHTML = '👁️ 恢复挖空';
        } else {
          peekBtn.className = 'ctrl-btn';
          peekBtn.innerHTML = '👁️ 显示原文';
        }
        peekBtn.onclick = function() {
          self.showAnswer = !self.showAnswer;
          self.renderRecite();
        };
      }

      // 循环复练按钮（微随机打乱重置）
      var loopBtn = document.getElementById('recite-btn-loop');
      if (loopBtn) {
        loopBtn.onclick = function() {
          self.randomSeed++;
          self.showAnswer = false;
          self.renderRecite();
        };
      }
    },

    renderReciteContent: function(textObj, prog) {
      var container = document.getElementById('recite-content-card');
      if (!container) return;

      var trickyMap = prog.trickyWords || {};
      var paras = textObj.paragraphs || [];
      var html = '';

      var startP = this.activeParaIdx === 0 ? 0 : (this.activeParaIdx - 1);
      var endP = this.activeParaIdx === 0 ? paras.length : this.activeParaIdx;

      for (var p = startP; p < endP; p++) {
        var pObj = paras[p];
        html += '<div class="recite-para-block">';
        if (pObj.title) {
          html += '<div class="recite-para-title">' + pObj.title + '</div>';
        }

        var lines = pObj.lines || [];
        for (var l = 0; l < lines.length; l++) {
          var lineObj = lines[l];
          var lineHtml = window.LadderEngine.renderLine(lineObj, this.activeLevel, trickyMap, this.showAnswer, this.randomSeed + l);
          var isStarred = !!trickyMap[lineObj.orig];

          html +=
            '<div class="recite-line-item">' +
              '<div class="line-orig-text">' +
                lineHtml +
                '<button class="line-star-btn ' + (isStarred ? 'active' : '') + '" data-orig="' + lineObj.orig + '" title="标记难点易忘句">' +
                  (isStarred ? '⭐ 易忘' : '☆ 标记') +
                '</button>' +
              '</div>';

          // 译文对照行
          if (this.showTranslation && lineObj.trans) {
            html += '<div class="line-trans-text">' + lineObj.trans + '</div>';
          }

          // Level 5 或 Emoji 提示行
          if (this.activeLevel === 5 && lineObj.emoji) {
            html +=
              '<div class="line-emoji-bar">' +
                '<span class="line-emoji-label">视觉记忆锚点</span>' +
                lineObj.emoji +
              '</div>';
          }

          html += '</div>';
        }
        html += '</div>';
      }

      container.innerHTML = html;

      // 绑定标记易忘按钮
      var starBtns = container.querySelectorAll('.line-star-btn');
      for (var s = 0; s < starBtns.length; s++) {
        (function(btn) {
          btn.onclick = function() {
            var origStr = btn.getAttribute('data-orig');
            var starred = window.SafeStorage.toggleTrickyWord(textObj.id, origStr);
            if (starred) {
              btn.className = 'line-star-btn active';
              btn.innerHTML = '⭐ 易忘';
            } else {
              btn.className = 'line-star-btn';
              btn.innerHTML = '☆ 标记';
            }
          };
        })(starBtns[s]);
      }
    },

    renderBottomAdvanceBtn: function() {
      var self = this;
      var container = document.getElementById('recite-bottom-bar');
      if (!container) return;

      var nextLevel = this.activeLevel + 1;
      var levelNames = ['Level 0 原文', 'Level 1 少量挖空', 'Level 2 中度挖空', 'Level 3 大量挖空', 'Level 4 骨架背诵', 'Level 5 🌟Emoji脱水背诵'];

      if (this.activeLevel < 5) {
        container.innerHTML =
          '<button class="btn btn-primary btn-block" id="btn-advance-level">' +
            '已熟悉，提升难度 ➔ 进入 ' + levelNames[nextLevel] +
          '</button>';
        document.getElementById('btn-advance-level').onclick = function() {
          self.activeLevel = nextLevel;
          self.showAnswer = false;
          self.randomSeed++;
          self.renderRecite();
          window.scrollTo(0, 0);
        };
      } else {
        container.innerHTML =
          '<button class="btn btn-primary btn-block" id="btn-master-text" style="background-color: #15803d; border-color: #15803d;">' +
            '🎉 恭喜达成！标记已掌握《' + (this.getTextById(this.activeTextId).title) + '》' +
          '</button>' +
          '<button class="btn btn-outline btn-block" id="btn-restart-text" style="margin-top: 8px;">' +
            '🔁 重置回 Level 0 从头温故' +
          '</button>';

        document.getElementById('btn-master-text').onclick = function() {
          var prog = window.SafeStorage.getTextProgress(self.activeTextId);
          prog.status = 'mastered';
          prog.level = 5;
          window.SafeStorage.saveTextProgress(self.activeTextId, prog);
          alert('已标记为已掌握！保持经常温故知新。');
          self.showView('home');
        };

        document.getElementById('btn-restart-text').onclick = function() {
          self.activeLevel = 0;
          self.showAnswer = false;
          self.randomSeed++;
          self.renderRecite();
          window.scrollTo(0, 0);
        };
      }
    },

    /* ====================================================================
       4. 统计与备份 (Stats)
       ==================================================================== */
    renderStats: function() {
      var allTexts = window.RECITATION_TEXTS || [];
      var progressMap = window.SafeStorage.getItem('progress') || {};

      var totalMastered = 0;
      var totalTrickyWords = 0;

      var breakdownContainer = document.getElementById('stats-text-breakdown');
      var html = '';

      for (var i = 0; i < allTexts.length; i++) {
        var t = allTexts[i];
        var p = progressMap[t.id] || { level: 0, status: 'unlearned', trickyWords: {} };
        if (p.status === 'mastered') totalMastered++;

        var trickyCount = 0;
        if (p.trickyWords) {
          for (var k in p.trickyWords) {
            if (Object.prototype.hasOwnProperty.call(p.trickyWords, k)) {
              trickyCount++;
              totalTrickyWords++;
            }
          }
        }

        var levelPct = Math.round(((p.level || 0) / 5) * 100);

        html +=
          '<div class="stat-text-row">' +
            '<div class="stat-text-col title">《' + t.title + '》</div>' +
            '<div class="stat-text-col prog">' +
              '<div class="progress-bar-wrap"><div class="progress-bar-inner" style="width:' + levelPct + '%;"></div></div>' +
            '</div>' +
            '<div class="stat-text-col acc">L' + (p.level || 0) + '</div>' +
            '<div class="stat-text-col status"><span class="badge badge-sm ' + (p.status === 'mastered' ? 'badge-success' : '') + '">' + (p.status === 'mastered' ? '已掌握' : 'L' + (p.level || 0)) + '</span></div>' +
          '</div>';
      }

      if (breakdownContainer) {
        breakdownContainer.innerHTML = html;
      }

      var masteredEl = document.getElementById('stats-mastered-total');
      if (masteredEl) masteredEl.innerHTML = totalMastered;
      var trickyEl = document.getElementById('stats-tricky-total');
      if (trickyEl) trickyEl.innerHTML = totalTrickyWords;

      // 备份导出与导入
      var exportBtn = document.getElementById('btn-export-data');
      if (exportBtn) {
        exportBtn.onclick = function() {
          var json = window.SafeStorage.exportData();
          try {
            var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'recitation_backup_' + new Date().getTime() + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch (e) {
            prompt('请复制备份文本并妥善保存：', json);
          }
        };
      }

      var importBtn = document.getElementById('btn-import-data');
      var importInput = document.getElementById('file-import-input');
      if (importBtn && importInput) {
        importBtn.onclick = function() {
          importInput.click();
        };
        importInput.onchange = function() {
          if (importInput.files && importInput.files[0]) {
            var file = importInput.files[0];
            var reader = new FileReader();
            reader.onload = function(e) {
              var content = e.target.result;
              var res = window.SafeStorage.importData(content);
              if (res.success) {
                alert('数据恢复成功！');
                App.renderStats();
              } else {
                alert('导入失败：' + res.message);
              }
            };
            reader.readAsText(file);
          }
        };
      }

      var clearBtn = document.getElementById('btn-reset-data');
      if (clearBtn) {
        clearBtn.onclick = function() {
          if (confirm('确定要清空所有背诵进度与易忘标记吗？')) {
            window.SafeStorage.clearAll();
            alert('已清空所有数据。');
            App.renderStats();
          }
        };
      }
    }
  };

  window.App = App;

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('DOMContentLoaded', function() {
      App.init();
    }, false);
  } else if (window.attachEvent) {
    window.attachEvent('onload', function() {
      App.init();
    });
  }

})(typeof window !== 'undefined' ? window : this);
