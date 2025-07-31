// ==UserScript==
// @name         云效塞满Emoji😂
// @namespace    com.ui-ceiling.yoho.title-emoji
// @version      1.0.0
// @description  云效创建/编辑  需求/任务时 标题允许输入Emoji
// @author       UI-ceiling
// @match        https://devops.aliyun.com/*
// @icon         https://www.emojiall.com/images/60/microsoft-teams/1f923.png
// ==/UserScript==

(() => {
  'use strict';

  const NEW_INPUT_ID = 'emojiOverrideInput';
  const ORIG_INPUT_ID = 'workitemTitleInputBox';
  const URL_HOOK_DELAY = 1000;

  /** 监听 URL 路由变化 */
  const onUrlChange = (callback) => {
    let lastUrl = location.href;
    const wrap = (method) => {
      const origin = history[method];
      history[method] = function (...args) {
        const result = origin.apply(this, args);
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          callback(location.href);
        }
        return result;
      };
    };
    ['pushState', 'replaceState'].forEach(wrap);
    window.addEventListener('popstate', () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        callback(location.href);
      }
    });
  };

  /** 等待原输入框出现 */
  const waitForOriginalInput = () =>
    new Promise((resolve) => {
      const check = () => document.getElementById(ORIG_INPUT_ID);
      const input = check();
      if (input) return resolve(input);
      const observer = new MutationObserver(() => {
        const input = check();
        if (input) {
          observer.disconnect();
          resolve(input);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });

  /** 模拟 React 内部输入变更 */
  const simulateReactInput = (input, value) => {
    if (input.value === value) return;
    input.value = '1';
    input._valueTracker?.setValue(value);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  /** 注入 emoji 输入框 */
  const injectNewInput = (origInput) => {
    if (!origInput || document.getElementById(NEW_INPUT_ID)) return;

    const container = document.createElement('div');
    container.style.position = 'relative';

    const newInput = document.createElement('textarea');
    Object.assign(newInput, {
      id: NEW_INPUT_ID,
      value: origInput.value,
      placeholder: '这里输入内容会覆盖 PATCH 请求的 propertyValue',
      className: origInput.className,
    });
    newInput.style.cssText = origInput.style.cssText;

    // 美化 emoji 图标
    const emoji = document.createElement('span');
    emoji.textContent = '✨';
    emoji.className = 'emoji-decorator';
    Object.assign(emoji.style, {
      position: 'absolute',
      right: '8px',
      top: '50%',
      transform: 'translateY(-50%)',
      fontSize: '18px',
      pointerEvents: 'none',
      userSelect: 'none',
      animation: 'emoji-pop 0.5s ease-out',
    });

    // 动画样式（只注入一次）
    if (!document.getElementById('emoji-style')) {
      const style = document.createElement('style');
      style.id = 'emoji-style';
      style.textContent = `
        @keyframes emoji-pop {
          0% { transform: translateY(-50%) scale(0.6); opacity: 0; }
          40% { transform: translateY(-50%) scale(2); opacity: 1; }
          100% { transform: translateY(-50%) scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    // padding 防遮挡
    const padRight = parseFloat(getComputedStyle(newInput).paddingRight) || 0;
    if (padRight < 28) newInput.style.paddingRight = '28px';

    newInput.addEventListener('blur', () => {
      const val = newInput.value.trim();
      if (val) {
        simulateReactInput(origInput, val);
        origInput.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    });

    container.append(newInput, emoji);
    origInput.style.display = 'none';
    origInput.parentElement?.appendChild(container);
  };

  /** 显示提示 */
  const showToast = (message, duration = 3000) => {
    document.getElementById('emoji-toast')?.remove();

    const toast = document.createElement('div');
    Object.assign(toast, {
      id: 'emoji-toast',
      textContent: message,
    });
    Object.assign(toast.style, {
      position: 'fixed',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: '#fff',
      padding: '10px 20px',
      borderRadius: '20px',
      fontSize: '34px',
      zIndex: 9999,
      opacity: '0',
      transition: 'opacity 0.5s ease',
      pointerEvents: 'none',
      userSelect: 'none',
    });

    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = '1'));
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
  };

  /** 初始化入口 */
  const initInject = async () => {
    try {
      const origInput = await waitForOriginalInput();
      injectNewInput(origInput);
    } catch (err) {
      console.warn('[Tampermonkey] emoji input 注入失败:', err);
    }
  };

  // 首次加载
  setTimeout(initInject, URL_HOOK_DELAY);

  // 路由变化监听
  let injectTimer = null;
  onUrlChange(() => {
    clearTimeout(injectTimer);
    injectTimer = setTimeout(initInject, URL_HOOK_DELAY);
  });

  /** 覆盖 PATCH 请求的值 */
  const rawOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    [this._method, this._url] = args;
    return rawOpen.apply(this, args);
  };

  const rawSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    try {
      const method = this._method?.toUpperCase();
      if (
        (method === 'PATCH' || method === 'POST') &&
        this._url?.includes('projex/api/workitem/workitem')
      ) {
        const parsed = JSON.parse(body);
        const override = document.getElementById(NEW_INPUT_ID)?.value?.trim();
        if (override && typeof parsed?.propertyValue !== 'undefined') {
          console.log('[Tampermonkey] 已覆盖 propertyValue:', override);
          parsed.propertyValue = override;
          body = JSON.stringify(parsed);
        }
      }
    } catch (e) {
      // 非 JSON 请求忽略
    }
    return rawSend.call(this, body);
  };
})();
