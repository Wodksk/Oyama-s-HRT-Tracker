import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { formatDate, formatTime } from '../utils/helpers';
import { DoseEvent, LabResult, convertToPgMl, convertToNgMl, Ester } from '../../logic';
import { Activity, RotateCcw, Info, FlaskConical, Pill } from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, ComposedChart, Scatter, Brush
} from 'recharts';

// Sub-component for a single chart track to avoid duplication
const ChartTrack = ({ 
    data, 
    dataKey, 
    color, 
    unit, 
    yDomain,
    now,
    events, 
    labPoints,
    xDomain,
    height = 200,
    showXAxis = false,
    syncId,
    t, 
    lang 
}: any) => {
    return (
        <div style={{ height }} className="w-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} syncId={syncId} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                    <defs>
                        <linearGradient id={`grad${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2f4f7" />
                    {showXAxis && (
                        <XAxis 
                            dataKey="time" 
                            type="number" 
                            domain={xDomain || ['auto', 'auto']}
                            allowDataOverflow={true}
                            tickFormatter={(ms) => formatDate(new Date(ms), lang)}
                            tick={{fontSize: 10, fill: '#9aa3b1', fontWeight: 600}}
                            minTickGap={50}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                        />
                    )}
                    {!showXAxis && (
                         <XAxis 
                            dataKey="time" 
                            type="number" 
                            domain={xDomain || ['auto', 'auto']}
                            hide
                        />
                    )}
                    <YAxis 
                        dataKey={dataKey}
                        tick={{fontSize: 10, fill: '#9aa3b1', fontWeight: 600}}
                        axisLine={false}
                        tickLine={false}
                        domain={yDomain || ['auto', 'auto']}
                    />
                    <Tooltip 
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const pt = payload[0].payload;
                                // Custom Tooltip Logic
                                if (pt.isLabResult) {
                                     return (
                                        <div className="bg-white/95 backdrop-blur shadow-sm border border-gray-100 p-2 rounded-lg text-xs">
                                            <p className="text-gray-400 font-bold mb-1">{formatDate(new Date(label), lang)}</p>
                                            <div className="flex items-center gap-2">
                                                <FlaskConical size={12} className="text-teal-500" />
                                                <span className="font-mono font-bold text-gray-700">{pt.originalValue} {pt.originalUnit}</span>
                                            </div>
                                        </div>
                                     );
                                }
                                return (
                                    <div className="bg-white/95 backdrop-blur shadow-sm border border-gray-100 p-2 rounded-lg text-xs">
                                        <p className="text-gray-400 font-bold mb-1">{formatDate(new Date(label), lang)} {formatTime(new Date(label))}</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                                            <span className="font-mono font-bold text-gray-700">
                                                {payload[0].value.toFixed(1)} {unit}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <ReferenceLine x={now} stroke={color} strokeDasharray="3 3" strokeWidth={1} />
                    <Area 
                        type="monotone" 
                        dataKey={dataKey} 
                        stroke={color} 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill={`url(#grad${dataKey})`} 
                        isAnimationActive={false}
                    />
                    <Scatter 
                        data={events} 
                        isAnimationActive={false}
                        fill={color}
                        shape={(props: any) => {
                             const { cx, cy, payload } = props;
                             const r = Math.min(6, Math.max(3, Math.sqrt(payload.event.doseMG) * 1.5));
                             return <circle cx={cx} cy={cy} r={r} fill={color} stroke="white" strokeWidth={1} />;
                        }}
                    />
                    {labPoints && (
                        <Scatter 
                            data={labPoints}
                            isAnimationActive={false}
                            shape={({ cx, cy }: any) => (
                                <g transform={`translate(${cx-5}, ${cy-5})`}>
                                    <rect width={10} height={10} fill="#14b8a6" rx={2} />
                                    <FlaskConical size={8} x={1} y={1} color="white" />
                                </g>
                            )}
                        />
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

const ResultChart = ({ 
    e2Data, cpaData, e2Events, cpaEvents, 
    labResults = [], 
    calibrationFnE2, 
    calibrationFnCPA,
    onPointClick 
}: any) => {
    const { t, lang } = useTranslation();
    const [xDomain, setXDomain] = useState<[number, number] | null>(null);
    const now = new Date().getTime();

    // Prepare separate lab points
    const e2Labs = useMemo(() => labResults.filter((l: LabResult) => l.type !== 'CPA').map((l: LabResult) => ({
        time: l.timeH * 3600000,
        conc: convertToPgMl(l.concValue, l.unit),
        originalValue: l.concValue,
        originalUnit: l.unit,
        isLabResult: true
    })), [labResults]);

    const cpaLabs = useMemo(() => labResults.filter((l: LabResult) => l.type === 'CPA').map((l: LabResult) => ({
        time: l.timeH * 3600000,
        conc: convertToNgMl(l.concValue, l.unit), // Use ng/mL for CPA
        originalValue: l.concValue,
        originalUnit: l.unit,
        isLabResult: true
    })), [labResults]);

    // Initialize domain
    useEffect(() => {
        if (!xDomain && e2Data.length > 0) {
            const start = now - (7 * 24 * 3600 * 1000);
            const end = now + (7 * 24 * 3600 * 1000);
            setXDomain([start, end]);
        }
    }, [e2Data, now]);

    // Map events to chart coordinates
    const mapEvents = (evs: DoseEvent[], dataPoints: any[], key: string, calFn: any) => {
        return evs.map(e => {
            const timeMs = e.timeH * 3600000;
            const factor = calFn(e.timeH);
            // Find rough concentration
            const pt = dataPoints.find(p => Math.abs(p.time - timeMs) < 3600000);
            return {
                time: timeMs,
                [key]: (pt ? pt[key] : 0),
                event: e
            };
        });
    };

    const e2ChartPoints = useMemo(() => mapEvents(e2Events, e2Data, 'conc', calibrationFnE2), [e2Events, e2Data, calibrationFnE2]);
    const cpaChartPoints = useMemo(() => mapEvents(cpaEvents, cpaData, 'conc', calibrationFnCPA), [cpaEvents, cpaData, calibrationFnCPA]);

    const hasCPA = cpaData.length > 0 && cpaData.some((d: any) => d.conc > 0.1);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col select-none">
            {/* Header Controls */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
                 <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Activity size={16} className="text-pink-400" />
                    <span>{t('chart.title')}</span>
                 </h2>
                 <div className="flex gap-2">
                    <button onClick={() => {
                        const s = now - (30 * 24 * 3600 * 1000);
                        setXDomain([s, now + (2 * 24 * 3600 * 1000)]);
                    }} className="text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-50">1M</button>
                    <button onClick={() => {
                        const s = now - (7 * 24 * 3600 * 1000);
                        setXDomain([s, now + (1 * 24 * 3600 * 1000)]);
                    }} className="text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-50">1W</button>
                 </div>
            </div>

            <div className="p-2 space-y-4">
                {/* E2 Chart */}
                <div className="relative">
                    <div className="absolute left-10 top-2 z-10 pointer-events-none">
                        <span className="text-[10px] font-bold text-pink-400 bg-pink-50 px-1.5 py-0.5 rounded border border-pink-100">Estradiol (E2)</span>
                    </div>
                    <ChartTrack 
                        data={e2Data} 
                        dataKey="conc" 
                        color="#f472b6" 
                        unit="pg/mL"
                        now={now}
                        events={e2ChartPoints}
                        labPoints={e2Labs}
                        xDomain={xDomain}
                        height={200}
                        showXAxis={!hasCPA} // Only show X axis here if CPA chart is missing
                        syncId="simChart"
                        t={t} lang={lang}
                    />
                </div>

                {/* CPA Chart (Conditional) */}
                {hasCPA && (
                    <div className="relative pt-2 border-t border-gray-50">
                        <div className="absolute left-10 top-4 z-10 pointer-events-none">
                            <span className="text-[10px] font-bold text-sky-500 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">Cyproterone (CPA)</span>
                        </div>
                        <ChartTrack 
                            data={cpaData} 
                            dataKey="conc" 
                            color="#0ea5e9" 
                            unit="ng/mL"
                            now={now}
                            events={cpaChartPoints}
                            labPoints={cpaLabs}
                            xDomain={xDomain}
                            height={160}
                            showXAxis={true}
                            syncId="simChart"
                            t={t} lang={lang}
                        />
                    </div>
                )}
            </div>
            
            {/* Brush / Navigator */}
            <div className="h-12 px-2 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={e2Data}>
                        <XAxis dataKey="time" hide />
                        <YAxis hide />
                        <Brush 
                            dataKey="time" 
                            height={20} 
                            stroke="#e2e8f0"
                            tickFormatter={() => ""}
                            onChange={(range: any) => {
                                if(range.startIndex !== undefined) {
                                    setXDomain([e2Data[range.startIndex].time, e2Data[range.endIndex].time]);
                                }
                            }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ResultChart;