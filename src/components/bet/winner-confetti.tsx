const COLORS = ['#F0D52E', '#E41827', '#F5F7FA', '#38BDF8', '#34D399']

export function WinnerConfetti({ count = 32 }: { count?: number }) {
  return (
    <div aria-hidden className="winner-confetti">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          style={{
            left: `${(index * 37) % 100}%`,
            backgroundColor: COLORS[index % COLORS.length],
            animationDelay: `${(index % 11) * 0.18}s`,
            animationDuration: `${2.6 + (index % 5) * 0.35}s`,
            width: index % 3 === 0 ? '5px' : '8px',
            height: index % 4 === 0 ? '8px' : '14px',
          }}
        />
      ))}
    </div>
  )
}
