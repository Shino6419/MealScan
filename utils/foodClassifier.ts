import { toByteArray } from 'base64-js';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import type { TfliteModel } from 'react-native-fast-tflite';

const MODEL_SIZE = 224;
const MODEL_INPUT_SIZE = MODEL_SIZE * MODEL_SIZE * 3;

export const FOOD_CALORIE_REFERENCES = [
  { label: 'Banh beo', calories: 45, serving: '1 cai' },
  { label: 'Banh bot loc', calories: 45, serving: '1 cai' },
  { label: 'Banh can', calories: 60, serving: '1 cai' },
  { label: 'Banh canh', calories: 450, serving: '1 to' },
  { label: 'Banh chung', calories: 500, serving: '1 mieng' },
  { label: 'Banh cuon', calories: 440, serving: '1 phan' },
  { label: 'Banh duc', calories: 300, serving: '1 phan' },
  { label: 'Banh gio', calories: 445, serving: '1 cai' },
  { label: 'Banh khot', calories: 75, serving: '1 cai' },
  { label: 'Banh mi', calories: 450, serving: '1 cai' },
  { label: 'Banh pia', calories: 400, serving: '1 cai' },
  { label: 'Banh tet', calories: 440, serving: '1 khoanh' },
  { label: 'Banh trang nuong', calories: 380, serving: '1 cai' },
  { label: 'Banh xeo', calories: 570, serving: '1 cai' },
  { label: 'Bun bo Hue', calories: 650, serving: '1 to' },
  { label: 'Bun dau mam tom', calories: 700, serving: '1 phan' },
  { label: 'Bun mam', calories: 600, serving: '1 to' },
  { label: 'Bun rieu', calories: 530, serving: '1 to' },
  { label: 'Bun thit nuong', calories: 520, serving: '1 phan' },
  { label: 'Ca kho to', calories: 300, serving: '1 phan' },
  { label: 'Canh chua', calories: 180, serving: '1 phan' },
  { label: 'Cao lau', calories: 550, serving: '1 to' },
  { label: 'Chao long', calories: 420, serving: '1 to' },
  { label: 'Com tam', calories: 650, serving: '1 phan' },
  { label: 'Goi cuon', calories: 95, serving: '1 cuon' },
  { label: 'Hu tieu', calories: 520, serving: '1 to' },
  { label: 'Mi quang', calories: 415, serving: '1 to' },
  { label: 'Nem chua', calories: 40, serving: '1 cai' },
  { label: 'Pho', calories: 480, serving: '1 to' },
  { label: 'Xoi xeo', calories: 600, serving: '1 phan' },
] as const;

const LABELS = FOOD_CALORIE_REFERENCES.map((item) => item.label);
const CALORIES_BY_LABEL = Object.fromEntries(
  FOOD_CALORIE_REFERENCES.map((item) => [item.label, item.calories]),
);

export type FoodPrediction = {
  calories: number;
  confidence: number;
  label: string;
};

let cachedModel: TfliteModel | null = null;

async function getModel() {
  if (!cachedModel) {
    const { loadTensorflowModel } = await import('react-native-fast-tflite');
    cachedModel = await loadTensorflowModel(require('../assets/models/best_int8.tflite'), []);
  }

  return cachedModel;
}

function softmax(values: number[]) {
  const maxValue = Math.max(...values);
  const expValues = values.map((value) => Math.exp(value - maxValue));
  const sum = expValues.reduce((total, value) => total + value, 0);
  return expValues.map((value) => value / sum);
}

function getTensorValues(buffer: ArrayBuffer, dataType: TfliteModel['outputs'][number]['dataType']) {
  if (dataType === 'float32') {
    return Array.from(new Float32Array(buffer));
  }

  if (dataType === 'int8') {
    return Array.from(new Int8Array(buffer));
  }

  if (dataType === 'uint8') {
    return Array.from(new Uint8Array(buffer));
  }

  return Array.from(new Float32Array(buffer));
}

async function imageToInputTensor(imageUri: string, model: TfliteModel) {
  const resizedImage = await manipulateAsync(
    imageUri,
    [{ resize: { width: MODEL_SIZE, height: MODEL_SIZE } }],
    {
      base64: true,
      compress: 1,
      format: SaveFormat.JPEG,
    },
  );

  if (!resizedImage.base64) {
    throw new Error('Khong doc duoc du lieu anh.');
  }

  const jpegBytes = toByteArray(resizedImage.base64);
  const rawImage = jpeg.decode(jpegBytes, { useTArray: true });
  const inputType = model.inputs[0]?.dataType ?? 'uint8';

  if (inputType === 'float32') {
    const input = new Float32Array(MODEL_INPUT_SIZE);
    for (let i = 0, j = 0; i < rawImage.data.length; i += 4, j += 3) {
      input[j] = rawImage.data[i] / 255;
      input[j + 1] = rawImage.data[i + 1] / 255;
      input[j + 2] = rawImage.data[i + 2] / 255;
    }
    return input.buffer;
  }

  if (inputType === 'int8') {
    const input = new Int8Array(MODEL_INPUT_SIZE);
    for (let i = 0, j = 0; i < rawImage.data.length; i += 4, j += 3) {
      input[j] = rawImage.data[i] - 128;
      input[j + 1] = rawImage.data[i + 1] - 128;
      input[j + 2] = rawImage.data[i + 2] - 128;
    }
    return input.buffer;
  }

  const input = new Uint8Array(MODEL_INPUT_SIZE);
  for (let i = 0, j = 0; i < rawImage.data.length; i += 4, j += 3) {
    input[j] = rawImage.data[i];
    input[j + 1] = rawImage.data[i + 1];
    input[j + 2] = rawImage.data[i + 2];
  }

  return input.buffer;
}

export async function classifyFoodImage(imageUri: string): Promise<FoodPrediction> {
  const model = await getModel();
  const input = await imageToInputTensor(imageUri, model);
  const outputs = await model.run([input]);
  const outputType = model.outputs[0]?.dataType ?? 'float32';
  const logits = getTensorValues(outputs[0], outputType).slice(0, LABELS.length);
  const probabilities = outputType === 'float32' ? softmax(logits) : softmax(logits);

  let bestIndex = 0;
  for (let index = 1; index < probabilities.length; index += 1) {
    if (probabilities[index] > probabilities[bestIndex]) {
      bestIndex = index;
    }
  }

  const label = LABELS[bestIndex];

  return {
    calories: CALORIES_BY_LABEL[label],
    confidence: probabilities[bestIndex],
    label,
  };
}
