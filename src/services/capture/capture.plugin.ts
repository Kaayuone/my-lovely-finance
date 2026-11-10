import { registerPlugin } from '@capacitor/core';
import type { CapturePluginApi } from './capture.types';

// A plugin of this project rather than of npm (ADR-0003): the Android half is
// `android/app/src/main/java/my/lovely/finance/CapturePlugin.java`, registered by MainActivity
export const Capture = registerPlugin<CapturePluginApi>('Capture');
