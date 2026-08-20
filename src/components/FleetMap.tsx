import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors, type, fonts, spacing, radius } from '../theme';

export type MapVehicle = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  /** 0 = north, clockwise */
  heading?: number;
  moving?: boolean;
  tone: string;
};

type Props = {
  vehicles: MapVehicle[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  height?: number;
};

const PAD = 26;

/**
 * A dependency-free plan view of the fleet.
 *
 * There's no map SDK in this project, so instead of pretending to draw roads we
 * plot every last-known fix on an equirectangular canvas scaled to the fleet's
 * own bounding box, with a scale bar for distance. It answers "who's where,
 * relative to everyone else" at a glance; the detail card links out to a real
 * map for turn-by-turn context.
 */
export default function FleetMap({ vehicles, selectedKey, onSelect, height = 260 }: Props) {
  const { width: screenW } = useWindowDimensions();
  const width = screenW - spacing.marginMobile * 2;

  const { points, scaleKm } = useMemo(() => {
    const valid = vehicles.filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng));
    if (valid.length === 0) return { points: [], scaleKm: 0 };

    const lats = valid.map((v) => v.lat);
    const lngs = valid.map((v) => v.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Keep a floor on the span so a single vehicle (or a tight cluster) doesn't
    // blow up to fill the canvas as if it were spread across the county.
    const latSpan = Math.max(maxLat - minLat, 0.02);
    const lngSpan = Math.max(maxLng - minLng, 0.02);
    const cLat = (minLat + maxLat) / 2;
    const cLng = (minLng + maxLng) / 2;

    const innerW = Math.max(1, width - PAD * 2);
    const innerH = Math.max(1, height - PAD * 2);

    // Kilometres per degree: latitude is ~111 everywhere, longitude shrinks
    // toward the poles. ONE km-per-pixel is used for both axes so the plot keeps
    // real proportions instead of stretching to fill the box.
    const kmPerLat = 111;
    const kmPerLng = 111 * Math.cos((cLat * Math.PI) / 180);
    const spanKmY = latSpan * 1.4 * kmPerLat;
    const spanKmX = lngSpan * 1.4 * kmPerLng;
    const kmPerPx = Math.max(spanKmY / innerH, spanKmX / innerW) || 0.0001;

    const pts = valid.map((v) => ({
      ...v,
      x: PAD + innerW / 2 + ((v.lng - cLng) * kmPerLng) / kmPerPx,
      y: PAD + innerH / 2 - ((v.lat - cLat) * kmPerLat) / kmPerPx,
    }));

    return { points: pts, scaleKm: kmPerPx * (innerW / 4) };
  }, [vehicles, width, height]);

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No positions to plot yet.</Text>
      </View>
    );
  }

  const gridX = [0.25, 0.5, 0.75];

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} rx={radius.card} fill={colors.surfaceContainer} />

        {/* graticule */}
        {gridX.map((f) => (
          <Line key={`v${f}`} x1={width * f} y1={8} x2={width * f} y2={height - 8} stroke={colors.outlineVariant} strokeWidth={0.5} strokeDasharray="3 5" />
        ))}
        {gridX.map((f) => (
          <Line key={`h${f}`} x1={8} y1={height * f} x2={width - 8} y2={height * f} stroke={colors.outlineVariant} strokeWidth={0.5} strokeDasharray="3 5" />
        ))}

        {/* scale bar */}
        <Line x1={PAD} y1={height - 14} x2={PAD + (width - PAD * 2) / 4} y2={height - 14} stroke={colors.outline} strokeWidth={2} />
        <SvgText x={PAD} y={height - 20} fill={colors.onSurfaceVariant} fontSize={9} fontFamily={fonts.monoMedium}>
          {scaleKm >= 1 ? `${scaleKm.toFixed(1)} km` : `${Math.round(scaleKm * 1000)} m`}
        </SvgText>
        <SvgText x={width - PAD} y={22} fill={colors.outline} fontSize={10} fontFamily={fonts.monoMedium} textAnchor="middle">N</SvgText>
        <Path
          d={`M ${width - PAD} 26 l -4 8 l 4 -2.5 l 4 2.5 z`}
          fill={colors.outline}
        />

        {points.map((p) => {
          const selected = p.key === selectedKey;
          return (
            <G key={p.key} onPress={() => onSelect?.(p.key)}>
              {/* generous invisible hit area */}
              <Circle cx={p.x} cy={p.y} r={22} fill="transparent" />
              {selected && <Circle cx={p.x} cy={p.y} r={16} fill={p.tone} opacity={0.16} />}
              {p.moving && <Circle cx={p.x} cy={p.y} r={11} fill={p.tone} opacity={0.22} />}
              <Circle
                cx={p.x}
                cy={p.y}
                r={selected ? 8 : 6}
                fill={p.tone}
                stroke={colors.surfaceContainerLowest}
                strokeWidth={selected ? 3 : 2}
              />
              {/* heading needle */}
              {p.moving && typeof p.heading === 'number' && (
                <Line
                  x1={p.x}
                  y1={p.y}
                  x2={p.x + Math.sin((p.heading * Math.PI) / 180) * 15}
                  y2={p.y - Math.cos((p.heading * Math.PI) / 180) * 15}
                  stroke={p.tone}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )}
              {selected && (
                <SvgText
                  x={p.x}
                  y={p.y - 18}
                  fill={colors.onSurface}
                  fontSize={11}
                  fontFamily={fonts.sansBold}
                  textAnchor="middle"
                >
                  {p.label}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
      <Text style={styles.caption}>
        Relative positions — tap a vehicle to focus it. Open it in Maps for roads and directions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  caption: { ...type.labelSm, fontSize: 10, color: colors.outline, marginTop: spacing.xs, textAlign: 'center' },
  empty: { backgroundColor: colors.surfaceContainer, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.bodySm, color: colors.onSurfaceVariant },
});
