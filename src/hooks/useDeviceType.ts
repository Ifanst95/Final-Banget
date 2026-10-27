import { useEffect, useState } from 'react';

export type DeviceType = 'handphone' | 'tablet' | 'desktop';

export interface DeviceInfo {
  type: DeviceType;
  isHandphone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  width: number;
}

export function useDeviceType(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        type: 'desktop',
        isHandphone: false,
        isTablet: false,
        isDesktop: true,
        isTouch: false,
        width: 1440,
      };
    }
    const w = window.innerWidth;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const type: DeviceType = w < 768 ? 'handphone' : w < 1280 ? 'tablet' : 'desktop';
    return {
      type,
      isHandphone: type === 'handphone',
      isTablet: type === 'tablet',
      isDesktop: type === 'desktop',
      isTouch,
      width: w,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const type: DeviceType = w < 768 ? 'handphone' : w < 1280 ? 'tablet' : 'desktop';
      setDeviceInfo({
        type,
        isHandphone: type === 'handphone',
        isTablet: type === 'tablet',
        isDesktop: type === 'desktop',
        isTouch,
        width: w,
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return deviceInfo;
}
