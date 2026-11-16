// Runs before the web app inside the Android app. Connects the page's "share", "download" and back button to Android.
(function () {
  var S = window.AndroidShell;
  if (!S) return;
  try { delete Navigator.prototype.serviceWorker; } catch (e) { /* the page then registers nothing */ }

  // Inside an Android app the stored scans are app data: Android does not clear them the way a browser may.
  if (navigator.storage) { navigator.storage.persisted = navigator.storage.persist = function () { return Promise.resolve(true); }; }

  // Bytes cross to Android as base64 text in pieces, so a large PDF never needs one huge string.
  async function send(blob, name) {
    var t = S.open(String(name || 'file'));
    var buf = new Uint8Array(await blob.arrayBuffer());
    var N = 3 * 65536;
    for (var i = 0; i < buf.length; i += N) {
      var c = buf.subarray(i, i + N), s = '';
      for (var j = 0; j < c.length; j += 8192) s += String.fromCharCode.apply(null, c.subarray(j, j + 8192));
      S.append(t, btoa(s));
    }
    S.close(t);
    return t;
  }

  navigator.canShare = function (d) { return !!(d && d.files && d.files.length); };
  navigator.share = async function (d) {
    if (!navigator.canShare(d)) throw new DOMException('Only files can be shared', 'NotSupportedError');
    var ts = [];
    for (var k = 0; k < d.files.length; k++) ts.push(await send(d.files[k], d.files[k].name));
    S.share(ts.join(','), d.files[0].type || 'application/octet-stream');
  };

  // A "download" in the page is a link to a blob: keep each blob so the link's click can hand it to Android.
  var blobs = new Map();
  var make = URL.createObjectURL, drop = URL.revokeObjectURL;
  URL.createObjectURL = function (o) { var u = make.call(URL, o); if (o instanceof Blob) blobs.set(u, o); return u; };
  URL.revokeObjectURL = function (u) { blobs.delete(u); return drop.call(URL, u); };
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var b = this.hasAttribute('download') ? blobs.get(this.href) : null;
    if (!b) return click.call(this);
    var name = this.getAttribute('download') || 'file';
    send(b, name).then(function (t) { S.save(t, b.type || 'application/octet-stream'); });
  };

  // Android's back button: close the top sheet or screen; false tells Android to leave the app.
  window.__shellBack = function () {
    var ds = document.querySelectorAll('dialog[open]'), d = ds[ds.length - 1];
    var b = (d || document).querySelector('button[aria-label^="Close"],button[aria-label^="Back"]');
    if (b) { b.click(); return true; }
    if (d) { if (d.dispatchEvent(new Event('cancel', { cancelable: true }))) d.close(); return true; }
    return false;
  };
})();
