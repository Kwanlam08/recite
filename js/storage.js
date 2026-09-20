/**
 * SafeStorage: 兼容 iOS 9 Safari（含无痕模式）的本地持久化封装
 * 严格使用 ES5 规范
 */
(function(window) {
  'use strict';

  var DATA_VERSION = 1;
  var PREFIX = 'recite_';
  var memoryFallback = {};

  var SafeStorage = {
    isAvailable: function() {
      try {
        var testKey = '__storage_test__';
        window.localStorage.setItem(testKey, testKey);
        window.localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        return false;
      }
    },

    getItem: function(key) {
      var fullKey = PREFIX + key;
      try {
        if (this.isAvailable()) {
          var val = window.localStorage.getItem(fullKey);
          return val ? JSON.parse(val) : null;
        }
      } catch (e) {
        // fallback
      }
      return memoryFallback[fullKey] ? JSON.parse(memoryFallback[fullKey]) : null;
    },

    setItem: function(key, value) {
      var fullKey = PREFIX + key;
      var str = JSON.stringify(value);
      try {
        if (this.isAvailable()) {
          window.localStorage.setItem(fullKey, str);
          return true;
        }
      } catch (e) {
        // iOS 无痕模式抛出 QuotaExceededError
      }
      memoryFallback[fullKey] = str;
      return true;
    },

    removeItem: function(key) {
      var fullKey = PREFIX + key;
      try {
        if (this.isAvailable()) {
          window.localStorage.removeItem(fullKey);
        }
      } catch (e) {}
      delete memoryFallback[fullKey];
    },

    // 初始化默认数据与版本迁移
    init: function() {
      var currentVersion = this.getItem('version');
      if (!currentVersion) {
        this.setItem('version', DATA_VERSION);
      }
      // 初始化存储对象
      if (!this.getItem('progress')) {
        this.setItem('progress', {});
      }
      if (!this.getItem('wrong_questions')) {
        this.setItem('wrong_questions', {});
      }
      if (!this.getItem('history')) {
        this.setItem('history', []);
      }
      if (!this.getItem('pomodoro_settings')) {
        this.setItem('pomodoro_settings', {
          workMinutes: 25,
          shortBreakMinutes: 5,
          longBreakMinutes: 10,
          soundEnabled: true
        });
      }
      if (!this.getItem('user_settings')) {
        this.setItem('user_settings', {
          fontSize: 'medium',
          showTranslation: true
        });
      }
    },

    // 获取特定篇目背诵进度
    getTextProgress: function(textId) {
      var progressMap = this.getItem('progress') || {};
      return progressMap[textId] || {
        level: 0,
        status: 'unlearned', // 'unlearned' | 'learning' | 'mastered'
        trickyWords: {},
        currentParagraph: 0,
        lastStudied: 0
      };
    },

    // 保存特定篇目背诵进度
    saveTextProgress: function(textId, data) {
      var progressMap = this.getItem('progress') || {};
      progressMap[textId] = data;
      this.setItem('progress', progressMap);
    },

    // 切换标记易忘词
    toggleTrickyWord: function(textId, word) {
      var p = this.getTextProgress(textId);
      if (!p.trickyWords) p.trickyWords = {};
      if (p.trickyWords[word]) {
        delete p.trickyWords[word];
      } else {
        p.trickyWords[word] = true;
      }
      this.saveTextProgress(textId, p);
      return !!p.trickyWords[word];
    },

    // 导出全量 JSON 备份
    exportData: function() {
      var data = {
        app: 'gaokao-recitation',
        version: DATA_VERSION,
        exportedAt: new Date().getTime(),
        progress: this.getItem('progress') || {},
        wrong_questions: this.getItem('wrong_questions') || {},
        history: this.getItem('history') || [],
        pomodoro_settings: this.getItem('pomodoro_settings') || {},
        user_settings: this.getItem('user_settings') || {}
      };
      return JSON.stringify(data, null, 2);
    },

    // 导入 JSON 备份
    importData: function(jsonString) {
      try {
        var data = JSON.parse(jsonString);
        if (!data || typeof data !== 'object') {
          return { success: false, message: '数据格式无效' };
        }
        if (data.progress) {
          this.setItem('progress', data.progress);
        }
        if (data.wrong_questions) {
          this.setItem('wrong_questions', data.wrong_questions);
        }
        if (data.history) {
          this.setItem('history', data.history);
        }
        if (data.pomodoro_settings) {
          this.setItem('pomodoro_settings', data.pomodoro_settings);
        }
        if (data.user_settings) {
          this.setItem('user_settings', data.user_settings);
        }
        this.setItem('version', data.version || DATA_VERSION);
        return { success: true };
      } catch (err) {
        return { success: false, message: 'JSON解析失败：' + err.message };
      }
    },

    // 清空重置所有数据
    clearAll: function() {
      this.removeItem('progress');
      this.removeItem('wrong_questions');
      this.removeItem('history');
      this.removeItem('pomodoro_settings');
      this.removeItem('pomodoro_state');
      this.removeItem('user_settings');
      this.init();
    }
  };

  SafeStorage.init();
  window.SafeStorage = SafeStorage;

})(typeof window !== 'undefined' ? window : this);
