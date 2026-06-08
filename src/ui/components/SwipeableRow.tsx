import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { noir } from '../theme';
import type { SwipeAction } from './SwipeAction';
import { clampSwipeTranslate, resolveSwipeOpen } from './swipeableRowGesture';

export type { SwipeAction } from './SwipeAction';

export interface SwipeableRowProps {
  readonly children: React.ReactNode;
  /**
   * Management actions revealed by a left-swipe. Rendered left→right in array
   * order; the LAST entry sits nearest the swipe (right) edge and shows in the
   * resting peek — put the calmest action last for a calm (non-alarming) peek.
   */
  readonly actions: readonly SwipeAction[];
  /** Width of each action button, px. */
  readonly actionWidth?: number;
  /** Resting peek of the trailing action, px. */
  readonly peek?: number;
  /** Show the persistent `‹‹` pull handle. Defaults true. */
  readonly showHandle?: boolean;
  /** Card corner radius, px. Match the wrapped row's radius. */
  readonly borderRadius?: number;
  readonly testID?: string;
}

const DEFAULT_ACTION_WIDTH = 78;
const DEFAULT_PEEK = 8;

export function SwipeableRow({
  children,
  actions,
  actionWidth = DEFAULT_ACTION_WIDTH,
  peek = DEFAULT_PEEK,
  showHandle = true,
  borderRadius = 20,
  testID,
}: SwipeableRowProps) {
  const openWidth = actions.length * actionWidth;
  const closedX = -peek;
  const openX = -openWidth;

  // The PanResponder is created once, so its callbacks must read live geometry
  // from a ref — otherwise a row whose actions/width/peek change while mounted
  // would keep clamping and snapping against the first render's values.
  const geom = useRef({ openWidth, openX, closedX });
  geom.current = { openWidth, openX, closedX };

  const tx = useRef(new Animated.Value(closedX)).current;
  const currentX = useRef(closedX);
  const startX = useRef(closedX);

  useEffect(() => {
    const id = tx.addListener(({ value }) => {
      currentX.current = value;
    });
    return () => tx.removeListener(id);
  }, [tx]);

  // Re-rest at the new closed offset whenever the geometry changes.
  useEffect(() => {
    tx.setValue(closedX);
    currentX.current = closedX;
  }, [tx, closedX, openWidth]);

  const settle = useCallback(
    (open: boolean) => {
      Animated.spring(tx, {
        toValue: open ? geom.current.openX : geom.current.closedX,
        useNativeDriver: true,
        bounciness: 2,
        speed: 18,
      }).start();
    },
    [tx],
  );

  const pan = useRef(
    PanResponder.create({
      // Claim the gesture only on a clearly-horizontal drag, so a vertical
      // FlatList/ScrollView scroll passes straight through.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy) * 1.4 && Math.abs(g.dx) > 6,
      onPanResponderGrant: () => {
        startX.current = currentX.current;
      },
      onPanResponderMove: (_e, g) => {
        tx.setValue(clampSwipeTranslate({ startX: startX.current, dx: g.dx, openX: geom.current.openX }));
      },
      onPanResponderRelease: (_e, g) => {
        settle(resolveSwipeOpen({ translateX: currentX.current, velocityX: g.vx, openWidth: geom.current.openWidth }));
      },
      onPanResponderTerminate: () => settle(false),
    }),
  ).current;

  return (
    <View style={[styles.container, { borderRadius }]} testID={testID}>
      <View style={[styles.actionsLayer, { width: openWidth }]} pointerEvents="box-none">
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => {
              settle(false);
              action.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={[
              styles.action,
              { width: actionWidth },
              action.tone === 'danger' ? styles.actionDanger : styles.actionNeutral,
            ]}>
            <Ionicons name={action.icon} size={20} color="#fff" />
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
      <Animated.View
        testID={testID ? `${testID}-foreground` : undefined}
        style={[styles.foreground, { borderRadius, transform: [{ translateX: tx }] }]}
        {...pan.panHandlers}>
        <View style={styles.foregroundInner}>
          <View style={styles.childWrap}>{children}</View>
          {showHandle ? (
            <View style={styles.handle} importantForAccessibility="no-hide-descendants">
              <Ionicons name="chevron-back" size={15} color={noir.ink3} />
              <Ionicons name="chevron-back" size={15} color={noir.ink3} style={styles.handleSecond} />
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  actionsLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionNeutral: {
    backgroundColor: noir.indigo,
  },
  actionDanger: {
    backgroundColor: noir.danger,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  foreground: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
  },
  foregroundInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childWrap: {
    flex: 1,
    minWidth: 0,
  },
  handle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    paddingLeft: 2,
  },
  handleSecond: {
    marginLeft: -9,
  },
});
