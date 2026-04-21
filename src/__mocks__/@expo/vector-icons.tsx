import { View } from 'react-native';

type IconProps = {
  name?: string;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
  accessibilityRole?: string;
};

function createIconMock() {
  return function IconMock(props: IconProps) {
    return (
      <View
        accessible
        accessibilityLabel={props.accessibilityLabel}
        accessibilityRole={props.accessibilityRole as View['props']['accessibilityRole']}
      />
    );
  };
}

export const FontAwesome5 = createIconMock();
export const Ionicons = createIconMock();
export const AntDesign = createIconMock();
export const Entypo = createIconMock();
export const EvilIcons = createIconMock();
export const Feather = createIconMock();
export const FontAwesome = createIconMock();
export const FontAwesome6 = createIconMock();
export const Fontisto = createIconMock();
export const Foundation = createIconMock();
export const MaterialCommunityIcons = createIconMock();
export const MaterialIcons = createIconMock();
export const Octicons = createIconMock();
export const SimpleLineIcons = createIconMock();
export const Zocial = createIconMock();
