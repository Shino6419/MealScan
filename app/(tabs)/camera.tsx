import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

export default function CameraScreen() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);

  async function handlePickImage() {
    setIsPickingImage(true);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setIsPickingImage(false);
      Alert.alert('Can quyen truy cap anh', 'Vui long cho phep MealScan truy cap thu vien anh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.9,
    });

    setIsPickingImage(false);

    if (result.canceled) {
      return;
    }

    const image = result.assets[0];
    setSelectedImage(image);
  }

  function handleContinue() {
    if (!selectedImage) {
      Alert.alert('Chua co anh', 'Hay chon anh mon an tu thu vien truoc.');
      return;
    }

    router.push({
      pathname: '/meal-result',
      params: {
        imageUri: selectedImage.uri,
        imageName: selectedImage.fileName ?? 'selected-food.jpg',
      },
    });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerStripe} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.kicker}>AI scan</Text>
            <Text style={styles.title}>Chup anh</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="scan-outline" size={26} color="#14B8A6" />
          </View>
        </View>
        <Text style={styles.subtitle}>Chup hoac chon anh mon an de AI du doan calo.</Text>
      </View>

      <View style={styles.cameraPreview}>
        <View style={styles.previewTopBar}>
          <View style={styles.statusDot} />
          <Text style={styles.previewStatus}>
            {selectedImage ? 'Anh da san sang' : 'AI food scan'}
          </Text>
        </View>
        {selectedImage ? (
          <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
        ) : (
          <View style={styles.scanFrame}>
            <Ionicons name="image-outline" size={48} color="#14B8A6" />
            <Text style={styles.previewTitle}>Chon anh mon an</Text>
            <Text style={styles.previewText}>
              Anh se duoc cat theo ti le vuong de phu hop voi model 224x224.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={handleContinue}>
          <Ionicons name="sparkles-outline" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Tiep tuc xem ket qua</Text>
        </Pressable>

        <Pressable
          disabled={isPickingImage}
          style={[styles.secondaryButton, isPickingImage && styles.buttonDisabled]}
          onPress={handlePickImage}>
          {isPickingImage ? (
            <ActivityIndicator color="#14B8A6" />
          ) : (
            <>
              <Ionicons name="image-outline" size={20} color="#14B8A6" />
              <Text style={styles.secondaryButtonText}>
                {selectedImage ? 'Chon anh khac' : 'Chon anh tu thu vien'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F0FDFA',
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 22,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  headerStripe: {
    backgroundColor: '#38BDF8',
    height: 5,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  kicker: {
    color: '#14B8A6',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  title: {
    color: '#0F172A',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  cameraPreview: {
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 5,
  },
  previewTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusDot: {
    backgroundColor: '#14B8A6',
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  previewStatus: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  scanFrame: {
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderColor: '#38BDF8',
    borderRadius: 8,
    borderWidth: 2,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  selectedImage: {
    borderRadius: 8,
    flex: 1,
    width: '100%',
  },
  previewTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  previewText: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    marginTop: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#14B8A6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  secondaryButtonText: {
    color: '#14B8A6',
    fontSize: 16,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.72,
  },
});
