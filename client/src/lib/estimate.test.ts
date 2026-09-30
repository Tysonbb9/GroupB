import { MAX_ESTIMATE_HOURS, parseEstimate } from './estimate';

describe('parseEstimate', () => {
  it('reads whole and half hours', () => {
    expect(parseEstimate('4')).toEqual({ ok: true, hours: 4 });
    expect(parseEstimate('2.5')).toEqual({ ok: true, hours: 2.5 });
  });

  it('ignores surrounding spaces', () => {
    expect(parseEstimate('  6 ')).toEqual({ ok: true, hours: 6 });
  });

  it('treats blank as "not estimated yet"', () => {
    expect(parseEstimate('')).toEqual({ ok: true, hours: null });
    expect(parseEstimate('   ')).toEqual({ ok: true, hours: null });
  });

  it('accepts the largest allowed estimate but nothing above it', () => {
    expect(parseEstimate(String(MAX_ESTIMATE_HOURS))).toEqual({
      ok: true,
      hours: MAX_ESTIMATE_HOURS,
    });
    expect(parseEstimate(String(MAX_ESTIMATE_HOURS + 1))).toEqual({ ok: false });
  });

  it('rejects zero, negatives, and text', () => {
    expect(parseEstimate('0')).toEqual({ ok: false });
    expect(parseEstimate('-3')).toEqual({ ok: false });
    expect(parseEstimate('abc')).toEqual({ ok: false });
    expect(parseEstimate('4 hours')).toEqual({ ok: false });
    expect(parseEstimate('1e2')).toEqual({ ok: false });
  });
});
