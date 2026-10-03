import React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

export const ForecastChart = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <ComposedChart
      data={data.map(point => ({ ...point, confidenceRange: point.upperBound - point.lowerBound }))}
      margin={{ top: 8, right: 14, left: 0, bottom: 4 }}
    >
      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="date"
        tickFormatter={value => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        tick={{ fontSize: 11, fill: '#64748b' }}
        minTickGap={24}
      />
      <YAxis allowDecimals domain={[0, 'auto']} tick={{ fontSize: 11, fill: '#64748b' }} width={38} />
      <Tooltip
        labelFormatter={value => new Date(`${value}T00:00:00`).toLocaleDateString()}
        formatter={(value, name) => [Number(value).toFixed(2), name]}
      />
      <Area type="monotone" dataKey="lowerBound" name="Lower bound base" stackId="confidence" stroke="none" fill="transparent" fillOpacity={0} isAnimationActive={false} />
      <Area type="monotone" dataKey="confidenceRange" name="Confidence interval" stackId="confidence" stroke="none" fill="#fecaca" fillOpacity={0.6} isAnimationActive={false} />
      <Line type="monotone" dataKey="lowerBound" name="Lower bound" stroke="#fca5a5" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
      <Line type="monotone" dataKey="upperBound" name="Upper bound" stroke="#fca5a5" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
      <Line type="monotone" dataKey="predictedDemand" name="Expected demand" stroke="#991b1b" strokeWidth={3} dot={{ r: 3, fill: '#991b1b' }} activeDot={{ r: 5 }} isAnimationActive={false} />
    </ComposedChart>
  </ResponsiveContainer>
);

export default ForecastChart;