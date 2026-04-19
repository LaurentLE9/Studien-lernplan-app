import React, { useMemo } from "react";
import { BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function TopicTimeStatsCard({
  darkMode,
  topics,
  subjects,
  timeEntriesByTopic,
  getSurfaceClass,
}) {
  const topicStats = useMemo(() => {
    if (!Array.isArray(topics) || topics.length === 0) {
      return [];
    }

    return topics
      .map((topic) => {
        const subject = subjects?.find((s) => s.id === topic.subjectId);
        const totalMinutes = timeEntriesByTopic?.[topic.id] || 0;
        const hours = (totalMinutes / 60).toFixed(2);

        return {
          id: topic.id,
          title: topic.title || "Unbenannt",
          subjectId: topic.subjectId,
          subjectName: subject?.name || "Fach",
          totalMinutes,
          hours: parseFloat(hours),
          formattedHours: `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}h`,
        };
      })
      .filter((stat) => stat.totalMinutes > 0)
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [topics, subjects, timeEntriesByTopic]);

  const chartData = topicStats.map((stat) => ({
    name: stat.title,
    hours: stat.hours,
    subject: stat.subjectName,
  }));

  const totalMinutes = topicStats.reduce((sum, stat) => sum + stat.totalMinutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(2);

  return (
    <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
      <CardHeader>
        <CardTitle>Zeit pro Aufgabe</CardTitle>
        <CardDescription>Gesamte investierte Lernzeit gruppiert nach Aufgaben.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {topicStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Lernzeitdaten für Aufgaben verfügbar.</p>
        ) : (
          <>
            {/* Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis label={{ value: "Stunden", angle: -90, position: "insideLeft" }} />
                  <Tooltip
                    formatter={(value) => `${value.toFixed(2)}h`}
                    labelFormatter={(label) => `Aufgabe: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="hours" fill="#3b82f6" name="Stunden" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn(
                    "border-b",
                    darkMode ? "border-slate-700" : "border-slate-200"
                  )}>
                    <th className="px-4 py-2 text-left font-semibold">Aufgabe</th>
                    <th className="px-4 py-2 text-left font-semibold">Fach</th>
                    <th className="px-4 py-2 text-right font-semibold">Zeit</th>
                  </tr>
                </thead>
                <tbody>
                  {topicStats.map((stat) => (
                    <tr
                      key={stat.id}
                      className={cn(
                        "border-b",
                        darkMode ? "border-slate-700 hover:bg-slate-700/30" : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <td className="px-4 py-3">{stat.title}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{stat.subjectName}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{stat.formattedHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className={cn(
              "rounded-lg p-4",
              darkMode ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-900"
            )}>
              <div className="flex justify-between">
                <span className="font-medium">Gesamtzeit alle Aufgaben:</span>
                <span className="font-bold">{Math.floor(totalMinutes / 60)}:{String(totalMinutes % 60).padStart(2, "0")}h</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
