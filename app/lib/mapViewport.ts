/**
 * Generic map viewport insets (CSS pixels) describing floating UI that
 * overlays the full-size Leaflet canvas. The actually visible map region is
 * the container minus these insets — all centering/fitting math targets
 * the visible region, never the raw container.
 */
export type MapViewportInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const DEFAULT_MAP_VIEWPORT_INSETS: MapViewportInsets = {
  top: 48,
  right: 48,
  bottom: 48,
  left: 48,
};

/** Extra gutter between a floating panel edge and fitted content. */
export const VIEWPORT_GUTTER_PX = 24;

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
}

export function normalizeInsets(insets?: Partial<MapViewportInsets> | null): MapViewportInsets {
  return {
    top: num(insets?.top, DEFAULT_MAP_VIEWPORT_INSETS.top),
    right: num(insets?.right, DEFAULT_MAP_VIEWPORT_INSETS.right),
    bottom: num(insets?.bottom, DEFAULT_MAP_VIEWPORT_INSETS.bottom),
    left: num(insets?.left, DEFAULT_MAP_VIEWPORT_INSETS.left),
  };
}

/** Convert insets to Leaflet fitBounds padding points. */
export function insetsToFitPadding(insets: MapViewportInsets): {
  topLeft: [number, number];
  bottomRight: [number, number];
} {
  return {
    topLeft: [insets.left, insets.top],
    bottomRight: [insets.right, insets.bottom],
  };
}

/**
 * Pixel offset for map.panBy() so a point currently at the container center
 * lands at the center of the visible (inset) region instead.
 * Positive right inset shifts the point left of the physical center.
 */
export function focusPanOffsetPx(insets: MapViewportInsets): [number, number] {
  return [(insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2];
}

/**
 * Build insets for a floating side/bottom panel measured at runtime.
 * Desktop: right inset tracks the real panel width. Mobile bottom sheet:
 * bottom inset tracks the real panel height instead.
 */
export function panelViewportInsets(options: {
  panelWidthPx: number | null;
  panelHeightPx: number | null;
  panelVisible: boolean;
  isMobile: boolean;
  topPx?: number;
  fallbackWidthPx?: number;
  fallbackHeightPx?: number;
}): MapViewportInsets {
  const {
    panelWidthPx,
    panelHeightPx,
    panelVisible,
    isMobile,
    topPx = 76,
    fallbackWidthPx = 460,
    fallbackHeightPx = 320,
  } = options;
  if (!panelVisible) {
    return {
      top: topPx,
      right: VIEWPORT_GUTTER_PX,
      bottom: VIEWPORT_GUTTER_PX,
      left: VIEWPORT_GUTTER_PX,
    };
  }
  if (isMobile) {
    return {
      top: topPx,
      right: VIEWPORT_GUTTER_PX,
      bottom: (panelHeightPx ?? fallbackHeightPx) + VIEWPORT_GUTTER_PX,
      left: VIEWPORT_GUTTER_PX,
    };
  }
  return {
    top: topPx,
    right: (panelWidthPx ?? fallbackWidthPx) + VIEWPORT_GUTTER_PX,
    bottom: VIEWPORT_GUTTER_PX,
    left: VIEWPORT_GUTTER_PX,
  };
}
