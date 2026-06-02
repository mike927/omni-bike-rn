import React from 'react';
import { View } from 'react-native';

export function LinearGradient({ children, style }: { readonly children?: React.ReactNode; readonly style?: object }) {
  return <View style={style}>{children}</View>;
}
