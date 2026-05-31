import { useRef } from 'react';
import useThreeBackground from '../hooks/useThreeBackground';

export default function ThreeBackground({ opacity = 1.0 }) {
  const mountRef = useRef(null);
  useThreeBackground(mountRef);

  return (
    <div
      ref={mountRef}
      style={{ position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'none', opacity }}
      aria-hidden="true"
    />
  );
}
