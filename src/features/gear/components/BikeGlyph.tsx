import Svg, { Circle, Path } from 'react-native-svg';

interface BikeGlyphProps {
  readonly color: string;
  readonly size?: number;
  readonly testID?: string;
}

export function BikeGlyph({ color, size = 22, testID }: BikeGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Circle cx={6.5} cy={16.5} r={3.5} stroke={color} strokeWidth={1.8} />
      <Circle cx={17.5} cy={16.5} r={3.5} stroke={color} strokeWidth={1.8} />
      <Path
        d="M6.5 16.5 10 8h4l3.5 8.5M10 8l-2-3m6 3 3-1.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
