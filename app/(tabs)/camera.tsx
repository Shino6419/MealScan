import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

export default function CameraScreen() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [selectedAt, setSelectedAt] = useState('');
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  function setReadyImage(image: ImagePicker.ImagePickerAsset) {
    setSelectedImage(image);
    setSelectedAt(new Date().toISOString());
  }

  function clearReadyImage() {
    setSelectedImage(null);
    setSelectedAt('');
  }

  async function handlePickImage() {
    setIsPickingImage(true);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setIsPickingImage(false);
      Alert.alert('Cần quyền truy cập ảnh', 'Vui lòng cho phép MealScan truy cập thư viện ảnh.');
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

    setReadyImage(result.assets[0]);
  }

  async function handleTakePhoto() {
    setIsTakingPhoto(true);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setIsTakingPhoto(false);
      Alert.alert('Cần quyền camera', 'Vui lòng cho phép MealScan sử dụng camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.9,
    });

    setIsTakingPhoto(false);

    if (result.canceled) {
      return;
    }

    setReadyImage(result.assets[0]);
  }

  function handleContinue() {
    if (!selectedImage) {
      Alert.alert('Chưa có ảnh', 'Hãy chọn ảnh món ăn từ thư viện trước.');
      return;
    }

    const imageUri = selectedImage.uri;
    const imageName = selectedImage.fileName ?? 'camera-food.jpg';
    const scannedAt = selectedAt || new Date().toISOString();

    clearReadyImage();

    router.push({
      pathname: '/meal-result',
      params: {
        imageUri,
        imageName,
        scannedAt,
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
            <Text style={styles.title}>Chụp ảnh</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="scan-outline" size={26} color="#14B8A6" />
          </View>
        </View>
        <Text style={styles.subtitle}>Chụp hoặc chọn ảnh món ăn để AI dự đoán calo.</Text>
      </View>

      <View style={styles.cameraPreview}>
        <View style={styles.previewTopBar}>
          <View style={styles.statusDot} />
          <Text style={styles.previewStatus}>
            {selectedImage ? 'Ảnh đã sẵn sàng' : 'AI food scan'}
          </Text>
        </View>
        {selectedImage ? (
          <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
        ) : (
          <View style={styles.scanFrame}>
            <Ionicons name="image-outline" size={48} color="#14B8A6" />
            <Text style={styles.previewTitle}>Chọn ảnh món ăn</Text>
            <Text style={styles.previewText}>
              Ảnh sẽ được cắt theo tỉ lệ vuông để phù hợp với model 224x224.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          disabled={!selectedImage}
          style={[styles.primaryButton, !selectedImage && styles.primaryButtonDisabled]}
          onPress={handleContinue}>
          <Ionicons name="sparkles-outline" size={20} color={selectedImage ? '#fff' : '#94A3B8'} />
          <Text style={[styles.primaryButtonText, !selectedImage && styles.primaryButtonTextDisabled]}>
            Tiếp tục xem kết quả
          </Text>
        </Pressable>

        <Pressable
          disabled={isTakingPhoto}
          style={[styles.secondaryButton, isTakingPhoto && styles.buttonDisabled]}
          onPress={handleTakePhoto}>
          {isTakingPhoto ? (
            <ActivityIndicator color="#14B8A6" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={20} color="#14B8A6" />
              <Text style={styles.secondaryButtonText}>Chụp từ camera</Text>
            </>
          )}
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
                {selectedImage ? 'Chọn ảnh khác' : 'Chọn ảnh từ thư viện'}
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
  primaryButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButtonTextDisabled: {
    color: '#94A3B8',
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
