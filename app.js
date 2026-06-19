(function(){                                                                              
  var googleEarth = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {     
    maxZoom: 22, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: 'Map data ©Google Earth'                                                 
  });                                                                                   
  var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
  
  var map = L.map('map', { center: [15.3694, 44.1910], zoom: 14, layers: [googleEarth] });
  var baseMaps = { "خرائط قوقل إيرث (ساتلايت) 🌍": googleEarth, "خريطة الشوارع العادية (OSM) 🗺️": osm };
  L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);                                                                                                          
  
  var points = [];
  var nextId = 1;                                                                         
  var utmZone = null;
  var polyShape = null;                                                                                                                                                           
  var watchId = null;
  var lastTrackedLatLng = null;

  function toUTM(lat, lng) {
    var zone = Math.floor((lng + 180) / 6) + 1;
    var lon0 = (zone * 6) - 183;
    var latRad = lat * Math.PI / 180;
    var lonRad = (lng - lon0) * Math.PI / 180;
    var a = 6378137.0; var f = 1.0 / 298.257223563; var b = a * (1.0 - f);
    var e2 = (a*a - b*b) / (a*a); var ePrime2 = (a*a - b*b) / (b*b); var k0 = 0.9996;
    var N = a / Math.sqrt(1.0 - e2 * Math.sin(latRad) * Math.sin(latRad));
    var T = Math.tan(latRad) * Math.tan(latRad); var C = ePrime2 * Math.cos(latRad) * Math.cos(latRad); var A = Math.cos(latRad) * lonRad;
    var M = a * ((1.0 - e2 / 4.0 - 3.0 * e2 * e2 / 64.0 - 5.0 * e2 * e2 / 256.0) * latRad
              - (3.0 * e2 / 8.0 + 3.0 * e2 * e2 / 32.0 + 45.0 * e2 * e2 * e2 / 1024.0) * Math.sin(2.0 * latRad)
              + (15.0 * e2 * e2 / 256.0 + 45.0 * e2 * e2 * e2 / 1024.0) * Math.sin(4.0 * latRad)
              - (35.0 * e2 * e2 * e2 / 3072.0) * Math.sin(6.0 * latRad));
    var x = k0 * N * (A + (1.0 - T + C) * A * A * A / 6.0 + (5.0 - 18.0 * T + T * T + 72.0 * C - 58.0 * ePrime2) * A * A * A * A * A / 120.0) + 500000.0;
    var y = k0 * (M + N * Math.tan(latRad) * (A * A / 2.0 + (5.0 - T + 9.0 * C + 4.0 * C * C) * A * A * A * A / 24.0 + (61.0 - 58.0 * T + T * T + 600.0 * C - 330.0 * ePrime2) * A * A * A * A * A * A / 720.0));
    if (lat < 0) y += 10000000.0;
    if (!utmZone) utmZone = { zone: zone, isSouth: lat < 0 };
    return { x: x, y: y };
  }

  map.on('click', function(e) {                                                             
    document.getElementById('manLat').value = e.latlng.lat.toFixed(7);
    document.getElementById('manLng').value = e.latlng.lng.toFixed(7);
    addPoint(e.latlng.lat, e.latlng.lng, 0);
  });                                                                                   
  
  function numberedIcon(id){
    return L.divIcon({ className: 'point-marker', html: '<div class="pm-circle">' + id + '</div>', iconSize: [30,30], iconAnchor: [15,15] });                                                                                   
  }                                                                                     
  
  function addPoint(lat, lng, elev){                                                        
    var id = nextId++;
    var marker = L.marker([lat,lng], { draggable: true, icon: numberedIcon(id) }).addTo(map);
    var pt = { id: id, lat: lat, lng: lng, elev: elev || 0, marker: marker };                  
    
    marker.on('dragend', function(){                                                          
      var ll = marker.getLatLng();
      pt.lat = ll.lat; pt.lng = ll.lng;                                                       
      recalcAll();
    });                                                                                     
    points.push(pt);
    recalcAll();                                                                          
  }
                                                                                          
  function deletePoint(id){
    var idx = points.findIndex(function(p){ return p.id === id; });                         
    if (idx === -1) return;
    map.removeLayer(points[idx].marker);                                                    
    points.splice(idx,1);
    if (points.length === 0) utmZone = null;                                                
    recalcAll();                                                                          
  }                                                                                     
  
  function undoLast(){                                                                      
    if (points.length === 0) return;
    var last = points.pop();                                                                
    map.removeLayer(last.marker);                                                           
    if (points.length === 0) utmZone = null;                                                
    recalcAll();                                                                          
  }
                                                                                          
  function clearAll(){
    points.forEach(function(p){ map.removeLayer(p.marker); });
    points = []; utmZone = null;
    recalcAll();
  }
                                                                                          
  function dist(a,b){ var dx=b.x-a.x, dy=b.y-a.y; return Math.sqrt(dx*dx+dy*dy); }

  function azimuthDeg(a,b){                                                                 
    var dx = b.x - a.x, dy = b.y - a.y;
    var az = Math.atan2(dx,dy) * 180 / Math.PI;                                               
    if (az < 0) az += 360;                                                                  
    return az;                                                                            
  }
                                                                                          
  function toDMS(deg){
    var d = Math.floor(deg); var minF = (deg-d)*60; var m = Math.floor(minF); var s = Math.round((minF-m)*60);
    if (s === 60){ s=0; m+=1; } if (m === 60){ m=0; d+=1; }
    function pad(n,len){ var s=String(Math.abs(n)); while(s.length<len) s='0'+s; return s; }                                                                                        
    return pad(d,3) + '°' + pad(m,2) + "'" + pad(s,2) + '"';
  }                                                                                     
  
  function shoelaceArea(utmPts){
    var area = 0, n = utmPts.length;
    for (var i=0; i<n; i++){
      var j = (i+1) % n; area += utmPts[i].x * utmPts[j].y - utmPts[j].x * utmPts[i].y;
    }                                                                                       
    return Math.abs(area/2);
  }                                                                                     
  
  function recalcAll(){                                                                     
    try {
      var utm = points.map(function(p){ return toUTM(p.lat,p.lng); });
      var closed = points.length >= 3;                                                    
      var segDist = [], segAz = [];                                                           
      for (var i=0; i<points.length; i++){
        var hasNext = (i < points.length-1) || closed;                                          
        if (!hasNext){ segDist.push(null); segAz.push(null); continue; }
        var j = (i+1) % points.length;
        segDist.push(dist(utm[i], utm[j]));                                                     
        segAz.push(azimuthDeg(utm[i], utm[j]));
      }
      var perimeter = segDist.reduce(function(s,v){ return s + (v||0); }, 0);
      var area = closed ? shoelaceArea(utm) : 0;                                                                                                                                      
      
      renderReadout(area, perimeter, closed);
      renderTable(utm, segDist, segAz);                                                       
      renderMapShape(closed);                                                                 
      document.getElementById('pointCountBadge').textContent = points.length;
      updateTsDropdowns();
    } catch(err) { console.error(err); }
  }                                                                                     
  
  function renderReadout(area, perimeter, closed){
    document.getElementById('roArea').textContent = area.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' م²';                                         
    document.getElementById('roAreaSub').textContent = (area/10000).toLocaleString('en-US',{minimumFractionDigits:4,maximumFractionDigits:4}) + ' هكتار · ' + (area/1000).toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3}) + ' دونم';
    document.getElementById('roPerimeter').textContent = perimeter.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' م';
    document.getElementById('roZone').textContent = utmZone ? ('UTM ' + utmZone.zone + (utmZone.isSouth?'S':'N')) : '—';                                                            
    var st = document.getElementById('roStatus'); st.textContent = closed ? 'مغلق' : 'مفتوح'; st.className = closed ? 'status-pill' : 'status-pill open';                           
  }                                                                                                                                                                               
  
  function renderTable(utm, segDist, segAz){
    var body = document.getElementById('pointsBody');
    if (points.length === 0){                                                                 
      body.innerHTML = '<tr class="empty-row"><td colspan="7">انقر على الخريطة أو شغل التتبع والمشاة للرفع...</td></tr>'; return;                                                                               
    }                                                                                       
    body.innerHTML = points.map(function(p, i){                                                     
      var u = utm[i]; var d = segDist[i], az = segAz[i];                                                      
      return '<tr>' + '<td>P' + p.id + '</td>' + '<td>' + u.x.toFixed(3) + '</td>' + '<td>' + u.y.toFixed(3) + '</td>' +
        '<td><input class="elev-input" type="number" step="any" value="' + p.elev + '" data-id="' + p.id + '" /></td>' +
        '<td>' + (d===null ? '—' : d.toFixed(2)) + '</td>' + '<td>' + (az===null ? '—' : toDMS(az)) + '</td>' +
        '<td><button class="del-btn" data-id="' + p.id + '">❌</button></td>' + '</tr>';
    }).join('');
                                                                                            
    body.querySelectorAll('.del-btn').forEach(function(btn){ btn.addEventListener('click', function(){ deletePoint(parseInt(btn.dataset.id,10)); }); });                                                                                     
    body.querySelectorAll('.elev-input').forEach(function(inp){                               
      inp.addEventListener('change', function(){
        var p = points.find(function(pt){ return pt.id === parseInt(inp.dataset.id,10); }); if (p) p.elev = parseFloat(inp.value) || 0;
      });                                                                                   
    });                                                                                     
  }                                                                                     
  
  function renderMapShape(closed){                                                          
    if (polyShape){ map.removeLayer(polyShape); polyShape = null; }                         
    if (points.length < 2) return;                                                          
    var latlngs = points.map(function(p){ return [p.lat,p.lng]; });
    polyShape = closed ? L.polygon(latlngs, { color: '#00E676', weight: 3, fillColor: '#00E676', fillOpacity: 0.25 }).addTo(map) : L.polyline(latlngs, { color: '#00E676', weight: 3 }).addTo(map);                                                              
  }

  function updateTsDropdowns() {
    var stnSelect = document.getElementById('tsStation');
    var bsSelect = document.getElementById('tsBacksight');
    var savedStn = stnSelect.value;
    var savedBs = bsSelect.value;
    
    stnSelect.innerHTML = '<option value="">-- اختر نقطة الوقوف بالدستور --</option>';
    bsSelect.innerHTML = '<option value="direct">توجيه مباشر (انحراف من الشمال)</option>';
    
    points.forEach(function(p) {
      var opt = '<option value="' + p.id + '">النقطة P' + p.id + '</option>';
      stnSelect.innerHTML += opt;
      bsSelect.innerHTML += opt;
    });
    
    stnSelect.value = savedStn;
    bsSelect.value = savedBs;
  }

  document.getElementById('tsShootBtn').addEventListener('click', function() {
    var stnId = parseInt(document.getElementById('tsStation').value, 10);
    var bsValue = document.getElementById('tsBacksight').value;
    var horizAngle = parseFloat(document.getElementById('tsAngle').value);
    var horizDist = parseFloat(document.getElementById('tsDistance').value);
    var deltaZ = parseFloat(document.getElementById('tsDeltaZ').value) || 0;
    
    if (isNaN(stnId)) { alert('يرجى اختيار نقطة المحطة (مكان الوقوف بالجهاز) أولاً.'); return; }
    if (isNaN(horizAngle) || isNaN(horizDist)) { alert('يرجى إدخال الزاوية الأفقية والمسافة المترية المرصودة.'); return; }
    
    var stnPoint = points.find(function(p) { return p.id === stnId; });
    if (!stnPoint) return;
    
    var finalAzimuth = 0;
    
    if (bsValue === 'direct') {
      finalAzimuth = horizAngle;
    } else {
      var bsId = parseInt(bsValue, 10);
      if (stnId === bsId) { alert('لا يمكن أن تكون نقطة التوجيه الخلفي هي نفسها نقطة المحطة!'); return; }
      var bsPoint = points.find(function(p) { return p.id === bsId; });
      if (!bsPoint) return;
      
      var utmStn = toUTM(stnPoint.lat, stnPoint.lng);
      var utmBs = toUTM(bsPoint.lat, bsPoint.lng);
      var baseAzimuth = azimuthDeg(utmStn, utmBs);
      finalAzimuth = (baseAzimuth + horizAngle) % 360;
    }
    
    var r_earth = 6378137.0;
    var alphaRad = finalAzimuth * Math.PI / 180;
    
    var deltaLat = (horizDist * Math.cos(alphaRad)) / r_earth * (180 / Math.PI);
    var deltaLng = (horizDist * Math.sin(alphaRad)) / (r_earth * Math.cos(stnPoint.lat * Math.PI / 180)) * (180 / Math.PI);
    
    var newLat = stnPoint.lat + deltaLat;
    var newLng = stnPoint.lng + deltaLng;
    var newElev = stnPoint.elev + deltaZ;
    
    addPoint(newLat, newLng, newElev);
    map.panTo([newLat, newLng]);
    
    document.getElementById('tsAngle').value = '';
    document.getElementById('tsDistance').value = '';
    document.getElementById('tsDeltaZ').value = '0';
  });

  document.getElementById('toggleGpsBtn').addEventListener('click', function() {
    var btn = document.getElementById('toggleGpsBtn');
    var statusPill = document.getElementById('gpsStatus');
    
    if (watchId === null) {
      if (!navigator.geolocation) { alert('مستشعر الـ GPS غير مدعوم على هذا الهاتف أو المتصفح.'); return; }
      btn.textContent = "⚙️ جاري الاتصال بالأقمار الصناعية...";
      
      watchId = navigator.geolocation.watchPosition(function(pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var accuracy = pos.coords.accuracy;
        var elev = pos.coords.altitude || 0;
        
        document.getElementById('gpsAccuracy').textContent = accuracy.toFixed(1) + " م";
        btn.textContent = "🛑 إيقاف الرفع التلقائي (التتبع شغال)";
        btn.style.backgroundColor = "#c0392b";
        statusPill.textContent = "نشط";
        statusPill.classList.add('active');
        
        if (accuracy > 15) return; 
        
        var currentLatLng = L.latLng(lat, lng);
        var filterDist = parseFloat(document.getElementById('gpsDistanceFilter').value);
        
        if (lastTrackedLatLng === null) {
          addPoint(lat, lng, elev);
          lastTrackedLatLng = currentLatLng;
        } else {
          var d = lastTrackedLatLng.distanceTo(currentLatLng);
          if (d >= filterDist) {
            addPoint(lat, lng, elev);
            lastTrackedLatLng = currentLatLng;
          }
        }
        
        if (document.getElementById('gpsAutoCenter').checked) {
          map.setView([lat, lng], 19);
        }
      }, function(err) {
        alert("فشل في التقاط الـ GPS الميداني: " + err.message);
        stopGpsTracking();
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    } else {
      stopGpsTracking();
    }
  });

  function stopGpsTracking() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    lastTrackedLatLng = null;
    var btn = document.getElementById('toggleGpsBtn');
    btn.textContent = "تشغيل الرفع التلقائي أثناء المشي 🏃‍♂️";
    btn.style.backgroundColor = "#e74c3c";
    var statusPill = document.getElementById('gpsStatus');
    statusPill.textContent = "موقف";
    statusPill.classList.remove('active');
    document.getElementById('gpsAccuracy').textContent = "—";
  }
                                                                                          
  function buildKML(){
    var placemarks = points.map(function(p){                                                  
      return '<Placemark><name>P' + p.id + '</name><description>Z=' + p.elev + '</description><Point><coordinates>' + p.lng + ',' + p.lat + ',' + p.elev + '</coordinates></Point></Placemark>';                                                                         
    }).join('\n');
    var polygonKml = '';
    if (points.length >= 3){
      var coords = points.map(function(p){ return p.lng + ',' + p.lat + ',' + p.elev; }).join(' ');
      coords += ' ' + points[0].lng + ',' + points[0].lat + ',' + points[0].elev;
      polygonKml = '<Placemark><name>حدود المساحة</name><Style><LineStyle><color>ff3566ff</color><width>2</width></LineStyle><PolyStyle><color>664eb1ff</color></PolyStyle></Style><Polygon><outerBoundaryIs><LinearRing><coordinates>' + coords + '</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>';
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>مسح الموقع</name>\n' + placemarks + '\n' + polygonKml + '\n</Document></kml>';
  }
                                                                                          
  function buildDXF(){
    var entities = '';                                                                      
    points.forEach(function(p){
      var u = toUTM(p.lat,p.lng);
      entities += '0\nPOINT\n8\nPOINTS\n10\n' + u.x.toFixed(3) + '\n20\n' + u.y.toFixed(3) + '\n30\n' + p.elev.toFixed(3) + '\n';
      entities += '0\nTEXT\n8\nLABELS\n10\n' + (u.x+0.5).toFixed(3) + '\n20\n' + (u.y+0.5).toFixed(3) + '\n30\n0\n40\n0.8\n1\nP' + p.id + '\n';
    });
    if (points.length >= 2){
      var closedFlag = points.length >= 3 ? 1 : 0;                                            
      entities += '0\nPOLYLINE\n8\nBOUNDARY\n66\n1\n70\n' + closedFlag + '\n';
      points.forEach(function(p){                                                               
        var u = toUTM(p.lat,p.lng); entities += '0\nVERTEX\n8\nBOUNDARY\n10\n' + u.x.toFixed(3) + '\n20\n' + u.y.toFixed(3) + '\n30\n' + p.elev.toFixed(3) + '\n';                                                
      });
      entities += '0\nSEQEND\n';                                                            
    }
    return '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n' + entities + '0\nENDSEC\n0\nEOF\n';
  }                                                                                     
  
  function buildCSV(){                                                                      
    var rows = ['Point,Lat,Lon,Easting,Northing,Elevation'];
    points.forEach(function(p){ var u = toUTM(p.lat,p.lng); rows.push(['P'+p.id, p.lat.toFixed(7), p.lng.toFixed(7), u.x.toFixed(3), u.y.toFixed(3), p.elev.toFixed(3)].join(',')); });
    return rows.join('\n');
  }

  function buildTXT(){                                                                      
    var rows = [];
    points.forEach(function(p){ var u = toUTM(p.lat,p.lng); rows.push([p.id, u.y.toFixed(3), u.x.toFixed(3), p.elev.toFixed(3), 'P'+p.id].join(',')); });
    return rows.join('\n');
  }

  function downloadFile(content, filename, mime){
    try {
      var blob = new Blob([content], { type: mime }); var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = filename;                                                    
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) { console.log("Blocked by WebView"); }                                                             
  }                                                                                     
  
  function handleExport(content, filename, mime) {
    downloadFile(content, filename, mime);
    document.getElementById('modalTitle').textContent = "تصدير ملف: " + filename;
    document.getElementById('modalTextArea').value = content;
    document.getElementById('exportModal').style.display = 'flex';
  }

  function guardEmpty(){ if (points.length === 0){ alert('يرجى إسقاط أو رصد نقطة واحدة على الأقل قبل التصدير.'); return true; } return false; }

  document.getElementById('manAddBtn').addEventListener('click', function(){                
    var lat = parseFloat(document.getElementById('manLat').value); var lng = parseFloat(document.getElementById('manLng').value);
    var elev = parseFloat(document.getElementById('manElev').value) || 0;
    if (isNaN(lat) || isNaN(lng) || lat<-90 || lat>90 || lng<-180 || lng>180){ alert('أدخل إحداثيات صحيحة.'); return; }
    addPoint(lat,lng,elev); map.panTo([lat,lng]);
  });

  document.getElementById('goBtn').addEventListener('click', function(){                    
    var lat = parseFloat(document.getElementById('manLat').value); var lng = parseFloat(document.getElementById('manLng').value);
    if (!isNaN(lat) && !isNaN(lng)) map.setView([lat,lng], 18);                                                            
  });                                                                                                                                                                             
  
  document.getElementById('undoBtn').addEventListener('click', undoLast);

  var clearBtn = document.getElementById('clearBtn'); var clearArmed = false, clearTimer = null;
  clearBtn.addEventListener('click', function(){
    if (!clearArmed){
      clearArmed = true; clearBtn.textContent = 'اضغط للتأكيد'; clearBtn.classList.add('danger-armed');
      clearTimer = setTimeout(function(){ clearArmed = false; clearBtn.textContent = '🗑️ مسح الكل'; clearBtn.classList.remove('danger-armed'); }, 3000);
    } else {
      clearArmed = false; clearBtn.textContent = '🗑️ مسح الكل'; clearBtn.classList.remove('danger-armed'); clearTimeout(clearTimer); clearAll();
    }
  });

  document.getElementById('expKML').addEventListener('click', function(){ if(!guardEmpty()) handleExport(buildKML(), 'survey_export.kml', 'application/vnd.google-earth.kml+xml'); });
  document.getElementById('expDXF').addEventListener('click', function(){ if(!guardEmpty()) handleExport(buildDXF(), 'survey_export.dxf', 'image/vnd.dxf'); });
  document.getElementById('expCSV').addEventListener('click', function(){ if(!guardEmpty()) handleExport(buildCSV(), 'survey_export.csv', 'text/csv'); });
  document.getElementById('expTXT').addEventListener('click', function(){ if(!guardEmpty()) handleExport(buildTXT(), 'survey_export.txt', 'text/plain'); });

  document.getElementById('expZIP').addEventListener('click', function(){
    if(guardEmpty()) return;
    var zip = new JSZip();
    zip.file("survey_export.kml", buildKML()); zip.file("survey_export.dxf", buildDXF()); zip.file("survey_export.csv", buildCSV()); zip.file("survey_export.txt", buildTXT());
    zip.generateAsync({type:"blob"}).then(function(content) {
      downloadFile(content, "all_survey_exports.zip", "application/zip");
      if (navigator.share) {
        var file = new File([content], "all_survey_exports.zip", {type: "application/zip"});
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'ملفات المساحة كاملة', text: 'مرفق ملف ZIP بالصيغ الميدانية' }).catch(console.error);
        }
      }
    });
  });

  document.getElementById('closeModalBtn').addEventListener('click', function(){ document.getElementById('exportModal').style.display = 'none'; });
  document.getElementById('copyTextBtn').addEventListener('click', function(){
    var ta = document.getElementById('modalTextArea'); ta.select(); ta.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(ta.value).then(function() { alert('📋 تم نسخ النص المساحي للملف!'); });
  });
  document.getElementById('shareTextBtn').addEventListener('click', function(){
    var ta = document.getElementById('modalTextArea'); if (navigator.share) navigator.share({ title: 'بيانات الرفع', text: ta.value }).catch(console.error);
  });

})();
