// debug.js — filet de sécurité : affiche toute erreur JS à l'écran.
// À charger EN PREMIER dans index.html. Ne dépend de rien.
(function () {
  function show(msg) {
    var box = document.getElementById('debug-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'debug-box';
      box.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;' +
        'background:#b00020;color:#fff;font:12px/1.5 monospace;padding:8px 12px;' +
        'max-height:40vh;overflow:auto;white-space:pre-wrap;';
      var close = document.createElement('button');
      close.textContent = '✕ fermer';
      close.style.cssText = 'float:right;background:#fff;color:#b00020;border:0;' +
        'padding:2px 8px;border-radius:4px;cursor:pointer;';
      close.onclick = function () { box.remove(); };
      box.appendChild(close);
      (document.body || document.documentElement).appendChild(box);
    }
    var line = document.createElement('div');
    line.textContent = msg;
    box.appendChild(line);
  }
  window.addEventListener('error', function (e) {
    show('ERREUR : ' + e.message + '\n→ ' + (e.filename || '?') + ' ligne ' + (e.lineno || '?'));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason || {};
    show('ERREUR (promesse) : ' + (r.message || JSON.stringify(r)));
  });
  window.debugShow = show; // utilisable partout : debugShow('mon message')
})();
