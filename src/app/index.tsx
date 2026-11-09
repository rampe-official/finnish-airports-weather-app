import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { DOMParser } from '@xmldom/xmldom';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import OpenMap from '../components/openmap';

export interface AirportStation {
  id: string;
  name: string;
  code: string; // e.g., "EFHK"
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
  { id: 'kuusamo', name: 'Kuusamo', code: 'EFKS', fmisid: '101840', latitude: 65.9847, longitude: 29.2378 }, // Fixed FMISID
  { id: 'vaasa', name: 'Vaasa', code: 'EFVA', fmisid: '101464', latitude: 63.0503, longitude: 21.7622 },
  { id: 'tampere', name: 'Tampere-Pirkkala', code: 'EFTP', fmisid: '101124', latitude: 61.414, longitude: 23.604 }, // Fixed FMISID
];

export default function App() {
  const [weatherData, setWeatherData] = useState<{ [fmisid: string]: any }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const cardRefs = useRef<{ [key: string]: View | null }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

// 1. Add state to track the map's center position
  const [mapCenter, setMapCenter] = useState({ lat: 65.0, lng: 25.356 }); 

  // 2. Create the function to handle map interactions
  const handleMapMessage = (message: any) => {
    if (message.event === 'onMapMarkerClicked') {
      const selectedId = message.payload.mapMarkerID;
      const airport = INTERNATIONAL_AIRPORTS.find(a => a.id === selectedId);
      
      if (airport) {
        setSelectedAirport(airport); // Update the weather card
        setMapCenter({ lat: airport.latitude, lng: airport.longitude }); // Pan the map
      }
    }
  };

  const parseStationData = (text: string, fmisid: string) => {
    let temp = '--';
    let wind = '--';
    let windDir = '--'; // Add wind direction
    let pressure = '--';
    let rain = '--';

    const regex = /<(?:\w+:)?parameterName>(.*?)<\/(?:\w+:)?parameterName>[\s\S]*?<(?:\w+:)?parameterValue>(.*?)<\/(?:\w+:)?parameterValue>/gi;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const name = match[1].trim().toLowerCase();
      const val = match[2].trim();
      
      if (val && val !== '') {
        if (name === 'r_1h') {
          rain = (val === 'NaN') ? '0.0' : val;
        } else if (val !== 'NaN') {
          if (name === 't2m') temp = val;
          if (name === 'ws_10min') wind = val;
          if (name === 'wd_10min') windDir = val; // Capture wind direction
          if (name === 'p_sea') pressure = val;
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
          results[airport.fmisid] = parseStationData(text, airport.fmisid);        })
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
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllAirportsWeather();
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
    
    if (temp <= 0) return '#3b82f6';  // Solid Blue for freezing and below
    if (temp <= 10) return '#00a5a9'; // Sky Blue for chilly (+0.1 to +10.0)
    if (temp <= 20) return '#f97316'; // Orange for mild (+10.1 to +20.0)
    if (temp <= 25) return '#fa7333';
    return '#ef4444';
  };

  const getWindColor = (windValue: string) => {
    if (windValue === '--') return '#64748b';
    const wind = parseFloat(windValue);
    if (wind <= 3) return '#10b981';  // Emerald Green: Calm to light breeze
    if (wind <= 7) return '#0ea5e9';  // Sky Blue: Gentle to moderate breeze
    if (wind <= 13) return '#f59e0b'; // Amber: Fresh breeze (noticeable wind)
    if (wind <= 20) return '#f97316'; // Orange: Strong wind to gale (aviation caution)
    return '#ef4444'; 
  };

  const getPressureColor = (pressureValue: string) => {
    if (pressureValue === '--') return '#64748b';
    const pressure = parseFloat(pressureValue);
    if (pressure <= 990) return '#8b5cf6';  // Purple: Very low (deep depression / stormy)
    if (pressure <= 1005) return '#0ea5e9'; // Sky Blue: Low (unsettled weather)
    if (pressure <= 1015) return '#10b981'; // Emerald Green: Normal / average (around 1013 hPa)
    if (pressure <= 1025) return '#f59e0b'; // Amber: High (fair / clear skies)
    return '#f97316';                       // Orange: Very high (very stable / dry)
    };

  const getRainColor = (rainValue: string) => {
    if (rainValue === '--') return '#64748b';
    const rain = parseFloat(rainValue);
    
    if (rain <= 0) return '#94a3b8';    // Slate Light: No rain (dry)
    if (rain <= 1.0) return '#38bdf8';  // Light Blue: Drizzle or very light rain
    if (rain <= 4.0) return '#3b82f6';  // Solid Blue: Moderate rain
    if (rain <= 10.0) return '#4f46e5'; // Indigo: Heavy rain
    return '#312e81';                   // Deep Dark Blue/Indigo: Torrential downpour
  };

  const getCardinalDirection = (degStr: string) => {
    if (degStr === '--') return '';
    const deg = parseFloat(degStr);
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
    return cardinals[Math.round((deg % 360) / 45)];
  };

  const renderWeatherCard = (title: string, data: any) => {
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
        
      {/* Wind Speed Row */}
        <View style={styles.metricRow}>
          <View style={styles.labelContainer}>
            <MaterialCommunityIcons name="weather-windy" size={24} color={getWindColor(data.wind)} style={styles.icon} />
            <Text style={styles.metricLabel}>Wind</Text>
          </View>
          <Text style={styles.metricValue}>{data.wind !== '--' ? `${data.wind} m/s` : '--'}</Text>
        </View>

      {/* Wind Direction Row */}
        {data.windDir !== '--' && (
          <View style={styles.metricRow}>
            <View style={styles.labelContainer}>
              <MaterialCommunityIcons name="compass-outline" size={24} color="#64748b" style={styles.icon} />
              <Text style={styles.metricLabel}>Wind dir</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons 
                name="arrow-down" 
                size={20} 
                color={getWindColor(data.wind)} 
                style={{ transform: [{ rotate: `${data.windDir}deg` }] }}
              />
              <Text style={[styles.metricValue, { marginLeft: 8 }]}>
                {data.windDir}° {getCardinalDirection(data.windDir)}
              </Text>
            </View>
          </View>
        )}

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
      <Text style={styles.headerTitle}>FMI Airport Weather</Text>
      <ScrollView 
        ref={scrollViewRef}
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
        <View style={styles.mapContainer}>
          <OpenMap 
            airports={INTERNATIONAL_AIRPORTS}
            mapCenter={mapCenter} // Pass the center state down to your custom component
            onSelectAirport={(airportId) => {
              const airport = INTERNATIONAL_AIRPORTS.find(a => a.id === airportId);
              
              if (airport) {
                // 1. Center the map
                setMapCenter({ lat: airport.latitude, lng: airport.longitude });
                
                // 2. Scroll the screen down to the selected airport's weather card
                if (cardRefs.current[airport.fmisid]) {
                  cardRefs.current[airport.fmisid]?.measure((x, y, width, height, pageX, pageY) => {
                    scrollViewRef.current?.scrollTo({ y: pageY - 80, animated: true });
                  });
                }
              }
            }}
          />
        </View>

        {INTERNATIONAL_AIRPORTS.map((airport) => (
          <View key={airport.id} ref={(el) => { cardRefs.current[airport.fmisid] = el; }}>
            {renderWeatherCard(`${airport.name} Airport`, weatherData[airport.fmisid])}
          </View>
        ))}

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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  },
  mapContainer: {
    height: 380, // We expanded this earlier!
    width: '100%',
    backgroundColor: '#e2e8f0',
  },
  cardContainer: {
    flex: 1,
    padding: 16,
  },
  
  mapContainer: {
    height: 380,
    borderRadius: 16,
    overflow: 'hidden',
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