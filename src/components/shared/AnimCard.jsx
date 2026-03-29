import useEntrance from '../../hooks/useEntrance';

// Animated card wrapper
export default function AnimCard({ children, delay = 0, screenKey = '', style = {} }) {
  const visible = useEntrance(delay, screenKey);
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(14px)",
      transition: "opacity 0.45s ease, transform 0.45s ease",
      ...style,
    }}>
      {children}
    </div>
  );
}
