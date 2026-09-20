/**
 * LadderEngine: 阶梯式背诵核心动态挖空算法与 Emoji 记忆锚点引擎
 * 严格使用 ES5 规范，全面兼容 iOS 9.3.5 / iPod touch 5
 */
(function(window) {
  'use strict';

  var LadderEngine = {
    // 标点符号判定
    isPunctuation: function(ch) {
      return /[，。；？！：、“”‘’（）《》·\s]/.test(ch);
    },

    // 伪随机（基于句子与字词位置种子，保证单次渲染稳定，但跨次背诵具备微随机性）
    pseudoRandom: function(seed) {
      var x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    },

    /**
     * 渲染单句文言文的阶梯形态
     * @param {Object} lineObj 句子对象 { orig, trans, emoji, keywords }
     * @param {number} level 阶梯等级 (0~5)
     * @param {Object} trickyMap 用户标记的易忘词哈希表 { '字词': true }
     * @param {boolean} showAnswer 是否全局显示原文（偷看答案）
     * @param {number} randomSeed 随机扰动种子
     * @returns {string} 渲染后的 HTML 字符串
     */
    renderLine: function(lineObj, level, trickyMap, showAnswer, randomSeed) {
      var orig = lineObj.orig;
      if (!orig) return '';

      // Level 0 或用户点击“显示答案”时：展示完整原文
      if (level === 0 || showAnswer) {
        return this.wrapCharacters(orig, false, null);
      }

      var len = orig.length;
      var blankMask = []; // 对应 orig 每个字符是否挖空 (true 为挖空)
      for (var k = 0; k < len; k++) {
        blankMask.push(false);
      }

      // 1. 优先处理用户标记的易忘词 (trickyWords)
      if (trickyMap) {
        for (var tWord in trickyMap) {
          if (Object.prototype.hasOwnProperty.call(trickyMap, tWord) && trickyMap[tWord]) {
            var tIdx = orig.indexOf(tWord);
            while (tIdx !== -1) {
              for (var tw = 0; tw < tWord.length; tw++) {
                if (!this.isPunctuation(orig.charAt(tIdx + tw))) {
                  blankMask[tIdx + tw] = true;
                }
              }
              tIdx = orig.indexOf(tWord, tIdx + 1);
            }
          }
        }
      }

      // 2. 依据等级计算字词挖空率
      if (level === 1) {
        // Level 1: 少量挖空 (15%~25%)，优先挖去 keywords 中的重点词
        var kwList = lineObj.keywords || [];
        for (var i = 0; i < kwList.length; i++) {
          var kw = kwList[i];
          var pos = orig.indexOf(kw);
          if (pos !== -1) {
            for (var p = 0; p < kw.length; p++) {
              if (!this.isPunctuation(orig.charAt(pos + p))) {
                blankMask[pos + p] = true;
              }
            }
          }
        }
        // 如果 keywords 较少，随机补充少量字词
        for (var j = 0; j < len; j++) {
          if (!this.isPunctuation(orig.charAt(j)) && !blankMask[j]) {
            if (this.pseudoRandom((randomSeed || 1) * (j + 1)) < 0.15) {
              blankMask[j] = true;
            }
          }
        }
      } else if (level === 2) {
        // Level 2: 中度挖空 (35%~45%)
        for (var c2 = 0; c2 < len; c2++) {
          if (!this.isPunctuation(orig.charAt(c2))) {
            if (blankMask[c2] || this.pseudoRandom((randomSeed || 2) * (c2 + 13)) < 0.40) {
              blankMask[c2] = true;
            }
          }
        }
      } else if (level === 3) {
        // Level 3: 大量挖空 (60%~70%)
        for (var c3 = 0; c3 < len; c3++) {
          if (!this.isPunctuation(orig.charAt(c3))) {
            if (blankMask[c3] || this.pseudoRandom((randomSeed || 3) * (c3 + 29)) < 0.65) {
              blankMask[c3] = true;
            }
          }
        }
      } else if (level === 4) {
        // Level 4: 骨架级极限背诵 (85%~90%)
        // 规则：保留每个分句首字和标点，其余全部挖空！
        var isNewClause = true;
        for (var c4 = 0; c4 < len; c4++) {
          var char4 = orig.charAt(c4);
          if (this.isPunctuation(char4)) {
            blankMask[c4] = false;
            isNewClause = true;
          } else {
            if (isNewClause) {
              // 句首第一个汉字保留
              blankMask[c4] = false;
              isNewClause = false;
            } else {
              blankMask[c4] = true;
            }
          }
        }
      } else if (level === 5) {
        // Level 5: 完全依赖 Emoji 与脑力，文字全部挖空（仅保留标点）
        for (var c5 = 0; c5 < len; c5++) {
          if (!this.isPunctuation(orig.charAt(c5))) {
            blankMask[c5] = true;
          }
        }
      }

      // 3. 将连续的挖空字符合并为可点击探视的 slot
      return this.buildHtmlFromMask(orig, blankMask);
    },

    /**
     * 将字符序列与掩码编译为 HTML
     */
    buildHtmlFromMask: function(orig, mask) {
      var html = '';
      var inBlank = false;
      var currentBlank = '';

      for (var i = 0; i < orig.length; i++) {
        var ch = orig.charAt(i);
        if (mask[i]) {
          inBlank = true;
          currentBlank += ch;
        } else {
          if (inBlank) {
            html += this.renderBlankSlot(currentBlank);
            inBlank = false;
            currentBlank = '';
          }
          html += '<span class="char-visible">' + ch + '</span>';
        }
      }

      if (inBlank) {
        html += this.renderBlankSlot(currentBlank);
      }

      return html;
    },

    renderBlankSlot: function(hiddenWord) {
      // 占位长度
      var underscores = '';
      for (var i = 0; i < hiddenWord.length; i++) {
        underscores += '＿';
      }
      return '<span class="blank-slot" data-answer="' + hiddenWord + '" onclick="window.LadderEngine.toggleSlot(this);">' +
               '<span class="blank-mask">' + underscores + '</span>' +
               '<span class="blank-word" style="display:none;">' + hiddenWord + '</span>' +
             '</span>';
    },

    // 点击单个挖空探看答案
    toggleSlot: function(el) {
      var mask = el.querySelector('.blank-mask');
      var word = el.querySelector('.blank-word');
      if (!mask || !word) return;

      if (word.style.display === 'none') {
        mask.style.display = 'none';
        word.style.display = 'inline';
        el.className = 'blank-slot revealed';
      } else {
        mask.style.display = 'inline';
        word.style.display = 'none';
        el.className = 'blank-slot';
      }
    },

    wrapCharacters: function(str, isAnswer, trickyMap) {
      var html = '';
      for (var i = 0; i < str.length; i++) {
        var ch = str.charAt(i);
        html += '<span class="char-visible' + (isAnswer ? ' char-peek' : '') + '">' + ch + '</span>';
      }
      return html;
    }
  };

  window.LadderEngine = LadderEngine;

})(typeof window !== 'undefined' ? window : this);
