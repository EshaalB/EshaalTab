/* ai-autosend.js — EshaalTab Content Script
   Auto-submits search queries on ChatGPT, Claude, and Gemini when opened from EshaalTab.
   Runs safely, locally, and with 100% user privacy. */
(async function () {
  'use strict';

  /* The manifest limits this packaged script to three named AI sites. It does
     nothing unless the user has enabled auto-send in EshaalTab Settings. */
  try {
    const api = (typeof browser !== 'undefined' && browser.storage) ? browser : chrome;
    const bag = await api.storage.local.get('settings');
    if (!bag?.settings?.aiAutoSend) return;
  } catch { return; }

  const params = new URLSearchParams(window.location.search);
  const query = (params.get('q') || params.get('prompt') || '').trim();
  if (!query) return;

  const sessionKey = 'et_sent_' + btoa(encodeURIComponent(query)).slice(0, 32);
  if (sessionStorage.getItem(sessionKey)) return;

  const hostname = window.location.hostname.toLowerCase();
  let attempts = 0;
  const maxAttempts = 40; // 40 * 250ms = 10 seconds max

  function cleanupUrl() {
    try {
      sessionStorage.setItem(sessionKey, '1');
      const url = new URL(window.location.href);
      url.searchParams.delete('q');
      url.searchParams.delete('prompt');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch (e) {}
  }

  function setInputValue(input, val) {
    if (!input) return;
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      if (input.value !== val) {
        input.value = val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (input.isContentEditable) {
      if ((input.textContent || '').trim() !== val) {
        input.focus();
        try {
          document.execCommand('insertText', false, val);
        } catch (e) {}
        if ((input.textContent || '').trim() !== val) {
          input.textContent = val;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  function dispatchEnter(input) {
    if (!input) return;
    try {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    } catch (e) {}
  }

  function trySubmitChatGPT() {
    const input = document.querySelector('#prompt-textarea') || 
                  document.querySelector('textarea[data-id="root"]') ||
                  document.querySelector('div[contenteditable="true"]#prompt-textarea');
    const sendBtn = document.querySelector('button[data-testid="send-button"]') ||
                    document.querySelector('button[aria-label*="Send prompt"]') ||
                    document.querySelector('button[aria-label*="Send message"]') ||
                    document.querySelector('button[aria-label*="Send"]') ||
                    document.querySelector('button[data-testid*="send"]');

    if (input) setInputValue(input, query);

    if (sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
      sendBtn.click();
      dispatchEnter(input);
      cleanupUrl();
      return true;
    }
    return false;
  }

  function trySubmitClaude() {
    const input = document.querySelector('div[contenteditable="true"]') ||
                  document.querySelector('textarea');
    const sendBtn = document.querySelector('button[aria-label*="Send Message"]') ||
                    document.querySelector('button[aria-label*="Send message"]') ||
                    document.querySelector('button[aria-label*="Send"]') ||
                    document.querySelector('fieldset button[type="button"]');

    if (input) setInputValue(input, query);

    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      dispatchEnter(input);
      cleanupUrl();
      return true;
    }
    return false;
  }

  function trySubmitGemini() {
    const input = document.querySelector('div[contenteditable="true"]') ||
                  document.querySelector('.qs-input') ||
                  document.querySelector('textarea');
    const sendBtn = document.querySelector('button.send-button') ||
                    document.querySelector('button[aria-label*="Send"]') ||
                    document.querySelector('button[aria-label*="Submit"]');

    if (input) setInputValue(input, query);

    if (sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
      sendBtn.click();
      dispatchEnter(input);
      cleanupUrl();
      return true;
    }
    return false;
  }

  function tick() {
    attempts++;
    let success = false;
    if (hostname.includes('chatgpt.com')) {
      success = trySubmitChatGPT();
    } else if (hostname.includes('claude.ai')) {
      success = trySubmitClaude();
    } else if (hostname.includes('gemini.google.com')) {
      success = trySubmitGemini();
    }

    if (success || attempts >= 100) {
      if (timer) clearInterval(timer);
      if (observer) observer.disconnect();
    }
  }

  const timer = setInterval(tick, 100);
  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(tick);
    const startObserver = () => {
      if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) startObserver();
    else document.addEventListener('DOMContentLoaded', startObserver);
  }
  tick();
})();
