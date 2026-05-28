import { toByteArray } from 'base64-js';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import type { TfliteModel } from 'react-native-fast-tflite';

const MODEL_SIZE = 224;
const MODEL_INPUT_SIZE = MODEL_SIZE * MODEL_SIZE * 3;

export const FOOD_CALORIE_REFERENCES = [
  { label: 'Bánh bèo', calories: 358, protein: 4, fat: 8, carbs: 45, serving: '1 đĩa' },
  { label: 'Bánh bột lọc', calories: 487, protein: 3, fat: 5, carbs: 35, serving: '1 đĩa' },
  { label: 'Bánh căn', calories: 250, protein: 8, fat: 10, carbs: 35, serving: '1 phần' },
  { label: 'Bánh canh giò heo', calories: 483, protein: 20, fat: 15, carbs: 45, serving: '1 tô' },
  { label: 'Bánh chưng', calories: 407, protein: 3, fat: 12, carbs: 40, serving: '1 cái' },
  { label: 'Bánh cuốn', calories: 590, protein: 5, fat: 8, carbs: 45, serving: '1 đĩa' },
  { label: 'Bánh đúc', calories: 220, protein: 4, fat: 8, carbs: 35, serving: '1 phần' },
  { label: 'Bánh giò', calories: 280, protein: 8, fat: 10, carbs: 40, serving: '1 cái' },
  { label: 'Bánh khọt', calories: 154, protein: 6, fat: 15, carbs: 30, serving: '1 đĩa 5 cái' },
  { label: 'Bánh mì thịt', calories: 461, protein: 20, fat: 15, carbs: 55, serving: '1 ổ' },
  { label: 'Bánh pía', calories: 500, protein: 10, fat: 20, carbs: 75, serving: '1 phần' },
  { label: 'Bánh tét', calories: 350, protein: 10, fat: 10, carbs: 60, serving: '1 phần' },
  { label: 'Bánh tráng nướng', calories: 300, protein: 5, fat: 16.3, carbs: 32.5, serving: '1 phần' },
  { label: 'Bánh xèo', calories: 517, protein: 8.4, fat: 16.7, carbs: 41.6, serving: '1 cái' },
  { label: 'Bún bò huế', calories: 479, protein: 25, fat: 15, carbs: 50, serving: '1 tô' },
  { label: 'Bún đậu mắm tôm', calories: 700, protein: 20, fat: 22, carbs: 75, serving: '1 phần' },
  { label: 'Bún mắm', calories: 480, protein: 20, fat: 12, carbs: 45, serving: '1 tô' },
  { label: 'Bún riêu', calories: 482, protein: 20, fat: 10, carbs: 45, serving: '1 tô' },
  { label: 'Bún thịt nướng', calories: 451, protein: 18, fat: 15, carbs: 45, serving: '1 tô' },
  { label: 'Cá kho tộ', calories: 350, protein: 40, fat: 15, carbs: 10, serving: '1 phần' },
  { label: 'Canh chua', calories: 37, protein: 6, fat: 5, carbs: 10, serving: '1 tô' },
  { label: 'Cao lầu', calories: 350, protein: 15, fat: 10, carbs: 55, serving: '1 phần' },
  { label: 'Cháo lòng', calories: 412, protein: 10, fat: 12, carbs: 30, serving: '1 tô' },
  { label: 'Cơm tấm sườn', calories: 527, protein: 15, fat: 20, carbs: 55, serving: '1 đĩa cơm phần' },
  { label: 'Gỏi cuốn', calories: 200, protein: 10, fat: 5, carbs: 30, serving: '1 phần' },
  { label: 'Hủ tíu Nam vang', calories: 400, protein: 22, fat: 10, carbs: 45, serving: '1 tô' },
  { label: 'Mì quảng', calories: 541, protein: 20, fat: 10, carbs: 50, serving: '1 tô' },
  { label: 'Nem chua', calories: 40, protein: 3, fat: 1, carbs: 3, serving: '1 cái' },
  { label: 'Phở bò tái', calories: 431, protein: 25, fat: 8, carbs: 45, serving: '1 tô' },
  { label: 'Xôi xéo', calories: 400, protein: 10, fat: 15, carbs: 65, serving: '1 phần' },
] as const;

const LABELS = FOOD_CALORIE_REFERENCES.map((item) => item.label);
const CALORIES_BY_LABEL = Object.fromEntries(
  FOOD_CALORIE_REFERENCES.map((item) => [item.label, item.calories]),
);

export type FoodPrediction = {
  carbs: number;
  calories: number;
  confidence: number;
  fat: number;
  label: string;
  protein: number;
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
  const nutrition = FOOD_CALORIE_REFERENCES[bestIndex];

  return {
    carbs: nutrition.carbs,
    calories: CALORIES_BY_LABEL[label],
    confidence: probabilities[bestIndex],
    fat: nutrition.fat,
    label,
    protein: nutrition.protein,
  };
}
