interface FlagProps { code?: string; size?: number }
export default function Flag({ code, size = 26 }: FlagProps) {
  if (!code) return <span style={{ width: size, height: Math.round(size * 0.67), display: 'inline-block' }} />
  return (
    <img src={`https://flagcdn.com/w40/${code}.png`} alt={code} width={size} height={Math.round(size * 0.67)}
      style={{ borderRadius: '3px', objectFit: 'cover', display: 'inline-block', verticalAlign: 'middle', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
  )
}
