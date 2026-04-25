import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useUiPreferences } from "../../hooks/useUiPreferences";
import EmptyState from "../ui/EmptyState";

export default function VitalChart({ data }) {
  const { t } = useUiPreferences();

  if (!data?.length) {
    return (
      <EmptyState
        title={t("chart.emptyTitle")}
        description={t("chart.emptyDescription")}
      />
    );
  }

  return (
    <div className="chart-wrapper live-chart">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 14, right: 10, left: 4, bottom: 6 }}>
          <defs>
            <linearGradient id="spo2Stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-2)" />
            </linearGradient>
            <linearGradient id="bpmStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 4" stroke="var(--line)" opacity={0.45} />
          <XAxis dataKey="label" stroke="var(--muted)" tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="left"
            domain={[80, 100]}
            stroke="var(--accent)"
            tickFormatter={(value) => `${value}%`}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="var(--primary)"
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 16,
              border: "1px solid var(--line)",
              background: "color-mix(in srgb, var(--surface) 86%, transparent)",
              backdropFilter: "blur(14px)",
              boxShadow: "var(--shadow-md)",
            }}
            cursor={{ stroke: "var(--line-strong)", strokeDasharray: "4 4" }}
          />
          <Legend wrapperStyle={{ paddingTop: 10 }} />
          <ReferenceLine
            yAxisId="left"
            y={90}
            stroke="var(--critical)"
            strokeDasharray="5 5"
            label={t("chart.spo2Alert")}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="spo2"
            name={t("chart.spo2Legend")}
            stroke="url(#spo2Stroke)"
            strokeWidth={3}
            isAnimationActive
            animationDuration={860}
            animationEasing="ease-out"
            activeDot={{ r: 4, fill: "var(--accent)" }}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="bpm"
            name={t("chart.bpmLegend")}
            stroke="url(#bpmStroke)"
            strokeWidth={3}
            isAnimationActive
            animationDuration={940}
            animationEasing="ease-out"
            activeDot={{ r: 4, fill: "var(--primary)" }}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
