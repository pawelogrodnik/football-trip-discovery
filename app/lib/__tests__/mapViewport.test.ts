import {
  focusPanOffsetPx,
  insetsToFitPadding,
  normalizeInsets,
  panelViewportInsets,
  VIEWPORT_GUTTER_PX,
} from 'lib/mapViewport';

describe('normalizeInsets', () => {
  it('falls back to symmetric defaults when unavailable', () => {
    expect(normalizeInsets(null)).toEqual({ top: 48, right: 48, bottom: 48, left: 48 });
    expect(normalizeInsets({})).toEqual({ top: 48, right: 48, bottom: 48, left: 48 });
  });
});

describe('insetsToFitPadding', () => {
  it('maps insets to Leaflet fitBounds points', () => {
    expect(insetsToFitPadding({ top: 76, right: 484, bottom: 24, left: 24 })).toEqual({
      topLeft: [24, 76],
      bottomRight: [484, 24],
    });
  });
});

describe('focusPanOffsetPx', () => {
  it('is zero for a symmetric viewport', () => {
    expect(focusPanOffsetPx({ top: 48, right: 48, bottom: 48, left: 48 })).toEqual([0, 0]);
  });

  it('shifts the point left of the physical center for a right sidebar', () => {
    // Visible center sits left of the container center by (right-left)/2;
    // panBy moves the centered point by the negated delta.
    expect(focusPanOffsetPx({ top: 76, right: 484, bottom: 24, left: 24 })).toEqual([230, -26]);
  });
});

describe('panelViewportInsets', () => {
  it('uses symmetric gutters when the sidebar is closed', () => {
    expect(
      panelViewportInsets({
        panelWidthPx: 460,
        panelHeightPx: 500,
        panelVisible: false,
        isMobile: false,
      })
    ).toEqual({ top: 76, right: 24, bottom: 24, left: 24 });
  });

  it('tracks the real measured sidebar width on desktop', () => {
    const insets = panelViewportInsets({
      panelWidthPx: 412.5,
      panelHeightPx: 500,
      panelVisible: true,
      isMobile: false,
    });
    expect(insets.right).toBeCloseTo(412.5 + VIEWPORT_GUTTER_PX);
    expect(insets.left).toBe(VIEWPORT_GUTTER_PX);
    expect(insets.bottom).toBe(VIEWPORT_GUTTER_PX);
  });

  it('falls back to a safe width before measurement arrives', () => {
    const insets = panelViewportInsets({
      panelWidthPx: null,
      panelHeightPx: null,
      panelVisible: true,
      isMobile: false,
    });
    expect(insets.right).toBe(460 + VIEWPORT_GUTTER_PX);
  });

  it('tracks bottom-sheet height instead of width on mobile', () => {
    const insets = panelViewportInsets({
      panelWidthPx: 380,
      panelHeightPx: 300,
      panelVisible: true,
      isMobile: true,
    });
    expect(insets.bottom).toBe(300 + VIEWPORT_GUTTER_PX);
    expect(insets.right).toBe(VIEWPORT_GUTTER_PX);
  });
});
