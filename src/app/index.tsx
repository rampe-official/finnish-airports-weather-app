import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { DOMParser } from '@xmldom/xmldom';
import { MaterialCommunityIcons } from '@expo/vector-icons';
//import MapView, { Marker } from 'react-native-maps'; // <-- Import Map components
import OpenMap from '../components/openmap';

export default function App() {
  const [weather, setWeather] = useState({ oulu: null, turku: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchWeather = async () => {
    try {
      setError(null);
      const url = 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::timevaluepair&fmisid=101786&fmisid=101065&parameters=t2m,ws_10min,p_sea,r_1h';
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch data');
      const xmlText = await response.text();
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      setWeather({
        oulu: parseStationData(xmlDoc, '101786'),
        turku: parseStationData(xmlDoc, '101065')
      });
      
      setLastFetched(new Date());
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchWeather().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWeather().finally(() => setRefreshing(false));
  }, []);

  const parseStationData = (xmlDoc, fmisid) => {
    let observations = xmlDoc.getElementsByTagName('omso:PointTimeSeriesObservation');
    if (observations.length === 0) {
       observations = xmlDoc.getElementsByTagName('om:OM_Observation');
    }
    
    let temp = '--';
    let wind = '--';
    let pressure = '--';
    let rain = '--';
    
    for (let i = 0; i < observations.length; i++) {
      const obs = observations[i];
      let isTargetStation = false;
      
      const identifiers = obs.getElementsByTagName('gml:identifier');
      for (let k = 0; k < identifiers.length; k++) {
         if (identifiers[k].textContent.includes(fmisid)) {
            isTargetStation = true;
            break;
         }
      }
      
      if (!isTargetStation) {
         const names = obs.getElementsByTagName('gml:name');
         for (let k = 0; k < names.length; k++) {
            if (names[k].textContent.includes(fmisid)) {
               isTargetStation = true;
               break;
            }
         }
      }

      if (isTargetStation) {
         const propNode = obs.getElementsByTagName('om:observedProperty')[0];
         const observedProperty = propNode ? propNode.getAttribute('xlink:href') : '';
         const values = obs.getElementsByTagName('wml2:value');
         
         let latestValidValue = '--';
         for (let j = values.length - 1; j >= 0; j--) {
           const val = values[j].textContent.trim();
           if (val !== 'NaN' && val !== '') {
             latestValidValue = val;
             break;
           }
         }
         
         if (latestValidValue !== '--') {
           if (observedProperty.includes('t2m')) temp = latestValidValue;
           if (observedProperty.includes('ws_10min')) wind = latestValidValue;
           if (observedProperty.includes('p_sea')) pressure = latestValidValue;
           if (observedProperty.includes('r_1h')) rain = latestValidValue;
         }
      }
    }
    
    if (rain === '--' && temp !== '--') rain = '0.0';
    return { temp, wind, pressure, rain };
  };

  const formatTime = (date) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
  };

  const getNextUpdateTarget = (date) => {
    if (!date) return '--:--';
    const next = new Date(date);
    next.setMinutes(next.getMinutes() + 10);
    return next.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
  };

  const getTempColor = (tempValue) => {
    if (tempValue === '--') return '#64748b';
    const temp = parseFloat(tempValue);
    if (temp <= 0) return '#3b82f6'; 
    if (temp >= 15) return '#ef4444'; 
    return '#f97316'; 
  };

  const getWindColor = (windValue) => {
    if (windValue === '--') return '#64748b';
    const wind = parseFloat(windValue);
    if (wind >= 14) return '#ef4444'; 
    if (wind >= 8) return '#f97316';  
    return '#64748b'; 
  };

  const getPressureColor = (pressureValue) => {
    if (pressureValue === '--') return '#64748b';
    const pressure = parseFloat(pressureValue);
    if (pressure <= 1000) return '#8b5cf6'; 
    if (pressure >= 1020) return '#f59e0b'; 
    return '#10b981'; 
  };

  const getRainColor = (rainValue) => {
    if (rainValue === '--') return '#64748b';
    const rain = parseFloat(rainValue);
    if (rain > 0) return '#3b82f6'; 
    return '#64748b'; 
  };

  const renderWeatherCard = (title, data) => {
    if (!data) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.cityText}>{title}</Text>
        
        <View style={styles.metricRow}>
          <View style={styles.labelContainer}>
            <MaterialCommunityIcons name="thermometer" size={24} color={getTempColor(data.temp)} style={styles.icon} />
            <Text style={styles.metricLabel}>Temperature</Text>
          </View>
          <Text style={styles.metricValue}>{data.temp !== '--' ? `${data.temp} °C` : '--'}</Text>
        </View>
        <View style={styles.divider} />
        
        <View style={styles.metricRow}>
          <View style={styles.labelContainer}>
            <MaterialCommunityIcons name="weather-windy" size={24} color={getWindColor(data.wind)} style={styles.icon} />
            <Text style={styles.metricLabel}>Wind</Text>
          </View>
          <Text style={styles.metricValue}>{data.wind !== '--' ? `${data.wind} m/s` : '--'}</Text>
        </View>
        <View style={styles.divider} />
        
        <View style={styles.metricRow}>
          <View style={styles.labelContainer}>
            <MaterialCommunityIcons name="gauge" size={24} color={getPressureColor(data.pressure)} style={styles.icon} />
            <Text style={styles.metricLabel}>Air Pressure</Text>
          </View>
          <Text style={styles.metricValue}>{data.pressure !== '--' ? `${data.pressure} hPa` : '--'}</Text>
        </View>
        <View style={styles.divider} />
        
        <View style={styles.metricRow}>
          <View style={styles.labelContainer}>
            <MaterialCommunityIcons name="weather-pouring" size={24} color={getRainColor(data.rain)} style={styles.icon} />
            <Text style={styles.metricLabel}>Rain (1h)</Text>
          </View>
          <Text style={styles.metricValue}>{data.rain !== '--' ? `${data.rain} mm` : '--'}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Fetching FMI Data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Airport Weather</Text>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={["#2563eb"]}
            tintColor="#2563eb"
          />
        }
      >
        {/* NEW: Map Component */}
        <View style={styles.mapContainer}>
          <OpenMap />
        </View>

        {renderWeatherCard('Oulu Airport', weather.oulu)}
        {renderWeatherCard('Turku Airport', weather.turku)}
        
        {lastFetched && (
          <View style={styles.timestampContainer}>
            <MaterialCommunityIcons name="clock-outline" size={20} color="#64748b" style={{ marginRight: 6 }} />
            <View>
              <Text style={styles.timestampText}>
                Data fetched at {formatTime(lastFetched)}
              </Text>
              <Text style={styles.timestampSubText}>
                Next FMI update available ~{getNextUpdateTarget(lastFetched)}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginVertical: 24, color: '#0f172a' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  
  // NEW: Map Styles
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden', // Ensures the map stays inside the rounded corners
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  map: {
    width: '100%',
    height: '100%',
  },

  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
  cityText: { fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  labelContainer: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 10, width: 26, textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#e2e8f0', width: '100%' },
  metricLabel: { fontSize: 16, color: '#64748b', fontWeight: '500' },
  metricValue: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  loadingText: { marginTop: 12, color: '#64748b', fontWeight: '500' },
  errorText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  timestampContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, paddingHorizontal: 20 },
  timestampText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  timestampSubText: { fontSize: 12, color: '#94a3b8', marginTop: 2 }
});