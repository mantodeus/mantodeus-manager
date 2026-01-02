/**
 * Deterministic total extraction for text-based German receipts (PDF only).
 * No OCR - only uses embedded PDF text when available.
 */

type TotalExtractionResult = {
  grossAmountCents: number | null;
  confidence: "high" | "medium" | "low";
};

const TOTAL_KEYWORD_REGEX =
  /\b(SUMME|GESAMT|TOTAL|RECHNUNGSBETRAG|ZU\s+ZAHLEN|ENDSUMME|END\s+SUMME)\b/i;

const AMOUNT_REGEX = /(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2}))/g;

async function extractPdfText(pdfBuffer: Buffer): Promise<string | null> {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    const data = await pdfParse(pdfBuffer);
    return data.text || null;
  } catch (error) {
    console.error("[Expenses] Failed to extract PDF text:", error);
    return null;
  }
}

function parseAmountToCents(value: string): number | null {
  const cleaned = value.replace(/[^\d,.\s]/g, "").replace(/\s+/g, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  return Math.round(numeric * 100);
}

function extractAmounts(line: string): number[] {
  const matches = line.matchAll(AMOUNT_REGEX);
  const amounts: number[] = [];

  for (const match of matches) {
    const cents = parseAmountToCents(match[1] || match[0]);
    if (cents) amounts.push(cents);
  }

  return amounts;
}

export async function extractGermanTotalFromPdfText(
  pdfBuffer: Buffer
): Promise<TotalExtractionResult> {
  const text = await extractPdfText(pdfBuffer);
  if (!text || text.trim().length === 0) {
    return { grossAmountCents: null, confidence: "low" };
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates: Array<{ cents: number; score: number }> = [];
  const allAmounts: Array<{ cents: number; hasCurrency: boolean }> = [];

  const addCandidates = (line: string, baseScore: number) => {
    if (!line) return;
    const hasCurrency = /\u20ac|EUR/i.test(line);
    const amounts = extractAmounts(line);
    for (const cents of amounts) {
      candidates.push({ cents, score: baseScore + (hasCurrency ? 1 : 0) });
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const hasCurrency = /\u20ac|EUR/i.test(line);
    for (const cents of extractAmounts(line)) {
      allAmounts.push({ cents, hasCurrency });
    }

    if (TOTAL_KEYWORD_REGEX.test(line)) {
      addCandidates(line, 3);
      if (lines[i + 1]) {
        addCandidates(lines[i + 1], 2);
      }
    }
  }

  if (candidates.length > 0) {
    const best = candidates.sort((a, b) => b.score - a.score || b.cents - a.cents)[0];
    const confidence = best.score >= 4 ? "high" : "medium";
    return { grossAmountCents: best.cents, confidence };
  }

  if (allAmounts.length === 0) {
    return { grossAmountCents: null, confidence: "low" };
  }

  const maxAmount = allAmounts.reduce((max, current) =>
    current.cents > max.cents ? current : max
  );
  const hasCurrency = allAmounts.some((amount) => amount.hasCurrency);
  const confidence = hasCurrency || allAmounts.length === 1 ? "medium" : "low";

  return {
    grossAmountCents: confidence === "low" ? null : maxAmount.cents,
    confidence,
  };
}
