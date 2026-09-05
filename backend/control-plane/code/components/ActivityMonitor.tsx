'use client';

import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, AlertCircle, Clock, X, Trash2 } from 'lucide-react';
import Tooltip from './Tooltip';
import { ApiTelemetryEvent, ThemeMode } from '../lib/types';
import { subscribeTelemetry } from '../lib/api-client';

interface ActivityMonitorProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
}

export default function ActivityMonitor({
  isOpen,
  onClose,
  theme,
}: ActivityMonitorProps) {
  const [events, setEvents] = useState<ApiTelemetryEvent[]>([]);

  useEffect(() => {
    return subscribeTelemetry((ev) => {
      setEvents((prev) => {
        // Filter out any existing event with the same ID to prevent key duplicates during transition updates
        const filtered = prev.filter((item) => item.id !== ev.id);
        return [ev, ...filtered.slice(0, 19)];
      });
    });
  }, []);

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const surfaceClass = isDark
    ? 'bg-[#1E1E24] text-[#F3EDE0] border-black shadow-[6px_6px_0px_#000000]'
    : 'bg-[#FAF6F0] text-[#21140E] border-[#2C1810] shadow-[6px_6px_0px_#2C1810]';

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex h-72 w-80 flex-col border-3 ${surfaceClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black bg-black/20 p-2 font-mono text-xs">
        <div className="flex items-center gap-1.5 font-black uppercase text-[#D4AF37]">
          <Activity size={14} className="animate-pulse" />
          <span>TELEMETRY_LOG</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content="CLEAR">
            <button
              type="button"
              onClick={() => setEvents([])}
              className="flex h-5 w-5 items-center justify-center border border-black bg-black/20 hover:bg-black/40"
            >
              <Trash2 size={10} />
            </button>
          </Tooltip>
          <Tooltip content="CLOSE">
            <button
              type="button"
              onClick={onClose}
              className="flex h-5 w-5 items-center justify-center border border-black bg-black/20 hover:bg-black/40"
            >
              <X size={12} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Log Feed */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2 font-mono text-[10px]">
        {events.length === 0 ? (
          <div className="flex flex-1 items-center justify-center opacity-40">
            [STANDBY: NO_ACTIVITY]
          </div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center justify-between border border-black/30 bg-black/15 p-1.5"
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                {ev.status === 'success' ? (
                  <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                ) : ev.status === 'error' ? (
                  <AlertCircle size={12} className="text-rose-500 shrink-0" />
                ) : (
                  <Clock size={12} className="text-[#D4AF37] animate-spin shrink-0" />
                )}
                <span className="font-bold uppercase truncate">{ev.method}</span>
                <span className="truncate opacity-75">{ev.endpoint}</span>
              </div>
              <span className="shrink-0 text-[8px] opacity-60">
                {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
