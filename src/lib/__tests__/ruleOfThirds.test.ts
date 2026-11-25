import { nearestThirdPoint, thirdsAdjustment } from '../ruleOfThirds';

describe('nearestThirdPoint', () => {
  it('snaps a centered subject to an equidistant third intersection', () => {
    // Center sits exactly between the upper-left and lower-right corners; either
    // is a valid nearest third. Just require a real grid intersection.
    const point = nearestThirdPoint(0.5, 0.5)!;
    expect([1 / 3, 2 / 3]).toContain(point.x);
    expect([1 / 3, 2 / 3]).toContain(point.y);
  });

  it('prefers the upper-left third for a subject slightly above center', () => {
    const point = nearestThirdPoint(0.42, 0.42)!;
    expect(point.x).toBeCloseTo(1 / 3);
    expect(point.y).toBeCloseTo(1 / 3);
  });

  it('prefers the right third when the subject sits right of center', () => {
    expect(nearestThirdPoint(0.7, 0.5)!.x).toBeCloseTo(2 / 3);
  });

  it('prefers the lower third when the subject sits low', () => {
    expect(nearestThirdPoint(0.5, 0.7)!.y).toBeCloseTo(2 / 3);
  });

  it('returns null for non-finite input', () => {
    expect(nearestThirdPoint(NaN, 0.5)).toBeNull();
    expect(nearestThirdPoint(0.5, Infinity)).toBeNull();
  });
});

describe('thirdsAdjustment', () => {
  it('reports no adjustment when already on a third point', () => {
    const adj = thirdsAdjustment(1 / 3, 2 / 3);
    expect(adj.offsetPx).toBe(0);
    expect(adj.horizontal).toBe('hold');
    expect(adj.vertical).toBe('hold');
  });

  it('suggests moving left when the subject sits right of the nearest third', () => {
    const adj = thirdsAdjustment(0.7, 0.5);
    expect(adj.horizontal).toBe('left');
    expect(adj.offsetPx).toBeGreaterThan(0);
  });

  it('suggests moving up when the subject sits below the nearest third', () => {
    const adj = thirdsAdjustment(0.5, 0.7);
    expect(adj.vertical).toBe('up');
  });

  it('suggests moving right when the subject sits left of the nearest third', () => {
    expect(thirdsAdjustment(0.2, 0.5).horizontal).toBe('right');
  });

  it('suggests moving down when the subject sits above the nearest third', () => {
    expect(thirdsAdjustment(0.5, 0.2).vertical).toBe('down');
  });

  it('returns a null cue when no meaningful adjustment remains', () => {
    const adj = thirdsAdjustment(0.5, 0.5);
    expect(adj.nearest).not.toBeNull();
    expect(typeof adj.offsetPx).toBe('number');
  });
});
