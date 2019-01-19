/* global config */
'use strict';

var article;
var isFirefox = /Firefox/.test(navigator.userAgent);

var iframe = document.querySelector('iframe');
document.body.dataset.mode = localStorage.getItem('mode');
var settings = document.querySelector('#toolbar>div');

const shortcuts = [];

/* fullscreen */
{
  const span = document.createElement('span');
  span.title = 'Switch to the fullscreen reading (F9)';
  span.classList.add('icon-fullscreen');
  if (localStorage.getItem('fullscreen-button') === 'false') {
    span.style.display = 'none';
  }
  span.onclick = () => {
    if (iframe.requestFullscreen) {
      iframe.requestFullscreen();
    }
    else if (iframe.mozRequestFullScreen) {
      iframe.mozRequestFullScreen();
    }
    else if (iframe.webkitRequestFullScreen) {
      iframe.webkitRequestFullScreen();
    }
    else if (iframe.msRequestFullscreen) {
      iframe.msRequestFullscreen();
    }
  };
  shortcuts.push({
    condition: e => e.code === 'F9',
    action: span.onclick
  });
  document.getElementById('toolbar').appendChild(span);
}

var styles = {
  top: document.createElement('style'),
  iframe: document.createElement('style')
};
styles.top.textContent = localStorage.getItem('top-css') || '';
styles.iframe.textContent = localStorage.getItem('user-css') || '';
document.documentElement.appendChild(styles.top);

document.addEventListener('click', e => {
  const bol = e.target.dataset.cmd === 'open-settings' || Boolean(e.target.closest('#toolbar>div'));
  settings.dataset.display = bol;
});

function getFont(font) {
  switch (font) {
  case 'serif':
    return 'Georgia, "Times New Roman", serif';
  case 'sans-serif':
  default:
    return 'Helvetica, Arial, sans-serif';
  }
}

var update = {
  sync: () => {
    const mode = localStorage.getItem('mode') || 'sepia';
    document.body.dataset.mode = iframe.contentDocument.body.dataset.mode = mode;
  },
  async: () => {
    iframe.contentDocument.body.style['font-size'] = config.prefs['font-size'] + 'px';
    iframe.contentDocument.body.style['font-family'] = getFont(config.prefs['font']);
    if (config.prefs['line-height']) {
      iframe.contentDocument.body.style['line-height'] = config.prefs['line-height'] + 'px';
      document.querySelector('[data-id=no-height] input').checked = false;
    }
    else {
      iframe.contentDocument.body.style['line-height'] = 'unset';
      document.querySelector('[data-id=no-height] input').checked = true;
    }
    if (config.prefs.width) {
      iframe.contentDocument.body.style.width = config.prefs.width + 'px';
      document.querySelector('[data-id=full-width] input').checked = false;
    }
    else {
      iframe.contentDocument.body.style.width = 'calc(100vw - 50px)';
      document.querySelector('[data-id=full-width] input').checked = true;
    }

    iframe.contentDocument.body.dataset.font = config.prefs.font;
    iframe.contentWindow.focus();
  }
};

chrome.storage.onChanged.addListener(update.async);

chrome.runtime.onMessage.addListener(request => {
  if (request.cmd === 'close') {
    history.go(isFirefox ? -2 : -1);
  }
  else if (request.cmd === 'update-styling') {
    styles.top.textContent = localStorage.getItem('top-css') || '';
    styles.iframe.textContent = localStorage.getItem('user-css') || '';
  }
});

chrome.runtime.sendMessage({
  cmd: 'read-data'
}, obj => {
  article = obj;
  if (!article) { // open this page from history for instance
    if (history.length) {
      history.back();
    }
    else {
      window.alert('Sorry the original content is not accessible anymore. Please load the origin content and retry');
    }
  }
  iframe.contentDocument.open();
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
  <style>
  body {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    margin: 30px auto 0 auto;
  }
  body[data-mode="light"] {
    color: #222222;
    background-color: whitesmoke;
  }
  body[data-mode="dark"] {
    color: #eeeeee;
    background-color: #333333;
  }
  body[data-mode="sepia"] {
    color: #5b4636;
    background-color: #f4ecd8;
  }
  body[data-loaded=true] {
    transition: color 0.4s, background-color 0.4s;
  }
  #reader-domain {
    font-size: 0.9em;
    line-height: 1.0em;
    padding-bottom: 2px;
    font-family: Helvetica, Arial, sans-serif;
    text-decoration: none;
    border-bottom-color: currentcolor;
    color: #0095dd;
  }
  #reader-title {
    font-size: 1.6em;
    line-height: 1.25em;
    width: 100%;
    margin: 5px 0;
    padding: 0;
  }
  #reader-credits {
    font-size: 0.9em;
    line-height: 1.48em;
    margin: 0 0 5px 0;
    padding: 0;
    font-style: italic;
  }
  #reader-estimated-time {
    font-size: 0.85em;
    line-height: 1.48em;
    margin: 0 0 5px 0;
    padding: 0;
  }
  #reader-credits:empty {
    disply: none;
  }
  #left {
    column-count: 3;
    float: left;
    width: 100%;
    height: 80vh;
    overflow: scroll;
  }

  </style>
</head>
<body>
  <a id="reader-domain" href="${article.url}">${(new URL(article.url)).hostname}</a>
  <h1 dir="auto" id="reader-title">${article.title || 'Unknown Title'}</h1>
  <div dir="auto" id="reader-credits">${article.byline || ''}</div>
  <div dir="auto" id="reader-estimated-time">${article.readingTimeMinsFast}-${article.readingTimeMinsSlow} minutes</div>
  <hr/>
  <div id="left">
    ${article.content}
  </div>
</body>
</html>`;
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  update.sync();

  // automatically detect ltr and rtl
  [...iframe.contentDocument.querySelectorAll('article>*')]
    .forEach(e => e.setAttribute('dir', 'auto'));

  document.title = article.title + ' :: Reader View';
  // link handling
  iframe.contentDocument.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (a && a.href && a.href.startsWith('http')) {
      e.preventDefault();
      chrome.runtime.sendMessage({
        cmd: 'open',
        url: a.href,
        reader: config.prefs['reader-mode'],
        current: config.prefs['new-tab'] === false
      });
    }
  });

  document.head.appendChild(Object.assign(
    document.querySelector(`link[rel*='icon']`) || document.createElement('link'), {
      type: 'image/x-icon',
      rel: 'shortcut icon',
      href: 'chrome://favicon/' + article.url
    }
  ));
  iframe.contentDocument.getElementById('reader-domain').onclick = () => {
    history.back();
    return false;
  };

  iframe.contentWindow.addEventListener('click', () => {
    settings.dataset.display = false;
  });

  iframe.contentDocument.documentElement.appendChild(styles.iframe);
  iframe.addEventListener('load', () => {
    // apply transition after initial changes
    document.body.dataset.loaded = iframe.contentDocument.body.dataset.loaded = true;
    if (isFirefox) {
      const script = iframe.contentDocument.documentElement.appendChild(document.createElement('script'));
      script.src = chrome.runtime.getURL('/data/reader/scroll.js');
    }
  });
  // close on escape
  {
    const callback = e => {
      if (e.key === 'Escape' && !(
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement)
      ) {
        history.go(isFirefox ? -2 : -1);
      }
      shortcuts.forEach(o => {
        if (o.condition(e)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          o.action();
          return false;
        }
      });
    };
    iframe.contentDocument.addEventListener('keydown', callback);
    document.addEventListener('keydown', callback);
  }
  config.load(update.async);
});

document.addEventListener('click', e => {
  const target = e.target.closest('[data-cmd]');
  if (!target) {
    return;
  }
  const cmd = target.dataset.cmd;
  if (cmd.startsWith('font-type-')) {
    chrome.storage.local.set({
      'font': cmd.replace('font-type-', '')
    });
  }
  else if (cmd === 'font-decrease' || cmd === 'font-increase') {
    const size = config.prefs['font-size'];
    chrome.storage.local.set({
      'font-size': cmd === 'font-decrease' ? Math.max(9, size - 1) : Math.min(33, size + 1)
    });
  }
  else if (cmd === 'width-decrease' || cmd === 'width-increase') {
    if(iframe.contentDocument.getElementById("left").style.columnCount === "") {
      iframe.contentDocument.getElementById("left").style.columnCount = "3";
      console.log("tweaked");
    }
    var currColCount = parseInt(iframe.contentDocument.getElementById("left").style.columnCount);

    console.log("currColCount "+currColCount);

    if (cmd == 'width-decrease') {

      console.log("dec");
      currColCount++;
      iframe.contentDocument.getElementById("left").style.columnCount = currColCount.toString();
    }
    else {

      console.log("inc");
      currColCount--;
      iframe.contentDocument.getElementById("left").style.columnCount = currColCount.toString();
    }
  }
  else if (cmd === 'full-width') {
    chrome.storage.local.set({
      width: e.target.parentElement.querySelector('input').checked ? 600 : 0
    });
  }
  else if (cmd === 'line-height-type-1' || cmd === 'line-height-type-2') {
    chrome.storage.local.set({
      'line-height': cmd === 'line-height-type-1' ? 28.8 : 32
    });
  }
  else if (cmd === 'no-height') {
    chrome.storage.local.set({
      'line-height': e.target.parentElement.querySelector('input').checked ? 28.8 : 0
    });
  }
  else if (cmd.startsWith('color-mode-')) {
    localStorage.setItem('mode', cmd.replace('color-mode-', ''));
    update.sync();
  }
  else if (cmd === 'close') {
    // do this until the script is unloaded
    window.setTimeout(() => {
      e.target.dispatchEvent(new Event('click', {
        bubbles: true
      }));
    }, 200);
    history.go(-1);
  }
  else if (cmd === 'close-speech') {
    document.body.dataset.speech = false;
  }
}); 
