CREATE OR REPLACE VIEW revenue_trend_view AS
SELECT
  date_trunc('month', l.created_at) AS bucket_month,
  COALESCE(SUM(l.actual_revenue), 0) AS revenue
FROM logs l
WHERE l.actual_revenue IS NOT NULL
GROUP BY 1
ORDER BY 1;

CREATE OR REPLACE VIEW conversion_rate_view AS
SELECT
  COUNT(*)::numeric AS total_logs,
  SUM(CASE WHEN l.status = 'CLOSED_WON' THEN 1 ELSE 0 END)::numeric AS closed_won_logs,
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE (SUM(CASE WHEN l.status = 'CLOSED_WON' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100
  END AS conversion_rate
FROM logs l;

CREATE OR REPLACE VIEW leaderboard_view AS
SELECT
  u.id AS user_id,
  u.name AS user_name,
  COALESCE(SUM(l.actual_revenue), 0) AS total_revenue,
  DENSE_RANK() OVER (ORDER BY COALESCE(SUM(l.actual_revenue), 0) DESC) AS rank
FROM users u
LEFT JOIN logs l ON l.assigned_to = u.id
GROUP BY u.id, u.name
ORDER BY total_revenue DESC;
