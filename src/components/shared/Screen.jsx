import { R } from '../../constants/theme';

export default function Screen({ children, style = {} }) {
  return (
    <div style={{
      maxWidth: 430, margin: "0 auto", minHeight: "100vh",
      background: R.bgPage, color: R.textPrimary, paddingBottom: 88,
      fontFamily: R.fontBody, position: "relative", overflow: "hidden",
      ...style,
    }}>
      {children}
    </div>
  );
}
