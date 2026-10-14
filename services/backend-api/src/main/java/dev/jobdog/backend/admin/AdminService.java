package dev.jobdog.backend.admin;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Aggregate reads over the whole database, so plain SQL rather than entities: none of
 * this is a domain concept, it's counting.
 */
@Service
public class AdminService {

    private final JdbcTemplate jdbc;

    public AdminService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        Map<String, Object> out = new LinkedHashMap<>();

        out.put("users", jdbc.queryForMap("""
                SELECT count(*)                                                          AS total,
                       count(*) FILTER (WHERE created_at   > now() - interval '7 days')  AS new7d,
                       count(*) FILTER (WHERE created_at   > now() - interval '30 days') AS new30d,
                       count(*) FILTER (WHERE last_seen_at > now() - interval '1 day')   AS active24h,
                       count(*) FILTER (WHERE last_seen_at > now() - interval '7 days')  AS active7d,
                       count(*) FILTER (WHERE last_seen_at > now() - interval '30 days') AS active30d,
                       count(*) FILTER (WHERE password_hash = 'OAUTH2_LOGIN')            AS "viaSocialLogin"
                FROM users
                """));

        out.put("signupsByDay", jdbc.queryForList("""
                SELECT created_at::date AS day, count(*) AS signups
                FROM users
                WHERE created_at > now() - interval '30 days'
                GROUP BY 1 ORDER BY 1
                """));

        out.put("engagement", jdbc.queryForMap("""
                SELECT (SELECT count(*) FROM resumes)                                      AS resumes,
                       (SELECT count(*) FROM applications)                                 AS applications,
                       (SELECT count(*) FROM saved_jobs)                                   AS "savedJobs",
                       (SELECT count(*) FROM job_reports)                                  AS "jobReports",
                       (SELECT count(*) FROM job_reports WHERE verdict = 'DEAD')           AS "deadReports",
                       (SELECT count(DISTINCT user_id) FROM job_reports)                   AS "usersWhoReported"
                """));

        out.put("jobs", jdbc.queryForMap("""
                SELECT count(*) FILTER (WHERE status = 'ACTIVE')                           AS active,
                       count(*) FILTER (WHERE status = 'CLOSED' AND dead_at IS NOT NULL)   AS "closedAsDead"
                FROM jobs
                """));

        List<Map<String, Object>> recent = jdbc.queryForList("""
                SELECT u.display_name  AS name,
                       u.email         AS email,
                       u.created_at    AS joined,
                       u.last_seen_at  AS "lastSeen",
                       u.role          AS role,
                       u.resume_credits AS "uploadsLeft",
                       (u.password_hash = 'OAUTH2_LOGIN') AS "socialLogin",
                       (SELECT count(*) FROM resumes r      WHERE r.user_id = u.id) AS resumes,
                       (SELECT count(*) FROM applications a WHERE a.user_id = u.id) AS applications,
                       (SELECT count(*) FROM saved_jobs s   WHERE s.user_id = u.id) AS saved,
                       (SELECT count(*) FROM job_reports j  WHERE j.user_id = u.id) AS reports
                FROM users u
                ORDER BY u.created_at DESC
                LIMIT 100
                """);
        // Timestamps as ISO strings: the driver hands back java.sql.Timestamp, which Jackson would
        // render as epoch millis.
        for (Map<String, Object> row : recent) {
            row.replaceAll((k, v) -> v instanceof Timestamp ts ? ts.toInstant().toString() : v);
        }
        out.put("recentUsers", recent);
        return out;
    }
}
