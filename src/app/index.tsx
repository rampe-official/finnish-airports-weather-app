import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOMParser } from '@xmldom/xmldom';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import OpenMap from '../components/openmap';

export interface AirportStation {
  id: string;
  name: string;
  code: string;
  fmisid: string;
  latitude: number;
  longitude: number;
}

export const INTERNATIONAL_AIRPORTS: AirportStation[] = [
  { id: 'hel', name: 'Helsinki-Vantaa', code: 'EFHK', fmisid: '100971', latitude: 60.3172, longitude: 24.9633 },
  { id: 'oulu', name: 'Oulu', code: 'EFOU', fmisid: '101784', latitude: 65.0, longitude: 25.356 },
  { id: 'turku', name: 'Turku', code: 'EFTU', fmisid: '100947', latitude: 60.514, longitude: 22.2628 },
  { id: 'rovaniemi', name: 'Rovaniemi', code: 'EFRO', fmisid: '101831', latitude: 66.562, longitude: 25.4402 },
  { id: 'kittila', name: 'Kittilä', code: 'EFKT', fmisid: '101932', latitude: 67.701, longitude: 24.8465 },
  { id: 'ivalo', name: 'Ivalo', code: 'EFIV', fmisid: '102035', latitude: 68.607, longitude: 27.4056 },
  { id: 'kuusamo', name: 'Kuusamo', code: 'EFKS', fmisid: '101840', latitude: 65.9847, longitude: 29.2378 },
  { id: 'vaasa', name: 'Vaasa', code: 'EFVA', fmisid: '101464', latitude: 63.0503, longitude: 21.7622 },
  { id: 'tampere', name: 'Tampere-Pirkkala', code: 'EFTP', fmisid: '101124', latitude: 61.414, longitude: 23.604 },
];

export default function App() {
  const [weatherData, setWeatherData] = useState<{ [fmisid: string]: any }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const cardRefs = useRef<{ [key: string]: View | null }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [flightsData, setFlightsData] = useState<{ [icao: string]: { dep: any[], arr: any[] } }>({});
  // Change from single string to dictionary object
  const [flightModes, setFlightModes] = useState<{ [icao: string]: 'dep' | 'arr' }>({
    'EFHK': 'dep', 'EFOU': 'dep', 'EFTU': 'dep', 'EFRO': 'dep',
    'EFKT': 'dep', 'EFIV': 'dep', 'EFKS': 'dep', 'EFVA': 'dep', 'EFTP': 'dep'
  });
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 65.0, lng: 25.356 });
  const [mapTouched, setMapTouched] = useState(false);

  const fetchFinaviaFlights = async () => {
    try {
      setLoadingFlights(true);
      const url = `https://apigw.finavia.fi/flights/public/v0/flights`;

      const apiKey = process.env.EXPO_PUBLIC_FINAVIA_API_KEY ?? '';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'app_key': apiKey.trim(),
          'Accept': 'application/xml',
          'Cache-Control': 'no-cache'
        }
      });
      
      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      const cutoffTime = new Date(Date.now() - 30 * 60000);
      const iataToIcao: { [key: string]: string } = {
        'HEL': 'EFHK', 'OUL': 'EFOU', 'TKU': 'EFTU', 'RVN': 'EFRO',
        'KTT': 'EFKT', 'IVL': 'EFIV', 'KAO': 'EFKS', 'VAA': 'EFVA', 'TMP': 'EFTP'
      };

      const newFlightsData: { [icao: string]: { dep: any[], arr: any[] } } = {};
      INTERNATIONAL_AIRPORTS.forEach(a => { newFlightsData[a.code] = { dep: [], arr: [] }; });

  const parseNode = (nodeName: 'dep' | 'arr') => {
            const rootNode = xmlDoc.getElementsByTagName(nodeName)[0];
            if (!rootNode) return;

            const flightNodes = rootNode.getElementsByTagName('flight');
            const now = new Date();

            for (let i = 0; i < flightNodes.length; i++) {
              const node = flightNodes[i];
              const getTag = (tag: string) => node.getElementsByTagName(tag)[0]?.textContent || '';
              const icao = iataToIcao[getTag('h_apt')];
              if (icao && newFlightsData[icao]) {
                const sdtString = getTag('sdt');
                if (!sdtString) continue;

                const flightTime = new Date(sdtString);

                // Ensure it's happening today (local calendar day check) and after our 30-min past cutoff
                const isToday =
                  flightTime.getDate() === now.getDate() &&
                  flightTime.getMonth() === now.getMonth() &&
                  flightTime.getFullYear() === now.getFullYear();

                if (isToday && flightTime > cutoffTime) {
                  newFlightsData[icao][nodeName].push({
                    fltnr: getTag('fltnr'),
                    sdt: sdtString,
                    route_n_1: getTag('route_n_1')
                  });
                }
              }
            }
          };
      parseNode('dep');
      parseNode('arr');

      Object.keys(newFlightsData).forEach(icao => {
        const sortFn = (a: any, b: any) => new Date(a.sdt).getTime() - new Date(b.sdt).getTime();
        newFlightsData[icao].dep = newFlightsData[icao].dep.sort(sortFn).slice(0, 5);
        newFlightsData[icao].arr = newFlightsData[icao].arr.sort(sortFn).slice(0, 5);
      });

      setFlightsData(newFlightsData);
    } catch (error) {
      console.error('Failed to fetch Finavia data:', error);
    } finally {
      setLoadingFlights(false);
    }
  };

  const parseStationData = (text: string, fmisid: string) => {
    let temp = '--';
    let wind = '--';
    let windDir = '--';
    let pressure = '--';
    let rain = '--';

    const regex = /<(?:\w+:)?parameterName>(.*?)<\/(?:\w+:)?parameterName>[\s\S]*?<(?:\w+:)?parameterValue>(.*?)<\/(?:\w+:)?parameterValue>/gi;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const name = match[1].trim().toLowerCase();
      const val = match[2].trim();
      
      if (val && val !== '') {
        if (name === 'r_1h') {
          rain = (val === 'NaN') ? '0.0' : parseFloat(val).toFixed(1);
        } else if (val !== 'NaN') {
          if (name === 't2m') temp = parseFloat(val).toFixed(1);
          if (name === 'ws_10min') wind = parseFloat(val).toFixed(1);
          if (name === 'wd_10min') windDir = val;
          if (name === 'p_sea') pressure = Math.round(parseFloat(val)).toString();
        }
      }
    }
    
    return { temp, wind, windDir, pressure, rain };
  };
    
  const fetchAllAirportsWeather = async () => {
    try {
      setLoading(true);
      setError(null);
      const results: { [fmisid: string]: any } = {};
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      await Promise.all(
        INTERNATIONAL_AIRPORTS.map(async (airport) => {
          const url = `https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::simple&fmisid=${airport.fmisid}&starttime=${oneHourAgo}`;
          const response = await fetch(url);
          const text = await response.text();
          results[airport.fmisid] = parseStationData(text, airport.fmisid);
        })
      );

      setWeatherData(results);
      setLastFetched(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch weather data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllAirportsWeather();
    fetchFinaviaFlights();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllAirportsWeather();
    fetchFinaviaFlights();
  }, []);

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
  };

  const getNextUpdateTarget = (date: Date | null) => {
    if (!date) return '--:--';
    const next = new Date(date);
    next.setMinutes(next.getMinutes() + 10);
    return next.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
  };

  const getTempColor = (tempValue: string) => {
    if (tempValue === '--') return '#64748b';
    const temp = parseFloat(tempValue);
    
    if (temp <= 0) return '#3b82f6';
    if (temp <= 10) return '#00a5a9';
    if (temp <= 20) return '#f97316';
    if (temp <= 25) return '#fa7333';
    return '#ef4444';
  };

  const getWindColor = (windValue: string) => {
    if (windValue === '--') return '#64748b';
    const wind = parseFloat(windValue);
    if (wind <= 3) return '#10b981';
    if (wind <= 7) return '#0ea5e9';
    if (wind <= 13) return '#f59e0b';
    if (wind <= 20) return '#f97316';
    return '#ef4444'; 
  };

  const getPressureColor = (pressureValue: string) => {
    if (pressureValue === '--') return '#64748b';
    const pressure = parseFloat(pressureValue);
    if (pressure <= 990) return '#8b5cf6';
    if (pressure <= 1005) return '#0ea5e9';
    if (pressure <= 1015) return '#10b981';
    if (pressure <= 1025) return '#f59e0b';
    return '#f97316';
  };

  const getRainColor = (rainValue: string) => {
    if (rainValue === '--') return '#64748b';
    const rain = parseFloat(rainValue);
    if (rain <= 0) return '#94a3b8';
    if (rain <= 1.0) return '#38bdf8';
    if (rain <= 4.0) return '#3b82f6';
    if (rain <= 10.0) return '#4f46e5';
    return '#312e81';
  };

  const getCardinalDirection = (degStr: string) => {
    if (degStr === '--') return '';
    const deg = parseFloat(degStr);
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
    return cardinals[Math.round((deg % 360) / 45)];
  };

  const renderWeatherCard = (title: string, data: any, icao: string) => {
    if (!data) return null;

      const stationFlights = flightsData[icao] || { dep: [], arr: [] };
      // Get mode specific to this airport card
      const currentMode = flightModes[icao] || 'dep';
      const currentFlights = stationFlights[currentMode] || [];

      // Helper to update only this airport's mode
      const setCardMode = (mode: 'dep' | 'arr') => {
        setFlightModes(prev => ({ ...prev, [icao]: mode }));
      };

    return (
      <View style={styles.card}>
        <Text style={styles.cityText}>{title}</Text>
        
        <View style={styles.metricRow}>
          <View style={styles.labelContainer}>
            <MaterialCommunityIcons name="thermometer" size={24} color={getTempColor(data.temp)} style={styles.icon} />
            <Text style={styles.metricLabel}>Temperature</Text>
          </View>
          <Text style={[styles.metricValue, { color: getTempColor(data.temp) }]}>
            {data.temp}°C
          </Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.metricRow}>
          <View style={styles.labelContainer}>
            <MaterialCommunityIcons name="weather-windy" size={24} color={getWindColor(data.wind)} style={styles.icon} />
            <Text style={styles.metricLabel}>Wind</Text>
          </View>
          <Text style={[styles.metricValue, { color: getWindColor(data.wind) }]}>
            {data.wind} m/s {getCardinalDirection(data.windDir)}
          </Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.metricRow}>
          <View style={styles.labelContainer}>
            <MaterialCommunityIcons name="gauge" size={24} color={getPressureColor(data.pressure)} style={styles.icon} />
            <Text style={styles.metricLabel}>Pressure</Text>
          </View>
          <Text style={[styles.metricValue, { color: getPressureColor(data.pressure) }]}>
            {data.pressure} hPa
          </Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.metricRow}>
          <View style={styles.labelContainer}>
            <MaterialCommunityIcons name="weather-pouring" size={24} color={getRainColor(data.rain)} style={styles.icon} />
            <Text style={styles.metricLabel}>Rain (1h)</Text>
          </View>
          <Text style={[styles.metricValue, { color: getRainColor(data.rain) }]}>
            {data.rain} mm
          </Text>
        </View>

        <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: '#e2e8f0' }}>

        {/* Segmented Control Toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setCardMode('dep')}
            style={{ flex: 1, paddingVertical: 6, alignItems: 'center', backgroundColor: currentMode === 'dep' ? '#ffffff' : 'transparent', borderRadius: 6, shadowColor: currentMode === 'dep' ? '#000' : 'transparent', shadowOpacity: 0.1, shadowRadius: 2, elevation: currentMode === 'dep' ? 2 : 0 }}
          >
            <Text style={{ fontWeight: '600', color: currentMode === 'dep' ? '#0f172a' : '#64748b' }}>Departures</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCardMode('arr')}
            style={{ flex: 1, paddingVertical: 6, alignItems: 'center', backgroundColor: currentMode === 'arr' ? '#ffffff' : 'transparent', borderRadius: 6, shadowColor: currentMode === 'arr' ? '#000' : 'transparent', shadowOpacity: 0.1, shadowRadius: 2, elevation: currentMode === 'arr' ? 2 : 0 }}
          >
            <Text style={{ fontWeight: '600', color: currentMode === 'arr' ? '#0f172a' : '#64748b' }}>Arrivals</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Flight List */}
        {loadingFlights ? (
          <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 10 }}>Loading Finavia data...</Text>
        ) : currentFlights.length > 0 ? (
          currentFlights.map((flight, index) => (
            <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View>
                <Text style={{ fontWeight: '500', color: '#334155' }}>
                  {flight.route_n_1 || 'Unknown'}
                </Text>
                <Text style={{ fontSize: 12, color: '#64748b' }}>{flight.fltnr}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '500', color: '#0f172a' }}>
                  {flight.sdt ? new Date(flight.sdt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 10 }}>
            No upcoming {currentMode === 'dep' ? 'departures' : 'arrivals'} found.
          </Text>
        )}
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
      <Text style={styles.headerTitle}>FMI Airport Weather</Text>
    <ScrollView
        ref={scrollViewRef}
        scrollEnabled={!mapTouched}
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
    <View
      style={styles.mapContainer}
      onTouchStart={() => setMapTouched(true)}
      onTouchEnd={() => setMapTouched(false)}
      onTouchCancel={() => setMapTouched(false)}
    >
      <OpenMap
        airports={INTERNATIONAL_AIRPORTS}
        mapCenter={mapCenter}
        onSelectAirport={(airportId) => {
          const airport = INTERNATIONAL_AIRPORTS.find(a => a.id === airportId);
          if (airport) {
            setMapCenter({ lat: airport.latitude, lng: airport.longitude });

            if (cardRefs.current[airport.fmisid]) {
              cardRefs.current[airport.fmisid]?.measure((x, y, width, height, pageX, pageY) => {
                scrollViewRef.current?.scrollTo({ y, animated: true });
              });
            }
          }
        }}
      />
    </View>

        {/* Timestamp Location */}
        {lastFetched && (
          <View style={[styles.timestampContainer, { marginBottom: 20 }]}>
            <MaterialCommunityIcons name="clock-outline" size={20} color="#64748b" style={{ marginRight: 6 }} />
            <View>
              <Text style={styles.timestampText}>
                Weather & Flights updated at {formatTime(lastFetched)}
              </Text>
              <Text style={styles.timestampSubText}>
                Next data refresh available ~{getNextUpdateTarget(lastFetched)}
              </Text>
            </View>
          </View>
        )}

        {INTERNATIONAL_AIRPORTS.map((airport) => (
          <View key={airport.id} ref={(el) => { cardRefs.current[airport.fmisid] = el; }}>
            {renderWeatherCard(`${airport.name} Airport`, weatherData[airport.fmisid], airport.code)}
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    paddingVertical: 16,
  },
  mapContainer: {
    height: 380,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4
  },
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