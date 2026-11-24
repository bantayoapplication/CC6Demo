// ==================== BANTAYO: OPENSTREETMAP (LEAFLET) HELPERS ====================
// Free: no API key, no billing. Shared by index.html, landing.html and resident-view.html.
// Needs Leaflet (L) to be loaded first.

// ---------- Baguio-only limits ----------
// Outline of Baguio City as [lat, lng] corners, traced by eye from the OpenStreetMap city boundary.
// It is approximate. To make it snugger, add more corner points here (keep them in order around the city).
const BAGUIO_OUTLINE = [
  [16.4342, 120.5447],  // north-west
  [16.4281, 120.6305],  // north-east
  [16.3790, 120.6355],  // east
  [16.3606, 120.6322],  // south-east
  [16.3719, 120.5678]   // south-west
];

// The same outline pushed out ~3% so pins right on the border are not cut off
const BAGUIO_RING = (function () {
  const n = BAGUIO_OUTLINE.length;
  const c = BAGUIO_OUTLINE.reduce((acc, p) => [acc[0] + p[0] / n, acc[1] + p[1] / n], [0, 0]);
  return BAGUIO_OUTLINE.map(p => [c[0] + (p[0] - c[0]) * 1.03, c[1] + (p[1] - c[1]) * 1.03]);
})();

// Box around the outline (with a little margin). The map cannot be dragged outside it.
const BAGUIO_BOUNDS = (function () {
  const lats = BAGUIO_RING.map(p => p[0]), lngs = BAGUIO_RING.map(p => p[1]);
  const pad = 0.003;
  return {
    north: Math.max.apply(null, lats) + pad, south: Math.min.apply(null, lats) - pad,
    west: Math.min.apply(null, lngs) - pad, east: Math.max.apply(null, lngs) + pad
  };
})();
const BAGUIO_CENTER = { lat: 16.4023, lng: 120.5960 };

// True only for points inside the Baguio outline
function isInsideBaguio(lat, lng) {
  lat = Number(lat); lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  let inside = false;
  for (let i = 0, j = BAGUIO_RING.length - 1; i < BAGUIO_RING.length; j = i++) {
    const yi = BAGUIO_RING[i][0], xi = BAGUIO_RING[i][1];
    const yj = BAGUIO_RING[j][0], xj = BAGUIO_RING[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function escHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


// ---------- Map tiles ----------
// The main OpenStreetMap tile server (tile.openstreetmap.org) refuses requests that do not carry a
// website address (Referer), such as a page opened straight from a file, or an app WebView. It then
// shows "403 Access blocked" tiles. So we test it first, and if it refuses us we switch to CARTO's
// free tiles, which are drawn from the same OpenStreetMap data.
let _osmOk = null; // null = not tested yet, true/false = result of the test

function _cartoLayer() {
  return L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  });
}

function _osmLayer() {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    referrerPolicy: 'origin',
    attribution: '&copy; OpenStreetMap contributors'
  });
}

function _testOsmTiles() {
  if (_osmOk !== null) return Promise.resolve(_osmOk);
  if (!/^https?:$/.test(location.protocol)) { _osmOk = false; return Promise.resolve(false); }
  return fetch('https://tile.openstreetmap.org/0/0/0.png', { referrerPolicy: 'origin' })
    .then(r => { _osmOk = r.ok; return _osmOk; })
    .catch(() => { _osmOk = false; return false; });
}

function addBaseTiles(map) {
  // Show CARTO right away when OSM is already known to refuse us, otherwise start with OSM and verify
  if (_osmOk === false) { _cartoLayer().addTo(map); return; }
  const osm = _osmLayer().addTo(map);
  if (_osmOk === true) return;
  _testOsmTiles().then(ok => {
    if (!ok && map.hasLayer(osm)) {
      map.removeLayer(osm);
      _cartoLayer().addTo(map);
    }
  });
}

// Creates an OpenStreetMap that can only be moved around inside Baguio
function createBaguioMap(el, opts) {
  opts = opts || {};
  const c = opts.center || BAGUIO_CENTER;
  const map = L.map(el, {
    center: [Number(c.lat), Number(c.lng)],
    zoom: opts.zoom || 15,
    minZoom: opts.minZoom || 13,
    maxZoom: 19,
    maxBounds: [[BAGUIO_BOUNDS.south, BAGUIO_BOUNDS.west], [BAGUIO_BOUNDS.north, BAGUIO_BOUNDS.east]],
    maxBoundsViscosity: 1.0
  });
  addBaseTiles(map);

  // Hide everything that is not Baguio: a solid cover with a Baguio-shaped hole, plus a border line
  const dark = document.documentElement.classList.contains('dark');
  const cover = [
    [BAGUIO_BOUNDS.south - 3, BAGUIO_BOUNDS.west - 3], [BAGUIO_BOUNDS.south - 3, BAGUIO_BOUNDS.east + 3],
    [BAGUIO_BOUNDS.north + 3, BAGUIO_BOUNDS.east + 3], [BAGUIO_BOUNDS.north + 3, BAGUIO_BOUNDS.west - 3]
  ];
  map.getContainer().style.background = dark ? '#0f172a' : '#e2e8f0';
  L.polygon([cover, BAGUIO_RING], {
    stroke: false, fillColor: dark ? '#0f172a' : '#e2e8f0', fillOpacity: 1, interactive: false
  }).addTo(map);
  L.polygon(BAGUIO_RING, {
    color: '#2563eb', weight: 3, opacity: 0.9, fill: false, interactive: false
  }).addTo(map);
  setTimeout(() => map.invalidateSize(), 200);
  setTimeout(() => map.invalidateSize(), 500);
  return map;
}

// ---------- Directions (free OSRM routing on OpenStreetMap data) ----------
let _dir = null;

const _ROUTERS = {
  DRIVING: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
  WALKING: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/'
};

function closeDirections() {
  const m = document.getElementById('dir-modal');
  if (m) m.remove();
  document.removeEventListener('keydown', _dirEsc);
  if (_dir && _dir.map) { try { _dir.map.remove(); } catch (e) {} }
  _dir = null;
}
function _dirEsc(e) { if (e.key === 'Escape') closeDirections(); }

function _googleDirUrl(dest, origin, mode) {
  let url = 'https://www.google.com/maps/dir/?api=1&destination=' + dest.lat + ',' + dest.lng +
            '&travelmode=' + (mode === 'WALKING' ? 'walking' : 'driving');
  if (origin) url += '&origin=' + origin.lat + ',' + origin.lng;
  return url;
}

function _stepText(step) {
  const man = step.maneuver || {};
  const road = step.name ? ' onto ' + step.name : '';
  const dir = man.modifier ? man.modifier.replace('slight ', 'slight ') : '';
  switch (man.type) {
    case 'depart': return 'Start' + (step.name ? ' on ' + step.name : '');
    case 'arrive': return 'Arrive at the hazard location';
    case 'roundabout': case 'rotary': return 'Take the roundabout' + road;
    case 'continue': return 'Continue' + (step.name ? ' on ' + step.name : '');
    case 'new name': return 'Continue' + road;
    case 'merge': return 'Merge' + road;
    case 'fork': return 'Keep ' + (dir || 'straight') + road;
    case 'end of road': return 'At the end of the road, turn ' + (dir || '') + road;
    default: return (dir === 'straight' ? 'Go straight' : 'Turn ' + (dir || 'ahead')) + road;
  }
}

function _fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m'; }
function _fmtTime(s) {
  const min = Math.max(1, Math.round(s / 60));
  return min >= 60 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min' : min + ' min';
}

// Opens a window with the route to a geomapped photo / hazard
function openDirections(lat, lng, label, imageUrl) {
  lat = Number(lat); lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) { alert('This report has no map location yet.'); return; }

  closeDirections();
  _dir = { dest: { lat, lng }, origin: null, mode: 'DRIVING', map: null };

  const wrap = document.createElement('div');
  wrap.id = 'dir-modal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.65);display:flex;align-items:center;justify-content:center;padding:12px;';
  wrap.onclick = (e) => { if (e.target === wrap) closeDirections(); };

  wrap.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col text-slate-900 dark:text-slate-100" style="max-height:94vh;overflow:hidden;">
      <div class="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
        ${imageUrl ? `<img src="${escHtml(imageUrl)}" alt="Geomapped photo" class="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0" />` : ''}
        <div class="flex-1 min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Directions to geomapped photo</p>
          <p class="text-xs font-bold truncate">${escHtml(label || 'Hazard location')}</p>
          <p class="text-[10px] text-slate-500 dark:text-slate-400">${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E</p>
        </div>
        <button type="button" id="dir-close" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">✕</button>
      </div>

      <div id="dir-map" style="height:250px;flex-shrink:0;"></div>

      <div class="p-4 space-y-3 overflow-y-auto">
        <div class="flex gap-2">
          <button type="button" data-mode="DRIVING" class="dir-mode flex-1 text-[11px] font-bold py-2 rounded-xl border cursor-pointer">🚗 Drive</button>
          <button type="button" data-mode="WALKING" class="dir-mode flex-1 text-[11px] font-bold py-2 rounded-xl border cursor-pointer">🚶 Walk</button>
          <button type="button" id="dir-locate" class="flex-1 text-[11px] font-bold py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer">📍 My location</button>
        </div>
        <p id="dir-summary" class="text-[11px] text-slate-600 dark:text-slate-300">Getting your location…</p>
        <ol id="dir-steps" class="text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal pl-5"></ol>
        <a id="dir-external" target="_blank" rel="noopener" class="block text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-3 rounded-xl shadow cursor-pointer">Open in Google Maps app</a>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.addEventListener('keydown', _dirEsc);
  document.getElementById('dir-close').onclick = closeDirections;

  const summary = document.getElementById('dir-summary');
  const steps = document.getElementById('dir-steps');
  const external = document.getElementById('dir-external');

  const refreshButtons = () => {
    wrap.querySelectorAll('.dir-mode').forEach(b => {
      const on = b.dataset.mode === _dir.mode;
      b.style.background = on ? '#2563eb' : '';
      b.style.color = on ? '#fff' : '';
      b.style.borderColor = on ? '#2563eb' : '#cbd5e1';
    });
    external.href = _googleDirUrl(_dir.dest, _dir.origin, _dir.mode);
  };
  refreshButtons();

  const map = createBaguioMap(document.getElementById('dir-map'), { center: _dir.dest, zoom: 16, minZoom: 12 });
  _dir.map = map;
  L.marker([lat, lng]).addTo(map).bindPopup('Hazard location');
  let originMarker = null;
  let routeLine = null;

  const clearRoute = () => {
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    steps.innerHTML = '';
  };

  const drawRoute = async () => {
    if (!_dir || !_dir.origin) return;
    clearRoute();
    summary.textContent = 'Finding the route…';
    const o = _dir.origin, d = _dir.dest;
    const url = _ROUTERS[_dir.mode] + o.lng + ',' + o.lat + ';' + d.lng + ',' + d.lat +
                '?overview=full&geometries=geojson&steps=true';
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!_dir) return; // window was closed meanwhile
      if (data.code !== 'Ok' || !data.routes || !data.routes[0]) throw new Error(data.code || 'no route');
      const route = data.routes[0];
      const latlngs = route.geometry.coordinates.map(c => [c[1], c[0]]);
      routeLine = L.polyline(latlngs, { color: '#2563eb', weight: 5, opacity: 0.85 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
      summary.innerHTML = '<b>' + _fmtDist(route.distance) + '</b> · about <b>' + _fmtTime(route.duration) + '</b> (' + (_dir.mode === 'WALKING' ? 'walking' : 'driving') + ')';
      const legSteps = (route.legs && route.legs[0] && route.legs[0].steps) || [];
      steps.innerHTML = legSteps.map(s => '<li>' + escHtml(_stepText(s)) + ' <span style="opacity:.6">(' + _fmtDist(s.distance) + ')</span></li>').join('');
    } catch (err) {
      if (!_dir) return;
      summary.textContent = 'Could not draw the route right now (' + (err.message || 'network') + '). Tap "Open in Google Maps app" for directions.';
    }
  };

  const setOrigin = (lt, lg) => {
    if (!isInsideBaguio(lt, lg)) {
      summary.textContent = 'That starting point is outside Baguio. Tap the map to choose a starting point inside Baguio, or use "Open in Google Maps app".';
      return;
    }
    _dir.origin = { lat: lt, lng: lg };
    if (originMarker) map.removeLayer(originMarker);
    originMarker = L.marker([lt, lg], { opacity: 0.9 }).addTo(map).bindPopup('Start');
    refreshButtons();
    drawRoute();
  };

  const locate = () => {
    summary.textContent = 'Getting your location…';
    if (!window.isSecureContext || !navigator.geolocation) {
      summary.textContent = 'Your location is not available here. Tap the map to choose where you are starting from.';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (isInsideBaguio(p.coords.latitude, p.coords.longitude)) setOrigin(p.coords.latitude, p.coords.longitude);
        else summary.textContent = 'Your location is outside Baguio, so the in-app route cannot be drawn. Tap the map to choose a starting point inside Baguio, or use "Open in Google Maps app".';
      },
      () => { summary.textContent = 'Could not get your location. Tap the map to choose where you are starting from.'; },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  map.on('click', (e) => setOrigin(e.latlng.lat, e.latlng.lng));
  document.getElementById('dir-locate').onclick = locate;
  wrap.querySelectorAll('.dir-mode').forEach(b => {
    b.onclick = () => { _dir.mode = b.dataset.mode; refreshButtons(); drawRoute(); };
  });

  locate();
}