import { describe, it, expect } from 'vitest';
import {
  parseMoneyToCents,
  formatCentsToMoney,
  mulCents,
  sumCents,
  negateCents,
  percentOfCents,
  centsToDecimalString,
} from './money';

describe('Money Utilities', () => {
  describe('parseMoneyToCents', () => {
    it('parses simple decimal strings', () => {
      expect(parseMoneyToCents('12.34')).toBe(1234);
      expect(parseMoneyToCents('0.99')).toBe(99);
      expect(parseMoneyToCents('100')).toBe(10000);
      expect(parseMoneyToCents('0')).toBe(0);
    });

    it('parses European comma format', () => {
      expect(parseMoneyToCents('12,34')).toBe(1234);
      expect(parseMoneyToCents('0,99')).toBe(99);
    });

    it('parses currency symbols', () => {
      expect(parseMoneyToCents('€12.34')).toBe(1234);
      expect(parseMoneyToCents('$99.99')).toBe(9999);
      expect(parseMoneyToCents('£ 12.34')).toBe(1234);
    });

    it('parses numbers directly', () => {
      expect(parseMoneyToCents(12.34)).toBe(1234);
      expect(parseMoneyToCents(0.99)).toBe(99);
      expect(parseMoneyToCents(100)).toBe(10000);
    });

    it('handles negative values', () => {
      expect(parseMoneyToCents('-12.34')).toBe(-1234);
      expect(parseMoneyToCents(-12.34)).toBe(-1234);
    });

    it('handles the floating-point precision bug case', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in float
      const result = parseMoneyToCents(0.1) + parseMoneyToCents(0.2);
      expect(result).toBe(30); // Exact!
    });

    it('rejects invalid inputs', () => {
      expect(() => parseMoneyToCents(NaN)).toThrow('not finite');
      expect(() => parseMoneyToCents(Infinity)).toThrow('not finite');
      expect(() => parseMoneyToCents('invalid')).toThrow('could not be parsed');
      expect(() => parseMoneyToCents('' as any)).toThrow();
    });

    it('rounds fractional cents properly', () => {
      // Commercial rounding: round half away from zero
      expect(parseMoneyToCents(12.345)).toBe(1235); // rounds up
      expect(parseMoneyToCents(12.344)).toBe(1234); // rounds down
    });
  });

  describe('formatCentsToMoney', () => {
    it('formats cents to display string', () => {
      expect(formatCentsToMoney(1234, 'EUR')).toMatch(/12[,.]34/); // Locale-dependent
      expect(formatCentsToMoney(99, 'EUR')).toMatch(/0[,.]99/);
    });

    it('rejects non-integer cents', () => {
      expect(() => formatCentsToMoney(12.34)).toThrow('requires integer cents');
    });
  });

  describe('mulCents', () => {
    it('multiplies unit price by quantity', () => {
      expect(mulCents(1999, 3)).toBe(5997); // 19.99 * 3 = 59.97
      expect(mulCents(100, 10)).toBe(1000); // 1.00 * 10 = 10.00
    });

    it('handles fractional quantities', () => {
      expect(mulCents(1000, 2.5)).toBe(2500); // 10.00 * 2.5 = 25.00
    });

    it('rejects non-integer cents', () => {
      expect(() => mulCents(12.34, 2)).toThrow('requires integer unitCents');
    });
  });

  describe('sumCents', () => {
    it('sums array of cent values', () => {
      expect(sumCents([1000, 2000, 3000])).toBe(6000);
      expect(sumCents([99, 1])).toBe(100);
      expect(sumCents([])).toBe(0);
    });

    it('handles negative values', () => {
      expect(sumCents([1000, -500, 200])).toBe(700);
    });

    it('rejects non-integer values', () => {
      expect(() => sumCents([12.34, 56])).toThrow('requires integer values');
    });
  });

  describe('negateCents', () => {
    it('negates positive values', () => {
      expect(negateCents(1234)).toBe(-1234);
    });

    it('negates negative values', () => {
      expect(negateCents(-1234)).toBe(1234);
    });

    it('handles zero', () => {
      expect(negateCents(0)).toBe(0);
    });
  });

  describe('percentOfCents', () => {
    it('calculates VAT correctly', () => {
      expect(percentOfCents(10000, 19)).toBe(1900); // 19% of 100.00 = 19.00
      expect(percentOfCents(10000, 7)).toBe(700);   // 7% of 100.00 = 7.00
    });

    it('rounds fractional cents', () => {
      expect(percentOfCents(1000, 19)).toBe(190); // 19% of 10.00 = 1.90
    });
  });

  describe('centsToDecimalString (legacy)', () => {
    it('converts cents to decimal string', () => {
      expect(centsToDecimalString(1234)).toBe('12.34');
      expect(centsToDecimalString(99)).toBe('0.99');
      expect(centsToDecimalString(0)).toBe('0.00');
    });
  });

  describe('Invoice calculation examples', () => {
    it('handles real invoice line item calculation', () => {
      // 3 items @ 19.99 each
      const unitPriceCents = parseMoneyToCents('19.99');
      const quantity = 3;
      const lineTotal = mulCents(unitPriceCents, quantity);
      
      expect(lineTotal).toBe(5997); // Exact: 59.97
      expect(centsToDecimalString(lineTotal)).toBe('59.97');
    });

    it('calculates invoice total with VAT', () => {
      const item1 = mulCents(1999, 2); // 2x 19.99 = 39.98
      const item2 = mulCents(4999, 1); // 1x 49.99 = 49.99
      
      const subtotal = sumCents([item1, item2]); // 89.97
      expect(subtotal).toBe(8997);
      
      const vat = percentOfCents(subtotal, 19); // 19% VAT
      expect(vat).toBe(1709); // 17.09 (rounded)
      
      const total = sumCents([subtotal, vat]);
      expect(total).toBe(10706); // 107.06
    });

    it('handles cancellation invoice (negative values)', () => {
      const originalTotal = 10706;
      const cancellationTotal = negateCents(originalTotal);
      
      expect(cancellationTotal).toBe(-10706);
      expect(centsToDecimalString(cancellationTotal)).toBe('-107.06');
    });
  });
});

