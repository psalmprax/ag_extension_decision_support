import { useState, useEffect } from 'react';

export interface DeviceThermalBudget {
  isLowEndDevice: boolean;
  shouldReduceBlur: boolean;
  disableComplexAnimations: boolean;
  pollIntervalMs: number;
  maxBatchSize: number;
  memoryGiB: number;
  cpuCores: number;
}

interface ExtendedNavigator extends Navigator {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  };
}

/**
 * Calculates adaptive hardware, thermal, and memory budgets to prevent
 * browser crashes, battery drain, and thermal throttling on low-end field mobile phones.
 */
export function calculateDeviceBudget(
  deviceMemory?: number,
  hardwareConcurrency?: number,
  isSaveData = false
): DeviceThermalBudget {
  const memoryGiB = deviceMemory || 4; // Default assumption 4GB if API unavailable
  const cpuCores = hardwareConcurrency || 4;

  const isLowEndDevice = memoryGiB <= 2 || cpuCores <= 2 || isSaveData;

  return {
    isLowEndDevice,
    shouldReduceBlur: isLowEndDevice,
    disableComplexAnimations: isLowEndDevice,
    pollIntervalMs: isLowEndDevice ? 30000 : 10000, // 30s vs 10s polling
    maxBatchSize: isLowEndDevice ? 10 : 50,
    memoryGiB,
    cpuCores,
  };
}

export function useDeviceThermalMemoryBudget(): DeviceThermalBudget {
  const [budget, setBudget] = useState<DeviceThermalBudget>(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return calculateDeviceBudget(4, 4, false);
    }
    const nav = navigator as ExtendedNavigator;
    const memory = nav.deviceMemory;
    const cores = nav.hardwareConcurrency;
    const saveData = nav.connection?.saveData || false;
    return calculateDeviceBudget(memory, cores, saveData);
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    const nav = navigator as ExtendedNavigator;
    const handleNetworkChange = () => {
      const memory = nav.deviceMemory;
      const cores = nav.hardwareConcurrency;
      const saveData = nav.connection?.saveData || false;
      setBudget(calculateDeviceBudget(memory, cores, saveData));
    };

    if (nav.connection) {
      nav.connection.addEventListener('change', handleNetworkChange);
      return () => nav.connection.removeEventListener('change', handleNetworkChange);
    }
  }, []);

  return budget;
}
