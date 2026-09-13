import { Alert } from 'react-native';

export type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function confirmAction({
  title,
  message,
  confirmLabel,
  onConfirm,
}: ConfirmationOptions): void {
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
