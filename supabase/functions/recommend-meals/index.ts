import { createClient } from 'npm:@supabase/supabase-js@2';

type ProfileGoals = {
  carbs_goal_g: number | null;
  daily_calorie_goal: number | null;
  fat_goal_g: number | null;
  fitness_goal: string | null;
  protein_goal_g: number | null;
  timezone: string | null;
};

type Meal = {
  calories: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  food_name: string;
  protein_g: number | null;
};

type RecommendedFood = {
  calories: number;
  carbs_g: number;
  diet_tags: string | null;
  fat_g: number;
  food_name: string;
  meal_tags: string | null;
  protein_g: number;
  serving: string;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function formatDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).format(date);
}

function getCurrentMealType(timeZone: string) {
  const hourText = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date());
  const hour = Number(hourText);

  if (hour >= 4 && hour < 10) {
    return 'breakfast';
  }

  if (hour >= 10 && hour < 14) {
    return 'lunch';
  }

  if (hour >= 14 && hour < 18) {
    return 'afternoon';
  }

  return 'dinner';
}

function detectRequestedMealType(text: string, timeZone: string) {
  const normalized = text.toLowerCase();

  if (normalized.includes('sáng') || normalized.includes('breakfast')) {
    return 'breakfast';
  }

  if (normalized.includes('trưa') || normalized.includes('lunch')) {
    return 'lunch';
  }

  if (normalized.includes('chiều') || normalized.includes('xế') || normalized.includes('snack')) {
    return 'afternoon';
  }

  if (normalized.includes('tối') || normalized.includes('dinner')) {
    return 'dinner';
  }

  return getCurrentMealType(timeZone);
}

function getMacroCalories(food: Pick<RecommendedFood, 'carbs_g' | 'fat_g' | 'protein_g'>) {
  return food.protein_g * 4 + food.carbs_g * 4 + food.fat_g * 9;
}

function isNutritionReasonable(food: RecommendedFood) {
  const macroCalories = getMacroCalories(food);

  return macroCalories <= food.calories * 1.45 + 80;
}

function getTags(value: string | null) {
  return (value ?? '').split('|').filter(Boolean);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function detectFoodKeywords(message: string) {
  const normalized = normalizeText(message);
  const keywords = [
    'banh mi',
    'banh canh',
    'banh xeo',
    'banh cuon',
    'bun',
    'chao',
    'com',
    'goi',
    'hu tieu',
    'lau',
    'mi',
    'pho',
    'sup',
    'tom',
    'trung',
  ];

  return keywords.filter((keyword) => normalized.includes(keyword));
}

function getFoodGroup(foodName: string) {
  const normalizedName = normalizeText(foodName);
  const groups = [
    'banh mi',
    'banh canh',
    'banh xeo',
    'banh cuon',
    'bun',
    'chao',
    'com',
    'goi',
    'hu tieu',
    'lau',
    'mi',
    'pho',
    'sup',
    'tom',
    'trung',
    'cua',
    'ca',
    'ga',
    'bo',
  ];

  return groups.find((group) => normalizedName.includes(group)) ?? normalizedName.split(' ')[0] ?? normalizedName;
}

function getFitnessGoalDietTags(goal: string | null | undefined) {
  if (goal === 'weight_loss') {
    return ['low_calorie', 'low_fat', 'high_protein'];
  }

  if (goal === 'muscle_gain') {
    return ['high_protein', 'balanced'];
  }

  if (goal === 'weight_gain') {
    return ['high_calorie', 'high_protein', 'high_carb', 'balanced'];
  }

  return ['balanced'];
}

function explainTagReason(food: RecommendedFood, preferredTags: string[]) {
  const tags = getTags(food.diet_tags);
  const matchedTags = preferredTags.filter((tag) => tags.includes(tag));

  if (matchedTags.includes('high_protein')) {
    return 'giàu protein, hợp mục tiêu bổ sung đạm';
  }

  if (matchedTags.includes('low_calorie')) {
    return 'ít calo, dễ kiểm soát năng lượng';
  }

  if (matchedTags.includes('high_carb')) {
    return 'bổ sung carb tốt cho phần năng lượng còn thiếu';
  }

  if (matchedTags.includes('low_fat')) {
    return 'ít fat, hợp khi cần giữ bữa nhẹ';
  }

  if (matchedTags.includes('balanced') || tags.includes('balanced')) {
    return 'khá cân bằng cho bữa này';
  }

  return 'phù hợp với khung bữa và phần macro còn lại';
}

function shuffleFoods<T>(items: T[]) {
  const shuffledItems = items.slice();

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledItems[index], shuffledItems[randomIndex]] = [shuffledItems[randomIndex], shuffledItems[index]];
  }

  return shuffledItems;
}

function pickDiverseFoods(items: RecommendedFood[], limit: number, maxPerGroup = 2) {
  const pickedFoods: RecommendedFood[] = [];
  const groupCounts = new Map<string, number>();

  for (const food of items) {
    const group = getFoodGroup(food.food_name);
    const count = groupCounts.get(group) ?? 0;

    if (count >= maxPerGroup) {
      continue;
    }

    pickedFoods.push(food);
    groupCounts.set(group, count + 1);

    if (pickedFoods.length >= limit) {
      return pickedFoods;
    }
  }

  for (const food of items) {
    if (!pickedFoods.some((pickedFood) => pickedFood.food_name === food.food_name && pickedFood.serving === food.serving)) {
      pickedFoods.push(food);
    }

    if (pickedFoods.length >= limit) {
      break;
    }
  }

  return pickedFoods;
}

function pickCandidateFoods(
  message: string,
  foods: RecommendedFood[],
  remaining: { calories: number; carbs: number | null; fat: number | null; protein: number | null },
  mealType: string,
  fitnessGoal: string | null | undefined,
) {
  const normalized = message.toLowerCase();
  const foodKeywords = detectFoodKeywords(message);
  const wantsLowCalorie = normalized.includes('ít calo') || normalized.includes('giảm cân');
  const wantsProtein = normalized.includes('protein') || normalized.includes('tăng cơ');
  const wantsCarb = normalized.includes('carb');
  const wantsLowFat = normalized.includes('ít béo') || normalized.includes('low fat');
  const calorieLimit = remaining.calories > 0 ? Math.max(Math.min(remaining.calories + 100, 900), 180) : 450;
  const calorieTarget = Math.max(Math.min((remaining.calories || 1500) * 0.3, 620), 260);
  const preferredTags = getFitnessGoalDietTags(fitnessGoal);
  const needTags = [
    ...preferredTags,
    ...(wantsLowCalorie ? ['low_calorie', 'low_fat'] : []),
    ...(wantsProtein || (remaining.protein ?? 0) > 20 ? ['high_protein'] : []),
    ...(wantsCarb || (remaining.carbs ?? 0) > 45 ? ['high_carb', 'balanced'] : []),
    ...(wantsLowFat || (remaining.fat ?? 0) < 12 ? ['low_fat'] : []),
  ];
  const mealMatchedFoods = foods.filter((food) => getTags(food.meal_tags).includes(mealType));
  const foodPool = mealMatchedFoods.length >= 5 ? mealMatchedFoods : foods;
  const keywordMatchedFoods = foodKeywords.length > 0
    ? foodPool.filter((food) => {
        const normalizedName = normalizeText(food.food_name);
        return foodKeywords.some((keyword) => normalizedName.includes(keyword));
      })
    : [];
  const finalFoodPool = keywordMatchedFoods.length > 0 ? keywordMatchedFoods : foodPool;

  const rankedFoods = finalFoodPool
    .filter(isNutritionReasonable)
    .filter((food) => food.calories <= calorieLimit)
    .map((food) => {
      let score = 100;
      const dietTags = getTags(food.diet_tags);
      const mealTags = getTags(food.meal_tags);
      const normalizedName = normalizeText(food.food_name);
      score -= Math.abs(food.calories - calorieTarget) / 12;
      score -= Math.max(food.fat_g - (remaining.fat ?? 25), 0) * 2.5;
      score -= Math.max(food.carbs_g - (remaining.carbs ?? 70), 0) * 0.8;
      score += needTags.filter((tag) => dietTags.includes(tag)).length * 18;

      if (wantsLowCalorie) {
        score -= food.calories / 14;
      }

      if (wantsProtein || (remaining.protein ?? 0) > 20) {
        score += food.protein_g * 2.3;
      }

      if (wantsCarb || (remaining.carbs ?? 0) > 45) {
        score += food.carbs_g * 0.45;
      }

      if (wantsLowFat || (remaining.fat ?? 0) < 12) {
        score -= food.fat_g * 1.4;
      }

      if (dietTags.includes('balanced')) {
        score += 12;
      }

      if (mealTags.includes(mealType)) {
        score += 35;
      }

      if (foodKeywords.some((keyword) => normalizedName.includes(keyword))) {
        score += 80;
      }

      return { food, score };
    })
    .sort((first, second) => second.score - first.score);
  const strongCandidateCount = Math.min(90, rankedFoods.length);
  const strongCandidates = rankedFoods.slice(0, strongCandidateCount).map((item) => item.food);
  const guaranteedTopCandidates = pickDiverseFoods(strongCandidates, 6, 1);
  const randomPool = shuffleFoods(
    strongCandidates.filter(
      (food) =>
        !guaranteedTopCandidates.some(
          (topFood) => topFood.food_name === food.food_name && topFood.serving === food.serving,
        ),
    ),
  );
  const randomCandidates = pickDiverseFoods(randomPool, 24, 2);

  return [...guaranteedTopCandidates, ...randomCandidates].slice(0, 30);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const preferredGeminiModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
  const authorization = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Missing Supabase environment variables.' }, 500);
  }

  if (!geminiKey) {
    return jsonResponse({ error: 'Missing GEMINI_API_KEY secret.' }, 500);
  }

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!message) {
    return jsonResponse({ error: 'Message is required.' }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  if (authError || !userId) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('daily_calorie_goal, protein_goal_g, fat_goal_g, carbs_goal_g, fitness_goal, timezone')
    .eq('id', userId)
    .maybeSingle<ProfileGoals>();

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 400);
  }

  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh';
  const todayKey = formatDateKey(new Date(), timeZone);
  const [{ data: meals, error: mealsError }, { data: foods, error: foodsError }] = await Promise.all([
    supabase
      .from('meals')
      .select('food_name, calories, protein_g, fat_g, carbs_g')
      .eq('user_id', userId)
      .eq('meal_date', todayKey)
      .returns<Meal[]>(),
    supabase
      .from('recommended_foods')
      .select('food_name, serving, calories, protein_g, fat_g, carbs_g, meal_tags, diet_tags')
      .eq('is_active', true)
      .order('calories', { ascending: true })
      .limit(300)
      .returns<RecommendedFood[]>(),
  ]);

  if (mealsError) {
    return jsonResponse({ error: mealsError.message }, 400);
  }

  if (foodsError) {
    return jsonResponse({ error: foodsError.message }, 400);
  }

  const totals = (meals ?? []).reduce(
    (current, meal) => ({
      calories: current.calories + (meal.calories ?? 0),
      carbs: current.carbs + (meal.carbs_g ?? 0),
      fat: current.fat + (meal.fat_g ?? 0),
      protein: current.protein + (meal.protein_g ?? 0),
    }),
    { calories: 0, carbs: 0, fat: 0, protein: 0 },
  );
  const goals = {
    calories: profile?.daily_calorie_goal ?? 2000,
    carbs: profile?.carbs_goal_g ?? null,
    fat: profile?.fat_goal_g ?? null,
    protein: profile?.protein_goal_g ?? null,
  };
  const remaining = {
    calories: Math.max(goals.calories - totals.calories, 0),
    carbs: goals.carbs == null ? null : Math.max(Math.round(goals.carbs - totals.carbs), 0),
    fat: goals.fat == null ? null : Math.max(Math.round(goals.fat - totals.fat), 0),
    protein: goals.protein == null ? null : Math.max(Math.round(goals.protein - totals.protein), 0),
  };
  const requestedMealType = detectRequestedMealType(message, timeZone);
  const candidates = pickCandidateFoods(message, foods ?? [], remaining, requestedMealType, profile?.fitness_goal);
  const candidatesForGemini = candidates.map((food) => ({
    ...food,
    food_group: getFoodGroup(food.food_name),
  }));
  const preferredDietTags = getFitnessGoalDietTags(profile?.fitness_goal);

  if (candidates.length === 0) {
    return jsonResponse({
      reply: 'Mình chưa tìm thấy món phù hợp trong bảng recommended_foods. Bạn hãy kiểm tra dữ liệu món ăn đã được import chưa.',
      remaining,
      suggestions: [],
    });
  }

  const geminiPrompt = [
    'Bạn là trợ lý dinh dưỡng của app MealScan.',
    'Chỉ đề xuất món có trong candidates, không bịa món mới.',
    'Đừng chỉ lặp lại danh sách: hãy chọn món hợp lý theo bữa ăn, calo còn lại, macro còn thiếu và mục tiêu người dùng.',
    'Nếu dữ liệu món có vẻ chưa cân đối, ưu tiên món cân bằng hơn.',
    'Trả lời bằng tiếng Việt, ngắn gọn, thực tế, nhưng phải viết thành câu hoàn chỉnh.',
    'Không dùng Markdown, không in chữ đậm, không dùng dấu **.',
    'Bắt buộc nêu đúng 3 món nếu candidates có ít nhất 3 món.',
    'Nếu candidates có đủ nhóm food_group khác nhau, bắt buộc chọn 3 món thuộc 3 food_group khác nhau. Không chọn 3 món cùng nhóm như toàn gỏi, toàn cháo hoặc toàn tôm.',
    'Mỗi món viết trên một dòng theo mẫu: 1. Tên món (khẩu phần): kcal, P xg, F xg, C xg - lý do ngắn.',
    'Kết thúc bằng một câu chốt ngắn.',
    'Không đưa lời khuyên y tế.',
    '',
    JSON.stringify({
      candidates: candidatesForGemini,
      preferred_diet_tags: preferredDietTags,
      fitness_goal: profile?.fitness_goal,
      goals,
      meals_today: meals ?? [],
      remaining,
      request: message,
      requested_meal_type: requestedMealType,
      totals,
    }),
  ].join('\n');
  const geminiRequestBody = {
      contents: [
        {
          parts: [{ text: geminiPrompt }],
          role: 'user',
        },
      ],
      generationConfig: {
        maxOutputTokens: 900,
        temperature: 0.55,
      },
    };
  const modelCandidates = Array.from(
    new Set([
      preferredGeminiModel,
      'gemini-2.0-flash',
      'gemini-2.0-flash-001',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]),
  );
  let usedModel = modelCandidates[0];
  let geminiBody: Record<string, any> = {};
  let geminiError = '';

  for (const model of modelCandidates) {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        body: JSON.stringify(geminiRequestBody),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );

    geminiBody = await geminiResponse.json().catch(() => ({}));

    if (geminiResponse.ok) {
      usedModel = model;
      geminiError = '';
      break;
    }

    geminiError = geminiBody?.error?.message ?? `Gemini request failed with status ${geminiResponse.status}.`;
  }

  if (geminiError) {
    return jsonResponse(
      {
        error: 'Gemini request failed.',
        message: geminiError,
        tried_models: modelCandidates,
      },
      502,
    );
  }

  const reply =
    geminiBody?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .filter(Boolean)
      .join('\n')
      .trim() || 'Mình đã tìm được vài món phù hợp, nhưng chưa đọc được phản hồi từ Gemini.';
  const numberedLineCount = reply.split('\n').filter((line: string) => /^\s*\d+\./.test(line)).length;
  const hasIncompleteMarkdown = /\*\*[^*\n]*$/.test(reply) || /\*\*$/.test(reply.trim());
  const finalReply =
    numberedLineCount >= Math.min(candidates.length, 2) && !hasIncompleteMarkdown
      ? reply
      : [
          `Mình chọn ${Math.min(candidates.length, 3)} món phù hợp nhất từ dữ liệu hiện có:`,
          ...candidates.slice(0, 3).map(
            (food, index) =>
              `${index + 1}. ${food.food_name} (${food.serving}): ${food.calories} kcal, P ${food.protein_g}g, F ${food.fat_g}g, C ${food.carbs_g}g - ${explainTagReason(food, preferredDietTags)}.`,
          ),
          'Bạn có thể chọn món đầu tiên nếu muốn ưu tiên nhanh và dễ ăn.',
        ].join('\n');

  return jsonResponse({
    model: usedModel,
    remaining,
    reply: finalReply,
    suggestions: candidates.slice(0, 3),
    totals,
  });
});
