import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';

type Choice = { id: number; name: string };

type Props = {
  label: string;
  noneLabel: string;
  emptyLabel: string;
  choices: Choice[];
  value?: number;
  onChange: (value: number | undefined) => void;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  disabled?: boolean;
};

export function UploadChoicePicker({
  label, noneLabel, emptyLabel, choices, value, onChange, open, onToggle, onClose,
  loading, error, onRetry, disabled,
}: Props) {
  const c = useColors();
  const { t } = useLocale();
  const selected = choices.find(choice => choice.id === value)?.name;
  return <View style={styles.root}>
    <Text style={[styles.label, { color: c.foreground }]}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open, disabled }}
      disabled={disabled} onPress={onToggle} style={[styles.picker, { borderColor: c.border }]}>
      <Text numberOfLines={1} style={[styles.pickerText, { color: c.foreground }]}>
        {value === undefined ? noneLabel : selected ?? label}
      </Text>
      <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.foreground} />
    </Pressable>
    {open ? <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled"
      style={[styles.options, { borderColor: c.border }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: value === undefined }}
        disabled={disabled} onPress={() => { onChange(undefined); onClose(); }} style={styles.option}>
        <Text style={{ color: c.foreground }}>{noneLabel}</Text>
      </Pressable>
      {loading ? <ActivityIndicator color={c.primary} style={styles.option} /> : error
        ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.option}>
            <Text style={{ color: c.primary }}>{t('retry')}</Text>
          </Pressable>
        : choices.length === 0 ? <Text style={[styles.option, { color: c.mutedForeground }]}>{emptyLabel}</Text>
        : choices.map(choice => <Pressable key={choice.id} accessibilityRole="button"
            accessibilityState={{ selected: value === choice.id }} disabled={disabled}
            onPress={() => { onChange(choice.id); onClose(); }} style={styles.option}>
            <Text style={{ color: c.foreground }}>{choice.name}</Text>
          </Pressable>)}
    </ScrollView> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { marginTop: 14 },
  label: { fontWeight: '600' },
  picker: { borderWidth: 1, borderRadius: 6, padding: 12, marginTop: 8, minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  pickerText: { flex: 1 },
  options: { borderWidth: 1, borderRadius: 6, maxHeight: 220, marginTop: 4 },
  option: { minHeight: 44, padding: 12, justifyContent: 'center' },
});