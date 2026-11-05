/** Print / share-as-PDF for any of the app's printable HTML documents. */
import { Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

export async function printHtml(html: string) {
  try {
    await Print.printAsync({ html });
  } catch (e) {
    Alert.alert('Could not print', (e as Error).message);
  }
}

export async function shareHtmlAsPdf(html: string, title: string) {
  try {
    const { uri: tmp } = await Print.printToFileAsync({ html });
    // print gives a random name; whoever receives it should see what it is
    const named = new File(Paths.cache, `${title.replace(/[^\w.-]+/g, '-')}.pdf`);
    if (named.exists) named.delete();
    new File(tmp).move(named);
    const uri = named.uri;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
    } else {
      Alert.alert('Saved', uri);
    }
  } catch (e) {
    Alert.alert('Could not share', (e as Error).message);
  }
}
