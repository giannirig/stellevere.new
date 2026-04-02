(function () {
  function getScriptBase(script) {
    try {
      return new URL(script.src, window.location.href).origin;
    } catch (_) {
      return '';
    }
  }

  function createWidget(script) {
    var slug = (script.dataset.artigiano || script.dataset.slug || '').trim();
    if (!slug) return;

    var baseUrl = (script.dataset.baseUrl || getScriptBase(script) || '').replace(/\/+$/, '');
    if (!baseUrl) return;

    var limit = Math.min(Math.max(parseInt(script.dataset.limit || '6', 10) || 6, 1), 12);
    var iframe = document.createElement('iframe');
    iframe.src = baseUrl + '/embed/' + encodeURIComponent(slug) + '?limit=' + limit;
    iframe.loading = 'lazy';
    iframe.title = 'Lavori pubblicati su StelleVere';
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.minHeight = script.dataset.minHeight || '560px';
    iframe.style.borderRadius = script.dataset.radius || '24px';
    iframe.style.background = '#fff';

    var mount = null;
    if (script.dataset.target) {
      mount = document.querySelector(script.dataset.target);
    }
    if (!mount) {
      mount = document.createElement('div');
      script.parentNode.insertBefore(mount, script.nextSibling);
    }

    mount.innerHTML = '';
    mount.appendChild(iframe);

    function onMessage(event) {
      if (!event.data || event.data.source !== 'stellevere-widget') return;
      if (event.source !== iframe.contentWindow) return;
      if (event.data.height) {
        iframe.style.height = Math.max(420, Number(event.data.height) || 0) + 'px';
      }
    }

    window.addEventListener('message', onMessage);
  }

  var current = document.currentScript;
  if (current) {
    createWidget(current);
    return;
  }

  var scripts = document.querySelectorAll('script[data-artigiano],script[data-slug]');
  Array.prototype.forEach.call(scripts, createWidget);
})();
