import { View, Text, StyleSheet, Button, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useBleScanner } from '../src/features/devices/hooks/useBleScanner';

import { useTrainingSession } from '../src/features/training/hooks/useTrainingSession';
import { useDeviceConnection } from '../src/features/training/hooks/useDeviceConnection';

function DashboardPreview() {
  const session = useTrainingSession();

  return (
    <View style={styles.dashboardPreview}>
      <Text style={styles.dashboardTitle}>Live Store Data</Text>
      <Text style={styles.dashboardText}>Phase: {session.phase}</Text>
      <Text style={styles.dashboardText}>Time: {session.elapsedSeconds} sec</Text>
      <Text style={styles.dashboardText}>Distance: {(session.totalDistance / 1000).toFixed(2)} km</Text>
      <Text style={styles.dashboardText}>Speed: {session.currentMetrics.speed.toFixed(1)} km/h</Text>
      <Text style={styles.dashboardText}>Resistance (Level): {session.currentMetrics.resistance ?? '--'}</Text>
      <Text style={styles.dashboardText}>Power: {session.currentMetrics.power} W</Text>
      <Text style={styles.dashboardText}>HR: {session.currentMetrics.heartRate ?? '--'} bpm</Text>
      <Text style={styles.dashboardText}>Calories: {session.totalCalories.toFixed(1)} kcal</Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        {session.phase === 'idle' && <Button title="Start" onPress={session.start} color="#4CAF50" />}
        {session.phase === 'active' && <Button title="Pause" onPress={session.pause} color="#FF9800" />}
        {session.phase === 'paused' && <Button title="Resume" onPress={session.resume} color="#2196F3" />}
        {session.phase !== 'idle' && session.phase !== 'finished' && (
          <Button title="Finish" onPress={session.finish} color="#F44336" />
        )}
        <Button title="Reset" onPress={session.reset} color="#9E9E9E" />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { devices, isScanning, error, scanForDevices, stopScanning } = useBleScanner();
  const { connectBike, connectHr } = useDeviceConnection();

  const handleConnect = async (deviceId: string, name: string | null) => {
    try {
      stopScanning();

      // Determine adapter based on name (very basic heuristic for the testing screen)
      if (
        name?.toLowerCase().includes('zipro') ||
        name?.toLowerCase().includes('rave') ||
        name?.toLowerCase().includes('bike') ||
        name?.toLowerCase().includes('ic')
      ) {
        await connectBike(deviceId);
        Alert.alert('Connected', `Connected to Bike: ${name}`);
      } else {
        await connectHr(deviceId);
        Alert.alert('Connected', `Connected to HR Monitor: ${name}`);
      }
    } catch (err: unknown) {
      console.error('Connection error:', err);
      Alert.alert('Connection Failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Omni Bike - Device Test</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.controls}>
        <Button title={isScanning ? 'Stop Scan' : 'Start Scan'} onPress={isScanning ? stopScanning : scanForDevices} />
      </View>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.deviceItem} onPress={() => handleConnect(item.id, item.name)}>
            <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
            <Text style={styles.deviceId}>{item.id}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No devices found</Text>}
      />

      <DashboardPreview />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 40,
  },
  controls: {
    marginBottom: 20,
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
  deviceItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
    borderRadius: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
  },
  empty: {
    textAlign: 'center',
    marginTop: 20,
    color: '#999',
  },
  dashboardPreview: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  dashboardTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dashboardText: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: 'Courier',
    marginBottom: 5,
  },
});
