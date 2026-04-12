let _injected = false;

function injectKeyframes() {
  if (_injected) return;
  _injected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes skeletonPulse {
      0%   { opacity: 0.5; }
      50%  { opacity: 1.0; }
      100% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
}

export default function Skeleton({ width = '100%', height = '16px', borderRadius = '6px', style = {} }) {
  injectKeyframes();
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: 'rgba(255,255,255,0.07)',
      animation: 'skeletonPulse 1.6s ease-in-out infinite',
      ...style,
    }} />
  );
}
