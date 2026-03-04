import { View, Text, StyleSheet, Button, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useBleScanner } from '../src/features/devices/hooks/useBleScanner';
import { ZiproRaveAdapter } from '../src/services/ble/ZiproRaveAdapter';
import { StandardHrAdapter } from '../src/services/ble/StandardHrAdapter';

export default function HomeScreen() {
  const { devices, isScanning, error, scanForDevices, stopScanning } = useBleScanner();

  const handleConnect = async (deviceId: string, name: string | null) => {
    try {
      stopScanning();

      // Determine adapter based on name (very basic heuristic for the testing screen)
      if (
        name?.toLowerCase().includes('zipro') ||
        name?.toLowerCase().includes('bike') ||
        name?.toLowerCase().includes('ic')
      ) {
        const adapter = new ZiproRaveAdapter(deviceId);
        await adapter.connect();
        Alert.alert('Connected', `Connected to Bike: ${name}`);
      } else {
        const adapter = new StandardHrAdapter(deviceId);
        await adapter.connect();
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
});
