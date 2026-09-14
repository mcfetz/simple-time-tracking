import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import type { MonthlyBalancePoint } from '../lib/types'
import { useI18n } from '../lib/i18n'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend)

function fmtHours(min: number): string {
  const sign = min < 0 ? '-' : ''
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (m === 0) return `${sign}${h}h`
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`
}

export function MonthlyBalanceChart({ points }: { points: MonthlyBalancePoint[] }) {
  const { t } = useI18n()
  const labels = points.map((p) => p.label)
  const monthlyHours = points.map((p) => p.balance_minutes / 60)
  const cumHours = points.map((p) => p.cumulative_balance_minutes / 60)

  const data = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: t('reports.monthlyBalance'),
        data: monthlyHours,
        yAxisID: 'y',
        backgroundColor: monthlyHours.map((v) => (v >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)')),
        borderColor: monthlyHours.map((v) => (v >= 0 ? 'rgb(34,197,94)' : 'rgb(239,68,68)')),
        borderWidth: 1,
      },
      {
        type: 'line' as const,
        label: t('reports.cumulativeBalance'),
        data: cumHours,
        yAxisID: 'y1',
        borderColor: 'rgb(59,130,246)',
        backgroundColor: 'rgb(59,130,246)',
        tension: 0.2,
        pointRadius: 3,
        borderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false as const,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const v = ctx.parsed.y ?? 0
            const minutes = Math.round(v * 60)
            return `${ctx.dataset.label ?? ''}: ${fmtHours(minutes)}`
          },
        },
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        title: { display: true, text: t('reports.monthlyBalance') + ' (h)' },
        grid: { color: 'rgba(0,0,0,0.06)' },
      },
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        title: { display: true, text: t('reports.cumulativeBalance') + ' (h)' },
        grid: { drawOnChartArea: false },
      },
    },
  }

  return (
    <div style={{ height: 280 }}>
      <Chart type="bar" data={data} options={options} />
    </div>
  )
}
