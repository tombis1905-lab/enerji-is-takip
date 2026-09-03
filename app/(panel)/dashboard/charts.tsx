'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid,
} from 'recharts'

const COLORS = ['#3B82F6', '#FF9149', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899']

export function IsTuruBarChart({ data }: { data: { ad: string; toplam: number; birim: string }[] }) {
  if (!data?.length) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Veri bulunamadı</div>
  }

  const formatted = data.map(d => ({
    ...d,
    kisaAd: d.ad.length > 12 ? d.ad.slice(0, 11) + '…' : d.ad,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="kisaAd"
          tickLine={false}
          tick={{ fontSize: 10 }}
          angle={-45}
          textAnchor="end"
          height={70}
          interval={0}
        />
        <YAxis tickLine={false} tick={{ fontSize: 10 }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          formatter={(value: any, _name: any, props: any) => [
            `${Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${props?.payload?.birim ?? ''}`,
            'Toplam',
          ]}
          labelFormatter={(label: any) => {
            const item = formatted.find(d => d.kisaAd === label)
            return item?.ad ?? label
          }}
        />
        <Bar dataKey="toplam" radius={[6, 6, 0, 0]} maxBarSize={50}>
          {(formatted ?? []).map((_: any, index: number) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SantiyePieChart({ data }: { data: { ad: string; kayitSayisi: number }[] }) {
  if (!data?.length) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Veri bulunamadı</div>
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          outerRadius={90}
          innerRadius={45}
          dataKey="kayitSayisi"
          nameKey="ad"
          paddingAngle={3}
          label={({ percent }: any) => `${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {(data ?? []).map((_: any, index: number) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          formatter={(value: any) => [`${value} kayıt`, 'Kayıt Sayısı']}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          iconSize={10}
          formatter={(value: any) => <span style={{ fontSize: 11, color: '#6b7280' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function ZamanLineChart({ data }: { data: { tarih: string; kayitSayisi: number }[] }) {
  if (!data?.length) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Veri bulunamadı</div>
  }

  const formatted = (data ?? []).map((d: any) => ({
    ...(d ?? {}),
    label: d?.tarih ? new Date(d.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }) : '',
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tickLine={false}
          tick={{ fontSize: 10 }}
          interval="preserveStartEnd"
        />
        <YAxis tickLine={false} tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          formatter={(value: any) => [`${value} kayıt`, 'Kayıt Sayısı']}
        />
        <Line
          type="monotone"
          dataKey="kayitSayisi"
          name="Kayıt Sayısı"
          stroke="#FF9149"
          strokeWidth={2.5}
          dot={{ fill: '#FF9149', r: 4, strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 6, strokeWidth: 2, stroke: '#FF9149', fill: '#fff' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
