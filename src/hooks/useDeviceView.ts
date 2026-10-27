import { useEffect, useState } from 'react';

export type DeviceType = 'handphone' | 'tablet' | 'pc';

export interface DeviceInfo {
  deviceType: DeviceType;
  isHandphone: boolean;
  isTablet: boolean;
  isPC: boolean;
  isTouch: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
  deviceLabel: string;
}

const getWindowDeviceInfo = (): DeviceInfo => {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'pc',
      isHandphone: false,
      isTablet: false,
      isPC: true,
      isTouch: false,
      screenWidth: 1200,
      screenHeight: 800,
      orientation: 'landscape',
      deviceLabel: 'PC / Komputer',
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouch =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches;

  let deviceType: DeviceType = 'pc';
  let deviceLabel = 'PC / Komputer';

  if (width < 640) {
    deviceType = 'handphone';
    deviceLabel = 'Handphone';
  } else if (width < 1024) {
    deviceType = 'tablet';
    deviceLabel = 'Tablet';
  } else {
    deviceType = 'pc';
    deviceLabel = 'PC / Desktop';
  }

  return {
    deviceType,
    isHandphone: deviceType === 'handphone',
    isTablet: deviceType === 'tablet',
    isPC: deviceType === 'pc',
    isTouch,
    screenWidth: width,
    screenHeight: height,
    orientation: width > height ? 'landscape' : 'portrait',
    deviceLabel,
  };
};

export function useDeviceView(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getWindowDeviceInfo);

  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(getWindowDeviceInfo());
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return deviceInfo;
}
