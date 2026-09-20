/**
 * Pomodoro: 基于绝对时间戳的高可靠老设备容错番茄钟
 * 严格使用 ES5 规范
 */
(function(window) {
  'use strict';

  var Pomodoro = {
    timerId: null,
    mode: 'work', // 'work' | 'shortBreak' | 'longBreak' | 'custom'
    isRunning: false,
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    startTimestamp: 0,
    targetTimestamp: 0,
    audioCtx: null,

    init: function() {
      var self = this;
      // 恢复设置
      var settings = window.SafeStorage ? window.SafeStorage.getItem('pomodoro_settings') : null;
      if (settings && settings.workMinutes) {
        this.totalSeconds = settings.workMinutes * 60;
        this.remainingSeconds = this.totalSeconds;
      }

      // 恢复运行态
      var state = window.SafeStorage ? window.SafeStorage.getItem('pomodoro_state') : null;
      if (state && state.isRunning && state.targetTimestamp) {
        var now = new Date().getTime();
        if (now < state.targetTimestamp) {
          this.mode = state.mode || 'work';
          this.totalSeconds = state.totalSeconds || (25 * 60);
          this.targetTimestamp = state.targetTimestamp;
          this.startTimestamp = state.startTimestamp;
          this.remainingSeconds = Math.max(0, Math.ceil((state.targetTimestamp - now) / 1000));
          this.isRunning = true;
          this.startTicker();
        } else {
          // 已在后台倒计时完毕
          this.reset(state.mode || 'work');
        }
      }

      // 监听屏幕解锁、标签页切换、返回前台
      var syncHandler = function() {
        self.recalibrate();
      };
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('focus', syncHandler, false);
        window.addEventListener('pageshow', syncHandler, false);
        if ('hidden' in document) {
          document.addEventListener('visibilitychange', syncHandler, false);
        } else if ('webkitHidden' in document) {
          document.addEventListener('webkitvisibilitychange', syncHandler, false);
        }
      }

      this.render();
    },

    // 重新校准剩余时间（对抗 iOS 9 后台暂停）
    recalibrate: function() {
      if (!this.isRunning || !this.targetTimestamp) {
        this.render();
        return;
      }
      var now = new Date().getTime();
      var left = Math.ceil((this.targetTimestamp - now) / 1000);
      if (left <= 0) {
        this.remainingSeconds = 0;
        this.complete();
      } else {
        this.remainingSeconds = left;
        this.render();
      }
    },

    start: function() {
      if (this.isRunning) return;

      var now = new Date().getTime();
      this.startTimestamp = now;
      this.targetTimestamp = now + (this.remainingSeconds * 1000);
      this.isRunning = true;

      this.saveState();
      this.startTicker();
      this.render();
    },

    pause: function() {
      if (!this.isRunning) return;
      this.recalibrate();
      this.isRunning = false;
      this.targetTimestamp = 0;
      this.startTimestamp = 0;

      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      this.saveState();
      this.render();
    },

    reset: function(newMode) {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      if (newMode) {
        this.mode = newMode;
      }
      var settings = window.SafeStorage ? window.SafeStorage.getItem('pomodoro_settings') : null;
      var workM = (settings && settings.workMinutes) ? settings.workMinutes : 25;
      var shortM = (settings && settings.shortBreakMinutes) ? settings.shortBreakMinutes : 5;
      var longM = (settings && settings.longBreakMinutes) ? settings.longBreakMinutes : 10;

      if (this.mode === 'work') {
        this.totalSeconds = workM * 60;
      } else if (this.mode === 'shortBreak') {
        this.totalSeconds = shortM * 60;
      } else if (this.mode === 'longBreak') {
        this.totalSeconds = longM * 60;
      }

      this.remainingSeconds = this.totalSeconds;
      this.isRunning = false;
      this.startTimestamp = 0;
      this.targetTimestamp = 0;

      this.saveState();
      this.render();
    },

    startTicker: function() {
      var self = this;
      if (this.timerId) clearInterval(this.timerId);
      this.timerId = setInterval(function() {
        self.tick();
      }, 1000);
    },

    tick: function() {
      if (!this.isRunning) return;
      var now = new Date().getTime();
      var left = Math.ceil((this.targetTimestamp - now) / 1000);

      if (left <= 0) {
        this.remainingSeconds = 0;
        this.complete();
      } else {
        this.remainingSeconds = left;
        this.render();
      }
    },

    complete: function() {
      this.isRunning = false;
      this.targetTimestamp = 0;
      this.startTimestamp = 0;
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      this.saveState();
      this.render();

      this.playAlertSound();

      var msg = (this.mode === 'work') ? '🎉 本轮背诵学习完成！休息一下吧。' : '⏰ 休息结束，准备开始下一轮背诵！';
      setTimeout(function() {
        if (typeof alert === 'function') {
          alert(msg);
        }
      }, 100);
    },

    playAlertSound: function() {
      try {
        var AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          if (!this.audioCtx) {
            this.audioCtx = new AudioCtxClass();
          }
          var ctx = this.audioCtx;
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
          osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
        }
      } catch (e) {
        // AudioContext 不可用或被策略限制，优雅降级
      }
    },

    saveState: function() {
      if (window.SafeStorage) {
        window.SafeStorage.setItem('pomodoro_state', {
          isRunning: this.isRunning,
          mode: this.mode,
          totalSeconds: this.totalSeconds,
          startTimestamp: this.startTimestamp,
          targetTimestamp: this.targetTimestamp
        });
      }
    },

    formatTime: function(seconds) {
      var m = Math.floor(seconds / 60);
      var s = seconds % 60;
      var mStr = (m < 10 ? '0' : '') + m;
      var sStr = (s < 10 ? '0' : '') + s;
      return mStr + ':' + sStr;
    },

    render: function() {
      var timeStr = this.formatTime(this.remainingSeconds);
      var topEl = document.getElementById('header-pomo-display');
      if (topEl) {
        var icon = this.isRunning ? '⏳ ' : '🍅 ';
        topEl.innerHTML = icon + timeStr;
      }
      var modalTimeEl = document.getElementById('pomo-modal-time');
      if (modalTimeEl) {
        modalTimeEl.innerHTML = timeStr;
      }
      var toggleBtn = document.getElementById('pomo-toggle-btn');
      if (toggleBtn) {
        toggleBtn.innerHTML = this.isRunning ? '暂停' : '开始';
      }
    }
  };

  window.Pomodoro = Pomodoro;

})(typeof window !== 'undefined' ? window : this);
