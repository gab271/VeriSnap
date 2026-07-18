/**
 * A label/value row — the atom of the whole interface.
 *
 * This is the structure of the evidence record itself, so it is reused
 * everywhere: on the record screen, on the capture you haven't filed yet, and on
 * the sign-in screen. The app is formatted like the thing it produces.
 *
 * `note` is for qualifications that would be dishonest to omit — whose clock a
 * timestamp came from, whether a capture happened on a simulator.
 */
import { StyleSheet, Text, View } from 'react-native';

import { palette, space, type } from '@/theme/tokens';

interface FieldProps {
  label: string;
  value: string;
  note?: string;
}

export function Field({ label, value, note }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueWrap}>
        <Text style={styles.value}>{value}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  label: { ...type.label, color: palette.mist, width: 92, paddingTop: 3 },
  valueWrap: { flex: 1, gap: 2 },
  value: { ...type.data, color: palette.chalk },
  note: { ...type.dataSmall, color: palette.mist },
});
