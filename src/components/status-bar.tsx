interface StatusBarProps {
  text: string;
  variant: 'normal' | 'incident';
}

export function StatusBar({ text, variant }: StatusBarProps) {
  const isIncident = variant === 'incident';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 5,
        alignItems: 'center',
        transition: 'color 0.5s',
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: isIncident ? '#e8c840' : '#4caf50',
          transition: 'background-color 0.5s',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 9.5,
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          color: isIncident ? '#8a6500' : '#888',
          transition: 'color 0.5s',
        }}
      >
        {text}
      </span>
    </div>
  );
}
