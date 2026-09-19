import { StyleSheet, View } from 'react-native';

export function DeleteIcon() {
  return (
    <View accessibilityElementsHidden style={styles.icon}>
      <View style={[styles.line, styles.lineUp]} />
      <View style={[styles.line, styles.lineDown]} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    height: 20,
    transform: [{ translateX: 2 }, { translateY: -2 }],
    width: 20,
  },
  line: {
    backgroundColor: '#9f5f5f',
    borderRadius: 1,
    height: 1.5,
    left: 1,
    position: 'absolute',
    top: 9.25,
    width: 18,
  },
  lineUp: { transform: [{ rotate: '45deg' }] },
  lineDown: { transform: [{ rotate: '-45deg' }] },
});
