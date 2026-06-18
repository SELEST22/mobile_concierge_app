import { Alert } from 'react-native';

/**
 * Destructive-delete confirmation. The CEO asked that deleting a notification
 * always warn the user that the action cannot be reversed.
 */
export function confirmDelete(onConfirm: () => void, title = 'Delete notification?') {
  Alert.alert(
    title,
    'This action cannot be reversed. The notification will be permanently removed from your account.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ],
  );
}
