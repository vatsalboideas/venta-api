import { Request, Response } from "express";

import { prisma } from "../prisma";

type RevenueTrendRow = {
  bucket: Date;
  revenue: string | number;
};

type ConversionRateRow = {
  total_logs: string | number;
  closed_won_logs: string | number;
  conversion_rate: string | number;
};

type LeaderboardRow = {
  user_id: string;
  user_name: string;
  total_revenue: string | number;
  rank: string | number;
};

export async function getRevenueTrend(req: Request, res: Response) {
  const period = (req.query.period as string) ?? "month";
  const bucket = period === "day" ? "day" : "month";

  const rows = await prisma.$queryRaw<RevenueTrendRow[]>`
    SELECT
      date_trunc(${bucket}, l.created_at) AS bucket,
      COALESCE(SUM(l.actual_revenue), 0) AS revenue
    FROM logs l
    WHERE l.actual_revenue IS NOT NULL
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return res.json(
    rows.map((r) => ({
      bucket: r.bucket,
      revenue: Number(r.revenue),
    })),
  );
}

export async function getConversionRate(_req: Request, res: Response) {
  const rows = await prisma.$queryRaw<ConversionRateRow[]>`
    SELECT
      COUNT(*)::numeric AS total_logs,
      SUM(CASE WHEN l.status = 'CLOSED_WON' THEN 1 ELSE 0 END)::numeric AS closed_won_logs,
      CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE (SUM(CASE WHEN l.status = 'CLOSED_WON' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100
      END AS conversion_rate
    FROM logs l
  `;

  const row = rows[0] ?? { total_logs: 0, closed_won_logs: 0, conversion_rate: 0 };
  return res.json({
    totalLogs: Number(row.total_logs),
    closedWonLogs: Number(row.closed_won_logs),
    conversionRatePercent: Number(row.conversion_rate),
  });
}

export async function getLeaderboard(_req: Request, res: Response) {
  const rows = await prisma.$queryRaw<LeaderboardRow[]>`
    SELECT
      u.id AS user_id,
      u.name AS user_name,
      COALESCE(SUM(l.actual_revenue), 0) AS total_revenue,
      DENSE_RANK() OVER (ORDER BY COALESCE(SUM(l.actual_revenue), 0) DESC) AS rank
    FROM users u
    LEFT JOIN logs l ON l.assigned_to = u.id
    GROUP BY u.id, u.name
    ORDER BY total_revenue DESC
  `;

  return res.json(
    rows.map((r) => ({
      userId: r.user_id,
      userName: r.user_name,
      totalRevenue: Number(r.total_revenue),
      rank: Number(r.rank),
    })),
  );
}
