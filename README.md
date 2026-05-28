# MealScan

MealScan la ung dung di dong xay dung tren Expo, tap trung vao viec ghi nhan bua an, quet/nhan dien mon an va goi y dinh duong dua tren muc tieu ca nhan. Du lieu dinh duong duoc su dung tu tap CSV trong thu muc assets, ket hop voi mo hinh TFLite de nhan dien thuc pham.

## Tinh nang chinh

- Quet/nhan dien mon an qua camera va mo hinh TFLite.
- Nhap bua an thu cong, xem chi tiet bua an.
- Ho so co the, muc tieu dinh duong ca nhan.
- Goi y bua an tu dong.

## Cai dat va chay ung dung

### 1) Cai dat phu thuoc

```bash
npm install
```

### 2) Chay ung dung

```bash
npx expo start
```

Trong output, ban co the mo ung dung bang:

- Expo Go (thu nghiem nhanh)
- Android emulator
- iOS simulator
- Development build

## Cau truc thu muc

- [app/](app/) - Man hinh va luong chinh (Expo Router).
- [components/](components/) - Thanh phan giao dien tai su dung.
- [utils/](utils/) - Xu ly nhan dien thuc pham, goi y, ket noi Supabase.
- [assets/](assets/) - Tap tin du lieu dinh duong, hinh anh, mo hinh.

## Ghi chu

- Neu can reset du an mau cua Expo, chay:

```bash
npm run reset-project
```
