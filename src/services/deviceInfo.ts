/**
 * Device fingerprint captured alongside each piece of evidence.
 *
 * Recording which physical device produced the capture strengthens the chain of
 * custody (it ties the evidence to a specific handset) and the `isPhysicalDevice`
 * flag lets us distinguish genuine captures from ones taken on a simulator.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import type { DeviceInfo } from '@/types/evidence';

export function getDeviceInfo(): DeviceInfo {
  return {
    brand: Device.brand,
    manufacturer: Device.manufacturer,
    modelName: Device.modelName,
    osName: Device.osName,
    osVersion: Device.osVersion,
    isPhysicalDevice: Device.isDevice,
    appVersion: Constants.expoConfig?.version ?? null,
  };
}
