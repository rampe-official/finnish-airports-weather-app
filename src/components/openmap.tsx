import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { AirportStation } from '../app/index'; // Adjust path if needed

interface OpenMapProps {
  airports: AirportStation[];
  onSelectAirport: (airportId: string) => void;
  mapCenter?: { lat: number; lng: number }; 
}

export default function OpenMap({ airports, onSelectAirport, mapCenter }: OpenMapProps) {
  const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html { margin: 0; padding: 0; height: 100%; width: 100%; }
          #map { height: 100%; width: 100%; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([64.5, 26.0], 5);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
          }).addTo(map);

          var airports = ${JSON.stringify(airports)};
          
          airports.forEach(function(ap) {
            var marker = L.marker([ap.latitude, ap.longitude]).addTo(map);
            marker.bindPopup("<b>" + ap.name + " (" + ap.code + ")</b>");
            
            marker.on('click', function() {
              // Smoothly centers and zooms in on the clicked airport
              map.flyTo([ap.latitude, ap.longitude], map.getZoom());
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerClick', id: ap.id }));
            });
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ html: mapHtml }}
        style={{ flex: 1 }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'markerClick') {
              onSelectAirport(data.id);
            }
          } catch (e) {
            console.error(e);
          }
        }}
      />
    </View>
  );
}