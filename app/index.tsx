import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const VIEL_CHAT_URL = 'http://localhost:3000';

export default function HomeScreen() {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe src={VIEL_CHAT_URL} style={styles.iframe} title="Viel Chat" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView source={{ uri: VIEL_CHAT_URL }} style={styles.webview} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  iframe: {
    borderWidth: 0,
    flex: 1,
    width: '100%',
  },
});
