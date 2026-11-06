import React from 'react';
import { WebView } from 'react-native-webview';

export default function OpenMap() {
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
            body { padding: 0; margin: 0; }
            #map { width: 100%; height: 100vh; }
        </style>
    </head>
    <body>
        <div id="map"></div>
    <script>
            // Initialize map without a hardcoded center or zoom
            var map = L.map('map');
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            L.marker([64.9300, 25.3546]).addTo(map).bindPopup('Oulu Airport (OUL)');
            L.marker([60.5141, 22.2618]).addTo(map).bindPopup('Turku Airport (TKU)');

            // Automatically zoom and center to fit both airports
            map.fitBounds([
                [64.9300, 25.3546], // Oulu
                [60.5141, 22.2618]  // Turku
            ], { padding: [40, 40] });
        </script>
    </body>
    </html>
  `;

  return (
    <WebView 
      source={{ html: mapHtml }} 
      style={{ width: '100%', height: 300 }}
      scrollEnabled={false}
    />
  );
}