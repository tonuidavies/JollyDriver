import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Imperative navigate used by the global side menu (outside screen tree). */
export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    // @ts-ignore - dynamic name
    navigationRef.navigate(name, params);
  }
}
