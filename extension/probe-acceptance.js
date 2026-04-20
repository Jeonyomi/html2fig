export const ACCEPTANCE_STORAGE_KEY = 'html2fig-native-paste-matrix-v1';
export const DEFAULT_VARIANT_RECORD = { verdict: null, attempts: 0, notes: '' };

export function loadAcceptanceLog(storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(ACCEPTANCE_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function saveAcceptanceLog(acceptanceLog, storage = localStorage) {
  try {
    storage.setItem(ACCEPTANCE_STORAGE_KEY, JSON.stringify(acceptanceLog));
  } catch {}
}

export function getVariantRecord(acceptanceLog, label) {
  return acceptanceLog[label] || { ...DEFAULT_VARIANT_RECORD };
}

export function setVariantVerdict(acceptanceLog, label, verdict, extra = {}) {
  const record = getVariantRecord(acceptanceLog, label);
  const nextRecord = {
    ...record,
    ...extra,
    verdict,
    attempts: (record.attempts || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  const nextLog = { ...acceptanceLog };
  if (!verdict && !nextRecord.notes && !nextRecord.attempts) delete nextLog[label];
  else nextLog[label] = nextRecord;
  return nextLog;
}

export function setVariantNotes(acceptanceLog, label, notes) {
  const record = getVariantRecord(acceptanceLog, label);
  const cleaned = String(notes || '').trim();
  const nextRecord = {
    ...record,
    notes: cleaned,
    updatedAt: new Date().toISOString(),
  };
  const nextLog = { ...acceptanceLog };
  if (!nextRecord.verdict && !nextRecord.attempts && !cleaned) delete nextLog[label];
  else nextLog[label] = nextRecord;
  return nextLog;
}

export function exportAcceptanceMatrix({ lastCapturedData, lastProbeVariants, acceptanceLog }) {
  const lines = lastProbeVariants.map((variant, index) => {
    const record = getVariantRecord(acceptanceLog, variant.label);
    return {
      index: index + 1,
      variant: variant.label,
      verdict: record.verdict || '',
      attempts: record.attempts || 0,
      updatedAt: record.updatedAt || '',
      notes: record.notes || '',
      metadata: variant.metadata,
    };
  });
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    title: lastCapturedData?.meta?.title || '',
    url: lastCapturedData?.meta?.url || '',
    variants: lines,
  }, null, 2);
}

export function renderVariantMatrix({ lastCapturedData, lastProbeVariants, acceptanceLog, variantMatrixEl, variantRowsEl }) {
  if (!lastCapturedData || !lastProbeVariants.length) {
    variantMatrixEl.hidden = true;
    variantRowsEl.innerHTML = '';
    return;
  }
  variantMatrixEl.hidden = false;
  variantRowsEl.innerHTML = '';
  lastProbeVariants.forEach((variant) => {
    const row = document.createElement('div');
    row.className = 'matrix-row';

    const label = document.createElement('div');
    label.className = 'matrix-label';
    const record = getVariantRecord(acceptanceLog, variant.label);
    const verdict = record.verdict;
    const attemptText = record.attempts ? `, tries:${record.attempts}` : '';
    label.textContent = verdict ? `${variant.label} (${verdict}${attemptText})` : variant.label;

    const verdictChip = document.createElement('div');
    verdictChip.className = 'matrix-label';
    verdictChip.textContent = verdict || '';

    row.appendChild(label);
    row.appendChild(verdictChip);
    variantRowsEl.appendChild(row);
  });
}
