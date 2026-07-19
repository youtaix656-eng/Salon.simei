// ボディチャートの部位定義。
// SVG上のタップ領域と日本語ラベルをセットで持つ（背面ビューは施術の中心なので細かめ）。
// 背面ビューは向かい合わせではなく「うつ伏せを上から見た」向き＝画像の左がお客様の右。

export const BODY_ZONES = [
  // ---- 背面 ----
  { id: 'back-head', view: 'back', label: '頭', shape: { type: 'circle', cx: 60, cy: 20, r: 13 } },
  { id: 'back-neck', view: 'back', label: '首', shape: { type: 'rect', x: 52, y: 34, w: 16, h: 10 } },
  { id: 'shoulder-r', view: 'back', label: '右肩', shape: { type: 'rect', x: 26, y: 46, w: 31, h: 12 } },
  { id: 'shoulder-l', view: 'back', label: '左肩', shape: { type: 'rect', x: 63, y: 46, w: 31, h: 12 } },
  { id: 'scapula-r', view: 'back', label: '右肩甲骨', shape: { type: 'rect', x: 38, y: 60, w: 20, h: 20 } },
  { id: 'scapula-l', view: 'back', label: '左肩甲骨', shape: { type: 'rect', x: 62, y: 60, w: 20, h: 20 } },
  { id: 'arm-r', view: 'back', label: '右腕', shape: { type: 'rect', x: 14, y: 60, w: 12, h: 52 } },
  { id: 'arm-l', view: 'back', label: '左腕', shape: { type: 'rect', x: 94, y: 60, w: 12, h: 52 } },
  { id: 'back-mid', view: 'back', label: '背中', shape: { type: 'rect', x: 44, y: 82, w: 32, h: 20 } },
  { id: 'lower-back', view: 'back', label: '腰', shape: { type: 'rect', x: 42, y: 104, w: 36, h: 18 } },
  { id: 'hip', view: 'back', label: 'お尻', shape: { type: 'rect', x: 40, y: 124, w: 40, h: 20 } },
  { id: 'ham-r', view: 'back', label: '右もも裏', shape: { type: 'rect', x: 41, y: 146, w: 17, h: 32 } },
  { id: 'ham-l', view: 'back', label: '左もも裏', shape: { type: 'rect', x: 62, y: 146, w: 17, h: 32 } },
  { id: 'calf-r', view: 'back', label: '右ふくらはぎ', shape: { type: 'rect', x: 42, y: 180, w: 15, h: 32 } },
  { id: 'calf-l', view: 'back', label: '左ふくらはぎ', shape: { type: 'rect', x: 63, y: 180, w: 15, h: 32 } },
  { id: 'sole', view: 'back', label: '足裏', shape: { type: 'rect', x: 42, y: 214, w: 36, h: 12 } },
  // ---- 前面 ----
  { id: 'front-head', view: 'front', label: '頭・顔まわり', shape: { type: 'circle', cx: 60, cy: 20, r: 13 } },
  { id: 'front-neck', view: 'front', label: '首・デコルテ', shape: { type: 'rect', x: 48, y: 36, w: 24, h: 12 } },
  { id: 'front-abdomen', view: 'front', label: 'お腹', shape: { type: 'rect', x: 44, y: 50, w: 32, h: 42 } },
  { id: 'front-pelvis', view: 'front', label: '股関節まわり', shape: { type: 'rect', x: 42, y: 94, w: 36, h: 24 } },
  { id: 'front-thigh-r', view: 'front', label: '右太もも前', shape: { type: 'rect', x: 41, y: 120, w: 17, h: 44 } },
  { id: 'front-thigh-l', view: 'front', label: '左太もも前', shape: { type: 'rect', x: 62, y: 120, w: 17, h: 44 } },
  { id: 'front-shin-r', view: 'front', label: '右すね', shape: { type: 'rect', x: 42, y: 168, w: 15, h: 40 } },
  { id: 'front-shin-l', view: 'front', label: '左すね', shape: { type: 'rect', x: 63, y: 168, w: 15, h: 40 } },
  { id: 'front-foot', view: 'front', label: '足の甲', shape: { type: 'rect', x: 42, y: 212, w: 36, h: 14 } },
];

export const ZONE_IDS = new Set(BODY_ZONES.map((z) => z.id));

const LABELS = new Map(BODY_ZONES.map((z) => [z.id, z.label]));

// 部位IDの配列を、定義順を保った日本語ラベルの配列にする
export function zoneLabels(ids = []) {
  const set = new Set(ids);
  return BODY_ZONES.filter((z) => set.has(z.id)).map((z) => z.label);
}

export function zoneLabel(id) {
  return LABELS.get(id) || '';
}
