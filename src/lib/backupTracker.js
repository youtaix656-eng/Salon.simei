// バックアップ書き出し状況の記録。
// アプリのデータ本体とは別のlocalStorageキーで持つため、
// バックアップの復元やデモデータ読み込みでは変化しない。
import { todayStr, daysBetween } from './cycle.js';

export const BACKUP_KEY = 'salon-shimei-last-backup-v1';
export const STALE_DAYS = 30;

export function recordBackupDone(today = todayStr()) {
  try {
    localStorage.setItem(BACKUP_KEY, today);
  } catch {
    /* 保存できない環境では諦める */
  }
}

export function loadLastBackupDate() {
  try {
    const v = localStorage.getItem(BACKUP_KEY);
    return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null;
  } catch {
    return null;
  }
}

// 一度もバックアップしていない、または STALE_DAYS 日以上バックアップしていなければ true
export function shouldRemindBackup(lastBackupDate, today = todayStr(), staleDays = STALE_DAYS) {
  if (!lastBackupDate) return true;
  return daysBetween(lastBackupDate, today) >= staleDays;
}
